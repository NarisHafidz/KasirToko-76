import React from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { ShoppingBag } from 'lucide-react-native';
import { AppTheme } from '../../config/theme';
import { TransactionItem } from '../../types/database';
import { formatRupiah as defaultFormatRupiah } from '../../services/transactionService';
import { TransactionDetailStyles } from './TransactionDetailModal.styles';

export interface TransactionItemsTableProps {
  /** Daftar rincian barang transaksi */
  items: TransactionItem[];
  /** Flag indikator pemuatan rincian barang */
  loadingItems?: boolean;
  /** Fungsi pemformat mata uang Rupiah */
  formatRupiah?: (amount?: number | null) => string;
  /** Objek tema aplikasi aktif */
  theme: AppTheme | any;
  /** Objek style modal detail transaksi */
  styles: TransactionDetailStyles;
}

/**
 * Komponen Tabel Rincian Barang Belanjaan (Loading, List Barang, dan Empty State)
 */
export const TransactionItemsTable: React.FC<TransactionItemsTableProps> = ({
  items,
  loadingItems = false,
  formatRupiah = defaultFormatRupiah,
  theme,
  styles: s,
}) => {
  return (
    <View style={s.itemsSection}>
      <View style={s.itemsSectionHeader}>
        <ShoppingBag size={15} color={theme.colors.textPrimary} />
        <Text style={s.itemsSectionTitle}>Rincian Barang ({items.length} item)</Text>
      </View>

      {loadingItems ? (
        <View style={s.loadingItemsBox}>
          <ActivityIndicator size="small" color={theme.colors.primary} />
          <Text style={s.loadingItemsText}>Memuat rincian barang...</Text>
        </View>
      ) : items.length > 0 ? (
        <View style={s.itemsTable}>
          {items.map((it, idx) => {
            const itemName =
              it.product_name ||
              (it as any).product?.name ||
              `Barang #${idx + 1}`;
            const variantName = it.variant_name ? ` (${it.variant_name})` : '';
            const qty = it.quantity || 1;
            const price = Number(it.price_at_sale) || Number((it as any).price) || 0;
            const subtotal = Number(it.subtotal) || qty * price;

            return (
              <View
                key={it.id || `${it.variant_id}_${idx}`}
                style={[
                  s.itemTableRow,
                  idx === items.length - 1 && { borderBottomWidth: 0 },
                ]}
              >
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <Text style={s.itemName} numberOfLines={2}>
                    {itemName}
                    <Text style={s.itemVariant}>{variantName}</Text>
                  </Text>
                  <Text style={s.itemCalc}>
                    {qty} x {formatRupiah(price)}
                  </Text>
                </View>
                <Text style={s.itemSubtotal}>{formatRupiah(subtotal)}</Text>
              </View>
            );
          })}
        </View>
      ) : (
        <View style={s.emptyItemsBox}>
          <Text style={s.emptyItemsText}>
            Rincian kuantitas item tidak tersimpan secara terpisah.
          </Text>
        </View>
      )}
    </View>
  );
};
