import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Minus, Plus, ShoppingCart, Trash2, X } from 'lucide-react-native';
import { useTheme } from '../../config/ThemeContext';
import { formatRupiah } from '../../services/transactionService';
import { CartItem } from '../../types/database';

/**
 * Antarmuka Properti Komponen CartDrawer
 */
interface CartDrawerProps {
  /** Array item barang yang ada di dalam keranjang belanja */
  cart: CartItem[];
  /** Akumulasi total kuantitas seluruh item barang */
  totalQuantity: number;
  /** Akumulasi total tagihan belanja dalam Rupiah */
  totalPrice: number;
  /** Callback untuk menambah (+1) atau mengurangi (-1) kuantitas item */
  onUpdateQuantity: (variantId: string, delta: number) => void;
  /** Callback untuk menghapus varian barang tertentu dari keranjang */
  onRemoveFromCart: (variantId: string) => void;
  /** Callback untuk mengosongkan seluruh isi keranjang */
  onClearCart: () => void;
  /** Callback untuk membuka lembar modal proses pembayaran (checkout) */
  onOpenCheckout: () => void;
}

/**
 * Komponen Laci Keranjang Belanja Bawah (CartDrawer)
 * 
 * FUNGSI UTAMA:
 * Menampilkan ringkasan keranjang belanja kasir secara real-time di bagian bawah layar POS:
 * 1. Daftar horizontal scrollable kartu barang yang dibeli beserta harga & kuantitas.
 * 2. Tombol pengubah kuantitas interaktif (+ dan -) per item barang.
 * 3. Tombol hapus satu per satu atau kosongkan seluruh keranjang.
 * 4. Baris total pembayaran dan tombol "Bayar Sekarang" yang langsung membuka proses checkout.
 */
export const CartDrawer: React.FC<CartDrawerProps> = ({
  cart,
  totalQuantity,
  totalPrice,
  onUpdateQuantity,
  onRemoveFromCart,
  onClearCart,
  onOpenCheckout,
}) => {
  const { theme } = useTheme();

  const styles = StyleSheet.create({
    cartSection: {
      backgroundColor: theme.colors.bgCardElevated,
      borderTopLeftRadius: theme.radius.xl,
      borderTopRightRadius: theme.radius.xl,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 16,
      ...theme.shadow.md,
    },
    cartHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    cartTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    cartTitle: { color: theme.colors.textPrimary, fontSize: 15, fontWeight: '700' },
    clearCartBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, padding: 4 },
    clearCartText: { color: theme.colors.danger, fontSize: 12, fontWeight: '600' },
    cartItemsScroll: { gap: 10, paddingVertical: 6 },
    cartItemCard: {
      backgroundColor: theme.colors.bgCard,
      borderRadius: theme.radius.md,
      padding: 10,
      width: 160,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    cartItemTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    cartItemName: {
      color: theme.colors.textPrimary,
      fontSize: 12,
      fontWeight: '700',
      flex: 1,
      marginRight: 6,
    },
    cartItemRemove: {
      padding: 6,
      backgroundColor: theme.colors.dangerLight,
      borderRadius: theme.radius.full,
    },
    cartItemPrice: {
      color: theme.colors.success,
      fontSize: 12,
      fontWeight: '700',
      marginVertical: 4,
    },
    cartQtyControls: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: theme.colors.bgInput,
      borderRadius: theme.radius.sm,
      paddingHorizontal: 8,
      paddingVertical: 6,
    },
    qtyBtn: { padding: 4 },
    qtyNumber: { color: theme.colors.textPrimary, fontSize: 13, fontWeight: '700' },
    cartEmptyContainer: { paddingVertical: 10, alignItems: 'center' },
    cartEmptyText: { color: theme.colors.textMuted, fontSize: 12 },
    checkoutBar: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 10,
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
    },
    checkoutTotalCol: { flex: 1 },
    checkoutTotalLabel: { color: theme.colors.textMuted, fontSize: 11 },
    checkoutTotalAmount: { color: theme.colors.textPrimary, fontSize: 20, fontWeight: '800' },
    checkoutButton: {
      backgroundColor: theme.colors.success,
      paddingHorizontal: 22,
      paddingVertical: 14,
      borderRadius: theme.radius.md,
      ...theme.shadow.sm,
    },
    checkoutButtonDisabled: { backgroundColor: theme.colors.border },
    checkoutButtonText: { color: '#FFFFFF', fontWeight: '800', fontSize: 14 },
  });

  return (
    <View style={styles.cartSection}>
      {/* Header Panel Keranjang: Jumlah Item & Tombol Hapus Semua */}
      <View style={styles.cartHeader}>
        <View style={styles.cartTitleRow}>
          <ShoppingCart size={18} color={theme.colors.primary} />
          <Text style={styles.cartTitle}>Keranjang ({totalQuantity} Item)</Text>
        </View>
        {cart.length > 0 && (
          <TouchableOpacity
            onPress={onClearCart}
            style={styles.clearCartBtn}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Trash2 size={15} color={theme.colors.danger} />
            <Text style={styles.clearCartText}>Hapus Semua</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Daftar Item Belanja (Horizontal ScrollView) */}
      {cart.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.cartItemsScroll}
        >
          {cart.map((item) => (
            <View key={item.variantId} style={styles.cartItemCard}>
              <View style={styles.cartItemTop}>
                <Text style={styles.cartItemName} numberOfLines={1}>
                  {item.productName}
                </Text>
                <TouchableOpacity
                  onPress={() => onRemoveFromCart(item.variantId)}
                  style={styles.cartItemRemove}
                  activeOpacity={0.6}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <X size={14} color={theme.colors.danger} />
                </TouchableOpacity>
              </View>
              <Text style={styles.cartItemPrice}>{formatRupiah(item.price)}</Text>
              {/* Tombol Kontrol Kuantitas: Kurang (-), Jumlah, Tambah (+) */}
              <View style={styles.cartQtyControls}>
                <TouchableOpacity
                  style={styles.qtyBtn}
                  onPress={() => {
                    if (item.quantity === 1) onRemoveFromCart(item.variantId);
                    else onUpdateQuantity(item.variantId, -1);
                  }}
                  activeOpacity={0.7}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Minus size={14} color={theme.colors.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.qtyNumber}>{item.quantity}</Text>
                <TouchableOpacity
                  style={styles.qtyBtn}
                  onPress={() => onUpdateQuantity(item.variantId, 1)}
                  activeOpacity={0.7}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Plus size={14} color={theme.colors.textPrimary} />
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </ScrollView>
      ) : (
        <View style={styles.cartEmptyContainer}>
          <Text style={styles.cartEmptyText}>
            Keranjang masih kosong. Ketuk produk untuk menambahkan.
          </Text>
        </View>
      )}

      {/* Baris Total Belanja & Tombol Konfirmasi Bayar */}
      <View style={styles.checkoutBar}>
        <View style={styles.checkoutTotalCol}>
          <Text style={styles.checkoutTotalLabel}>Total Tagihan</Text>
          <Text style={styles.checkoutTotalAmount}>{formatRupiah(totalPrice)}</Text>
        </View>
        <TouchableOpacity
          style={[styles.checkoutButton, cart.length === 0 && styles.checkoutButtonDisabled]}
          disabled={cart.length === 0}
          onPress={onOpenCheckout}
          activeOpacity={0.8}
        >
          <Text style={styles.checkoutButtonText}>Bayar Sekarang</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default CartDrawer;
