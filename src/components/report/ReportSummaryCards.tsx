import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { DollarSign, TrendingUp, Wallet } from 'lucide-react-native';
import { useTheme } from '../../config/ThemeContext';
import { formatRupiah } from '../../services/transactionService';

export interface ReportSummaryCardsProps {
  /** Total omzet / pendapatan kotor */
  totalRevenue?: number;
  revenue?: number;

  /** Total laba bersih (profit) */
  totalProfit?: number;
  profit?: number;

  /** Margin keuntungan (persentase) */
  profitMargin?: number;

  /** Total transaksi struk berhasil */
  totalTransactions?: number;

  /** Total item barang terjual */
  totalItemsSold?: number;
  totalItems?: number;

  /** Total estimasi modal/HPP barang terjual (opsional) */
  totalHpp?: number;
  hpp?: number;

  /** Warna aksen dinamis (opsional, default: theme.colors.primary) */
  accentColor?: string;

  /** Custom formatter mata uang (opsional, default: formatRupiah) */
  formatCurrency?: (value: number) => string;
}

/**
 * Komponen Modular Kartu Ringkasan Finansial Laporan Penjualan
 * Menampilkan Omzet, Laba Bersih, (HPP opsional), Total Transaksi, dan Item Terjual.
 */
export const ReportSummaryCards: React.FC<ReportSummaryCardsProps> = ({
  totalRevenue,
  revenue,
  totalProfit,
  profit,
  profitMargin,
  totalTransactions = 0,
  totalItemsSold,
  totalItems,
  totalHpp,
  hpp,
  accentColor,
  formatCurrency,
}) => {
  const { theme } = useTheme();

  const finalRevenue = totalRevenue ?? revenue ?? 0;
  const finalProfit = totalProfit ?? profit ?? 0;
  const finalHpp = totalHpp ?? hpp;
  const finalItems = totalItemsSold ?? totalItems ?? 0;
  const finalAccentColor = accentColor || theme.colors.primary || '#2563EB';
  const format = formatCurrency || formatRupiah;

  const calculatedMargin =
    profitMargin !== undefined
      ? profitMargin
      : finalRevenue > 0
        ? Math.round((finalProfit / finalRevenue) * 100)
        : 0;

  const successColor = theme.colors.success || '#10B981';
  const dangerColor = theme.colors.danger || '#EF4444';
  const warningColor = theme.colors.warning || '#F59E0B';
  const isProfitPositive = finalProfit >= 0;

  return (
    <View style={styles.container}>
      {/* 1. KARTU METRIK FINANSIAL LENGKAP */}
      <View style={styles.financialRow}>
        {/* Total Pendapatan / Omzet */}
        <View
          style={[
            styles.financialCard,
            { borderColor: finalAccentColor + '40', backgroundColor: theme.colors.bgCard },
          ]}
        >
          <View style={styles.finHeader}>
            <Text style={[styles.finLabel, { color: theme.colors.textSecondary }]}>
              Total Pendapatan (Omzet)
            </Text>
            <View style={[styles.finIcon, { backgroundColor: finalAccentColor + '20' }]}>
              <TrendingUp size={16} color={finalAccentColor} />
            </View>
          </View>
          <Text style={[styles.finValue, { color: finalAccentColor }]}>
            {format(finalRevenue)}
          </Text>
          <Text style={[styles.finSub, { color: theme.colors.textMuted }]}>
            Akumulasi penjualan kotor periode ini
          </Text>
        </View>

        {/* Total Modal / HPP (Opsional jika disediakan) */}
        {finalHpp !== undefined && (
          <View
            style={[
              styles.financialCard,
              { borderColor: warningColor + '40', backgroundColor: theme.colors.bgCard },
            ]}
          >
            <View style={styles.finHeader}>
              <Text style={[styles.finLabel, { color: theme.colors.textSecondary }]}>
                Total Modal (HPP)
              </Text>
              <View style={[styles.finIcon, { backgroundColor: warningColor + '20' }]}>
                <Wallet size={16} color={warningColor} />
              </View>
            </View>
            <Text style={[styles.finValue, { color: warningColor }]}>
              {format(finalHpp)}
            </Text>
            <Text style={[styles.finSub, { color: theme.colors.textMuted }]}>
              Total estimasi modal pokok barang
            </Text>
          </View>
        )}

        {/* Laba Bersih (Real Profit) */}
        <View
          style={[
            styles.financialCard,
            {
              backgroundColor: theme.colors.bgCard,
              borderColor: isProfitPositive ? successColor + '40' : dangerColor + '40',
            },
          ]}
        >
          <View style={styles.finHeader}>
            <Text style={[styles.finLabel, { color: theme.colors.textSecondary }]}>
              {isProfitPositive ? 'Laba Bersih (Real Profit)' : 'Kerugian / Defisit'}
            </Text>
            <View
              style={[
                styles.finIcon,
                {
                  backgroundColor: isProfitPositive ? successColor + '20' : dangerColor + '20',
                },
              ]}
            >
              <DollarSign
                size={16}
                color={isProfitPositive ? successColor : dangerColor}
              />
            </View>
          </View>
          <Text
            style={[
              styles.finValue,
              {
                color: isProfitPositive ? successColor : dangerColor,
              },
            ]}
          >
            {finalProfit < 0
              ? `- ${format(Math.abs(finalProfit))}`
              : format(finalProfit)}
          </Text>
          <Text style={[styles.finSub, { color: theme.colors.textMuted }]}>
            {isProfitPositive
              ? `Margin Keuntungan: ${calculatedMargin}% dari omzet`
              : 'HPP lebih besar dibanding total penjualan'}
          </Text>
        </View>
      </View>

      {/* 2. METRIK RINGKASAN TAMBAHAN (2 KOLOM) */}
      <View style={styles.twoColumnRow}>
        <View
          style={[
            styles.miniCard,
            { backgroundColor: theme.colors.bgCard, borderColor: theme.colors.border },
          ]}
        >
          <Text style={[styles.miniLabel, { color: theme.colors.textSecondary }]}>
            Total Transaksi
          </Text>
          <Text style={[styles.miniValue, { color: theme.colors.textPrimary }]}>
            {totalTransactions}
          </Text>
          <Text style={[styles.miniSub, { color: theme.colors.textMuted }]}>
            Struk berhasil dicetak
          </Text>
        </View>

        <View
          style={[
            styles.miniCard,
            { backgroundColor: theme.colors.bgCard, borderColor: theme.colors.border },
          ]}
        >
          <Text style={[styles.miniLabel, { color: theme.colors.textSecondary }]}>
            Item Terjual
          </Text>
          <Text style={[styles.miniValue, { color: theme.colors.textPrimary }]}>
            {finalItems} Pcs
          </Text>
          <Text style={[styles.miniSub, { color: theme.colors.textMuted }]}>
            Kuantitas barang terjual
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: 16,
  },
  financialRow: {
    gap: 12,
  },
  financialCard: {
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    elevation: 1,
  },
  finHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  finLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  finIcon: {
    padding: 6,
    borderRadius: 10,
  },
  finValue: {
    fontSize: 24,
    fontWeight: '900',
    marginTop: 8,
    letterSpacing: -0.5,
  },
  finSub: {
    fontSize: 11,
    marginTop: 4,
  },
  twoColumnRow: {
    flexDirection: 'row',
    gap: 12,
  },
  miniCard: {
    flex: 1,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
  },
  miniLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  miniValue: {
    fontSize: 18,
    fontWeight: '800',
    marginVertical: 4,
  },
  miniSub: {
    fontSize: 11,
  },
});

export default ReportSummaryCards;
