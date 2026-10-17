import React, { useState } from 'react';
import {
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import DateTimePicker, {
  DateTimePickerAndroid,
  DateTimePickerChangeEvent,
} from '@react-native-community/datetimepicker';
import {
  Calendar,
  Download,
  FileSpreadsheet,
  Share2,
  X,
} from 'lucide-react-native';
import { useTheme } from '../../config/ThemeContext';
import { AppTheme } from '../../config/theme';
import {
  formatLocalDate,
  formatRupiah,
  parseLocalDate,
} from '../../services/transactionService';

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

export interface ExportSummaryData {
  totalOmzet: number;
  totalModalHpp: number;
  totalLabaBersih: number;
  totalQty: number;
  totalCount: number;
}

export interface ExportReportModalProps {
  visible: boolean;
  onClose: () => void;
  exportUnit: 'all' | 'Sembako' | 'Tembakau';
  onExportUnitChange: (unit: 'all' | 'Sembako' | 'Tembakau') => void;
  exportPeriod: 'today' | 'week' | 'month' | 'custom';
  onExportPeriodChange: (period: 'today' | 'week' | 'month' | 'custom') => void;
  exportCustomStart: string;
  exportCustomEnd: string;
  onExportCustomStartChange: (date: string) => void;
  onExportCustomEndChange: (date: string) => void;
  summary: ExportSummaryData;
  onSaveToDevice: () => void | Promise<void>;
  onShareReport: () => void | Promise<void>;
  isExporting?: boolean;
}

export const ExportReportModal: React.FC<ExportReportModalProps> = ({
  visible,
  onClose,
  exportUnit,
  onExportUnitChange,
  exportPeriod,
  onExportPeriodChange,
  exportCustomStart,
  exportCustomEnd,
  onExportCustomStartChange,
  onExportCustomEndChange,
  summary,
  onSaveToDevice,
  onShareReport,
  isExporting = false,
}) => {
  const { theme, isDark } = useTheme();
  const accentColor = theme.colors.primary || '#2563EB';

  // State DatePicker iOS
  const [showIosPicker, setShowIosPicker] = useState<boolean>(false);
  const [pickerTarget, setPickerTarget] = useState<'exportStart' | 'exportEnd'>('exportStart');
  const [pickerDate, setPickerDate] = useState<Date>(new Date());

  const handleOpenDatePicker = (target: 'exportStart' | 'exportEnd') => {
    const currentStr = target === 'exportStart' ? exportCustomStart : exportCustomEnd;
    const initialDate = currentStr ? parseLocalDate(currentStr, false) : new Date();

    setPickerTarget(target);
    setPickerDate(initialDate);

    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: initialDate,
        mode: 'date',
        display: 'calendar',
        onValueChange: (_event: DateTimePickerChangeEvent, selectedDate: Date) => {
          if (selectedDate) {
            const formatted = formatLocalDate(selectedDate);
            if (target === 'exportStart') {
              onExportCustomStartChange(formatted);
            } else {
              onExportCustomEndChange(formatted);
            }
          }
        },
      });
    } else {
      setShowIosPicker(true);
    }
  };

  const handleCloseIosPicker = (confirmedDate?: Date) => {
    setShowIosPicker(false);
    if (confirmedDate) {
      const formatted = formatLocalDate(confirmedDate);
      if (pickerTarget === 'exportStart') {
        onExportCustomStartChange(formatted);
      } else {
        onExportCustomEndChange(formatted);
      }
    }
  };

  const s = makeStyles(theme, isDark, accentColor);
  const isMainModalVisible = visible && !showIosPicker;

  return (
    <>
      <Modal
        visible={isMainModalVisible}
        transparent
        animationType="fade"
        onRequestClose={onClose}
      >
        <View style={s.modalOverlay}>
          <View style={s.exportModalCard}>
            {/* Header Modal Export */}
            <View style={s.modalHeader}>
              <View style={s.exportModalTitleGroup}>
                <View style={[s.exportModalIconWrap, { backgroundColor: accentColor }]}>
                  <FileSpreadsheet size={20} color="#FFFFFF" />
                </View>
                <View>
                  <Text style={s.modalTitle}>Pratinjau Export Laporan</Text>
                  <Text style={s.modalSubtitle}>Format CSV / Kompatibel Excel</Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={onClose}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <X size={20} color={theme.colors.textMuted} />
              </TouchableOpacity>
            </View>

            {/* 1. PILIHAN KATEGORI UNIT BISNIS EXPORT */}
            <Text style={s.filterSectionLabel}>Pilihan Kategori Unit Bisnis:</Text>
            <View style={s.filterPillRow}>
              <TouchableOpacity
                style={[s.modalPill, exportUnit === 'all' && s.modalPillActive]}
                onPress={() => onExportUnitChange('all')}
                activeOpacity={0.8}
              >
                <Text style={[s.modalPillText, exportUnit === 'all' && s.modalPillTextActive]}>
                  🏢 Gabungan Semua Toko
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[s.modalPill, exportUnit === 'Sembako' && s.modalPillActiveSembako]}
                onPress={() => onExportUnitChange('Sembako')}
                activeOpacity={0.8}
              >
                <Text style={[s.modalPillText, exportUnit === 'Sembako' && s.modalPillTextActive]}>
                  🌾 Khusus Sembako
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[s.modalPill, exportUnit === 'Tembakau' && s.modalPillActiveTembakau]}
                onPress={() => onExportUnitChange('Tembakau')}
                activeOpacity={0.8}
              >
                <Text style={[s.modalPillText, exportUnit === 'Tembakau' && s.modalPillTextActive]}>
                  🚬 Khusus Tembakau
                </Text>
              </TouchableOpacity>
            </View>

            {/* 2. PILIHAN PERIODE WAKTU EXPORT */}
            <Text style={s.filterSectionLabel}>Pilihan Periode Waktu:</Text>
            <View style={s.filterPillRow}>
              <TouchableOpacity
                style={[s.modalPill, exportPeriod === 'today' && s.modalPillActive]}
                onPress={() => onExportPeriodChange('today')}
                activeOpacity={0.8}
              >
                <Text style={[s.modalPillText, exportPeriod === 'today' && s.modalPillTextActive]}>
                  Hari Ini
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[s.modalPill, exportPeriod === 'week' && s.modalPillActive]}
                onPress={() => onExportPeriodChange('week')}
                activeOpacity={0.8}
              >
                <Text style={[s.modalPillText, exportPeriod === 'week' && s.modalPillTextActive]}>
                  Minggu Ini
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[s.modalPill, exportPeriod === 'month' && s.modalPillActive]}
                onPress={() => onExportPeriodChange('month')}
                activeOpacity={0.8}
              >
                <Text style={[s.modalPillText, exportPeriod === 'month' && s.modalPillTextActive]}>
                  Bulan Ini
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[s.modalPill, exportPeriod === 'custom' && s.modalPillActive]}
                onPress={() => onExportPeriodChange('custom')}
                activeOpacity={0.8}
              >
                <Text style={[s.modalPillText, exportPeriod === 'custom' && s.modalPillTextActive]}>
                  Rentang Custom
                </Text>
              </TouchableOpacity>
            </View>

            {/* Input Tanggal Custom jika dipilih */}
            {exportPeriod === 'custom' && (
              <View style={{ gap: 8, marginBottom: 12 }}>
                <TouchableOpacity
                  style={s.exportDateBtn}
                  onPress={() => handleOpenDatePicker('exportStart')}
                  activeOpacity={0.75}
                >
                  <View style={[s.datePickerIconWrap, { width: 32, height: 32, backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#EEF2F6' }]}>
                    <Calendar size={15} color={accentColor} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.miniDateLabel}>Tanggal Mulai:</Text>
                    <Text style={s.exportDateBtnVal}>{formatDisplayDate(exportCustomStart)}</Text>
                  </View>
                  <View style={s.datePickerBadge}>
                    <Text style={s.datePickerBadgeText}>{exportCustomStart || 'YYYY-MM-DD'}</Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={s.exportDateBtn}
                  onPress={() => handleOpenDatePicker('exportEnd')}
                  activeOpacity={0.75}
                >
                  <View style={[s.datePickerIconWrap, { width: 32, height: 32, backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#EEF2F6' }]}>
                    <Calendar size={15} color={accentColor} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.miniDateLabel}>Tanggal Selesai:</Text>
                    <Text style={s.exportDateBtnVal}>{formatDisplayDate(exportCustomEnd)}</Text>
                  </View>
                  <View style={s.datePickerBadge}>
                    <Text style={s.datePickerBadgeText}>{exportCustomEnd || 'YYYY-MM-DD'}</Text>
                  </View>
                </TouchableOpacity>
              </View>
            )}

            {/* 3. KOTAK REKAPITULASI FINANSIAL REAL-TIME SESUAI FILTER */}
            <Text style={s.filterSectionLabel}>Rekapitulasi Finansial (Otomatis):</Text>
            <View style={s.previewSummaryGrid}>
              <View style={s.previewSummaryBox}>
                <Text style={s.previewSummaryLabel}>Total Omzet / Penjualan</Text>
                <Text style={[s.previewSummaryVal, { color: accentColor }]}>
                  {formatRupiah(summary.totalOmzet)}
                </Text>
              </View>
              <View style={s.previewSummaryBox}>
                <Text style={s.previewSummaryLabel}>Total Modal / HPP</Text>
                <Text style={[s.previewSummaryVal, { color: theme.colors.warning || '#D97706' }]}>
                  {formatRupiah(summary.totalModalHpp)}
                </Text>
              </View>
              <View style={s.previewSummaryBox}>
                <Text style={s.previewSummaryLabel}>Total Laba Bersih</Text>
                <Text
                  style={[
                    s.previewSummaryVal,
                    {
                      color:
                        summary.totalLabaBersih >= 0
                          ? theme.colors.success || '#10B981'
                          : theme.colors.danger || '#EF4444',
                    },
                  ]}
                >
                  {formatRupiah(summary.totalLabaBersih)}
                </Text>
              </View>
              <View style={s.previewSummaryBox}>
                <Text style={s.previewSummaryLabel}>Item Terjual</Text>
                <Text style={s.previewSummaryVal}>{summary.totalQty} Pcs</Text>
              </View>
            </View>

            {/* Total Struk Terhitung */}
            <View style={s.exportMetaRow}>
              <Text style={s.exportMetaText}>
                📊 Total Struk Cocok: <Text style={{ fontWeight: '800' }}>{summary.totalCount}</Text> Transaksi
              </Text>
              <Text style={s.exportNoticeText}>
                * File CSV memuat ringkasan finansial di bagian teratas sebagai acuan kulakan.
              </Text>
            </View>

            {/* Tombol Aksi Export: "Simpan ke HP" & "Bagikan" */}
            <View style={s.exportActionRow}>
              {/* Tombol Simpan ke HP */}
              <TouchableOpacity
                style={[s.actionBtnSave, isExporting && { opacity: 0.6 }]}
                onPress={onSaveToDevice}
                disabled={isExporting}
                activeOpacity={0.8}
              >
                <Download size={16} color="#FFFFFF" />
                <Text style={s.actionBtnSaveText}>{isExporting ? 'Memproses...' : 'Ekspor / Simpan'}</Text>
              </TouchableOpacity>

              {/* Tombol Bagikan */}
              <TouchableOpacity
                style={[s.actionBtnShare, isExporting && { opacity: 0.6 }]}
                onPress={onShareReport}
                disabled={isExporting}
                activeOpacity={0.8}
              >
                <Share2 size={16} color={accentColor} />
                <Text style={[s.actionBtnShareText, { color: accentColor }]}>Bagikan</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* POPUP KALENDER iOS (MODAL INDEPENDEN - LAYER TERDEPAN BEBAS DARI KONFLIK) */}
      {Platform.OS === 'ios' && (
        <Modal
          visible={showIosPicker}
          transparent
          animationType="fade"
          onRequestClose={() => handleCloseIosPicker()}
        >
          <View style={s.iosPickerPopupOverlay}>
            <View style={s.iosPickerPopupCard}>
              <View style={s.iosPickerHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={[s.datePickerIconWrap, { backgroundColor: isDark ? 'rgba(217, 119, 6, 0.2)' : 'rgba(217, 119, 6, 0.12)' }]}>
                    <Calendar size={18} color="#D97706" />
                  </View>
                  <Text style={s.iosPickerTitle}>
                    {pickerTarget === 'exportStart'
                      ? 'Pilih Tanggal Mulai'
                      : 'Pilih Tanggal Selesai'}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => handleCloseIosPicker()}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <X size={20} color={theme.colors.textSecondary} />
                </TouchableOpacity>
              </View>

              <View style={s.iosPickerBody}>
                <DateTimePicker
                  value={pickerDate}
                  mode="date"
                  display="inline"
                  themeVariant={isDark ? 'dark' : 'light'}
                  accentColor="#D97706"
                  onValueChange={(_event: DateTimePickerChangeEvent, selectedDate: Date) => {
                    if (selectedDate) {
                      setPickerDate(selectedDate);
                    }
                  }}
                  onDismiss={() => handleCloseIosPicker()}
                />
              </View>

              <View style={s.iosPickerFooter}>
                <View style={s.iosPickerSelectedBadge}>
                  <Text style={s.iosPickerSelectedBadgeText}>
                    {formatDisplayDate(formatLocalDate(pickerDate))} ({formatLocalDate(pickerDate)})
                  </Text>
                </View>
                <View style={s.iosPickerActions}>
                  <TouchableOpacity
                    style={s.modalBtnSec}
                    onPress={() => handleCloseIosPicker()}
                  >
                    <Text style={s.modalBtnSecTxt}>Batal</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[s.modalBtnPri, { backgroundColor: accentColor }]}
                    onPress={() => handleCloseIosPicker(pickerDate)}
                  >
                    <Text style={s.modalBtnPriTxt}>Pilih Tanggal</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </>
  );
};

const makeStyles = (theme: AppTheme, isDark: boolean, accentColor: string) =>
  StyleSheet.create({
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.65)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    exportModalCard: {
      width: '100%',
      maxWidth: 420,
      backgroundColor: theme.colors.bgCard,
      borderRadius: 22,
      padding: 20,
      borderWidth: 1,
      borderColor: theme.colors.border,
      elevation: 10,
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    exportModalTitleGroup: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    exportModalIconWrap: {
      width: 38,
      height: 38,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    modalTitle: { color: theme.colors.textPrimary, fontSize: 16, fontWeight: '800' },
    modalSubtitle: { color: theme.colors.textMuted, fontSize: 11, marginTop: 1 },
    filterSectionLabel: {
      fontSize: 11,
      fontWeight: '800',
      color: theme.colors.textSecondary,
      marginBottom: 6,
      marginTop: 6,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    filterPillRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
      marginBottom: 10,
    },
    modalPill: {
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 10,
      backgroundColor: theme.colors.bgInput || theme.colors.bgApp,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    modalPillActive: {
      backgroundColor: accentColor,
      borderColor: accentColor,
    },
    modalPillActiveSembako: {
      backgroundColor: '#059669',
      borderColor: '#059669',
    },
    modalPillActiveTembakau: {
      backgroundColor: '#D97706',
      borderColor: '#D97706',
    },
    modalPillText: {
      fontSize: 11,
      fontWeight: '700',
      color: theme.colors.textSecondary,
    },
    modalPillTextActive: {
      color: '#FFFFFF',
    },
    exportDateBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : '#F3F4F6',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : '#E5E7EB',
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    miniDateLabel: {
      fontSize: 10,
      color: theme.colors.textMuted,
      fontWeight: '600',
      marginBottom: 3,
    },
    exportDateBtnVal: {
      fontSize: 13,
      fontWeight: '700',
      color: theme.colors.textPrimary,
    },
    datePickerBadge: {
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#EEF2F6',
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : '#E2E8F0',
    },
    datePickerBadgeText: {
      fontSize: 12,
      fontWeight: '600',
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
      color: theme.colors.textSecondary,
    },
    datePickerIconWrap: {
      width: 36,
      height: 36,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    previewSummaryGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 16,
    },
    previewSummaryBox: {
      width: '48%',
      backgroundColor: theme.colors.bgInput || theme.colors.bgApp,
      padding: 10,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    previewSummaryLabel: { fontSize: 10, color: theme.colors.textMuted, fontWeight: '600' },
    previewSummaryVal: {
      fontSize: 13,
      fontWeight: '800',
      color: theme.colors.textPrimary,
      marginTop: 2,
    },
    exportMetaRow: {
      marginBottom: 14,
      gap: 2,
    },
    exportMetaText: {
      fontSize: 11,
      color: theme.colors.textPrimary,
      fontWeight: '600',
    },
    exportNoticeText: {
      fontSize: 10,
      color: theme.colors.textMuted,
      fontStyle: 'italic',
    },
    exportActionRow: {
      flexDirection: 'row',
      gap: 10,
    },
    actionBtnSave: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      backgroundColor: accentColor,
      paddingVertical: 12,
      borderRadius: 12,
    },
    actionBtnSaveText: {
      color: '#FFFFFF',
      fontSize: 13,
      fontWeight: '800',
    },
    actionBtnShare: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#F1F5F9',
      paddingVertical: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    actionBtnShareText: {
      fontSize: 13,
      fontWeight: '800',
    },

    // iOS Picker Popup
    iosPickerPopupOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 99999,
      elevation: 10,
      padding: 16,
    },
    iosPickerPopupCard: {
      width: '100%',
      maxWidth: 360,
      backgroundColor: theme.colors.bgCard,
      borderRadius: 20,
      padding: 16,
      borderWidth: 1,
      borderColor: theme.colors.border,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.35,
      shadowRadius: 12,
      elevation: 8,
    },
    iosPickerHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 12,
      paddingBottom: 10,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    iosPickerTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: theme.colors.textPrimary,
    },
    iosPickerBody: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 4,
    },
    iosPickerFooter: {
      marginTop: 12,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
      gap: 12,
    },
    iosPickerSelectedBadge: {
      alignSelf: 'center',
      backgroundColor: isDark ? 'rgba(217, 119, 6, 0.15)' : 'rgba(217, 119, 6, 0.1)',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(217, 119, 6, 0.3)' : 'rgba(217, 119, 6, 0.25)',
    },
    iosPickerSelectedBadgeText: {
      fontSize: 12,
      fontWeight: '700',
      color: '#D97706',
    },
    iosPickerActions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: 10,
    },
    modalBtnSec: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
    modalBtnSecTxt: { color: theme.colors.textSecondary, fontWeight: '600', fontSize: 13 },
    modalBtnPri: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 8 },
    modalBtnPriTxt: { color: '#FFFFFF', fontWeight: '800', fontSize: 13 },
  });

export default ExportReportModal;
