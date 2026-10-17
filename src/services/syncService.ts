import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { getCurrentUserId, supabase } from '../config/supabase';
import { OfflineTransactionQueue, Transaction, TransactionItem } from '../types/database';

/**
 * Format objek Date menjadi string tanggal lokal YYYY-MM-DD
 */
export const formatLocalDate = (d: Date = new Date()): string => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * KUNCI PENYIMPANAN ANTREAN TRANSAKSI OFFLINE (MULTI-TENANT USER SCOPED)
 */
const BASE_OFFLINE_QUEUE_KEY = '@kasirtoko_offline_tx_queue';

export const getOfflineQueueKey = async (): Promise<string> => {
  const userId = await getCurrentUserId();
  return userId ? `${BASE_OFFLINE_QUEUE_KEY}_${userId}` : BASE_OFFLINE_QUEUE_KEY;
};

/**
 * KUNCI PENYIMPANAN CACHE TRANSAKSI HARI INI (UNTUK SEQUENCE & OFFLINE PERSISTENCE)
 */
const BASE_TODAY_TRANSACTIONS_CACHE_KEY = '@kasirtoko_today_tx_cache';

export const getTodayTransactionsCacheKey = async (dateStr?: string): Promise<string> => {
  const userId = await getCurrentUserId();
  const dStr = dateStr || formatLocalDate(new Date());
  return userId
    ? `${BASE_TODAY_TRANSACTIONS_CACHE_KEY}_${userId}_${dStr}`
    : `${BASE_TODAY_TRANSACTIONS_CACHE_KEY}_${dStr}`;
};

/**
 * Mengambil Seluruh Transaksi yang Pernah Dibuat / Disinkronkan Hari Ini dari Cache Lokal
 */
export const getCachedTodayTransactions = async (dateStr?: string): Promise<Transaction[]> => {
  try {
    const key = await getTodayTransactionsCacheKey(dateStr);
    const data = await AsyncStorage.getItem(key);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.warn('Gagal membaca cache transaksi hari ini:', error);
    return [];
  }
};

/**
 * Menyimpan / Memperbarui Satu Transaksi ke Cache Lokal Hari Ini
 */
export const saveCachedTodayTransaction = async (tx: Transaction): Promise<void> => {
  try {
    const txDate = tx.created_at ? formatLocalDate(new Date(tx.created_at)) : formatLocalDate(new Date());
    const key = await getTodayTransactionsCacheKey(txDate);
    const existing = await getCachedTodayTransactions(txDate);
    const filtered = existing.filter(
      (item) => item.id !== tx.id && (!tx.transaction_code || item.transaction_code !== tx.transaction_code)
    );
    await AsyncStorage.setItem(key, JSON.stringify([tx, ...filtered]));
  } catch (error) {
    console.warn('Gagal menyimpan cache transaksi hari ini:', error);
  }
};

/**
 * Menyimpan Sekaligus Daftar Transaksi Hari Ini ke Cache Lokal
 */
export const cacheTodayTransactionsList = async (txList: Transaction[], dateStr?: string): Promise<void> => {
  try {
    const key = await getTodayTransactionsCacheKey(dateStr);
    const existing = await getCachedTodayTransactions(dateStr);
    const map = new Map<string, Transaction>();
    for (const item of txList) {
      const idKey = item.id || item.transaction_code;
      map.set(idKey, item);
    }
    for (const item of existing) {
      const idKey = item.id || item.transaction_code;
      if (!map.has(idKey)) {
        map.set(idKey, item);
      }
    }
    await AsyncStorage.setItem(key, JSON.stringify(Array.from(map.values())));
  } catch (error) {
    console.warn('Gagal menyimpan daftar cache transaksi hari ini:', error);
  }
};

/**
 * Menghitung Nomor Urut Struk Harian (invoice_seq) Berikutnya Secara Presisi Saat Offline
 * 
 * ATURAN KALKULASI:
 * 1. Memeriksa nilai invoice_seq terbesar dari transaksi yang tersimpan di antrean offline lokal hari ini.
 * 2. Memeriksa nilai invoice_seq terbesar dari cache transaksi hari ini (termasuk transaksi online yang pernah dibuat hari ini).
 * 3. Menetapkan invoice_seq baru = (last_local_seq + 1).
 * 4. Menghasilkan format transaction_code sementara: TRX-YYYYMMDD-XXXX (melanjutkan urutan struk harian).
 */
export const getNextDailyInvoiceSeq = async (targetDate: Date = new Date()): Promise<{ nextSeq: number; code: string }> => {
  const d = targetDate || new Date();
  const dateStr = formatLocalDate(d);

  let maxSeq = 0;

  // 1. Cek dari antrean offline lokal (@kasirtoko_offline_tx_queue)
  try {
    const queue = await getOfflineQueue();
    for (const item of queue) {
      const tx = item.transaction;
      const txDateStr = tx.created_at ? formatLocalDate(new Date(tx.created_at)) : formatLocalDate(new Date());
      if (txDateStr === dateStr) {
        if (tx.invoice_seq && Number(tx.invoice_seq) > maxSeq) {
          maxSeq = Number(tx.invoice_seq);
        } else if (tx.transaction_code && tx.transaction_code !== 'TRX-xxx') {
          const digits = tx.transaction_code.replace(/\D/g, '');
          if (digits.length >= 4) {
            const parsed = parseInt(digits.slice(-4), 10);
            if (!isNaN(parsed) && parsed > maxSeq) {
              maxSeq = parsed;
            }
          }
        }
      }
    }
  } catch (err) {
    console.warn('Gagal membaca antrean offline untuk kalkulasi nomor struk:', err);
  }

  // 2. Cek dari cache transaksi lokal hari ini (@kasirtoko_today_tx_cache)
  try {
    const cachedToday = await getCachedTodayTransactions(dateStr);
    for (const tx of cachedToday) {
      const txDateStr = tx.created_at ? formatLocalDate(new Date(tx.created_at)) : formatLocalDate(new Date());
      if (txDateStr === dateStr) {
        if (tx.invoice_seq && Number(tx.invoice_seq) > maxSeq) {
          maxSeq = Number(tx.invoice_seq);
        } else if (tx.transaction_code && tx.transaction_code !== 'TRX-xxx') {
          const digits = tx.transaction_code.replace(/\D/g, '');
          if (digits.length >= 4) {
            const parsed = parseInt(digits.slice(-4), 10);
            if (!isNaN(parsed) && parsed > maxSeq) {
              maxSeq = parsed;
            }
          }
        }
      }
    }
  } catch (err) {
    console.warn('Gagal membaca cache transaksi untuk kalkulasi nomor struk:', err);
  }

  const nextSeq = maxSeq + 1;
  const compactDate = dateStr.replace(/-/g, '');
  const code = `TRX-${compactDate}-${String(nextSeq).padStart(4, '0')}`;

  return { nextSeq, code };
};

/**
 * Memeriksa Konektivitas Internet Aktif (checkInternetConnection)
 */
export const checkInternetConnection = async (): Promise<boolean> => {
  try {
    const netState = await NetInfo.fetch();
    if (netState.isConnected === false) {
      return false;
    }
  } catch {
    // Lanjutkan pengecekan jika NetInfo terkendala
  }

  if (typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean') {
    if (!navigator.onLine) return false;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500);

    const { error } = await supabase.from('products').select('id').limit(1).abortSignal(controller.signal);
    clearTimeout(timeoutId);
    return !error;
  } catch {
    return false;
  }
};

/**
 * Mengambil Seluruh Antrean Transaksi Offline dari AsyncStorage (User Scoped)
 */
export const getOfflineQueue = async (): Promise<OfflineTransactionQueue[]> => {
  try {
    const key = await getOfflineQueueKey();
    const data = await AsyncStorage.getItem(key);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.warn('Gagal membaca antrean transaksi offline:', error);
    return [];
  }
};

/**
 * Menghitung Jumlah Transaksi Offline yang Menunggu Disinkronkan
 */
export const getPendingQueueCount = async (): Promise<number> => {
  const queue = await getOfflineQueue();
  return queue.filter((item) => item.status === 'pending' || item.status === 'failed').length;
};

/**
 * Menyimpan Transaksi ke Antrean Offline Lokal
 */
export const saveTransactionOffline = async (transactionData: {
  transaction: Transaction;
  items: TransactionItem[];
}): Promise<OfflineTransactionQueue> => {
  const queue = await getOfflineQueue();
  const userId = await getCurrentUserId();
  const key = await getOfflineQueueKey();

  // Pastikan nomor urut struk harian terisi dengan nomor berikutnya jika sebelumnya kosong
  let finalTx = { ...transactionData.transaction };
  if (!finalTx.invoice_seq || finalTx.transaction_code === 'TRX-xxx') {
    const { nextSeq, code } = await getNextDailyInvoiceSeq(new Date(finalTx.created_at || Date.now()));
    finalTx.invoice_seq = nextSeq;
    finalTx.transaction_code = code;
    transactionData.transaction.invoice_seq = nextSeq;
    transactionData.transaction.transaction_code = code;
  }

  const newQueueItem: OfflineTransactionQueue = {
    id: finalTx.id || `offline_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    user_id: finalTx.user_id || userId || undefined,
    transaction: {
      ...finalTx,
      user_id: finalTx.user_id || userId || undefined,
      id: finalTx.id || `offline_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    },
    items: transactionData.items.map((it) => ({
      ...it,
      user_id: it.user_id || userId || undefined,
    })),
    status: 'pending',
    retry_count: 0,
    queued_at: new Date().toISOString(),
  };

  queue.push(newQueueItem);
  await AsyncStorage.setItem(key, JSON.stringify(queue));

  // Simpan juga ke cache transaksi hari ini agar sequence transaksi selanjutnya melanjutkan nomor ini
  await saveCachedTodayTransaction(newQueueItem.transaction);

  // Broadcast status agar UI langsung mendeteksi ada antrean baru
  await broadcastSyncStatus(0);

  return newQueueItem;
};

/**
 * Memotong Stok Varian di Server Supabase Cloud Saat Sinkronisasi
 */
export const deductStockOnSupabase = async (
  variantId: string,
  quantity: number
): Promise<void> => {
  try {
    const { error: rpcError } = await supabase.rpc('deduct_variant_stock', {
      p_variant_id: variantId,
      p_quantity: quantity,
    });

    if (rpcError) {
      const { data: variant, error: fetchError } = await supabase
        .from('product_variants')
        .select('stock')
        .eq('id', variantId)
        .single();

      if (fetchError || !variant) {
        throw new Error(fetchError?.message || `Varian ${variantId} tidak ditemukan.`);
      }

      const currentStock = variant.stock ?? 0;
      const updatedStock = Math.max(0, currentStock - quantity);

      await supabase.from('product_variants').update({ stock: updatedStock }).eq('id', variantId);
    }
  } catch (err: any) {
    console.warn(`Gagal memotong stok cloud varian ${variantId}:`, err);
    throw err;
  }
};

/**
 * Tipe Informasi Status Sinkronisasi
 */
export type SyncStatusInfo = {
  isOnline: boolean;
  pendingCount: number;
  syncedCount: number;
};

type SyncStatusCallback = (status: SyncStatusInfo) => void;

const syncStatusListeners = new Set<SyncStatusCallback>();

/**
 * Mendaftarkan Listener Perubahan Status Sinkronisasi & Jaringan
 */
export const addSyncStatusListener = (callback: SyncStatusCallback): (() => void) => {
  syncStatusListeners.add(callback);
  return () => {
    syncStatusListeners.delete(callback);
  };
};

/**
 * Memancarkan Pembaruan Status ke Seluruh Listener Aktif (Dashboard, dll)
 */
export const broadcastSyncStatus = async (syncedCount: number = 0): Promise<void> => {
  const isOnline = await checkInternetConnection();
  const pendingCount = await getPendingQueueCount();
  for (const listener of syncStatusListeners) {
    try {
      listener({ isOnline, pendingCount, syncedCount });
    } catch (err) {
      console.warn('Error in sync status listener:', err);
    }
  }
};

/**
 * Menyinkronkan Seluruh Antrean Transaksi Offline ke Cloud Supabase (Dengan user_id)
 */
export const syncOfflineTransactions = async (): Promise<{
  syncedCount: number;
  failedCount: number;
  remainingCount: number;
}> => {
  const isOnline = await checkInternetConnection();
  if (!isOnline) {
    return { syncedCount: 0, failedCount: 0, remainingCount: await getPendingQueueCount() };
  }

  const queue = await getOfflineQueue();
  const queueKey = await getOfflineQueueKey();
  const userId = await getCurrentUserId();

  if (queue.length === 0) {
    return { syncedCount: 0, failedCount: 0, remainingCount: 0 };
  }

  let syncedCount = 0;
  let failedCount = 0;
  const updatedQueue: OfflineTransactionQueue[] = [];

  for (const item of queue) {
    if (item.status === 'synced') {
      continue;
    }

    try {
      const finalUserId = item.user_id || item.transaction.user_id || userId;

      // 1. Insert header transaksi ke Supabase dengan user_id
      const txPayload: any = {
        transaction_code: item.transaction.transaction_code,
        total_amount: item.transaction.total_amount,
        cash_paid: item.transaction.cash_paid,
        change_given: item.transaction.change_given,
        payment_method: item.transaction.payment_method,
        customer_phone: item.transaction.customer_phone,
        cashier_name: item.transaction.cashier_name || 'Kasir',
        business_unit: item.transaction.business_unit || 'Sembako',
        created_at: item.transaction.created_at,
      };
      if (finalUserId) {
        txPayload.user_id = finalUserId;
      }

      const { data: txData, error: txError } = await supabase
        .from('transactions')
        .insert(txPayload)
        .select('id, transaction_code, invoice_seq, created_at')
        .single();

      if (txError || !txData) {
        throw new Error(txError?.message || 'Gagal menyimpan transaksi ke database Supabase');
      }

      const supabaseTransactionId = txData.id;
      if (txData.transaction_code) {
        item.transaction.transaction_code = txData.transaction_code;
      }
      if (txData.invoice_seq !== undefined && txData.invoice_seq !== null) {
        item.transaction.invoice_seq = txData.invoice_seq;
      }
      if (txData.created_at) {
        item.transaction.created_at = txData.created_at;
      }

      // Perbarui transaksi yang tersinkronkan ke cache lokal
      await saveCachedTodayTransaction(item.transaction);

      // 2. Insert rincian item barang transaksi dengan user_id
      const itemsToInsert = item.items.map((it) => ({
        user_id: finalUserId || undefined,
        transaction_id: supabaseTransactionId,
        variant_id: it.variant_id,
        quantity: it.quantity,
        price_at_sale: it.price_at_sale,
        cost_price_at_sale: it.cost_price_at_sale || 0,
        subtotal: it.subtotal,
      }));

      const { error: itemsError } = await supabase
        .from('transaction_items')
        .insert(itemsToInsert);

      if (itemsError) {
        throw new Error(itemsError.message || 'Gagal menyimpan rincian barang transaksi');
      }

      // 3. Potong stok varian di server Supabase
      for (const it of item.items) {
        await deductStockOnSupabase(it.variant_id, it.quantity);
      }

      syncedCount++;
    } catch (err: any) {
      failedCount++;
      console.warn(`Gagal menyinkronkan transaksi ${item.transaction.transaction_code}:`, err?.message || err);
      updatedQueue.push({
        ...item,
        status: 'failed',
        retry_count: item.retry_count + 1,
        error_message: err?.message || 'Terjadi gangguan jaringan saat sinkronisasi',
        last_attempt_at: new Date().toISOString(),
      });
    }
  }

  await AsyncStorage.setItem(queueKey, JSON.stringify(updatedQueue));
  await broadcastSyncStatus(syncedCount);

  return {
    syncedCount,
    failedCount,
    remainingCount: updatedQueue.length,
  };
};

/**
 * Flag pengaman agar auto-sync tidak berjalan tumpang tindih secara konkuren
 */
let isAutoSyncRunning = false;

/**
 * Menjalankan Auto-Sync Transaksi Offline di Background
 */
export const autoSyncOfflineTransactions = async (): Promise<{
  syncedCount: number;
  failedCount: number;
  remainingCount: number;
}> => {
  if (isAutoSyncRunning) {
    return { syncedCount: 0, failedCount: 0, remainingCount: await getPendingQueueCount() };
  }

  const isOnline = await checkInternetConnection();
  if (!isOnline) {
    await broadcastSyncStatus(0);
    return { syncedCount: 0, failedCount: 0, remainingCount: await getPendingQueueCount() };
  }

  const pending = await getPendingQueueCount();
  if (pending === 0) {
    await broadcastSyncStatus(0);
    return { syncedCount: 0, failedCount: 0, remainingCount: 0 };
  }

  isAutoSyncRunning = true;
  try {
    const result = await syncOfflineTransactions();
    await broadcastSyncStatus(result.syncedCount);
    return result;
  } catch (err) {
    console.warn('Auto-sync offline transactions failed:', err);
    await broadcastSyncStatus(0);
    return { syncedCount: 0, failedCount: 0, remainingCount: await getPendingQueueCount() };
  } finally {
    isAutoSyncRunning = false;
  }
};

let autoSyncUnsubscribe: (() => void) | null = null;

/**
 * Menginisialisasi Listener Perubahan Koneksi NetInfo untuk Auto-Sync Otomatis
 * Saat koneksi berpindah dari offline ke online (isConnected === true), fungsi
 * autoSyncOfflineTransactions() otomatis dipanggil di background tanpa klik manual.
 */
export const startAutoSyncListener = (): (() => void) => {
  if (autoSyncUnsubscribe) {
    return autoSyncUnsubscribe;
  }

  // Cek koneksi langsung saat listener pertama kali diinisialisasi
  checkInternetConnection().then((online) => {
    if (online) {
      autoSyncOfflineTransactions().catch(() => {});
    } else {
      broadcastSyncStatus(0).catch(() => {});
    }
  }).catch(() => {});

  autoSyncUnsubscribe = NetInfo.addEventListener((state) => {
    if (state.isConnected) {
      // Jeda 1.2 detik agar koneksi HTTP/DNS stabil sebelum proses unggah data
      setTimeout(async () => {
        const reallyOnline = await checkInternetConnection();
        if (reallyOnline) {
          await autoSyncOfflineTransactions();
        } else {
          await broadcastSyncStatus(0);
        }
      }, 1200);
    } else {
      broadcastSyncStatus(0);
    }
  });

  return autoSyncUnsubscribe;
};

// Aktifkan auto-sync listener secara otomatis saat service diinisialisasi
startAutoSyncListener();

/**
 * Menghapus Seluruh Antrean Transaksi Offline (Factory Reset Lokal)
 */
export const clearOfflineQueue = async (): Promise<void> => {
  try {
    const key = await getOfflineQueueKey();
    await AsyncStorage.removeItem(key);
  } catch (error) {
    console.warn('Gagal menghapus antrean offline:', error);
  }
};
