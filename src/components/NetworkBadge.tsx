import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { RefreshCw, Wifi, WifiOff } from 'lucide-react-native';
import { useTheme } from '../config/ThemeContext';
import {
  addSyncStatusListener,
  checkInternetConnection,
  getPendingQueueCount,
  syncOfflineTransactions,
} from '../services/syncService';

/**
 * Antarmuka Properti Komponen NetworkBadge
 */
interface NetworkBadgeProps {
  /** Callback yang dipanggil saat proses sinkronisasi manual berhasil diselesaikan */
  onSyncComplete?: () => void;
}

/**
 * Komponen Indikator Jaringan & Status Antrean Offline (NetworkBadge)
 * 
 * FUNGSI UTAMA:
 * 1. Menampilkan status konektivitas internet kasir (Online vs Offline) secara periodik (setiap 5 detik).
 * 2. Menginformasikan jumlah transaksi offline yang masih tersimpan di antrean perangkat.
 * 3. Menjadi tombol pintas interaktif: Jika kasir mengetuk badge saat ada antrean dan internet tersedia,
 *    sistem akan langsung menjalankan sinkronisasi antrean ke cloud Supabase.
 * 4. Umpan balik warna intuitif:
 *    - Hijau: Online & seluruh data telah tersinkron.
 *    - Kuning/Oranye: Online namun ada transaksi yang menunggu disinkronkan.
 *    - Merah: Offline (koneksi internet terputus, transaksi dialihkan ke penyimpanan lokal).
 */
export const NetworkBadge: React.FC<NetworkBadgeProps> = ({ onSyncComplete }) => {
  const { theme } = useTheme();

  // STATE MANAGEMENT
  /** Status koneksi internet saat ini */
  const [isOnline, setIsOnline] = useState<boolean>(true);
  /** Jumlah transaksi yang belum terunggah ke database cloud */
  const [pendingCount, setPendingCount] = useState<number>(0);
  /** Indikator loading saat proses pengunggahan antrean sedang berlangsung */
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  /**
   * MEMERIKSA STATUS KONEKSI & ANTREAN
   * Melakukan uji koneksi internet ringan dan menghitung transaksi offline yang pending.
   */
  const checkStatus = async () => {
    const online = await checkInternetConnection();
    setIsOnline(online);
    const count = await getPendingQueueCount();
    setPendingCount(count);
  };

  /**
   * USE EFFECT: Polling & Event Listener Status Jaringan dan Sinkronisasi
   * Memperbarui status secara instan via listener broadcast syncService dan fallback polling 5000ms.
   */
  useEffect(() => {
    checkStatus();
    const unsubscribe = addSyncStatusListener((status) => {
      setIsOnline(status.isOnline);
      setPendingCount(status.pendingCount);
    });
    const interval = setInterval(checkStatus, 5000);
    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, []);

  /**
   * HANDLER KETUKAN BADGE JARINGAN
   * Jika ada antrean dan koneksi online tersedia, memicu sinkronisasi transaksi offline secara manual.
   */
  const handlePress = async () => {
    if (pendingCount > 0 && isOnline && !isSyncing) {
      setIsSyncing(true);
      await syncOfflineTransactions();
      await checkStatus();
      setIsSyncing(false);
      if (onSyncComplete) onSyncComplete();
    } else {
      checkStatus();
    }
  };

  // WARNA LATAR BELAKANG DINAMIS
  const containerColor = isOnline
    ? pendingCount > 0
      ? theme.colors.warningLight
      : theme.colors.successLight
    : theme.colors.dangerLight;

  // WARNA BORDER DINAMIS
  const borderColor = isOnline
    ? pendingCount > 0
      ? 'rgba(217,119,6,0.35)'
      : 'rgba(5,150,105,0.35)'
    : 'rgba(220,38,38,0.35)';

  const styles = StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: theme.radius.full,
      borderWidth: 1,
      gap: 5,
      backgroundColor: containerColor,
      borderColor: borderColor,
    },
    dot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: isOnline
        ? pendingCount > 0
          ? theme.colors.warning
          : theme.colors.success
        : theme.colors.danger,
    },
    text: {
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 0.3,
      color: isOnline
        ? pendingCount > 0
          ? theme.colors.warning
          : theme.colors.success
        : theme.colors.warning,
    },
  });

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={handlePress}
      style={styles.container}
      accessibilityLabel="Status Jaringan dan Sinkronisasi"
    >
      <View style={styles.dot} />
      {isOnline ? (
        pendingCount > 0 ? (
          <>
            <Wifi size={13} color={theme.colors.warning} />
            <Text style={styles.text}>
              {isSyncing ? 'Menyinkronkan...' : `${pendingCount} Antrean`}
            </Text>
            {isSyncing && <RefreshCw size={11} color={theme.colors.warning} />}
          </>
        ) : (
          <>
            <Wifi size={13} color={theme.colors.success} />
            <Text style={styles.text}>Online</Text>
          </>
        )
      ) : (
        <>
          <WifiOff size={13} color={theme.colors.warning} />
          <Text style={styles.text}>
            Offline {pendingCount > 0 ? `(${pendingCount})` : ''}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
};

export default NetworkBadge;
