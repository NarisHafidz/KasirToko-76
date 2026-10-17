import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  FlatList,
  PanResponder,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import {
  AlertTriangle,
  CheckCircle2,
  Edit2,
  Eye,
  EyeOff,
  Moon,
  Package,
  Plus,
  RefreshCw,
  ScanBarcode,
  Search,
  Sun,
  Trash2,
  X,
} from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Header } from '../components/Header';
import { ProductModals } from '../components';
import { getCurrentUserId, supabase } from '../config/supabase';
import { useTheme } from '../config/ThemeContext';
import { ACTION_WIDTH, makeStyles, swipeStyles } from './ProductScreen.styles';
import {
  cacheProductsLocally,
  deleteProduct,
  fetchProductsWithVariants,
  getLocalProducts,
  updateProductActiveStatus,
} from '../services/productService';
import { checkInternetConnection } from '../services/syncService';
import { formatRupiah } from '../services/transactionService';
import { Product, ProductVariant } from '../types/database';
import { MainTabParamList } from '../navigation/types';

/**
 * Tipe Properti ProductScreen dari React Navigation Bottom Tabs
 */
type Props = BottomTabScreenProps<MainTabParamList, 'Products'>;

/**
 * Komponen Kartu Produk dengan Interaksi Swipe-to-Delete
 * Menggeser kartu ke kiri memunculkan tombol hapus berwarna merah dengan ikon tempat sampah.
 */
interface SwipeableProductItemProps {
  product: Product;
  onDeletePress: (product: Product) => void;
  children: React.ReactNode;
}

const SwipeableProductItem: React.FC<SwipeableProductItemProps> = ({
  product,
  onDeletePress,
  children,
}) => {
  const translateX = useRef(new Animated.Value(0)).current;
  const isOpen = useRef(false);

  const closeSwipe = useCallback(() => {
    Animated.spring(translateX, {
      toValue: 0,
      useNativeDriver: true,
      bounciness: 2,
    }).start(() => {
      isOpen.current = false;
    });
  }, [translateX]);

  const openSwipe = useCallback(() => {
    Animated.spring(translateX, {
      toValue: -ACTION_WIDTH,
      useNativeDriver: true,
      bounciness: 4,
    }).start(() => {
      isOpen.current = true;
    });
  }, [translateX]);

  // Tutup kembali swipe jika status produk berubah
  useEffect(() => {
    closeSwipe();
  }, [product.is_active, closeSwipe]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onStartShouldSetPanResponderCapture: () => {
        // Jika kartu sedang terbuka dan diklik lagi di area kartu, segera tutup
        if (isOpen.current) {
          closeSwipe();
          return true;
        }
        return false;
      },
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Hanya klaim gesture jika perpindahan horizontal lebih dominan daripada vertikal
        return (
          Math.abs(gestureState.dx) > 10 &&
          Math.abs(gestureState.dx) > Math.abs(gestureState.dy)
        );
      },
      onMoveShouldSetPanResponderCapture: (_, gestureState) => {
        return (
          Math.abs(gestureState.dx) > 12 &&
          Math.abs(gestureState.dx) > Math.abs(gestureState.dy)
        );
      },
      onPanResponderMove: (_, gestureState) => {
        if (isOpen.current) {
          // Kartu sedang terbuka di -ACTION_WIDTH, drag ke kanan (dx > 0) membawanya ke 0
          const newX = Math.min(0, Math.max(-ACTION_WIDTH - 20, -ACTION_WIDTH + gestureState.dx));
          translateX.setValue(newX);
        } else {
          // Kartu sedang tertutup di 0, hanya izinkan drag ke kiri (dx < 0)
          if (gestureState.dx < 0) {
            const newX = Math.max(-ACTION_WIDTH - 20, gestureState.dx);
            translateX.setValue(newX);
          }
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (isOpen.current) {
          if (gestureState.dx > 25 || gestureState.vx > 0.25) {
            closeSwipe();
          } else {
            openSwipe();
          }
        } else {
          if (gestureState.dx < -35 || gestureState.vx < -0.3) {
            openSwipe();
          } else {
            closeSwipe();
          }
        }
      },
      onPanResponderTerminate: () => {
        closeSwipe();
      },
    })
  ).current;

  // Transisi opacity tombol hapus merah agar tidak bocor saat kartu tertutup rapat
  const actionOpacity = translateX.interpolate({
    inputRange: [-ACTION_WIDTH, -15, 0],
    outputRange: [1, 0.6, 0],
    extrapolate: 'clamp',
  });

  return (
    <View style={swipeStyles.container}>
      {/* Tombol Sampah Merah di Belakang Kartu */}
      <Animated.View style={[swipeStyles.actionContainer, { opacity: actionOpacity }]}>
        <TouchableOpacity
          style={swipeStyles.deleteBtn}
          onPress={() => {
            closeSwipe();
            onDeletePress(product);
          }}
          activeOpacity={0.8}
          accessibilityLabel={`Hapus produk ${product.name}`}
        >
          <Trash2 size={24} color="#FFFFFF" />
          <Text style={swipeStyles.deleteText}>Hapus</Text>
        </TouchableOpacity>
      </Animated.View>

      {/* Konten Kartu Produk yang Dapat Digeser */}
      <Animated.View
        style={[swipeStyles.cardWrapper, { transform: [{ translateX }] }]}
        {...panResponder.panHandlers}
      >
        {children}
      </Animated.View>
    </View>
  );
};

/**
 * Komponen Layar Manajemen Katalog Produk (ProductScreen)
 * 
 * FUNGSI UTAMA:
 * 1. Menampilkan daftar seluruh produk toko beserta rincian varian harga dan stok.
 * 2. Menyediakan pencarian cepat multi-kriteria (nama produk, kategori, dan barcode/SKU).
 * 3. Fitur Tambah & Ubah Produk: Mengatur harga modal, harga jual, barcode, dan sisa stok.
 * 4. Integrasi Pemindai Barcode Kamera: Mendaftarkan barcode produk langsung via kamera HP.
 * 5. Fitur Nonaktifkan Produk (Soft Delete): Menjaga integritas riwayat transaksi penjualan lama.
 * 6. Dukungan Offline-First: Produk baru dan perubahan data tetap tersimpan di cache lokal saat offline.
 * 7. Fitur Swipe-to-Delete: Menggeser kartu ke kiri memunculkan tombol hapus permanen/cerdas.
 */
export const ProductScreen: React.FC<Props> = ({ navigation, route }) => {
  const { theme, isDark, toggleTheme } = useTheme();

  // STATE MANAGEMENT DATA KATALOG & PENCARIAN
  /** Daftar seluruh produk toko (aktif dan nonaktif) */
  const [products, setProducts] = useState<Product[]>([]);
  /** Teks kata kunci pencarian produk */
  const [searchQuery, setSearchQuery] = useState<string>('');
  /** Filter tab status produk: 'all' = Semua, 'active' = Aktif, 'inactive' = Nonaktif */
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  /** Filter tab unit bisnis: 'all' = Semua, 'Sembako' = Sembako, 'Tembakau' = Tembakau */
  const [businessUnitFilter, setBusinessUnitFilter] = useState<'all' | 'Sembako' | 'Tembakau'>('all');
  /** Indikator loading saat memuat atau menyinkronkan data katalog */
  const [loading, setLoading] = useState<boolean>(false);

  // STATE & REF TOAST NOTIFIKASI SEMENTARA (AUTO-DISMISS 2.5 DETIK)
  /** Pesan toast feedback visual saat status produk diubah */
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  /** Nilai animasi opacity untuk transisi fade-in dan fade-out */
  const toastOpacity = useRef(new Animated.Value(0)).current;
  /** Ref timer auto-dismiss untuk pencegahan memory leak */
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * Menampilkan Notifikasi Toast Sementara (Auto-dismiss 2.5 Detik)
   * Menggunakan animasi fade-in & fade-out halus serta pembersihan timer otomatis
   */
  const showToast = useCallback((message: string, duration = 2500) => {
    // 1. Bersihkan timer yang sedang berjalan sebelumnya
    if (toastTimer.current) {
      clearTimeout(toastTimer.current);
      toastTimer.current = null;
    }
    toastOpacity.stopAnimation();

    // 2. Set pesan dan jalankan animasi Fade-In
    setToastMessage(message);
    Animated.timing(toastOpacity, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();

    // 3. Auto-dismiss: Fade-out otomatis setelah durasi (2500ms)
    toastTimer.current = setTimeout(() => {
      Animated.timing(toastOpacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        setToastMessage(null);
      });
    }, duration);
  }, [toastOpacity]);

  /**
   * PEMBERSIHAN TIMER UNTUK MENCEGAH MEMORY LEAK:
   * Memastikan timer dibersihkan (clearTimeout) saat komponen ProductScreen di-unmount.
   */
  useEffect(() => {
    return () => {
      if (toastTimer.current) {
        clearTimeout(toastTimer.current);
      }
    };
  }, []);

  // STATE MANAGEMENT FORMULIR MODAL PRODUK
  /** Visibilitas modal formulir tambah / edit produk */
  const [formModalVisible, setFormModalVisible] = useState<boolean>(false);
  /** ID produk yang sedang diedit (null jika sedang membuat produk baru) */
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  /** ID varian produk yang sedang diedit (null jika varian baru) */
  const [editingVariantId, setEditingVariantId] = useState<string | null>(null);

  // FIELD ISIAN FORMULIR
  const [formName, setFormName] = useState<string>('');
  const [formCategory, setFormCategory] = useState<string>('');
  const [formBusinessUnit, setFormBusinessUnit] = useState<'Sembako' | 'Tembakau'>('Sembako');
  const [formVariantName, setFormVariantName] = useState<string>('Standar');
  const [formBarcode, setFormBarcode] = useState<string>('');
  const [formCostPrice, setFormCostPrice] = useState<string>('');
  const [formPrice, setFormPrice] = useState<string>('');
  const [formStock, setFormStock] = useState<string>('');
  /** Status sedang menyimpan data ke database */
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // STATE MANAGEMENT MODAL KONFIRMASI HAPUS
  /** Visibilitas pop-up modal konfirmasi hapus */
  const [deleteModalVisible, setDeleteModalVisible] = useState<boolean>(false);
  /** Produk yang dipilih untuk dihapus */
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  /** Indikator proses hapus data sedang berlangsung */
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  /**
   * MEMUAT DATA PRODUK (loadData)
   * Mengambil SELURUH data produk (aktif & nonaktif) dari cache lokal terlebih dahulu
   * untuk kecepatan render instan, lalu menyinkronkan data terbaru dari Supabase jika online.
   */
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Ambil dari cache lokal (semua produk termasuk yang nonaktif)
      const cached = await getLocalProducts();
      if (cached && cached.length > 0) setProducts(cached);

      // 2. Ambil dari server Supabase (includeInactive = true)
      const result = await fetchProductsWithVariants(true);
      if (result.products && result.products.length > 0) {
        setProducts(result.products);
      }
    } catch (err) {
      console.error('Gagal memuat produk:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * USE FOCUS EFFECT:
   * Memperbarui daftar produk setiap kali tab Produk dibuka kembali oleh pengguna.
   */
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  /**
   * USE EFFECT: Menangkap Hasil Pindai Barcode dari ScannerScreen
   * Mengisikan nomor barcode hasil pindai kamera ke input form formulir produk secara otomatis.
   */
  useEffect(() => {
    const scannedBarcode = route.params?.scannedBarcode;
    if (!scannedBarcode) return;
    setFormBarcode(scannedBarcode);
    if (!formModalVisible) setFormModalVisible(true);
    navigation.setParams({ scannedBarcode: undefined });
  }, [route.params?.scannedBarcode]); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * FILTER PRODUK (Pencarian Multi-Field & Status)
   * Menyaring produk berdasarkan:
   * 1. Status Aktif/Nonaktif sesuai tab filter terpilih.
   * 2. Kecocokan kata kunci pencarian (nama, kategori, atau barcode/SKU).
   */
  const filteredProducts = products.filter((p) => {
    const isActive = p.is_active !== false;
    if (statusFilter === 'active' && !isActive) return false;
    if (statusFilter === 'inactive' && isActive) return false;

    // Filter berdasarkan Unit Bisnis
    if (businessUnitFilter !== 'all') {
      const unit = p.business_unit === 'Tembakau' ? 'Tembakau' : 'Sembako';
      if (unit !== businessUnitFilter) return false;
    }

    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    const nameMatch = p.name.toLowerCase().includes(q);
    const catMatch = p.category?.toLowerCase().includes(q);
    const variantMatch = p.variants?.some(
      (v) =>
        v.variant_name.toLowerCase().includes(q) ||
        (v.barcode && v.barcode.toLowerCase().includes(q))
    );
    return nameMatch || catMatch || variantMatch;
  });

  /**
   * RESET FORMULIR
   * Mengosongkan seluruh field input formulir ke kondisi default.
   */
  const resetForm = () => {
    setEditingProductId(null);
    setEditingVariantId(null);
    setFormName('');
    setFormCategory('');
    setFormBusinessUnit('Sembako');
    setFormVariantName('Standar');
    setFormBarcode('');
    setFormCostPrice('');
    setFormPrice('');
    setFormStock('');
  };

  /**
   * MEMBUKA MODAL FORM TAMBAH PRODUK BARU
   */
  const handleOpenAdd = () => {
    resetForm();
    setFormModalVisible(true);
  };

  /**
   * MEMBUKA MODAL FORM EDIT PRODUK
   * Mengisi seluruh field input dengan data produk & varian yang dipilih.
   */
  const handleOpenEdit = (product: Product, variant: ProductVariant) => {
    setEditingProductId(product.id);
    setEditingVariantId(variant.id);
    setFormName(product.name);
    setFormCategory(product.category || '');
    setFormBusinessUnit(product.business_unit === 'Tembakau' ? 'Tembakau' : 'Sembako');
    setFormVariantName(variant.variant_name);
    setFormBarcode(variant.barcode || '');
    setFormCostPrice(variant.cost_price.toString());
    setFormPrice(variant.price.toString());
    setFormStock(variant.stock.toString());
    setFormModalVisible(true);
  };

  /**
   * MEMBUKA PEMINDAI BARCODE KAMERA UNTUK INPUT FORMULIR
   */
  const handleScanBarcodeForForm = () => {
    navigation.getParent()?.navigate('Scanner', { mode: 'product' });
  };

  /**
   * MENYIMPAN DATA PRODUK (handleSaveProduct)
   */
  const handleSaveProduct = async () => {
    if (!formName.trim()) {
      Alert.alert('Data Belum Lengkap', 'Nama produk tidak boleh kosong.');
      return;
    }
    const priceNum = parseFloat(formPrice) || 0;
    const costPriceNum = parseFloat(formCostPrice) || 0;
    const stockNum = parseInt(formStock, 10) || 0;

    if (priceNum <= 0) {
      Alert.alert('Data Belum Lengkap', 'Harga jual harus lebih dari 0.');
      return;
    }

    setIsSaving(true);
    const isOnline = await checkInternetConnection();

    const userId = await getCurrentUserId();

    try {
      if (editingProductId && editingVariantId) {
        // --- MODE UBAH PRODUK EXISTING ---
        if (isOnline) {
          let pQuery = supabase
            .from('products')
            .update({
              name: formName.trim(),
              category: formCategory.trim() || null,
              business_unit: formBusinessUnit,
            })
            .eq('id', editingProductId);
          if (userId) pQuery = pQuery.eq('user_id', userId);
          await pQuery;

          let vQuery = supabase
            .from('product_variants')
            .update({
              variant_name: formVariantName.trim() || 'Standar',
              barcode: formBarcode.trim() || null,
              cost_price: costPriceNum,
              price: priceNum,
              stock: stockNum,
            })
            .eq('id', editingVariantId);
          if (userId) vQuery = vQuery.eq('user_id', userId);
          await vQuery;
        }

        // Perbarui state lokal dan cache AsyncStorage
        const updated = products.map((p) => {
          if (p.id === editingProductId) {
            return {
              ...p,
              name: formName.trim(),
              category: formCategory.trim() || null,
              business_unit: formBusinessUnit,
              variants: p.variants?.map((v) =>
                v.id === editingVariantId
                  ? {
                      ...v,
                      variant_name: formVariantName.trim() || 'Standar',
                      barcode: formBarcode.trim() || null,
                      cost_price: costPriceNum,
                      price: priceNum,
                      stock: stockNum,
                    }
                  : v
              ),
            };
          }
          return p;
        });
        setProducts(updated);
        await cacheProductsLocally(updated);
      } else {
        // --- MODE TAMBAH PRODUK BARU ---
        const newProdId = `prod_${Date.now()}`;
        const newVarId = `var_${Date.now()}`;

        if (isOnline) {
          const productPayload: any = {
            name: formName.trim(),
            category: formCategory.trim() || null,
            business_unit: formBusinessUnit,
            is_active: true,
          };
          if (userId) productPayload.user_id = userId;

          const { data: newProd, error: pErr } = await supabase
            .from('products')
            .insert(productPayload)
            .select('id')
            .single();

          if (pErr || !newProd) throw new Error(pErr?.message || 'Gagal menyimpan produk ke server');

          const variantPayload: any = {
            product_id: newProd.id,
            variant_name: formVariantName.trim() || 'Standar',
            barcode: formBarcode.trim() || null,
            cost_price: costPriceNum,
            price: priceNum,
            stock: stockNum,
          };
          if (userId) variantPayload.user_id = userId;

          const { data: newVar, error: vErr } = await supabase
            .from('product_variants')
            .insert(variantPayload)
            .select('id')
            .single();

          if (vErr || !newVar) throw new Error(vErr?.message || 'Gagal menyimpan varian produk');

          const createdProduct: Product = {
            id: newProd.id,
            user_id: userId || undefined,
            name: formName.trim(),
            category: formCategory.trim() || null,
            business_unit: formBusinessUnit,
            is_active: true,
            created_at: new Date().toISOString(),
            variants: [
              {
                id: newVar.id,
                user_id: userId || undefined,
                product_id: newProd.id,
                variant_name: formVariantName.trim() || 'Standar',
                barcode: formBarcode.trim() || null,
                cost_price: costPriceNum,
                price: priceNum,
                stock: stockNum,
                created_at: new Date().toISOString(),
              },
            ],
          };
          const newCatalog = [createdProduct, ...products];
          setProducts(newCatalog);
          await cacheProductsLocally(newCatalog);
        } else {
          // Tambah produk saat kondisi offline
          const createdProduct: Product = {
            id: newProdId,
            name: formName.trim(),
            category: formCategory.trim() || null,
            business_unit: formBusinessUnit,
            is_active: true,
            created_at: new Date().toISOString(),
            variants: [
              {
                id: newVarId,
                product_id: newProdId,
                variant_name: formVariantName.trim() || 'Standar',
                barcode: formBarcode.trim() || null,
                cost_price: costPriceNum,
                price: priceNum,
                stock: stockNum,
                created_at: new Date().toISOString(),
              },
            ],
          };
          const newCatalog = [createdProduct, ...products];
          setProducts(newCatalog);
          await cacheProductsLocally(newCatalog);
        }
      }

      setFormModalVisible(false);
      resetForm();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Gagal menyimpan data produk.');
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * TOGGLE STATUS AKTIF / NONAKTIF PRODUK (Soft Delete & Reactivation)
   * 
   * FUNGSI:
   * 1. Menghubungkan klik tombol 'Nonaktifkan'/'Aktifkan' dan ikon gambar mata.
   * 2. Menampilkan konfirmasi dialog kepada pengguna sebelum mengubah status.
   * 3. Menyimpan perubahan status `is_active` secara permanen ke AsyncStorage dan Supabase.
   * 4. Produk nonaktif TETAP MUNCUL di daftar ini dengan tampilan redup (opacity 0.55) & badge "Nonaktif",
   *    namun disembunyikan/dilarang secara total di layar Kasir/Transaksi.
   */
  /**
   * TOGGLE STATUS AKTIF / NONAKTIF PRODUK (Direct Toggle + Permanent Storage)
   * 
   * Bekerja instan baik di Web maupun Mobile:
   * 1. Langsung mengubah status `is_active` (true <-> false) secara instan (0 ms).
   * 2. Menampilkan feedback visual cepat (Toast) agar kasir mengetahui produk dinonaktifkan/diaktifkan.
   * 3. Menyimpan perubahan secara permanen ke AsyncStorage dan Supabase.
   */
  const handleToggleProductStatus = async (product: Product) => {
    const isCurrentlyActive = product.is_active !== false;
    const newStatus = !isCurrentlyActive;
    const cleanId = String(product.id).trim();

    // 1. Optimistic Update: segera ubah visual kartu produk di antarmuka
    setProducts((prev) =>
      prev.map((p) =>
        String(p.id).trim() === cleanId ? { ...p, is_active: newStatus } : p
      )
    );

    // 2. Berikan notifikasi toast visual yang responsif (auto-dismiss 2.5 detik)
    showToast(
      newStatus
        ? `✓ "${product.name}" diaktifkan (tersedia di kasir)`
        : `✓ "${product.name}" dinonaktifkan (disembunyikan dari kasir)`,
      2500
    );

    try {
      // 3. Simpan permanen ke cache lokal AsyncStorage dan Supabase
      await updateProductActiveStatus(cleanId, newStatus);
    } catch (error) {
      console.error('Gagal memperbarui status produk:', error);
      loadData();
    }
  };

  /**
   * MEMBUKA POP-UP KONFIRMASI HAPUS PRODUK
   */
  const handleInitiateDelete = (product: Product) => {
    setProductToDelete(product);
    setDeleteModalVisible(true);
  };

  /**
   * EKSEKUSI HAPUS PRODUK (SMART DELETE BACKEND)
   * 
   * ALUR KERJA:
   * 1. Memanggil service `deleteProduct` di productService.ts.
   * 2. Jika belum pernah transaksi: Hard Delete permanen dari Supabase & cache.
   * 3. Jika sudah ada riwayat transaksi: Soft Delete (is_active = false).
   * 4. State produk langsung ter-refresh secara real-time di UI.
   * 5. Memberikan toast feedback notifikasi sesuai hasil operasi.
   */
  const handleConfirmDelete = async () => {
    if (!productToDelete) return;
    setIsDeleting(true);
    try {
      const variantIds = productToDelete.variants?.map((v) => v.id) || [];
      const result = await deleteProduct(productToDelete.id, variantIds);

      // 1. Refresh state secara instan di UI
      if (result.isSoftDeleted) {
        setProducts((prev) =>
          prev.map((p) =>
            p.id === productToDelete.id ? { ...p, is_active: false } : p
          )
        );
      } else {
        setProducts((prev) => prev.filter((p) => p.id !== productToDelete.id));
      }

      // 2. Tutup pop-up modal konfirmasi
      setDeleteModalVisible(false);
      setProductToDelete(null);

      // 3. Tampilkan toast hasil operasi backend
      showToast(result.message, 3500);

      // 4. Sinkronkan ulang data penuh dari cache & server di background
      await loadData();
    } catch (error: any) {
      Alert.alert('Gagal Menghapus', error?.message || 'Terjadi gangguan saat menghapus produk.');
    } finally {
      setIsDeleting(false);
    }
  };

  // STYLESHEET RESPONSIF TEMA
  const s = makeStyles(theme, isDark);

  const totalProducts = products.length;
  const activeCount = products.filter((p) => p.is_active !== false).length;
  const inactiveCount = totalProducts - activeCount;

  return (
    <SafeAreaView style={s.container} edges={['top', 'left', 'right']}>
      {/* Header Halaman Daftar Produk */}
      <Header
        title="Daftar Produk"
        subtitle={`${activeCount} Produk Aktif${inactiveCount > 0 ? ` • ${inactiveCount} Nonaktif` : ''}`}
        rightAction={
          <View style={s.headerActions}>
            <TouchableOpacity style={s.actionIconBtn} onPress={toggleTheme} activeOpacity={0.75}>
              {isDark ? (
                <Sun size={18} color={theme.colors.warning || '#F59E0B'} />
              ) : (
                <Moon size={18} color={theme.colors.textSecondary || '#64748B'} />
              )}
            </TouchableOpacity>
            <TouchableOpacity style={s.actionIconBtn} onPress={loadData} activeOpacity={0.75}>
              <RefreshCw size={18} color={theme.colors.textSecondary || '#64748B'} />
            </TouchableOpacity>
          </View>
        }
      />

      {/* Baris Pencarian & Tombol Tambah Produk */}
      <View style={s.searchSection}>
        <View style={s.searchBar}>
          <Search size={18} color={theme.colors.textMuted} />
          <TextInput
            style={s.searchInput}
            placeholder="Cari produk, kategori, barcode..."
            placeholderTextColor={theme.colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <X size={16} color={theme.colors.textMuted} />
            </TouchableOpacity>
          ) : null}
        </View>

        <TouchableOpacity style={s.addProductBtn} onPress={handleOpenAdd} activeOpacity={0.8}>
          <Plus size={18} color="#FFFFFF" />
          <Text style={s.addProductBtnText}>Tambah</Text>
        </TouchableOpacity>
      </View>

      {/* Baris Pil Filter Unit Bisnis: Semua Unit, Sembako, Tembakau */}
      <View style={s.businessUnitFilterRow}>
        <TouchableOpacity
          style={[s.businessUnitChip, businessUnitFilter === 'all' && s.businessUnitChipActive]}
          onPress={() => setBusinessUnitFilter('all')}
          activeOpacity={0.8}
        >
          <Text style={[s.businessUnitChipText, businessUnitFilter === 'all' && s.businessUnitChipTextActive]}>
            Semua Unit
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.businessUnitChip, businessUnitFilter === 'Sembako' && s.businessUnitChipActiveSembako]}
          onPress={() => setBusinessUnitFilter('Sembako')}
          activeOpacity={0.8}
        >
          <Text style={[s.businessUnitChipText, businessUnitFilter === 'Sembako' && s.businessUnitChipTextActive]}>
            🌾 Sembako
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.businessUnitChip, businessUnitFilter === 'Tembakau' && s.businessUnitChipActiveTembakau]}
          onPress={() => setBusinessUnitFilter('Tembakau')}
          activeOpacity={0.8}
        >
          <Text style={[s.businessUnitChipText, businessUnitFilter === 'Tembakau' && s.businessUnitChipTextActive]}>
            🚬 Tembakau
          </Text>
        </TouchableOpacity>
      </View>

      {/* Baris Pil Filter Tab Status: Semua, Aktif, Nonaktif */}
      <View style={s.statusFilterRow}>
        {(
          [
            { id: 'all', label: `Semua (${totalProducts})` },
            { id: 'active', label: `Aktif (${activeCount})` },
            { id: 'inactive', label: `Nonaktif (${inactiveCount})` },
          ] as const
        ).map((tab) => {
          const isSelected = statusFilter === tab.id;
          return (
            <TouchableOpacity
              key={tab.id}
              style={[s.statusFilterChip, isSelected && s.statusFilterChipActive]}
              onPress={() => setStatusFilter(tab.id)}
              activeOpacity={0.75}
            >
              <Text style={[s.statusFilterText, isSelected && s.statusFilterTextActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Daftar FlatList Seluruh Produk */}
      <FlatList
        data={filteredProducts}
        keyExtractor={(item) => item.id}
        contentContainerStyle={s.listContent}
        showsVerticalScrollIndicator={false}
        refreshing={loading}
        onRefresh={loadData}
        ListEmptyComponent={
          <View style={s.emptyContainer}>
            <Package size={48} color={theme.colors.textMuted} />
            <Text style={s.emptyTitle}>
              {statusFilter === 'inactive'
                ? 'Tidak Ada Produk Nonaktif'
                : statusFilter === 'active'
                ? 'Tidak Ada Produk Aktif'
                : 'Belum Ada Produk'}
            </Text>
            <Text style={s.emptySubtitle}>
              {statusFilter === 'inactive'
                ? 'Seluruh produk di toko Anda saat ini berstatus aktif.'
                : 'Tekan tombol "+ Tambah" di atas untuk menambahkan produk.'}
            </Text>
          </View>
        }
        renderItem={({ item: product }) => {
          const defaultVariant = product.variants?.[0];
          const stock = defaultVariant?.stock ?? 0;
          const isLowStock = stock <= 5;
          const isActive = product.is_active !== false;

          return (
            <SwipeableProductItem
              key={product.id}
              product={product}
              onDeletePress={handleInitiateDelete}
            >
              <View style={[s.productCard, !isActive && s.productCardInactive]}>
                <View style={s.cardTop}>
                  <View style={s.cardInfo}>
                    <View style={s.badgeRow}>
                      {product.business_unit === 'Tembakau' ? (
                        <View style={s.unitBadgeTembakau}>
                          <Text style={s.unitBadgeTextTembakau}>Tembakau</Text>
                        </View>
                      ) : (
                        <View style={s.unitBadgeSembako}>
                          <Text style={s.unitBadgeTextSembako}>Sembako</Text>
                        </View>
                      )}
                      <View style={s.categoryBadge}>
                        <Text style={s.categoryBadgeText}>{product.category || 'Umum'}</Text>
                      </View>
                      {!isActive && (
                        <View style={s.inactiveBadge}>
                          <Text style={s.inactiveBadgeText}>Nonaktif</Text>
                        </View>
                      )}
                    </View>
                    <Text style={[s.cardTitle, !isActive && s.cardTitleInactive]}>
                      {product.name}
                    </Text>
                    {defaultVariant?.barcode && (
                      <View style={s.barcodeRow}>
                        <ScanBarcode size={13} color={theme.colors.textMuted} />
                        <Text style={s.barcodeText}>{defaultVariant.barcode}</Text>
                      </View>
                    )}
                  </View>

                  {/* Sisi Kanan: Badge Peringatan Stok (Ikon Mata Dihapus untuk Tampilan Lebih Rapi) */}
                  <View style={s.cardTopRight}>
                    <View style={[s.stockBadge, isLowStock ? s.stockBadgeDanger : s.stockBadgeNormal]}>
                      {isLowStock && <AlertTriangle size={12} color={theme.colors.danger} />}
                      <Text style={[s.stockBadgeText, isLowStock && s.stockBadgeTextDanger]}>
                        Stok: {stock}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Rincian Finansial Produk: Harga Modal, Harga Jual, dan Margin Laba */}
                <View style={[s.priceContainer, !isActive && s.priceContainerInactive]}>
                  <View style={s.priceCol}>
                    <Text style={s.priceColLabel}>Harga Modal</Text>
                    <Text style={s.priceColValue}>{formatRupiah(defaultVariant?.cost_price || 0)}</Text>
                  </View>
                  <View style={s.priceCol}>
                    <Text style={s.priceColLabel}>Harga Jual</Text>
                    <Text
                      style={[
                        s.priceColValue,
                        { color: isActive ? theme.colors.success : theme.colors.textSecondary },
                      ]}
                    >
                      {formatRupiah(defaultVariant?.price || 0)}
                    </Text>
                  </View>
                  <View style={s.priceCol}>
                    <Text style={s.priceColLabel}>Margin</Text>
                    <Text
                      style={[
                        s.priceColValue,
                        { color: isActive ? theme.colors.accent : theme.colors.textSecondary },
                      ]}
                    >
                      {formatRupiah((defaultVariant?.price || 0) - (defaultVariant?.cost_price || 0))}
                    </Text>
                  </View>
                </View>

                {/* Tombol Aksi: Edit & Toggle Status (Nonaktifkan / Aktifkan Tetap Dipertahankan) */}
                <View style={s.cardActions}>
                  <TouchableOpacity
                    style={s.cardActionBtn}
                    onPress={() => defaultVariant && handleOpenEdit(product, defaultVariant)}
                  >
                    <Edit2 size={15} color={theme.colors.primary} />
                    <Text style={s.cardActionText}>Ubah</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={s.cardActionBtn}
                    onPress={() => handleToggleProductStatus(product)}
                  >
                    {isActive ? (
                      <>
                        <EyeOff size={15} color={theme.colors.danger} />
                        <Text style={[s.cardActionText, { color: theme.colors.danger }]}>
                          Nonaktifkan
                        </Text>
                      </>
                    ) : (
                      <>
                        <Eye size={15} color={theme.colors.success} />
                        <Text style={[s.cardActionText, { color: theme.colors.success }]}>
                          Aktifkan
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </SwipeableProductItem>
          );
        }}
      />

      {/* ===================================================================== */}
      {/* MODAL DIALOG PRODUK & KONFIRMASI HAPUS (KOMPONEN MODULAR) */}
      {/* ===================================================================== */}
      <ProductModals
        formModalVisible={formModalVisible}
        setFormModalVisible={setFormModalVisible}
        resetForm={resetForm}
        editingProductId={editingProductId}
        formBusinessUnit={formBusinessUnit}
        setFormBusinessUnit={setFormBusinessUnit}
        formName={formName}
        setFormName={setFormName}
        formCategory={formCategory}
        setFormCategory={setFormCategory}
        formBarcode={formBarcode}
        setFormBarcode={setFormBarcode}
        handleScanBarcodeForForm={handleScanBarcodeForForm}
        formCostPrice={formCostPrice}
        setFormCostPrice={setFormCostPrice}
        formPrice={formPrice}
        setFormPrice={setFormPrice}
        formStock={formStock}
        setFormStock={setFormStock}
        isSaving={isSaving}
        handleSaveProduct={handleSaveProduct}
        deleteModalVisible={deleteModalVisible}
        setDeleteModalVisible={setDeleteModalVisible}
        productToDelete={productToDelete}
        setProductToDelete={setProductToDelete}
        isDeleting={isDeleting}
        handleConfirmDelete={handleConfirmDelete}
      />

      {/* Toast Feedback Notifikasi Sementara (Auto-dismiss) */}
      {toastMessage && (
        <Animated.View
          style={[s.toastContainer, { opacity: toastOpacity }]}
          pointerEvents="none"
        >
          {toastMessage.includes('Nonaktif') ? (
            <AlertTriangle size={18} color="#F59E0B" />
          ) : (
            <CheckCircle2 size={18} color="#10B981" />
          )}
          <Text style={s.toastText}>{toastMessage}</Text>
        </Animated.View>
      )}
    </SafeAreaView>
  );
};

export default ProductScreen;