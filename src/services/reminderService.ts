import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { getCurrentUserId, supabase } from '../config/supabase';
import { StoreReminder } from '../types/database';

/**
 * KUNCI PENYIMPANAN ASYNCSTORAGE UNTUK CATATAN & UTANG TOKO (MULTI-TENANT)
 */
const BASE_REMINDERS_CACHE_KEY = '@kasirtoko_reminders_cache';

export const getRemindersCacheKey = async (): Promise<string> => {
  const userId = await getCurrentUserId();
  return userId ? `${BASE_REMINDERS_CACHE_KEY}_${userId}` : BASE_REMINDERS_CACHE_KEY;
};

/**
 * Mengambil Daftar Catatan Toko & Utang Pelanggan dari Cache Lokal
 */
export const getLocalReminders = async (): Promise<StoreReminder[]> => {
  try {
    const key = await getRemindersCacheKey();
    const data = await AsyncStorage.getItem(key);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.warn('Gagal membaca cache catatan toko:', error);
    return [];
  }
};

/**
 * Menyimpan Catatan Toko ke Cache Lokal
 */
export const cacheRemindersLocally = async (reminders: StoreReminder[]): Promise<void> => {
  try {
    const key = await getRemindersCacheKey();
    await AsyncStorage.setItem(key, JSON.stringify(reminders));
  } catch (error) {
    console.warn('Gagal menyimpan cache catatan toko:', error);
  }
};

/**
 * Mengambil Seluruh Catatan Toko & Kasbon Langsung dari Supabase (Otomatis Filter user_id)
 * Dilengkapi pengecekan offline NetInfo & silent fallback agar tidak memicu unhandled console error
 */
export const fetchReminders = async (): Promise<{ reminders: StoreReminder[]; fromCache: boolean }> => {
  try {
    // 1. Pengecekan status koneksi NetInfo (Bypass pemanggilan API jika terdeteksi offline)
    try {
      const netState = await NetInfo.fetch();
      if (netState.isConnected === false) {
        const cached = await getLocalReminders();
        return { reminders: cached, fromCache: true };
      }
    } catch {
      // Abaikan jika pengecekan NetInfo terkendala
    }

    const userId = await getCurrentUserId();
    let query = supabase
      .from('store_reminders')
      .select('*')
      .order('created_at', { ascending: false });

    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { data, error } = await query;

    if (error) {
      console.warn('Gagal memuat store_reminders dari Supabase (offline fallback):', error.message);
      const cached = await getLocalReminders();
      return { reminders: cached, fromCache: true };
    }

    if (data) {
      const reminders = data as StoreReminder[];
      await cacheRemindersLocally(reminders);
      return { reminders, fromCache: false };
    }

    const cached = await getLocalReminders();
    return { reminders: cached, fromCache: true };
  } catch (err: any) {
    console.warn('Pengecualian saat fetch catatan toko dari Supabase (offline silent fallback):', err?.message || err);
    const cached = await getLocalReminders();
    return { reminders: cached, fromCache: true };
  }
};

/**
 * Menambahkan Catatan Toko / Utang Kasbon Baru Langsung ke Supabase (Dengan user_id)
 */
export const addReminder = async (item: {
  type: 'debt' | 'reminder';
  customer_name?: string | null;
  amount?: number;
  due_date?: string | null;
  notes?: string | null;
  created_by?: string | null;
}): Promise<StoreReminder> => {
  try {
    const userId = await getCurrentUserId();
    let parsedDueDate: string | null = null;
    if (item.due_date && item.due_date.trim()) {
      const d = new Date(item.due_date.trim());
      if (!isNaN(d.getTime())) {
        parsedDueDate = d.toISOString();
      }
    }

    const payload: any = {
      type: item.type,
      customer_name: item.type === 'debt' ? item.customer_name?.trim() || null : null,
      amount: item.type === 'debt' ? Number(item.amount) || 0 : 0,
      due_date: parsedDueDate,
      notes: item.notes?.trim() || null,
      is_settled: false,
      created_by: item.created_by?.trim() || null,
    };

    if (userId) {
      payload.user_id = userId;
    }

    const { data, error } = await supabase
      .from('store_reminders')
      .insert(payload)
      .select('*')
      .single();

    if (error || !data) {
      console.error('Supabase insert error pada store_reminders:', error?.message);
      throw new Error(error?.message || 'Gagal menyimpan catatan ke database Supabase.');
    }

    const newRecord = data as StoreReminder;

    // Sinkronkan ke cache lokal
    const existing = await getLocalReminders();
    const updated = [newRecord, ...existing.filter((r) => r.id !== newRecord.id)];
    await cacheRemindersLocally(updated);

    return newRecord;
  } catch (err: any) {
    console.error('Gagal menambahkan catatan toko ke Supabase:', err);
    throw err;
  }
};

/**
 * Memperbarui Status Lunas / Selesai Catatan Utang (Kasbon) Langsung ke Supabase (Filter user_id)
 */
export const toggleReminderSettled = async (id: string, isSettled: boolean): Promise<void> => {
  try {
    const userId = await getCurrentUserId();
    let q = supabase.from('store_reminders').update({ is_settled: isSettled }).eq('id', id);
    if (userId) {
      q = q.eq('user_id', userId);
    }
    const { error } = await q;

    if (error) {
      console.error('Supabase update error pada store_reminders:', error.message);
      throw new Error(error.message || 'Gagal memperbarui status catatan di Supabase.');
    }

    // Perbarui cache lokal
    const existing = await getLocalReminders();
    const updated = existing.map((r) => (r.id === id ? { ...r, is_settled: isSettled } : r));
    await cacheRemindersLocally(updated);
  } catch (err: any) {
    console.error('Gagal update status lunas catatan toko di Supabase:', err);
    throw err;
  }
};

/**
 * Menghapus Catatan Toko Langsung dari Supabase (Filter user_id)
 */
export const deleteReminder = async (id: string): Promise<void> => {
  try {
    const userId = await getCurrentUserId();
    let q = supabase.from('store_reminders').delete().eq('id', id);
    if (userId) {
      q = q.eq('user_id', userId);
    }
    const { error } = await q;

    if (error) {
      console.error('Supabase delete error pada store_reminders:', error.message);
      throw new Error(error.message || 'Gagal menghapus catatan di Supabase.');
    }

    // Perbarui cache lokal
    const existing = await getLocalReminders();
    const updated = existing.filter((r) => r.id !== id);
    await cacheRemindersLocally(updated);
  } catch (err: any) {
    console.error('Gagal menghapus catatan toko di Supabase:', err);
    throw err;
  }
};
