import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Printer, Share2 } from 'lucide-react-native';
import { AppTheme } from '../../config/theme';
import { TransactionDetailStyles } from './TransactionDetailModal.styles';

export interface TransactionReceiptFooterProps {
  /** Callback untuk membagikan/mencetak struk thermal */
  onShareReceipt: () => void | Promise<void>;
  /** Callback untuk mengirim struk ke WhatsApp pelanggan */
  onShareWhatsApp: () => void | Promise<void>;
  /** Callback untuk menutup modal dialog */
  onClose: () => void;
  /** Objek tema aplikasi aktif */
  theme: AppTheme | any;
  /** Objek style modal detail transaksi */
  styles: TransactionDetailStyles;
}

/**
 * Komponen Tombol Aksi Bawah Modal (Cetak Thermal, Kirim WhatsApp, dan Tutup)
 */
export const TransactionReceiptFooter: React.FC<TransactionReceiptFooterProps> = ({
  onShareReceipt,
  onShareWhatsApp,
  onClose,
  theme,
  styles: s,
}) => {
  return (
    <View style={s.modalFooter}>
      <TouchableOpacity
        style={s.btnThermal}
        onPress={onShareReceipt}
        activeOpacity={0.8}
      >
        <Printer size={17} color="#FFFFFF" />
        <Text style={s.btnThermalText}>Cetak / Bagikan Struk</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={s.btnWhatsApp}
        onPress={onShareWhatsApp}
        activeOpacity={0.8}
      >
        <Share2 size={17} color="#FFFFFF" />
        <Text style={s.btnWhatsAppText}>Kirim ke WhatsApp</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={s.btnClose}
        onPress={onClose}
        activeOpacity={0.8}
      >
        <Text style={s.btnCloseText}>Tutup</Text>
      </TouchableOpacity>
    </View>
  );
};
