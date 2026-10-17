import React, { useRef, useState } from 'react';
import {
  Alert,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  Vibration,
  View,
} from 'react-native';
import { BarcodeScanningResult, CameraView, useCameraPermissions } from 'expo-camera';
import { ArrowLeft, Flashlight, Keyboard, ScanLine } from 'lucide-react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../config/ThemeContext';
import { AppTheme } from '../config/theme';
import { findProductByBarcode } from '../services/productService';
import { RootStackParamList } from '../navigation/types';

/**
 * Tipe Properti ScannerScreen dari RootStackParamList
 */
type Props = NativeStackScreenProps<RootStackParamList, 'Scanner'>;

/**
 * Durasi Cooldown Pemindaian Berkelanjutan (Continuous Scanning) dalam milidetik.
 * Mencegah satu barcode fisik terpindai berulang kali dalam rentang waktu yang terlalu singkat.
 */
const SCAN_COOLDOWN_MS = 1200;

/**
 * Komponen Layar Pemindai Barcode Kamera (ScannerScreen)
 * 
 * FUNGSI UTAMA:
 * 1. Mengakses kamera perangkat menggunakan `expo-camera` untuk mendeteksi barcode 1D (EAN-13, Code 128, UPC, dll) & QR Code.
 * 2. Mode 'pos': Memindai produk langsung ke keranjang kasir secara cepat dan berkelanjutan.
 * 3. Mode 'product': Memindai barcode barang saat pendaftaran/pengeditan produk di katalog.
 * 4. Umpan balik haptic (vibrasi) dan visual (toast popup) saat barcode berhasil dikenali.
 * 5. Fitur Senter (Flashlight / Torch) untuk kondisi pencahayaan toko yang minim.
 * 6. Fallback Input Manual: Memungkinkan kasir mengetik nomor barcode jika barcode rusak/pudar.
 */
export const ScannerScreen: React.FC<Props> = ({ navigation, route }) => {
  const { theme, isDark } = useTheme();
  // Mode pemindaian: 'pos' (untuk kasir) atau 'product' (untuk form produk)
  const mode = route?.params?.mode || 'pos';

  // STATE MANAGEMENT
  /** Status izin akses kamera perangkat */
  const [permission, requestPermission] = useCameraPermissions();
  /** Status lampu senter (nyala/mati) */
  const [torch, setTorch] = useState<boolean>(false);
  /** Visibilitas modal dialog pengetikan barcode manual */
  const [manualModalVisible, setManualModalVisible] = useState<boolean>(false);
  /** Input teks kode barcode pada modal manual */
  const [manualCode, setManualCode] = useState<string>('');
  /** Kode barcode terakhir yang berhasil dipindai */
  const [lastScannedCode, setLastScannedCode] = useState<string>('');
  /** Teks feedback pop-up visual saat produk berhasil dipindai */
  const [scanFeedback, setScanFeedback] = useState<string>('');

  /**
   * Ref flag untuk mengontrol periode jeda (cooldown) antar pemindaian.
   * Menggunakan useRef agar tidak memicu re-render yang tidak perlu.
   */
  const coolingDown = useRef<boolean>(false);

  /**
   * Menampilkan pesan umpan balik hasil scan selama 1 detik
   */
  const triggerScanFeedback = (text: string) => {
    setScanFeedback(text);
    setTimeout(() => setScanFeedback(''), 1000);
  };

  /**
   * HANDLER UTAMA DETEKSI BARCODE (handleBarcodeScanned)
   * 
   * ALUR PROSES:
   * 1. Mengecek cooldown pemindaian untuk mencegah duplikasi scan instan.
   * 2. Membersihkan karakter spasi liar dari string barcode.
   * 3. Jika mode 'product': Langsung mengirimkan barcode ke form produk dan menutup scanner.
   * 4. Jika mode 'pos': Mencocokkan barcode ke cache produk lokal:
   *    - Jika tidak ada: Menampilkan peringatan bahwa barang belum terdaftar.
   *    - Jika cocok: Memberikan getaran vibrasi, menampilkan feedback, mengirimkan data ke keranjang kasir,
   *      dan mengaktifkan timer cooldown sebelum barcode berikutnya dapat dipindai.
   */
  const handleBarcodeScanned = async (result: BarcodeScanningResult) => {
    if (coolingDown.current) return;
    coolingDown.current = true;

    const rawData = result.data ? String(result.data).trim() : '';
    const barcodeData = rawData.replace(/\s+/g, '');

    if (!barcodeData) {
      coolingDown.current = false;
      return;
    }

    // --- MODE PENDAFTARAN PRODUK ---
    if (mode === 'product') {
      Vibration.vibrate(80);
      navigation.navigate('MainTabs', {
        screen: 'Products',
        params: { scannedBarcode: barcodeData },
      } as any);
      return;
    }

    // --- MODE KASIR (POS) ---
    const match = await findProductByBarcode(barcodeData);
    if (!match) {
      // Getar pola ganda menandakan peringatan produk tidak ditemukan
      Vibration.vibrate([0, 100, 80, 100]);
      Alert.alert(
        'Produk Tidak Ditemukan',
        `Barcode "${barcodeData}" belum terdaftar di sistem produk.`,
        [
          {
            text: 'Pindai Ulang',
            onPress: () => {
              coolingDown.current = false;
            },
          },
          {
            text: 'Kembali ke Kasir',
            onPress: () => navigation.goBack(),
          },
        ]
      );
      return;
    }

    // Jika produk berstatus nonaktif, tolak pemindaian
    if (match.product.is_active === false) {
      Vibration.vibrate([0, 100, 80, 100]);
      Alert.alert(
        'Produk Nonaktif',
        `Produk "${match.product.name}" sedang dinonaktifkan di katalog dan tidak dapat dijual di kasir.`,
        [
          {
            text: 'OK',
            onPress: () => {
              coolingDown.current = false;
            },
          },
        ]
      );
      return;
    }

    // Pemindaian Berhasil -> Getar pendek 80ms
    Vibration.vibrate(80);
    const isRepeat = barcodeData === lastScannedCode;
    setLastScannedCode(barcodeData);
    triggerScanFeedback(`✓ ${match.product.name}${isRepeat ? ' (+1)' : ''}`);

    // Kirim barcode ke POSScreen
    navigation.navigate('MainTabs', {
      screen: 'POS',
      params: { scannedBarcode: barcodeData },
    } as any);

    // Buka kembali kunci cooldown setelah jeda waktu
    setTimeout(() => {
      coolingDown.current = false;
    }, SCAN_COOLDOWN_MS);
  };

  /**
   * HANDLER INPUT BARCODE MANUAL
   * Memproses kode barcode yang diketik manual seolah-olah terbaca oleh kamera.
   */
  const handleManualSubmit = () => {
    if (!manualCode.trim()) return;
    const cleanCode = manualCode.trim().replace(/\s+/g, '');
    setManualCode('');
    setManualModalVisible(false);
    handleBarcodeScanned({
      type: 'manual',
      data: cleanCode,
    } as unknown as BarcodeScanningResult);
  };

  const styles = createStyles(theme, isDark);

  // TAMPILAN JIKA STATUS IZIN KAMERA SEDANG DIPERIKSA
  if (!permission) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.statusText}>Memeriksa izin kamera...</Text>
      </View>
    );
  }

  // TAMPILAN JIKA IZIN KAMERA DITOLAK
  if (!permission.granted) {
    return (
      <View style={styles.centerContainer}>
        <ScanLine size={48} color={theme.colors.primary} />
        <Text style={styles.permissionTitle}>Akses Kamera Diperlukan</Text>
        <Text style={styles.permissionDesc}>
          Kamera digunakan untuk memindai barcode produk saat transaksi kasir dan pendaftaran barang.
        </Text>
        <TouchableOpacity
          style={styles.permissionButton}
          onPress={requestPermission}
          activeOpacity={0.8}
        >
          <Text style={styles.permissionButtonText}>Izinkan Kamera</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.manualFallbackBtn}
          onPress={() => setManualModalVisible(true)}
          activeOpacity={0.8}
        >
          <Text style={styles.manualFallbackText}>Input Barcode Manual</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Viewfinder Kamera Aktif */}
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        enableTorch={torch}
        barcodeScannerSettings={{
          barcodeTypes: [
            'ean13',
            'ean8',
            'upc_a',
            'upc_e',
            'code128',
            'code39',
            'qr',
            'datamatrix',
            'itf14',
          ],
        }}
        onBarcodeScanned={handleBarcodeScanned}
      />

      {/* Lapisan Antarmuka di Atas Kamera (Overlay) */}
      <View style={styles.overlay}>
        {/* Top Bar: Tombol Kembali, Judul, dan Senter */}
        <View style={styles.topBar}>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => navigation.goBack()}
            activeOpacity={0.8}
            accessibilityLabel="Kembali"
          >
            <ArrowLeft size={22} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.topTitle}>
            {mode === 'pos' ? 'Pindai Produk Kasir' : 'Daftarkan Barcode'}
          </Text>
          <TouchableOpacity
            style={[styles.iconButton, torch && styles.iconButtonActive]}
            onPress={() => setTorch(!torch)}
            activeOpacity={0.8}
            accessibilityLabel="Nyalakan/Matikan Senter"
          >
            <Flashlight size={20} color={torch ? '#F59E0B' : '#FFFFFF'} />
          </TouchableOpacity>
        </View>

        {/* Kotak Bidik Pemindaian (Target Viewfinder Frame) */}
        <View style={styles.targetContainer}>
          <View style={styles.viewfinder}>
            <View style={[styles.corner, styles.cornerTopLeft]} />
            <View style={[styles.corner, styles.cornerTopRight]} />
            <View style={[styles.corner, styles.cornerBottomLeft]} />
            <View style={[styles.corner, styles.cornerBottomRight]} />
            <View style={styles.laserLine} />
          </View>

          {/* Toast Umpan Balik Pemindaian Berhasil */}
          {scanFeedback ? (
            <View style={styles.scanFeedbackBadge}>
              <Text style={styles.scanFeedbackText}>{scanFeedback}</Text>
            </View>
          ) : (
            <Text style={styles.instructionText}>
              {mode === 'pos'
                ? 'Scan terus — setiap produk langsung masuk keranjang'
                : 'Arahkan kotak bidik ke barcode barang'}
            </Text>
          )}
        </View>

        {/* Bottom Bar: Tombol Alternatif Ketik Barcode Manual */}
        <View style={styles.bottomBar}>
          <TouchableOpacity
            style={styles.manualBtn}
            onPress={() => setManualModalVisible(true)}
            activeOpacity={0.8}
          >
            <Keyboard size={18} color="#FFFFFF" />
            <Text style={styles.manualBtnText}>Ketik Barcode Manual</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Modal Dialog Input Barcode Manual */}
      <Modal
        visible={manualModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setManualModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Input Barcode Manual</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Masukkan kode barcode / SKU"
              placeholderTextColor={theme.colors.textMuted}
              value={manualCode}
              onChangeText={setManualCode}
              keyboardType="default"
              autoFocus
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalActionBtn, styles.modalCancelBtn]}
                onPress={() => setManualModalVisible(false)}
              >
                <Text style={styles.modalCancelText}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalActionBtn, styles.modalSubmitBtn]}
                onPress={handleManualSubmit}
              >
                <Text style={styles.modalSubmitText}>Gunakan</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

/**
 * GENERATOR STYLESHEET SCANNER
 */
const createStyles = (theme: AppTheme, isDark: boolean) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000000' },
    centerContainer: {
      flex: 1,
      backgroundColor: theme.colors.bgApp,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
    },
    statusText: { color: theme.colors.textSecondary, fontSize: 16 },
    permissionTitle: {
      color: theme.colors.textPrimary,
      fontSize: 20,
      fontWeight: '700',
      marginTop: 16,
      textAlign: 'center',
    },
    permissionDesc: {
      color: theme.colors.textMuted,
      fontSize: 14,
      textAlign: 'center',
      marginTop: 8,
      lineHeight: 20,
      maxWidth: 300,
    },
    permissionButton: {
      backgroundColor: theme.colors.primary,
      paddingHorizontal: 28,
      paddingVertical: 15,
      borderRadius: theme.radius.md,
      marginTop: 24,
    },
    permissionButtonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
    manualFallbackBtn: { marginTop: 16, padding: 10 },
    manualFallbackText: {
      color: theme.colors.textSecondary,
      fontSize: 14,
      textDecorationLine: 'underline',
    },
    overlay: { flex: 1, justifyContent: 'space-between' },
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingTop: 52,
      paddingBottom: 16,
      backgroundColor: 'rgba(0,0,0,0.45)',
    },
    topTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
    iconButton: {
      width: 46,
      height: 46,
      borderRadius: 23,
      backgroundColor: 'rgba(255,255,255,0.2)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    iconButtonActive: { backgroundColor: 'rgba(245,158,11,0.35)' },
    targetContainer: { alignItems: 'center', justifyContent: 'center' },
    viewfinder: {
      width: 290,
      height: 190,
      position: 'relative',
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    corner: {
      position: 'absolute',
      width: 28,
      height: 28,
      borderColor: theme.colors.primary,
    },
    cornerTopLeft: { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 10 },
    cornerTopRight: { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 10 },
    cornerBottomLeft: { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 10 },
    cornerBottomRight: { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 10 },
    laserLine: { width: '85%', height: 2, backgroundColor: '#EF4444', opacity: 0.9 },
    scanFeedbackBadge: {
      marginTop: 18,
      backgroundColor: 'rgba(16,185,129,0.85)',
      paddingHorizontal: 18,
      paddingVertical: 7,
      borderRadius: theme.radius.full,
    },
    scanFeedbackText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
    instructionText: {
      color: '#FFFFFF',
      marginTop: 18,
      fontSize: 13,
      fontWeight: '500',
      backgroundColor: 'rgba(0,0,0,0.6)',
      paddingHorizontal: 18,
      paddingVertical: 7,
      borderRadius: theme.radius.full,
      textAlign: 'center',
      maxWidth: 300,
    },
    bottomBar: { paddingBottom: 44, alignItems: 'center' },
    manualBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: 'rgba(30,41,59,0.9)',
      paddingHorizontal: 22,
      paddingVertical: 13,
      borderRadius: theme.radius.full,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.2)',
    },
    manualBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
    modalBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.7)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 24,
    },
    modalContent: {
      width: '100%',
      backgroundColor: theme.colors.bgCard,
      borderRadius: theme.radius.lg,
      padding: 20,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    modalTitle: {
      color: theme.colors.textPrimary,
      fontSize: 18,
      fontWeight: '700',
      marginBottom: 16,
    },
    modalInput: {
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#F3F4F6',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : '#E5E7EB',
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 13,
      color: theme.colors.textPrimary,
      fontSize: 15,
      ...(Platform.OS === 'web'
        ? ({
            outlineStyle: 'none',
            outlineWidth: 0,
            boxShadow: 'none',
          } as any)
        : {}),
    },
    modalActions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: 12,
      marginTop: 20,
    },
    modalActionBtn: { paddingHorizontal: 18, paddingVertical: 11, borderRadius: theme.radius.md },
    modalCancelBtn: { backgroundColor: 'transparent' },
    modalCancelText: { color: theme.colors.textSecondary, fontWeight: '600' },
    modalSubmitBtn: { backgroundColor: theme.colors.primary },
    modalSubmitText: { color: '#FFFFFF', fontWeight: '700' },
  });

export default ScannerScreen;
