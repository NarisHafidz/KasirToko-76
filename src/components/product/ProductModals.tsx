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
  ScanBarcode,
  Trash2,
  X,
} from 'lucide-react-native';
import { useTheme } from '../../config/ThemeContext';
import { makeStyles } from '../../screens/ProductScreen.styles';
import { Product } from '../../types/database';

export interface ProductModalsProps {
  // Modal 1: Formulir Tambah / Edit Produk
  formModalVisible: boolean;
  setFormModalVisible: (visible: boolean) => void;
  resetForm: () => void;
  editingProductId: string | null;
  formBusinessUnit: 'Sembako' | 'Tembakau';
  setFormBusinessUnit: (unit: 'Sembako' | 'Tembakau') => void;
  formName: string;
  setFormName: (name: string) => void;
  formCategory: string;
  setFormCategory: (category: string) => void;
  formBarcode: string;
  setFormBarcode: (barcode: string) => void;
  handleScanBarcodeForForm: () => void;
  formCostPrice: string;
  setFormCostPrice: (costPrice: string) => void;
  formPrice: string;
  setFormPrice: (price: string) => void;
  formStock: string;
  setFormStock: (stock: string) => void;
  isSaving: boolean;
  handleSaveProduct: () => void;

  // Modal 2: Pop-up Konfirmasi Hapus Produk
  deleteModalVisible: boolean;
  setDeleteModalVisible: (visible: boolean) => void;
  productToDelete: Product | null;
  setProductToDelete: (product: Product | null) => void;
  isDeleting: boolean;
  handleConfirmDelete: () => void;

  styles?: any;
}

/**
 * Komponen Modular Modal Dialog Produk:
 * 1. Modal Dialog Form Tambah / Ubah Produk (beserta pemilihan unit bisnis, input harga modal, harga jual, stok, dan barcode scanner)
 * 2. Pop-up Konfirmasi Dialog Hapus Produk Permanen/Cerdas
 */
export const ProductModals: React.FC<ProductModalsProps> = ({
  // Form Modal Props
  formModalVisible,
  setFormModalVisible,
  resetForm,
  editingProductId,
  formBusinessUnit,
  setFormBusinessUnit,
  formName,
  setFormName,
  formCategory,
  setFormCategory,
  formBarcode,
  setFormBarcode,
  handleScanBarcodeForForm,
  formCostPrice,
  setFormCostPrice,
  formPrice,
  setFormPrice,
  formStock,
  setFormStock,
  isSaving,
  handleSaveProduct,

  // Delete Confirmation Modal Props
  deleteModalVisible,
  setDeleteModalVisible,
  productToDelete,
  setProductToDelete,
  isDeleting,
  handleConfirmDelete,

  styles: customStyles,
}) => {
  const { theme, isDark } = useTheme();
  const s = customStyles || makeStyles(theme, isDark);

  return (
    <>
      {/* 1. Modal Dialog Form Tambah / Ubah Produk */}
      <Modal
        visible={formModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setFormModalVisible(false);
          resetForm();
        }}
      >
        <KeyboardAvoidingView
          style={s.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={s.formContainer}>
            <View style={s.formHeader}>
              <Text style={s.formTitle}>
                {editingProductId ? 'Edit Produk' : 'Tambah Produk Baru'}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setFormModalVisible(false);
                  resetForm();
                }}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <X size={22} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingBottom: 20 }}
              style={s.formScroll}
            >
              <Text style={s.inputLabel}>Unit Bisnis Produk *</Text>
              <View style={s.unitToggleRow}>
                <TouchableOpacity
                  style={[s.unitToggleBtn, formBusinessUnit === 'Sembako' && s.unitToggleBtnActiveSembako]}
                  onPress={() => setFormBusinessUnit('Sembako')}
                  activeOpacity={0.8}
                >
                  <Text style={[s.unitToggleText, formBusinessUnit === 'Sembako' && s.unitToggleTextActive]}>
                    🌾 Sembako
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.unitToggleBtn, formBusinessUnit === 'Tembakau' && s.unitToggleBtnActiveTembakau]}
                  onPress={() => setFormBusinessUnit('Tembakau')}
                  activeOpacity={0.8}
                >
                  <Text style={[s.unitToggleText, formBusinessUnit === 'Tembakau' && s.unitToggleTextActive]}>
                    🚬 Tembakau
                  </Text>
                </TouchableOpacity>
              </View>

              <Text style={s.inputLabel}>Nama Produk *</Text>
              <TextInput
                style={s.formInput}
                placeholder="Contoh: Beras Rojo Lele 5Kg"
                placeholderTextColor={theme.colors.textMuted}
                value={formName}
                onChangeText={setFormName}
              />

              <Text style={s.inputLabel}>Kategori</Text>
              <TextInput
                style={s.formInput}
                placeholder="Contoh: Sembako, Minuman, Snack"
                placeholderTextColor={theme.colors.textMuted}
                value={formCategory}
                onChangeText={setFormCategory}
              />

              <Text style={s.inputLabel}>Barcode / SKU</Text>
              <View style={s.barcodeInputWrapper}>
                <TextInput
                  style={[s.formInput, { flex: 1 }]}
                  placeholder="Kode barcode produk"
                  placeholderTextColor={theme.colors.textMuted}
                  value={formBarcode}
                  onChangeText={setFormBarcode}
                />
                <TouchableOpacity
                  style={s.barcodeCameraBtn}
                  onPress={handleScanBarcodeForForm}
                  accessibilityLabel="Pindai Barcode Produk Menggunakan Kamera"
                >
                  <ScanBarcode size={18} color="#FFFFFF" />
                </TouchableOpacity>
              </View>

              <View style={s.formRow}>
                <View style={{ flex: 1 }}>
                  <Text style={s.inputLabel}>Harga Modal (Rp)</Text>
                  <TextInput
                    style={s.formInput}
                    placeholder="0"
                    placeholderTextColor={theme.colors.textMuted}
                    value={formCostPrice}
                    onChangeText={setFormCostPrice}
                    keyboardType="number-pad"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.inputLabel}>Harga Jual (Rp) *</Text>
                  <TextInput
                    style={s.formInput}
                    placeholder="0"
                    placeholderTextColor={theme.colors.textMuted}
                    value={formPrice}
                    onChangeText={setFormPrice}
                    keyboardType="number-pad"
                  />
                </View>
              </View>

              <Text style={s.inputLabel}>Sisa Stok *</Text>
              <TextInput
                style={s.formInput}
                placeholder="Jumlah stok barang"
                placeholderTextColor={theme.colors.textMuted}
                value={formStock}
                onChangeText={setFormStock}
                keyboardType="number-pad"
              />
            </ScrollView>

            <View style={s.formActions}>
              <TouchableOpacity
                style={s.formCancelBtn}
                onPress={() => {
                  setFormModalVisible(false);
                  resetForm();
                }}
              >
                <Text style={s.formCancelText}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.formSaveBtn, isSaving && { opacity: 0.6 }]}
                disabled={isSaving}
                onPress={handleSaveProduct}
              >
                <Text style={s.formSaveText}>{isSaving ? 'Menyimpan...' : 'Simpan Produk'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* 2. Pop-up Konfirmasi Modal Hapus Produk */}
      <Modal
        visible={deleteModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!isDeleting) {
            setDeleteModalVisible(false);
            setProductToDelete(null);
          }
        }}
      >
        <View style={s.confirmModalOverlay}>
          <View style={s.confirmModalContainer}>
            <View style={s.confirmModalIconWrapper}>
              <Trash2 size={28} color="#EF4444" />
            </View>
            <Text style={s.confirmModalTitle}>Konfirmasi Hapus</Text>
            <Text style={s.confirmModalMessage}>
              Apakah Anda yakin ingin menghapus produk ini?
            </Text>
            {productToDelete && (
              <View style={s.confirmProductBadge}>
                <Text style={s.confirmProductName} numberOfLines={1}>
                  {productToDelete.name}
                </Text>
              </View>
            )}

            <View style={s.confirmModalActions}>
              <TouchableOpacity
                style={s.confirmCancelBtn}
                onPress={() => {
                  setDeleteModalVisible(false);
                  setProductToDelete(null);
                }}
                disabled={isDeleting}
                activeOpacity={0.7}
              >
                <Text style={s.confirmCancelText}>Batal</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[s.confirmDeleteBtn, isDeleting && { opacity: 0.6 }]}
                onPress={handleConfirmDelete}
                disabled={isDeleting}
                activeOpacity={0.8}
              >
                <Text style={s.confirmDeleteText}>
                  {isDeleting ? 'Menghapus...' : 'Hapus'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
};

export default ProductModals;
