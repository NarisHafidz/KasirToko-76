import React, { useEffect, useState } from 'react';
import {
  Alert,
  Linking,
  Modal,
  ScrollView,
  Share,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  makeStyles,
  TransactionReceiptHeader,
  TransactionItemsTable,
  TransactionPaymentSummary,
  TransactionReceiptFooter,
} from './transaction-detail';
import { FileText, X } from 'lucide-react-native';
import { useAuth } from '../config/AuthContext';
import { useTheme } from '../config/ThemeContext';
import { getCurrentUserId, supabase } from '../config/supabase';
import { checkInternetConnection, getOfflineQueue } from '../services/syncService';
import {
  formatDailyReceiptNumber,
  formatRupiah,
  generateThermalReceiptText,
  generateWhatsAppReceiptUrl,
} from '../services/transactionService';
import { Transaction, TransactionItem } from '../types/database';

/**
 * Antarmuka Properti Komponen TransactionDetailModal
 */
export interface TransactionDetailModalProps {
  /** Visibilitas modal dialog */
  visible: boolean;
  /** Callback untuk menutup modal */
  onClose: () => void;
  /** Objek data header transaksi */
  transaction: Transaction | null;
  /** Objek rincian barang belanjaan (opsional, jika sudah dimuat sebelumnya) */
  items?: TransactionItem[];
  /** Menandakan apakah transaksi masih berada di antrean offline lokal */
  isOffline?: boolean;
}

/**
 * Komponen Modal Pratinjau Detail & Cetak Ulang Struk Transaksi (TransactionDetailModal)
 * 
 * FUNGSI UTAMA:
 * 1. Menampilkan nomor struk harian (#0001, #0002) secara jelas dan menonjol.
 * 2. Menampilkan status sinkronisasi transaksi (Online / Tersinkron vs Offline / Antrean).
 * 3. Menampilkan rincian barang belanjaan (nama, varian, qty, subtotal).
 * 4. Menyediakan aksi Cetak Ulang Struk / Salin Format Thermal via Share API.
 * 5. Menyediakan aksi Kirim Struk Resmi ke WhatsApp Pelanggan.
 */
export const TransactionDetailModal: React.FC<TransactionDetailModalProps> = ({
  visible,
  onClose,
  transaction,
  items: initialItems,
  isOffline: initialIsOffline,
}) => {
  const { theme, isDark } = useTheme();
  const { storeName } = useAuth();

  const [items, setItems] = useState<TransactionItem[]>(initialItems || []);
  const [loadingItems, setLoadingItems] = useState<boolean>(false);
  const [isOfflineStatus, setIsOfflineStatus] = useState<boolean>(initialIsOffline ?? false);

  // Efek memuat data item transaksi secara otomatis jika belum tersedia
  useEffect(() => {
    if (!visible || !transaction) {
      setItems([]);
      setLoadingItems(false);
      return;
    }

    if (initialItems && initialItems.length > 0) {
      setItems(initialItems);
      setLoadingItems(false);
    } else {
      let isMounted = true;
      const fetchItems = async () => {
        setLoadingItems(true);
        try {
          // 1. Cek antrean offline lokal terlebih dahulu
          const queue = await getOfflineQueue();
          const qMatch = queue.find(
            (q) =>
              q.transaction.transaction_code === transaction.transaction_code ||
              (transaction.id && q.transaction.id === transaction.id)
          );

          if (qMatch) {
            if (isMounted) {
              setIsOfflineStatus(true);
              setItems(qMatch.items || []);
              setLoadingItems(false);
            }
            return;
          }

          // 2. Jika tidak ada di antrean offline, coba tarik dari Supabase cloud
          const isOnline = await checkInternetConnection();
          if (isOnline && transaction.id) {
            const userId = await getCurrentUserId();
            let q = supabase
              .from('transaction_items')
              .select('*')
              .eq('transaction_id', transaction.id);

            if (userId) {
              q = q.eq('user_id', userId);
            }

            const { data: cloudItems, error } = await q;
            if (!error && cloudItems && cloudItems.length > 0) {
              if (isMounted) {
                setItems(cloudItems as TransactionItem[]);
                setLoadingItems(false);
              }
              return;
            }
          }
        } catch (err) {
          console.warn('Gagal memuat item untuk detail transaksi:', err);
        }

        if (isMounted) {
          setItems([]);
          setLoadingItems(false);
        }
      };

      fetchItems();
      return () => {
        isMounted = false;
      };
    }

    if (initialIsOffline !== undefined) {
      setIsOfflineStatus(initialIsOffline);
    }
  }, [visible, transaction, initialItems, initialIsOffline]);

  if (!transaction) return null;

  const dailyReceiptNumber = formatDailyReceiptNumber(transaction);
  const txDate = new Date(transaction.created_at);
  const formattedDate = !isNaN(txDate.getTime())
    ? txDate.toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }) +
      ', ' +
      txDate.toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
      })
    : '-';

  // Handler Kirim Struk WhatsApp
  const handleShareWhatsApp = async () => {
    try {
      const phone = transaction.customer_phone || '';
      if (phone) {
        const url = generateWhatsAppReceiptUrl(phone, {
          transaction,
          items,
          storeName: storeName || 'TOKO GROSIR 76',
        });
        if (url) {
          const supported = await Linking.canOpenURL(url);
          if (supported) {
            await Linking.openURL(url);
            return;
          }
        }
      }
      // Jika nomor HP tidak terdaftar atau WhatsApp tidak terpasang, bagikan via Share dialog
      await handleShareReceiptText();
    } catch (err) {
      await handleShareReceiptText();
    }
  };

  // Handler Bagikan / Cetak Struk Format Thermal
  const handleShareReceiptText = async () => {
    try {
      const text = generateThermalReceiptText({
        transaction,
        items,
        storeName: storeName || 'TOKO GROSIR 76',
      });

      await Share.share({
        title: `Struk Pembayaran ${dailyReceiptNumber}`,
        message: text,
      });
    } catch (err) {
      console.warn('Gagal membagikan struk thermal:', err);
    }
  };

  const s = makeStyles(theme, isDark);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={s.modalOverlay}>
        <View style={s.modalCard}>
          {/* Header Modal */}
          <View style={s.modalHeader}>
            <View style={s.headerTitleRow}>
              <View style={s.headerIconBox}>
                <FileText size={18} color={theme.colors.primary} />
              </View>
              <View>
                <Text style={s.modalTitle}>Detail Transaksi</Text>
                <Text style={s.modalSub}>Struk & Rincian Pembayaran</Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={s.closeBtn}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <X size={20} color={theme.colors.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Konten Scrollable Struk */}
          <ScrollView
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled={true}
            contentContainerStyle={s.scrollContent}
          >
            {/* Banner Nomor Struk Harian, Status Sync & Metadata */}
            <TransactionReceiptHeader
              transaction={transaction}
              formattedDailyReceiptNo={dailyReceiptNumber}
              formattedDate={formattedDate}
              isOfflineStatus={isOfflineStatus}
              theme={theme}
              styles={s}
            />

            {/* Rincian Barang Belanjaan */}
            <TransactionItemsTable
              items={items}
              loadingItems={loadingItems}
              formatRupiah={formatRupiah}
              theme={theme}
              styles={s}
            />

            {/* Ringkasan Finansial Pembayaran */}
            <TransactionPaymentSummary
              transaction={transaction}
              formatRupiah={formatRupiah}
              theme={theme}
              styles={s}
            />
          </ScrollView>

          {/* Tombol Aksi Bawah Modal */}
          <TransactionReceiptFooter
            onShareReceipt={handleShareReceiptText}
            onShareWhatsApp={handleShareWhatsApp}
            onClose={onClose}
            theme={theme}
            styles={s}
          />
        </View>
      </View>
    </Modal>
  );
};

export default TransactionDetailModal;
