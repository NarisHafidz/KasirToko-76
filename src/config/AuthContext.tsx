import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Alert, Platform } from 'react-native';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from './supabase';
import {
  CashierId,
  CashierProfile,
  CashierSubProfile,
  CashierSubProfiles,
  DEFAULT_CASHIER_PROFILES,
  DEFAULT_SUB_PROFILES,
  clearCashierSession,
  clearUserSessionAndProfile,
  fetchUserProfileDirect,
  getActiveCashierProfile,
  getCashierProfileName,
  getDeviceActiveCashierId,
  getSubProfiles,
  getUserProfile,
  hasCashierPinSet,
  hasUserPinSet,
  saveCashierName,
  saveCashierPin,
  saveSubProfiles,
  saveUserPin,
  setActiveCashierProfile,
  setCashierSessionActive,
  setDeviceActiveCashierId,
  updateCashierName,
  verifyCashierPin,
  verifyUserPin,
} from '../services/pinService';

/**
 * Interface tipe data untuk nilai context autentikasi multi-tenant Supabase & PIN
 */
export interface AuthContextValue {
  /** Supabase Auth User instance */
  user: User | null;
  /** Supabase Auth Session instance */
  session: Session | null;
  /** Menandakan apakah user sudah login dengan akun email Supabase */
  hasSupabaseSession: boolean;
  /** Menandakan apakah 6-digit PIN telah diverifikasi untuk membuka kasir */
  isPinUnlocked: boolean;
  /** Menandakan apakah akun/kasir saat ini sudah pernah membuat 6-digit PIN */
  hasPinConfigured: boolean;
  /** Nama toko / bisnis terdaftar */
  storeName: string;
  /** Nama pemilik / kasir utama */
  ownerName: string;
  /** Status sedang memuat sesi autentikasi awal */
  isLoading: boolean;

  /** ID sub-profil kasir yang sedang aktif di perangkat ini ('kasir_1' | 'kasir_2') */
  activeCashierId: CashierId;
  /** Data seluruh sub-profil kasir toko (Kasir 1 & Kasir 2) */
  subProfiles: CashierSubProfiles;
  /** Menandakan apakah sub-kasir aktif saat ini sudah memiliki 6-digit PIN */
  hasCashierPin: boolean;
  /** Mengalihkan kasir aktif di perangkat (Kasir 1 <-> Kasir 2) dan menyimpannya di AsyncStorage */
  switchActiveCashier: (cashierId: CashierId) => Promise<void>;
  /** Memperbarui nama kasir dan nama unit usaha untuk sub-profil (Kasir 1 / Kasir 2) */
  updateSubProfiles: (updated: Partial<Record<CashierId, { name: string; unit: string }>>) => Promise<void>;

  /** Fungsi Sign In Supabase Auth menggunakan Email & Password */
  signInWithEmail: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  /** Fungsi Sign Up Supabase Auth untuk mendaftar akun toko baru */
  signUpWithEmail: (
    email: string,
    password: string,
    storeName: string,
    ownerName: string
  ) => Promise<{ success: boolean; needsConfirmation?: boolean; error?: string }>;
  /** Fungsi verifikasi 6-digit PIN untuk membuka akses kasir */
  unlockPin: (pin: string) => Promise<{ success: boolean; error?: string }>;
  /** Fungsi pembuatan 6-digit PIN baru yang diikatkan ke user_id akun Supabase */
  setupPin: (pin: string, storeName?: string, ownerName?: string) => Promise<{ success: boolean; error?: string }>;
  /** Mengunci kembali aplikasi ke layar PIN (tanpa logout email) */
  lockPin: () => void;
  /** Log Out penuh dari akun Supabase Auth (menghapus session) */
  logoutEmail: (skipConfirm?: boolean) => Promise<void>;
  /** Fungsi keluar umum (memberikan opsi Kunci PIN atau Log Out Email) */
  logout: (skipConfirm?: boolean) => void;
  /** Memuat ulang status PIN dan profil toko user */
  refreshUserProfile: () => Promise<void>;

  // --- Properti & Metode Backward Compatibility ---
  /** Menandakan apakah kasir sedang aktif penuh (sudah login email & sudah verifikasi PIN) */
  isAuthenticated: boolean;
  /** Alias status login kasir aktif */
  isLoggedIn: boolean;
  /** ID unik kasir ('kasir_1' | 'kasir_2' | 'suami' | 'istri') */
  cashierId: string;
  /** Nama kasir yang sedang bertugas */
  cashierName: string;
  /** Unit bisnis kasir aktif */
  cashierUnit: string;
  /** Fungsi login lokal kasir */
  login: (
    nameOrProfile?: string | Partial<CashierProfile>,
    cashierId?: string,
    unit?: string
  ) => Promise<void>;
  /** Fungsi pengubah status login langsung */
  setIsLoggedIn: (status: boolean) => void;
  /** Fungsi refresh nama kasir */
  refreshCashierName: () => Promise<void>;
  /** Fungsi update nama kasir */
  updateCashierNameInAuth: (newName: string, targetCashierId?: string) => Promise<void>;
}

// Inisialisasi Context dengan nilai default
const AuthContext = createContext<AuthContextValue>({
  user: null,
  session: null,
  hasSupabaseSession: false,
  isPinUnlocked: false,
  hasPinConfigured: false,
  storeName: 'KasirToko POS',
  ownerName: 'Pemilik Toko',
  isLoading: true,
  activeCashierId: 'kasir_1',
  subProfiles: DEFAULT_SUB_PROFILES,
  hasCashierPin: false,
  switchActiveCashier: async () => {},
  updateSubProfiles: async () => {},
  signInWithEmail: async () => ({ success: false }),
  signUpWithEmail: async () => ({ success: false }),
  unlockPin: async () => ({ success: false }),
  setupPin: async () => ({ success: false }),
  lockPin: () => {},
  logoutEmail: async () => {},
  logout: () => {},
  refreshUserProfile: async () => {},
  isAuthenticated: false,
  isLoggedIn: false,
  cashierId: 'kasir_1',
  cashierName: 'Kasir 1',
  cashierUnit: 'Unit 1',
  login: async () => {},
  setIsLoggedIn: () => {},
  refreshCashierName: async () => {},
  updateCashierNameInAuth: async () => {},
});

/**
 * Provider Autentikasi Multi-Tenant KasirToko POS
 */
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Sesi Supabase Auth
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  // Status Kunci PIN: saat aplikasi baru dibuka, selalu bernilai false agar diminta PIN 6 digit
  const [isPinUnlocked, setIsPinUnlocked] = useState<boolean>(false);
  const [hasPinConfigured, setHasPinConfigured] = useState<boolean>(false);
  // Sub-Profil Kasir (Kasir 1 & Kasir 2)
  const [activeCashierId, setActiveCashierId] = useState<CashierId>('kasir_1');
  const [subProfiles, setSubProfiles] = useState<CashierSubProfiles>(DEFAULT_SUB_PROFILES);
  const [hasCashierPin, setHasCashierPin] = useState<boolean>(false);
  // Profil Toko
  const [storeName, setStoreName] = useState<string>('KasirToko POS');
  const [ownerName, setOwnerName] = useState<string>('Pemilik Toko');
  // Loading status
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Backward compatibility state
  const [cashierId, setCashierId] = useState<string>('kasir_1');
  const [cashierName, setCashierName] = useState<string>('Kasir 1');
  const [cashierUnit, setCashierUnit] = useState<string>('Unit 1');

  /**
   * Memeriksa konfigurasi PIN dan profil user yang sedang aktif langsung dari Supabase
   */
  const checkUserPinAndProfile = useCallback(async (activeUser: User) => {
    try {
      // 1. Ambil ID kasir aktif yang tersimpan di perangkat ini (device-local)
      const deviceCashierId = await getDeviceActiveCashierId();
      setActiveCashierId(deviceCashierId);
      setCashierId(deviceCashierId);

      // 2. Fetch data profil spesifik dari tabel public.profiles berdasarkan auth.uid()
      const profile = await fetchUserProfileDirect(activeUser.id);

      const targetStore = profile?.store_name || activeUser.user_metadata?.store_name || 'KasirToko POS';
      const targetOwner = profile?.owner_name || activeUser.user_metadata?.owner_name || 'Pemilik Toko';

      setStoreName(targetStore);
      setOwnerName(targetOwner);

      // 3. Ambil sub-profil toko (Kasir 1 & Kasir 2)
      const loadedSubProfiles = profile?.sub_profiles || (await getSubProfiles(activeUser.id));
      setSubProfiles(loadedSubProfiles);

      // 4. Sinkronkan nama dan unit kasir aktif saat ini
      const activeSub = loadedSubProfiles[deviceCashierId] || DEFAULT_SUB_PROFILES[deviceCashierId];
      setCashierName(activeSub.name);
      setCashierUnit(activeSub.unit);

      // 5. Cek apakah kasir aktif ini sudah memiliki PIN
      const pinSet = await hasCashierPinSet(activeUser.id, deviceCashierId);
      setHasCashierPin(pinSet);
      setHasPinConfigured(pinSet);
    } catch (err) {
      console.warn('Gagal membaca profil/PIN user:', err);
    }
  }, []);

  /**
   * Inisialisasi awal membaca sesi Supabase yang tersimpan secara persistent di AsyncStorage
   */
  useEffect(() => {
    let isMounted = true;

    const initAuth = async () => {
      try {
        const deviceCashierId = await getDeviceActiveCashierId();
        if (isMounted) {
          setActiveCashierId(deviceCashierId);
          setCashierId(deviceCashierId);
        }

        const { data, error } = await supabase.auth.getSession();
        if (error) {
          console.warn('Gagal mengambil sesi Supabase:', error.message);
        }

        if (isMounted) {
          if (data?.session?.user) {
            setSession(data.session);
            setUser(data.session.user);
            await checkUserPinAndProfile(data.session.user);
          } else {
            // Bersihkan sisa data profil jika tidak ada session aktif di HP
            await clearUserSessionAndProfile();
            setSession(null);
            setUser(null);
            setIsPinUnlocked(false);
            setHasPinConfigured(false);
            setHasCashierPin(false);
            setStoreName('KasirToko POS');
            setOwnerName('Pemilik Toko');

            const loadedSub = await getSubProfiles();
            setSubProfiles(loadedSub);
            const activeSub = loadedSub[deviceCashierId] || DEFAULT_SUB_PROFILES[deviceCashierId];
            setCashierName(activeSub.name);
            setCashierUnit(activeSub.unit);
          }
        }
      } catch (err) {
        console.error('Kesalahan inisialisasi sesi autentikasi:', err);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    initAuth();

    // Listener terhadap perubahan sesi Supabase Auth (Sign in, Sign out, Token Refresh)
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (!isMounted) return;

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        setSession(newSession);
        setUser(newSession?.user || null);
        if (newSession?.user) {
          await checkUserPinAndProfile(newSession.user);
        }
      } else if (event === 'SIGNED_OUT') {
        await clearUserSessionAndProfile();
        setSession(null);
        setUser(null);
        setIsPinUnlocked(false);
        setHasPinConfigured(false);
        setHasCashierPin(false);
        setStoreName('KasirToko POS');
        setOwnerName('Pemilik Toko');

        const deviceId = await getDeviceActiveCashierId();
        setActiveCashierId(deviceId);
        setCashierId(deviceId);
        const loadedSub = await getSubProfiles();
        setSubProfiles(loadedSub);
        const activeSub = loadedSub[deviceId] || DEFAULT_SUB_PROFILES[deviceId];
        setCashierName(activeSub.name);
        setCashierUnit(activeSub.unit);
        await clearCashierSession();
      }
    });

    return () => {
      isMounted = false;
      authListener?.subscription.unsubscribe();
    };
  }, [checkUserPinAndProfile]);

  /**
   * Mengganti Kasir Aktif di Perangkat (Kasir 1 <-> Kasir 2)
   * Menyimpan preferensi ke AsyncStorage perangkat dan memuat status PIN kasir tersebut
   */
  const switchActiveCashier = useCallback(
    async (newCashierId: CashierId) => {
      try {
        await setDeviceActiveCashierId(newCashierId);
        setActiveCashierId(newCashierId);
        setCashierId(newCashierId);

        const activeSub = subProfiles[newCashierId] || DEFAULT_SUB_PROFILES[newCashierId];
        setCashierName(activeSub.name);
        setCashierUnit(activeSub.unit);

        if (user) {
          const pinSet = await hasCashierPinSet(user.id, newCashierId);
          setHasCashierPin(pinSet);
          setHasPinConfigured(pinSet);
        } else {
          setHasCashierPin(false);
          setHasPinConfigured(false);
        }
      } catch (err) {
        console.warn('Gagal beralih kasir aktif:', err);
      }
    },
    [subProfiles, user]
  );

  /**
   * Memperbarui Nama Kasir dan Nama Unit Usaha Sub-Profil
   * Menyimpan ke AsyncStorage lokal dan menyinkronkan ke Supabase cloud
   */
  const updateSubProfiles = useCallback(
    async (updated: Partial<Record<CashierId, { name: string; unit: string }>>) => {
      try {
        const current = user ? await getSubProfiles(user.id) : subProfiles;
        const merged: CashierSubProfiles = {
          kasir_1: {
            ...current.kasir_1,
            ...(updated.kasir_1?.name ? { name: updated.kasir_1.name.trim() } : {}),
            ...(updated.kasir_1?.unit ? { unit: updated.kasir_1.unit.trim() } : {}),
          },
          kasir_2: {
            ...current.kasir_2,
            ...(updated.kasir_2?.name ? { name: updated.kasir_2.name.trim() } : {}),
            ...(updated.kasir_2?.unit ? { unit: updated.kasir_2.unit.trim() } : {}),
          },
        };

        if (user) {
          await saveSubProfiles(user.id, merged);
        }
        setSubProfiles(merged);

        const currentActive = merged[activeCashierId] || DEFAULT_SUB_PROFILES[activeCashierId];
        setCashierName(currentActive.name);
        setCashierUnit(currentActive.unit);

        if (activeCashierId === 'kasir_1') {
          setOwnerName(currentActive.name);
        }
      } catch (err) {
        console.warn('Gagal memperbarui sub-profil kasir:', err);
        throw err;
      }
    },
    [user, subProfiles, activeCashierId]
  );

  /**
   * Fungsi Login Email & Password
   */
  const signInWithEmail = useCallback(
    async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
      try {
        setIsLoading(true);

        // Bersihkan seluruh cache profil lokal sebelum login akun baru untuk isolasi penuh
        await clearUserSessionAndProfile();
        setStoreName('KasirToko POS');
        setOwnerName('Pemilik Toko');
        setCashierName('Kasir 1');

        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (error) {
          let userMsg = error.message;
          if (error.message.includes('Invalid login credentials')) {
            userMsg = 'Email atau kata sandi tidak cocok. Silakan periksa kembali.';
          } else if (error.message.includes('Email not confirmed')) {
            userMsg = 'Email belum dikonfirmasi. Silakan buka kotak masuk email Anda dan klik link konfirmasi.';
          }
          return { success: false, error: userMsg };
        }

        if (data?.user) {
          setUser(data.user);
          setSession(data.session);
          // Fetch ulang data profil terbaru secara spesifik dari tabel public.profiles untuk user id ini
          await checkUserPinAndProfile(data.user);
          // Mengunci PIN saat baru login sehingga user memasukkan atau membuat PIN
          setIsPinUnlocked(false);
          return { success: true };
        }

        return { success: false, error: 'Gagal mengambil data user.' };
      } catch (err: any) {
        return { success: false, error: err?.message || 'Terjadi kesalahan saat masuk.' };
      } finally {
        setIsLoading(false);
      }
    },
    [checkUserPinAndProfile]
  );

  /**
   * Fungsi Pendaftaran Akun Toko Baru (Email & Password)
   * Mengatur 2 sub-profil bawaan: Kasir 1 (Unit 1) & Kasir 2 (Unit 2)
   */
  const signUpWithEmail = useCallback(
    async (
      email: string,
      password: string,
      targetStoreName: string,
      targetOwnerName: string
    ): Promise<{ success: boolean; needsConfirmation?: boolean; error?: string }> => {
      try {
        setIsLoading(true);
        const cleanEmail = email.trim();
        const cleanStore = targetStoreName.trim() || 'KasirToko POS';
        const cleanOwner = targetOwnerName.trim() || 'Pemilik Toko';

        const defaultSubProfiles: CashierSubProfiles = {
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

        const { data, error } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: {
            data: {
              store_name: cleanStore,
              owner_name: cleanOwner,
              cashier_name: 'Kasir 1',
              business_unit: 'Unit 1',
              sub_profiles: defaultSubProfiles,
            },
          },
        });

        if (error) {
          let userMsg = error.message;
          if (error.message.includes('User already registered')) {
            userMsg = 'Email ini sudah terdaftar. Silakan gunakan opsi Masuk.';
          } else if (error.message.includes('Password should be')) {
            userMsg = 'Kata sandi minimal terdiri dari 6 karakter.';
          } else if (error.message.includes('Database error saving new user')) {
            userMsg =
              'Database Supabase memerlukan pembaruan skema profiles. Silakan jalankan migrasi supabase_schema.sql di Supabase SQL Editor.';
          }
          return { success: false, error: userMsg };
        }

        if (data?.user) {
          // Deteksi apakah email butuh konfirmasi:
          // Jika Confirm Email ON di Supabase, data.session bernilai null.
          // Jika Confirm Email OFF, data.session bernilai Session aktif.
          const needsConfirmation = !data.session;

          // Pastikan user selalu diarahkan ke Layar Login setelah pendaftaran
          if (data.session) {
            try {
              await supabase.auth.signOut();
            } catch (_) {}
          }

          setUser(null);
          setSession(null);
          setIsPinUnlocked(false);
          setHasPinConfigured(false);
          setHasCashierPin(false);

          return { success: true, needsConfirmation };
        }

        return { success: false, error: 'Pendaftaran gagal diproses.' };
      } catch (err: any) {
        return { success: false, error: err?.message || 'Terjadi kesalahan saat pendaftaran.' };
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  /**
   * Memverifikasi PIN 6 Digit untuk membuka aplikasi kasir sesuai kasir aktif
   */
  const unlockPin = useCallback(
    async (pin: string): Promise<{ success: boolean; error?: string }> => {
      if (!user) {
        return { success: false, error: 'Sesi akun tidak ditemukan. Silakan login kembali.' };
      }

      try {
        const isValid = await verifyCashierPin(user.id, activeCashierId, pin);
        if (isValid) {
          setIsPinUnlocked(true);
          await setCashierSessionActive(true);

          const activeSub = subProfiles[activeCashierId] || DEFAULT_SUB_PROFILES[activeCashierId];
          setCashierName(activeSub.name);
          setCashierUnit(activeSub.unit);

          return { success: true };
        } else {
          return { success: false, error: 'PIN yang dimasukkan salah.' };
        }
      } catch (err: any) {
        return { success: false, error: err?.message || 'Gagal memverifikasi PIN.' };
      }
    },
    [user, activeCashierId, subProfiles]
  );

  /**
   * Membuat 6-digit PIN baru untuk kasir yang sedang aktif
   */
  const setupPin = useCallback(
    async (
      pin: string,
      customStore?: string,
      customOwner?: string
    ): Promise<{ success: boolean; error?: string }> => {
      if (!user) {
        return { success: false, error: 'Sesi akun tidak ditemukan. Silakan login terlebih dahulu.' };
      }

      try {
        const freshProfile = await fetchUserProfileDirect(user.id);
        const targetStore = customStore?.trim() || freshProfile?.store_name || user.user_metadata?.store_name || storeName;
        const targetOwner = customOwner?.trim() || freshProfile?.owner_name || user.user_metadata?.owner_name || ownerName;

        // Simpan PIN untuk kasir aktif
        await saveCashierPin(user.id, activeCashierId, pin);

        setStoreName(targetStore);
        setOwnerName(targetOwner);
        setHasCashierPin(true);
        setHasPinConfigured(true);
        setIsPinUnlocked(true);
        await setCashierSessionActive(true);

        const activeSub = subProfiles[activeCashierId] || DEFAULT_SUB_PROFILES[activeCashierId];
        setCashierName(activeSub.name);
        setCashierUnit(activeSub.unit);

        return { success: true };
      } catch (err: any) {
        return { success: false, error: err?.message || 'Gagal menyimpan PIN baru.' };
      }
    },
    [user, activeCashierId, subProfiles, storeName, ownerName]
  );

  /**
   * Mengunci aplikasi ke layar PIN (tanpa logout email)
   */
  const lockPin = useCallback(() => {
    setIsPinUnlocked(false);
  }, []);

  /**
   * Log Out Penuh dari Akun Email Supabase
   * Membersihkan seluruh data profil lokal dan async storage agar tidak bocor ke akun berikutnya.
   */
  const executeLogoutEmail = useCallback(async () => {
    try {
      setIsLoading(true);
      const currentUserId = user?.id;

      try {
        await supabase.auth.signOut();
      } catch (soErr) {
        console.warn('Gagal signOut Supabase:', soErr);
      }

      // Bersihkan seluruh cache profil lokal & data async storage terkait profil pengguna lama
      await clearUserSessionAndProfile(currentUserId);
      await clearCashierSession();

      // Reset seluruh state React Context di memori aplikasi ke nilai default bersih
      setUser(null);
      setSession(null);
      setIsPinUnlocked(false);
      setHasPinConfigured(false);
      setStoreName('KasirToko POS');
      setOwnerName('Pemilik Toko');
      setCashierName('Suami');
      setCashierId('suami');
      setCashierUnit('Sembako');
    } catch (err) {
      console.warn('Gagal keluar dari Supabase Auth:', err);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  /**
   * Log Out Email dengan Konfirmasi
   */
  const logoutEmail = useCallback(
    async (skipConfirm: boolean = false) => {
      if (skipConfirm) {
        await executeLogoutEmail();
        return;
      }

      if (Platform.OS === 'web' && typeof window !== 'undefined' && window.confirm) {
        if (window.confirm('Apakah Anda yakin ingin keluar dari akun email ini? Sesi akan ditutup.')) {
          await executeLogoutEmail();
        }
        return;
      }

      Alert.alert(
        'Keluar Akun Email',
        'Apakah Anda yakin ingin keluar dari akun email ini? Sesi Supabase akan ditutup dan Anda harus masuk kembali.',
        [
          { text: 'Batal', style: 'cancel' },
          {
            text: 'Keluar',
            style: 'destructive',
            onPress: () => executeLogoutEmail(),
          },
        ]
      );
    },
    [executeLogoutEmail]
  );

  /**
   * Dialog Logout Umum dengan Opsi: Kunci PIN vs Keluar Akun Email
   */
  const logout = useCallback(
    (skipConfirm: boolean = false) => {
      if (skipConfirm) {
        lockPin();
        return;
      }

      if (Platform.OS === 'web' && typeof window !== 'undefined' && window.confirm) {
        const choice = window.confirm(
          'PILIHAN KEAMANAN:\nTekan OK untuk "Kunci Aplikasi (PIN)", atau Batal untuk keluar opsi.'
        );
        if (choice) {
          lockPin();
        }
        return;
      }

      Alert.alert(
        'Keamanan Sesi Kasir',
        'Kunci layar aplikasi ke status PIN saat kasir istirahat atau pergantian shift.',
        [
          { text: 'Batal', style: 'cancel' },
          {
            text: 'Kunci Layar',
            style: 'default',
            onPress: () => lockPin(),
          },
        ],
        { cancelable: true }
      );
    },
    [lockPin, logoutEmail]
  );

  /**
   * Memuat ulang data profil pengguna
   */
  const refreshUserProfile = useCallback(async () => {
    if (user) {
      await checkUserPinAndProfile(user);
    }
  }, [user, checkUserPinAndProfile]);

  // --- Implementasi Fungsi Backward Compatibility ---
  const login = useCallback(
    async (nameOrProfile?: string | Partial<CashierProfile>, customId?: string) => {
      setIsPinUnlocked(true);
      if (typeof nameOrProfile === 'string') {
        setCashierName(nameOrProfile);
      }
    },
    []
  );

  const setIsLoggedIn = useCallback((status: boolean) => {
    setIsPinUnlocked(status);
  }, []);

  const refreshCashierName = useCallback(async () => {
    try {
      const profile = await getActiveCashierProfile();
      setCashierName(profile.name || 'Suami');
    } catch (_) {}
  }, []);

  const updateCashierNameInAuth = useCallback(
    async (newName: string, targetCashierId?: string) => {
      try {
        const cleaned = newName.trim();
        const targetId: CashierId =
          targetCashierId === 'kasir_2' || targetCashierId === 'istri'
            ? 'kasir_2'
            : targetCashierId === 'kasir_1' || targetCashierId === 'suami'
            ? 'kasir_1'
            : activeCashierId;

        await updateSubProfiles({
          [targetId]: {
            name: cleaned,
            unit: subProfiles[targetId]?.unit || 'Unit 1',
          },
        });
      } catch (_) {}
    },
    [updateSubProfiles, activeCashierId, subProfiles]
  );

  const hasSupabaseSession = Boolean(session && user);
  const isAuthenticated = hasSupabaseSession && isPinUnlocked;

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        hasSupabaseSession,
        isPinUnlocked,
        hasPinConfigured,
        storeName,
        ownerName,
        isLoading,
        activeCashierId,
        subProfiles,
        hasCashierPin,
        switchActiveCashier,
        updateSubProfiles,
        signInWithEmail,
        signUpWithEmail,
        unlockPin,
        setupPin,
        lockPin,
        logoutEmail,
        logout,
        refreshUserProfile,
        // Backward compatibility
        isAuthenticated,
        isLoggedIn: isAuthenticated,
        cashierId,
        cashierName,
        cashierUnit,
        login,
        setIsLoggedIn,
        refreshCashierName,
        updateCashierNameInAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

/**
 * Hook custom untuk mengakses konteks autentikasi multi-tenant
 */
export const useAuth = (): AuthContextValue => useContext(AuthContext);
