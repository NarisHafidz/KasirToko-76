import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import {
  Calendar,
  Check,
  Download,
  FileSpreadsheet,
  Layers,
  Moon,
  RefreshCw,
  Share2,
  ShoppingBag,
  Sun,
  TrendingDown,
  Wifi,
  WifiOff,
} from 'lucide-react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Header,
  TransactionDetailModal,
  CustomDateFilterModal,
  ExportReportModal,
  ReportSummaryCards,
  ReportAnalyticsChart,
  ReportTransactionList,
  ReportTransactionRecord,
  ChartDataPoint,
} from '../components';
import { useAuth } from '../config/AuthContext';
import { getCurrentUserId, supabase } from '../config/supabase';
import { useTheme } from '../config/ThemeContext';
import { AppTheme } from '../config/theme';
import { makeStyles } from './ReportScreen.styles';
import { getLocalProducts } from '../services/productService';
import { checkInternetConnection, getOfflineQueue } from '../services/syncService';
import {
  formatDailyReceiptNumber,
  formatLocalDate,
  formatRupiah,
  getEndOfLocalDay,
  getStartOfLocalDay,
  parseLocalDate,
} from '../services/transactionService';
import { Transaction, TransactionItem } from '../types/database';

/**
 * Tipe Opsi Filter Periode Waktu Laporan:
 * - 'today': Hari ini (Aksen Biru #2563EB)
 * - 'month': Bulan ini (Aksen Ungu #8B5CF6)
 * - 'year': Tahun ini (Aksen Hijau Teal #0D9488)
 * - 'custom': Rentang tanggal manual (Aksen Amber #D97706)
 */
type FilterType = 'today' | 'week' | 'month' | 'year' | 'custom';

/**
 * Struktur Data Rincian Kategori Terlaris
 */
interface CategoryBreakdown {
  name: string;
  amount: number;
  pct: string;
  color: string;
}

/**
 * Komponen Layar Laporan Finansial & Analisis Penjualan (ReportScreen)
 */
export const ReportScreen: React.FC = () => {
  const { theme, isDark, toggleTheme } = useTheme();
  const { user } = useAuth();

  // ==========================================
  // STATE MANAGEMENT FILTER WAKTU & PERIODE
  // ==========================================
  const [filterType, setFilterType] = useState<FilterType>('today');
  const [selectedBusinessUnit, setSelectedBusinessUnit] = useState<'all' | 'Sembako' | 'Tembakau'>('all');
  const [customModalVisible, setCustomModalVisible] = useState<boolean>(false);
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [activeCustomRange, setActiveCustomRange] = useState<{
    start: Date;
    end: Date;
    startStr: string;
    endStr: string;
  } | null>(null);

  // ==========================================
  // STATE MANAGEMENT METRIK FINANSIAL & GRAFIK
  // ==========================================
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [totalRevenue, setTotalRevenue] = useState<number>(0);
  const [totalProfit, setTotalProfit] = useState<number>(0);
  const [totalTransactions, setTotalTransactions] = useState<number>(0);
  const [totalItemsSold, setTotalItemsSold] = useState<number>(0);
  const [previousPeriodRevenue, setPreviousPeriodRevenue] = useState<number>(0);
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [categories, setCategories] = useState<CategoryBreakdown[]>([]);
  const [rawTransactions, setRawTransactions] = useState<ReportTransactionRecord[]>([]);
  const [variantInfoMap, setVariantInfoMap] = useState<Record<string, { costPrice: number; category: string; productName: string; businessUnit: string }>>({});

  // ==========================================
  // STATE MANAGEMENT RIWAYAT TRANSAKSI & SEARCH BAR
  // ==========================================
  const [txSearchQuery, setTxSearchQuery] = useState<string>('');
  const [selectedHistoryTx, setSelectedHistoryTx] = useState<ReportTransactionRecord | null>(null);
  const [historyDetailModalVisible, setHistoryDetailModalVisible] = useState<boolean>(false);

  // ==========================================
  // STATE MANAGEMENT MODAL PREVIEW EXPORT LAPORAN
  // ==========================================
  const [exportModalVisible, setExportModalVisible] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportUnit, setExportUnit] = useState<'all' | 'Sembako' | 'Tembakau'>('all');
  const [exportPeriod, setExportPeriod] = useState<'today' | 'week' | 'month' | 'custom'>('today');
  const [exportCustomStart, setExportCustomStart] = useState<string>('');
  const [exportCustomEnd, setExportCustomEnd] = useState<string>('');

  // ==========================================
  // PALET WARNA AKSEN DINAMIS BERDASARKAN FILTER AKTIF
  // ==========================================
  const accentColor = useMemo(() => {
    switch (filterType) {
      case 'today':
        return '#2563EB'; // Electric Blue
      case 'week':
        return '#059669'; // Emerald Green
      case 'month':
        return '#8B5CF6'; // Vibrant Purple
      case 'year':
        return '#0D9488'; // Emerald Teal
      case 'custom':
        return '#D97706'; // Warm Amber
    }
  }, [filterType]);

  const CATEGORY_COLORS = [
    accentColor,
    theme.colors.success || '#10B981',
    theme.colors.warning || '#F59E0B',
    '#EC4899',
    '#06B6D4',
    '#6366F1',
  ];

  /**
   * FUNGSI KALKULASI & AGREGASI DATA LAPORAN (loadReportData)
   * 
   * TAHAPAN KALKULASI:
   * 1. Menentukan rentang tanggal saat ini (startDate s/d endDate) dan rentang pembanding periode sebelumnya.
   * 2. Membuat tabel referensi HPP & Kategori produk dari penyimpanan lokal.
   * 3. Menarik transaksi dari offline queue dan Supabase cloud.
   * 4. Menghitung omzet, laba bersih (Subtotal - HPP), dan total kuantitas item terjual.
   * 5. Mengelompokkan titik data untuk grafik garis (per jam untuk 'today', per bulan untuk periode lainnya).
   * 6. Menghitung persentase pertumbuhan dibanding periode pembanding sebelumnya.
   */
  const loadReportData = useCallback(async () => {
    setLoading(true);
    const now = new Date();
    let startDate: Date;
    let endDate: Date;
    let prevStartDate: Date;
    let prevEndDate: Date;

    // 1. Tentukan batas rentang tanggal aktif dan tanggal pembanding berdasarkan waktu lokal pengguna (WIB / UTC+7)
    if (filterType === 'today') {
      startDate = getStartOfLocalDay(now);
      endDate = getEndOfLocalDay(now);

      // Pembanding: Hari kemarin penuh (00:00:00 - 23:59:59.999)
      const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
      prevStartDate = getStartOfLocalDay(yesterday);
      prevEndDate = getEndOfLocalDay(yesterday);
    } else if (filterType === 'week') {
      const day = now.getDay();
      const diffToMonday = day === 0 ? 6 : day - 1;
      const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diffToMonday);
      const sunday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + (6 - diffToMonday));
      startDate = getStartOfLocalDay(monday);
      endDate = getEndOfLocalDay(sunday);

      // Pembanding: 7 hari sebelumnya
      prevStartDate = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() - 7, 0, 0, 0, 0);
      prevEndDate = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() - 1, 23, 59, 59, 999);
    } else if (filterType === 'month') {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

      // Pembanding: Bulan lalu
      prevStartDate = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
      prevEndDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
    } else if (filterType === 'year') {
      startDate = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
      endDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);

      // Pembanding: Tahun lalu
      prevStartDate = new Date(now.getFullYear() - 1, 0, 1, 0, 0, 0, 0);
      prevEndDate = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59, 999);
    } else if (filterType === 'custom' && activeCustomRange) {
      startDate = getStartOfLocalDay(activeCustomRange.start);
      endDate = getEndOfLocalDay(activeCustomRange.end);
      const daysCount = Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000)));
      prevStartDate = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() - daysCount, 0, 0, 0, 0);
      prevEndDate = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() - 1, 23, 59, 59, 999);
    } else {
      startDate = getStartOfLocalDay(now);
      endDate = getEndOfLocalDay(now);
      const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
      prevStartDate = getStartOfLocalDay(yesterday);
      prevEndDate = getEndOfLocalDay(yesterday);
    }

    // Konversi batas tanggal ke epoch milliseconds untuk komparasi numerik akurat
    const startTimeMs = startDate.getTime();
    const endTimeMs = endDate.getTime();
    const prevStartTimeMs = prevStartDate.getTime();
    const prevEndTimeMs = prevEndDate.getTime();

    // 2. Buat tabel referensi HPP & kategori produk
    const localProducts = await getLocalProducts();
    const variantMap: Record<string, { costPrice: number; category: string; productName: string; businessUnit: string }> = {};
    for (const p of localProducts) {
      if (p.variants) {
        for (const v of p.variants) {
          variantMap[v.id] = {
            costPrice: Number(v.cost_price) || 0,
            category: p.category || 'Umum',
            productName: p.name,
            businessUnit: p.business_unit || 'Sembako',
          };
        }
      }
    }
    setVariantInfoMap(variantMap);

    const allTransactions: ReportTransactionRecord[] = [];
    const prevTransactions: Transaction[] = [];
    const seenCodes = new Set<string>();

    // 3. Ambil transaksi dari antrean offline lokal
    const queue = await getOfflineQueue();
    for (const q of queue) {
      if (!q.transaction?.created_at) continue;
      const txTimeMs = new Date(q.transaction.created_at).getTime();
      if (txTimeMs >= startTimeMs && txTimeMs <= endTimeMs && !seenCodes.has(q.transaction.transaction_code)) {
        seenCodes.add(q.transaction.transaction_code);
        allTransactions.push({ tx: q.transaction, items: q.items || [], isOffline: true });
      } else if (txTimeMs >= prevStartTimeMs && txTimeMs <= prevEndTimeMs) {
        prevTransactions.push(q.transaction);
      }
    }

    // 4. Jika perangkat online, tarik data dari database cloud Supabase
    const isOnline = await checkInternetConnection();
    if (isOnline) {
      try {
        const userId = await getCurrentUserId();
        let txQuery = supabase
          .from('transactions')
          .select('*')
          .gte('created_at', prevStartDate.toISOString())
          .lte('created_at', endDate.toISOString())
          .order('created_at', { ascending: true });

        if (userId) {
          txQuery = txQuery.eq('user_id', userId);
        }

        const { data: cloudTx } = await txQuery;

        if (cloudTx && cloudTx.length > 0) {
          const currentTx = cloudTx.filter((t) => {
            if (!t.created_at) return false;
            const txTimeMs = new Date(t.created_at).getTime();
            return txTimeMs >= startTimeMs && txTimeMs <= endTimeMs;
          });

          const prevTx = cloudTx.filter((t) => {
            if (!t.created_at) return false;
            const txTimeMs = new Date(t.created_at).getTime();
            return txTimeMs >= prevStartTimeMs && txTimeMs <= prevEndTimeMs;
          });

          for (const pt of prevTx) {
            prevTransactions.push(pt as Transaction);
          }

          if (currentTx.length > 0) {
            const txIds = currentTx.map((t) => t.id);
            let itemsQuery = supabase
              .from('transaction_items')
              .select('*')
              .in('transaction_id', txIds);

            if (userId) {
              itemsQuery = itemsQuery.eq('user_id', userId);
            }

            const { data: cloudItems } = await itemsQuery;

            const itemsByTxId: Record<string, TransactionItem[]> = {};
            if (cloudItems) {
              for (const item of cloudItems) {
                if (!itemsByTxId[item.transaction_id]) itemsByTxId[item.transaction_id] = [];
                itemsByTxId[item.transaction_id].push(item as TransactionItem);
              }
            }

            for (const tx of currentTx) {
              if (!seenCodes.has(tx.transaction_code)) {
                seenCodes.add(tx.transaction_code);
                allTransactions.push({ tx: tx as Transaction, items: itemsByTxId[tx.id] || [], isOffline: false });
              }
            }
          }
        }
      } catch (err) {
        console.warn('Gagal memuat transaksi cloud untuk laporan:', err);
      }
    }

    // Hitung omzet periode pembanding
    const prevRev = prevTransactions.reduce((sum, t) => sum + Number(t.total_amount || 0), 0);
    setPreviousPeriodRevenue(prevRev);
    setRawTransactions(allTransactions);
    if (allTransactions.length === 0) {
      setLoading(false);
    }
  }, [filterType, activeCustomRange]);

  // =========================================================================
  // RE-RENDER & AGREGASI GRAFIK + METRIK FINANSIAL BERDASARKAN rawTransactions
  // =========================================================================
  useEffect(() => {
    // 5. Agregasi nilai finansial, item terjual, dan titik grafik berdasarkan rawTransactions
    if (rawTransactions.length === 0) {
      setTotalRevenue(0);
      setTotalProfit(0);
      setTotalTransactions(0);
      setTotalItemsSold(0);
      setChartData([]);
      setCategories([]);
      setLoading(false);
      return;
    }

    let calculatedRevenue = 0;
    let calculatedProfit = 0;
    let calculatedItemsSold = 0;
    let countedTransactions = 0;
    const categoryTotals: Record<string, number> = {};
    const groups: Record<string, { label: string; revenue: number; profit: number; order: number }> = {};
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

    for (const record of rawTransactions) {
      let matchingItems = record.items || [];
      if (selectedBusinessUnit !== 'all') {
        matchingItems = matchingItems.filter((it) => {
          const v = variantInfoMap[it.variant_id];
          const unit = v?.businessUnit || 'Sembako';
          return unit === selectedBusinessUnit;
        });
        if (matchingItems.length === 0 && (record.tx as any).business_unit !== selectedBusinessUnit) {
          continue;
        }
      }

      countedTransactions++;
      let txAmount = 0;
      let txProfit = 0;

      // Hitung laba riil & kuantitas item terjual (mengunci modal dari cost_price_at_sale)
      if (matchingItems.length > 0) {
        for (const it of matchingItems) {
          const qty = Number(it.quantity) || 1;
          calculatedItemsSold += qty;
          const subtotal = Number(it.subtotal) || (Number((it as any).price || 0) * qty);
          txAmount += subtotal;

          const variantInfo = variantInfoMap[it.variant_id];
          const unitCostPrice =
            Number((it as any).cost_price_at_sale) || Number(it.cost_price) || variantInfo?.costPrice || 0;
          txProfit += subtotal - unitCostPrice * qty;

          const cat = variantInfo?.category || (it as any).product_name || 'Umum';
          categoryTotals[cat] = (categoryTotals[cat] || 0) + subtotal;
        }
      } else {
        txAmount = Number(record.tx.total_amount) || 0;
        txProfit = txAmount * 0.2;
        calculatedItemsSold += 1;
        categoryTotals['Umum'] = (categoryTotals['Umum'] || 0) + txAmount;
      }

      calculatedRevenue += txAmount;
      calculatedProfit += txProfit;

      const txDate = new Date(record.tx.created_at);
      let groupKey: string;
      let groupLabel: string;
      let groupOrder: number;

      if (filterType === 'today') {
        const hour = isNaN(txDate.getTime()) ? 0 : txDate.getHours();
        groupKey = `hour_${hour}`;
        groupLabel = `${hour}:00`;
        groupOrder = hour;
      } else if (filterType === 'week') {
        const days = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
        const dayIdx = isNaN(txDate.getTime()) ? 0 : txDate.getDay();
        groupKey = `day_${dayIdx}`;
        groupLabel = days[dayIdx];
        groupOrder = dayIdx === 0 ? 7 : dayIdx;
      } else if (filterType === 'month') {
        const day = isNaN(txDate.getTime()) ? 1 : txDate.getDate();
        groupKey = `day_${day}`;
        groupLabel = `Tgl ${day}`;
        groupOrder = day;
      } else if (filterType === 'custom' && activeCustomRange) {
        const diffDays = Math.round(
          (activeCustomRange.end.getTime() - activeCustomRange.start.getTime()) / (24 * 60 * 60 * 1000)
        );
        if (diffDays <= 1) {
          const hour = isNaN(txDate.getTime()) ? 0 : txDate.getHours();
          groupKey = `hour_${hour}`;
          groupLabel = `${hour}:00`;
          groupOrder = hour;
        } else if (diffDays <= 31) {
          const day = isNaN(txDate.getTime()) ? 1 : txDate.getDate();
          const month = isNaN(txDate.getTime()) ? 0 : txDate.getMonth();
          groupKey = `date_${txDate.getFullYear()}_${month}_${day}`;
          groupLabel = `${day} ${monthNames[month]}`;
          groupOrder = txDate.getFullYear() * 10000 + (month + 1) * 100 + day;
        } else {
          const year = isNaN(txDate.getTime()) ? new Date().getFullYear() : txDate.getFullYear();
          const month = isNaN(txDate.getTime()) ? new Date().getMonth() : txDate.getMonth();
          groupKey = `${year}-${String(month + 1).padStart(2, '0')}`;
          groupLabel = monthNames[month];
          groupOrder = year * 100 + month;
        }
      } else {
        const year = isNaN(txDate.getTime()) ? new Date().getFullYear() : txDate.getFullYear();
        const month = isNaN(txDate.getTime()) ? new Date().getMonth() : txDate.getMonth();
        groupKey = `${year}-${String(month + 1).padStart(2, '0')}`;
        groupLabel = monthNames[month];
        groupOrder = year * 100 + month;
      }

      if (!groups[groupKey]) {
        groups[groupKey] = { label: groupLabel, revenue: 0, profit: 0, order: groupOrder };
      }
      groups[groupKey].revenue += txAmount;
      groups[groupKey].profit += txProfit;
    }

    // 6. Format titik data grafik terurut kronologis
    const sortedPoints = Object.values(groups).sort((a, b) => a.order - b.order);
    const avgComparisonPoint = previousPeriodRevenue > 0 && sortedPoints.length > 0 ? previousPeriodRevenue / sortedPoints.length : 0;

    const chartPoints: ChartDataPoint[] = sortedPoints.map((item, idx) => ({
      label: item.label,
      revenue: Math.round(item.revenue),
      profit: Math.round(item.profit),
      comparisonRevenue: Math.round(avgComparisonPoint * (0.8 + (idx % 3) * 0.15)),
    }));

    // 7. Format rincian kategori dari omzet tertinggi
    const catList: CategoryBreakdown[] = Object.entries(categoryTotals)
      .sort(([, a], [, b]) => b - a)
      .map(([name, amount], index) => ({
        name,
        amount: Math.round(amount),
        pct: `${Math.round((amount / (calculatedRevenue || 1)) * 100)}%`,
        color: CATEGORY_COLORS[index % CATEGORY_COLORS.length],
      }));

    setTotalRevenue(calculatedRevenue);
    setTotalProfit(Math.max(0, Math.round(calculatedProfit)));
    setTotalTransactions(countedTransactions);
    setTotalItemsSold(calculatedItemsSold);
    setChartData(chartPoints);
    setCategories(catList);
    setLoading(false);
  }, [rawTransactions, selectedBusinessUnit, filterType, variantInfoMap, previousPeriodRevenue]);

  // Muat data saat komponen aktif atau filter tanggal berubah
  useEffect(() => {
    loadReportData();
  }, [loadReportData]);

  // Berlangganan Realtime Supabase untuk tabel 'transactions' (terisolasi per user_id)
  useEffect(() => {
    const userId = user?.id;
    const filter = userId ? `user_id=eq.${userId}` : undefined;
    const channel = supabase
      .channel(`report_transactions_${userId || 'guest'}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'transactions', filter },
        () => {
          loadReportData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadReportData, user?.id]);

  useFocusEffect(
    useCallback(() => {
      loadReportData();
    }, [loadReportData])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadReportData();
    setRefreshing(false);
  };

  /**
   * HANDLER PERUBAHAN FILTER PERIODE WAKTU
   * Langsung mengosongkan state data grafik & laporan serta mengaktifkan loading
   * sebelum kueri Supabase dieksekusi agar grafik lama tidak berkedip sesaat sebelum data baru dirender.
   */
  const handleSelectFilter = useCallback((type: FilterType) => {
    if (type === filterType && type !== 'custom') return;
    setLoading(true);
    setChartData([]);
    setRawTransactions([]);
    setTotalRevenue(0);
    setTotalProfit(0);
    setTotalTransactions(0);
    setTotalItemsSold(0);
    setCategories([]);
    setActiveCustomRange(null);
    setFilterType(type);
  }, [filterType]);

  /**
   * HANDLER PERUBAHAN FILTER UNIT BISNIS
   * Mengosongkan chartData dan mengaktifkan loading agar proses re-agregasi tidak berkedip
   */
  const handleSelectBusinessUnit = useCallback((unit: 'all' | 'Sembako' | 'Tembakau') => {
    if (unit === selectedBusinessUnit) return;
    setLoading(true);
    setChartData([]);
    setSelectedBusinessUnit(unit);
  }, [selectedBusinessUnit]);

  const handleOpenCustomModal = () => {
    const todayStr = formatLocalDate(new Date());
    setCustomStartDate(activeCustomRange?.startStr || todayStr);
    setCustomEndDate(activeCustomRange?.endStr || todayStr);
    setCustomModalVisible(true);
  };

  /**
   * Helper format tampilan tanggal agar rapi dan mudah dibaca pengguna (misal: 16 Okt 2026)
   */
  const formatDisplayDate = (dateStr: string): string => {
    if (!dateStr) return 'Pilih Tanggal';
    const parts = dateStr.trim().split('-').map((v) => parseInt(v, 10));
    if (parts.length === 3 && !parts.some(isNaN)) {
      const months = [
        'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
        'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'
      ];
      const day = parts[2];
      const month = months[parts[1] - 1] || '';
      const year = parts[0];
      return `${day} ${month} ${year}`;
    }
    return dateStr;
  };

  // =========================================================================
  // KALKULASI PERSENTASE PERTUMBUHAN / PENURUNAN DIBANDING PERIODE SEBELUMNYA
  // =========================================================================
  const growthRate = useMemo(() => {
    if (previousPeriodRevenue <= 0) {
      return totalRevenue > 0 ? 100 : 0;
    }
    const diff = totalRevenue - previousPeriodRevenue;
    return Math.round((diff / previousPeriodRevenue) * 100);
  }, [totalRevenue, previousPeriodRevenue]);

  const isGrowthPositive = growthRate >= 0;

  // =========================================================================
  // LOGIKA GENERASI & EXPORT CSV / EXCEL
  // =========================================================================

  /**
   * KALKULASI DINAMIS DATA EXPORT BERDASARKAN FILTER UNIT BISNIS & PERIODE EXPORT
   */
  const exportData = useMemo(() => {
    const now = new Date();
    let startDate: Date;
    let endDate: Date;

    if (exportPeriod === 'today') {
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    } else if (exportPeriod === 'week') {
      const day = now.getDay();
      const diffToMonday = day === 0 ? 6 : day - 1;
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diffToMonday, 0, 0, 0, 0);
      endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + (6 - diffToMonday), 23, 59, 59, 999);
    } else if (exportPeriod === 'month') {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    } else if (exportPeriod === 'custom' && exportCustomStart && exportCustomEnd) {
      startDate = parseLocalDate(exportCustomStart, false);
      endDate = parseLocalDate(exportCustomEnd, true);
    } else {
      startDate = getStartOfLocalDay(now);
      endDate = getEndOfLocalDay(now);
    }

    let filtered: { tx: Transaction; items: TransactionItem[]; txOmzet: number; txModal: number; txLaba: number; txQty: number }[] = [];
    let omzetTotal = 0;
    let modalTotal = 0;
    let qtyTotal = 0;

    const startMs = startDate.getTime();
    const endMs = endDate.getTime();

    for (const record of rawTransactions) {
      if (!record.tx?.created_at) continue;
      const txTimeMs = new Date(record.tx.created_at).getTime();
      if (txTimeMs < startMs || txTimeMs > endMs) continue;

      let matchingItems = record.items || [];
      if (exportUnit !== 'all') {
        matchingItems = matchingItems.filter((it) => {
          const v = variantInfoMap[it.variant_id];
          const unit = v?.businessUnit || 'Sembako';
          return unit === exportUnit;
        });
        if (matchingItems.length === 0 && (record.tx as any).business_unit !== exportUnit) {
          continue;
        }
      }

      let txOmzet = 0;
      let txModal = 0;
      let txQty = 0;

      if (matchingItems.length > 0) {
        for (const it of matchingItems) {
          const q = Number(it.quantity) || 1;
          const sub = Number(it.subtotal) || (Number((it as any).price || 0) * q);
          const v = variantInfoMap[it.variant_id];
          const cost = Number((it as any).cost_price_at_sale) || Number(it.cost_price) || v?.costPrice || 0;
          txOmzet += sub;
          txModal += cost * q;
          txQty += q;
        }
      } else {
        txOmzet = Number(record.tx.total_amount) || 0;
        txModal = txOmzet * 0.8;
        txQty = 1;
      }

      const txLaba = txOmzet - txModal;
      omzetTotal += txOmzet;
      modalTotal += txModal;
      qtyTotal += txQty;

      filtered.push({
        tx: record.tx,
        items: matchingItems,
        txOmzet,
        txModal,
        txLaba,
        txQty,
      });
    }

    return {
      startDate,
      endDate,
      transactions: filtered,
      totalOmzet: Math.round(omzetTotal),
      totalModalHpp: Math.round(modalTotal),
      totalLabaBersih: Math.round(omzetTotal - modalTotal),
      totalQty: qtyTotal,
      totalCount: filtered.length,
    };
  }, [rawTransactions, variantInfoMap, exportUnit, exportPeriod, exportCustomStart, exportCustomEnd]);

  /**
   * BUKA MODAL FILTER EXPORT
   */
  const handleOpenExportModal = () => {
    setExportUnit(selectedBusinessUnit);
    setExportPeriod(filterType === 'year' ? 'month' : (filterType as any));
    const todayStr = formatLocalDate(new Date());
    setExportCustomStart(activeCustomRange?.startStr || todayStr);
    setExportCustomEnd(activeCustomRange?.endStr || todayStr);
    setExportModalVisible(true);
  };

  /**
   * Menghasilkan teks CSV lengkap dengan BAGIAN RINGKASAN REKAPITULASI FINANSIAL di PALING ATAS
   */
  const generateCsvContent = useCallback((): string => {
    const { startDate, endDate, transactions, totalOmzet, totalModalHpp, totalLabaBersih, totalQty, totalCount } = exportData;

    const unitLabel =
      exportUnit === 'all'
        ? 'Gabungan Semua Toko'
        : exportUnit === 'Sembako'
          ? 'Khusus Sembako'
          : 'Khusus Tembakau';

    const periodLabel =
      exportPeriod === 'today'
        ? 'Hari Ini'
        : exportPeriod === 'week'
          ? 'Minggu Ini'
          : exportPeriod === 'month'
            ? 'Bulan Ini'
            : `Rentang Custom (${formatLocalDate(startDate)} s/d ${formatLocalDate(endDate)})`;

    const exportTime = new Date().toLocaleString('id-ID');

    // =========================================================================
    // BAGIAN PALING ATAS: RINGKASAN REKAPITULASI FINANSIAL LENGKAP
    // =========================================================================
    const recapSection = [
      '========================================================================================',
      'LAPORAN REKAPITULASI FINANSIAL & TRANSAKSI PENJUALAN - KASIRTOKO-76',
      '========================================================================================',
      `Unit Bisnis;${unitLabel}`,
      `Periode Laporan;${periodLabel}`,
      `Tanggal Unduh;${exportTime}`,
      '',
      '----------------------------------------------------------------------------------------',
      'RINGKASAN REKAPITULASI FINANSIAL (ACUAN DANA KULAKAN & KEBUTUHAN HARIAN)',
      '----------------------------------------------------------------------------------------',
      'Indikator Finansial;Format Rupiah / Kuantitas;Nilai Numerik (Acuan Hitung)',
      `Total Omzet / Penjualan Kotor;${formatRupiah(totalOmzet)};${totalOmzet}`,
      `Total Modal / HPP Kulakan;${formatRupiah(totalModalHpp)};${totalModalHpp}`,
      `Total Laba Bersih / Profit;${formatRupiah(totalLabaBersih)};${totalLabaBersih}`,
      `Total Kuantitas Barang Terjual;${totalQty} Pcs;${totalQty}`,
      `Total Jumlah Transaksi;${totalCount} Transaksi;${totalCount}`,
      '========================================================================================',
      '',
      '----------------------------------------------------------------------------------------',
      'RINCIAN TRANSAKSI PENJUALAN',
      '----------------------------------------------------------------------------------------',
    ];

    // Header Tabel Rincian Transaksi
    const tableHeaders = [
      'Kode Transaksi',
      'Tanggal & Waktu',
      'Kasir',
      'Unit Bisnis',
      'Metode Pembayaran',
      'Total Penjualan (Rp)',
      'Total Modal HPP (Rp)',
      'Laba Bersih (Rp)',
      'Total Kuantitas (Pcs)',
    ];

    const dataRows = transactions.map(({ tx, txOmzet, txModal, txLaba, txQty }) => {
      const dateStr = new Date(tx.created_at).toLocaleString('id-ID');
      const cashier = (tx as any).cashier_name || 'Kasir';
      const bUnit = (tx as any).business_unit || 'Sembako';
      return [
        `"${tx.transaction_code}"`,
        `"${dateStr}"`,
        `"${cashier}"`,
        `"${bUnit}"`,
        `"${tx.payment_method.toUpperCase()}"`,
        `${txOmzet}`,
        `${txModal}`,
        `${txLaba}`,
        `${txQty}`,
      ].join(';');
    });

    const fullCsv = [
      ...recapSection,
      tableHeaders.join(';'),
      ...dataRows,
    ].join('\r\n');

    // Gunakan UTF-8 BOM (\uFEFF) agar Microsoft Excel langsung membaca karakter dan format desimal dengan benar
    return '\uFEFF' + fullCsv;
  }, [exportData, exportUnit, exportPeriod]);

  /**
   * HANDLER "EKSPOR / SIMPAN KE HP" (NATIVE SHARING DOKUMEN)
   * 
   * ALUR KERJA:
   * 1. Menulis data CSV ke direktori dokumen lokal perangkat (FileSystem.documentDirectory).
   * 2. Memeriksa ketersediaan modul Sharing via `Sharing.isAvailableAsync()`.
   * 3. Jika tersedia, memicu `Sharing.shareAsync(fileUri)`:
   *    - Di Android: Membuka Android Native Share Intent untuk simpan ke Downloads, WhatsApp, dll.
   *    - Di iOS: Membuka iOS Native Share Sheet untuk opsi "Save to Files", AirDrop, dll.
   * 4. Menangani pengecualian dalam blok try-catch dengan pesan alert informatif.
   */
  const handleSaveToDevice = async () => {
    if (exportData.transactions.length === 0) {
      Alert.alert('Data Kosong', 'Tidak ada data transaksi yang sesuai dengan filter export.');
      return;
    }

    setIsExporting(true);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `Laporan_KasirToko76_${exportUnit}_${exportPeriod}_${timestamp}.csv`;
    const csvData = generateCsvContent();

    try {
      if (Platform.OS === 'web') {
        const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        Alert.alert('Berhasil', `File laporan ${filename} berhasil diunduh.`);
      } else {
        // 1. Simpan file CSV ke direktori dokumen lokal aplikasi
        const targetDir = FileSystem.documentDirectory || FileSystem.cacheDirectory || '';
        const targetUri = `${targetDir}${filename}`;
        await FileSystem.writeAsStringAsync(targetUri, csvData, {
          encoding: 'utf8',
        });

        // 2. Periksa ketersediaan fitur expo-sharing
        const isAvailable = await Sharing.isAvailableAsync();
        if (isAvailable) {
          // 3. Buka Android Share Intent / iOS Share Sheet
          await Sharing.shareAsync(targetUri, {
            mimeType: 'text/csv',
            dialogTitle: 'Simpan / Ekspor Laporan KasirToko-76',
            UTI: 'public.comma-separated-values-text',
          });
        } else {
          Alert.alert(
            'Tersimpan di Perangkat',
            `Laporan berhasil dibuat di direktori dokumen:\n${filename}\n\nFitur berbagi file tidak didukung pada perangkat ini.`
          );
        }
      }
    } catch (err: any) {
      Alert.alert('Gagal Mengekspor', err?.message || 'Terjadi gangguan saat membuat atau membagikan file laporan.');
    } finally {
      setIsExporting(false);
    }
  };

  /**
   * HANDLER "BAGIKAN" (NATIVE SHARE)
   */
  const handleShareReport = async () => {
    if (exportData.transactions.length === 0) {
      Alert.alert('Data Kosong', 'Tidak ada transaksi yang cocok untuk dibagikan.');
      return;
    }

    setIsExporting(true);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `Laporan_KasirToko76_${exportUnit}_${exportPeriod}_${timestamp}.csv`;
    const csvData = generateCsvContent();

    try {
      if (Platform.OS === 'web') {
        if (navigator.share) {
          const file = new File([csvData], filename, { type: 'text/csv' });
          await navigator.share({
            title: 'Laporan Penjualan KasirToko-76',
            text: `Ringkasan Laporan (${exportUnit} - ${exportPeriod}): Omzet ${formatRupiah(exportData.totalOmzet)}, Laba ${formatRupiah(exportData.totalLabaBersih)}.`,
            files: [file],
          });
        } else {
          await Share.share({
            message: `Laporan Penjualan KasirToko-76 (${exportUnit} - ${exportPeriod}): Total Omzet ${formatRupiah(
              exportData.totalOmzet
            )}, Laba Bersih ${formatRupiah(exportData.totalLabaBersih)} dari ${exportData.totalCount} transaksi.`,
          });
        }
      } else {
        const targetDir = FileSystem.documentDirectory || FileSystem.cacheDirectory || '';
        const targetUri = `${targetDir}${filename}`;
        await FileSystem.writeAsStringAsync(targetUri, csvData, {
          encoding: 'utf8',
        });

        const isAvailable = await Sharing.isAvailableAsync();
        if (isAvailable) {
          await Sharing.shareAsync(targetUri, {
            mimeType: 'text/csv',
            dialogTitle: 'Bagikan Laporan Penjualan KasirToko-76',
            UTI: 'public.comma-separated-values-text',
          });
        } else {
          await Share.share({
            title: 'Laporan Penjualan KasirToko-76',
            message: `Laporan Penjualan (${exportUnit} - ${exportPeriod}): Total Omzet ${formatRupiah(
              exportData.totalOmzet
            )}, Laba Bersih ${formatRupiah(exportData.totalLabaBersih)} dari ${exportData.totalCount} transaksi.`,
          });
        }
      }
    } catch (err: any) {
      console.warn('Gagal membagikan laporan:', err);
      Alert.alert('Gagal Membagikan', err?.message || 'Terjadi gangguan saat membagikan laporan.');
    } finally {
      setIsExporting(false);
    }
  };

  /**
   * Riwayat transaksi terurut terbaru ke terlama & terfilter kata kunci pencarian
   */
  const displayedHistoryTransactions = useMemo(() => {
    // 1. Urutkan transaksi dari paling baru ke terlama
    const sorted = [...rawTransactions].sort((a, b) => {
      const timeA = new Date(a.tx.created_at).getTime() || 0;
      const timeB = new Date(b.tx.created_at).getTime() || 0;
      return timeB - timeA;
    });

    // 2. Filter berdasarkan unit bisnis jika dipilih selain 'all'
    let list = sorted;
    if (selectedBusinessUnit !== 'all') {
      list = list.filter((record) => {
        const bu = (record.tx as any).business_unit;
        if (bu && bu !== 'Gabungan') return bu === selectedBusinessUnit;
        return record.items.some((it) => {
          const v = variantInfoMap[it.variant_id];
          return (v?.businessUnit || 'Sembako') === selectedBusinessUnit;
        });
      });
    }

    // 3. Filter berdasarkan input Search Bar (Nomor struk, kode transaksi, catatan/nama pelanggan)
    const q = txSearchQuery.trim().toLowerCase();
    if (!q) return list;

    return list.filter((record) => {
      const dailyReceiptNo = formatDailyReceiptNumber(record.tx).toLowerCase();
      const rawSeq = String(record.tx.invoice_seq ?? '');
      const code = (record.tx.transaction_code || '').toLowerCase();
      const customerName = ((record.tx as any).customer_name || '').toLowerCase();
      const customerPhone = (record.tx.customer_phone || '').toLowerCase();
      const notes = ((record.tx as any).notes || '').toLowerCase();
      const cashier = (record.tx.cashier_name || '').toLowerCase();

      return (
        dailyReceiptNo.includes(q) ||
        rawSeq.includes(q) ||
        code.includes(q) ||
        customerName.includes(q) ||
        customerPhone.includes(q) ||
        notes.includes(q) ||
        cashier.includes(q)
      );
    });
  }, [rawTransactions, txSearchQuery, selectedBusinessUnit, variantInfoMap]);

  // KALKULASI RATA-RATA ORDER & MARGIN KEUNTUNGAN
  const avgOrder = totalTransactions > 0 ? Math.round(totalRevenue / totalTransactions) : 0;
  const profitMargin = totalRevenue > 0 ? Math.round((totalProfit / totalRevenue) * 100) : 0;

  const s = makeStyles(theme, isDark, accentColor);

  return (
    <SafeAreaView style={s.container} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header Halaman Laporan */}
        <Header
          title="Laporan Penjualan"
          subtitle="Analisis Finansial & Omzet Toko"
          rightAction={
            <View style={s.headerActions}>
              <TouchableOpacity style={s.actionIconBtn} onPress={toggleTheme} activeOpacity={0.75}>
                {isDark ? (
                  <Sun size={18} color={theme.colors.warning || '#F59E0B'} />
                ) : (
                  <Moon size={18} color={theme.colors.textSecondary || '#64748B'} />
                )}
              </TouchableOpacity>
              <TouchableOpacity style={s.actionIconBtn} onPress={loadReportData} activeOpacity={0.75}>
                <RefreshCw size={18} color={theme.colors.textSecondary || '#64748B'} />
              </TouchableOpacity>
            </View>
          }
        />

        <ScrollView
          contentContainerStyle={[s.scrollContent, { flexGrow: 1, paddingBottom: 24 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={accentColor} />
          }
        >
          {/* 1. BILAH FILTER WAKTU INTERAKTIF */}
          <View style={s.filterContainer}>
            {/* Filter Periode Cepat */}
            <View style={s.quickFilterBar}>
              <TouchableOpacity
                style={[s.filterTab, filterType === 'today' && s.filterTabActive]}
                onPress={() => handleSelectFilter('today')}
                activeOpacity={0.8}
              >
                <Text style={[s.filterTabText, filterType === 'today' && s.filterTabTextActive]}>
                  Hari Ini
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[s.filterTab, filterType === 'week' && s.filterTabActive]}
                onPress={() => handleSelectFilter('week')}
                activeOpacity={0.8}
              >
                <Text style={[s.filterTabText, filterType === 'week' && s.filterTabTextActive]}>
                  Minggu Ini
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[s.filterTab, filterType === 'month' && s.filterTabActive]}
                onPress={() => handleSelectFilter('month')}
                activeOpacity={0.8}
              >
                <Text style={[s.filterTabText, filterType === 'month' && s.filterTabTextActive]}>
                  Bulan Ini
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[s.filterTab, filterType === 'year' && s.filterTabActive]}
                onPress={() => handleSelectFilter('year')}
                activeOpacity={0.8}
              >
                <Text style={[s.filterTabText, filterType === 'year' && s.filterTabTextActive]}>
                  Tahun Ini
                </Text>
              </TouchableOpacity>
            </View>

            {/* Tombol Filter Tanggal Kustom */}
            <TouchableOpacity
              style={s.customFilterBtn}
              onPress={handleOpenCustomModal}
              activeOpacity={0.8}
            >
              <Calendar size={15} color={filterType === 'custom' ? accentColor : theme.colors.textSecondary} />
              <Text style={s.customFilterBtnText} numberOfLines={1}>
                {filterType === 'custom' && activeCustomRange
                  ? `Kustom: ${activeCustomRange.startStr} s/d ${activeCustomRange.endStr}`
                  : 'Filter Tanggal Kustom'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* 2. TOMBOL UTAMA EXPORT LAPORAN (CSV / EXCEL) */}
          <TouchableOpacity
            style={s.exportTriggerBtn}
            onPress={handleOpenExportModal}
            activeOpacity={0.85}
          >
            <View style={s.exportTriggerLeft}>
              <View style={s.exportIconBox}>
                <FileSpreadsheet size={22} color="#FFFFFF" />
              </View>
              {/* Gunakan flex: 1 & paddingRight agar teks punya ruang aman */}
              <View style={{ flex: 1, paddingRight: 8 }}>
                <Text style={s.exportTriggerTitle}>Export Laporan (CSV / Excel)</Text>
                <Text style={s.exportTriggerSub}>Unduh pratinjau omzet, laba riil,</Text>
                <Text style={s.exportTriggerSub}>& bagikan file struk</Text>
              </View>
            </View>
            <View style={s.exportBadge}>
              <Download size={15} color={accentColor} />
              <Text style={s.exportBadgeText}>Export</Text>
            </View>
          </TouchableOpacity>

          {/* 3. SEKSI GRAFIK GARIS LENGKUNG MODERN (KOMPONEN MODULAR) */}
          <ReportAnalyticsChart
            chartData={chartData}
            loading={loading}
            growthRate={growthRate}
            isGrowthPositive={isGrowthPositive}
            accentColor={accentColor}
          />

          {/* 4. KARTU METRIK FINANSIAL & RINGKASAN (KOMPONEN MODULAR) */}
          <ReportSummaryCards
            totalRevenue={totalRevenue}
            totalProfit={totalProfit}
            profitMargin={profitMargin}
            totalTransactions={totalTransactions}
            totalItemsSold={totalItemsSold}
            accentColor={accentColor}
          />

          {/* 6. RINCIAN KATEGORI TERLARIS */}
          <View style={s.categoryReportCard}>
            <Text style={s.sectionTitle}>Kategori Terlaris</Text>
            {categories.length > 0 ? (
              <View style={s.categoryList}>
                {categories.map((cat) => (
                  <View key={cat.name} style={s.categoryRow}>
                    <View style={s.catLeft}>
                      <View style={[s.catColorDot, { backgroundColor: cat.color }]} />
                      <Text style={s.catName}>{cat.name}</Text>
                    </View>
                    <View style={s.catRight}>
                      <Text style={s.catAmount}>{formatRupiah(cat.amount)}</Text>
                      <Text style={s.catPct}>{cat.pct}</Text>
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <View style={s.emptyCategoryBox}>
                <ShoppingBag size={30} color={theme.colors.textMuted} />
                <Text style={s.emptyCategoryText}>
                  Belum ada rincian transaksi kategori untuk periode ini
                </Text>
              </View>
            )}
          </View>

          {/* 7. DAFTAR RIWAYAT TRANSAKSI LENGKAP & FILTER UNIT BISNIS (KOMPONEN MODULAR) */}
          <ReportTransactionList
            transactions={displayedHistoryTransactions}
            rawTransactionsCount={rawTransactions.length}
            selectedUnit={selectedBusinessUnit}
            onSelectUnit={handleSelectBusinessUnit}
            searchQuery={txSearchQuery}
            onSearchQueryChange={setTxSearchQuery}
            onSelectTransaction={(item) => {
              setSelectedHistoryTx(item);
              setHistoryDetailModalVisible(true);
            }}
            accentColor={accentColor}
          />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ===================================================================== */}
      {/* MODAL PRATINJAU EXPORT LAPORAN CSV / EXCEL (KOMPONEN MODULAR) */}
      {/* ===================================================================== */}
      <ExportReportModal
        visible={exportModalVisible}
        onClose={() => setExportModalVisible(false)}
        exportUnit={exportUnit}
        onExportUnitChange={setExportUnit}
        exportPeriod={exportPeriod}
        onExportPeriodChange={setExportPeriod}
        exportCustomStart={exportCustomStart}
        exportCustomEnd={exportCustomEnd}
        onExportCustomStartChange={setExportCustomStart}
        onExportCustomEndChange={setExportCustomEnd}
        summary={exportData}
        onSaveToDevice={handleSaveToDevice}
        onShareReport={handleShareReport}
        isExporting={isExporting}
      />

      {/* MODAL DIALOG FILTER TANGGAL KUSTOM (KOMPONEN MODULAR) */}
      <CustomDateFilterModal
        visible={customModalVisible}
        onClose={() => setCustomModalVisible(false)}
        onApply={(start, end, startStr, endStr) => {
          setLoading(true);
          setChartData([]);
          setRawTransactions([]);
          setTotalRevenue(0);
          setTotalProfit(0);
          setTotalTransactions(0);
          setTotalItemsSold(0);
          setCategories([]);
          setActiveCustomRange({ start, end, startStr, endStr });
          setFilterType('custom');
          setCustomModalVisible(false);
        }}
        startDate={customStartDate || activeCustomRange?.startStr}
        endDate={customEndDate || activeCustomRange?.endStr}
        onStartDateChange={setCustomStartDate}
        onEndDateChange={setCustomEndDate}
      />

      {/* MODAL PRATINJAU DETAIL TRANSAKSI & CETAK ULANG STRUK */}
      <TransactionDetailModal
        visible={historyDetailModalVisible}
        onClose={() => {
          setHistoryDetailModalVisible(false);
          setSelectedHistoryTx(null);
        }}
        transaction={selectedHistoryTx?.tx || null}
        items={selectedHistoryTx?.items || []}
        isOffline={selectedHistoryTx?.isOffline}
      />
    </SafeAreaView>
  );
};

export default ReportScreen;