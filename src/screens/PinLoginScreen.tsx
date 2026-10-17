import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  Vibration,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  CheckCircle2,
  Delete,
  KeyRound,
  Lock,
  LogOut,
  Moon,
  ShieldAlert,
  ShieldCheck,
  Store,
  Sun,
  User,
  UserCheck,
} from 'lucide-react-native';
import { ChangePinStep, PinLoginModals } from '../components';
import { useAuth } from '../config/AuthContext';
import { useTheme } from '../config/ThemeContext';
import { makeStyles } from './PinLoginScreen.styles';
import {
  CashierId,
  CashierProfile,
  DEFAULT_SUB_PROFILES,
  saveCashierPin,
  verifyCashierPin,
} from '../services/pinService';

/**
 * Properti Komponen PinLoginScreen
 */
interface PinLoginScreenProps {
  /** Callback yang dipanggil saat verifikasi atau pembuatan PIN kasir berhasil */
  onLoginSuccess?: (profileOrName?: CashierProfile | string) => void;
  /** Objek navigasi opsional */
  navigation?: any;
}

/**
 * Mode PIN:
 * - 'verify': Memvalidasi PIN 6 digit untuk membuka kasir
 * - 'setup_new': Meminta input PIN 6 digit baru (saat registrasi / belum ada PIN)
 * - 'setup_confirm': Meminta konfirmasi ulang PIN 6 digit baru
 * - 'change_old': Meminta input PIN lama saat mengganti PIN
 * - 'change_new': Meminta input PIN baru pengganti
 * - 'change_confirm': Meminta konfirmasi ulang PIN pengganti
 */
type PinMode =
  | 'verify'
  | 'setup_new'
  | 'setup_confirm'
  | 'change_old'
  | 'change_new'
  | 'change_confirm';

const PIN_LENGTH = 6;
const MAX_ATTEMPTS = 5;

export const PinLoginScreen: React.FC<PinLoginScreenProps> = ({ onLoginSuccess, navigation }) => {
  const { theme, isDark, toggleTheme } = useTheme();
  const {
    user,
    storeName,
    ownerName,
    hasPinConfigured,
    activeCashierId,
    subProfiles,
    hasCashierPin,
    switchActiveCashier,
    unlockPin,
    setupPin,
    logoutEmail,
    refreshUserProfile,
  } = useAuth();

  const [mode, setMode] = useState<PinMode>(hasCashierPin ? 'verify' : 'setup_new');
  const [pin, setPin] = useState<string>('');
  const [tempPin, setTempPin] = useState<string>('');
  const [attempts, setAttempts] = useState<number>(0);
  const [locked, setLocked] = useState<boolean>(false);
  const [lockSec, setLockSec] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string>('');

  // Welcome modal state
  const [welcomeVisible, setWelcomeVisible] = useState<boolean>(false);
  const [welcomeName, setWelcomeName] = useState<string>('');
  const [welcomeIsFirstTime, setWelcomeIsFirstTime] = useState<boolean>(true);

  // STEP STATE MODAL GANTI PIN
  const [changePinModalVisible, setChangePinModalVisible] = useState<boolean>(false);
  const [changePinStep, setChangePinStep] = useState<ChangePinStep>('VERIFY_OLD');
  const [changePinInput, setChangePinInput] = useState<string>('');
  const [changePinNewTemp, setChangePinNewTemp] = useState<string>('');
  const [changePinError, setChangePinError] = useState<string>('');
  const [isSavingChangePin, setIsSavingChangePin] = useState<boolean>(false);

  const shake = useRef(new Animated.Value(0)).current;
  const modalShake = useRef(new Animated.Value(0)).current;

  // Profil sub-kasir aktif
  const activeProfile = subProfiles?.[activeCashierId] || DEFAULT_SUB_PROFILES[activeCashierId];

  // Inisialisasi mode dan sinkronkan data profil terbaru saat layar PIN dibuka
  useEffect(() => {
    refreshUserProfile();
  }, [refreshUserProfile]);

  useEffect(() => {
    if (!hasCashierPin) {
      setMode('setup_new');
    } else {
      setMode('verify');
    }
    setPin('');
    setTempPin('');
    setErrorMessage('');
    setAttempts(0);
    setLocked(false);
  }, [hasCashierPin, activeCashierId]);

  // Handler pergantian sub-profil kasir aktif saat card kasir ditekan
  const handleSelectCashier = async (targetId: CashierId) => {
    if (targetId === activeCashierId) return;
    Vibration.vibrate(40);
    setPin('');
    setTempPin('');
    setErrorMessage('');
    setAttempts(0);
    setLocked(false);
    await switchActiveCashier(targetId);
  };

  // Efek getar horizontal saat PIN salah
  const doShake = () => {
    Vibration.vibrate(120);
    Animated.sequence([
      Animated.timing(shake, { toValue: -12, duration: 60, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 12, duration: 60, useNativeDriver: true }),
      Animated.timing(shake, { toValue: -8, duration: 60, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 8, duration: 60, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  };

  // Efek getar horizontal khusus di dalam Modal Ganti PIN
  const doModalShake = () => {
    Vibration.vibrate(120);
    Animated.sequence([
      Animated.timing(modalShake, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(modalShake, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(modalShake, { toValue: -6, duration: 50, useNativeDriver: true }),
      Animated.timing(modalShake, { toValue: 6, duration: 50, useNativeDriver: true }),
      Animated.timing(modalShake, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  };

  // Buka Modal Ganti PIN dengan mereset step ke VERIFY_OLD
  const handleOpenChangePinModal = () => {
    setChangePinStep('VERIFY_OLD');
    setChangePinInput('');
    setChangePinNewTemp('');
    setChangePinError('');
    setChangePinModalVisible(true);
  };

  // Tutup Modal Ganti PIN dan bersihkan seluruh state input
  const handleCloseChangePinModal = () => {
    setChangePinModalVisible(false);
    setChangePinInput('');
    setChangePinNewTemp('');
    setChangePinError('');
    setChangePinStep('VERIFY_OLD');
  };

  // Proses validasi internal Step State dalam Modal Ganti PIN
  const processChangePinStep = async (entered: string) => {
    setChangePinError('');

    // STEP 1 (VERIFY_OLD): Masukkan PIN Lama
    if (changePinStep === 'VERIFY_OLD') {
      if (!user) {
        setChangePinError('Sesi akun tidak ditemukan.');
        return;
      }
      // PENTING: Hanya verifikasi PIN lama via verifyCashierPin.
      // JANGAN memanggil unlockPin karena unlockPin akan mengaktifkan isPinUnlocked dan me-redirect ke Dashboard.
      const isValid = await verifyCashierPin(user.id, activeCashierId, entered);
      if (isValid) {
        Vibration.vibrate(50);
        setChangePinInput('');
        setChangePinStep('ENTER_NEW');
      } else {
        doModalShake();
        setChangePinInput('');
        setChangePinError(`PIN lama ${activeProfile.name} salah. Silakan coba lagi.`);
      }
      return;
    }

    // STEP 2 (ENTER_NEW): Masukkan PIN Baru
    if (changePinStep === 'ENTER_NEW') {
      Vibration.vibrate(50);
      setChangePinNewTemp(entered);
      setChangePinInput('');
      setChangePinStep('CONFIRM_NEW');
      return;
    }

    // STEP 3 (CONFIRM_NEW): Konfirmasi PIN Baru & Simpan
    if (changePinStep === 'CONFIRM_NEW') {
      if (entered === changePinNewTemp) {
        setIsSavingChangePin(true);
        try {
          if (user) {
            // PENTING: Gunakan saveCashierPin secara langsung.
            // JANGAN memanggil setupPin karena setupPin akan mengaktifkan isPinUnlocked dan me-redirect ke Dashboard.
            await saveCashierPin(user.id, activeCashierId, entered);
          }
          Vibration.vibrate(80);

          // Tutup modal
          handleCloseChangePinModal();

          // Tampilkan alert sukses tanpa me-redirect halaman
          Alert.alert(
            'PIN Berhasil Diperbarui',
            `PIN keamanan untuk ${activeProfile.name} telah berhasil diperbarui. Silakan gunakan PIN baru Anda untuk masuk.`
          );

          await refreshUserProfile();
        } catch (err: any) {
          setChangePinError(err?.message || 'Gagal memperbarui PIN baru.');
          setChangePinInput('');
        } finally {
          setIsSavingChangePin(false);
        }
      } else {
        doModalShake();
        setChangePinError('Konfirmasi PIN baru tidak cocok. Silakan ulangi input PIN baru.');
        setChangePinInput('');
        setChangePinNewTemp('');
        setChangePinStep('ENTER_NEW');
      }
      return;
    }
  };

  // Handler tombol keypad numerik pada Modal Ganti PIN
  const handleModalNumPress = (val: string) => {
    if (isSavingChangePin) return;
    if (changePinInput.length < PIN_LENGTH) {
      const nextPin = changePinInput + val;
      setChangePinInput(nextPin);
      if (nextPin.length === PIN_LENGTH) {
        processChangePinStep(nextPin);
      }
    }
  };

  const handleModalDeletePress = () => {
    if (isSavingChangePin || changePinInput.length === 0) return;
    setChangePinInput((prev) => prev.slice(0, -1));
  };

  // Timer hitung mundur proteksi lockout
  useEffect(() => {
    let timer: any = null;
    if (locked && lockSec > 0) {
      timer = setInterval(() => {
        setLockSec((prev) => {
          if (prev <= 1) {
            setLocked(false);
            setAttempts(0);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [locked, lockSec]);

  // Selesaikan login dan transisi ke POS
  const finishUnlock = (name: string, isFirstTime: boolean = false) => {
    setWelcomeName(name || ownerName || 'Kasir');
    setWelcomeIsFirstTime(isFirstTime);
    setWelcomeVisible(true);
  };

  const handleWelcomeDismiss = () => {
    setWelcomeVisible(false);
    onLoginSuccess?.(welcomeName || ownerName);
    if (navigation) {
      try {
        if (typeof navigation.replace === 'function') {
          navigation.replace('MainApp');
        } else if (typeof navigation.navigate === 'function') {
          navigation.navigate('Dashboard' as any);
        }
      } catch (_) {}
    }
  };

  // Proses validasi saat 6 digit PIN telah diketik
  const processPin = useCallback(
    async (entered: string) => {
      setErrorMessage('');

      // 1. MODE VERIFIKASI PIN
      if (mode === 'verify') {
        const res = await unlockPin(entered);
        if (res.success) {
          Vibration.vibrate(60);
          setAttempts(0);
          finishUnlock(activeProfile.name, false);
        } else {
          doShake();
          setPin('');
          const nextAttempts = attempts + 1;
          setAttempts(nextAttempts);

          if (nextAttempts >= MAX_ATTEMPTS) {
            setLocked(true);
            setLockSec(30);
            setErrorMessage('Akses terkunci sementara (30 detik) akibat 5x PIN salah.');
          } else {
            setErrorMessage(
              `PIN ${activeProfile.name} salah. Sisa percobaan: ${MAX_ATTEMPTS - nextAttempts}`
            );
          }
        }
        return;
      }

      // 2. MODE BUAT PIN BARU - LANGKAH 1
      if (mode === 'setup_new') {
        setTempPin(entered);
        setPin('');
        setMode('setup_confirm');
        return;
      }

      // 3. MODE BUAT PIN BARU - LANGKAH 2 (KONFIRMASI)
      if (mode === 'setup_confirm') {
        if (entered === tempPin) {
          const res = await setupPin(entered, storeName, ownerName);
          if (res.success) {
            Vibration.vibrate(80);
            await refreshUserProfile();
            finishUnlock(activeProfile.name, true);
          } else {
            setErrorMessage(res.error || 'Gagal menyimpan PIN baru.');
            setPin('');
            setTempPin('');
            setMode('setup_new');
          }
        } else {
          doShake();
          setErrorMessage('Konfirmasi PIN tidak cocok. Silakan ulangi pembuatan PIN.');
          setPin('');
          setTempPin('');
          setMode('setup_new');
        }
        return;
      }

      // 4. MODE GANTI PIN - LANGKAH 1 (INPUT PIN LAMA)
      if (mode === 'change_old') {
        const isValid = user ? await verifyCashierPin(user.id, activeCashierId, entered) : false;
        if (isValid) {
          setPin('');
          setMode('change_new');
        } else {
          doShake();
          setPin('');
          setErrorMessage(`PIN lama ${activeProfile.name} salah.`);
        }
        return;
      }

      // 5. MODE GANTI PIN - LANGKAH 2 (INPUT PIN BARU)
      if (mode === 'change_new') {
        setTempPin(entered);
        setPin('');
        setMode('change_confirm');
        return;
      }

      // 6. MODE GANTI PIN - LANGKAH 3 (KONFIRMASI PIN BARU)
      if (mode === 'change_confirm') {
        if (entered === tempPin) {
          if (user) {
            await saveCashierPin(user.id, activeCashierId, entered);
          }
          Alert.alert('PIN Berhasil Diperbarui', `PIN keamanan ${activeProfile.name} berhasil diperbarui.`);
          setPin('');
          setTempPin('');
          setMode('verify');
          await refreshUserProfile();
        } else {
          doShake();
          Alert.alert('Gagal', 'Konfirmasi PIN baru tidak cocok.');
          setPin('');
          setTempPin('');
          setMode('verify');
        }
        return;
      }
    },
    [mode, attempts, tempPin, activeProfile, storeName, ownerName, unlockPin, setupPin, refreshUserProfile]
  );

  // Penanganan tombol numpad
  const handleNumPress = (val: string) => {
    if (locked) return;
    if (pin.length < PIN_LENGTH) {
      const nextPin = pin + val;
      setPin(nextPin);
      if (nextPin.length === PIN_LENGTH) {
        processPin(nextPin);
      }
    }
  };

  const handleDeletePress = () => {
    if (locked || pin.length === 0) return;
    setPin((prev) => prev.slice(0, -1));
  };

  // Konfirmasi Ganti Akun / Logout Email
  const handleLogoutEmailPress = () => {
    const userEmail = user?.email || 'akun ini';
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.confirm) {
      if (
        window.confirm(
          `Keluar dari sesi ${userEmail}? Anda akan diarahkan ke layar login email.`
        )
      ) {
        logoutEmail(true);
      }
      return;
    }

    Alert.alert(
      'Ganti Akun / Logout Email',
      `Keluar dari sesi ${userEmail}? Sesi akun akan ditutup dan Anda akan kembali ke layar login email.`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Keluar Akun',
          style: 'destructive',
          onPress: () => logoutEmail(true),
        },
      ]
    );
  };

  // Dapatkan Judul dan Deskripsi sesuai Mode
  const getHeaderInfo = () => {
    switch (mode) {
      case 'setup_new':
        return {
          title: `Buat PIN ${activeProfile.name}`,
          subtitle: `Unit Usaha: ${activeProfile.unit} • Buat 6-digit PIN untuk kasir ini.`,
          icon: <KeyRound size={28} color={theme.colors.primary} />,
        };
      case 'setup_confirm':
        return {
          title: `Konfirmasi PIN ${activeProfile.name}`,
          subtitle: 'Ketik ulang 6 digit PIN yang sama untuk memastikan kesesuaian.',
          icon: <ShieldCheck size={28} color={theme.colors.primary} />,
        };
      case 'change_old':
        return {
          title: `PIN Lama ${activeProfile.name}`,
          subtitle: `Verifikasi PIN saat ini sebelum mengganti PIN ${activeProfile.name}.`,
          icon: <Lock size={28} color={theme.colors.primary} />,
        };
      case 'change_new':
        return {
          title: `PIN Baru ${activeProfile.name}`,
          subtitle: `Ketik 6 digit PIN pengganti untuk ${activeProfile.name}.`,
          icon: <KeyRound size={28} color={theme.colors.primary} />,
        };
      case 'change_confirm':
        return {
          title: 'Konfirmasi PIN Pengganti',
          subtitle: 'Ketik ulang PIN baru untuk mengonfirmasi penggantian.',
          icon: <CheckCircle2 size={28} color={theme.colors.primary} />,
        };
      case 'verify':
      default:
        return {
          title: `Buka Kunci ${activeProfile.name}`,
          subtitle: `Unit Usaha: ${activeProfile.unit} • Masukkan 6-digit PIN kasir bertugas.`,
          icon: <Lock size={28} color={theme.colors.primary} />,
        };
    }
  };

  const headerInfo = getHeaderInfo();

  const s = makeStyles(theme, isDark);

  return (
    <SafeAreaView style={s.container} edges={['top', 'left', 'right', 'bottom']}>
      {/* Top Bar */}
      <View style={s.topBar}>
        <View style={s.storeBadge}>
          <Store size={14} color={theme.colors.primary} />
          <Text style={s.storeBadgeText}>{storeName || 'KasirToko POS'}</Text>
        </View>

        <TouchableOpacity
          style={s.themeBtn}
          onPress={toggleTheme}
          activeOpacity={0.7}
          accessibilityLabel="Toggle Theme"
        >
          {isDark ? <Sun size={18} color="#FBBF24" /> : <Moon size={18} color={theme.colors.textSecondary} />}
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={s.scrollContent}
        bounces={false}
        showsVerticalScrollIndicator={false}
      >
        {/* SWITCHER DUAL SUB-PROFIL KASIR */}
        <View style={s.switcherSection}>
          <View style={s.switcherLabelRow}>
            <UserCheck size={12} color={theme.colors.primary} />
            <Text style={s.switcherLabel}>PILIH SUB-PROFIL KASIR BERTUGAS</Text>
          </View>

          <View style={s.cardsRow}>
            {/* Card 1: Kasir 1 - Unit 1 */}
            <TouchableOpacity
              style={[
                s.cashierCard,
                activeCashierId === 'kasir_1' ? s.cashierCardActive : s.cashierCardInactive,
              ]}
              onPress={() => handleSelectCashier('kasir_1')}
              activeOpacity={0.8}
            >
              <View style={s.cardTopRow}>
                <Text style={s.cardEmoji}>{subProfiles?.kasir_1?.avatarEmoji || '🛒'}</Text>
                <View
                  style={[
                    s.statusPill,
                    activeCashierId === 'kasir_1' ? s.statusPillActive : s.statusPillInactive,
                  ]}
                >
                  <Text
                    style={[
                      s.statusPillText,
                      activeCashierId === 'kasir_1' ? s.statusPillTextActive : s.statusPillTextInactive,
                    ]}
                  >
                    {activeCashierId === 'kasir_1' ? '✓ Aktif' : 'Pilih'}
                  </Text>
                </View>
              </View>

              <Text style={s.cardCashierName} numberOfLines={1}>
                {subProfiles?.kasir_1?.name || 'Kasir 1'}
              </Text>

              <View style={s.unitBadge}>
                <Text style={s.unitBadgeText} numberOfLines={1}>
                  {subProfiles?.kasir_1?.unit || 'Unit 1'}
                </Text>
              </View>
            </TouchableOpacity>

            {/* Card 2: Kasir 2 - Unit 2 */}
            <TouchableOpacity
              style={[
                s.cashierCard,
                activeCashierId === 'kasir_2' ? s.cashierCardActive : s.cashierCardInactive,
              ]}
              onPress={() => handleSelectCashier('kasir_2')}
              activeOpacity={0.8}
            >
              <View style={s.cardTopRow}>
                <Text style={s.cardEmoji}>{subProfiles?.kasir_2?.avatarEmoji || '📦'}</Text>
                <View
                  style={[
                    s.statusPill,
                    activeCashierId === 'kasir_2' ? s.statusPillActive : s.statusPillInactive,
                  ]}
                >
                  <Text
                    style={[
                      s.statusPillText,
                      activeCashierId === 'kasir_2' ? s.statusPillTextActive : s.statusPillTextInactive,
                    ]}
                  >
                    {activeCashierId === 'kasir_2' ? '✓ Aktif' : 'Pilih'}
                  </Text>
                </View>
              </View>

              <Text style={s.cardCashierName} numberOfLines={1}>
                {subProfiles?.kasir_2?.name || 'Kasir 2'}
              </Text>

              <View style={s.unitBadge}>
                <Text style={s.unitBadgeText} numberOfLines={1}>
                  {subProfiles?.kasir_2?.unit || 'Unit 2'}
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* Header Deskripsi & Info Akun */}
        <View style={s.headerCenter}>
          <View style={s.iconWrapper}>{headerInfo.icon}</View>
          <Text style={s.titleText}>{headerInfo.title}</Text>

          {user?.email ? (
            <View style={s.accountInfoRow}>
              <User size={13} color={theme.colors.textSecondary} />
              <Text style={s.accountText}>{user.email}</Text>
            </View>
          ) : null}

          <Text style={s.subtitleText}>{headerInfo.subtitle}</Text>

          {/* Indikator 6 Titik PIN */}
          <Animated.View style={[s.dotsRow, { transform: [{ translateX: shake }] }]}>
            {Array.from({ length: PIN_LENGTH }).map((_, i) => (
              <View
                key={i}
                style={[s.dot, i < pin.length && s.dotFilled]}
              />
            ))}
          </Animated.View>

          {/* Pesan Kesalahan */}
          {errorMessage ? <Text style={s.errorText}>{errorMessage}</Text> : null}

          {/* Timer Lockout */}
          {locked ? (
            <View style={s.lockoutBox}>
              <ShieldAlert size={16} color={theme.colors.danger} />
              <Text style={s.lockoutText}>Terkunci: Coba lagi dalam {lockSec} detik</Text>
            </View>
          ) : null}
        </View>

        {/* Numpad Keypad 6-Digit */}
        <View style={s.numpadContainer}>
          <View style={s.numpadRow}>
            {['1', '2', '3'].map((digit) => (
              <TouchableOpacity
                key={digit}
                style={s.numBtn}
                onPress={() => handleNumPress(digit)}
                disabled={locked}
                activeOpacity={0.65}
              >
                <Text style={s.numBtnText}>{digit}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={s.numpadRow}>
            {['4', '5', '6'].map((digit) => (
              <TouchableOpacity
                key={digit}
                style={s.numBtn}
                onPress={() => handleNumPress(digit)}
                disabled={locked}
                activeOpacity={0.65}
              >
                <Text style={s.numBtnText}>{digit}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={s.numpadRow}>
            {['7', '8', '9'].map((digit) => (
              <TouchableOpacity
                key={digit}
                style={s.numBtn}
                onPress={() => handleNumPress(digit)}
                disabled={locked}
                activeOpacity={0.65}
              >
                <Text style={s.numBtnText}>{digit}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={s.numpadRow}>
            {/* Tombol Batal/Ulangi jika sedang setup */}
            {mode === 'setup_confirm' || mode.startsWith('change_') ? (
              <TouchableOpacity
                style={s.numBtn}
                onPress={() => {
                  setPin('');
                  setTempPin('');
                  setMode(hasPinConfigured ? 'verify' : 'setup_new');
                  setErrorMessage('');
                }}
                activeOpacity={0.65}
              >
                <Text style={[s.numBtnText, { fontSize: 14, color: theme.colors.textSecondary }]}>
                  Batal
                </Text>
              </TouchableOpacity>
            ) : (
              <View style={[s.numBtn, { opacity: 0 }]} />
            )}

            <TouchableOpacity
              style={s.numBtn}
              onPress={() => handleNumPress('0')}
              disabled={locked}
              activeOpacity={0.65}
            >
              <Text style={s.numBtnText}>0</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={s.numBtn}
              onPress={handleDeletePress}
              disabled={locked || pin.length === 0}
              activeOpacity={0.65}
            >
              <Delete size={22} color={theme.colors.textPrimary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Aksi Tambahan: Ganti PIN & Ganti Akun / Logout Email */}
        <View style={s.footerActions}>
          {hasPinConfigured && mode === 'verify' ? (
            <TouchableOpacity
              style={s.secondaryBtn}
              onPress={handleOpenChangePinModal}
              activeOpacity={0.7}
            >
              <Text style={s.secondaryBtnText}>Lupa / Ganti PIN?</Text>
            </TouchableOpacity>
          ) : null}

          {/* Tombol Opsi Ganti Akun / Logout Email */}
          <TouchableOpacity
            style={s.logoutBtn}
            onPress={handleLogoutEmailPress}
            activeOpacity={0.75}
          >
            <LogOut size={16} color={theme.colors.danger} />
            <Text style={s.logoutBtnText}>Ganti Akun / Logout Email</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* DIALOG MODAL AUTH & GANTI PIN KASIR */}
      <PinLoginModals
        changePinModalVisible={changePinModalVisible}
        onCloseChangePinModal={handleCloseChangePinModal}
        changePinStep={changePinStep}
        activeProfileName={activeProfile.name}
        changePinInput={changePinInput}
        changePinError={changePinError}
        modalShake={modalShake}
        onModalNumPress={handleModalNumPress}
        onModalDeletePress={handleModalDeletePress}
        pinLength={PIN_LENGTH}
        isSavingChangePin={isSavingChangePin}
        welcomeVisible={welcomeVisible}
        welcomeCashierName={welcomeName || ownerName || 'Kasir'}
        welcomeIsFirstTime={welcomeIsFirstTime}
        onWelcomeDismiss={handleWelcomeDismiss}
        styles={s}
      />
    </SafeAreaView>
  );
};

export default PinLoginScreen;