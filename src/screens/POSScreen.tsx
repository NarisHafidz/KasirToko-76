import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Linking,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { Moon, ScanBarcode, Sun } from 'lucide-react-native';
import { Header } from '../components/Header';
import { CartDrawer, CheckoutModal, ProductGrid, ReceiptSuccessModal } from '../components/pos';
import { useAuth } from '../config/AuthContext';
import { useTheme } from '../config/ThemeContext';
import { AppTheme } from '../config/theme';
import { fetchProductsWithVariants, findProductByBarcode, getLocalProducts } from '../services/productService';
import { generateWhatsAppReceiptUrl, processCheckout } from '../services/transactionService';
import { BusinessUnit, CartItem, PaymentMethod, Product, ProductVariant, Transaction, TransactionItem } from '../types/database';
import { MainTabParamList } from '../navigation/types';

/**
 * Tipe Properti POSScreen dari React Navigation Bottom Tabs
 */
type Props = BottomTabScreenProps<MainTabParamList, 'POS'>;

/**
 * Komponen Layar Transaksi Kasir (POSScreen)
 * 
 * FUNGSI UTAMA:
 * 1. Menampilkan katalog produk dengan pencarian instan dan filter kategori & unit bisnis.
 * 2. Mengelola keranjang belanja (tambah item, ubah qty, validasi batas stok).
 * 3. Integrasi pemindai barcode kamera & barcode scanner hardware USB/Bluetooth.
 * 4. Alur checkout lengkap (Tunai dengan kalkulasi kembalian otomatis & QRIS dinamis).
 * 5. Arsitektur Offline-First: Transaksi tetap dapat diproses saat koneksi internet terputus.
 * 6. Pembuatan struk digital otomatis yang dapat dibagikan langsung ke WhatsApp pelanggan.
 */
export const POSScreen: React.FC<Props> = ({ navigation, route }) => {
  const { theme, isDark, toggleTheme } = useTheme();
  const { cashierName, cashierUnit, storeName } = useAuth();

  // STATE MANAGEMENT KATALOG PRODUK, FILTER UNIT BISNIS & PENCARIAN
  /** Daftar seluruh produk yang aktif di sistem */
  const [products, setProducts] = useState<Product[]>([]);
  /** Teks kata kunci pencarian produk atau barcode */
  const [searchQuery, setSearchQuery] = useState<string>('');
  /** Filter Unit Bisnis Cepat ('Semua' | 'Sembako' | 'Tembakau') */
  const [selectedBusinessUnit, setSelectedBusinessUnit] = useState<'Semua' | 'Sembako' | 'Tembakau'>('Semua');
  /** Kategori yang sedang dipilih ('Semua' atau kategori tertentu) */
  const [selectedCategory, setSelectedCategory] = useState<string>('Semua');

  // STATE KERANJANG BELANJA (CART)
  /** Array item yang sedang dimasukkan ke dalam keranjang belanja */
  const [cart, setCart] = useState<CartItem[]>([]);

  // STATE MODAL PEMBAYARAN (CHECKOUT)
  /** Visibilitas modal pembayaran */
  const [checkoutModalVisible, setCheckoutModalVisible] = useState<boolean>(false);
  /** Metode pembayaran yang dipilih ('cash' untuk Tunai, 'qris' untuk QRIS) */
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  /** String nominal uang tunai yang diterima dari pembeli */
  const [cashPaidText, setCashPaidText] = useState<string>('');
  /** Nomor telepon WhatsApp pelanggan untuk pengiriman struk digital */
  const [customerPhone, setCustomerPhone] = useState<string>('');
  /** Indikator loading saat proses penyimpanan transaksi berlangsung */
  const [isProcessingCheckout, setIsProcessingCheckout] = useState<boolean>(false);

  // STATE MODAL STRUK SUKSES
  /** Visibilitas modal dialog struk setelah transaksi berhasil disimpan */
  const [receiptModalVisible, setReceiptModalVisible] = useState<boolean>(false);
  /** Data transaksi terakhir yang berhasil diproses */
  const [lastTransaction, setLastTransaction] = useState<{
    transaction: Transaction;
    items: TransactionItem[];
    isOffline: boolean;
  } | null>(null);

  /**
   * MEMUAT KATALOG PRODUK (loadCatalog)
   * 
   * ALUR KERJA:
   * 1. Pertama membaca cache AsyncStorage lokal untuk respon antarmuka instan (0 ms latency).
   * 2. Menjalankan query fetchProductsWithVariants(false) untuk memperbarui data dengan server Supabase jika online.
   * 3. Menyaring HANYA produk yang berstatus aktif (is_active !== false) agar kasir tidak menampilkan produk nonaktif.
   * 4. Memeriksa isi keranjang belanja untuk memastikan tidak ada produk yang baru dinonaktifkan.
   */
  const loadCatalog = useCallback(async () => {
    // 1. Ambil dari cache lokal dan saring hanya produk aktif
    const cached = await getLocalProducts();
    const activeCache = cached.filter((p: any) => p.is_active !== false);
    setProducts(activeCache);

    // 2. Ambil dari server Supabase (hanya produk aktif)
    const result = await fetchProductsWithVariants(false);
    const activeProducts = result.products.filter((p: any) => p.is_active !== false);
    setProducts(activeProducts);

    // 3. Validasi Keranjang: otomatis hapus item jika produknya dinonaktifkan dari manajemen produk
    const inactiveIds = new Set(
      cached.filter((p: any) => p.is_active === false).map((p: any) => p.id)
    );
    if (inactiveIds.size > 0) {
      setCart((prevCart) => {
        const validCart = prevCart.filter((item) => !inactiveIds.has(item.productId));
        if (validCart.length < prevCart.length) {
          Alert.alert(
            'Pembaruan Keranjang',
            'Beberapa produk di keranjang Anda telah dinonaktifkan dari menu Produk dan dihapus dari transaksi.'
          );
        }
        return validCart;
      });
    }
  }, []);

  /**
   * USE FOCUS EFFECT:
   * Memperbarui katalog produk setiap kali kasir membuka layar POS.
   */
  useFocusEffect(
    useCallback(() => {
      loadCatalog();
    }, [loadCatalog])
  );

  /**
   * USE EFFECT: Penanganan Hasil Scan Barcode dari ScannerScreen
   * 
   * Jika ada parameter route `scannedBarcode`:
   * 1. Mencari varian produk yang cocok dengan barcode tersebut.
   * 2. Memeriksa status produk: Jika nonaktif, tampilkan peringatan dan batalkan penambahan.
   * 3. Jika aktif & stok ada, langsung memasukkan produk tersebut ke dalam keranjang.
   * 4. Mereset parameter barcode agar tidak terpindai berulang kali saat re-render.
   */
  useEffect(() => {
    const scannedBarcode = route.params?.scannedBarcode;
    if (!scannedBarcode) return;

    const addScannedToCart = async () => {
      const match = await findProductByBarcode(scannedBarcode);
      if (match) {
        if (match.product.is_active === false) {
          Alert.alert(
            'Produk Nonaktif',
            `Produk "${match.product.name}" sedang dinonaktifkan dan tidak dapat ditambahkan ke kasir.`
          );
        } else {
          handleAddToCart(match.product, match.variant);
        }
      }
      navigation.setParams({ scannedBarcode: undefined });
    };

    addScannedToCart();
  }, [route.params?.scannedBarcode]); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * HANDLER TAMBAH KE KERANJANG (handleAddToCart)
   * 
   * VALIDASI:
   * 1. Memeriksa status aktif produk (produk nonaktif ditolak total).
   * 2. Memeriksa ketersediaan stok varian (tidak boleh 0).
   * 3. Jika item sudah ada di keranjang, kuantitas ditambah 1 (selama tidak melampaui stok).
   * 4. Jika belum ada, membuat objek `CartItem` baru dan menambahkannya ke array.
   */
  const handleAddToCart = useCallback((product: Product, variant: ProductVariant) => {
    if (product.is_active === false) {
      Alert.alert(
        'Produk Nonaktif',
        `Produk "${product.name}" berstatus nonaktif dan tidak dapat ditambahkan ke keranjang kasir.`
      );
      return;
    }

    if (variant.stock <= 0) {
      Alert.alert('Stok Habis', `Stok ${product.name} (${variant.variant_name}) sudah habis.`);
      return;
    }

    setCart((prevCart) => {
      const idx = prevCart.findIndex((item) => item.variantId === variant.id);
      if (idx > -1) {
        const existing = prevCart[idx];
        if (existing.quantity >= variant.stock) {
          Alert.alert('Batas Stok', `Maksimal stok tersedia hanya ${variant.stock}.`);
          return prevCart;
        }
        const updated = [...prevCart];
        const newQty = existing.quantity + 1;
        updated[idx] = { ...existing, quantity: newQty, subtotal: newQty * existing.price };
        return updated;
      }

      // Item baru di keranjang
      const newItem: CartItem = {
        productId: product.id,
        variantId: variant.id,
        productName: product.name,
        variantName: variant.variant_name,
        barcode: variant.barcode,
        costPrice: variant.cost_price,
        price: variant.price,
        quantity: 1,
        subtotal: variant.price,
        stockAvailable: variant.stock,
        businessUnit: (product.business_unit as any) || 'Sembako',
      };
      return [...prevCart, newItem];
    });
  }, []);

  /**
   * HANDLER UBAH KUANTITAS ITEM (handleUpdateQuantity)
   * Menambah (+1) atau mengurangi (-1) kuantitas item tertentu.
   * Jika kuantitas menjadi 0, item otomatis dihapus dari keranjang.
   */
  const handleUpdateQuantity = useCallback((variantId: string, delta: number) => {
    setCart((prevCart) =>
      prevCart
        .map((item) => {
          if (item.variantId === variantId) {
            const newQty = item.quantity + delta;
            if (newQty > item.stockAvailable) {
              Alert.alert('Batas Stok', `Maksimal stok tersedia hanya ${item.stockAvailable}.`);
              return item;
            }
            if (newQty <= 0) return null;
            return { ...item, quantity: newQty, subtotal: newQty * item.price };
          }
          return item;
        })
        .filter(Boolean) as CartItem[]
    );
  }, []);

  /**
   * HANDLER HAPUS SATU ITEM DARI KERANJANG
   */
  const handleRemoveFromCart = useCallback((variantId: string) => {
    setCart((prev) => prev.filter((item) => item.variantId !== variantId));
  }, []);

  /**
   * HANDLER KOSONGKAN SELURUH KERANJANG
   * Menampilkan konfirmasi sebelum menghapus semua item belanja dan mereset seluruh state transaksi.
   */
  const handleClearCart = useCallback(() => {
    if (cart.length === 0) return;

    const executeClear = () => {
      setCart([]);
      setCashPaidText('');
      setCustomerPhone('');
      setCheckoutModalVisible(false);
    };

    // Dukungan konfirmasi di Web (karena Alert.alert di react-native-web tidak mengeksekusi custom button callbacks)
    if (Platform.OS === 'web') {
      const confirmed =
        typeof window !== 'undefined' && window.confirm
          ? window.confirm('Apakah Anda yakin ingin mengosongkan semua item di keranjang belanja?')
          : true;
      if (confirmed) {
        executeClear();
      }
      return;
    }

    Alert.alert(
      'Kosongkan Keranjang',
      'Apakah Anda yakin ingin menghapus semua item di keranjang belanja?',
      [
        { text: 'Batal', style: 'cancel' },
        { text: 'Kosongkan', style: 'destructive', onPress: executeClear },
      ]
    );
  }, [cart.length]);

  /**
   * KALKULASI TOTAL KUANTITAS DAN TOTAL HARGA (USE MEMO)
   * Menghitung nilai secara efisien, hanya dievaluasi ulang saat array `cart` berubah.
   */
  const totalQuantity = useMemo(() => cart.reduce((sum, item) => sum + item.quantity, 0), [cart]);
  const totalPrice = useMemo(() => cart.reduce((sum, item) => sum + item.subtotal, 0), [cart]);

  /**
   * MEMBUKA MODAL CHECKOUT
   * Mengatur nilai awal pembayaran tunai sama dengan total harga (uang pas).
   */
  const handleOpenCheckout = () => {
    if (cart.length === 0) {
      Alert.alert('Keranjang Kosong', 'Pilih minimal 1 produk untuk melakukan transaksi.');
      return;
    }
    setPaymentMethod('cash');
    setCashPaidText(totalPrice.toString());
    setCustomerPhone('');
    setCheckoutModalVisible(true);
  };

  /**
   * MEMBUKA LAYAR PEMINDAI BARCODE KAMERA (ScannerScreen)
   */
  const handleOpenScanner = () => {
    navigation.getParent()?.navigate('Scanner', { mode: 'pos' });
  };

  /**
   * EKSEKUSI PROSES TRANSAKSI (handleExecuteCheckout)
   * 
   * ALUR PROSES:
   * 1. Validasi nominal uang tunai (tidak boleh kurang dari total belanja).
   * 2. Memanggil fungsi `processCheckout` dari `transactionService`.
   * 3. Jika online, langsung disimpan ke Supabase dan memotong stok cloud.
   * 4. Jika offline, transaksi otomatis disimpan di antrean AsyncStorage dan stok lokal dipotong.
   * 5. Mengosongkan keranjang belanja dan menampilkan modal struk nota resmi.
   */
  const handleExecuteCheckout = async () => {
    const cashPaidNumeric = parseInt(cashPaidText.replace(/[^0-9]/g, ''), 10) || 0;
    const changeGiven = Math.max(0, cashPaidNumeric - totalPrice);

    if (paymentMethod === 'cash' && cashPaidNumeric < totalPrice) {
      Alert.alert('Uang Kurang', 'Nominal uang tunai yang diterima kurang dari total belanja.');
      return;
    }

    setIsProcessingCheckout(true);
    try {
      const result = await processCheckout(
        cart,
        {
          paymentMethod,
          cashPaid: paymentMethod === 'cash' ? cashPaidNumeric : totalPrice,
          changeGiven: paymentMethod === 'cash' ? changeGiven : 0,
          customerPhone: customerPhone.trim() || undefined,
        },
        cashierName,
        cashierUnit
      );

      setCheckoutModalVisible(false);
      setCart([]);
      setLastTransaction({
        transaction: result.transaction,
        items: result.items,
        isOffline: result.isOffline,
      });
      setReceiptModalVisible(true);
      loadCatalog();
    } catch (err: any) {
      Alert.alert('Gagal Memproses Transaksi', err?.message || 'Terjadi kesalahan pada sistem kasir.');
    } finally {
      setIsProcessingCheckout(false);
    }
  };

  /**
   * HANDLER KIRIM STRUK DIGITAL KE WHATSAPP PELANGGAN
   * Menghasilkan teks nota belanja lengkap dan membuka aplikasi WhatsApp pelanggan.
   */
  const handleShareWhatsApp = () => {
    if (!lastTransaction) return;
    const phone = lastTransaction.transaction.customer_phone || customerPhone;
    if (!phone) {
      Alert.alert('Nomor WhatsApp Belum Ada', 'Silakan masukkan nomor WhatsApp pelanggan terlebih dahulu.');
      return;
    }
    const url = generateWhatsAppReceiptUrl(phone, {
      transaction: lastTransaction.transaction,
      items: lastTransaction.items,
      storeName: storeName || 'KasirToko POS',
    });
    Linking.openURL(url).catch(() => {
      Alert.alert('Error', 'Gagal membuka aplikasi WhatsApp pada perangkat ini.');
    });
  };

  const styles = useMemo(() => makeStyles(theme), [theme]);
  // Mengatur posisi vertikal tombol scan mengambang agar tidak menutupi drawer keranjang
  const floatingBottom = cart.length > 0 ? 90 : 20;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* Header Layar POS */}
      <Header
        title="Kasir POS"
        subtitle={`${storeName || 'KasirToko POS'} • ${cashierName}`}
        rightAction={
          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.themeToggleBtn} onPress={toggleTheme} activeOpacity={0.75}>
              {isDark ? (
                <Sun size={18} color={theme.colors.warning || '#F59E0B'} />
              ) : (
                <Moon size={18} color={theme.colors.textSecondary || '#64748B'} />
              )}
            </TouchableOpacity>
            <TouchableOpacity style={styles.scannerHeaderBtn} onPress={handleOpenScanner} activeOpacity={0.8}>
              <ScanBarcode size={16} color="#FFFFFF" />
              <Text style={styles.scannerHeaderBtnText}>Scan</Text>
            </TouchableOpacity>
          </View>
        }
      />

      {/* Grid Katalog Produk dengan Filter Multi-Bisnis, Pencarian & Kategori */}
      <ProductGrid
        products={products}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        selectedBusinessUnit={selectedBusinessUnit}
        onSelectBusinessUnit={setSelectedBusinessUnit}
        selectedCategory={selectedCategory}
        onSelectCategory={setSelectedCategory}
        onAddToCart={handleAddToCart}
      />

      {/* Drawer Panel Keranjang Belanja (Bottom Drawer) */}
      <CartDrawer
        cart={cart}
        totalQuantity={totalQuantity}
        totalPrice={totalPrice}
        onUpdateQuantity={handleUpdateQuantity}
        onRemoveFromCart={handleRemoveFromCart}
        onClearCart={handleClearCart}
        onOpenCheckout={handleOpenCheckout}
      />

      {/* Tombol Pemindai Barcode Mengambang (Floating Action Button) */}
      <TouchableOpacity
        style={[styles.floatingScannerBtn, { bottom: floatingBottom }]}
        onPress={handleOpenScanner}
        activeOpacity={0.85}
        accessibilityLabel="Pindai Barcode Produk"
      >
        <ScanBarcode size={24} color="#FFFFFF" />
      </TouchableOpacity>

      {/* Modal Dialog Form Pembayaran */}
      <CheckoutModal
        visible={checkoutModalVisible}
        totalPrice={totalPrice}
        totalQuantity={totalQuantity}
        paymentMethod={paymentMethod}
        onPaymentMethodChange={setPaymentMethod}
        cashPaidText={cashPaidText}
        onCashPaidTextChange={setCashPaidText}
        customerPhone={customerPhone}
        onCustomerPhoneChange={setCustomerPhone}
        isProcessing={isProcessingCheckout}
        onClose={() => setCheckoutModalVisible(false)}
        onConfirmCheckout={handleExecuteCheckout}
      />

      {/* Modal Struk Keberhasilan Transaksi & Share WhatsApp */}
      <ReceiptSuccessModal
        visible={receiptModalVisible}
        transactionData={lastTransaction}
        hasCustomerPhone={Boolean(customerPhone || lastTransaction?.transaction.customer_phone)}
        onShareWhatsApp={handleShareWhatsApp}
        onNewTransaction={() => setReceiptModalVisible(false)}
      />
    </SafeAreaView>
  );
};

/**
 * GENERATOR STYLESHEET POSSCREEN
 * Didefinisikan di luar komponen untuk mencegah alokasi ulang objek style pada setiap re-render.
 */
const makeStyles = (theme: AppTheme) =>
  StyleSheet.create({
    container: { flex: 1, width: '100%', backgroundColor: theme.colors.bgApp },
    headerActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    themeToggleBtn: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: theme.colors.bgCard,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    scannerHeaderBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: theme.colors.primary,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: theme.radius.full || 20,
    },
    scannerHeaderBtnText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700', flexShrink: 1 },
    floatingScannerBtn: {
      position: 'absolute',
      right: 20,
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: theme.colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      elevation: 6,
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.3,
      shadowRadius: 5,
    },
  });

export default POSScreen;