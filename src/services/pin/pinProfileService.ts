import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  CashierId,
  ACTIVE_CASHIER_ID_KEY,
  CASHIER_NAME_KEY,
  CASHIER_UNIT_KEY,
  LEGACY_NAME_KEY,
  SIMPLE_NAME_KEY,
  PROFILE_NAME_PREFIX,
  USER_PROFILE_PREFIX,
  USER_PROFILE_KEY,
  SUB_PROFILES_KEY,
  SUB_PROFILES_KEY_PREFIX,
  USER_PIN_PREFIX,
} from './pinSessionService';

/**
 * STRUKTUR PROFIL AKUN KASIR MULTI-BISNIS
 */
export interface CashierSubProfile {
  id: CashierId;
  name: string; // 'Kasir 1' | 'Kasir 2' | string kustom
  unit: string; // 'Unit 1' | 'Unit 2' | string kustom
  roleLabel?: string;
  avatarEmoji?: string;
  pin_hash?: string;
}

export type CashierSubProfiles = Record<CashierId, CashierSubProfile>;

export const DEFAULT_SUB_PROFILES: CashierSubProfiles = {
  kasir_1: {
    id: 'kasir_1',
    name: 'Kasir 1',
    unit: 'Unit 1',
    roleLabel: 'Kasir Utama',
    avatarEmoji: '🛒',
  },
  kasir_2: {
    id: 'kasir_2',
    name: 'Kasir 2',
    unit: 'Unit 2',
    roleLabel: 'Kasir Cabang',
    avatarEmoji: '📦',
  },
};

export interface CashierProfile {
  id: string; // 'kasir_1' | 'kasir_2' | 'suami' | 'istri' | string
  name: string; // 'Kasir 1' | 'Kasir 2' | string
  unit: 'Sembako' | 'Tembakau' | string;
  roleLabel: string;
  avatarEmoji: string;
}

/**
 * DAFTAR AKUN KASIR PRESET TOKO
 * Mendukung switcher dual-sub-profile (Kasir 1 / Unit 1 & Kasir 2 / Unit 2)
 */
export const DEFAULT_CASHIER_PROFILES: CashierProfile[] = [
  {
    id: 'kasir_1',
    name: 'Kasir 1',
    unit: 'Unit 1',
    roleLabel: 'Kasir 1 (Unit 1)',
    avatarEmoji: '🛒',
  },
  {
    id: 'kasir_2',
    name: 'Kasir 2',
    unit: 'Unit 2',
    roleLabel: 'Kasir 2 (Unit 2)',
    avatarEmoji: '📦',
  },
];

/**
 * Mengambil Sub-Profil Kasir (Kasir 1 & Kasir 2) untuk Toko Ini
 * Mengutamakan cache lokal per-user, dengan fallback ke Supabase metadata/profiles, dan DEFAULT_SUB_PROFILES
 */
export const getSubProfiles = async (userId?: string): Promise<CashierSubProfiles> => {
  try {
    // 1. Cek storage lokal per-user
    if (userId) {
      const localUserKey = `${SUB_PROFILES_KEY_PREFIX}${userId}`;
      const localRaw = await AsyncStorage.getItem(localUserKey);
      if (localRaw) {
        try {
          const parsed = JSON.parse(localRaw);
          if (parsed && typeof parsed === 'object' && parsed.kasir_1 && parsed.kasir_2) {
            return {
              kasir_1: { ...DEFAULT_SUB_PROFILES.kasir_1, ...parsed.kasir_1, id: 'kasir_1' },
              kasir_2: { ...DEFAULT_SUB_PROFILES.kasir_2, ...parsed.kasir_2, id: 'kasir_2' },
            };
          }
        } catch (_) {}
      }
    }

    // 2. Cek storage lokal device-level
    const deviceRaw = await AsyncStorage.getItem(SUB_PROFILES_KEY);
    if (deviceRaw) {
      try {
        const parsed = JSON.parse(deviceRaw);
        if (parsed && typeof parsed === 'object' && parsed.kasir_1 && parsed.kasir_2) {
          return {
            kasir_1: { ...DEFAULT_SUB_PROFILES.kasir_1, ...parsed.kasir_1, id: 'kasir_1' },
            kasir_2: { ...DEFAULT_SUB_PROFILES.kasir_2, ...parsed.kasir_2, id: 'kasir_2' },
          };
        }
      } catch (_) {}
    }

    // 3. Cek dari Supabase Auth user metadata / profiles table jika userId tersedia
    if (userId) {
      try {
        const { supabase } = await import('../../config/supabase');
        const { data: authData } = await supabase.auth.getUser();
        const metaSub = authData?.user?.user_metadata?.sub_profiles;
        if (metaSub && metaSub.kasir_1 && metaSub.kasir_2) {
          const resolved: CashierSubProfiles = {
            kasir_1: { ...DEFAULT_SUB_PROFILES.kasir_1, ...metaSub.kasir_1, id: 'kasir_1' },
            kasir_2: { ...DEFAULT_SUB_PROFILES.kasir_2, ...metaSub.kasir_2, id: 'kasir_2' },
          };
          await AsyncStorage.setItem(`${SUB_PROFILES_KEY_PREFIX}${userId}`, JSON.stringify(resolved));
          await AsyncStorage.setItem(SUB_PROFILES_KEY, JSON.stringify(resolved));
          return resolved;
        }

        const { data: profileData } = await supabase
          .from('profiles')
          .select('sub_profiles')
          .eq('id', userId)
          .maybeSingle();

        if (profileData?.sub_profiles && profileData.sub_profiles.kasir_1) {
          const resolved: CashierSubProfiles = {
            kasir_1: { ...DEFAULT_SUB_PROFILES.kasir_1, ...profileData.sub_profiles.kasir_1, id: 'kasir_1' },
            kasir_2: { ...DEFAULT_SUB_PROFILES.kasir_2, ...profileData.sub_profiles.kasir_2, id: 'kasir_2' },
          };
          await AsyncStorage.setItem(`${SUB_PROFILES_KEY_PREFIX}${userId}`, JSON.stringify(resolved));
          await AsyncStorage.setItem(SUB_PROFILES_KEY, JSON.stringify(resolved));
          return resolved;
        }
      } catch (_) {}
    }

    return DEFAULT_SUB_PROFILES;
  } catch (err) {
    console.warn('Gagal membaca sub_profiles kasir:', err);
    return DEFAULT_SUB_PROFILES;
  }
};

/**
 * Menyimpan Perubahan Sub-Profil Kasir (Nama Kasir & Nama Unit Usaha)
 * Tersimpan di local storage perangkat dan tersinkronisasi ke database cloud Supabase
 */
export const saveSubProfiles = async (userId: string, profiles: CashierSubProfiles): Promise<void> => {
  try {
    const jsonStr = JSON.stringify(profiles);
    const sets: [string, string][] = [
      [SUB_PROFILES_KEY, jsonStr],
    ];
    if (userId) {
      sets.push([`${SUB_PROFILES_KEY_PREFIX}${userId}`, jsonStr]);
    }
    await AsyncStorage.multiSet(sets);

    // Sinkronisasi ke Supabase
    try {
      const { supabase } = await import('../../config/supabase');
      // 1. Simpan ke raw_user_meta_data auth.users
      await supabase.auth.updateUser({
        data: {
          sub_profiles: profiles,
        },
      });

      // 2. Coba update kolom sub_profiles pada public.profiles jika tersedia
      if (userId) {
        await supabase
          .from('profiles')
          .update({
            sub_profiles: profiles,
            updated_at: new Date().toISOString(),
          })
          .eq('id', userId);
      }
    } catch (cloudErr) {
      console.warn('Sinkronisasi sub_profiles ke Supabase cloud ditunda:', cloudErr);
    }
  } catch (err) {
    console.error('Gagal menyimpan sub-profil kasir:', err);
    throw err;
  }
};

/**
 * Mengambil Nama Kustom Kasir Berdasarkan ID Profil
 * Mendukung pencarian berjenjang: kunci spesifik per profil, JSON profile,
 * kunci umum, dan fallback ke nama default.
 */
export const getCashierProfileName = async (cashierId: string): Promise<string> => {
  try {
    const cleanId = (cashierId || 'suami').toLowerCase();

    // 1. Cek kunci profil spesifik: @kasirtoko_profile_name_suami / @kasirtoko_profile_name_istri
    const perProfileName = await AsyncStorage.getItem(`${PROFILE_NAME_PREFIX}${cleanId}`);
    if (perProfileName && perProfileName.trim()) {
      return perProfileName.trim();
    }

    // 2. Cek JSON profile jika ada
    const userProfileJson = await AsyncStorage.getItem(`${USER_PROFILE_PREFIX}${cleanId}`);
    if (userProfileJson) {
      try {
        const parsed = JSON.parse(userProfileJson);
        if (parsed?.name && typeof parsed.name === 'string' && parsed.name.trim()) {
          return parsed.name.trim();
        }
      } catch (_) { }
    }

    // 3. Jika profil yang dicari adalah profil yang sedang aktif atau suami, cek kunci umum
    const activeId = await AsyncStorage.getItem(ACTIVE_CASHIER_ID_KEY);
    if (!activeId || activeId.toLowerCase() === cleanId) {
      const generalName = await AsyncStorage.getItem(CASHIER_NAME_KEY);
      if (generalName && generalName.trim()) return generalName.trim();
      const legacyName = await AsyncStorage.getItem(LEGACY_NAME_KEY);
      if (legacyName && legacyName.trim()) return legacyName.trim();
      const simpleName = await AsyncStorage.getItem(SIMPLE_NAME_KEY);
      if (simpleName && simpleName.trim()) return simpleName.trim();
    }

    // 4. Fallback ke preset DEFAULT_CASHIER_PROFILES
    const found = DEFAULT_CASHIER_PROFILES.find((p) => p.id.toLowerCase() === cleanId);
    return found ? found.name : cleanId === 'istri' ? 'Istri' : 'Suami';
  } catch (err) {
    console.warn(`Gagal membaca nama profil kasir ${cashierId}:`, err);
    return cashierId.toLowerCase() === 'istri' ? 'Istri' : 'Suami';
  }
};

/**
 * Mengambil Seluruh Profil Kasir dengan Nama Kustom Terkini dari AsyncStorage
 */
export const getAllCashierProfiles = async (): Promise<CashierProfile[]> => {
  try {
    const resolvedProfiles: CashierProfile[] = [];
    for (const def of DEFAULT_CASHIER_PROFILES) {
      const customName = await getCashierProfileName(def.id);
      resolvedProfiles.push({
        ...def,
        name: customName || def.name,
      });
    }
    return resolvedProfiles;
  } catch (err) {
    console.warn('Gagal membaca semua profil kasir:', err);
    return DEFAULT_CASHIER_PROFILES;
  }
};

/**
 * Mengambil Profil Kasir yang Sedang Aktif di Perangkat Ini
 */
export const getActiveCashierProfile = async (): Promise<CashierProfile> => {
  try {
    const id = (await AsyncStorage.getItem(ACTIVE_CASHIER_ID_KEY)) || 'suami';
    const cleanId = id.toLowerCase();
    const unit =
      ((await AsyncStorage.getItem(CASHIER_UNIT_KEY)) as 'Sembako' | 'Tembakau' | null) ||
      (cleanId === 'istri' ? 'Tembakau' : 'Sembako');

    const resolvedName = await getCashierProfileName(cleanId);
    const defaultProfile =
      DEFAULT_CASHIER_PROFILES.find((p) => p.id.toLowerCase() === cleanId) ||
      DEFAULT_CASHIER_PROFILES[0];

    return {
      ...defaultProfile,
      id: cleanId,
      name: resolvedName,
      unit: unit,
      roleLabel: unit === 'Tembakau' ? 'Kasir Unit Tembakau' : 'Kasir Unit Sembako',
      avatarEmoji: cleanId === 'istri' ? '🧕' : '👨‍💼',
    };
  } catch (err) {
    console.warn('Gagal membaca profil kasir aktif:', err);
    return DEFAULT_CASHIER_PROFILES[0];
  }
};

/**
 * Menyimpan Profil Kasir Aktif ke Sesi Lokal Perangkat (Semua Kunci Sinkron)
 */
export const setActiveCashierProfile = async (profile: CashierProfile): Promise<void> => {
  try {
    const cleanId = profile.id.toLowerCase();
    const cleanName = profile.name.trim() || (cleanId === 'istri' ? 'Istri' : 'Suami');
    const profileData = JSON.stringify({
      ...profile,
      id: cleanId,
      name: cleanName,
      updated_at: new Date().toISOString(),
    });

    await AsyncStorage.multiSet([
      [ACTIVE_CASHIER_ID_KEY, cleanId],
      [CASHIER_NAME_KEY, cleanName],
      [LEGACY_NAME_KEY, cleanName],
      [SIMPLE_NAME_KEY, cleanName],
      [CASHIER_UNIT_KEY, profile.unit],
      [`${PROFILE_NAME_PREFIX}${cleanId}`, cleanName],
      [`${USER_PROFILE_PREFIX}${cleanId}`, profileData],
      [USER_PROFILE_KEY, profileData],
    ]);
  } catch (err) {
    console.error('Gagal menyimpan profil kasir aktif ke AsyncStorage:', err);
    throw err;
  }
};

/**
 * Menyimpan Nama Kasir Baru ke Seluruh Kunci Penyimpanan Lokal & Supabase (Jika Ada)
 */
export const saveCashierName = async (name: string, cashierId?: string): Promise<void> => {
  const cleaned = name.trim();
  if (!cleaned) throw new Error('Nama kasir tidak boleh kosong.');

  try {
    let cleanId = cashierId ? cashierId.toLowerCase() : '';
    if (!cleanId) {
      const activeId = await AsyncStorage.getItem(ACTIVE_CASHIER_ID_KEY);
      cleanId = (activeId || 'suami').toLowerCase();
    }

    const unit = (cleanId === 'istri' ? 'Tembakau' : 'Sembako') as 'Sembako' | 'Tembakau';
    const profileObj = {
      id: cleanId,
      name: cleaned,
      unit: unit,
      updated_at: new Date().toISOString(),
    };

    await AsyncStorage.multiSet([
      [CASHIER_NAME_KEY, cleaned],
      [LEGACY_NAME_KEY, cleaned],
      [SIMPLE_NAME_KEY, cleaned],
      [`${PROFILE_NAME_PREFIX}${cleanId}`, cleaned],
      [`${USER_PROFILE_PREFIX}${cleanId}`, JSON.stringify(profileObj)],
      [USER_PROFILE_KEY, JSON.stringify(profileObj)],
    ]);

    // Sinkronisasi opsional ke metadata Supabase Auth jika user login terdeteksi
    try {
      const { supabase } = await import('../../config/supabase');
      const { data } = await supabase.auth.getUser();
      if (data?.user) {
        await supabase.auth.updateUser({
          data: { cashier_name: cleaned, display_name: cleaned },
        });
      }
    } catch (_) {
      // Abaikan jika offline atau tanpa session Supabase Auth aktif
    }
  } catch (err) {
    console.error('Gagal menyimpan nama kasir ke AsyncStorage:', err);
    throw err;
  }
};

/**
 * Memperbarui Nama Kasir / Pemilik (Alias untuk saveCashierName)
 */
export const updateCashierName = async (newName: string, cashierId?: string): Promise<void> => {
  return saveCashierName(newName, cashierId);
};

/**
 * Mengambil Nama Kasir Aktif atau Kasir Berdasarkan ID
 */
export const getCashierName = async (cashierId?: string): Promise<string> => {
  if (cashierId) {
    return getCashierProfileName(cashierId);
  }
  const profile = await getActiveCashierProfile();
  return profile.name;
};

/**
 * Mengambil Unit Bisnis Kasir Aktif ('Sembako' | 'Tembakau')
 */
export const getCashierUnit = async (): Promise<'Sembako' | 'Tembakau'> => {
  try {
    const unit = await AsyncStorage.getItem(CASHIER_UNIT_KEY);
    if (unit === 'Tembakau') return 'Tembakau';
    return 'Sembako';
  } catch (err) {
    console.warn('Gagal membaca unit kasir:', err);
    return 'Sembako';
  }
};

/**
 * Mengambil data profil terbaru secara spesifik dari tabel public.profiles berdasarkan auth.uid()
 * Memastikan data segar selalu sinkron langsung dari database Supabase server tanpa kontaminasi akun lama.
 */
export const fetchUserProfileDirect = async (
  userId: string
): Promise<{ id: string; store_name: string; owner_name: string; email?: string; pin_hash?: string; sub_profiles?: CashierSubProfiles } | null> => {
  if (!userId) return null;
  try {
    const { supabase } = await import('../../config/supabase');

    // 1. Fetch spesifik dari tabel public.profiles berdasarkan auth.uid() pengguna yang sedang aktif
    let dbProfile: any = null;
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (!error && data) {
        dbProfile = data;
      }
    } catch (dbErr) {
      console.warn('Gagal fetch profiles table secara langsung:', dbErr);
    }

    // 2. Fetch data auth user metadata sebagai pelengkap/fallback jika record profiles belum ter-trigger
    let metaStore: string | undefined;
    let metaOwner: string | undefined;
    let metaPin: string | undefined;
    let authEmail: string | undefined;
    let metaSubProfiles: CashierSubProfiles | undefined;

    try {
      const { data: authData } = await supabase.auth.getUser();
      if (authData?.user?.id === userId) {
        metaStore = authData.user.user_metadata?.store_name;
        metaOwner = authData.user.user_metadata?.owner_name;
        metaPin = authData.user.user_metadata?.pin_hash;
        metaSubProfiles = authData.user.user_metadata?.sub_profiles;
        authEmail = authData.user.email;
      }
    } catch (_) {}

    const resolvedStoreName = dbProfile?.store_name || metaStore || 'KasirToko POS';
    const resolvedOwnerName = dbProfile?.owner_name || metaOwner || 'Pemilik Toko';
    const resolvedEmail = dbProfile?.email || authEmail || '';
    const resolvedPinHash = dbProfile?.pin_hash || metaPin || '';
    const resolvedSubProfiles: CashierSubProfiles =
      dbProfile?.sub_profiles || metaSubProfiles || DEFAULT_SUB_PROFILES;

    const profileObj = {
      id: userId,
      store_name: resolvedStoreName,
      owner_name: resolvedOwnerName,
      email: resolvedEmail,
      pin_hash: resolvedPinHash,
      sub_profiles: resolvedSubProfiles,
    };

    // Simpan ke cache lokal berlingkup ID user ini saja
    const profileKey = `${USER_PROFILE_PREFIX}${userId}`;
    await AsyncStorage.setItem(profileKey, JSON.stringify(profileObj));

    if (resolvedSubProfiles) {
      const subKey = `${SUB_PROFILES_KEY_PREFIX}${userId}`;
      await AsyncStorage.setItem(subKey, JSON.stringify(resolvedSubProfiles));
      await AsyncStorage.setItem(SUB_PROFILES_KEY, JSON.stringify(resolvedSubProfiles));
    }

    if (resolvedPinHash) {
      const pinKey = `${USER_PIN_PREFIX}${userId}`;
      await AsyncStorage.setItem(pinKey, resolvedPinHash);
    }

    return profileObj;
  } catch (err) {
    console.warn('Gagal membaca profil pengguna terbaru dari cloud:', err);
    return null;
  }
};

/**
 * Mengambil Profil Toko Pengguna (Store Name, Owner Name, dsb)
 * Memprioritaskan fetch spesifik dari database server, dengan fallback ke cache lokal per-user.
 */
export const getUserProfile = async (
  userId: string
): Promise<{ store_name: string; owner_name: string; email?: string } | null> => {
  if (!userId) return null;

  // 1. Coba fetch langsung dari database Supabase
  const fresh = await fetchUserProfileDirect(userId);
  if (fresh) {
    return fresh;
  }

  // 2. Fallback offline cache spesifik user id
  try {
    const profileKey = `${USER_PROFILE_PREFIX}${userId}`;
    const cached = await AsyncStorage.getItem(profileKey);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch (_) {}

  return { store_name: 'KasirToko POS', owner_name: 'Pemilik Toko' };
};
