import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * STRUKTUR ID AKUN KASIR MULTI-BISNIS
 */
export type CashierId = 'kasir_1' | 'kasir_2';

/**
 * KUNCI PENYIMPANAN ASYNCSTORAGE
 */
export const PIN_KEY = '@kasirtoko_pin';
export const LEGACY_PIN_KEY = '@cashier_pin';
export const CASHIER_NAME_KEY = '@kasirtoko_cashier_name';
export const LEGACY_NAME_KEY = '@cashier_name';
export const SIMPLE_NAME_KEY = 'cashier_name';
export const CASHIER_UNIT_KEY = '@kasirtoko_cashier_unit';
export const ACTIVE_CASHIER_ID_KEY = '@kasirtoko_active_cashier_id';
export const SESSION_KEY = '@kasirtoko_session_active';
export const PROFILE_NAME_PREFIX = '@kasirtoko_profile_name_';
export const USER_PROFILE_PREFIX = '@kasirtoko_user_profile_';
export const USER_PROFILE_KEY = '@kasirtoko_user_profile';
export const USER_PIN_PREFIX = '@kasirtoko_user_pin_';
export const USER_PIN_SESSION_PREFIX = '@kasirtoko_pin_unlocked_';
export const SUB_PROFILES_KEY_PREFIX = '@kasirtoko_sub_profiles_';
export const SUB_PROFILES_KEY = '@kasirtoko_sub_profiles';
export const SUB_PIN_KEY_PREFIX = '@kasirtoko_sub_pin_';

/**
 * Mengambil ID Kasir Aktif yang Tersimpan di Perangkat Lokal Ini
 * Sesuai kebutuhan: saat HP dibuka kembali, kasir terakhir di HP ini otomatis terpilih.
 */
export const getDeviceActiveCashierId = async (): Promise<CashierId> => {
  try {
    const val = await AsyncStorage.getItem(ACTIVE_CASHIER_ID_KEY);
    if (val === 'kasir_2' || val === 'istri') {
      return 'kasir_2';
    }
    return 'kasir_1';
  } catch (err) {
    console.warn('Gagal membaca active cashier id dari perangkat:', err);
    return 'kasir_1';
  }
};

/**
 * Menyimpan Pilihan Kasir Aktif di AsyncStorage Lokal Perangkat
 */
export const setDeviceActiveCashierId = async (cashierId: CashierId): Promise<void> => {
  try {
    await AsyncStorage.setItem(ACTIVE_CASHIER_ID_KEY, cashierId);
  } catch (err) {
    console.warn('Gagal menyimpan active cashier id ke perangkat:', err);
  }
};

/**
 * Mengatur Status Sesi Kasir Aktif
 */
export const setCashierSessionActive = async (active: boolean): Promise<void> => {
  try {
    if (active) {
      await AsyncStorage.setItem(SESSION_KEY, 'true');
    } else {
      await AsyncStorage.removeItem(SESSION_KEY);
    }
  } catch (err) {
    console.warn('Gagal menyimpan status sesi kasir:', err);
  }
};

/**
 * Memeriksa Apakah Sesi Kasir Masih Aktif
 */
export const isCashierSessionActive = async (): Promise<boolean> => {
  try {
    const val = await AsyncStorage.getItem(SESSION_KEY);
    return val === 'true';
  } catch (err) {
    console.warn('Gagal membaca status sesi kasir:', err);
    return false;
  }
};

/**
 * Menghapus Sesi Kasir Aktif (Log Out)
 * PENTING: Hanya menghapus token status aktif sesi login,
 * TIDAK MENGHAPUS nama profil kasir, PIN, atau preferensi yang telah disimpan!
 */
export const clearCashierSession = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(SESSION_KEY);
  } catch (err) {
    console.warn('Gagal menghapus status sesi kasir:', err);
  }
};

/**
 * Membersihkan seluruh cache profil lokal, state user, dan data async storage terkait profil pengguna lama.
 * Menjamin tidak ada data profil akun sebelumnya (Akun A) yang menempel atau menimpa profil akun baru (Akun B).
 */
export const clearUserSessionAndProfile = async (specificUserId?: string): Promise<void> => {
  try {
    const keysToRemove: string[] = [
      SESSION_KEY,
      USER_PROFILE_KEY,
      CASHIER_NAME_KEY,
      LEGACY_NAME_KEY,
      SIMPLE_NAME_KEY,
      `${PROFILE_NAME_PREFIX}suami`,
      `${PROFILE_NAME_PREFIX}istri`,
      `${PROFILE_NAME_PREFIX}kasir_1`,
      `${PROFILE_NAME_PREFIX}kasir_2`,
      `${USER_PROFILE_PREFIX}suami`,
      `${USER_PROFILE_PREFIX}istri`,
      `${USER_PROFILE_PREFIX}kasir_1`,
      `${USER_PROFILE_PREFIX}kasir_2`,
    ];

    if (specificUserId) {
      keysToRemove.push(
        `${USER_PROFILE_PREFIX}${specificUserId}`,
        `${USER_PIN_PREFIX}${specificUserId}`,
        `${USER_PIN_SESSION_PREFIX}${specificUserId}`,
        `${SUB_PROFILES_KEY_PREFIX}${specificUserId}`,
        `${SUB_PIN_KEY_PREFIX}${specificUserId}_kasir_1`,
        `${SUB_PIN_KEY_PREFIX}${specificUserId}_kasir_2`
      );
    }

    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const profileAndPinKeys = allKeys.filter(
        (k) =>
          k.startsWith(USER_PROFILE_PREFIX) ||
          k.startsWith(USER_PIN_PREFIX) ||
          k.startsWith(PROFILE_NAME_PREFIX) ||
          k.startsWith(USER_PIN_SESSION_PREFIX) ||
          k.startsWith(SUB_PROFILES_KEY_PREFIX) ||
          k.startsWith(SUB_PIN_KEY_PREFIX)
      );
      keysToRemove.push(...profileAndPinKeys);
    } catch (_) {}

    await AsyncStorage.multiRemove(Array.from(new Set(keysToRemove)));
  } catch (err) {
    console.warn('Gagal membersihkan cache profil user:', err);
  }
};

/**
 * Mereset Seluruh Data PIN & Sesi Kasir (Factory Reset Lokal)
 */
export const resetAllPinData = async (): Promise<void> => {
  try {
    await AsyncStorage.multiRemove([
      PIN_KEY,
      LEGACY_PIN_KEY,
      CASHIER_NAME_KEY,
      LEGACY_NAME_KEY,
      SIMPLE_NAME_KEY,
      CASHIER_UNIT_KEY,
      ACTIVE_CASHIER_ID_KEY,
      SESSION_KEY,
      USER_PROFILE_KEY,
      `${PROFILE_NAME_PREFIX}suami`,
      `${PROFILE_NAME_PREFIX}istri`,
      `${USER_PROFILE_PREFIX}suami`,
      `${USER_PROFILE_PREFIX}istri`,
      '@kasirtoko_pin_suami',
      '@kasirtoko_pin_istri',
    ]);
  } catch (err) {
    console.warn('Gagal mereset semua data PIN:', err);
  }
};

/** Alias fungsi reset untuk backward compatibility */
export const clearPin = resetAllPinData;
