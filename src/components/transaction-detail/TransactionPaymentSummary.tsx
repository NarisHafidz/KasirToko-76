import React from 'react';
import { View, Text } from 'react-native';
import { CreditCard } from 'lucide-react-native';
import { AppTheme } from '../../config/theme';
import { Transaction } from '../../types/database';
import { formatRupiah as defaultFormatRupiah } from '../../services/transactionService';
import { TransactionDetailStyles } from './TransactionDetailModal.styles';

export interface TransactionPaymentSummaryProps {
  /** Objek data header transaksi */
  transaction: Transaction;
  /** Fungsi pemformat angka mata uang Rupiah */
  formatRupiah?: (amount?: number | null) => string;
  /** Tema aplikasi aktif */
  theme: AppTheme | any;
  /** Objek style modal detail transaksi */
  styles: TransactionDetailStyles;
}

/**
 * Komponen Ringkasan Finansial Pembayaran (Total, Metode, Uang Tunai & Kembalian)
 */
export const TransactionPaymentSummary: React.FC<TransactionPaymentSummaryProps> = ({
  transaction,
  formatRupiah = defaultFormatRupiah,
  theme,
  styles: s,
}) => {
  const methodUpper = (transaction.payment_method || 'CASH').toUpperCase();
  const isCash = methodUpper === 'CASH' || methodUpper === 'TUNAI';

  return (
    <View style={s.paymentSummaryCard}>
      <View style={s.paymentRow}>
        <Text style={s.paymentTotalLabel}>Total Belanja</Text>
        <Text style={s.paymentTotalValue}>
          {formatRupiah(transaction.total_amount)}
        </Text>
      </View>

      <View style={s.divider} />

      <View style={s.paymentRow}>
        <Text style={s.paymentLabel}>Metode Pembayaran</Text>
        <View style={s.methodBadge}>
          <CreditCard size={12} color={theme.colors.textPrimary} />
          <Text style={s.methodText}>{methodUpper}</Text>
        </View>
      </View>

      {isCash && (
        <>
          <View style={s.paymentRow}>
            <Text style={s.paymentLabel}>Uang Diterima</Text>
            <Text style={s.paymentValue}>
              {formatRupiah(transaction.cash_paid || transaction.total_amount)}
            </Text>
          </View>
          <View style={s.paymentRow}>
            <Text style={s.paymentLabel}>Kembalian</Text>
            <Text
              style={[
                s.paymentValue,
                { color: theme.colors.success || '#10B981', fontWeight: '800' },
              ]}
            >
              {formatRupiah(transaction.change_given || 0)}
            </Text>
          </View>
        </>
      )}
    </View>
  );
};
