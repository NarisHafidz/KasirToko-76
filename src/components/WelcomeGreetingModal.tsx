import React, { useCallback, useEffect, useRef } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  Modal,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { CheckCircle2, ShieldCheck, Sparkles, Store } from 'lucide-react-native';
import { useTheme } from '../config/ThemeContext';
import { AppTheme } from '../config/theme';

const { width: SW, height: SH } = Dimensions.get('window');

/**
 * Properti Komponen WelcomeGreetingModal
 */
interface WelcomeGreetingModalProps {
  /** Kontrol visibilitas modal */
  visible: boolean;
  /** Nama pemilik atau kasir yang baru disimpan */
  cashierName: string;
  /** Menandakan apakah ini setup registrasi awal (true) atau sekadar update nama dari dashboard (false) */
  isFirstTime?: boolean;
  /** Callback yang dipanggil setelah animasi selesai atau saat layar diketuk */
  onDismiss: () => void;
}

/**
 * Komponen Modal Animasi Full Screen "Welcome / Hello Screen" (Ala iOS Setup)
 * 
 * FUNGSI UTAMA:
 * 1. Memberikan efek visual 'Wow' saat kasir pertama kali mendaftar atau setelah mengubah nama pemilik.
 * 2. Tampilan Full Screen menyesuaikan tema aktif (Dark Mode / Light Mode).
 * 3. Animasi Terpadu:
 *    - Fade-in (opacity 0 -> 1)
 *    - Zoom-in halus (scale 0.85 -> 1.0) selama 800ms dengan easing cubic-out.
 *    - Ikon badge dengan efek spring pop-up dan partikel bintang bersinar.
 * 4. Teks Sapaan Dinamis:
 *    - "Selamat Datang!"
 *    - "Halo, [Nama Pemilik]" (contoh: "Halo, Didik Sulistiyo")
 *    - "Sistem Kasir Siap Digunakan"
 * 5. Timer Otomatis: Tampil selama 2.8 detik, kemudian fade-out halus dan mengeksekusi onDismiss().
 */
export const WelcomeGreetingModal: React.FC<WelcomeGreetingModalProps> = ({
  visible,
  cashierName,
  isFirstTime = true,
  onDismiss,
}) => {
  const { theme, isDark } = useTheme();

  // NILAI ANIMATED REACT NATIVE
  /** Opacity keseluruhan layar modal (untuk transisi fade-in & fade-out) */
  const containerOpacity = useRef(new Animated.Value(0)).current;
  /** Skala zoom-in kartu konten (0.85 -> 1.0) */
  const contentScale = useRef(new Animated.Value(0.85)).current;
  /** Skala ikon utama badge (0 -> 1) */
  const iconScale = useRef(new Animated.Value(0)).current;
  /** Opacity dekorasi bintang/kilau */
  const sparklesOpacity = useRef(new Animated.Value(0)).current;

  /**
   * Menjalankan Animasi Masuk (Fade-In & Zoom-In 800ms)
   */
  const runEntranceAnimation = useCallback(() => {
    // Reset posisi awal
    containerOpacity.setValue(0);
    contentScale.setValue(0.85);
    iconScale.setValue(0);
    sparklesOpacity.setValue(0);

    Animated.parallel([
      // 1. Fade-in layar penuh
      Animated.timing(containerOpacity, {
        toValue: 1,
        duration: 800,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      // 2. Zoom-in halus konten utama (0.85 -> 1.0)
      Animated.timing(contentScale, {
        toValue: 1,
        duration: 800,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(() => {
      // 3. Pop-up ikon badge di tengah
      Animated.spring(iconScale, {
        toValue: 1,
        tension: 90,
        friction: 6,
        useNativeDriver: true,
      }).start(() => {
        // 4. Munculkan partikel bintang
        Animated.timing(sparklesOpacity, {
          toValue: 1,
          duration: 350,
          useNativeDriver: true,
        }).start();
      });
    });
  }, [containerOpacity, contentScale, iconScale, sparklesOpacity]);

  /**
   * Menjalankan Animasi Keluar (Fade-Out) sebelum menutup modal
   */
  const handleExitAnimation = useCallback(() => {
    Animated.parallel([
      Animated.timing(containerOpacity, {
        toValue: 0,
        duration: 400,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(contentScale, {
        toValue: 0.95,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onDismiss();
    });
  }, [containerOpacity, contentScale, onDismiss]);

  /**
   * USE EFFECT: Memulai animasi saat modal dibuka dan mengatur timer 2.8 detik
   */
  useEffect(() => {
    if (visible) {
      runEntranceAnimation();
      // Timer otomatis 2.8 detik untuk auto-dismiss
      const autoTimer = setTimeout(() => {
        handleExitAnimation();
      }, 2800);

      return () => clearTimeout(autoTimer);
    }
  }, [visible, runEntranceAnimation, handleExitAnimation]);

  const s = makeStyles(theme, isDark);
  const displayName = cashierName.trim() || 'Pemilik Toko';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={handleExitAnimation}
    >
      <TouchableOpacity
        style={s.fullScreenContainer}
        activeOpacity={1}
        onPress={handleExitAnimation}
      >
        <Animated.View
          style={[
            s.contentWrapper,
            {
              opacity: containerOpacity,
              transform: [{ scale: contentScale }],
            },
          ]}
        >
          {/* Efek Bintang & Kilau Dekoratif */}
          <Animated.View style={[s.sparklesContainer, { opacity: sparklesOpacity }]}>
            <Sparkles size={24} color={theme.colors.warning || '#F59E0B'} />
            <Text style={s.badgePillText}>
              {isFirstTime ? 'Sistem Kasir Baru Dikonfigurasi' : 'Profil Pemilik Diperbarui'}
            </Text>
            <Sparkles size={24} color={theme.colors.warning || '#F59E0B'} />
          </Animated.View>

          {/* Ikon Utama Badge (Toko / Shield) */}
          <Animated.View
            style={[
              s.iconCircle,
              {
                transform: [{ scale: iconScale }],
              },
            ]}
          >
            {isFirstTime ? (
              <Store size={52} color="#FFFFFF" strokeWidth={1.8} />
            ) : (
              <CheckCircle2 size={52} color="#FFFFFF" strokeWidth={1.8} />
            )}
          </Animated.View>

          {/* Teks Sapaan Dinamis */}
          <Text style={s.welcomeTitle}>
            {isFirstTime ? 'Selamat Datang!' : 'Pembaruan Berhasil!'}
          </Text>

          <Text style={s.ownerNameText}>Halo, {displayName}</Text>

          <Text style={s.readySubtitle}>Sistem Kasir Siap Digunakan</Text>

          <Text style={s.descriptionText}>
            {isFirstTime
              ? 'Data toko Anda telah tersimpan dengan aman di perangkat. Transaksi kasir siap dijalankan secara offline maupun online.'
              : 'Identitas kasir aktif telah berhasil disesuaikan. Riwayat transaksi Anda tetap aman dan utuh.'}
          </Text>

          {/* Petunjuk Ketuk Layar */}
          <View style={s.touchPrompt}>
            <Text style={s.touchPromptText}>Menuju ke Dashboard...</Text>
          </View>
        </Animated.View>
      </TouchableOpacity>
    </Modal>
  );
};

/**
 * GENERATOR STYLESHEET DINAMIS
 */
const makeStyles = (theme: AppTheme, isDark: boolean) =>
  StyleSheet.create({
    fullScreenContainer: {
      flex: 1,
      width: SW,
      height: SH,
      backgroundColor: theme.colors.bgApp,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 28,
    },
    contentWrapper: {
      width: '100%',
      maxWidth: 420,
      alignItems: 'center',
      paddingVertical: 24,
    },
    sparklesContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: isDark ? 'rgba(245, 158, 11, 0.15)' : '#FEF3C7',
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 999,
      marginBottom: 32,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(245, 158, 11, 0.3)' : '#FDE68A',
    },
    badgePillText: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.colors.warning || '#D97706',
      letterSpacing: 0.2,
    },
    iconCircle: {
      width: 110,
      height: 110,
      borderRadius: 36,
      backgroundColor: theme.colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 28,
      elevation: 8,
      shadowColor: theme.colors.primary,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.35,
      shadowRadius: 16,
    },
    welcomeTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: theme.colors.textSecondary,
      textAlign: 'center',
      letterSpacing: 0.5,
      textTransform: 'uppercase',
    },
    ownerNameText: {
      fontSize: 32,
      fontWeight: '900',
      color: theme.colors.textPrimary,
      textAlign: 'center',
      marginTop: 8,
      marginBottom: 6,
      letterSpacing: -0.5,
    },
    readySubtitle: {
      fontSize: 18,
      fontWeight: '800',
      color: theme.colors.success || '#10B981',
      textAlign: 'center',
      marginBottom: 16,
      letterSpacing: -0.2,
    },
    descriptionText: {
      fontSize: 14,
      color: theme.colors.textMuted,
      textAlign: 'center',
      lineHeight: 22,
      maxWidth: 320,
      marginBottom: 36,
    },
    touchPrompt: {
      paddingHorizontal: 20,
      paddingVertical: 10,
      borderRadius: 999,
      backgroundColor: theme.colors.bgCard,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    touchPromptText: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.colors.textMuted,
      letterSpacing: 0.3,
    },
  });

export default WelcomeGreetingModal;
