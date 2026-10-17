import React, { useCallback, useMemo } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, {
  Circle,
  Defs,
  G,
  Line,
  LinearGradient,
  Path,
  Stop,
  Text as SvgText,
} from 'react-native-svg';
import { ArrowDownRight, ArrowUpRight, BarChart3 } from 'lucide-react-native';
import { useTheme } from '../../config/ThemeContext';
import { AppTheme } from '../../config/theme';

export interface ChartDataPoint {
  label: string;
  revenue: number;
  profit: number;
  comparisonRevenue: number;
}

export interface ReportAnalyticsChartProps {
  /** Titik data untuk grafik omzet & pembanding */
  chartData: ChartDataPoint[];

  /** Status pemuatan data */
  loading?: boolean;

  /** Persentase pertumbuhan dibanding periode pembanding */
  growthRate?: number;

  /** Penanda apakah pertumbuhan positif atau negatif */
  isGrowthPositive?: boolean;

  /** Total pendapatan periode ini (opsional untuk kalkulasi otomatis growth) */
  totalRevenue?: number;

  /** Total pendapatan periode pembanding (opsional untuk kalkulasi otomatis growth) */
  previousPeriodRevenue?: number;

  /** Tipe filter aktif (opsional) */
  activeFilter?: string;

  /** Warna aksen dinamis (default: theme.colors.primary) */
  accentColor?: string;

  /** Judul kartu grafik (default: 'Grafik Tren Penjualan') */
  title?: string;

  /** Subjudul kartu grafik */
  subtitle?: string;

  /** Formatter mata uang (opsional) */
  formatCurrency?: (val: number) => string;
}

const SCREEN_WIDTH = Dimensions.get('window').width;

/**
 * Komponen Modular Grafik Analitik Penjualan (Smooth Curved Bézier Line & Area Chart)
 */
export const ReportAnalyticsChart: React.FC<ReportAnalyticsChartProps> = ({
  chartData,
  loading = false,
  growthRate,
  isGrowthPositive,
  totalRevenue,
  previousPeriodRevenue,
  accentColor,
  title = 'Grafik Tren Penjualan',
  subtitle,
}) => {
  const { theme, isDark } = useTheme();
  const finalAccentColor = accentColor || theme.colors.primary || '#2563EB';

  const s = useMemo(
    () => makeStyles(theme, isDark, finalAccentColor),
    [theme, isDark, finalAccentColor]
  );

  // =========================================================================
  // KALKULASI PERSENTASE PERTUMBUHAN DIBANDING PERIODE SEBELUMNYA
  // =========================================================================
  const finalGrowthRate = useMemo(() => {
    if (growthRate !== undefined) return growthRate;
    if (totalRevenue !== undefined && previousPeriodRevenue !== undefined) {
      if (previousPeriodRevenue <= 0) {
        return totalRevenue > 0 ? 100 : 0;
      }
      const diff = totalRevenue - previousPeriodRevenue;
      return Math.round((diff / previousPeriodRevenue) * 100);
    }
    return null;
  }, [growthRate, totalRevenue, previousPeriodRevenue]);

  const finalIsGrowthPositive =
    isGrowthPositive !== undefined
      ? isGrowthPositive
      : finalGrowthRate !== null
        ? finalGrowthRate >= 0
        : true;

  // =========================================================================
  // GEOMETRI KURVA HALUS (BEZIER CUBIC) UNTUK SVG CHART
  // =========================================================================
  const chartWidth = SCREEN_WIDTH - 64;
  const chartHeight = 160;
  const bottomPadding = 26;
  const topPadding = 20;
  const usableHeight = chartHeight - topPadding - bottomPadding;

  const maxVal = useMemo(() => {
    let m = 1;
    for (const d of chartData) {
      if (d.revenue > m) m = d.revenue;
      if (d.comparisonRevenue > m) m = d.comparisonRevenue;
    }
    return m;
  }, [chartData]);

  // Pemetaan titik koordinat layar (X, Y)
  const linePoints = useMemo(() => {
    if (chartData.length === 0) return [];
    const stepX = chartData.length > 1 ? chartWidth / (chartData.length - 1) : chartWidth / 2;
    return chartData.map((d, i) => {
      const x = chartData.length > 1 ? i * stepX : chartWidth / 2;
      const y = topPadding + usableHeight - (d.revenue / maxVal) * usableHeight;
      return { x, y, ...d };
    });
  }, [chartData, chartWidth, maxVal, topPadding, usableHeight]);

  const comparisonPoints = useMemo(() => {
    if (chartData.length === 0) return [];
    const stepX = chartData.length > 1 ? chartWidth / (chartData.length - 1) : chartWidth / 2;
    return chartData.map((d, i) => {
      const x = chartData.length > 1 ? i * stepX : chartWidth / 2;
      const y = topPadding + usableHeight - (d.comparisonRevenue / maxVal) * usableHeight;
      return { x, y };
    });
  }, [chartData, chartWidth, maxVal, topPadding, usableHeight]);

  /**
   * Helper Matematika untuk Membangun Smooth Curved Path (Bézier Spline)
   */
  const buildSmoothPath = useCallback((pts: { x: number; y: number }[]): string => {
    if (pts.length === 0) return '';
    if (pts.length === 1) return `M ${Math.max(0, pts[0].x - 30)} ${pts[0].y} L ${pts[0].x + 30} ${pts[0].y}`;
    if (pts.length === 2) return `M ${pts[0].x} ${pts[0].y} L ${pts[1].x} ${pts[1].y}`;

    let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = i > 0 ? pts[i - 1] : pts[i];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = i !== pts.length - 2 ? pts[i + 2] : p2;

      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;

      d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
    }
    return d;
  }, []);

  const smoothLineD = useMemo(() => buildSmoothPath(linePoints), [buildSmoothPath, linePoints]);
  const comparisonLineD = useMemo(() => buildSmoothPath(comparisonPoints), [buildSmoothPath, comparisonPoints]);

  const smoothAreaD = useMemo(() => {
    if (linePoints.length === 0 || !smoothLineD) return '';
    const baseY = topPadding + usableHeight;
    const firstX = linePoints.length === 1 ? Math.max(0, linePoints[0].x - 30) : linePoints[0].x;
    const lastX = linePoints.length === 1 ? linePoints[0].x + 30 : linePoints[linePoints.length - 1].x;
    return `${smoothLineD} L ${lastX} ${baseY} L ${firstX} ${baseY} Z`;
  }, [linePoints, smoothLineD, topPadding, usableHeight]);

  const defaultSubtitle = loading
    ? 'Memuat data grafik tren penjualan...'
    : chartData.length > 0
      ? 'Garis lengkung omzet aktual vs periode pembanding'
      : 'Belum ada data untuk ditampilkan';

  return (
    <View style={s.chartCard}>
      {/* Header Grafik: Judul & Indikator Kinerja % Naik/Turun */}
      <View style={s.chartHeader}>
        <View style={{ flex: 1 }}>
          <Text style={s.chartTitle}>{title}</Text>
          <Text style={s.chartSubtitle}>{subtitle || defaultSubtitle}</Text>
        </View>

        {/* Badge Indikator Pertumbuhan */}
        {!loading && chartData.length > 0 && finalGrowthRate !== null && (
          <View
            style={[
              s.growthPill,
              finalIsGrowthPositive ? s.growthPillPositive : s.growthPillNegative,
            ]}
          >
            {finalIsGrowthPositive ? (
              <ArrowUpRight size={14} color="#10B981" />
            ) : (
              <ArrowDownRight size={14} color="#EF4444" />
            )}
            <Text
              style={[
                s.growthPillText,
                { color: finalIsGrowthPositive ? '#10B981' : '#EF4444' },
              ]}
            >
              {finalIsGrowthPositive ? `+${finalGrowthRate}%` : `${finalGrowthRate}%`}
            </Text>
          </View>
        )}
      </View>

      {/* Legenda Grafik */}
      {!loading && chartData.length > 0 && (
        <View style={s.legendRow}>
          <View style={s.legendItem}>
            <View style={[s.legendDot, { backgroundColor: finalAccentColor }]} />
            <Text style={s.legendText}>Periode Ini (Aktual)</Text>
          </View>
          <View style={s.legendItem}>
            <View style={[s.legendDotDashed, { borderColor: theme.colors.textMuted }]} />
            <Text style={s.legendText}>Periode Sebelumnya</Text>
          </View>
        </View>
      )}

      {/* Render SVG Smooth Curved Line Chart atau Loading Indicator */}
      {loading ? (
        <View style={s.chartLoadingBox}>
          <ActivityIndicator size="large" color={finalAccentColor} />
          <Text style={s.chartLoadingText}>Memuat grafik tren penjualan...</Text>
        </View>
      ) : chartData.length > 0 ? (
        <View style={s.svgWrapper}>
          <Svg width={chartWidth} height={chartHeight}>
            <Defs>
              {/* LinearGradient untuk Area di bawah garis lengkung */}
              <LinearGradient id="smoothAreaGrad" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0%" stopColor={finalAccentColor} stopOpacity="0.35" />
                <Stop offset="80%" stopColor={finalAccentColor} stopOpacity="0.06" />
                <Stop offset="100%" stopColor={finalAccentColor} stopOpacity="0.0" />
              </LinearGradient>
            </Defs>

            {/* Grid Lines Horizontal */}
            {[0, 0.33, 0.66, 1].map((ratio) => {
              const y = topPadding + usableHeight * (1 - ratio);
              return (
                <Line
                  key={ratio}
                  x1={0}
                  y1={y}
                  x2={chartWidth}
                  y2={y}
                  stroke={theme.colors.border}
                  strokeWidth={1}
                  strokeDasharray="3, 3"
                />
              );
            })}

            {/* 1. Area Gradien Kurva Halus */}
            {smoothAreaD ? <Path d={smoothAreaD} fill="url(#smoothAreaGrad)" /> : null}

            {/* 2. Garis Pembanding Periode Sebelumnya (Dashed Line) */}
            {comparisonLineD ? (
              <Path
                d={comparisonLineD}
                fill="none"
                stroke={theme.colors.textMuted}
                strokeWidth={1.8}
                strokeDasharray="5, 5"
                opacity={0.7}
              />
            ) : null}

            {/* 3. Garis Lengkung Omzet Utama (Solid Line dengan Aksen Dinamis) */}
            {smoothLineD ? (
              <Path
                d={smoothLineD}
                fill="none"
                stroke={finalAccentColor}
                strokeWidth={3}
                strokeLinecap="round"
              />
            ) : null}

            {/* 4. Titik Lingkaran Interaktif / Glowing Dots pada Data Points */}
            {linePoints.map((p, i) => (
              <G key={i}>
                {/* Ring Luar */}
                <Circle
                  cx={p.x}
                  cy={p.y}
                  r={6}
                  fill={theme.colors.bgCard}
                  stroke={finalAccentColor}
                  strokeWidth={2.5}
                />
                {/* Inti Titik */}
                <Circle cx={p.x} cy={p.y} r={2.5} fill={finalAccentColor} />
                {/* Label Sumbu X */}
                <SvgText
                  x={p.x}
                  y={chartHeight - 4}
                  fill={theme.colors.textMuted}
                  fontSize={10}
                  fontWeight="bold"
                  textAnchor="middle"
                >
                  {p.label}
                </SvgText>
              </G>
            ))}
          </Svg>
        </View>
      ) : (
        <View style={s.emptyChartBox}>
          <BarChart3 size={38} color={theme.colors.textMuted} />
          <Text style={s.emptyChartTitle}>Belum Ada Data Transaksi</Text>
          <Text style={s.emptyChartSub}>
            Grafik garis lengkung akan muncul otomatis setelah transaksi tercatat pada periode ini.
          </Text>
        </View>
      )}
    </View>
  );
};

const makeStyles = (theme: AppTheme, isDark: boolean, accentColor: string) =>
  StyleSheet.create({
    chartCard: {
      backgroundColor: theme.colors.bgCard,
      borderRadius: 20,
      padding: 18,
      borderWidth: 1,
      borderColor: theme.colors.border,
      elevation: 2,
    },
    chartHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 8,
    },
    chartTitle: {
      color: theme.colors.textPrimary,
      fontSize: 15,
      fontWeight: '800',
    },
    chartSubtitle: {
      color: theme.colors.textMuted,
      fontSize: 11,
      marginTop: 2,
    },
    growthPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      paddingHorizontal: 9,
      paddingVertical: 5,
      borderRadius: 999,
      borderWidth: 1,
    },
    growthPillPositive: {
      backgroundColor: isDark ? 'rgba(16, 185, 129, 0.15)' : '#ECFDF5',
      borderColor: isDark ? 'rgba(16, 185, 129, 0.3)' : '#A7F3D0',
    },
    growthPillNegative: {
      backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : '#FEF2F2',
      borderColor: isDark ? 'rgba(239, 68, 68, 0.3)' : '#FECACA',
    },
    growthPillText: {
      fontSize: 11,
      fontWeight: '800',
    },
    legendRow: {
      flexDirection: 'row',
      gap: 16,
      marginBottom: 14,
      marginTop: 4,
    },
    legendItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    legendDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    legendDotDashed: {
      width: 12,
      height: 0,
      borderTopWidth: 2,
      borderStyle: 'dashed',
    },
    legendText: {
      fontSize: 11,
      color: theme.colors.textSecondary,
      fontWeight: '600',
    },
    svgWrapper: {
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 6,
    },
    chartLoadingBox: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 42,
      gap: 12,
      minHeight: 160,
    },
    chartLoadingText: {
      color: theme.colors.textMuted,
      fontSize: 12,
      fontWeight: '600',
    },
    emptyChartBox: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 36,
      gap: 8,
    },
    emptyChartTitle: {
      color: theme.colors.textPrimary,
      fontSize: 15,
      fontWeight: '700',
      marginTop: 4,
    },
    emptyChartSub: {
      color: theme.colors.textMuted,
      fontSize: 12,
      textAlign: 'center',
      maxWidth: 260,
    },
  });

export default ReportAnalyticsChart;
