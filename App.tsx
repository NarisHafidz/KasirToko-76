import React, { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from './src/config/AuthContext';
import { ThemeProvider, useTheme } from './src/config/ThemeContext';
import { AppNavigator } from './src/navigation/AppNavigator';
import { EmailAuthScreen } from './src/screens/EmailAuthScreen';
import { PinLoginScreen } from './src/screens/PinLoginScreen';
import { startAutoSyncListener } from './src/services/syncService';

/**
 * Komponen Gateway Autentikasi Multi-Tenant Aplikasi (AppContent)
 * 
 * ALUR AUTENTIKASI MULTI-TENANT PROFESIONAL:
 * 1. Layer 1 (Supabase Auth): Memeriksa sesi login email & password.
 *    - Jika belum login email: Tampilkan EmailAuthScreen (Register / Login Email Supabase).
 * 2. Layer 2 (Security PIN Gate): Memeriksa verifikasi PIN 6-digit terikat user_id.
 *    - Jika belum verifikasi PIN: Tampilkan PinLoginScreen (Buat PIN baru jika baru daftar, atau verifikasi PIN).
 *    - Session Supabase persistent: Saat aplikasi ditutup dan dibuka lagi, user tidak perlu login email,
 *      melainkan langsung diarahkan ke verifikasi PIN 6-digit.
 * 3. Layer 3 (Operational POS): Masuk ke antarmuka utama toko (AppNavigator).
 */
const AppContent: React.FC = () => {
  const { theme, isDark } = useTheme();
  const { hasSupabaseSession, isPinUnlocked, isLoading, login } = useAuth();

  // Inisialisasi auto-sync listener di background saat aplikasi berjalan
  useEffect(() => {
    const unsubscribe = startAutoSyncListener();
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  // Tampilan loading sementara saat aplikasi membaca status sesi persistent dari AsyncStorage
  if (isLoading) {
    return (
      <View style={[styles.fill, styles.center, { backgroundColor: theme.colors.bgApp }]}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  // 1. Pintu Utama: Layar Registrasi & Login Email Supabase Auth
  if (!hasSupabaseSession) {
    return (
      <View style={[styles.fill, { backgroundColor: theme.colors.bgApp }]}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <EmailAuthScreen />
      </View>
    );
  }

  // 2. Gerbang PIN 6-Digit: Pembuatan PIN (user baru) atau Verifikasi PIN untuk membuka Kasir
  if (!isPinUnlocked) {
    return (
      <View style={[styles.fill, { backgroundColor: theme.colors.bgApp }]}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <PinLoginScreen onLoginSuccess={(name) => login(name)} />
      </View>
    );
  }

  // 3. Layar Utama Toko: Seluruh Tab Operasional Kasir (Dashboard, POS, Produk, Laporan)
  return (
    <View style={[styles.fill, { backgroundColor: theme.colors.bgApp }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <AppNavigator />
    </View>
  );
};

/**
 * Komponen Induk Aplikasi (Root App)
 */
export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});
