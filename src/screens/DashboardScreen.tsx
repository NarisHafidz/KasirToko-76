import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { useFocusEffect } from '@react-navigation/native';
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Bell,
  BookOpen,
  Calendar,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  CreditCard,
  Edit3,
  FileText,
  Lock,
  LogOut,
  Moon,
  Package,
  Plus,
  RefreshCw,
  Repeat,
  Search,
  Settings,
  ShoppingBag,
  Store,
  Sun,
  Trash2,
  User,
  UserCheck,
  Wallet,
  Wifi,
  X,
} from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  CashierProfileModals,
  Header,
  StoreReminderWidget,
  TransactionDetailModal,
} from '../components';
import { WelcomeGreetingModal } from '../components/WelcomeGreetingModal';
import { getCurrentUserId, supabase } from '../config/supabase';
import { useAuth } from '../config/AuthContext';
import { useTheme } from '../config/ThemeContext';
import { makeStyles } from './DashboardScreen.styles';
import { updateCashierName } from '../services/pinService';
import { getLocalProducts } from '../services/productService';
import {
  fetchReminders,
  addReminder,
  toggleReminderSettled,
  deleteReminder,
  getLocalReminders,
  cacheRemindersLocally,
} from '../services/reminderService';
import {
  addSyncStatusListener,
  cacheTodayTransactionsList,
  checkInternetConnection,
  getCachedTodayTransactions,
  getOfflineQueue,
  getPendingQueueCount,
  syncOfflineTransactions,
} from '../services/syncService';
import {
  formatDailyReceiptNumber,
  formatRupiah,
  getStartOfLocalDay,
  getEndOfLocalDay,
} from '../services/transactionService';
import { StoreReminder, Transaction } from '../types/database';

/**
 * Antarmuka Properti untuk DashboardScreen
 */
interface DashboardScreenProps {
  /** Objek navigasi React Navigation untuk berpindah tab layar */
  navigation: any;
}

/**
 * Komponen Layar Dashboard (DashboardScreen)
 * 
 * FUNGSI UTAMA:
 * Menampilkan rangkuman operasional harian kasir:
 * 1. Informasi sesi kasir/pemilik aktif dengan opsi "Ubah Nama Pemilik" via Modal Interaktif.
 *    - Menyimpan nama baru ke AsyncStorage (@cashier_name & @kasirtoko_cashier_name).
 *    - Memicu animasi WelcomeGreetingModal full screen ala iOS Setup.
 *    - PENTING: Sama sekali TIDAK MENGHAPUS atau MEMPENGARUHI data transaksi yang ada di Supabase maupun SQLite lokal.
 * 2. Status antrean sinkronisasi transaksi offline ke cloud Supabase.
 * 3. Tombol Hero prioritas utama untuk membuka layar Kasir POS.
 * 4. Metrik finansial omzet penjualan hari ini dan jumlah transaksi.
 * 5. Peringatan stok barang yang menipis (<= 5 unit).
 * 6. Riwayat 5 transaksi penjualan terakhir hari ini.
 * 7. Opsi Log Out aman dengan konfirmasi dialog.
 */
export const DashboardScreen: React.FC<DashboardScreenProps> = ({ navigation }) => {
  const { theme, isDark, toggleTheme } = useTheme();
  const {
    cashierName,
    cashierUnit,
    cashierId,
    activeCashierId,
    subProfiles,
    updateSubProfiles,
    user,
    storeName,
    ownerName,
    lockPin,
    logout,
    logoutEmail,
    refreshCashierName,
    updateCashierNameInAuth,
  } = useAuth();

  // Sub-Profil Kasir yang sedang aktif bertugas di perangkat ini
  const activeSubProfile = subProfiles?.[activeCashierId] || {
    name: cashierName || (activeCashierId === 'kasir_2' ? 'Kasir 2' : 'Kasir 1'),
    unit: cashierUnit || (activeCashierId === 'kasir_2' ? 'Unit 2' : 'Unit 1'),
  };
  const activeCashierDisplayName = activeSubProfile.name || cashierName || 'Kasir';
  const activeCashierDisplayUnit = activeSubProfile.unit || cashierUnit || 'Unit Usaha';

  // ==========================================
  // STATE MANAGEMENT OPERASIONAL DASHBOARD
  // ==========================================
  /** Status pull-to-refresh pada ScrollView */
  const [refreshing, setRefreshing] = useState<boolean>(false);
  /** Akumulasi total nilai penjualan (omzet) hari ini dalam Rupiah */
  const [todayRevenue, setTodayRevenue] = useState<number>(0);
  /** Total kuantitas transaksi/struk yang berhasil dicetak hari ini */
  const [todayTxCount, setTodayTxCount] = useState<number>(0);
  /** Jumlah varian produk yang memiliki stok menipis (<= 5 unit) */
  const [lowStockCount, setLowStockCount] = useState<number>(0);
  /** Jumlah transaksi offline yang masih menunggu diunggah ke cloud */
  const [pendingSyncCount, setPendingSyncCount] = useState<number>(0);
  /** Daftar transaksi terbaru untuk ditampilkan pada daftar riwayat */
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  /** Objek transaksi yang dipilih untuk melihat detail struk */
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  /** Kontrol visibilitas modal detail transaksi & cetak ulang */
  const [txDetailModalVisible, setTxDetailModalVisible] = useState<boolean>(false);
  /** Set kode transaksi offline yang sedang menunggu sinkronisasi */
  const [offlineTxCodes, setOfflineTxCodes] = useState<Set<string>>(new Set());
  /** Status proses sinkronisasi manual saat tombol Sync ditekan */
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  /** Status konektivitas internet aktif (Online vs Offline) */
  const [isNetworkOnline, setIsNetworkOnline] = useState<boolean>(true);
  /** Visibilitas modal menu aksi profil kasir (Alternatif B) */
  const [cashierMenuVisible, setCashierMenuVisible] = useState<boolean>(false);

  // ==========================================
  // STATE MANAGEMENT CATATAN & UTANG TOKO (KASBON)
  // ==========================================
  const [reminders, setReminders] = useState<StoreReminder[]>([]);
  const [reminderTab, setReminderTab] = useState<'all' | 'debt' | 'reminder'>('all');
  const [reminderSearchQuery, setReminderSearchQuery] = useState<string>('');
  const [reminderSectionY, setReminderSectionY] = useState<number>(0);
  const mainScrollRef = useRef<ScrollView>(null);
  const [addReminderModalVisible, setAddReminderModalVisible] = useState<boolean>(false);
  const [formType, setFormType] = useState<'debt' | 'reminder'>('debt');
  const [formCustomerName, setFormCustomerName] = useState<string>('');
  const [formAmount, setFormAmount] = useState<string>('');
  const [formDueDate, setFormDueDate] = useState<string>('');
  const [formNotes, setFormNotes] = useState<string>('');
  const [isSavingReminder, setIsSavingReminder] = useState<boolean>(false);

  // ==========================================
  // STATE MANAGEMENT UBAH SUB-PROFIL KASIR & ANIMASI WELCOME
  // ==========================================
  /** Kontrol visibilitas modal dialog ubah profil kasir */
  const [editNameModalVisible, setEditNameModalVisible] = useState<boolean>(false);
  /** Kontrol visibilitas pop-up dialog Keamanan Sesi Kasir (Kunci Layar / Keluar) */
  const [lockSessionModalVisible, setLockSessionModalVisible] = useState<boolean>(false);
  /** Input nama pemilik / kasir toko */
  const [newOwnerNameInput, setNewOwnerNameInput] = useState('');
  /** Form input Kasir 1 */
  const [editKasir1Name, setEditKasir1Name] = useState<string>('Kasir 1');
  const [editKasir1Unit, setEditKasir1Unit] = useState<string>('Unit 1');
  /** Form input Kasir 2 */
  const [editKasir2Name, setEditKasir2Name] = useState<string>('Kasir 2');
  const [editKasir2Unit, setEditKasir2Unit] = useState<string>('Unit 2');
  /** Status loading saat proses penyimpanan profil kasir baru */
  const [isSavingName, setIsSavingName] = useState<boolean>(false);
  /** Kontrol visibilitas modal animasi Welcome / Hello screen */
  const [welcomeModalVisible, setWelcomeModalVisible] = useState<boolean>(false);
  /** Nama yang dikonfirmasi untuk ditampilkan pada modal animasi */
  const [activeWelcomeName, setActiveWelcomeName] = useState<string>('');

  /**
   * MEMUAT DATA CATATAN & UTANG KASBON DENGAN SILENT FALLBACK OFFLINE (NETINFO CHECK)
   */
  const loadReminders = useCallback(async () => {
    try {
      // 1. Pengecekan status koneksi internet aktif menggunakan NetInfo
      try {
        const netState = await NetInfo.fetch();
        if (netState.isConnected === false) {
          // Status offline: lewati pemanggilan API Supabase dan gunakan cache lokal secara silent
          const cached = await getLocalReminders();
          setReminders(cached);
          return;
        }
      } catch {
        // Lanjutkan dengan aman jika pengecekan NetInfo terkendala
      }

      // 2. Jika online, ambil data dari cloud Supabase terfilter user_id
      const userId = await getCurrentUserId();
      let query = supabase
        .from('store_reminders')
        .select('*')
        .order('created_at', { ascending: false });

      if (userId) {
        query = query.eq('user_id', userId);
      }

      const { data, error } = await query;

      if (error) {
        // Tangkap kegagalan query secara silent (misal: timeout / network error)
        console.warn('Koneksi Supabase store_reminders terkendala, menggunakan cache lokal:', error.message);
        const cached = await getLocalReminders();
        setReminders(cached);
        return;
      }

      if (data) {
        const loaded = data as StoreReminder[];
        setReminders(loaded);
        await cacheRemindersLocally(loaded);
      }
    } catch (err: any) {
      // Tangkap network error / fetch failed secara silent tanpa console.error mentah
      console.warn('Pengecualian saat fetch store_reminders (silent offline fallback):', err?.message || err);
      try {
        const cached = await getLocalReminders();
        setReminders(cached);
      } catch {
        // Abaikan jika pembacaan cache lokal mengalami kendala
      }
    }
  }, []);

  /**
   * FUNGSI AGREGASI DATA DASHBOARD (loadDashboardData)
   */
  const loadDashboardData = useCallback(async () => {
    // 1. Hitung stok menipis dari cache lokal
    const products = await getLocalProducts();
    let lowStock = 0;
    for (const p of products) {
      if (p.variants) {
        for (const v of p.variants) {
          if (v.stock <= 5) lowStock++;
        }
      }
    }
    setLowStockCount(lowStock);

    // 2. Ambil total antrean transaksi offline yang belum tersinkron
    const pending = await getPendingQueueCount();
    setPendingSyncCount(pending);

    // 3. Batas waktu awal dan akhir hari ini secara lokal (00:00:00 - 23:59:59.999)
    const isOnline = await checkInternetConnection();
    setIsNetworkOnline(isOnline);
    const todayStart = getStartOfLocalDay(new Date());
    const todayEnd = getEndOfLocalDay(new Date());

    let txList: Transaction[] = [];

    // 4. Hitung transaksi dari antrean offline lokal hari ini
    const queue = await getOfflineQueue();
    const offlineCodes = new Set<string>();
    for (const q of queue) {
      if (q.transaction?.transaction_code) {
        offlineCodes.add(q.transaction.transaction_code);
      }
      const qDate = new Date(q.transaction.created_at);
      if (qDate >= todayStart && qDate <= todayEnd) {
        txList.push(q.transaction);
      }
    }
    setOfflineTxCodes(offlineCodes);

    // 5. Jika online, ambil transaksi dari cloud Supabase terfilter user_id dan gabungkan
    if (isOnline) {
      try {
        const userId = await getCurrentUserId();
        let q = supabase
          .from('transactions')
          .select('*')
          .gte('created_at', todayStart.toISOString())
          .lte('created_at', todayEnd.toISOString())
          .order('created_at', { ascending: false });

        if (userId) {
          q = q.eq('user_id', userId);
        }

        const { data: cloudTx } = await q;

        if (cloudTx) {
          // Deduplikasi berdasarkan id atau transaction_code
          const combined = [...txList, ...cloudTx];
          const seen = new Set<string>();
          const deduped: Transaction[] = [];
          for (const item of combined) {
            const key = item.id || item.transaction_code;
            if (!seen.has(key)) {
              seen.add(key);
              deduped.push(item);
            }
          }
          // Urutkan transaksi terbaru di urutan pertama
          deduped.sort(
            (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );
          txList = deduped;

          // Simpan ke cache transaksi hari ini agar sequence transaksi offline konsisten
          await cacheTodayTransactionsList(deduped);
        }
      } catch (err) {
        console.warn('Gagal memuat transaksi cloud untuk dashboard:', err);
      }
    } else {
      // 5b. Jika offline, ambil juga transaksi dari cache lokal hari ini
      try {
        const cachedToday = await getCachedTodayTransactions();
        const combined = [...txList, ...cachedToday];
        const seen = new Set<string>();
        const deduped: Transaction[] = [];
        for (const item of combined) {
          const key = item.id || item.transaction_code;
          if (!seen.has(key)) {
            seen.add(key);
            deduped.push(item);
          }
        }
        deduped.sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        txList = deduped;
      } catch (err) {
        console.warn('Gagal membaca cache transaksi lokal hari ini:', err);
      }
    }

    // 6. Hitung omzet dan jumlah transaksi dari daftar terdeduplikasi
    const rev = txList.reduce((sum, t) => sum + Number(t.total_amount || 0), 0);
    const count = txList.length;

    // 7. Simpan hasil kalkulasi ke state (maksimal 10 transaksi untuk scrollable box)
    setTodayRevenue(rev);
    setTodayTxCount(count);
    setRecentTransactions(txList.slice(0, 10));

    // 8. Ambil daftar catatan toko & utang kasbon langsung dari Supabase
    await loadReminders();
  }, [loadReminders]);

  /**
   * Handler membuka modal rincian transaksi & cetak ulang struk
   */
  const handleOpenTransactionDetail = (tx: Transaction) => {
    setSelectedTx(tx);
    setTxDetailModalVisible(true);
  };

  /**
   * USE EFFECT: Auto-Sync Listener & Status Jaringan Real-Time
   * Mendengarkan siaran perubahan jaringan NetInfo & auto-sync:
   * memperbarui status jaringan UI dari 'Offline/Antrean' menjadi 'Online' secara otomatis,
   * dan me-reload data dashboard jika terdapat transaksi yang selesai diunggah di background.
   */
  useEffect(() => {
    checkInternetConnection().then((online) => setIsNetworkOnline(online));

    const unsubscribe = addSyncStatusListener(async (status) => {
      setIsNetworkOnline(status.isOnline);
      setPendingSyncCount(status.pendingCount);
      if (status.syncedCount > 0) {
        await loadDashboardData();
      }
    });

    return () => {
      unsubscribe();
    };
  }, [loadDashboardData]);

  /**
   * USE EFFECT: Supabase Realtime Subscription untuk tabel store_reminders
   * Dilengkapi penanganan Silent Auto-Reconnect & Clean WebSocket Teardown (mencegah memory leak & baterai boros)
   */
  useEffect(() => {
    let isMounted = true;
    let activeChannel: any = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    // 1. Muat data awal saat komponen mount
    loadReminders();

    // 2. Listener perubahan koneksi internet: reload otomatis saat perangkat kembali online
    const unsubscribeNetInfo = NetInfo.addEventListener((state) => {
      if (isMounted && state.isConnected) {
        loadReminders();
      }
    });

    const userId = user?.id;
    const filter = userId ? `user_id=eq.${userId}` : undefined;

    const setupRealtimeSubscription = async () => {
      if (!isMounted) return;

      // Cek koneksi sebelum membuat channel realtime WebSocket
      try {
        const netState = await NetInfo.fetch();
        if (netState.isConnected === false) {
          if (reconnectTimer) clearTimeout(reconnectTimer);
          reconnectTimer = setTimeout(() => {
            if (isMounted) {
              setupRealtimeSubscription();
            }
          }, 10000);
          return;
        }
      } catch {
        // Abaikan pengecekan
      }

      // Hapus channel sebelumnya secara bersih jika ada sebelum membuat subscription baru
      if (activeChannel) {
        try {
          supabase.removeChannel(activeChannel);
        } catch {}
        activeChannel = null;
      }

      // Buat channel realtime dengan channel name unik per siklus koneksi
      const channelName = `store_reminders_${userId || 'guest'}_${Date.now()}`;
      const channel = supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'store_reminders',
            filter,
          },
          () => {
            if (isMounted) {
              loadReminders();
            }
          }
        )
        .subscribe((status) => {
          if (!isMounted) return;

          if (status === 'SUBSCRIBED') {
            // Koneksi Realtime aktif & tersambung stabil
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
            // Penanganan silent auto-reconnect:
            // Jika terjadi error koneksi atau socket closed 1001 / timeout,
            // refresh data lokal secara silent dan jadwalkan auto-reconnect tanpa spam console.error
            loadReminders();

            if (reconnectTimer) clearTimeout(reconnectTimer);
            reconnectTimer = setTimeout(() => {
              if (isMounted) {
                setupRealtimeSubscription();
              }
            }, 10000);
          }
        });

      activeChannel = channel;
    };

    setupRealtimeSubscription();

    // 3. Cleanup lifecycle: hapus listener, channel WebSocket & timer saat unmount
    return () => {
      isMounted = false;
      unsubscribeNetInfo();
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      if (activeChannel) {
        try {
          supabase.removeChannel(activeChannel);
        } catch {}
        activeChannel = null;
      }
    };
  }, [loadReminders, user?.id]);

  /**
   * USE FOCUS EFFECT:
   * Menjalankan loadDashboardData() setiap kali tab Dashboard dibuka/fokus kembali.
   */
  useFocusEffect(
    useCallback(() => {
      loadDashboardData();
    }, [loadDashboardData])
  );

  /**
   * HANDLER PULL-TO-REFRESH
   */
  const onRefresh = async () => {
    setRefreshing(true);
    await loadDashboardData();
    setRefreshing(false);
  };

  /**
   * HANDLER SINKRONISASI MANUAL
   */
  const handleManualSync = async () => {
    const isOnline = await checkInternetConnection();
    if (!isOnline) {
      Alert.alert(
        'Koneksi Offline',
        'Tidak ada jaringan internet aktif. Antrean akan disinkron otomatis saat perangkat terhubung kembali.'
      );
      return;
    }
    setIsSyncing(true);
    try {
      const result = await syncOfflineTransactions();
      await loadDashboardData();
      Alert.alert(
        'Sinkronisasi Selesai',
        `Berhasil mengunggah ${result.syncedCount} transaksi. Sisa antrean: ${result.remainingCount}.`
      );
    } catch (err: any) {
      Alert.alert('Gagal Sinkronisasi', err?.message || 'Terjadi gangguan saat mengunggah data.');
    } finally {
      setIsSyncing(false);
    }
  };

  /**
   * HANDLER BUKA MODAL UBAH SUB-PROFIL KASIR AKTIF
   */
  const handleOpenEditNameModal = () => {
    const k1 = subProfiles?.kasir_1?.name || ownerName || 'Kasir 1';
    const k1Unit = subProfiles?.kasir_1?.unit || 'Unit 1';
    const k2 = subProfiles?.kasir_2?.name || 'Kasir 2';
    const k2Unit = subProfiles?.kasir_2?.unit || 'Unit 2';

    setEditKasir1Name(k1);
    setEditKasir1Unit(k1Unit);
    setEditKasir2Name(k2);
    setEditKasir2Unit(k2Unit);

    if (activeCashierId === 'kasir_2') {
      setNewOwnerNameInput(k2);
    } else {
      setNewOwnerNameInput(k1);
    }
    setEditNameModalVisible(true);
  };

  /**
   * HANDLER SIMPAN SUB-PROFIL KASIR AKTIF
   * Menyimpan nama kasir dan unit usaha yang sedang aktif ke database & AsyncStorage
   */
  const handleSaveNewOwnerName = async () => {
    setIsSavingName(true);
    try {
      if (activeCashierId === 'kasir_2') {
        const k2Name = editKasir2Name.trim() || newOwnerNameInput.trim() || 'Kasir 2';
        const k2Unit = editKasir2Unit.trim() || 'Unit 2';
        await updateSubProfiles({
          kasir_2: { name: k2Name, unit: k2Unit },
        });
        setActiveWelcomeName(k2Name);
      } else {
        const k1Name = newOwnerNameInput.trim() || editKasir1Name.trim() || 'Kasir 1';
        const k1Unit = editKasir1Unit.trim() || 'Unit 1';
        await updateSubProfiles({
          kasir_1: { name: k1Name, unit: k1Unit },
        });
        setActiveWelcomeName(k1Name);
      }

      // Tutup dialog modal
      handleCloseEditNameModal();

      // Tampilkan greeting modal konfirmasi
      setWelcomeModalVisible(true);
    } catch (err: any) {
      Alert.alert('Gagal Memperbarui Profil', err?.message || 'Terjadi kesalahan saat menyimpan profil kasir.');
    } finally {
      setIsSavingName(false);
    }
  };

  /**
   * HANDLER SWITCH / GANTI KASIR
   * Menutup modal dan mengarahkan kembali ke layar PIN Login untuk berpindah sub-profil
   */
  const handleSwitchCashier = () => {
    handleCloseEditNameModal();
    lockPin();
  };

  /**
   * HANDLER LOG OUT KASIR:
   * Membuka Pop-up Dialog Keamanan Sesi Kasir yang berfokus pada opsi Kunci Layar
   */
  const handleLogout = () => {
    setLockSessionModalVisible(true);
  };

  /**
   * HANDLER KUNCI LAYAR KASIR (TOMBOL UTAMA):
   * Mengunci aplikasi ke layar PIN Login (sesi email tetap tersimpan)
   */
  const handleExecuteLock = () => {
    setLockSessionModalVisible(false);
    lockPin();
  };

  /**
   * HANDLER KELUAR AKUN / SHIFT UTAMA (DEVELOPER / HIDDEN ACTION):
   * Menutup modal dan memicu dialog konfirmasi sign out email Supabase
   */
  const handleExecuteLogoutEmail = () => {
    setLockSessionModalVisible(false);
    logoutEmail();
  };

  /**
   * HANDLER TUTUP MODAL TAMBAH CATATAN & RESET FORM
   */
  const handleCloseAddReminderModal = () => {
    setAddReminderModalVisible(false);
    setFormCustomerName('');
    setFormAmount('');
    setFormDueDate('');
    setFormNotes('');
    setFormType('debt');
  };

  /**
   * HANDLER TUTUP MODAL UBAH SUB-PROFIL KASIR
   */
  const handleCloseEditNameModal = () => {
    setEditNameModalVisible(false);
  };

  /**
   * HANDLER TANDAI LUNAS / UBAH STATUS KASBON
   */
  const handleToggleReminderSettled = (item: StoreReminder) => {
    const newStatus = !item.is_settled;
    const actionLabel = newStatus ? 'Lunas' : 'Belum Lunas';
    const message = `Tandai utang kasbon pelanggan "${item.customer_name || 'Pelanggan'}" sebesar ${formatRupiah(item.amount || 0)} sebagai ${actionLabel}?`;

    const executeToggle = async () => {
      try {
        await toggleReminderSettled(item.id, newStatus);
        await loadReminders();
      } catch (err: any) {
        console.error('Gagal memperbarui status utang ke Supabase:', err);
        Alert.alert('Gagal Mengubah Status', err?.message || 'Terjadi gangguan koneksi saat menyimpan ke Supabase.');
      }
    };

    if (Platform.OS === 'web') {
      const confirmed = typeof window !== 'undefined' && window.confirm ? window.confirm(message) : true;
      if (confirmed) {
        executeToggle();
      }
      return;
    }

    Alert.alert('Konfirmasi Status Utang', message, [
      { text: 'Batal', style: 'cancel' },
      { text: `Ya, Tandai ${actionLabel}`, style: 'default', onPress: executeToggle },
    ]);
  };

  /**
   * HANDLER HAPUS CATATAN TOKO
   */
  const handleDeleteReminder = (id: string, name?: string | null) => {
    const message = `Apakah Anda yakin ingin menghapus catatan ${name ? `"${name}"` : 'ini'}?`;

    const executeDelete = async () => {
      try {
        await deleteReminder(id);
        await loadReminders();
      } catch (err: any) {
        console.error('Gagal menghapus catatan dari Supabase:', err);
        Alert.alert('Gagal Menghapus Catatan', err?.message || 'Terjadi gangguan koneksi ke Supabase.');
      }
    };

    if (Platform.OS === 'web') {
      const confirmed = typeof window !== 'undefined' && window.confirm ? window.confirm(message) : true;
      if (confirmed) {
        executeDelete();
      }
      return;
    }

    Alert.alert('Hapus Catatan', message, [
      { text: 'Batal', style: 'cancel' },
      { text: 'Hapus', style: 'destructive', onPress: executeDelete },
    ]);
  };

  /**
   * HANDLER SIMPAN CATATAN / UTANG BARU
   */
  const handleSaveReminder = async () => {
    if (formType === 'debt') {
      if (!formCustomerName.trim()) {
        Alert.alert('Data Belum Lengkap', 'Silakan masukkan nama pelanggan yang berutang.');
        return;
      }
      const parsedAmount = parseInt(formAmount.replace(/[^0-9]/g, ''), 10) || 0;
      if (parsedAmount <= 0) {
        Alert.alert('Nominal Tidak Valid', 'Masukkan nominal utang yang valid (lebih dari Rp 0).');
        return;
      }
    } else {
      if (!formNotes.trim()) {
        Alert.alert('Data Belum Lengkap', 'Silakan tulis isi catatan/pengingat toko.');
        return;
      }
    }

    setIsSavingReminder(true);
    try {
      const parsedAmount = parseInt(formAmount.replace(/[^0-9]/g, ''), 10) || 0;
      await addReminder({
        type: formType,
        customer_name: formType === 'debt' ? formCustomerName.trim() : null,
        amount: formType === 'debt' ? parsedAmount : 0,
        due_date: formDueDate.trim() || null,
        notes: formNotes.trim() || null,
        created_by: cashierName,
      });

      handleCloseAddReminderModal();
      await loadReminders();

      Alert.alert(
        'Berhasil Disimpan',
        formType === 'debt'
          ? 'Catatan utang pelanggan berhasil disimpan ke database Supabase.'
          : 'Pengingat operasional toko berhasil ditambahkan ke Supabase.'
      );
    } catch (err: any) {
      console.error('Gagal menyimpan catatan toko ke Supabase:', err);
      Alert.alert('Gagal Menyimpan', err?.message || 'Terjadi gangguan saat menyimpan catatan ke Supabase.');
    } finally {
      setIsSavingReminder(false);
    }
  };

  // Kalkulasi Ringkasan Widget Catatan & Kasbon (tetap menggunakan seluruh data agar total ringkasan akurat)
  const activeDebts = reminders.filter((r) => r.type === 'debt' && !r.is_settled);
  const totalUnpaidDebt = activeDebts.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
  const activeRemindersCount = reminders.filter((r) => r.type === 'reminder' && !r.is_settled).length;

  // Filter daftar catatan secara real-time berdasarkan kategori tab & kata kunci pencarian (case-insensitive)
  const filteredReminders = reminders.filter((r) => {
    // 1. Filter kategori tab
    if (reminderTab === 'debt' && r.type !== 'debt') return false;
    if (reminderTab === 'reminder' && r.type !== 'reminder') return false;

    // 2. Filter pencarian teks real-time
    const query = reminderSearchQuery.trim().toLowerCase();
    if (query) {
      const customerMatch = (r.customer_name || '').toLowerCase().includes(query);
      const notesMatch = (r.notes || '').toLowerCase().includes(query);
      const typeLabel = r.type === 'debt' ? 'utang kasbon pelanggan' : 'pengingat catatan toko agenda';
      const typeMatch = typeLabel.includes(query);
      const dueDateMatch = (r.due_date || '').toLowerCase().includes(query);
      return customerMatch || notesMatch || typeMatch || dueDateMatch;
    }

    return true;
  });

  // STYLESHEET DINAMIS
  const s = makeStyles(theme, isDark);

  return (
    <SafeAreaView style={s.container} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header Aplikasi dengan Aksi Cepat: Toggle Tema, Refresh Data, dan Log Out Kasir */}
        <Header
          title={storeName || 'Ringkasan Toko'}
          subtitle={user?.email ? `${user.email} • Cloud POS` : 'KasirToko Operasional'}
          rightAction={
            <View style={s.headerActions}>
              <TouchableOpacity
                style={s.actionIconBtn}
                onPress={toggleTheme}
                activeOpacity={0.75}
                accessibilityLabel="Ganti Mode Gelap/Terang"
              >
                {isDark ? (
                  <Sun size={18} color={theme.colors.warning || '#F59E0B'} />
                ) : (
                  <Moon size={18} color={theme.colors.textSecondary || '#64748B'} />
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={s.actionIconBtn}
                onPress={loadDashboardData}
                activeOpacity={0.75}
                accessibilityLabel="Muat Ulang Data"
              >
                <RefreshCw size={18} color={theme.colors.textSecondary || '#64748B'} />
              </TouchableOpacity>

              <TouchableOpacity
                style={[s.actionIconBtn, s.logoutBtn]}
                onPress={handleLogout}
                activeOpacity={0.75}
                accessibilityLabel="Keluar Sesi Kasir"
              >
                <LogOut size={18} color={theme.colors.danger || '#EF4444'} />
              </TouchableOpacity>
            </View>
          }
        />

        <ScrollView
          ref={mainScrollRef}
          contentContainerStyle={[s.scrollContent, { flexGrow: 1 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />
          }
        >
        {/* KARTU PROFIL KASIR (2 KOLOM SEIMBANG: INFO KASIR & MENU AKSI) */}
        <View style={s.cashierBar}>
          {/* KOLOM KIRI: INFO KASIR */}
          <TouchableOpacity
            style={s.cashierLeft}
            onPress={() => setCashierMenuVisible(true)}
            activeOpacity={0.8}
            accessibilityLabel="Informasi Profil Kasir"
          >
            {/* Avatar dengan Indikator Status Dot Hijau */}
            <View style={s.cashierAvatarWrap}>
              <View style={s.cashierAvatar}>
                <UserCheck size={20} color={theme.colors.primary} />
              </View>
              <View style={s.avatarStatusDot} />
            </View>

            {/* Hierarki Teks: Nama Kasir & Unit Usaha */}
            <View style={s.cashierInfoCol}>
              <View style={s.cashierNameRow}>
                <Text style={s.cashierTitle} numberOfLines={1}>
                  {activeCashierDisplayName}
                </Text>
                <View style={s.miniActiveBadge}>
                  <Text style={s.miniActiveBadgeText}>Aktif</Text>
                </View>
              </View>
              <Text style={s.cashierUnitSubText} numberOfLines={1}>
                Unit Usaha: {activeCashierDisplayUnit}
              </Text>
            </View>
          </TouchableOpacity>

          {/* KOLOM KANAN: TOMBOL AKSI MINIMALIS (MENU GEAR) */}
          <View style={s.cashierActions}>
            <TouchableOpacity
              style={s.cashierMenuBtn}
              onPress={() => setCashierMenuVisible(true)}
              activeOpacity={0.75}
              accessibilityLabel="Buka Menu Kasir"
            >
              <Settings size={18} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* BANNER ANTREAN SINKRONISASI TRANSAKSI OFFLINE */}
        {pendingSyncCount > 0 && (
          <View style={s.syncBanner}>
            <View style={s.syncBannerInfo}>
              <Wifi size={16} color={theme.colors.warning || '#92400E'} />
              <View style={{ flex: 1 }}>
                <Text style={s.syncBannerTitle}>{pendingSyncCount} Transaksi Belum Tersinkron</Text>
                <Text style={s.syncBannerSub}>Tersimpan aman di perangkat & siap diunggah ke cloud</Text>
              </View>
            </View>
            <TouchableOpacity
              style={s.syncBannerBtn}
              onPress={handleManualSync}
              disabled={isSyncing}
              activeOpacity={0.8}
            >
              <RefreshCw size={12} color="#FFFFFF" />
              <Text style={s.syncBannerBtnText}>{isSyncing ? 'Wait...' : 'Sync'}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* 1. HERO UTAMA: BUKA KASIR (POS) */}
        <TouchableOpacity
          style={s.mainPosHero}
          onPress={() => navigation.navigate('POS')}
          activeOpacity={0.85}
        >
          <View style={s.posHeroLeft}>
            <View style={s.posHeroIconWrap}>
              <ShoppingBag size={24} color={theme.colors.success || '#10B981'} />
            </View>
            <View>
              <Text style={s.posHeroTitle}>BUKA KASIR</Text>
              <Text style={s.posHeroSub}>Mulai transaksi penjualan baru</Text>
            </View>
          </View>
          <View style={s.posHeroBadge}>
            <Text style={s.posHeroBadgeText}>MASUK</Text>
            <ArrowRight size={16} color="#FFFFFF" />
          </View>
        </TouchableOpacity>

        {/* 2. RINGKASAN METRIK: OMZET HARI INI & STATUS STOK */}
        <View style={s.metricsRow}>
          <View style={s.revenueCard}>
            <Text style={s.cardMetaLabel}>Omzet Hari Ini</Text>
            <Text style={s.revenueVal}>{formatRupiah(todayRevenue)}</Text>
            <Text style={s.revenueSubText}>Total dari {todayTxCount} transaksi selesai</Text>
          </View>

          <View style={s.statMiniCard}>
            <View style={s.statBoxRow}>
              <Text style={s.statBoxLabel}>Struk</Text>
              <Text style={s.statBoxVal}>{todayTxCount}</Text>
            </View>
            <View style={{ height: 1, backgroundColor: theme.colors.border, marginVertical: 4 }} />
            <View style={s.statBoxRow}>
              <Text style={s.statBoxLabel}>Stok Tipis</Text>
              <Text
                style={[
                  s.statBoxVal,
                  lowStockCount > 0 && { color: theme.colors.danger || '#EF4444' },
                ]}
              >
                {lowStockCount}
              </Text>
            </View>
          </View>
        </View>

        {/* 3. MENU KELOLA TOKO (Katalog Produk & Laporan Finansial) */}
        <Text style={s.sectionTitle}>Kelola Toko</Text>
        <View style={s.menuGrid}>
          <TouchableOpacity
            style={s.menuCard}
            onPress={() => navigation.navigate('Products')}
            activeOpacity={0.7}
          >
            <View
              style={[
                s.menuIconBox,
                { backgroundColor: isDark ? 'rgba(37, 99, 235, 0.2)' : '#EFF6FF' },
              ]}
            >
              <Package size={22} color={theme.colors.primary || '#2563EB'} />
            </View>
            <View>
              <Text style={s.menuTitle}>Katalog Produk</Text>
              <Text style={s.menuDesc}>Stok & Harga Modal</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={s.menuCard}
            onPress={() => navigation.navigate('Reports')}
            activeOpacity={0.7}
          >
            <View
              style={[
                s.menuIconBox,
                { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.2)' : '#ECFDF5' },
              ]}
            >
              <BarChart3 size={22} color={theme.colors.success || '#059669'} />
            </View>
            <View>
              <Text style={s.menuTitle}>Laporan</Text>
              <Text style={s.menuDesc}>Laba & Tren Omzet</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* 4. WIDGET CATATAN & PENGINGAT TOKO (KASBON & AGENDA) (KOMPONEN MODULAR) */}
        <StoreReminderWidget
          reminders={reminders}
          filteredReminders={filteredReminders}
          totalUnpaidDebt={totalUnpaidDebt}
          activeRemindersCount={activeRemindersCount}
          activeDebtsCount={activeDebts.length}
          reminderTab={reminderTab}
          setReminderTab={setReminderTab}
          reminderSearchQuery={reminderSearchQuery}
          setReminderSearchQuery={setReminderSearchQuery}
          addReminderModalVisible={addReminderModalVisible}
          setAddReminderModalVisible={setAddReminderModalVisible}
          formType={formType}
          setFormType={setFormType}
          formCustomerName={formCustomerName}
          setFormCustomerName={setFormCustomerName}
          formAmount={formAmount}
          setFormAmount={setFormAmount}
          formDueDate={formDueDate}
          setFormDueDate={setFormDueDate}
          formNotes={formNotes}
          setFormNotes={setFormNotes}
          isSavingReminder={isSavingReminder}
          handleSaveReminder={handleSaveReminder}
          handleToggleReminderSettled={handleToggleReminderSettled}
          handleDeleteReminder={handleDeleteReminder}
          handleCloseAddReminderModal={handleCloseAddReminderModal}
          onLayout={(e) => {
            setReminderSectionY(e.nativeEvent.layout.y);
          }}
          onSearchFocus={() => {
            setTimeout(() => {
              if (reminderSectionY > 0) {
                mainScrollRef.current?.scrollTo({
                  y: Math.max(0, reminderSectionY - 16),
                  animated: true,
                });
              }
            }, 150);
          }}
        />

        {/* 5. RIWAYAT TRANSAKSI TERAKHIR */}
        <View style={s.recentHeaderRow}>
          <Text style={s.recentSectionTitle}>Transaksi Terakhir</Text>
          <TouchableOpacity
            style={s.viewAllBtn}
            onPress={() => navigation.navigate('Reports')}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Lihat Semua Riwayat Transaksi"
          >
            <Text style={s.viewAllBtnText}>Lihat Semua</Text>
            <ChevronRight size={14} color={theme.colors.primary} />
          </TouchableOpacity>
        </View>

        {recentTransactions.length > 0 ? (
          <View style={s.recentListCard}>
            <ScrollView
              style={s.recentScrollBox}
              contentContainerStyle={s.recentScrollContent}
              nestedScrollEnabled={true}
              showsVerticalScrollIndicator={true}
              keyboardShouldPersistTaps="handled"
            >
              {recentTransactions.map((tx, idx) => {
                const dateStr = new Date(tx.created_at).toLocaleTimeString('id-ID', {
                  hour: '2-digit',
                  minute: '2-digit',
                });
                const isLast = idx === recentTransactions.length - 1;
                const dailyReceiptNo = formatDailyReceiptNumber(tx);
                const isOffline = offlineTxCodes.has(tx.transaction_code);

                return (
                  <TouchableOpacity
                    key={tx.id || tx.transaction_code}
                    style={[s.txRow, isLast && { borderBottomWidth: 0 }]}
                    onPress={() => handleOpenTransactionDetail(tx)}
                    activeOpacity={0.7}
                  >
                    <View style={s.txRowLeft}>
                      <View
                        style={[
                          s.txIconWrap,
                          isOffline && { backgroundColor: theme.colors.warningLight || '#FEF3C7' },
                        ]}
                      >
                        {isOffline ? (
                          <Clock size={16} color={theme.colors.warning || '#D97706'} />
                        ) : (
                          <CheckCircle2 size={16} color={theme.colors.success || '#10B981'} />
                        )}
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <Text style={[s.txCode, { color: theme.colors.primary, fontWeight: '800' }]}>
                            {dailyReceiptNo}
                          </Text>
                          <Text style={s.txCode}>• {tx.transaction_code}</Text>
                          {isOffline && (
                            <View style={s.txOfflineBadge}>
                              <Text style={s.txOfflineBadgeText}>Offline</Text>
                            </View>
                          )}
                        </View>
                        <Text style={s.txMeta}>
                          {dateStr} • {tx.payment_method.toUpperCase()}
                        </Text>
                      </View>
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 2 }}>
                      <Text style={s.txAmount}>{formatRupiah(tx.total_amount)}</Text>
                      <ChevronRight size={13} color={theme.colors.textMuted} />
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        ) : (
          <View style={s.emptyBox}>
            <Clock size={24} color={theme.colors.textMuted} />
            <Text style={s.emptyText}>Belum ada transaksi tercatat hari ini</Text>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>



      {/* ===================================================================== */}
      {/* MODAL SESI & PROFIL KASIR (KOMPONEN MODULAR) */}
      {/* ===================================================================== */}
      <CashierProfileModals
        activeCashierId={activeCashierId}
        ownerName={ownerName}
        editKasir1Name={editKasir1Name}
        setEditKasir1Name={setEditKasir1Name}
        editKasir1Unit={editKasir1Unit}
        setEditKasir1Unit={setEditKasir1Unit}
        editKasir2Name={editKasir2Name}
        setEditKasir2Name={setEditKasir2Name}
        editKasir2Unit={editKasir2Unit}
        setEditKasir2Unit={setEditKasir2Unit}
        newOwnerNameInput={newOwnerNameInput}
        setNewOwnerNameInput={setNewOwnerNameInput}
        editNameModalVisible={editNameModalVisible}
        setEditNameModalVisible={setEditNameModalVisible}
        lockSessionModalVisible={lockSessionModalVisible}
        setLockSessionModalVisible={setLockSessionModalVisible}
        cashierMenuVisible={cashierMenuVisible}
        setCashierMenuVisible={setCashierMenuVisible}
        isSavingName={isSavingName}
        activeCashierDisplayName={activeCashierDisplayName}
        activeCashierDisplayUnit={activeCashierDisplayUnit}
        handleCloseEditNameModal={handleCloseEditNameModal}
        handleSaveNewOwnerName={handleSaveNewOwnerName}
        handleSwitchCashier={handleSwitchCashier}
        handleExecuteLock={handleExecuteLock}
        handleExecuteLogoutEmail={handleExecuteLogoutEmail}
        handleLogout={handleLogout}
        handleOpenEditNameModal={handleOpenEditNameModal}
      />

      {/* MODAL ANIMASI WELCOME / HELLO SCREEN FULL SCREEN */}
      <WelcomeGreetingModal
        visible={welcomeModalVisible}
        cashierName={activeWelcomeName}
        isFirstTime={false}
        onDismiss={() => setWelcomeModalVisible(false)}
      />

      {/* MODAL PRATINJAU DETAIL TRANSAKSI & CETAK ULANG STRUK */}
      <TransactionDetailModal
        visible={txDetailModalVisible}
        onClose={() => {
          setTxDetailModalVisible(false);
          setSelectedTx(null);
        }}
        transaction={selectedTx}
        isOffline={selectedTx ? offlineTxCodes.has(selectedTx.transaction_code) : false}
      />
    </SafeAreaView>
  );
};

export default DashboardScreen;