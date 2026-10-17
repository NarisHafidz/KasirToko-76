import React from 'react';
import { View, Text } from 'react-native';
import { Calendar, Store, User, Wifi, WifiOff } from 'lucide-react-native';
import { AppTheme } from '../../config/theme';
import { Transaction } from '../../types/database';
import { TransactionDetailStyles } from './TransactionDetailModal.styles';

export interface TransactionReceiptHeaderProps {
  /** Objek data header transaksi */
  transaction: Transaction;
  /** Nomor urut struk harian terformat (misal: #0001) */
  formattedDailyReceiptNo: string;
  /** Tanggal & jam transaksi terformat lokal */
  formattedDate: string;
  /** Menandakan apakah transaksi masih dalam antrean offline lokal */
  isOfflineStatus: boolean;
  /** Tema aplikasi aktif */
  theme: AppTheme | any;
  /** Objek style modal detail transaksi */
  styles: TransactionDetailStyles;
}

/**
 * Komponen Banner Nomor Struk Harian, Status Sync & Metadata Transaksi
 */
export const TransactionReceiptHeader: React.FC<TransactionReceiptHeaderProps> = ({
  transaction,
  formattedDailyReceiptNo,
  formattedDate,
  isOfflineStatus,
  theme,
  styles: s,
}) => {
  return (
    <>
      {/* Banner Nomor Struk Harian (#0001) */}
      <View style={s.receiptHeaderCard}>
        <View style={s.receiptTopInfo}>
          <Text style={s.receiptBadgeLabel}>NO. STRUK HARIAN</Text>
          <Text style={s.dailyReceiptNum}>{formattedDailyReceiptNo}</Text>
          <Text style={s.txCodeText}>{transaction.transaction_code}</Text>
        </View>

        {/* Status Sinkronisasi Online / Offline */}
        <View
          style={[
            s.syncStatusBadge,
            isOfflineStatus ? s.syncStatusOffline : s.syncStatusOnline,
          ]}
        >
          {isOfflineStatus ? (
            <>
              <WifiOff size={13} color="#D97706" />
              <Text style={s.syncStatusTextOffline}>Antrean Offline (Menunggu Sync)</Text>
            </>
          ) : (
            <>
              <Wifi size={13} color="#059669" />
              <Text style={s.syncStatusTextOnline}>Tersinkronisasi ke Cloud</Text>
            </>
          )}
        </View>
      </View>

      {/* Metadata Operasional (Waktu, Kasir, Unit Bisnis, Pelanggan) */}
      <View style={s.infoSection}>
        <View style={s.infoRow}>
          <View style={s.infoLeft}>
            <Calendar size={14} color={theme.colors.textMuted} />
            <Text style={s.infoLabel}>Waktu</Text>
          </View>
          <Text style={s.infoValue}>{formattedDate}</Text>
        </View>

        <View style={s.infoRow}>
          <View style={s.infoLeft}>
            <User size={14} color={theme.colors.textMuted} />
            <Text style={s.infoLabel}>Kasir Bertugas</Text>
          </View>
          <Text style={s.infoValue}>{transaction.cashier_name || 'Kasir'}</Text>
        </View>

        <View style={s.infoRow}>
          <View style={s.infoLeft}>
            <Store size={14} color={theme.colors.textMuted} />
            <Text style={s.infoLabel}>Unit Usaha</Text>
          </View>
          <Text style={s.infoValue}>{transaction.business_unit || 'Sembako'}</Text>
        </View>

        {Boolean((transaction as any).customer_name || transaction.customer_phone) && (
          <View style={s.infoRow}>
            <View style={s.infoLeft}>
              <User size={14} color={theme.colors.primary} />
              <Text style={s.infoLabel}>Pelanggan</Text>
            </View>
            <Text style={[s.infoValue, { color: theme.colors.primary, fontWeight: '700' }]}>
              {(transaction as any).customer_name || transaction.customer_phone}
            </Text>
          </View>
        )}
      </View>
    </>
  );
};
