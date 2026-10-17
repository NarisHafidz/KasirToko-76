import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LogOut } from 'lucide-react-native';
import { useAuth } from '../config/AuthContext';
import { useTheme } from '../config/ThemeContext';
import { NetworkBadge } from './NetworkBadge';

/**
 * Antarmuka Properti untuk Komponen Header
 */
interface HeaderProps {
  /** Judul utama halaman (contoh: "Ringkasan Toko", "Kasir POS") */
  title: string;
  /** Subjudul keterangan singkat di bawah judul (opsional) */
  subtitle?: string;
  /** Menampilkan badge status jaringan online/offline (default: true) */
  showNetworkBadge?: boolean;
  /** Menampilkan tombol Log Out kasir di header (opsional, default: false) */
  showLogout?: boolean;
  /** Callback khusus ketika tombol Log Out ditekan (opsional, jika tidak diisi menggunakan default useAuth().logout()) */
  onLogout?: () => void;
  /** Elemen aksi kustom di sisi kanan header (misal: tombol Scan, Refresh, Toggle Theme) */
  rightAction?: React.ReactNode;
}

/**
 * Komponen Header Aplikasi Kasir POS
 * 
 * FUNGSI UTAMA:
 * Menampilkan bar navigasi atas yang konsisten di semua layar,
 * menginformasikan status konektivitas internet (online/offline antrean),
 * dan menyediakan akses cepat untuk aksi global seperti Log Out kasir.
 */
export const Header: React.FC<HeaderProps> = ({
  title,
  subtitle,
  showNetworkBadge = true,
  showLogout = false,
  onLogout,
  rightAction,
}) => {
  const { theme } = useTheme();
  const { logout } = useAuth();

  /**
   * Menangani penekanan tombol Log Out di Header
   */
  const handleLogoutPress = () => {
    if (onLogout) {
      onLogout();
    } else {
      logout();
    }
  };

  const styles = StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingTop: 14,
      paddingBottom: 14,
      backgroundColor: theme.colors.headerBg,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
      ...theme.shadow.sm,
    },
    titleContainer: {
      flex: 1,
      flexShrink: 1,
      marginRight: 8,
    },
    title: {
      fontSize: 20,
      fontWeight: '800',
      color: theme.colors.headerText,
      letterSpacing: -0.5,
      flexShrink: 1,
    },
    subtitle: {
      fontSize: 12,
      fontWeight: '500',
      color: theme.colors.headerSubText,
      marginTop: 2,
      flexShrink: 1,
    },
    rightContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    logoutBtn: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: theme.colors.bgCard,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: theme.colors.danger + '35' || '#FCA5A5',
    },
  });

  return (
    <View style={styles.container}>
      {/* Kolom Kiri: Judul dan Subjudul Halaman */}
      <View style={styles.titleContainer}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>

      {/* Kolom Kanan: Status Jaringan, Aksi Tambahan, dan Tombol Log Out */}
      <View style={styles.rightContainer}>
        {showNetworkBadge && <NetworkBadge />}
        {rightAction}
        {showLogout && (
          <TouchableOpacity
            style={styles.logoutBtn}
            onPress={handleLogoutPress}
            activeOpacity={0.75}
            accessibilityLabel="Tombol Keluar Sesi Kasir"
          >
            <LogOut size={17} color={theme.colors.danger || '#EF4444'} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

export default Header;
