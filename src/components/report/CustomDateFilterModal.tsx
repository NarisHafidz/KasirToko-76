import React, { useEffect, useState } from 'react';
import {
  Alert,
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
import { Calendar, X } from 'lucide-react-native';
import { useTheme } from '../../config/ThemeContext';
import { AppTheme } from '../../config/theme';
import { formatLocalDate, parseLocalDate } from '../../services/transactionService';

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

export interface CustomDateFilterModalProps {
  visible: boolean;
  onClose: () => void;
  onApply: (start: Date, end: Date, startStr: string, endStr: string) => void;
  startDate?: string;
  endDate?: string;
  onStartDateChange?: (dateStr: string) => void;
  onEndDateChange?: (dateStr: string) => void;
}

export const CustomDateFilterModal: React.FC<CustomDateFilterModalProps> = ({
  visible,
  onClose,
  onApply,
  startDate = '',
  endDate = '',
  onStartDateChange,
  onEndDateChange,
}) => {
  const { theme, isDark } = useTheme();
  const accentColor = theme.colors.primary || '#2563EB';

  const [internalStartDate, setInternalStartDate] = useState<string>(startDate);
  const [internalEndDate, setInternalEndDate] = useState<string>(endDate);

  // State DatePicker iOS
  const [showIosPicker, setShowIosPicker] = useState<boolean>(false);
  const [pickerTarget, setPickerTarget] = useState<'start' | 'end'>('start');
  const [pickerDate, setPickerDate] = useState<Date>(new Date());

  // Sinkronisasi prop saat modal terbuka
  useEffect(() => {
    if (visible) {
      if (startDate) setInternalStartDate(startDate);
      if (endDate) setInternalEndDate(endDate);
    }
  }, [visible, startDate, endDate]);

  const updateStartDate = (val: string) => {
    setInternalStartDate(val);
    onStartDateChange?.(val);
  };

  const updateEndDate = (val: string) => {
    setInternalEndDate(val);
    onEndDateChange?.(val);
  };

  const handleSetPreset = (preset: 'today' | '7days' | '30days' | 'thisMonth') => {
    const now = new Date();
    const todayStr = formatLocalDate(now);
    if (preset === 'today') {
      updateStartDate(todayStr);
      updateEndDate(todayStr);
    } else if (preset === '7days') {
      const past = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
      updateStartDate(formatLocalDate(past));
      updateEndDate(todayStr);
    } else if (preset === '30days') {
      const past = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29);
      updateStartDate(formatLocalDate(past));
      updateEndDate(todayStr);
    } else if (preset === 'thisMonth') {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      updateStartDate(formatLocalDate(firstDay));
      updateEndDate(todayStr);
    }
  };

  const handleOpenDatePicker = (target: 'start' | 'end') => {
    const currentStr = target === 'start' ? internalStartDate : internalEndDate;
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
            if (target === 'start') {
              updateStartDate(formatted);
            } else {
              updateEndDate(formatted);
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
      if (pickerTarget === 'start') {
        updateStartDate(formatted);
      } else {
        updateEndDate(formatted);
      }
    }
  };

  const handleApply = () => {
    if (!internalStartDate || !internalEndDate) {
      Alert.alert('Pilih Tanggal', 'Silakan pilih Tanggal Mulai dan Tanggal Selesai terlebih dahulu.');
      return;
    }

    const startParts = internalStartDate.trim().split('-').map((v) => parseInt(v, 10));
    const endParts = internalEndDate.trim().split('-').map((v) => parseInt(v, 10));

    if (
      startParts.length !== 3 ||
      endParts.length !== 3 ||
      startParts.some(isNaN) ||
      endParts.some(isNaN) ||
      startParts[1] < 1 ||
      startParts[1] > 12 ||
      endParts[1] < 1 ||
      endParts[1] > 12 ||
      startParts[2] < 1 ||
      startParts[2] > 31 ||
      endParts[2] < 1 ||
      endParts[2] > 31
    ) {
      Alert.alert('Format Tanggal Salah', 'Gunakan format YYYY-MM-DD. Contoh: 2026-09-01');
      return;
    }

    const start = new Date(startParts[0], startParts[1] - 1, startParts[2], 0, 0, 0, 0);
    const end = new Date(endParts[0], endParts[1] - 1, endParts[2], 23, 59, 59, 999);

    if (start > end) {
      Alert.alert('Tanggal Tidak Valid', 'Tanggal awal tidak boleh setelah tanggal akhir.');
      return;
    }

    const startStr = `${startParts[0]}-${String(startParts[1]).padStart(2, '0')}-${String(
      startParts[2]
    ).padStart(2, '0')}`;
    const endStr = `${endParts[0]}-${String(endParts[1]).padStart(2, '0')}-${String(
      endParts[2]
    ).padStart(2, '0')}`;

    onApply(start, end, startStr, endStr);
    onClose();
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
          <View style={s.customModalCard}>
            <View style={s.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={[s.datePickerIconWrap, { backgroundColor: isDark ? 'rgba(217, 119, 6, 0.2)' : 'rgba(217, 119, 6, 0.12)' }]}>
                  <Calendar size={18} color="#D97706" />
                </View>
                <Text style={s.modalTitle}>Filter Tanggal Kustom</Text>
              </View>
              <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <X size={20} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Pilihan Cepat / Preset Periode */}
            <Text style={s.inputLabel}>Pilihan Cepat:</Text>
            <View style={s.presetRow}>
              <TouchableOpacity style={s.presetChip} onPress={() => handleSetPreset('today')} activeOpacity={0.7}>
                <Text style={s.presetChipText}>Hari Ini</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.presetChip} onPress={() => handleSetPreset('7days')} activeOpacity={0.7}>
                <Text style={s.presetChipText}>7 Hari</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.presetChip} onPress={() => handleSetPreset('30days')} activeOpacity={0.7}>
                <Text style={s.presetChipText}>30 Hari</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.presetChip} onPress={() => handleSetPreset('thisMonth')} activeOpacity={0.7}>
                <Text style={s.presetChipText}>Bulan Ini</Text>
              </TouchableOpacity>
            </View>

            {/* Tombol Interaktif Pemilih Tanggal Mulai */}
            <Text style={s.inputLabel}>Tanggal Mulai</Text>
            <TouchableOpacity
              style={s.datePickerBtn}
              onPress={() => handleOpenDatePicker('start')}
              activeOpacity={0.75}
            >
              <View style={s.datePickerBtnLeft}>
                <View style={[s.datePickerIconWrap, { backgroundColor: isDark ? 'rgba(217, 119, 6, 0.15)' : 'rgba(217, 119, 6, 0.1)' }]}>
                  <Calendar size={16} color="#D97706" />
                </View>
                <View>
                  <Text style={s.datePickerSubtext}>Pilih Tanggal Mulai</Text>
                  <Text style={s.datePickerValueText}>
                    {formatDisplayDate(internalStartDate)}
                  </Text>
                </View>
              </View>
              <View style={s.datePickerBadge}>
                <Text style={s.datePickerBadgeText}>{internalStartDate || 'YYYY-MM-DD'}</Text>
              </View>
            </TouchableOpacity>

            {/* Tombol Interaktif Pemilih Tanggal Selesai */}
            <Text style={s.inputLabel}>Tanggal Selesai</Text>
            <TouchableOpacity
              style={s.datePickerBtn}
              onPress={() => handleOpenDatePicker('end')}
              activeOpacity={0.75}
            >
              <View style={s.datePickerBtnLeft}>
                <View style={[s.datePickerIconWrap, { backgroundColor: isDark ? 'rgba(217, 119, 6, 0.15)' : 'rgba(217, 119, 6, 0.1)' }]}>
                  <Calendar size={16} color="#D97706" />
                </View>
                <View>
                  <Text style={s.datePickerSubtext}>Pilih Tanggal Selesai</Text>
                  <Text style={s.datePickerValueText}>
                    {formatDisplayDate(internalEndDate)}
                  </Text>
                </View>
              </View>
              <View style={s.datePickerBadge}>
                <Text style={s.datePickerBadgeText}>{internalEndDate || 'YYYY-MM-DD'}</Text>
              </View>
            </TouchableOpacity>

            <View style={s.modalActions}>
              <TouchableOpacity style={s.modalBtnSec} onPress={onClose}>
                <Text style={s.modalBtnSecTxt}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.modalBtnPri, { backgroundColor: accentColor }]}
                onPress={handleApply}
              >
                <Text style={s.modalBtnPriTxt}>Terapkan Filter</Text>
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
                    {pickerTarget === 'start' ? 'Pilih Tanggal Mulai' : 'Pilih Tanggal Selesai'}
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
    customModalCard: {
      width: '100%',
      maxWidth: 380,
      backgroundColor: theme.colors.bgCard,
      borderRadius: 20,
      padding: 20,
      borderWidth: 1,
      borderColor: theme.colors.border,
      elevation: 5,
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    modalTitle: { color: theme.colors.textPrimary, fontSize: 16, fontWeight: '800' },
    inputLabel: {
      color: theme.colors.textSecondary,
      fontSize: 12,
      fontWeight: '700',
      marginBottom: 6,
    },
    presetRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
      marginBottom: 14,
    },
    presetChip: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 8,
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : '#F1F5F9',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#E2E8F0',
    },
    presetChipText: {
      fontSize: 11,
      fontWeight: '600',
      color: theme.colors.textSecondary,
    },
    datePickerBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : '#F9FAFB',
      borderWidth: 1.5,
      borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : '#E5E7EB',
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 12,
      marginBottom: 14,
    },
    datePickerBtnLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      flex: 1,
    },
    datePickerIconWrap: {
      width: 36,
      height: 36,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    datePickerSubtext: {
      fontSize: 11,
      color: theme.colors.textMuted,
      fontWeight: '600',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 2,
    },
    datePickerValueText: {
      fontSize: 14,
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
    modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 6 },
    modalBtnSec: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
    modalBtnSecTxt: { color: theme.colors.textSecondary, fontWeight: '600', fontSize: 13 },
    modalBtnPri: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 8 },
    modalBtnPriTxt: { color: '#FFFFFF', fontWeight: '800', fontSize: 13 },

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
  });

export default CustomDateFilterModal;
