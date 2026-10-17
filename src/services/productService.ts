import AsyncStorage from '@react-native-async-storage/async-storage';
import { getCurrentUserId, supabase } from '../config/supabase';
import { Product, ProductVariant } from '../types/database';
import { checkInternetConnection, getOfflineQueue } from './syncService';

/**
 * KUNCI PENYIMPANAN PRODUK ASYNCSTORAGE (MULTI-TENANT USER SCOPED)
 */
const BASE_PRODUCTS_CACHE_KEY = '@kasirtoko_products_cache';
const BASE_PRODUCTS_LAST_SYNC_KEY = '@kasirtoko_products_last_sync';

export const getProductsCacheKey = async (): Promise<string> => {
  const userId = await getCurrentUserId();
  return userId ? `${BASE_PRODUCTS_CACHE_KEY}_${userId}` : BASE_PRODUCTS_CACHE_KEY;
};

export const getProductsSyncKey = async (): Promise<string> => {
  const userId = await getCurrentUserId();
  return userId ? `${BASE_PRODUCTS_LAST_SYNC_KEY}_${userId}` : BASE_PRODUCTS_LAST_SYNC_KEY;
};

/**
 * Menyimpan Daftar Produk dan Varian ke Cache Lokal (AsyncStorage terisolasi per akun user)
 */
export const cacheProductsLocally = async (products: Product[]): Promise<void> => {
  try {
    const cacheKey = await getProductsCacheKey();
    const syncKey = await getProductsSyncKey();
    await AsyncStorage.setItem(cacheKey, JSON.stringify(products));
    await AsyncStorage.setItem(syncKey, new Date().toISOString());
  } catch (error) {
    console.error('Gagal menyimpan cache produk lokal:', error);
  }
};

/**
 * Mengambil Daftar Produk dari Cache Lokal (AsyncStorage terisolasi per akun user)
 */
export const getLocalProducts = async (): Promise<Product[]> => {
  try {
    const cacheKey = await getProductsCacheKey();
    const data = await AsyncStorage.getItem(cacheKey);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Gagal membaca cache produk lokal:', error);
    return [];
  }
};

/**
 * Mengambil Data Produk Beserta Variannya dari Supabase Cloud (Otomatis Filter user_id)
 * Untuk POS/Kasir (includeInactive = false), HANYA mengambil produk yang is_active = true.
 */
export const fetchProductsWithVariants = async (
  includeInactive: boolean = false
): Promise<{
  products: Product[];
  fromCache: boolean;
}> => {
  const isOnline = await checkInternetConnection();
  const userId = await getCurrentUserId();

  if (!isOnline) {
    const cached = await getLocalProducts();
    const filtered = includeInactive ? cached : cached.filter((p) => p.is_active === true);
    return { products: filtered, fromCache: true };
  }

  try {
    let query = supabase
      .from('products')
      .select(`
        id,
        user_id,
        name,
        category,
        business_unit,
        created_at,
        is_active,
        variants:product_variants (
          id,
          user_id,
          product_id,
          variant_name,
          barcode,
          price,
          cost_price,
          stock,
          created_at
        )
      `)
      .order('name', { ascending: true });

    // Multi-tenant: Filter data produk milik user_id yang sedang login
    if (userId) {
      query = query.eq('user_id', userId);
    }

    if (!includeInactive) {
      query = query.eq('is_active', true);
    }

    const { data, error } = await query;

    if (error) {
      console.warn('Gagal query Supabase, beralih ke cache lokal:', error.message);
      const cached = await getLocalProducts();
      const filtered = includeInactive ? cached : cached.filter((p) => p.is_active === true);
      return { products: filtered, fromCache: true };
    }

    const products = (data as unknown as Product[]) || [];

    // Simpan ke cache lokal terisolasi user
    if (includeInactive) {
      await cacheProductsLocally(products);
    } else {
      const existing = await getLocalProducts();
      const inactiveOnes = existing.filter((p) => p.is_active === false);
      await cacheProductsLocally([...products, ...inactiveOnes]);
    }

    return { products, fromCache: false };
  } catch (error) {
    console.error('Terjadi pengecualian saat fetch produk, menggunakan cache:', error);
    const cached = await getLocalProducts();
    const filtered = includeInactive ? cached : cached.filter((p) => p.is_active === true);
    return { products: filtered, fromCache: true };
  }
};

/**
 * Memperbarui Status Aktif/Nonaktif Produk (Filter user_id)
 */
export const updateProductActiveStatus = async (
  productId: string,
  isActive: boolean
): Promise<void> => {
  try {
    const cleanId = String(productId).trim();
    const userId = await getCurrentUserId();

    // 1. Perbarui cache lokal AsyncStorage
    const cached = await getLocalProducts();
    const updated = cached.map((p) =>
      String(p.id).trim() === cleanId ? { ...p, is_active: isActive } : p
    );
    await cacheProductsLocally(updated);

    // 2. Perbarui di database Supabase terfilter user_id
    try {
      let q = supabase.from('products').update({ is_active: isActive }).eq('id', cleanId);
      if (userId) {
        q = q.eq('user_id', userId);
      }
      const { error } = await q;

      if (error) {
        console.warn('Gagal memperbarui is_active produk di Supabase:', error.message);
      }
    } catch (supabaseErr) {
      console.warn('Koneksi Supabase tidak tersedia saat update is_active:', supabaseErr);
    }
  } catch (error) {
    console.error('Error saat updateProductActiveStatus:', error);
    throw error;
  }
};

/**
 * Tipe Hasil Kembalian Fungsi Smart Delete Produk
 */
export interface DeleteProductResult {
  success: boolean;
  isSoftDeleted: boolean;
  message: string;
}

/**
 * Menghapus Produk dengan Logika Cerdas (Smart Delete Backend)
 * 
 * ATURAN BISNIS:
 * 1. Pengecekan Riwayat: Cek apakah varian produk sudah pernah tercatat di tabel `transaction_items`
 *    atau antrean transaksi offline.
 * 2. JIKA BELUM ADA RIWAYAT TRANSAKSI:
 *    - Jalankan Hard Delete (hapus permanen dari Supabase & cache lokal).
 *    - Mengembalikan toast/alert: "Produk berhasil dihapus permanen"
 * 3. JIKA SUDAH ADA RIWAYAT TRANSAKSI (atau tertangkap constraint error foreign key):
 *    - Jalankan Soft Delete (update `is_active = false` di Supabase & cache lokal).
 *    - Mengembalikan toast/alert: "Produk memiliki riwayat transaksi. Status diubah menjadi Nonaktif agar laporan keuangan tetap aman"
 */
export const deleteProduct = async (
  productId: string,
  variantIds?: string[]
): Promise<DeleteProductResult> => {
  const cleanId = String(productId).trim();
  const userId = await getCurrentUserId();
  const isOnline = await checkInternetConnection();

  // 1. Kumpulkan seluruh ID varian dari produk yang akan dihapus
  let allVariantIds: string[] = variantIds && variantIds.length > 0 ? [...variantIds] : [];
  if (allVariantIds.length === 0) {
    const cachedProducts = await getLocalProducts();
    const current = cachedProducts.find((p) => String(p.id).trim() === cleanId);
    if (current?.variants) {
      allVariantIds = current.variants.map((v) => String(v.id).trim());
    }
  }

  if (allVariantIds.length === 0 && isOnline) {
    try {
      let vq = supabase.from('product_variants').select('id').eq('product_id', cleanId);
      if (userId) vq = vq.eq('user_id', userId);
      const { data: vData } = await vq;
      if (vData) {
        allVariantIds = vData.map((v: any) => String(v.id).trim());
      }
    } catch (e) {
      console.warn('Gagal mengambil daftar varian dari server:', e);
    }
  }

  // 2. Periksa apakah produk / varian ini memiliki riwayat transaksi
  let hasTransactions = false;

  // A. Cek di antrean transaksi offline lokal
  try {
    const queue = await getOfflineQueue();
    if (
      queue.some((q) =>
        q.items?.some((it) => allVariantIds.includes(String(it.variant_id).trim()))
      )
    ) {
      hasTransactions = true;
    }
  } catch (err) {
    console.warn('Gagal membaca antrean transaksi offline:', err);
  }

  // B. Cek di tabel Supabase `transaction_items` jika online dan belum ditemukan riwayat
  if (!hasTransactions && isOnline && allVariantIds.length > 0) {
    try {
      let tiQuery = supabase
        .from('transaction_items')
        .select('id')
        .in('variant_id', allVariantIds)
        .limit(1);

      if (userId) {
        tiQuery = tiQuery.eq('user_id', userId);
      }

      const { data: trxItems, error: trxErr } = await tiQuery;
      if (!trxErr && trxItems && trxItems.length > 0) {
        hasTransactions = true;
      }
    } catch (err) {
      console.warn('Gagal memeriksa tabel transaction_items Supabase:', err);
    }
  }

  // 3. JIKA SUDAH ADA RIWAYAT TRANSAKSI: Lakukan Soft Delete (is_active = false)
  if (hasTransactions) {
    await updateProductActiveStatus(cleanId, false);
    return {
      success: true,
      isSoftDeleted: true,
      message: 'Produk memiliki riwayat transaksi. Status diubah menjadi Nonaktif agar laporan keuangan tetap aman',
    };
  }

  // 4. JIKA BELUM ADA RIWAYAT TRANSAKSI: Jalankan Hard Delete
  if (isOnline) {
    try {
      let delQuery = supabase.from('products').delete().eq('id', cleanId);
      if (userId) {
        delQuery = delQuery.eq('user_id', userId);
      }
      const { error: delError } = await delQuery;

      if (delError) {
        // Tangkap constraint foreign key error (misal error 23503 / constraint foreign key)
        const isConstraintViolation =
          delError.code === '23503' ||
          delError.message?.toLowerCase().includes('foreign key') ||
          delError.message?.toLowerCase().includes('violates') ||
          delError.message?.toLowerCase().includes('constraint') ||
          delError.message?.toLowerCase().includes('transaction');

        if (isConstraintViolation) {
          await updateProductActiveStatus(cleanId, false);
          return {
            success: true,
            isSoftDeleted: true,
            message: 'Produk memiliki riwayat transaksi. Status diubah menjadi Nonaktif agar laporan keuangan tetap aman',
          };
        }
        throw delError;
      }
    } catch (err: any) {
      const isConstraintViolation =
        err?.code === '23503' ||
        err?.message?.toLowerCase().includes('foreign key') ||
        err?.message?.toLowerCase().includes('violates') ||
        err?.message?.toLowerCase().includes('constraint') ||
        err?.message?.toLowerCase().includes('transaction');

      if (isConstraintViolation) {
        await updateProductActiveStatus(cleanId, false);
        return {
          success: true,
          isSoftDeleted: true,
          message: 'Produk memiliki riwayat transaksi. Status diubah menjadi Nonaktif agar laporan keuangan tetap aman',
        };
      }
      throw err;
    }
  }

  // Hapus permanen dari cache lokal AsyncStorage
  const cached = await getLocalProducts();
  const remaining = cached.filter((p) => String(p.id).trim() !== cleanId);
  await cacheProductsLocally(remaining);

  return {
    success: true,
    isSoftDeleted: false,
    message: 'Produk berhasil dihapus permanen',
  };
};

/**
 * Memotong Sisa Stok Varian di Cache Lokal Perangkat
 */
export const deductLocalStock = async (variantId: string, quantity: number): Promise<void> => {
  try {
    const products = await getLocalProducts();
    let updated = false;

    for (const product of products) {
      if (product.variants) {
        for (const variant of product.variants) {
          if (variant.id === variantId) {
            variant.stock = Math.max(0, variant.stock - quantity);
            updated = true;
            break;
          }
        }
      }
      if (updated) break;
    }

    if (updated) {
      await cacheProductsLocally(products);
    }
  } catch (error) {
    console.error('Gagal memotong stok pada cache lokal:', error);
  }
};

/**
 * Memotong Stok Barang Secara Terpadu (Lokal & Cloud)
 */
export const deductStock = async (variantId: string, quantity: number): Promise<void> => {
  // 1. Potong stok lokal segera
  await deductLocalStock(variantId, quantity);

  // 2. Jika online, perbarui stok di database cloud Supabase
  const isOnline = await checkInternetConnection();
  if (isOnline) {
    try {
      const { error: rpcError } = await supabase.rpc('deduct_variant_stock', {
        p_variant_id: variantId,
        p_quantity: quantity,
      });

      if (rpcError) {
        const userId = await getCurrentUserId();
        let q = supabase.from('product_variants').select('stock').eq('id', variantId);
        if (userId) q = q.eq('user_id', userId);
        const { data: variant } = await q.single();

        if (variant) {
          const newStock = Math.max(0, (variant.stock || 0) - quantity);
          let uq = supabase.from('product_variants').update({ stock: newStock }).eq('id', variantId);
          if (userId) uq = uq.eq('user_id', userId);
          await uq;
        }
      }
    } catch (err) {
      console.error(`Gagal memotong stok cloud untuk varian ${variantId}:`, err);
    }
  }
};

/**
 * Mencari Varian Produk Berdasarkan Barcode dari Cache Lokal
 */
export const findProductByBarcode = async (
  barcode: string
): Promise<{ product: Product; variant: ProductVariant } | null> => {
  if (!barcode) return null;
  const cleanBarcode = barcode.trim();

  const products = await getLocalProducts();
  for (const product of products) {
    if (product.variants) {
      for (const variant of product.variants) {
        if (variant.barcode && variant.barcode.trim() === cleanBarcode) {
          return { product, variant };
        }
      }
    }
  }
  return null;
};
