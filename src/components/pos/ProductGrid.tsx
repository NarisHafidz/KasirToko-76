import React from 'react';
import {
  FlatList,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Package, Plus, Search, Store, X } from 'lucide-react-native';
import { useTheme } from '../../config/ThemeContext';
import { formatRupiah } from '../../services/transactionService';
import { Product, ProductVariant } from '../../types/database';

/**
 * Antarmuka Properti Komponen ProductGrid
 */
interface ProductGridProps {
  /** Array seluruh produk aktif yang dimuat */
  products: Product[];
  /** Teks string kata kunci pencarian */
  searchQuery: string;
  /** Callback saat teks pencarian berubah */
  onSearchChange: (text: string) => void;
  /** Unit bisnis yang sedang dipilih ('Semua' | 'Sembako' | 'Tembakau') */
  selectedBusinessUnit?: 'Semua' | 'Sembako' | 'Tembakau';
  /** Callback saat filter unit bisnis berubah */
  onSelectBusinessUnit?: (unit: 'Semua' | 'Sembako' | 'Tembakau') => void;
  /** Kategori yang sedang dipilih ('Semua' atau kategori tertentu) */
  selectedCategory: string;
  /** Callback saat kategori baru dipilih */
  onSelectCategory: (category: string) => void;
  /** Callback saat produk ditekan untuk dimasukkan ke keranjang belanja */
  onAddToCart: (product: Product, variant: ProductVariant) => void;
}

/**
 * Komponen Grid Katalog Produk Kasir (ProductGrid)
 * 
 * FITUR MULTI-BISNIS:
 * 1. Filter Cepat Unit Bisnis: Pill Button [Semua], [Sembako], [Tembakau].
 * 2. Filter Kategori Sekunder yang dinamis sesuai unit terpilih.
 * 3. Badge Penanda Unit Bisnis pada setiap kartu produk (Sembako / Tembakau).
 * 4. Bilah Pencarian Real-Time & Penambahan Cepat ke Keranjang (+).
 */
export const ProductGrid: React.FC<ProductGridProps> = ({
  products,
  searchQuery,
  onSearchChange,
  selectedBusinessUnit = 'Semua',
  onSelectBusinessUnit,
  selectedCategory,
  onSelectCategory,
  onAddToCart,
}) => {
  const { theme, isDark } = useTheme();

  /**
   * Ekstraksi Produk Aktif
   */
  const activeProducts = products.filter((p) => p.is_active !== false);

  /**
   * Saring Kategori Dinamis berdasarkan Unit Bisnis yang sedang aktif
   */
  const businessUnitFilteredProducts = activeProducts.filter((product) => {
    if (selectedBusinessUnit === 'Semua') return true;
    const unit = product.business_unit || 'Sembako';
    return unit === selectedBusinessUnit;
  });

  const categories = [
    'Semua',
    ...Array.from(new Set(businessUnitFilteredProducts.map((p) => p.category).filter(Boolean) as string[])),
  ];

  /**
   * FILTER PRODUK AKHIR (Unit Bisnis + Kategori + Pencarian)
   */
  const filteredProducts = businessUnitFilteredProducts.filter((product) => {
    const matchesCategory = selectedCategory === 'Semua' || product.category === selectedCategory;
    const q = searchQuery.toLowerCase().trim();
    if (!q) return matchesCategory;
    const matchesName = product.name.toLowerCase().includes(q);
    const matchesVariant = product.variants?.some(
      (v) =>
        v.variant_name.toLowerCase().includes(q) ||
        (v.barcode && v.barcode.toLowerCase().includes(q))
    );
    return matchesCategory && (matchesName || matchesVariant);
  });

  const styles = StyleSheet.create({
    container: { flex: 1, width: '100%' },
    filterSection: { width: '100%', paddingHorizontal: 16, paddingTop: 10, paddingBottom: 4 },
    searchBar: {
      width: '100%',
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#F3F4F6',
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: Platform.OS === 'ios' ? 10 : 6,
      gap: 10,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : '#E5E7EB',
    },
    searchInput: {
      flex: 1,
      color: theme.colors.textPrimary,
      fontSize: 14,
      paddingVertical: 6,
      backgroundColor: 'transparent',
      ...(Platform.OS === 'web'
        ? ({
            outlineStyle: 'none',
            outlineWidth: 0,
            boxShadow: 'none',
          } as any)
        : {}),
    },
    
    // TAB PIL FILTER UNIT BISNIS
    businessUnitRow: {
      width: '100%',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingTop: 10,
      paddingBottom: 4,
    },
    businessUnitPill: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 8,
      paddingHorizontal: 10,
      borderRadius: theme.radius.full || 20,
      backgroundColor: theme.colors.bgCard,
      borderWidth: 1.5,
      borderColor: theme.colors.border,
      gap: 6,
    },
    businessUnitPillActive: {
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.primary,
    },
    businessUnitPillActiveSembako: {
      backgroundColor: '#059669', // Emerald
      borderColor: '#059669',
    },
    businessUnitPillActiveTembakau: {
      backgroundColor: '#D97706', // Amber / Tobacco Brown
      borderColor: '#D97706',
    },
    businessUnitText: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.colors.textSecondary,
    },
    businessUnitTextActive: {
      color: '#FFFFFF',
    },

    categoryList: { paddingVertical: 8, gap: 8 },
    categoryPill: {
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderRadius: theme.radius.full,
      backgroundColor: theme.colors.bgCard,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    categoryPillActive: {
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.primary,
    },
    categoryPillText: { color: theme.colors.textSecondary, fontSize: 11, fontWeight: '600' },
    categoryPillTextActive: { color: '#FFFFFF', fontWeight: '700' },
    
    productList: { paddingHorizontal: 16, paddingBottom: 16 },
    productRow: { justifyContent: 'space-between', gap: 12, marginBottom: 12 },
    productCard: {
      flex: 1,
      backgroundColor: theme.colors.bgCard,
      borderRadius: theme.radius.lg,
      padding: 13,
      borderWidth: 1,
      borderColor: theme.colors.border,
      justifyContent: 'space-between',
      ...theme.shadow.sm,
    },
    productHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 6,
    },
    badgesRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      flexWrap: 'wrap',
      flex: 1,
    },
    productBadge: {
      backgroundColor: theme.colors.primaryLight,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
    },
    productBadgeText: { color: theme.colors.primary, fontSize: 9, fontWeight: '700' },
    unitBadgeSembako: {
      backgroundColor: isDark ? 'rgba(16, 185, 129, 0.2)' : '#D1FAE5',
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
    },
    unitBadgeTextSembako: {
      color: isDark ? '#34D399' : '#047857',
      fontSize: 9,
      fontWeight: '800',
    },
    unitBadgeTembakau: {
      backgroundColor: isDark ? 'rgba(245, 158, 11, 0.2)' : '#FEF3C7',
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
    },
    unitBadgeTextTembakau: {
      color: isDark ? '#FBBF24' : '#B45309',
      fontSize: 9,
      fontWeight: '800',
    },
    stockBadge: { fontSize: 10, fontWeight: '700' },
    stockBadgeLow: { color: theme.colors.danger },
    stockBadgeOk: { color: theme.colors.textMuted },
    productName: {
      color: theme.colors.textPrimary,
      fontSize: 13,
      fontWeight: '700',
      lineHeight: 18,
      minHeight: 36,
      marginTop: 2,
      flexShrink: 1,
    },
    variantsCount: { color: theme.colors.textMuted, fontSize: 11, marginTop: 4, flexShrink: 1 },
    productFooter: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 10,
    },
    productPrice: { color: theme.colors.success, fontSize: 13, fontWeight: '800', flexShrink: 1 },
    addIconCircle: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: theme.colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 40, gap: 8 },
    emptyStateTitle: {
      color: theme.colors.textPrimary,
      fontSize: 15,
      fontWeight: '700',
      marginTop: 8,
    },
    emptyStateSubtitle: {
      color: theme.colors.textMuted,
      fontSize: 12,
      textAlign: 'center',
      maxWidth: 240,
    },
  });

  return (
    <View style={styles.container}>
      {/* Seksi Pencarian & Filter Multi-Bisnis */}
      <View style={styles.filterSection}>
        {/* Input Pencarian Barang */}
        <View style={styles.searchBar}>
          <Search size={18} color={theme.colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Cari produk / barcode..."
            placeholderTextColor={theme.colors.textMuted}
            value={searchQuery}
            onChangeText={onSearchChange}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => onSearchChange('')}>
              <X size={16} color={theme.colors.textMuted} />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Tab / Filter Cepat Unit Bisnis: [Semua] [Sembako] [Tembakau] */}
        <View style={styles.businessUnitRow}>
          <TouchableOpacity
            style={[
              styles.businessUnitPill,
              selectedBusinessUnit === 'Semua' && styles.businessUnitPillActive,
            ]}
            onPress={() => onSelectBusinessUnit && onSelectBusinessUnit('Semua')}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.businessUnitText,
                selectedBusinessUnit === 'Semua' && styles.businessUnitTextActive,
              ]}
            >
              Semua
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.businessUnitPill,
              selectedBusinessUnit === 'Sembako' && styles.businessUnitPillActiveSembako,
            ]}
            onPress={() => onSelectBusinessUnit && onSelectBusinessUnit('Sembako')}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.businessUnitText,
                selectedBusinessUnit === 'Sembako' && styles.businessUnitTextActive,
              ]}
            >
              🌾 Sembako
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.businessUnitPill,
              selectedBusinessUnit === 'Tembakau' && styles.businessUnitPillActiveTembakau,
            ]}
            onPress={() => onSelectBusinessUnit && onSelectBusinessUnit('Tembakau')}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.businessUnitText,
                selectedBusinessUnit === 'Tembakau' && styles.businessUnitTextActive,
              ]}
            >
              🚬 Tembakau
            </Text>
          </TouchableOpacity>
        </View>

        {/* Pil Filter Kategori Sekunder (Horizontal ScrollView) */}
        {categories.length > 1 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoryList}
          >
            {categories.map((cat) => {
              const isSelected = selectedCategory === cat;
              return (
                <TouchableOpacity
                  key={cat}
                  style={[styles.categoryPill, isSelected && styles.categoryPillActive]}
                  onPress={() => onSelectCategory(cat)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.categoryPillText, isSelected && styles.categoryPillTextActive]}>
                    {cat}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}
      </View>

      {/* Grid Katalog Produk (FlatList 2 Kolom) */}
      <FlatList
        data={filteredProducts}
        keyExtractor={(item) => item.id}
        numColumns={2}
        contentContainerStyle={styles.productList}
        columnWrapperStyle={styles.productRow}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Package size={38} color={theme.colors.textMuted} />
            <Text style={styles.emptyStateTitle}>Tidak ada produk ditemukan</Text>
            <Text style={styles.emptyStateSubtitle}>
              {selectedBusinessUnit !== 'Semua'
                ? `Tidak ada produk di unit ${selectedBusinessUnit}.`
                : 'Coba kata kunci pencarian lain atau pilih filter Semua.'}
            </Text>
          </View>
        }
        renderItem={({ item: product }) => {
          const defaultVariant = product.variants?.[0];
          const price = defaultVariant?.price ?? 0;
          const stock = defaultVariant?.stock ?? 0;
          const hasMultipleVariants = (product.variants?.length || 0) > 1;
          const isInactive = product.is_active === false;
          const unit = product.business_unit === 'Tembakau' ? 'Tembakau' : 'Sembako';

          return (
            <TouchableOpacity
              style={[styles.productCard, isInactive && { opacity: 0.4 }]}
              activeOpacity={isInactive ? 1 : 0.75}
              disabled={isInactive}
              onPress={() => {
                if (isInactive) return;
                defaultVariant && onAddToCart(product, defaultVariant);
              }}
            >
              {/* Header Kartu: Kategori, Unit Bisnis, & Status Stok */}
              <View style={styles.productHeader}>
                <View style={styles.badgesRow}>
                  {unit === 'Tembakau' ? (
                    <View style={styles.unitBadgeTembakau}>
                      <Text style={styles.unitBadgeTextTembakau}>Tembakau</Text>
                    </View>
                  ) : (
                    <View style={styles.unitBadgeSembako}>
                      <Text style={styles.unitBadgeTextSembako}>Sembako</Text>
                    </View>
                  )}
                  {product.category ? (
                    <View style={styles.productBadge}>
                      <Text style={styles.productBadgeText}>{product.category}</Text>
                    </View>
                  ) : null}
                </View>
                <Text
                  style={[
                    styles.stockBadge,
                    stock <= 5 ? styles.stockBadgeLow : styles.stockBadgeOk,
                  ]}
                >
                  {stock}
                </Text>
              </View>

              {/* Nama Barang */}
              <Text style={styles.productName} numberOfLines={2}>
                {product.name}
              </Text>

              {hasMultipleVariants && (
                <Text style={styles.variantsCount}>
                  {product.variants?.length} varian tersedia
                </Text>
              )}

              {/* Footer Kartu: Harga Jual & Tombol Tambah Cepat */}
              <View style={styles.productFooter}>
                <Text style={styles.productPrice}>{formatRupiah(price)}</Text>
                <View style={styles.addIconCircle}>
                  <Plus size={16} color="#FFFFFF" />
                </View>
              </View>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
};

export default ProductGrid;
