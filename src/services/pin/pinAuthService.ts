import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  CashierId,
  PIN_KEY,
  LEGACY_PIN_KEY,
  USER_PIN_PREFIX,
  USER_PROFILE_PREFIX,
  SUB_PIN_KEY_PREFIX,
} from './pinSessionService';

/**
 * Default PINs jika belum disetel manual:
 */
export const DEFAULT_FALLBACK_PINS: Record<string, string> = {
  kasir_1: '111111',
  kasir_2: '222222',
  suami: '111111',
  istri: '222222',
};

/**
 * Algoritma Hashing PIN Kasir (djb2 Hash Function)
 * 
 * @param pin String PIN 6 digit
 * @returns String hash terproteksi
 */
export const hashPin = (pin: string): string => {
  let h = 5381;
  for (let i = 0; i < pin.length; i++) {
    h = (h * 33) ^ pin.charCodeAt(i);
  }
  return 'h_' + (h >>> 0).toString(16);
};

/**
 * Memeriksa Apakah Sub-Profil Kasir Tertentu Sudah Memiliki 6-Digit PIN
 */
export const hasCashierPinSet = async (
  userId: string,
  cashierId: CashierId
): Promise<boolean> => {
  if (!userId) return false;
  try {
    // 1. Cek storage lokal per user dan per sub-kasir
    const subKey = `${SUB_PIN_KEY_PREFIX}${userId}_${cashierId}`;
    const localVal = await AsyncStorage.getItem(subKey);
    if (localVal && localVal.trim().length > 0) return true;

    // Cek key legacy lokal
    const legacyVal = await AsyncStorage.getItem(`@kasirtoko_pin_${cashierId}`);
    if (legacyVal && legacyVal.trim().length > 0) return true;

    // Jika Kasir 1, periksa juga apakah user sudah memiliki pin utama
    if (cashierId === 'kasir_1') {
      const mainPinKey = `${USER_PIN_PREFIX}${userId}`;
      const mainLocal = await AsyncStorage.getItem(mainPinKey);
      if (mainLocal && mainLocal.trim().length > 0) return true;
    }

    // 2. Cek metadata cloud Supabase
    try {
      const { supabase } = await import('../../config/supabase');
      const { data: authData } = await supabase.auth.getUser();
      const cashierPins = authData?.user?.user_metadata?.cashier_pins;
      if (cashierPins && cashierPins[cashierId]) {
        await AsyncStorage.setItem(subKey, cashierPins[cashierId]);
        return true;
      }
      if (cashierId === 'kasir_1' && authData?.user?.user_metadata?.pin_hash) {
        await AsyncStorage.setItem(subKey, authData.user.user_metadata.pin_hash);
        return true;
      }
    } catch (_) {}

    return false;
  } catch (err) {
    console.warn(`Gagal memeriksa status PIN kasir ${cashierId}:`, err);
    return false;
  }
};

/**
 * Menyimpan PIN 6 Digit Kasir Spesifik
 * Mendukung signature:
 * - saveCashierPin(userId, cashierId, pin) -> Mode Multi-Tenant Dual-PIN
 * - saveCashierPin(cashierId, pin) -> Mode Legacy
 */
export async function saveCashierPin(userId: string, cashierId: CashierId, pin: string): Promise<void>;
export async function saveCashierPin(cashierId: string, pin: string): Promise<void>;
export async function saveCashierPin(
  first: string,
  second: string,
  third?: string
): Promise<void> {
  const isMultiTenant = typeof third === 'string';
  const userId = isMultiTenant ? first : '';
  const cashierId = (isMultiTenant ? second : first).toLowerCase() as CashierId;
  const pin = (isMultiTenant ? third : second).trim();

  if (pin.length !== 6 || !/^\d{6}$/.test(pin)) {
    throw new Error('PIN harus berupa 6 digit angka.');
  }

  try {
    const hashed = hashPin(pin);
    const subKey = userId ? `${SUB_PIN_KEY_PREFIX}${userId}_${cashierId}` : `@kasirtoko_pin_${cashierId}`;
    const legacyKey = `@kasirtoko_pin_${cashierId}`;

    const pairs: [string, string][] = [
      [subKey, hashed],
      [legacyKey, hashed],
    ];

    // Jika Kasir 1, sinkronkan juga ke kunci user_pin utama untuk kompatibilitas penuh
    if (cashierId === 'kasir_1' && userId) {
      pairs.push([`${USER_PIN_PREFIX}${userId}`, hashed]);
      pairs.push([PIN_KEY, hashed]);
    } else if (cashierId === 'kasir_1' || (cashierId as string) === 'suami') {
      pairs.push([PIN_KEY, hashed]);
      pairs.push([LEGACY_PIN_KEY, hashed]);
    }

    await AsyncStorage.multiSet(pairs);

    // Sinkronkan ke metadata Supabase
    if (userId) {
      try {
        const { supabase } = await import('../../config/supabase');
        const { data: authData } = await supabase.auth.getUser();
        const existingPins = authData?.user?.user_metadata?.cashier_pins || {};
        const metaUpdate: any = {
          cashier_pins: {
            ...existingPins,
            [cashierId]: hashed,
          },
        };
        if (cashierId === 'kasir_1') {
          metaUpdate.pin_hash = hashed;
        }

        await supabase.auth.updateUser({ data: metaUpdate });

        if (cashierId === 'kasir_1') {
          try {
            await supabase.from('profiles').update({
              pin_hash: hashed,
              updated_at: new Date().toISOString(),
            }).eq('id', userId);
          } catch (_) {}
        }
      } catch (cloudErr) {
        console.warn('Gagal sinkronisasi PIN sub-kasir ke cloud:', cloudErr);
      }
    }
  } catch (err) {
    console.error('Gagal menyimpan PIN kasir ke AsyncStorage:', err);
    throw err;
  }
}

/**
 * Menyimpan PIN Kasir (Legacy Wrapper)
 */
export const savePin = async (pin: string): Promise<void> => {
  await saveCashierPin('kasir_1', pin);
};

/**
 * Memeriksa Apakah PIN Kasir Sudah Pernah Dibuat (Legacy Wrapper)
 */
export const hasPinSet = async (cashierId?: string): Promise<boolean> => {
  try {
    if (cashierId) {
      const key = `@kasirtoko_pin_${cashierId.toLowerCase()}`;
      const val = await AsyncStorage.getItem(key);
      if (val !== null) return true;
    }
    const val = await AsyncStorage.getItem(PIN_KEY);
    if (val !== null) return true;
    const legacyVal = await AsyncStorage.getItem(LEGACY_PIN_KEY);
    return legacyVal !== null;
  } catch (err) {
    console.warn('Gagal memeriksa status PIN dari AsyncStorage:', err);
    return false;
  }
};

/**
 * Memvalidasi PIN untuk Akun Kasir Tertentu
 * Mendukung signature:
 * - verifyCashierPin(userId, cashierId, pin) -> Mode Multi-Tenant Dual-PIN
 * - verifyCashierPin(cashierId, pin) -> Mode Legacy
 */
export async function verifyCashierPin(userId: string, cashierId: CashierId, pin: string): Promise<boolean>;
export async function verifyCashierPin(cashierId: string, pin: string): Promise<boolean>;
export async function verifyCashierPin(
  first: string,
  second: string,
  third?: string
): Promise<boolean> {
  const isMultiTenant = typeof third === 'string';
  const userId = isMultiTenant ? first : '';
  const rawId = (isMultiTenant ? second : first).toLowerCase();
  const cashierId: CashierId = rawId === 'kasir_2' || rawId === 'istri' ? 'kasir_2' : 'kasir_1';
  const pin = (isMultiTenant ? third : second).trim();
  const enteredHash = hashPin(pin);

  try {
    // 1. Cek storage lokal sub_pin
    if (userId) {
      const subKey = `${SUB_PIN_KEY_PREFIX}${userId}_${cashierId}`;
      const stored = await AsyncStorage.getItem(subKey);
      if (stored) {
        return stored === enteredHash;
      }
    }

    // 2. Cek storage lokal legacy kasir
    const legacyKey = `@kasirtoko_pin_${cashierId}`;
    const legacyStored = await AsyncStorage.getItem(legacyKey);
    if (legacyStored) {
      return legacyStored === enteredHash;
    }

    // 3. Jika Kasir 1 dan belum ada sub-pin, coba verifikasi dengan PIN utama user
    if (cashierId === 'kasir_1' && userId) {
      const isMainPinValid = await verifyUserPin(userId, pin);
      if (isMainPinValid) {
        // Cache juga ke sub-pin kasir 1
        const subKey = `${SUB_PIN_KEY_PREFIX}${userId}_kasir_1`;
        await AsyncStorage.setItem(subKey, enteredHash);
        return true;
      }
    }

    // 4. Cek cloud Supabase auth user metadata
    if (userId) {
      try {
        const { supabase } = await import('../../config/supabase');
        const { data: authData } = await supabase.auth.getUser();
        const cloudPins = authData?.user?.user_metadata?.cashier_pins;
        if (cloudPins && cloudPins[cashierId]) {
          const subKey = `${SUB_PIN_KEY_PREFIX}${userId}_${cashierId}`;
          await AsyncStorage.setItem(subKey, cloudPins[cashierId]);
          return cloudPins[cashierId] === enteredHash;
        }
      } catch (_) {}
    }

    // 5. Fallback ke default fallback pin jika ada
    const fallbackPin = DEFAULT_FALLBACK_PINS[cashierId] || DEFAULT_FALLBACK_PINS[rawId];
    if (fallbackPin && pin === fallbackPin) {
      return true;
    }

    return false;
  } catch (err) {
    console.warn(`Gagal memverifikasi PIN kasir ${cashierId}:`, err);
    return false;
  }
}

/**
 * Memvalidasi PIN (Legacy Wrapper)
 */
export const verifyPin = async (pin: string): Promise<boolean> => {
  return verifyCashierPin('suami', pin);
};

// ==============================================================================
// MULTI-TENANT SUPABASE USER PIN & PROFILE FUNCTIONS
// ==============================================================================

/**
 * Menyimpan PIN 6 Digit untuk Akun Supabase (Tersinkron ke Local AsyncStorage & Supabase Cloud)
 */
export const saveUserPin = async (
  userId: string,
  pin: string,
  storeName?: string,
  ownerName?: string
): Promise<void> => {
  if (!userId) throw new Error('User ID diperlukan untuk menyimpan PIN.');
  const cleanPin = pin.trim();
  if (cleanPin.length !== 6 || !/^\d{6}$/.test(cleanPin)) {
    throw new Error('PIN harus berupa 6 digit angka.');
  }

  const hashed = hashPin(cleanPin);
  const pinKey = `${USER_PIN_PREFIX}${userId}`;
  await AsyncStorage.setItem(pinKey, hashed);

  // Simpan data profil ke AsyncStorage
  const profileKey = `${USER_PROFILE_PREFIX}${userId}`;
  const existingProfileRaw = await AsyncStorage.getItem(profileKey);
  const existingProfile = existingProfileRaw ? JSON.parse(existingProfileRaw) : {};
  const updatedProfile = {
    ...existingProfile,
    id: userId,
    store_name: storeName?.trim() || existingProfile.store_name || 'KasirToko POS',
    owner_name: ownerName?.trim() || existingProfile.owner_name || 'Pemilik Toko',
    pin_hash: hashed,
    updated_at: new Date().toISOString(),
  };
  await AsyncStorage.setItem(profileKey, JSON.stringify(updatedProfile));

  // Sinkronkan ke Supabase: Metadata Auth & Tabel Profiles
  try {
    const { supabase } = await import('../../config/supabase');
    
    // 1. Selalu perbarui user_metadata di auth.users (aman & selalu didukung)
    try {
      await supabase.auth.updateUser({
        data: {
          pin_hash: hashed,
          store_name: updatedProfile.store_name,
          owner_name: updatedProfile.owner_name,
        },
      });
    } catch (metaErr) {
      console.warn('Gagal sinkronisasi metadata PIN:', metaErr);
    }

    // 2. Sinkronkan ke tabel public.profiles (jika tabel & kolom tersedia)
    try {
      await supabase.from('profiles').upsert({
        id: userId,
        pin_hash: hashed,
        store_name: updatedProfile.store_name,
        owner_name: updatedProfile.owner_name,
        updated_at: updatedProfile.updated_at,
      });
    } catch (profileErr) {
      console.warn('Sinkronisasi profiles table ditunda (disimpan di metadata & lokal):', profileErr);
    }
  } catch (err) {
    console.warn('Sinkronisasi PIN ke cloud tertunda (disimpan di lokal):', err);
  }
};

/**
 * Memeriksa Apakah Pengguna Supabase Tertentu Sudah Memiliki 6-Digit PIN
 */
export const hasUserPinSet = async (userId: string): Promise<boolean> => {
  if (!userId) return false;
  try {
    const pinKey = `${USER_PIN_PREFIX}${userId}`;
    const local = await AsyncStorage.getItem(pinKey);
    if (local && local.trim().length > 0) return true;

    const { supabase } = await import('../../config/supabase');

    // 1. Coba cek auth metadata terlebih dahulu (selalu tersedia di auth.users)
    try {
      const { data: authData } = await supabase.auth.getUser();
      if (typeof authData?.user?.user_metadata?.pin_hash === 'string' && authData.user.user_metadata.pin_hash.trim().length > 0) {
        const cloudHash = authData.user.user_metadata.pin_hash;
        await AsyncStorage.setItem(pinKey, cloudHash);
        return true;
      }
    } catch (_) {}

    // 2. Coba ambil dari cloud Supabase profiles table
    try {
      const { data } = await supabase
        .from('profiles')
        .select('pin_hash')
        .eq('id', userId)
        .maybeSingle();

      if (typeof data?.pin_hash === 'string' && data.pin_hash.trim().length > 0) {
        await AsyncStorage.setItem(pinKey, data.pin_hash);
        return true;
      }
    } catch (_) {}

    return false;
  } catch (err) {
    console.warn('Gagal cek status user PIN:', err);
    return false;
  }
};

/**
 * Memverifikasi 6-Digit PIN Pengguna Supabase (Offline-First dengan Fallback ke Cloud)
 */
export const verifyUserPin = async (userId: string, pin: string): Promise<boolean> => {
  if (!userId || !pin) return false;
  const cleanPin = pin.trim();
  try {
    const pinKey = `${USER_PIN_PREFIX}${userId}`;
    let storedHash = await AsyncStorage.getItem(pinKey);

    if (!storedHash) {
      const { supabase } = await import('../../config/supabase');

      // Cek auth user metadata
      try {
        const { data: authData } = await supabase.auth.getUser();
        if (typeof authData?.user?.user_metadata?.pin_hash === 'string' && authData.user.user_metadata.pin_hash.trim().length > 0) {
          storedHash = authData.user.user_metadata.pin_hash;
          await AsyncStorage.setItem(pinKey, storedHash);
        }
      } catch (_) {}

      // Ambil dari Supabase profiles jika belum ada
      if (!storedHash) {
        try {
          const { data } = await supabase
            .from('profiles')
            .select('pin_hash')
            .eq('id', userId)
            .maybeSingle();

          if (typeof data?.pin_hash === 'string' && data.pin_hash.trim().length > 0) {
            storedHash = data.pin_hash;
            await AsyncStorage.setItem(pinKey, storedHash);
          }
        } catch (_) {}
      }
    }

    if (!storedHash) return false;
    return storedHash === hashPin(cleanPin);
  } catch (err) {
    console.warn('Gagal verifikasi user PIN:', err);
    return false;
  }
};
