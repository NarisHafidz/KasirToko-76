import React from 'react';
import {
  KeyboardAvoidingView,
  LayoutChangeEvent,
  Modal,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  Bell,
  BookOpen,
  Calendar,
  Check,
  CreditCard,
  FileText,
  Plus,
  Search,
  Trash2,
  User,
  Wallet,
  X,
} from 'lucide-react-native';
import { useTheme } from '../../config/ThemeContext';
import { makeStyles } from '../../screens/DashboardScreen.styles';
import { formatRupiah as defaultFormatRupiah } from '../../services/transactionService';
import { StoreReminder } from '../../types/database';

export interface StoreReminderWidgetProps {
  /** Seluruh daftar pengingat / kasbon */
  reminders: StoreReminder[];
  /** Daftar pengingat / kasbon yang telah difilter oleh tab dan query pencarian */
  filteredReminders: StoreReminder[];
  /** Total nominal utang kasbon pelanggan yang belum lunas (Rp) */
  totalUnpaidDebt: number;
  /** Jumlah agenda pengingat toko aktif (tipe 'reminder') */
  activeRemindersCount: number;
  /** Jumlah pelanggan yang belum melunasi kasbon (opsional) */
  activeDebtsCount?: number;

  /** Tab filter aktif saat ini: 'all' | 'debt' | 'reminder' */
  reminderTab: 'all' | 'debt' | 'reminder';
  setReminderTab: (tab: 'all' | 'debt' | 'reminder') => void;

  /** Kata kunci pencarian catatan/utang */
  reminderSearchQuery: string;
  setReminderSearchQuery: (query: string) => void;

  /** Visibilitas modal form tambah catatan/utang */
  addReminderModalVisible: boolean;
  setAddReminderModalVisible: (visible: boolean) => void;

  /** Pilihan tipe formulir: 'debt' | 'reminder' */
  formType: 'debt' | 'reminder';
  setFormType: (type: 'debt' | 'reminder') => void;

  /** State input nama pelanggan */
  formCustomerName: string;
  setFormCustomerName: (name: string) => void;

  /** State input nominal utang */
  formAmount: string;
  setFormAmount: (amount: string) => void;

  /** State input tanggal jatuh tempo */
  formDueDate: string;
  setFormDueDate: (dueDate: string) => void;

  /** State input isi catatan */
  formNotes: string;
  setFormNotes: (notes: string) => void;

  /** Status loading penyimpanan catatan */
  isSavingReminder: boolean;

  /** Handler untuk menyimpan catatan baru */
  handleSaveReminder: () => void;
  /** Handler untuk menandai lunas atau belum lunas */
  handleToggleReminderSettled: (item: StoreReminder) => void;
  /** Handler untuk menghapus catatan/utang */
  handleDeleteReminder: (id: string, name?: string | null) => void;
  /** Handler untuk menutup modal tambah catatan */
  handleCloseAddReminderModal: () => void;

  /** Callback saat input pencarian difokuskan (untuk auto-scroll) */
  onSearchFocus?: () => void;
  /** Callback onLayout untuk mencatat posisi Y widget */
  onLayout?: (e: LayoutChangeEvent) => void;
  /** Helper format mata uang (opsional, default formatRupiah) */
  formatCurrency?: (amount: number) => string;
  /** Custom stylesheet (opsional) */
  styles?: any;
}

/**
 * Komponen Modular Widget Pengingat Toko & Modal Tambah Kasbon / Catatan
 */
export const StoreReminderWidget: React.FC<StoreReminderWidgetProps> = ({
  reminders,
  filteredReminders,
  totalUnpaidDebt,
  activeRemindersCount,
  activeDebtsCount,
  reminderTab,
  setReminderTab,
  reminderSearchQuery,
  setReminderSearchQuery,
  addReminderModalVisible,
  setAddReminderModalVisible,
  formType,
  setFormType,
  formCustomerName,
  setFormCustomerName,
  formAmount,
  setFormAmount,
  formDueDate,
  setFormDueDate,
  formNotes,
  setFormNotes,
  isSavingReminder,
  handleSaveReminder,
  handleToggleReminderSettled,
  handleDeleteReminder,
  handleCloseAddReminderModal,
  onSearchFocus,
  onLayout,
  formatCurrency,
  styles: customStyles,
}) => {
  const { theme, isDark } = useTheme();
  const s = customStyles || makeStyles(theme, isDark);
  const formatRupiah = formatCurrency || defaultFormatRupiah;

  const unpaidCustomersCount =
    activeDebtsCount !== undefined
      ? activeDebtsCount
      : reminders.filter((r) => r.type === 'debt' && !r.is_settled).length;

  return (
    <>
      {/* 4. WIDGET CATATAN & PENGINGAT TOKO (KASBON & AGENDA) */}
      <View style={s.reminderSection} onLayout={onLayout}>
        <View style={s.reminderSectionHeader}>
          <View style={s.reminderSectionTitleRow}>
            <View style={s.reminderIconBox}>
              <BookOpen size={18} color="#2563EB" />
            </View>
            <View>
              <Text style={s.sectionTitle}>Pengingat / Catatan Toko</Text>
              <Text style={s.reminderSectionSubtitle}>Utang kasbon pelanggan & agenda toko</Text>
            </View>
          </View>
          <TouchableOpacity
            style={s.addReminderBtn}
            onPress={() => setAddReminderModalVisible(true)}
            activeOpacity={0.8}
          >
            <Plus size={14} color="#FFFFFF" />
            <Text style={s.addReminderBtnText}>Tambah</Text>
          </TouchableOpacity>
        </View>

        {/* INPUT PENCARIAN (SEARCH BAR) DI BAGIAN HEADER KARTU */}
        <View style={s.reminderSearchBar}>
          <Search size={16} color={theme.colors.textMuted} style={s.reminderSearchIcon} />
          <TextInput
            style={s.reminderSearchInput}
            placeholder="Cari nama pelanggan, catatan, atau utang..."
            placeholderTextColor={theme.colors.textMuted}
            value={reminderSearchQuery}
            onChangeText={setReminderSearchQuery}
            onFocus={onSearchFocus}
            returnKeyType="search"
            clearButtonMode="never"
          />
          {reminderSearchQuery.trim().length > 0 && (
            <TouchableOpacity
              style={s.reminderSearchClearBtn}
              onPress={() => setReminderSearchQuery('')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityLabel="Hapus pencarian"
            >
              <X size={13} color={isDark ? '#E2E8F0' : '#475569'} />
            </TouchableOpacity>
          )}
        </View>

        {/* Rangkuman 2 Mini Card: Total Kasbon Belum Lunas & Pengingat Toko */}
        <View style={s.reminderSummaryRow}>
          <View
            style={[
              s.reminderSummaryCard,
              { borderColor: totalUnpaidDebt > 0 ? '#EF444450' : theme.colors.border },
            ]}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Wallet size={14} color={totalUnpaidDebt > 0 ? '#EF4444' : theme.colors.textMuted} />
              <Text style={s.reminderSummaryLabel}>Kasbon Belum Lunas</Text>
            </View>
            <Text
              style={[
                s.reminderSummaryValue,
                { color: totalUnpaidDebt > 0 ? '#EF4444' : theme.colors.textPrimary },
              ]}
            >
              {formatRupiah(totalUnpaidDebt)}
            </Text>
            <Text style={s.reminderSummarySub}>{unpaidCustomersCount} pelanggan belum melunasi</Text>
          </View>

          <View style={s.reminderSummaryCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Bell size={14} color="#2563EB" />
              <Text style={s.reminderSummaryLabel}>Pengingat Toko</Text>
            </View>
            <Text style={[s.reminderSummaryValue, { color: '#2563EB' }]}>
              {activeRemindersCount} Agenda
            </Text>
            <Text style={s.reminderSummarySub}>Catatan operasional harian</Text>
          </View>
        </View>

        {/* Tab Filter Pill */}
        <View style={s.reminderFilterRow}>
          <TouchableOpacity
            style={[s.reminderFilterPill, reminderTab === 'all' && s.reminderFilterPillActive]}
            onPress={() => setReminderTab('all')}
          >
            <Text
              style={[
                s.reminderFilterPillText,
                reminderTab === 'all' && s.reminderFilterPillTextActive,
              ]}
            >
              Semua ({reminders.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[s.reminderFilterPill, reminderTab === 'debt' && s.reminderFilterPillActive]}
            onPress={() => setReminderTab('debt')}
          >
            <Text
              style={[
                s.reminderFilterPillText,
                reminderTab === 'debt' && s.reminderFilterPillTextActive,
              ]}
            >
              Utang/Kasbon ({reminders.filter((r) => r.type === 'debt').length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[s.reminderFilterPill, reminderTab === 'reminder' && s.reminderFilterPillActive]}
            onPress={() => setReminderTab('reminder')}
          >
            <Text
              style={[
                s.reminderFilterPillText,
                reminderTab === 'reminder' && s.reminderFilterPillTextActive,
              ]}
            >
              Pengingat ({reminders.filter((r) => r.type === 'reminder').length})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Daftar Catatan / Utang (Container MaxHeight 300px dengan Nested Scroll Terisolasi) */}
        {filteredReminders.length > 0 ? (
          <View style={s.reminderListCard}>
            <ScrollView
              style={s.reminderScrollView}
              contentContainerStyle={s.reminderScrollContent}
              nestedScrollEnabled={true}
              showsVerticalScrollIndicator={true}
              keyboardShouldPersistTaps="handled"
            >
              {filteredReminders.map((item, idx) => {
                const isLast = idx === filteredReminders.length - 1;
                const isDebt = item.type === 'debt';
                return (
                  <View
                    key={item.id}
                    style={[s.reminderRow, isLast && { borderBottomWidth: 0 }]}
                  >
                    <View style={s.reminderRowLeft}>
                      <View
                        style={[
                          s.reminderTypeIconWrap,
                          isDebt
                            ? item.is_settled
                              ? { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.2)' : '#ECFDF5' }
                              : { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.2)' : '#FEF2F2' }
                            : { backgroundColor: isDark ? 'rgba(37, 99, 235, 0.2)' : '#EFF6FF' },
                        ]}
                      >
                        {isDebt ? (
                          <Wallet
                            size={16}
                            color={item.is_settled ? '#10B981' : '#EF4444'}
                          />
                        ) : (
                          <Bell size={16} color="#2563EB" />
                        )}
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <Text style={s.reminderRowTitle}>
                            {isDebt ? item.customer_name || 'Pelanggan' : 'Pengingat Toko'}
                          </Text>
                          {isDebt && (
                            <View
                              style={[
                                s.debtStatusBadge,
                                item.is_settled ? s.debtStatusLunas : s.debtStatusBelumLunas,
                              ]}
                            >
                              <Text
                                style={[
                                  s.debtStatusBadgeText,
                                  item.is_settled ? { color: '#059669' } : { color: '#DC2626' },
                                ]}
                              >
                                {item.is_settled ? 'Lunas' : 'Belum Lunas'}
                              </Text>
                            </View>
                          )}
                        </View>
                        {item.notes && (
                          <Text style={s.reminderRowNote} numberOfLines={2}>
                            {item.notes}
                          </Text>
                        )}
                        <Text style={s.reminderRowMeta}>
                          {item.due_date ? `Jatuh tempo: ${item.due_date} • ` : ''}
                          Dibuat: {new Date(item.created_at).toLocaleDateString('id-ID')}
                        </Text>
                      </View>
                    </View>

                    <View style={s.reminderRowRight}>
                      {isDebt && (
                        <Text
                          style={[
                            s.reminderRowAmount,
                            item.is_settled
                              ? { color: '#10B981', textDecorationLine: 'line-through' }
                              : { color: '#EF4444' },
                          ]}
                        >
                          {formatRupiah(item.amount || 0)}
                        </Text>
                      )}

                      <View style={s.reminderActionButtons}>
                        {isDebt && (
                          <TouchableOpacity
                            style={[
                              s.settleBtn,
                              item.is_settled ? s.settleBtnDone : s.settleBtnActive,
                            ]}
                            onPress={() => handleToggleReminderSettled(item)}
                            activeOpacity={0.8}
                          >
                            <Check size={12} color={item.is_settled ? '#059669' : '#FFFFFF'} />
                            <Text
                              style={[
                                s.settleBtnText,
                                item.is_settled ? { color: '#059669' } : { color: '#FFFFFF' },
                              ]}
                            >
                              {item.is_settled ? 'Lunas' : 'Tandai Lunas'}
                            </Text>
                          </TouchableOpacity>
                        )}

                        <TouchableOpacity
                          style={s.deleteReminderBtn}
                          onPress={() => handleDeleteReminder(item.id, item.customer_name || item.notes)}
                          activeOpacity={0.7}
                        >
                          <Trash2 size={13} color={theme.colors.danger || '#EF4444'} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                );
              })}
            </ScrollView>
          </View>
        ) : (
          <View style={s.emptyReminderBox}>
            {reminderSearchQuery.trim().length > 0 ? (
              <>
                <Search size={22} color={theme.colors.textMuted} />
                <Text style={s.emptyReminderTitle}>Catatan tidak ditemukan</Text>
                <Text style={s.emptyReminderText}>
                  Tidak ada catatan yang cocok dengan "{reminderSearchQuery.trim()}".
                </Text>
                <TouchableOpacity
                  style={s.clearSearchPill}
                  onPress={() => setReminderSearchQuery('')}
                  activeOpacity={0.7}
                >
                  <Text style={s.clearSearchPillText}>Hapus Filter Pencarian</Text>
                </TouchableOpacity>
              </>
            ) : reminders.length === 0 ? (
              <>
                <BookOpen size={22} color={theme.colors.textMuted} />
                <Text style={s.emptyReminderTitle}>Belum Ada Catatan</Text>
                <Text style={s.emptyReminderText}>
                  Belum ada catatan atau utang yang dicatat.
                </Text>
              </>
            ) : (
              <>
                <BookOpen size={22} color={theme.colors.textMuted} />
                <Text style={s.emptyReminderText}>
                  {reminderTab === 'debt'
                    ? 'Tidak ada catatan kasbon pelanggan saat ini.'
                    : 'Tidak ada agenda/pengingat toko saat ini.'}
                </Text>
              </>
            )}
          </View>
        )}
      </View>

      {/* MODAL DIALOG TAMBAH CATATAN / UTANG PELANGGAN */}
      <Modal
        visible={addReminderModalVisible}
        transparent
        animationType="fade"
        onRequestClose={handleCloseAddReminderModal}
      >
        <KeyboardAvoidingView
          style={s.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={s.modalCard}>
            {/* Header Modal */}
            <View style={s.modalHeader}>
              <View style={s.modalTitleRow}>
                <View style={[s.modalTitleIcon, { backgroundColor: 'rgba(37, 99, 235, 0.15)' }]}>
                  <BookOpen size={18} color="#2563EB" />
                </View>
                <Text style={s.modalTitle}>Tambah Catatan Toko</Text>
              </View>
              <TouchableOpacity
                onPress={handleCloseAddReminderModal}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <X size={20} color={theme.colors.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingBottom: 16 }}
            >
              {/* Pilihan Jenis Catatan: Utang vs Pengingat */}
              <View style={s.formTypeSelector}>
                <TouchableOpacity
                  style={[s.formTypeBtn, formType === 'debt' && s.formTypeBtnActive]}
                  onPress={() => setFormType('debt')}
                >
                  <Wallet size={14} color={formType === 'debt' ? '#FFFFFF' : theme.colors.textSecondary} />
                  <Text style={[s.formTypeBtnText, formType === 'debt' && s.formTypeBtnTextActive]}>
                    Utang / Kasbon
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[s.formTypeBtn, formType === 'reminder' && s.formTypeBtnActive]}
                  onPress={() => setFormType('reminder')}
                >
                  <Bell size={14} color={formType === 'reminder' ? '#FFFFFF' : theme.colors.textSecondary} />
                  <Text style={[s.formTypeBtnText, formType === 'reminder' && s.formTypeBtnTextActive]}>
                    Pengingat Bebas
                  </Text>
                </TouchableOpacity>
              </View>

              {formType === 'debt' ? (
                <>
                  <Text style={s.inputLabel}>Nama Pelanggan *</Text>
                  <View style={s.inputWrapper}>
                    <User size={16} color={theme.colors.textMuted} style={s.inputIcon} />
                    <TextInput
                      style={s.modalTextInput}
                      placeholder="Contoh: Pak Budi, Bu Ani..."
                      placeholderTextColor={theme.colors.textMuted}
                      value={formCustomerName}
                      onChangeText={setFormCustomerName}
                    />
                  </View>

                  <Text style={s.inputLabel}>Nominal Utang (Rp) *</Text>
                  <View style={s.inputWrapper}>
                    <CreditCard size={16} color={theme.colors.textMuted} style={s.inputIcon} />
                    <TextInput
                      style={s.modalTextInput}
                      placeholder="Contoh: 50000"
                      placeholderTextColor={theme.colors.textMuted}
                      value={formAmount}
                      onChangeText={setFormAmount}
                      keyboardType="numeric"
                    />
                  </View>

                  <Text style={s.inputLabel}>Tanggal Jatuh Tempo (Opsional)</Text>
                  <View style={s.inputWrapper}>
                    <Calendar size={16} color={theme.colors.textMuted} style={s.inputIcon} />
                    <TextInput
                      style={s.modalTextInput}
                      placeholder="Contoh: 28/09/2026 atau Akhir Pekan"
                      placeholderTextColor={theme.colors.textMuted}
                      value={formDueDate}
                      onChangeText={setFormDueDate}
                    />
                  </View>

                  <Text style={s.inputLabel}>Catatan / Barang Utang (Opsional)</Text>
                  <View style={s.inputWrapper}>
                    <FileText size={16} color={theme.colors.textMuted} style={s.inputIcon} />
                    <TextInput
                      style={s.modalTextInput}
                      placeholder="Contoh: Beras 5kg & Minyak Goreng"
                      placeholderTextColor={theme.colors.textMuted}
                      value={formNotes}
                      onChangeText={setFormNotes}
                    />
                  </View>
                </>
              ) : (
                <>
                  <Text style={s.inputLabel}>Isi Catatan / Pengingat Toko *</Text>
                  <View style={[s.inputWrapper, { height: 95, alignItems: 'flex-start' }]}>
                    <TextInput
                      style={[s.modalTextInput, { textAlignVertical: 'top', paddingTop: 8 }]}
                      placeholder="Contoh: Kulakan rokok ke agen jam 10 pagi, Cek stok beras..."
                      placeholderTextColor={theme.colors.textMuted}
                      value={formNotes}
                      onChangeText={setFormNotes}
                      multiline
                    />
                  </View>
                </>
              )}
            </ScrollView>

            <View style={[s.modalActions, { marginTop: 12 }]}>
              <TouchableOpacity
                style={s.modalBtnSec}
                onPress={handleCloseAddReminderModal}
                disabled={isSavingReminder}
              >
                <Text style={s.modalBtnSecText}>Batal</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[s.modalBtnPri, { backgroundColor: '#2563EB' }]}
                onPress={handleSaveReminder}
                disabled={isSavingReminder}
                activeOpacity={0.85}
              >
                <Text style={s.modalBtnPriText}>
                  {isSavingReminder ? 'Menyimpan...' : 'Simpan Catatan'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
};

export default StoreReminderWidget;
