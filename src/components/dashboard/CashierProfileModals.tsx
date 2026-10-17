import React from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  ArrowRight,
  ChevronRight,
  Edit3,
  Lock,
  LogOut,
  Repeat,
  Store,
  User,
  UserCheck,
  X,
} from 'lucide-react-native';
import { useTheme } from '../../config/ThemeContext';
import { makeStyles } from '../../screens/DashboardScreen.styles';

export interface CashierProfileModalsProps {
  /** ID sub-profil kasir aktif ('kasir_1' | 'kasir_2') */
  activeCashierId: 'kasir_1' | 'kasir_2' | string;
  /** Nama pemilik toko */
  ownerName?: string | null;

  /** State form nama & unit kasir 1 */
  editKasir1Name: string;
  setEditKasir1Name: (name: string) => void;
  editKasir1Unit: string;
  setEditKasir1Unit: (unit: string) => void;

  /** State form nama & unit kasir 2 */
  editKasir2Name: string;
  setEditKasir2Name: (name: string) => void;
  editKasir2Unit: string;
  setEditKasir2Unit: (unit: string) => void;

  /** Input nama pemilik / kasir aktif */
  newOwnerNameInput: string;
  setNewOwnerNameInput: (name: string) => void;

  /** Kontrol visibilitas modal edit sub-profil kasir */
  editNameModalVisible: boolean;
  setEditNameModalVisible: (visible: boolean) => void;

  /** Kontrol visibilitas modal keamanan sesi / kunci layar */
  lockSessionModalVisible: boolean;
  setLockSessionModalVisible: (visible: boolean) => void;

  /** Kontrol visibilitas modal menu opsi profil kasir */
  cashierMenuVisible: boolean;
  setCashierMenuVisible: (visible: boolean) => void;

  /** Status loading saat menyimpan data nama/profil */
  isSavingName: boolean;

  /** Nama tampilan kasir aktif */
  activeCashierDisplayName: string;
  /** Nama unit usaha kasir aktif */
  activeCashierDisplayUnit: string;

  /** Handler untuk menutup modal edit nama */
  handleCloseEditNameModal: () => void;
  /** Handler untuk menyimpan perubahan nama pemilik / kasir */
  handleSaveNewOwnerName: () => void;
  /** Handler untuk beralih/switch kasir via PIN */
  handleSwitchCashier: () => void;
  /** Handler untuk mengeksekusi kunci layar */
  handleExecuteLock: () => void;
  /** Handler untuk logout email / akun utama */
  handleExecuteLogoutEmail: () => void;
  /** Handler untuk logout umum */
  handleLogout: () => void;
  /** Handler untuk membuka modal edit nama dari menu kasir */
  handleOpenEditNameModal: () => void;

  /** Custom stylesheet (opsional) */
  styles?: any;
}

/**
 * Komponen Modular 3 Modal Sesi Kasir:
 * 1. Modal Dialog Edit Sub-Profil Kasir (Kasir 1 & Kasir 2)
 * 2. Pop-up Modal Keamanan Sesi Kasir (Kunci Layar & Opsi Logout)
 * 3. Modal Menu Opsi Profil Kasir (Kelola Profil, Ganti Kasir, Kunci, Keluar)
 */
export const CashierProfileModals: React.FC<CashierProfileModalsProps> = ({
  activeCashierId,
  editKasir1Name,
  setEditKasir1Name,
  editKasir1Unit,
  setEditKasir1Unit,
  editKasir2Name,
  setEditKasir2Name,
  editKasir2Unit,
  setEditKasir2Unit,
  newOwnerNameInput,
  setNewOwnerNameInput,
  editNameModalVisible,
  setEditNameModalVisible,
  lockSessionModalVisible,
  setLockSessionModalVisible,
  cashierMenuVisible,
  setCashierMenuVisible,
  isSavingName,
  activeCashierDisplayName,
  activeCashierDisplayUnit,
  handleCloseEditNameModal,
  handleSaveNewOwnerName,
  handleSwitchCashier,
  handleExecuteLock,
  handleExecuteLogoutEmail,
  handleLogout,
  handleOpenEditNameModal,
  styles: customStyles,
}) => {
  const { theme, isDark } = useTheme();
  const s = customStyles || makeStyles(theme, isDark);

  return (
    <>
      {/* 1. MODAL DIALOG KELOLA SUB-PROFIL KASIR (KASIR 1 & KASIR 2) */}
      <Modal
        visible={editNameModalVisible}
        transparent
        animationType="fade"
        onRequestClose={handleCloseEditNameModal}
      >
        <KeyboardAvoidingView
          style={s.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={[s.modalCard, { maxHeight: '90%' }]}>
            {/* Header Modal */}
            <View style={s.modalHeader}>
              <View style={s.modalTitleRow}>
                <View style={s.modalTitleIcon}>
                  <User size={18} color={theme.colors.primary} />
                </View>
                <Text style={s.modalTitle}>Profil Kasir Aktif</Text>
              </View>
              <TouchableOpacity
                onPress={handleCloseEditNameModal}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <X size={20} color={theme.colors.textMuted} />
              </TouchableOpacity>
            </View>

            {/* Keterangan */}
            <Text style={s.modalDesc}>
              Perbarui identitas kasir dan unit usaha yang sedang bertugas di HP ini. Perubahan akan langsung tersinkron ke struk dan laporan transaksi.
            </Text>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {activeCashierId === 'kasir_2' ? (
                /* FORM SUB-PROFIL KASIR 2 (AKTIF) */
                <View style={s.subProfileCard}>
                  <View style={s.subProfileHeader}>
                    <View
                      style={[
                        s.subProfileTag,
                        {
                          backgroundColor: isDark ? 'rgba(16, 185, 129, 0.2)' : '#D1FAE5',
                          borderColor: isDark ? 'rgba(16, 185, 129, 0.4)' : '#A7F3D0',
                        },
                      ]}
                    >
                      <UserCheck size={12} color="#059669" />
                      <Text style={[s.subProfileTagText, { color: '#059669' }]}>Kasir 2</Text>
                    </View>
                    <View style={s.activeDutyBadge}>
                      <Text style={s.activeDutyBadgeText}>● Aktif Bertugas</Text>
                    </View>
                  </View>

                  <View style={s.fieldGroup}>
                    <Text style={s.fieldLabelText}>Nama Kasir</Text>
                    <View style={s.fieldInputWrap}>
                      <User size={14} color={theme.colors.textMuted} style={s.fieldInputIcon} />
                      <TextInput
                        style={s.fieldTextInput}
                        placeholder="Contoh: Kasir 2"
                        placeholderTextColor={theme.colors.textMuted}
                        value={editKasir2Name}
                        onChangeText={(val) => {
                          setEditKasir2Name(val);
                          setNewOwnerNameInput(val);
                        }}
                        maxLength={35}
                      />
                    </View>
                  </View>

                  <View style={[s.fieldGroup, { marginTop: 6 }]}>
                    <Text style={s.fieldLabelText}>Nama Unit Usaha</Text>
                    <View style={s.fieldInputWrap}>
                      <Store size={14} color={theme.colors.textMuted} style={s.fieldInputIcon} />
                      <TextInput
                        style={s.fieldTextInput}
                        placeholder="Contoh: Unit Sembako"
                        placeholderTextColor={theme.colors.textMuted}
                        value={editKasir2Unit}
                        onChangeText={setEditKasir2Unit}
                        maxLength={35}
                      />
                    </View>
                  </View>
                </View>
              ) : (
                /* FORM SUB-PROFIL KASIR 1 (AKTIF) */
                <View style={s.subProfileCard}>
                  <View style={s.subProfileHeader}>
                    <View
                      style={[
                        s.subProfileTag,
                        {
                          backgroundColor: isDark ? 'rgba(16, 185, 129, 0.2)' : '#D1FAE5',
                          borderColor: isDark ? 'rgba(16, 185, 129, 0.4)' : '#A7F3D0',
                        },
                      ]}
                    >
                      <UserCheck size={12} color="#059669" />
                      <Text style={[s.subProfileTagText, { color: '#059669' }]}>Kasir 1</Text>
                    </View>
                    <View style={s.activeDutyBadge}>
                      <Text style={s.activeDutyBadgeText}>● Aktif Bertugas</Text>
                    </View>
                  </View>

                  <View style={s.fieldGroup}>
                    <Text style={s.fieldLabelText}>Nama Kasir</Text>
                    <View style={s.fieldInputWrap}>
                      <User size={14} color={theme.colors.textMuted} style={s.fieldInputIcon} />
                      <TextInput
                        style={s.fieldTextInput}
                        placeholder="Contoh: Didik Sulistyo"
                        placeholderTextColor={theme.colors.textMuted}
                        value={newOwnerNameInput}
                        onChangeText={(val) => {
                          setNewOwnerNameInput(val);
                          setEditKasir1Name(val);
                        }}
                        maxLength={35}
                      />
                    </View>
                  </View>

                  <View style={[s.fieldGroup, { marginTop: 6 }]}>
                    <Text style={s.fieldLabelText}>Nama Unit Usaha</Text>
                    <View style={s.fieldInputWrap}>
                      <Store size={14} color={theme.colors.textMuted} style={s.fieldInputIcon} />
                      <TextInput
                        style={s.fieldTextInput}
                        placeholder="Contoh: Unit Toko Utama"
                        placeholderTextColor={theme.colors.textMuted}
                        value={editKasir1Unit}
                        onChangeText={setEditKasir1Unit}
                        maxLength={35}
                      />
                    </View>
                  </View>
                </View>
              )}

              {/* TOMBOL SWITCH / GANTI KASIR KE LAYAR PIN */}
              <TouchableOpacity
                style={s.switchCashierBtn}
                onPress={handleSwitchCashier}
                activeOpacity={0.75}
                accessibilityLabel="Switch atau Ganti Kasir"
              >
                <View style={s.switchCashierBtnLeft}>
                  <View style={s.switchCashierIconWrap}>
                    <Repeat size={16} color={theme.colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.switchCashierBtnTitle}>Switch / Ganti Kasir</Text>
                    <Text style={s.switchCashierBtnSub}>Kembali ke layar PIN untuk beralih kasir</Text>
                  </View>
                </View>
                <ArrowRight size={16} color={theme.colors.primary} />
              </TouchableOpacity>
            </ScrollView>

            {/* Tombol Aksi */}
            <View style={[s.modalActions, { marginTop: 12 }]}>
              <TouchableOpacity
                style={s.modalBtnSec}
                onPress={handleCloseEditNameModal}
                disabled={isSavingName}
              >
                <Text style={s.modalBtnSecText}>Batal</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={s.modalBtnPri}
                onPress={handleSaveNewOwnerName}
                disabled={isSavingName}
                activeOpacity={0.85}
              >
                <Text style={s.modalBtnPriText}>
                  {isSavingName ? 'Menyimpan...' : 'Simpan & Terapkan'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* 2. POP-UP MODAL KEAMANAN SESI KASIR (KUNCI LAYAR / KELUAR) */}
      <Modal
        visible={lockSessionModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setLockSessionModalVisible(false)}
      >
        <View style={s.modalOverlay}>
          <View style={s.lockModalCard}>
            {/* Ikon Gembok (Dukungan Akses Long-Press 2 Detik untuk Keluar Akun) */}
            <TouchableOpacity
              activeOpacity={0.85}
              delayLongPress={2000}
              onLongPress={handleExecuteLogoutEmail}
              style={s.lockIconWrapper}
              accessibilityLabel="Ikon Gembok Sesi"
            >
              <Lock size={30} color={theme.colors.primary} />
            </TouchableOpacity>

            <Text style={s.lockModalTitle}>Keamanan Sesi Kasir</Text>

            <Text style={s.lockModalDesc}>
              Kunci layar untuk mengamankan kasir saat istirahat atau pergantian shift. Anda dapat membukanya kembali dengan 6-digit PIN.
            </Text>

            {/* Pill Info Kasir Aktif */}
            <View style={s.lockModalCashierPill}>
              <User size={13} color={theme.colors.primary} />
              <Text style={s.lockModalCashierText}>
                {activeCashierDisplayName} • {activeCashierDisplayUnit}
              </Text>
            </View>

            {/* Tombol Aksi: Hirarki Prioritas Kunci Layar */}
            <View style={s.lockModalActions}>
              {/* Tombol Utama (Prominent Button) */}
              <TouchableOpacity
                style={s.lockPrimaryBtn}
                onPress={handleExecuteLock}
                activeOpacity={0.85}
              >
                <Lock size={16} color="#FFFFFF" />
                <Text style={s.lockPrimaryBtnText}>Kunci Layar</Text>
              </TouchableOpacity>

              {/* Tombol Sekunder (Outline / Netral) */}
              <TouchableOpacity
                style={s.lockSecondaryBtn}
                onPress={() => setLockSessionModalVisible(false)}
                activeOpacity={0.7}
              >
                <Text style={s.lockSecondaryBtnText}>Batal</Text>
              </TouchableOpacity>
            </View>

            {/* Opsi Developer / Keluar Akun Tersembunyi (Teks Link Halus di Bagian Paling Bawah) */}
            <TouchableOpacity
              style={s.lockSubtleLink}
              onPress={handleExecuteLogoutEmail}
              activeOpacity={0.6}
            >
              <Text style={s.lockSubtleLinkText}>Keluar Shift / Akun Utama</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* 3. MODAL MENU OPSI PROFIL KASIR (ALTERNATIF B) */}
      <Modal
        visible={cashierMenuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setCashierMenuVisible(false)}
      >
        <TouchableOpacity
          style={s.cashierMenuModalOverlay}
          activeOpacity={1}
          onPress={() => setCashierMenuVisible(false)}
        >
          <TouchableOpacity
            style={s.cashierMenuCard}
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
          >
            {/* Header Menu */}
            <View style={s.cashierMenuHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                <View style={s.cashierAvatar}>
                  <UserCheck size={20} color={theme.colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.cashierMenuTitle} numberOfLines={1}>
                    {activeCashierDisplayName}
                  </Text>
                  <Text style={s.cashierMenuSub} numberOfLines={1}>
                    Unit Usaha: {activeCashierDisplayUnit}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={s.closeModalBtn}
                onPress={() => setCashierMenuVisible(false)}
                activeOpacity={0.75}
              >
                <X size={18} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={s.cashierMenuDivider} />

            {/* Daftar Aksi Kasir */}
            <View style={s.cashierMenuList}>
              {/* Opsi 1: Kelola Profil & Unit */}
              <TouchableOpacity
                style={s.cashierMenuItem}
                onPress={() => {
                  setCashierMenuVisible(false);
                  handleOpenEditNameModal();
                }}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    s.cashierMenuItemIconWrap,
                    { backgroundColor: isDark ? 'rgba(37, 99, 235, 0.2)' : '#EFF6FF' },
                  ]}
                >
                  <Edit3 size={18} color={theme.colors.primary} />
                </View>
                <View style={s.cashierMenuItemTextWrap}>
                  <Text style={s.cashierMenuItemTitle}>Kelola Profil Kasir</Text>
                  <Text style={s.cashierMenuItemSub}>Ubah nama kasir & unit usaha aktif</Text>
                </View>
                <ChevronRight size={16} color={theme.colors.textMuted} />
              </TouchableOpacity>

              {/* Opsi 2: Ganti Kasir Bertugas */}
              <TouchableOpacity
                style={s.cashierMenuItem}
                onPress={() => {
                  setCashierMenuVisible(false);
                  handleSwitchCashier();
                }}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    s.cashierMenuItemIconWrap,
                    { backgroundColor: isDark ? 'rgba(99, 102, 241, 0.2)' : '#EEF2FF' },
                  ]}
                >
                  <Repeat size={18} color="#6366F1" />
                </View>
                <View style={s.cashierMenuItemTextWrap}>
                  <Text style={s.cashierMenuItemTitle}>Ganti Kasir Bertugas</Text>
                  <Text style={s.cashierMenuItemSub}>Beralih sub-profil kasir via PIN</Text>
                </View>
                <ChevronRight size={16} color={theme.colors.textMuted} />
              </TouchableOpacity>

              {/* Opsi 3: Kunci Layar Kasir */}
              <TouchableOpacity
                style={s.cashierMenuItem}
                onPress={() => {
                  setCashierMenuVisible(false);
                  handleLogout();
                }}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    s.cashierMenuItemIconWrap,
                    { backgroundColor: isDark ? 'rgba(245, 158, 11, 0.2)' : '#FEF3C7' },
                  ]}
                >
                  <Lock size={18} color={theme.colors.warning || '#D97706'} />
                </View>
                <View style={s.cashierMenuItemTextWrap}>
                  <Text style={s.cashierMenuItemTitle}>Kunci Layar Kasir</Text>
                  <Text style={s.cashierMenuItemSub}>Kunci kasir sementara demi keamanan</Text>
                </View>
                <ChevronRight size={16} color={theme.colors.textMuted} />
              </TouchableOpacity>

              {/* Opsi 4: Keluar Sesi Kasir */}
              <TouchableOpacity
                style={[s.cashierMenuItem, s.cashierMenuItemDanger]}
                onPress={() => {
                  setCashierMenuVisible(false);
                  handleLogout();
                }}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    s.cashierMenuItemIconWrap,
                    { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.2)' : '#FEE2E2' },
                  ]}
                >
                  <LogOut size={18} color={theme.colors.danger || '#EF4444'} />
                </View>
                <View style={s.cashierMenuItemTextWrap}>
                  <Text
                    style={[
                      s.cashierMenuItemTitle,
                      { color: theme.colors.danger || '#EF4444' },
                    ]}
                  >
                    Keluar Sesi Kasir
                  </Text>
                  <Text style={s.cashierMenuItemSub}>Keluar dari akun aplikasi toko</Text>
                </View>
                <ChevronRight size={16} color={theme.colors.textMuted} />
              </TouchableOpacity>
            </View>

            {/* Tombol Batal/Tutup */}
            <TouchableOpacity
              style={s.cashierMenuCancelBtn}
              onPress={() => setCashierMenuVisible(false)}
              activeOpacity={0.75}
            >
              <Text style={s.cashierMenuCancelBtnText}>Tutup</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </>
  );
};

export default CashierProfileModals;
