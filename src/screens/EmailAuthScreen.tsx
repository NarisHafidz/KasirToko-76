import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  CheckCircle,
  Eye,
  EyeOff,
  Lock,
  Mail,
  Moon,
  ShieldCheck,
  Sparkles,
  Store,
  Sun,
  User,
} from 'lucide-react-native';
import { useAuth } from '../config/AuthContext';
import { useTheme } from '../config/ThemeContext';

type AuthMode = 'login' | 'register';

export const EmailAuthScreen: React.FC = () => {
  const { theme, isDark, toggleTheme } = useTheme();
  const { signInWithEmail, signUpWithEmail } = useAuth();

  // Mode awal default selalu 'login' sesuai spesifikasi onboarding
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [storeName, setStoreName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resetForm = (newMode: AuthMode) => {
    setMode(newMode);
    setErrorMessage('');
    setSuccessMessage('');
    setPassword('');
    setConfirmPassword('');
  };

  const handleSubmit = async () => {
    setErrorMessage('');
    setSuccessMessage('');

    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setErrorMessage('Alamat email wajib diisi.');
      return;
    }
    if (!/\S+@\S+\.\S+/.test(cleanEmail)) {
      setErrorMessage('Format email tidak valid (contoh: nama@domain.com).');
      return;
    }

    if (!password) {
      setErrorMessage('Kata sandi wajib diisi.');
      return;
    }
    if (password.length < 6) {
      setErrorMessage('Kata sandi minimal 6 karakter.');
      return;
    }

    if (mode === 'register') {
      if (!storeName.trim()) {
        setErrorMessage('Nama toko / usaha wajib diisi.');
        return;
      }
      if (!ownerName.trim()) {
        setErrorMessage('Nama pemilik / kasir wajib diisi.');
        return;
      }
      if (password !== confirmPassword) {
        setErrorMessage('Konfirmasi kata sandi tidak cocok.');
        return;
      }
    }

    setIsSubmitting(true);

    try {
      if (mode === 'login') {
        const res = await signInWithEmail(cleanEmail, password);
        if (!res.success) {
          setErrorMessage(res.error || 'Gagal masuk akun. Periksa kembali email dan kata sandi.');
        }
      } else {
        // Registrasi Akun Toko Baru ke Supabase Auth
        const res = await signUpWithEmail(
          cleanEmail,
          password,
          storeName.trim(),
          ownerName.trim()
        );

        if (!res.success) {
          setErrorMessage(res.error || 'Pendaftaran gagal diproses.');
        } else {
          // Bersihkan field password
          setPassword('');
          setConfirmPassword('');

          // Penanganan fleksibel respons Supabase Auth (Confirm Email ON vs OFF)
          if (res.needsConfirmation) {
            // JIKA Supabase memerlukan konfirmasi email (Confirm Email ON)
            const infoMsg =
              'Pendaftaran Berhasil! Silakan cek kotak masuk Email Anda dan klik link konfirmasi sebelum melakukan login.';
            setSuccessMessage(infoMsg);

            if (Platform.OS === 'web' && typeof window !== 'undefined' && window.alert) {
              window.alert(infoMsg);
            } else {
              Alert.alert('Pendaftaran Berhasil!', infoMsg, [
                {
                  text: 'Ke Layar Login',
                  onPress: () => { },
                },
              ]);
            }
            // Alihkan pengguna kembali ke Layar Login
            setMode('login');
          } else {
            // JIKA Supabase TIDAK memerlukan konfirmasi email (Confirm Email OFF)
            const successMsg = 'Pendaftaran Berhasil! Silakan masuk menggunakan akun Anda.';
            setSuccessMessage(successMsg);

            if (Platform.OS === 'web' && typeof window !== 'undefined' && window.alert) {
              window.alert(successMsg);
            } else {
              Alert.alert('Pendaftaran Berhasil!', successMsg, [
                {
                  text: 'Masuk Sekarang',
                  onPress: () => { },
                },
              ]);
            }
            // Langsung alihkan pengguna ke Layar Login
            setMode('login');
          }
        }
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Terjadi kesalahan sistem.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const s = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.bgApp,
    },
    topHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingTop: 12,
      paddingBottom: 8,
    },
    themeToggleBtn: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: theme.colors.bgCard,
      borderWidth: 1,
      borderColor: theme.colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    scrollContent: {
      paddingHorizontal: 24,
      paddingTop: 8,
      paddingBottom: 40,
    },
    brandContainer: {
      alignItems: 'center',
      marginBottom: 24,
    },
    logoBox: {
      width: 68,
      height: 68,
      borderRadius: 20,
      backgroundColor: theme.colors.primary + '18',
      borderWidth: 1.5,
      borderColor: theme.colors.primary + '40',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 12,
    },
    brandTitle: {
      fontSize: 26,
      fontWeight: '800',
      color: theme.colors.textPrimary,
      letterSpacing: -0.5,
    },
    brandSubtitle: {
      fontSize: 13,
      color: theme.colors.textSecondary,
      marginTop: 4,
      textAlign: 'center',
    },
    card: {
      backgroundColor: theme.colors.bgCard,
      borderRadius: 20,
      padding: 22,
      borderWidth: 1,
      borderColor: theme.colors.border,
      ...theme.shadow.md,
    },
    cardTitle: {
      fontSize: 20,
      fontWeight: '800',
      color: theme.colors.textPrimary,
      marginBottom: 4,
      letterSpacing: -0.3,
    },
    cardDesc: {
      fontSize: 13,
      color: theme.colors.textSecondary,
      marginBottom: 18,
      lineHeight: 18,
    },
    label: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.colors.textPrimary,
      marginBottom: 6,
      marginTop: 12,
    },
    inputBox: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.bgInput,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 12,
      paddingHorizontal: 12,
      height: 48,
    },
    inputIcon: {
      marginRight: 10,
    },
    textInput: {
      flex: 1,
      fontSize: 14,
      color: theme.colors.textPrimary,
      paddingVertical: 0,
    },
    submitBtn: {
      backgroundColor: theme.colors.primary,
      borderRadius: 14,
      paddingVertical: 14,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 24,
      ...theme.shadow.sm,
    },
    submitBtnText: {
      color: '#FFFFFF',
      fontSize: 15,
      fontWeight: '700',
      letterSpacing: 0.3,
    },
    alertBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: 12,
      padding: 12,
      marginBottom: 16,
    },
    errorBanner: {
      backgroundColor: theme.colors.danger + '18',
      borderWidth: 1,
      borderColor: theme.colors.danger + '40',
    },
    errorText: {
      color: theme.colors.danger,
      fontSize: 13,
      fontWeight: '500',
      flex: 1,
      marginLeft: 8,
    },
    successBanner: {
      backgroundColor: theme.colors.success + '18',
      borderWidth: 1,
      borderColor: theme.colors.success + '40',
    },
    successText: {
      color: theme.colors.success,
      fontSize: 13,
      fontWeight: '500',
      flex: 1,
      marginLeft: 8,
    },
    switchModeBox: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: 24,
      paddingTop: 18,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
      gap: 8,
    },
    switchModeText: {
      fontSize: 13.5,
      color: theme.colors.textSecondary,
      fontWeight: '500',
    },
    switchModeBtn: {
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: 10,
      backgroundColor: theme.colors.primary + '14',
      borderWidth: 1,
      borderColor: theme.colors.primary + '30',
    },
    switchModeHighlight: {
      fontSize: 13.5,
      fontWeight: '700',
      color: theme.colors.primary,
      letterSpacing: 0.2,
    },
    badgeRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 16,
      marginTop: 26,
    },
    badgeItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    badgeText: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.colors.textSecondary,
    },
  });

  return (
    <SafeAreaView style={s.container} edges={['top', 'left', 'right', 'bottom']}>
      {/* Header Bar dengan Toggle Theme */}
      <View style={s.topHeader}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Sparkles size={16} color={theme.colors.primary} />
          <Text style={{ fontSize: 12, fontWeight: '700', color: theme.colors.primary }}>MULTI-TENANT KASIR</Text>
        </View>
        <TouchableOpacity
          style={s.themeToggleBtn}
          onPress={toggleTheme}
          activeOpacity={0.7}
          accessibilityLabel="Toggle Dark / Light Mode"
        >
          {isDark ? <Sun size={18} color="#FBBF24" /> : <Moon size={18} color={theme.colors.textSecondary} />}
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={s.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Logo & Judul Aplikasi */}
          <View style={s.brandContainer}>
            <View style={s.logoBox}>
              <Store size={36} color={theme.colors.primary} />
            </View>
            <Text style={s.brandTitle}>Kasir Toko</Text>
            <Text style={s.brandSubtitle}>
              Sistem Manajemen Kasir & Inventaris Multi-Toko Terisolasi
            </Text>
          </View>

          {/* Kartu Form Input Utama (Login atau Register) */}
          <View style={s.card}>
            <Text style={s.cardTitle}>
              {mode === 'login' ? 'Masuk ke Akun Toko' : 'Daftar Akun Baru'}
            </Text>
            <Text style={s.cardDesc}>
              {mode === 'login'
                ? 'Masukkan email dan kata sandi Anda untuk menyinkronkan kasir.'
                : 'Daftarkan email dan nama toko untuk memulai kasir cloud Anda.'}
            </Text>

            {/* Banner Error */}
            {errorMessage ? (
              <View style={[s.alertBanner, s.errorBanner]}>
                <Lock size={16} color={theme.colors.danger} />
                <Text style={s.errorText}>{errorMessage}</Text>
              </View>
            ) : null}

            {/* Banner Success */}
            {successMessage ? (
              <View style={[s.alertBanner, s.successBanner]}>
                <CheckCircle size={16} color={theme.colors.success} />
                <Text style={s.successText}>{successMessage}</Text>
              </View>
            ) : null}

            {/* Field Khusus Registrasi: Nama Usaha & Pemilik Toko */}
            {mode === 'register' ? (
              <>
                <Text style={s.label}>Nama Usaha / Toko</Text>
                <View style={s.inputBox}>
                  <Store size={18} color={theme.colors.textSecondary} style={s.inputIcon} />
                  <TextInput
                    style={s.textInput}
                    placeholder="Contoh: Toko Berkah 76"
                    placeholderTextColor={theme.colors.textSecondary + '70'}
                    value={storeName}
                    onChangeText={setStoreName}
                    autoCapitalize="words"
                  />
                </View>

                <Text style={s.label}>Nama Pemilik / Kasir Utama</Text>
                <View style={s.inputBox}>
                  <User size={18} color={theme.colors.textSecondary} style={s.inputIcon} />
                  <TextInput
                    style={s.textInput}
                    placeholder="Contoh: Bpk. Ahmad"
                    placeholderTextColor={theme.colors.textSecondary + '70'}
                    value={ownerName}
                    onChangeText={setOwnerName}
                    autoCapitalize="words"
                  />
                </View>
              </>
            ) : null}

            {/* Field Email */}
            <Text style={s.label}>Alamat Email</Text>
            <View style={s.inputBox}>
              <Mail size={18} color={theme.colors.textSecondary} style={s.inputIcon} />
              <TextInput
                style={s.textInput}
                placeholder="nama@gmail.com"
                placeholderTextColor={theme.colors.textSecondary + '70'}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            {/* Field Kata Sandi */}
            <Text style={s.label}>Kata Sandi</Text>
            <View style={s.inputBox}>
              <Lock size={18} color={theme.colors.textSecondary} style={s.inputIcon} />
              <TextInput
                style={s.textInput}
                placeholder="Minimal 6 karakter"
                placeholderTextColor={theme.colors.textSecondary + '70'}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                {showPassword ? (
                  <EyeOff size={18} color={theme.colors.textSecondary} />
                ) : (
                  <Eye size={18} color={theme.colors.textSecondary} />
                )}
              </TouchableOpacity>
            </View>

            {/* Field Konfirmasi Kata Sandi (Khusus Mode Registrasi) */}
            {mode === 'register' ? (
              <>
                <Text style={s.label}>Ulangi Kata Sandi</Text>
                <View style={s.inputBox}>
                  <Lock size={18} color={theme.colors.textSecondary} style={s.inputIcon} />
                  <TextInput
                    style={s.textInput}
                    placeholder="Ketik ulang kata sandi"
                    placeholderTextColor={theme.colors.textSecondary + '70'}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                  />
                </View>
              </>
            ) : null}

            {/* Tombol Eksekusi Submit */}
            <TouchableOpacity
              style={s.submitBtn}
              onPress={handleSubmit}
              disabled={isSubmitting}
              activeOpacity={0.85}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={s.submitBtnText}>
                  {mode === 'login' ? 'Masuk ke Kasir' : 'Daftarkan Akun Toko'}
                </Text>
              )}
            </TouchableOpacity>

            {/* Navigasi Alih Mode: Belum Punya Akun / Sudah Punya Akun */}
            <View style={s.switchModeBox}>
              {mode === 'login' ? (
                <>
                  <Text style={s.switchModeText}>Belum punya akun?</Text>
                  <TouchableOpacity
                    style={s.switchModeBtn}
                    onPress={() => resetForm('register')}
                    activeOpacity={0.7}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Text style={s.switchModeHighlight}>Daftar di sini</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <Text style={s.switchModeText}>Sudah punya akun?</Text>
                  <TouchableOpacity
                    style={s.switchModeBtn}
                    onPress={() => resetForm('login')}
                    activeOpacity={0.7}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Text style={s.switchModeHighlight}>Masuk di sini</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>

          {/* Badges Keamanan Resmi */}
          <View style={s.badgeRow}>
            <View style={s.badgeItem}>
              <ShieldCheck size={16} color={theme.colors.primary} />
              <Text style={s.badgeText}>Enkripsi Keamanan Sesi</Text>
            </View>
            <View style={s.badgeItem}>
              <CheckCircle size={16} color={theme.colors.primary} />
              <Text style={s.badgeText}>Data Toko Terisolasi Aman</Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default EmailAuthScreen;
