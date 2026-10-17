import React from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { QrCode, Wallet, X } from 'lucide-react-native';
import { useTheme } from '../../config/ThemeContext';
import { formatRupiah } from '../../services/transactionService';
import { PaymentMethod } from '../../types/database';

/**
 * Pilihan nominal pecahan uang cepat (Quick Cash Denominations)
 * Memudahkan kasir memilih uang lembaran yang sering digunakan pelanggan Indonesia.
 */
const QUICK_CASH_DENOMINATIONS = [10000, 20000, 50000, 100000];

/**
 * Antarmuka Properti Komponen CheckoutModal
 */
interface CheckoutModalProps {
  /** Visibilitas modal dialog pembayaran */
  visible: boolean;
  /** Total tagihan belanja dalam Rupiah */
  totalPrice: number;
  /** Total jumlah kuantitas barang belanja */
  totalQuantity: number;
  /** Metode pembayaran aktif ('cash' atau 'qris') */
  paymentMethod: PaymentMethod;
  /** Callback untuk mengubah metode pembayaran */
  onPaymentMethodChange: (method: PaymentMethod) => void;
  /** Teks string nominal uang tunai yang diinput */
  cashPaidText: string;
  /** Callback untuk memperbarui teks nominal uang tunai */
  onCashPaidTextChange: (text: string) => void;
  /** Nomor telepon WhatsApp pelanggan untuk struk digital */
  customerPhone: string;
  /** Callback untuk memperbarui nomor telepon pelanggan */
  onCustomerPhoneChange: (phone: string) => void;
  /** Status indikator saat transaksi sedang dikirim ke database */
  isProcessing: boolean;
  /** Callback untuk menutup modal checkout */
  onClose: () => void;
  /** Callback untuk mengeksekusi konfirmasi akhir checkout */
  onConfirmCheckout: () => void;
}

/**
 * Komponen Modal Formulir Pembayaran Kasir (CheckoutModal)
 * 
 * FUNGSI UTAMA:
 * 1. Pemilihan Metode Pembayaran: Tunai (Cash) atau Non-Tunai (QRIS Dinamis).
 * 2. Kalkulasi Otomatis Uang Kembalian: Menghitung selisih uang tunai yang diterima dengan total belanja.
 * 3. Tombol Cepat Pecahan Uang: Tombol Uang Pas, Rp 10.000, Rp 20.000, Rp 50.000, dan Rp 100.000.
 * 4. Peringatan Uang Kurang: Memblokir tombol simpan jika uang tunai yang diberikan pelanggan belum mencukupi.
 * 5. Tampilan QRIS Standar: Menghasilkan barcode QRIS dengan label total tagihan belanja.
 * 6. Input Nomor WhatsApp: Menyimpan nomor pelanggan untuk pengiriman nota digital.
 */
export const CheckoutModal: React.FC<CheckoutModalProps> = ({
  visible,
  totalPrice,
  totalQuantity,
  paymentMethod,
  onPaymentMethodChange,
  cashPaidText,
  onCashPaidTextChange,
  customerPhone,
  onCustomerPhoneChange,
  isProcessing,
  onClose,
  onConfirmCheckout,
}) => {
  const { theme, isDark } = useTheme();

  // KALKULASI FINANSIAL TUNAI
  // Konversi input string ke nilai angka numerik murni
  const cashPaidNumeric = parseInt(cashPaidText.replace(/[^0-9]/g, ''), 10) || 0;
  // Menghitung uang kembalian (jika uang tunai lebih besar dari total tagihan)
  const changeGiven = Math.max(0, cashPaidNumeric - totalPrice);
  // Status apakah uang yang dibayarkan kurang dari total belanja
  const isCashShort = paymentMethod === 'cash' && cashPaidNumeric < totalPrice;

  const styles = StyleSheet.create({
    modalOverlay: {
      flex: 1,
      backgroundColor: theme.colors.overlay,
      justifyContent: 'flex-end',
    },
    checkoutSheet: {
      backgroundColor: theme.colors.bgCard,
      borderTopLeftRadius: theme.radius.xl,
      borderTopRightRadius: theme.radius.xl,
      padding: 20,
      maxHeight: '92%',
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
    },
    sheetHandle: {
      width: 40,
      height: 4,
      backgroundColor: theme.colors.border,
      borderRadius: 2,
      alignSelf: 'center',
      marginBottom: 16,
    },
    sheetHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
      paddingBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    sheetTitle: { color: theme.colors.textPrimary, fontSize: 18, fontWeight: '800' },
    sheetSubtitle: { color: theme.colors.textMuted, fontSize: 12, marginTop: 2 },
    sheetCloseBtn: { padding: 6 },
    sectionLabel: {
      color: theme.colors.textSecondary,
      fontSize: 11,
      fontWeight: '700',
      marginTop: 16,
      marginBottom: 8,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
    },
    paymentMethodRow: { flexDirection: 'row', gap: 12 },
    paymentMethodBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: theme.colors.bgInput,
      paddingVertical: 14,
      borderRadius: theme.radius.md,
      borderWidth: 1.5,
      borderColor: theme.colors.border,
    },
    paymentMethodBtnActive: {
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.primary,
    },
    paymentMethodText: { color: theme.colors.textSecondary, fontWeight: '600', fontSize: 13 },
    paymentMethodTextActive: { color: '#FFFFFF', fontWeight: '700' },
    cashInputBox: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#F3F4F6',
      borderRadius: 14,
      paddingHorizontal: 16,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : '#E5E7EB',
    },
    cashInputCurrency: { color: theme.colors.success, fontSize: 18, fontWeight: '800', marginRight: 6 },
    cashTextInput: {
      flex: 1,
      color: theme.colors.textPrimary,
      fontSize: 22,
      fontWeight: '800',
      paddingVertical: 14,
      backgroundColor: 'transparent',
      ...(Platform.OS === 'web'
        ? ({
            outlineStyle: 'none',
            outlineWidth: 0,
            boxShadow: 'none',
          } as any)
        : {}),
    },
    quickCashGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
    quickCashBtn: {
      backgroundColor: theme.colors.bgInput,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: theme.radius.sm,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    quickCashText: { color: theme.colors.textPrimary, fontSize: 12, fontWeight: '700' },
    changeBox: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: isCashShort ? theme.colors.dangerLight : theme.colors.successLight,
      borderRadius: theme.radius.md,
      padding: 14,
      marginTop: 12,
      borderWidth: 1,
      borderColor: isCashShort ? theme.colors.danger + '40' : theme.colors.success + '40',
    },
    changeLabel: { color: theme.colors.textSecondary, fontSize: 13, fontWeight: '600' },
    changeAmount: { color: theme.colors.success, fontSize: 20, fontWeight: '800' },
    changeAmountNegative: { color: theme.colors.danger, fontSize: 15 },
    qrisContainer: {
      alignItems: 'center',
      backgroundColor: theme.colors.bgInput,
      borderRadius: theme.radius.md,
      padding: 16,
      marginTop: 12,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    qrisTitle: { color: theme.colors.textPrimary, fontSize: 14, fontWeight: '800', letterSpacing: 1 },
    qrisSubtitle: { color: theme.colors.textMuted, fontSize: 11, marginTop: 2, textAlign: 'center' },
    qrisImageWrapper: {
      backgroundColor: '#FFFFFF',
      padding: 12,
      borderRadius: theme.radius.md,
      marginVertical: 14,
    },
    qrisImage: { width: 180, height: 180 },
    qrisTotalLabel: { color: theme.colors.textSecondary, fontSize: 13 },
    qrisTotalValue: { color: theme.colors.success, fontWeight: '800' },
    phoneInput: {
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#F3F4F6',
      borderRadius: 12,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : '#E5E7EB',
      color: theme.colors.textPrimary,
      paddingHorizontal: 16,
      paddingVertical: 13,
      fontSize: 14,
      ...(Platform.OS === 'web'
        ? ({
            outlineStyle: 'none',
            outlineWidth: 0,
            boxShadow: 'none',
          } as any)
        : {}),
    },
    confirmCheckoutBtn: {
      backgroundColor: theme.colors.success,
      paddingVertical: 17,
      borderRadius: theme.radius.md,
      alignItems: 'center',
      marginTop: 20,
      ...theme.shadow.md,
    },
    confirmCheckoutBtnDisabled: { backgroundColor: theme.colors.border },
    confirmCheckoutText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  });

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalOverlay}
      >
        <View style={styles.checkoutSheet}>
          <View style={styles.sheetHandle} />
          {/* Header Lembar Pembayaran */}
          <View style={styles.sheetHeader}>
            <View>
              <Text style={styles.sheetTitle}>Pembayaran Kasir</Text>
              <Text style={styles.sheetSubtitle}>
                {totalQuantity} item • Total {formatRupiah(totalPrice)}
              </Text>
            </View>
            <TouchableOpacity style={styles.sheetCloseBtn} onPress={onClose}>
              <X size={22} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Pilihan Tab Metode Pembayaran: Tunai atau QRIS */}
            <Text style={styles.sectionLabel}>Metode Pembayaran</Text>
            <View style={styles.paymentMethodRow}>
              <TouchableOpacity
                style={[styles.paymentMethodBtn, paymentMethod === 'cash' && styles.paymentMethodBtnActive]}
                onPress={() => onPaymentMethodChange('cash')}
              >
                <Wallet size={20} color={paymentMethod === 'cash' ? '#FFFFFF' : theme.colors.textMuted} />
                <Text style={[styles.paymentMethodText, paymentMethod === 'cash' && styles.paymentMethodTextActive]}>
                  Tunai (Cash)
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.paymentMethodBtn, paymentMethod === 'qris' && styles.paymentMethodBtnActive]}
                onPress={() => onPaymentMethodChange('qris')}
              >
                <QrCode size={20} color={paymentMethod === 'qris' ? '#FFFFFF' : theme.colors.textMuted} />
                <Text style={[styles.paymentMethodText, paymentMethod === 'qris' && styles.paymentMethodTextActive]}>
                  QRIS
                </Text>
              </TouchableOpacity>
            </View>

            {/* SEKSI KHUSUS METODE TUNAI */}
            {paymentMethod === 'cash' && (
              <>
                <Text style={styles.sectionLabel}>Uang Tunai Diterima</Text>
                <View style={styles.cashInputBox}>
                  <Text style={styles.cashInputCurrency}>Rp</Text>
                  <TextInput
                    style={styles.cashTextInput}
                    keyboardType="number-pad"
                    value={cashPaidText}
                    onChangeText={(val) => onCashPaidTextChange(val.replace(/[^0-9]/g, ''))}
                    placeholder="0"
                    placeholderTextColor={theme.colors.textMuted}
                  />
                </View>

                {/* Tombol Pecahan Uang Cepat */}
                <View style={styles.quickCashGrid}>
                  <TouchableOpacity
                    style={styles.quickCashBtn}
                    onPress={() => onCashPaidTextChange(totalPrice.toString())}
                  >
                    <Text style={styles.quickCashText}>Uang Pas</Text>
                  </TouchableOpacity>
                  {QUICK_CASH_DENOMINATIONS.map((denom) => (
                    <TouchableOpacity
                      key={denom}
                      style={styles.quickCashBtn}
                      onPress={() => onCashPaidTextChange(denom.toString())}
                    >
                      <Text style={styles.quickCashText}>{formatRupiah(denom)}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Kotak Kembalian Uang Tunai / Peringatan Uang Kurang */}
                <View style={styles.changeBox}>
                  <Text style={styles.changeLabel}>Uang Kembalian</Text>
                  <Text style={[styles.changeAmount, isCashShort && styles.changeAmountNegative]}>
                    {isCashShort
                      ? `Kurang ${formatRupiah(totalPrice - cashPaidNumeric)}`
                      : formatRupiah(changeGiven)}
                  </Text>
                </View>
              </>
            )}

            {/* SEKSI KHUSUS METODE QRIS */}
            {paymentMethod === 'qris' && (
              <View style={styles.qrisContainer}>
                <Text style={styles.qrisTitle}>SCAN UNTUK MEMBAYAR</Text>
                <Text style={styles.qrisSubtitle}>
                  BCA, Mandiri, BRI, GoPay, OVO, Dana, LinkAja, ShopeePay, dll.
                </Text>
                <View style={styles.qrisImageWrapper}>
                  <Image
                    source={{
                      uri: `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=QRIS_TOKO_GROSIR_76_AMOUNT_${totalPrice}`,
                    }}
                    style={styles.qrisImage}
                    resizeMode="contain"
                  />
                </View>
                <Text style={styles.qrisTotalLabel}>
                  Total Tagihan: <Text style={styles.qrisTotalValue}>{formatRupiah(totalPrice)}</Text>
                </Text>
              </View>
            )}

            {/* Input Nomor WhatsApp Pelanggan untuk Struk Digital */}
            <Text style={styles.sectionLabel}>No. WhatsApp Pelanggan (Opsional)</Text>
            <TextInput
              style={styles.phoneInput}
              placeholder="Contoh: 081234567890"
              placeholderTextColor={theme.colors.textMuted}
              value={customerPhone}
              onChangeText={onCustomerPhoneChange}
              keyboardType="phone-pad"
            />
          </ScrollView>

          {/* Tombol Konfirmasi Selesai Pembayaran */}
          <TouchableOpacity
            style={[
              styles.confirmCheckoutBtn,
              (isProcessing || isCashShort) && styles.confirmCheckoutBtnDisabled,
            ]}
            disabled={isProcessing || isCashShort}
            onPress={onConfirmCheckout}
            activeOpacity={0.8}
          >
            <Text style={styles.confirmCheckoutText}>
              {isProcessing
                ? 'Menyimpan Transaksi...'
                : `Konfirmasi & Selesai — ${formatRupiah(totalPrice)}`}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

export default CheckoutModal;
