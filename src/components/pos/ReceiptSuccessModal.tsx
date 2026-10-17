import React from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { CheckCircle2, Share2 } from 'lucide-react-native';
import { useTheme } from '../../config/ThemeContext';
import { formatDailyReceiptNumber, formatRupiah } from '../../services/transactionService';
import { Transaction, TransactionItem } from '../../types/database';

/**
 * Antarmuka Properti Komponen ReceiptSuccessModal
 */
interface ReceiptSuccessModalProps {
  /** Visibilitas modal dialog struk nota */
  visible: boolean;
  /** Data lengkap transaksi dan daftar item barang yang berhasil diproses */
  transactionData: {
    transaction: Transaction;
    items: TransactionItem[];
    isOffline: boolean;
  } | null;
  /** Menandakan apakah nomor telepon WhatsApp pelanggan telah diinput */
  hasCustomerPhone: boolean;
  /** Callback untuk membuka aplikasi WhatsApp dan mengirimkan struk digital */
  onShareWhatsApp: () => void;
  /** Callback untuk menutup modal dan memulai transaksi kasir baru */
  onNewTransaction: () => void;
}

/**
 * Komponen Modal Struk Transaksi Berhasil (ReceiptSuccessModal)
 * 
 * FUNGSI UTAMA:
 * 1. Memberikan umpan balik visual bahwa transaksi kasir berhasil dicatat.
 * 2. Menampilkan nomor struk harian (#0001) yang tercetak jelas di header struk.
 * 3. Menampilkan kode transaksi, total pembayaran, uang diterima, dan kembalian tunai.
 * 4. Notifikasi Status Offline: Menampilkan badge kuning jika transaksi disimpan di antrean offline lokal.
 * 5. Pengiriman Struk Digital WhatsApp: Membagikan format teks struk belanja resmi ke nomor pelanggan.
 * 6. Tombol Transaksi Baru: Mereset layar untuk melayani pelanggan berikutnya.
 */
export const ReceiptSuccessModal: React.FC<ReceiptSuccessModalProps> = ({
  visible,
  transactionData,
  hasCustomerPhone,
  onShareWhatsApp,
  onNewTransaction,
}) => {
  const { theme } = useTheme();
  const dailyReceiptNumber = formatDailyReceiptNumber(transactionData?.transaction);

  const styles = StyleSheet.create({
    modalOverlayCenter: {
      flex: 1,
      backgroundColor: theme.colors.overlay,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
    },
    receiptCard: {
      width: '100%',
      backgroundColor: theme.colors.bgCard,
      borderRadius: theme.radius.xl,
      padding: 24,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.colors.border,
      ...theme.shadow.lg,
    },
    receiptIconSuccess: {
      width: 76,
      height: 76,
      borderRadius: 38,
      backgroundColor: theme.colors.successLight,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 12,
    },
    receiptSuccessTitle: {
      color: theme.colors.textPrimary,
      fontSize: 22,
      fontWeight: '800',
    },
    dailyReceiptHeader: {
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.primaryLight,
      borderWidth: 1.5,
      borderColor: theme.colors.primary + '35',
      borderRadius: theme.radius.lg,
      paddingVertical: 8,
      paddingHorizontal: 22,
      marginTop: 10,
      marginBottom: 6,
    },
    dailyReceiptBadgeLabel: {
      color: theme.colors.textSecondary,
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 1.5,
      textTransform: 'uppercase',
      marginBottom: 2,
    },
    dailyReceiptNumber: {
      color: theme.colors.primary,
      fontSize: 32,
      fontWeight: '900',
      letterSpacing: 1,
    },
    receiptSuccessCode: {
      color: theme.colors.textMuted,
      fontSize: 13,
      marginTop: 2,
      marginBottom: 14,
    },
    offlineNoticeBadge: {
      backgroundColor: theme.colors.warningLight,
      paddingHorizontal: 14,
      paddingVertical: 7,
      borderRadius: theme.radius.sm,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: theme.colors.warning + '40',
    },
    offlineNoticeText: {
      color: theme.colors.warning,
      fontSize: 11,
      textAlign: 'center',
      fontWeight: '600',
    },
    receiptDetailsBox: {
      width: '100%',
      backgroundColor: theme.colors.bgInput,
      borderRadius: theme.radius.md,
      padding: 14,
      gap: 10,
      marginBottom: 20,
    },
    receiptRow: { flexDirection: 'row', justifyContent: 'space-between' },
    receiptLabel: { color: theme.colors.textSecondary, fontSize: 13 },
    receiptValue: { color: theme.colors.textPrimary, fontSize: 13, fontWeight: '700' },
    receiptActionGroup: { width: '100%', gap: 10 },
    shareWaBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: '#25D366', // Warna resmi WhatsApp
      paddingVertical: 15,
      borderRadius: theme.radius.md,
    },
    shareWaText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
    newTxBtn: {
      backgroundColor: theme.colors.primary,
      paddingVertical: 15,
      borderRadius: theme.radius.md,
      alignItems: 'center',
    },
    newTxText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
  });

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onNewTransaction}>
      <View style={styles.modalOverlayCenter}>
        <View style={styles.receiptCard}>
          {/* Ikon Sukses */}
          <View style={styles.receiptIconSuccess}>
            <CheckCircle2 size={46} color={theme.colors.success} />
          </View>
          <Text style={styles.receiptSuccessTitle}>Transaksi Berhasil!</Text>

          {/* Nomor Struk Harian Tercetak Jelas di Bagian Header (#0001) */}
          <View style={styles.dailyReceiptHeader}>
            <Text style={styles.dailyReceiptBadgeLabel}>NO. STRUK HARIAN</Text>
            <Text style={styles.dailyReceiptNumber}>{dailyReceiptNumber}</Text>
          </View>

          <Text style={styles.receiptSuccessCode}>
            {transactionData?.transaction.transaction_code}
          </Text>

          {/* Notifikasi Penyimpanan Antrean Offline */}
          {transactionData?.isOffline && (
            <View style={styles.offlineNoticeBadge}>
              <Text style={styles.offlineNoticeText}>
                Tersimpan di Antrean Offline — akan otomatis disinkron saat online.
              </Text>
            </View>
          )}

          {/* Rincian Finansial Transaksi */}
          <View style={styles.receiptDetailsBox}>
            <View style={styles.receiptRow}>
              <Text style={styles.receiptLabel}>No. Struk</Text>
              <Text style={[styles.receiptValue, { color: theme.colors.primary, fontWeight: '800' }]}>
                {dailyReceiptNumber}
              </Text>
            </View>
            <View style={styles.receiptRow}>
              <Text style={styles.receiptLabel}>Total Pembayaran</Text>
              <Text style={styles.receiptValue}>
                {formatRupiah(transactionData?.transaction.total_amount || 0)}
              </Text>
            </View>
            <View style={styles.receiptRow}>
              <Text style={styles.receiptLabel}>Uang Diterima</Text>
              <Text style={styles.receiptValue}>
                {formatRupiah(transactionData?.transaction.cash_paid || 0)}
              </Text>
            </View>
            <View style={styles.receiptRow}>
              <Text style={[styles.receiptLabel, { fontWeight: '700' }]}>Kembalian</Text>
              <Text style={[styles.receiptValue, { color: theme.colors.success }]}>
                {formatRupiah(transactionData?.transaction.change_given || 0)}
              </Text>
            </View>
          </View>

          {/* Grup Tombol Aksi: Kirim WhatsApp & Transaksi Baru */}
          <View style={styles.receiptActionGroup}>
            {hasCustomerPhone && (
              <TouchableOpacity
                style={styles.shareWaBtn}
                onPress={onShareWhatsApp}
                activeOpacity={0.8}
                accessibilityLabel="Kirim Struk ke WhatsApp"
              >
                <Share2 size={18} color="#FFFFFF" />
                <Text style={styles.shareWaText}>Kirim Struk ke WhatsApp</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.newTxBtn}
              onPress={onNewTransaction}
              activeOpacity={0.8}
              accessibilityLabel="Mulai Transaksi Baru"
            >
              <Text style={styles.newTxText}>Transaksi Baru</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default ReceiptSuccessModal;
