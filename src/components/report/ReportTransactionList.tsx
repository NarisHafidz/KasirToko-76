import React, { useState } from 'react';
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  CheckCircle2,
  ChevronRight,
  Clock,
  FileText,
  Search,
  X,
} from 'lucide-react-native';
import { useTheme } from '../../config/ThemeContext';
import { AppTheme } from '../../config/theme';
import {
  formatDailyReceiptNumber,
  formatRupiah,
} from '../../services/transactionService';
import { Transaction, TransactionItem } from '../../types/database';

export interface ReportTransactionRecord {
  tx: Transaction;
  items: TransactionItem[];
  isOffline?: boolean;
}

export interface ReportUnitFilterProps {
  selectedUnit: 'all' | 'Sembako' | 'Tembakau';
  onSelectUnit: (unit: 'all' | 'Sembako' | 'Tembakau') => void;
  accentColor?: string;
}

/**
 * Komponen Tab Filter Unit Bisnis Toko
 */
export const ReportUnitFilter: React.FC<ReportUnitFilterProps> = ({
  selectedUnit,
  onSelectUnit,
  accentColor,
}) => {
  const { theme, isDark } = useTheme();
  const finalAccent = accentColor || theme.colors.primary || '#2563EB';
  const s = makeStyles(theme, isDark, finalAccent);

  return (
    <View style={s.unitFilterRow}>
      <TouchableOpacity
        style={[
          s.unitPill,
          selectedUnit === 'all' && [s.unitPillActive, { backgroundColor: finalAccent, borderColor: finalAccent }],
        ]}
        onPress={() => onSelectUnit('all')}
        activeOpacity={0.8}
      >
        <Text style={[s.unitPillText, selectedUnit === 'all' && s.unitPillTextActive]}>
          🏢 Semua Toko
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[s.unitPill, selectedUnit === 'Sembako' && s.unitPillActiveSembako]}
        onPress={() => onSelectUnit('Sembako')}
        activeOpacity={0.8}
      >
        <Text style={[s.unitPillText, selectedUnit === 'Sembako' && s.unitPillTextActive]}>
          🌾 Sembako
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[s.unitPill, selectedUnit === 'Tembakau' && s.unitPillActiveTembakau]}
        onPress={() => onSelectUnit('Tembakau')}
        activeOpacity={0.8}
      >
        <Text style={[s.unitPillText, selectedUnit === 'Tembakau' && s.unitPillTextActive]}>
          🚬 Tembakau
        </Text>
      </TouchableOpacity>
    </View>
  );
};

export interface ReportTransactionListProps {
  /** Daftar transaksi yang sudah difilter dan diurutkan */
  transactions: ReportTransactionRecord[];

  /** Total transaksi mentah dalam periode ini sebelum filter pencarian */
  rawTransactionsCount?: number;

  /** Unit bisnis yang sedang aktif terpilih ('all' | 'Sembako' | 'Tembakau') */
  selectedUnit?: 'all' | 'Sembako' | 'Tembakau';

  /** Handler ketika tab filter unit bisnis diklik */
  onSelectUnit?: (unit: 'all' | 'Sembako' | 'Tembakau') => void;

  /** Kata kunci pencarian (bisa dikontrol dari parent atau internal) */
  searchQuery?: string;

  /** Handler perubahan kata kunci pencarian */
  onSearchQueryChange?: (query: string) => void;

  /** Callback saat sebuah kartu transaksi ditekan */
  onSelectTransaction?: (transaction: ReportTransactionRecord) => void;

  /** Formatter mata uang custom (opsional, default: formatRupiah) */
  formatCurrency?: (val: number) => string;

  /** Warna aksen dinamis (opsional, default: theme.colors.primary) */
  accentColor?: string;

  /** Penanda apakah tab filter unit bisnis ditampilkan (default: true jika onSelectUnit disediakan) */
  showUnitFilter?: boolean;
}

/**
 * Komponen Modular Tabel / List Rincian Transaksi Penjualan
 */
export const ReportTransactionList: React.FC<ReportTransactionListProps> = ({
  transactions,
  rawTransactionsCount,
  selectedUnit = 'all',
  onSelectUnit,
  searchQuery,
  onSearchQueryChange,
  onSelectTransaction,
  formatCurrency,
  accentColor,
  showUnitFilter = true,
}) => {
  const { theme, isDark } = useTheme();
  const finalAccentColor = accentColor || theme.colors.primary || '#2563EB';
  const format = formatCurrency || formatRupiah;

  const [internalQuery, setInternalQuery] = useState<string>('');
  const query = searchQuery !== undefined ? searchQuery : internalQuery;
  const setQuery = onSearchQueryChange || setInternalQuery;

  const s = makeStyles(theme, isDark, finalAccentColor);
  const totalCount = rawTransactionsCount !== undefined ? rawTransactionsCount : transactions.length;

  return (
    <View style={s.historySectionCard}>
      {/* 1. Tab Filter Unit Bisnis (jika diaktifkan) */}
      {showUnitFilter && onSelectUnit && (
        <ReportUnitFilter
          selectedUnit={selectedUnit}
          onSelectUnit={onSelectUnit}
          accentColor={finalAccentColor}
        />
      )}

      {/* 2. Header Seksyen Riwayat */}
      <View style={s.historyHeaderRow}>
        <View style={s.historyHeaderLeft}>
          <View style={[s.historyHeaderIconBox, { backgroundColor: finalAccentColor + '20' }]}>
            <FileText size={18} color={finalAccentColor} />
          </View>
          <View>
            <Text style={s.historySectionTitle}>Daftar Riwayat Transaksi</Text>
            <Text style={s.historySectionSub}>
              {totalCount} total transaksi periode ini
            </Text>
          </View>
        </View>
        {transactions.length > 0 && query.trim() !== '' && (
          <View style={[s.searchCountBadge, { backgroundColor: finalAccentColor + '15' }]}>
            <Text style={[s.searchCountBadgeText, { color: finalAccentColor }]}>
              {transactions.length} cocok
            </Text>
          </View>
        )}
      </View>

      {/* 3. Search Bar Real-Time */}
      <View style={s.searchBarContainer}>
        <Search size={18} color={theme.colors.textMuted} style={s.searchIcon} />
        <TextInput
          style={s.searchInput}
          placeholder="Cari No. Struk (#0001) atau TRX..."
          placeholderTextColor={theme.colors.textMuted}
          value={query}
          onChangeText={setQuery}
          returnKeyType="search"
          autoCapitalize="none"
          autoCorrect={false}
          clearButtonMode="while-editing"
        />
        {query.length > 0 && (
          <TouchableOpacity
            onPress={() => setQuery('')}
            style={s.clearSearchBtn}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel="Hapus kata kunci pencarian"
          >
            <X size={16} color={theme.colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {/* 4. Daftar Kartu Riwayat Transaksi (Scrollable Container Maksimal ~380px) */}
      {transactions.length > 0 ? (
        <View style={s.historyScrollCard}>
          <ScrollView
            style={s.historyScrollView}
            contentContainerStyle={s.historyScrollContent}
            nestedScrollEnabled={true}
            showsVerticalScrollIndicator={true}
            keyboardShouldPersistTaps="handled"
          >
            {transactions.map((item, idx) => {
              const txDate = new Date(item.tx.created_at);
              const dateFormatted = !isNaN(txDate.getTime())
                ? txDate.toLocaleDateString('id-ID', {
                  day: 'numeric',
                  month: 'short',
                }) +
                ', ' +
                txDate.toLocaleTimeString('id-ID', {
                  hour: '2-digit',
                  minute: '2-digit',
                })
                : '-';
              const dailyReceiptNo = formatDailyReceiptNumber(item.tx);
              const isLast = idx === transactions.length - 1;
              const isOffline = item.isOffline;

              return (
                <TouchableOpacity
                  key={item.tx.id || `${item.tx.transaction_code}_${idx}`}
                  style={[s.historyTxCard, isLast && { borderBottomWidth: 0 }]}
                  onPress={() => onSelectTransaction?.(item)}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel={`Transaksi ${dailyReceiptNo} ${item.tx.transaction_code}`}
                >
                  <View style={s.historyTxLeft}>
                    <View
                      style={[
                        s.historyTxIconBox,
                        isOffline
                          ? { backgroundColor: theme.colors.warningLight || '#FEF3C7' }
                          : { backgroundColor: theme.colors.successLight || '#ECFDF5' },
                      ]}
                    >
                      {isOffline ? (
                        <Clock size={18} color={theme.colors.warning || '#D97706'} />
                      ) : (
                        <CheckCircle2 size={18} color={theme.colors.success || '#10B981'} />
                      )}
                    </View>
                    <View style={{ flex: 1, paddingRight: 8 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <Text style={[s.historyReceiptNo, { color: finalAccentColor }]}>
                          {dailyReceiptNo}
                        </Text>
                        <Text style={s.historyTxCode} numberOfLines={1}>
                          • {item.tx.transaction_code}
                        </Text>
                        <View
                          style={[
                            s.historySyncBadge,
                            isOffline ? s.historySyncBadgeOffline : s.historySyncBadgeOnline,
                          ]}
                        >
                          <Text
                            style={[
                              s.historySyncBadgeText,
                              isOffline
                                ? { color: '#D97706' }
                                : { color: theme.colors.success || '#059669' },
                            ]}
                          >
                            {isOffline ? 'Offline' : 'Online'}
                          </Text>
                        </View>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 }}>
                        <Text style={s.historyTxMeta}>{dateFormatted}</Text>
                        <Text style={s.historyTxMeta}>•</Text>
                        <Text style={s.historyTxMeta}>
                          {(item.tx.payment_method || 'CASH').toUpperCase()}
                        </Text>
                        {Boolean((item.tx as any).customer_name) && (
                          <>
                            <Text style={s.historyTxMeta}>•</Text>
                            <Text style={[s.historyTxMeta, { fontWeight: '700', color: theme.colors.textPrimary }]}>
                              {(item.tx as any).customer_name}
                            </Text>
                          </>
                        )}
                      </View>
                    </View>
                  </View>

                  <View style={s.historyTxRight}>
                    <Text style={[s.historyTxAmount, { color: theme.colors.textPrimary }]}>
                      {format(item.tx.total_amount)}
                    </Text>
                    <ChevronRight size={15} color={theme.colors.textMuted} />
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      ) : query.trim() !== '' ? (
        <View style={s.emptyHistoryBox}>
          <Search size={32} color={theme.colors.textMuted} />
          <Text style={s.emptyHistoryTitle}>Tidak Ada Transaksi Cocok</Text>
          <Text style={s.emptyHistorySub}>
            Tidak ditemukan struk atau kode transaksi yang cocok dengan "{query}".
          </Text>
          <TouchableOpacity
            style={s.resetSearchBtn}
            onPress={() => setQuery('')}
            activeOpacity={0.8}
          >
            <Text style={s.resetSearchBtnText}>Hapus Pencarian</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={s.emptyHistoryBox}>
          <Clock size={32} color={theme.colors.textMuted} />
          <Text style={s.emptyHistoryTitle}>Belum Ada Riwayat Transaksi</Text>
          <Text style={s.emptyHistorySub}>
            Belum ada transaksi tercatat untuk periode filter waktu ini.
          </Text>
        </View>
      )}
    </View>
  );
};

const makeStyles = (theme: AppTheme, isDark: boolean, accentColor: string) =>
  StyleSheet.create({
    unitFilterRow: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 14,
      width: '100%',
    },
    unitPill: {
      flex: 1,
      paddingVertical: 8,
      paddingHorizontal: 10,
      borderRadius: 12,
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : '#F8FAFC',
      borderWidth: 1,
      borderColor: theme.colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    unitPillActive: {
      backgroundColor: accentColor,
      borderColor: accentColor,
    },
    unitPillActiveSembako: {
      backgroundColor: '#059669',
      borderColor: '#059669',
    },
    unitPillActiveTembakau: {
      backgroundColor: '#D97706',
      borderColor: '#D97706',
    },
    unitPillText: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.colors.textSecondary,
      flexShrink: 1,
    },
    unitPillTextActive: {
      color: '#FFFFFF',
    },
    historySectionCard: {
      width: '100%',
      backgroundColor: theme.colors.bgCard,
      borderRadius: 18,
      padding: 18,
      borderWidth: 1,
      borderColor: theme.colors.border,
      marginBottom: 0,
    },
    historyHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 14,
    },
    historyHeaderLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    historyHeaderIconBox: {
      width: 36,
      height: 36,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    historySectionTitle: {
      fontSize: 16,
      fontWeight: '800',
      color: theme.colors.textPrimary,
    },
    historySectionSub: {
      fontSize: 11,
      color: theme.colors.textMuted,
      marginTop: 1,
    },
    searchCountBadge: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
    },
    searchCountBadgeText: {
      fontSize: 11,
      fontWeight: '800',
    },
    searchBarContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.bgInput,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: Platform.OS === 'ios' ? 10 : 6,
      borderWidth: 1,
      borderColor: theme.colors.border,
      marginBottom: 14,
    },
    searchIcon: {
      marginRight: 8,
    },
    searchInput: {
      flex: 1,
      fontSize: 13,
      color: theme.colors.textPrimary,
      padding: 0,
      ...(Platform.OS === 'web'
        ? ({
          outlineStyle: 'none',
          outlineWidth: 0,
          boxShadow: 'none',
        } as any)
        : {}),
    },
    clearSearchBtn: {
      padding: 4,
    },
    historyScrollCard: {
      width: 'auto',
      marginHorizontal: -18,
      maxHeight: 380,
      borderBottomLeftRadius: 18,
      borderBottomRightRadius: 18,
      overflow: 'hidden',
    },
    historyScrollView: {
      maxHeight: 380,
    },
    historyScrollContent: {
      paddingHorizontal: 18,
      paddingTop: 2,
      paddingBottom: 14,
    },
    historyTxCard: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    historyTxLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      flex: 1,
    },
    historyTxIconBox: {
      width: 38,
      height: 38,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    historyReceiptNo: {
      fontSize: 14,
      fontWeight: '800',
    },
    historyTxCode: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.colors.textMuted,
      maxWidth: 140,
    },
    historySyncBadge: {
      paddingHorizontal: 6,
      paddingVertical: 1,
      borderRadius: 4,
      borderWidth: 0.5,
    },
    historySyncBadgeOnline: {
      backgroundColor: isDark ? 'rgba(16, 185, 129, 0.15)' : '#ECFDF5',
      borderColor: 'rgba(16, 185, 129, 0.3)',
    },
    historySyncBadgeOffline: {
      backgroundColor: isDark ? 'rgba(245, 158, 11, 0.15)' : '#FFFBEB',
      borderColor: 'rgba(245, 158, 11, 0.3)',
    },
    historySyncBadgeText: {
      fontSize: 9,
      fontWeight: '800',
    },
    historyTxMeta: {
      fontSize: 11,
      color: theme.colors.textMuted,
    },
    historyTxRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    historyTxAmount: {
      fontSize: 14,
      fontWeight: '800',
    },
    emptyHistoryBox: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 28,
      paddingHorizontal: 16,
    },
    emptyHistoryTitle: {
      fontSize: 14,
      fontWeight: '800',
      color: theme.colors.textPrimary,
      marginTop: 10,
    },
    emptyHistorySub: {
      fontSize: 12,
      color: theme.colors.textMuted,
      textAlign: 'center',
      marginTop: 4,
      maxWidth: 280,
    },
    resetSearchBtn: {
      marginTop: 12,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 8,
      backgroundColor: isDark ? 'rgba(37, 99, 235, 0.15)' : '#EFF6FF',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(37, 99, 235, 0.3)' : '#BFDBFE',
    },
    resetSearchBtnText: {
      fontSize: 12,
      fontWeight: '700',
      color: accentColor,
    },
  });

export default ReportTransactionList;
