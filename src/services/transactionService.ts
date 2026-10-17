import { getCurrentUserId, supabase } from '../config/supabase';
import { CartItem, PaymentInfo, Transaction, TransactionItem } from '../types/database';
import { deductLocalStock } from './productService';
import {
  checkInternetConnection,
  formatLocalDate,
  getNextDailyInvoiceSeq,
  saveCachedTodayTransaction,
  saveTransactionOffline,
} from './syncService';

export const formatRupiah = (amount?: number | null): string => {
  const numeric = typeof amount === 'number' && !isNaN(amount) ? amount : Number(amount) || 0;
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(numeric);
};

export { formatLocalDate };

/**
 * Mendapatkan objek Date awal hari (00:00:00.000) pada zona waktu lokal perangkat
 */
export const getStartOfLocalDay = (d: Date = new Date()): Date => {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
};

/**
 * Mendapatkan objek Date akhir hari (23:59:59.999) pada zona waktu lokal perangkat
 */
export const getEndOfLocalDay = (d: Date = new Date()): Date => {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
};

/**
 * Mengubah string tanggal YYYY-MM-DD menjadi Date awal hari atau akhir hari pada zona waktu lokal
 */
export const parseLocalDate = (dateStr: string, isEndOfDay: boolean = false): Date => {
  const parts = dateStr.trim().split('-').map((v) => parseInt(v, 10));
  if (parts.length === 3 && !parts.some(isNaN)) {
    const year = parts[0];
    const month = parts[1] - 1;
    const day = parts[2];
    if (isEndOfDay) {
      return new Date(year, month, day, 23, 59, 59, 999);
    }
    return new Date(year, month, day, 0, 0, 0, 0);
  }
  const now = new Date();
  return isEndOfDay ? getEndOfLocalDay(now) : getStartOfLocalDay(now);
};

/**
 * Menghasilkan Nomor Struk Harian Berformat Padded 4 Digit (Contoh: #0001, #0002)
 * 
 * Aturan Penomoran:
 * - Gunakan format padded 4 digit: '#' + String(data.invoice_seq || 1).padStart(4, '0')
 * - Jika invoice_seq bernilai null/undefined (data transaksi lama), gunakan fallback
 *   dengan mengambil 4 digit terakhir dari transaction_code.
 * 
 * @param transaction Objek transaksi dengan atribut invoice_seq dan/atau transaction_code
 * @returns string Nomor struk berformat padded 4 digit (misal: "#0001")
 */
export const formatDailyReceiptNumber = (
  transaction?: { invoice_seq?: number | null; transaction_code?: string } | null
): string => {
  if (!transaction) {
    return '#0001';
  }

  // 1. Jika invoice_seq ada dan valid dari database Supabase
  if (transaction.invoice_seq !== null && transaction.invoice_seq !== undefined) {
    const seqNum = Number(transaction.invoice_seq) || 1;
    return `#${String(seqNum).padStart(4, '0')}`;
  }

  // 2. Fallback untuk data transaksi lama jika invoice_seq bernilai null:
  // Mengambil 4 digit terakhir dari transaction_code
  if (transaction.transaction_code) {
    const code = String(transaction.transaction_code).trim();
    const digitsOnly = code.replace(/\D/g, '');
    if (digitsOnly.length > 0) {
      const lastDigits = digitsOnly.slice(-4).padStart(4, '0');
      return `#${lastDigits}`;
    }
  }

  return '#0001';
};

/**
 * Menghasilkan format kode transaksi standar fallback frontend.
 * Catatan: Nomor urut invoice_seq dan transaction_code kini di-generate otomatis
 * dan aman oleh SQL Trigger di PostgreSQL Supabase saat online.
 * 
 * @returns string Nomor kode transaksi standar 'TRX-xxx'
 */
export const generateTransactionCode = (): string => {
  return 'TRX-xxx';
};

/**
 * Struktur Hasil Proses Checkout Kasir
 */
export interface CheckoutResult {
  /** Menandakan apakah transaksi berhasil diproses */
  success: boolean;
  /** Bernilai true jika transaksi disimpan di antrean offline lokal */
  isOffline: boolean;
  /** Objek data header transaksi */
  transaction: Transaction;
  /** Objek daftar item belanja yang tercakup dalam transaksi */
  items: TransactionItem[];
  /** Pesan error opsional jika terjadi kendala saat sinkronisasi online */
  error?: string;
}

/**
 * Memproses Checkout Transaksi Penjualan Kasir POS (processCheckout)
 * 
 * ALUR LOGIKA UTAMA (DUAL-MODE ONLINE / OFFLINE):
 * 1. Validasi keranjang: Memastikan tidak kosong.
 * 2. Menggunakan format kode standar 'TRX-xxx' tanpa acak manual di frontend.
 * 3. Menyusun struktur data `Transaction` dan array `TransactionItem`.
 * 4. Memeriksa ketersediaan koneksi internet:
 *    - JIKA ONLINE:
 *      a. Mengirim header transaksi dengan format standar 'TRX-xxx' ke tabel `transactions`.
 *         SQL Trigger Supabase akan secara otomatis meng-assign invoice_seq & transaction_code resmi.
 *      b. Wajib memanggil `.select('id, transaction_code, invoice_seq, created_at')` untuk
 *         mengambil nomor struk harian (#0001) dan kode transaksi resmi dari database.
 *      c. Menyimpan rincian item ke tabel `transaction_items` Supabase.
 *      d. Memotong stok di database cloud dan memotong stok di cache lokal perangkat.
 *      e. Jika terjadi kegagalan jaringan saat query: Otomatis beralih menyimpan ke antrean offline lokal (fallback).
 *    - JIKA OFFLINE:
 *      a. Menyimpan seluruh data transaksi ke antrean AsyncStorage via `saveTransactionOffline`.
 *      b. Memotong stok di cache lokal agar angka stok kasir tetap akurat seketika.
 * 
 * @param cartItems Daftar barang yang dibeli dari keranjang
 * @param paymentInfo Rincian pembayaran (metode tunai/QRIS, uang diterima, kembalian, no. HP pelanggan)
 * @returns Promise<CheckoutResult> Hasil lengkap pemrosesan checkout
 */
export const processCheckout = async (
  cartItems: CartItem[],
  paymentInfo: PaymentInfo,
  cashierName?: string,
  businessUnitOverride?: string
): Promise<CheckoutResult> => {
  if (!cartItems || cartItems.length === 0) {
    throw new Error('Keranjang belanja tidak boleh kosong untuk memproses checkout.');
  }

  // Gunakan format standar 'TRX-xxx' (tidak perlu format acak manual di frontend)
  const standardTransactionCode = 'TRX-xxx';
  const totalAmount = cartItems.reduce((sum, item) => sum + item.subtotal, 0);
  const now = new Date().toISOString();

  // Kalkulasi unit bisnis transaksi ('Sembako' | 'Tembakau' | 'Gabungan')
  let computedUnit: 'Sembako' | 'Tembakau' | 'Gabungan' = 'Sembako';
  const unitsInCart = new Set(
    cartItems.map((it) => (it.businessUnit === 'Tembakau' ? 'Tembakau' : 'Sembako'))
  );
  if (unitsInCart.has('Sembako') && unitsInCart.has('Tembakau')) {
    computedUnit = 'Gabungan';
  } else if (unitsInCart.has('Tembakau')) {
    computedUnit = 'Tembakau';
  } else {
    computedUnit = 'Sembako';
  }

  const finalBusinessUnit = businessUnitOverride || computedUnit;
  const finalCashierName = cashierName?.trim() || 'Kasir';

  const userId = await getCurrentUserId();

  // 1. Susun Objek Header Transaksi Awal
  const transaction: Transaction = {
    id: `tx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    user_id: userId || undefined,
    transaction_code: standardTransactionCode,
    invoice_seq: null,
    total_amount: totalAmount,
    cash_paid: paymentInfo.cashPaid,
    change_given: Math.max(0, paymentInfo.changeGiven),
    payment_method: paymentInfo.paymentMethod,
    customer_phone: paymentInfo.customerPhone?.trim() || null,
    cashier_name: finalCashierName,
    business_unit: finalBusinessUnit,
    created_at: now,
  };

  // 2. Susun Objek Rincian Item Transaksi
  const items: TransactionItem[] = cartItems.map((item) => ({
    id: `txi_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    user_id: userId || undefined,
    transaction_id: transaction.id,
    variant_id: item.variantId,
    quantity: item.quantity,
    price_at_sale: item.price,
    cost_price_at_sale: item.costPrice || 0, // Kunci modal HPP saat transaksi
    subtotal: item.subtotal,
    product_name: item.productName,
    variant_name: item.variantName,
    barcode: item.barcode,
    cost_price: item.costPrice,
  }));

  const isOnline = await checkInternetConnection();

  if (isOnline) {
    try {
      // a. Simpan Header ke Supabase dengan user_id
      // Format standar 'TRX-xxx' dikirim agar SQL Trigger di PostgreSQL meng-generate otomatis
      // invoice_seq dan transaction_code resmi
      const txPayload: any = {
        transaction_code: standardTransactionCode,
        total_amount: transaction.total_amount,
        cash_paid: transaction.cash_paid,
        change_given: transaction.change_given,
        payment_method: transaction.payment_method,
        customer_phone: transaction.customer_phone,
        cashier_name: transaction.cashier_name,
        business_unit: transaction.business_unit,
        created_at: transaction.created_at,
      };
      if (userId) {
        txPayload.user_id = userId;
      }

      // Wajib gunakan .select('id, transaction_code, invoice_seq, created_at')
      // untuk mengambil nomor urut struk harian dan transaction_code resmi buatan Supabase
      const { data: txRecord, error: txError } = await supabase
        .from('transactions')
        .insert(txPayload)
        .select('id, transaction_code, invoice_seq, created_at')
        .single();

      if (txError || !txRecord) {
        throw new Error(txError?.message || 'Gagal menyimpan transaksi ke server database Supabase');
      }

      // Perbarui objek transaksi lokal dengan data resmi dari Supabase
      const confirmedId = txRecord.id;
      transaction.id = confirmedId;
      if (txRecord.transaction_code) {
        transaction.transaction_code = txRecord.transaction_code;
      }
      if (txRecord.invoice_seq !== undefined && txRecord.invoice_seq !== null) {
        transaction.invoice_seq = txRecord.invoice_seq;
      }
      if (txRecord.created_at) {
        transaction.created_at = txRecord.created_at;
      }

      // b. Simpan Rincian Item ke Supabase (Termasuk cost_price_at_sale dan user_id)
      const dbItems = items.map((it) => {
        it.transaction_id = confirmedId;
        return {
          user_id: userId || undefined,
          transaction_id: confirmedId,
          variant_id: it.variant_id,
          quantity: it.quantity,
          price_at_sale: it.price_at_sale,
          cost_price_at_sale: it.cost_price_at_sale || 0,
          subtotal: it.subtotal,
        };
      });

      const { error: itemsError } = await supabase.from('transaction_items').insert(dbItems);
      if (itemsError) {
        console.error('Gagal menyimpan rincian item transaksi:', itemsError);
      }

      // c. Potong Stok Barang di Server Cloud dan Cache Lokal
      for (const item of cartItems) {
        await deductLocalStock(item.variantId, item.quantity);
        try {
          await supabase.rpc('deduct_variant_stock', {
            p_variant_id: item.variantId,
            p_quantity: item.quantity,
          });
        } catch (rpcErr) {
          console.warn('Fallback RPC pemotongan stok cloud:', rpcErr);
        }
      }

      // Simpan transaksi online ini ke cache hari ini agar sequence offline selanjutnya melanjutkan nomor ini
      await saveCachedTodayTransaction(transaction);

      return {
        success: true,
        isOffline: false,
        transaction,
        items,
      };
    } catch (onlineError: any) {
      console.warn('Checkout online gagal, beralih ke penyimpanan antrean offline:', onlineError.message);
      // Fallback: Hitung nomor urut struk harian lokal berikutnya (#0002, #0003, dst)
      const { nextSeq, code } = await getNextDailyInvoiceSeq(new Date(transaction.created_at || Date.now()));
      transaction.invoice_seq = nextSeq;
      transaction.transaction_code = code;

      // Simpan ke antrean offline jika koneksi online gagal di tengah jalan
      await saveTransactionOffline({ transaction, items });
      for (const item of cartItems) {
        await deductLocalStock(item.variantId, item.quantity);
      }
      return {
        success: true,
        isOffline: true,
        transaction,
        items,
        error: onlineError.message,
      };
    }
  } else {
    // --- MODE TRANSAKSI OFFLINE ---
    // Hitung nomor urut struk harian lokal berikutnya secara presisi (#0002, #0003, dst)
    // berdasarkan gabungan data lokal/cache hari ini + antrean offline
    const { nextSeq, code } = await getNextDailyInvoiceSeq(new Date(transaction.created_at || Date.now()));
    transaction.invoice_seq = nextSeq;
    transaction.transaction_code = code;

    // Simpan ke antrean offline lokal dan potong stok lokal seketika
    await saveTransactionOffline({ transaction, items });
    for (const item of cartItems) {
      await deductLocalStock(item.variantId, item.quantity);
    }

    return {
      success: true,
      isOffline: true,
      transaction,
      items,
    };
  }
};


/**
 * Menghasilkan URL WhatsApp Click-to-Chat dengan Teks Nota Struk Digital
 * Tampilan Ringkas, Rapi, & Status LUNAS Sesuai Metode Pembayaran (Tunai / QRIS)
 */
export const generateWhatsAppReceiptUrl = (
  phoneNumber: string,
  transactionData: {
    transaction: Transaction;
    items: TransactionItem[];
    storeName?: string;
  }
): string => {
  if (!phoneNumber) return '';

  // Standarisasi format nomor HP: ubah awalan '08' menjadi '628'
  let cleaned = phoneNumber.replace(/[^0-9]/g, '');
  if (cleaned.startsWith('0')) {
    cleaned = '62' + cleaned.substring(1);
  } else if (!cleaned.startsWith('62')) {
    cleaned = '62' + cleaned;
  }

  const { transaction, items, storeName = 'TOKO GROSIR 76' } = transactionData;
  const txDate = new Date(transaction.created_at).toLocaleString('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  const dailyReceiptNo = formatDailyReceiptNumber(transaction);

  const dividerDouble = '================================';
  const dividerSingle = '--------------------------------';

  // Menyusun daftar item belanjaan
  const itemListText = items
    .map((item, index) => {
      const name = item.product_name || 'Barang';
      const variant = item.variant_name ? ` (${item.variant_name})` : '';
      const calc = `${item.quantity} x ${formatRupiah(item.price_at_sale)}`;
      return `${index + 1}. *${name}${variant}*\n   ${calc} = *${formatRupiah(item.subtotal)}*`;
    })
    .join('\n\n');

  // Deteksi Metode Pembayaran
  const methodUpper = (transaction.payment_method || '').toUpperCase();
  const isCash = methodUpper === 'CASH' || methodUpper === 'TUNAI';

  // Rincian Pembayaran Kondisional dengan Status LUNAS
  const paymentLines = isCash
    ? [
      `*TOTAL BELANJA : ${formatRupiah(transaction.total_amount)}*`,
      `Tunai Diterima : ${formatRupiah(transaction.cash_paid)}`,
      `Kembalian      : ${formatRupiah(transaction.change_given)}`,
      `Status         : *LUNAS (Tunai)*`,
    ]
    : [
      `*TOTAL BELANJA : ${formatRupiah(transaction.total_amount)}*`,
      `Status         : *LUNAS (QRIS / Non-Tunai)*`,
    ];

  // Menyusun seluruh struktur nota dengan nomor struk harian jelas di bagian header
  const receiptLines = [
    `*${storeName.toUpperCase()}*`,
    `_Nota Struk Pembayaran Resmi_`,
    dividerDouble,
    `No. Struk: *${dailyReceiptNo}*`,
    `No. Nota : *${transaction.transaction_code}*`,
    `Tanggal  : ${txDate}`,
    `Kasir    : ${transaction.cashier_name || 'Kasir'}`,
    `Unit     : ${transaction.business_unit || 'Sembako'}`,
    `Metode   : ${methodUpper}`,
    dividerSingle,
    `*RINCIAN BELANJA:*`,
    '',
    itemListText,
    dividerSingle,
    ...paymentLines,
    dividerDouble,
    `*Terima kasih telah berbelanja!*`,
    `_Simpan pesan ini sebagai bukti pembayaran._`,
  ];

  const fullText = receiptLines.join('\n');
  return `https://wa.me/${cleaned}?text=${encodeURIComponent(fullText)}`;
};

/**
 * Menghasilkan Format Teks Struk Cetak Thermal (Kompatibel Printer Thermal 58mm / 80mm ESC/POS)
 * Menampilkan Nomor Struk Harian (#0001) tercetak jelas di bagian header struk
 */
export const generateThermalReceiptText = (data: {
  transaction: Transaction;
  items: TransactionItem[];
  storeName?: string;
  storeAddress?: string;
  storePhone?: string;
}): string => {
  const { transaction, items, storeName = 'TOKO GROSIR 76', storeAddress, storePhone } = data;
  const dailyReceiptNo = formatDailyReceiptNumber(transaction);
  const txDate = new Date(transaction.created_at).toLocaleString('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  const lineSep = '--------------------------------';
  const doubleSep = '================================';
  const methodUpper = (transaction.payment_method || '').toUpperCase();
  const isCash = methodUpper === 'CASH' || methodUpper === 'TUNAI';

  const itemLines = items
    .map((it) => {
      const name = (it.product_name || 'Barang') + (it.variant_name ? ` (${it.variant_name})` : '');
      const line1 = name.length > 32 ? name.substring(0, 32) : name;
      const calc = `${it.quantity} x ${formatRupiah(it.price_at_sale)}`;
      const sub = formatRupiah(it.subtotal);
      const spaceCount = Math.max(1, 32 - calc.length - sub.length);
      const line2 = calc + ' '.repeat(spaceCount) + sub;
      return `${line1}\n${line2}`;
    })
    .join('\n');

  const paymentLines = isCash
    ? [
        `TOTAL     : ${formatRupiah(transaction.total_amount)}`,
        `TUNAI     : ${formatRupiah(transaction.cash_paid)}`,
        `KEMBALIAN : ${formatRupiah(transaction.change_given)}`,
        `STATUS    : LUNAS (TUNAI)`,
      ]
    : [
        `TOTAL     : ${formatRupiah(transaction.total_amount)}`,
        `STATUS    : LUNAS (${methodUpper})`,
      ];

  const headerLines = [
    storeName.toUpperCase(),
    storeAddress || '',
    storePhone ? `Telp: ${storePhone}` : '',
    doubleSep,
    `NO. STRUK : ${dailyReceiptNo}`,
    `NO. NOTA  : ${transaction.transaction_code}`,
    `TANGGAL   : ${txDate}`,
    `KASIR     : ${transaction.cashier_name || 'Kasir'}`,
    `UNIT      : ${transaction.business_unit || 'Sembako'}`,
    lineSep,
    itemLines,
    lineSep,
    ...paymentLines,
    doubleSep,
    'Terima kasih atas kunjungan Anda',
    'Barang yang sudah dibeli tidak',
    'dapat ditukar/dikembalikan',
  ].filter(Boolean);

  return headerLines.join('\n');
};
