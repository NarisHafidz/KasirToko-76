import { StyleSheet, Dimensions } from 'react-native';
import { AppTheme } from '../config/theme';

/**
 * Konstanta Layout & Responsivitas Tombol Keypad Numerik
 */
export const SW = Dimensions.get('window').width;
export const PAD_H = 32;
export const GAP = 14;
export const BTN_W = Math.floor((SW - PAD_H * 2 - GAP * 2) / 3);
export const BTN_H = Math.min(68, Math.floor(BTN_W * 0.7));

/**
 * Generator StyleSheet Dinamis untuk Layar Login / Setup PIN Kasir
 * Responsif terhadap adaptasi tema terang/gelap (light/dark mode).
 */
export const makeStyles = (theme: AppTheme, isDark: boolean = false) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.bgApp,
    },
    topBar: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingTop: 10,
      paddingBottom: 6,
    },
    themeBtn: {
      width: 38,
      height: 38,
      borderRadius: 12,
      backgroundColor: theme.colors.bgCard,
      borderWidth: 1,
      borderColor: theme.colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    storeBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: theme.colors.primary + '18',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.colors.primary + '30',
    },
    storeBadgeText: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.colors.primary,
    },
    scrollContent: {
      flexGrow: 1,
      justifyContent: 'space-between',
      paddingHorizontal: 24,
      paddingTop: 10,
      paddingBottom: 24,
    },
    headerCenter: {
      alignItems: 'center',
      marginTop: 8,
      marginBottom: 20,
    },
    iconWrapper: {
      width: 60,
      height: 60,
      borderRadius: 20,
      backgroundColor: theme.colors.primary + '15',
      borderWidth: 1.5,
      borderColor: theme.colors.primary + '35',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 14,
    },
    titleText: {
      fontSize: 22,
      fontWeight: '800',
      color: theme.colors.textPrimary,
      textAlign: 'center',
      letterSpacing: -0.4,
    },
    accountInfoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 6,
    },
    accountText: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.colors.textSecondary,
    },
    subtitleText: {
      fontSize: 13,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      marginTop: 6,
      paddingHorizontal: 16,
      lineHeight: 18,
    },
    dotsRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 14,
      marginVertical: 18,
    },
    dot: {
      width: 16,
      height: 16,
      borderRadius: 8,
      borderWidth: 2,
      borderColor: theme.colors.border,
      backgroundColor: 'transparent',
    },
    dotFilled: {
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.primary,
      transform: [{ scale: 1.15 }],
    },
    errorText: {
      color: theme.colors.danger,
      fontSize: 13,
      fontWeight: '600',
      textAlign: 'center',
      marginBottom: 10,
    },
    lockoutBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: theme.colors.danger + '18',
      borderRadius: 12,
      paddingVertical: 10,
      paddingHorizontal: 14,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: theme.colors.danger + '40',
      alignSelf: 'center',
    },
    lockoutText: {
      color: theme.colors.danger,
      fontSize: 13,
      fontWeight: '700',
    },
    numpadContainer: {
      alignSelf: 'center',
      gap: GAP,
      marginBottom: 16,
    },
    numpadRow: {
      flexDirection: 'row',
      gap: GAP,
    },
    numBtn: {
      width: BTN_W,
      height: BTN_H,
      borderRadius: 18,
      backgroundColor: theme.colors.bgCard,
      borderWidth: 1,
      borderColor: theme.colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      ...theme.shadow.sm,
    },
    numBtnText: {
      fontSize: 24,
      fontWeight: '700',
      color: theme.colors.textPrimary,
    },
    footerActions: {
      alignItems: 'center',
      gap: 12,
      marginTop: 6,
    },
    secondaryBtn: {
      paddingVertical: 8,
      paddingHorizontal: 16,
    },
    secondaryBtnText: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.colors.textSecondary,
    },
    logoutBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingVertical: 10,
      paddingHorizontal: 16,
      borderRadius: 12,
      backgroundColor: theme.colors.danger + '14',
      borderWidth: 1,
      borderColor: theme.colors.danger + '30',
    },
    logoutBtnText: {
      fontSize: 13,
      fontWeight: '700',
      color: theme.colors.danger,
    },
    switcherSection: {
      marginBottom: 10,
      marginTop: 2,
    },
    switcherLabelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      marginBottom: 8,
    },
    switcherLabel: {
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 0.8,
      color: theme.colors.textMuted,
    },
    cardsRow: {
      flexDirection: 'row',
      gap: 12,
    },
    cashierCard: {
      flex: 1,
      padding: 12,
      borderRadius: 16,
      borderWidth: 1.5,
      ...theme.shadow.sm,
    },
    cashierCardActive: {
      backgroundColor: theme.colors.primary + '14',
      borderColor: theme.colors.primary,
    },
    cashierCardInactive: {
      backgroundColor: theme.colors.bgCard,
      borderColor: theme.colors.border,
      opacity: 0.8,
    },
    cardTopRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    cardEmoji: {
      fontSize: 22,
    },
    statusPill: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 8,
    },
    statusPillActive: {
      backgroundColor: theme.colors.primary,
    },
    statusPillInactive: {
      backgroundColor: theme.colors.border + '60',
    },
    statusPillText: {
      fontSize: 10,
      fontWeight: '800',
    },
    statusPillTextActive: {
      color: '#FFFFFF',
    },
    statusPillTextInactive: {
      color: theme.colors.textSecondary,
    },
    cardCashierName: {
      fontSize: 14,
      fontWeight: '800',
      color: theme.colors.textPrimary,
      marginBottom: 4,
    },
    unitBadge: {
      alignSelf: 'flex-start',
      backgroundColor: theme.colors.bgApp,
      paddingHorizontal: 7,
      paddingVertical: 2,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    unitBadgeText: {
      fontSize: 11,
      fontWeight: '600',
      color: theme.colors.textSecondary,
    },

    // STYLES KHUSUS MODAL GANTI PIN
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.65)',
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 16,
    },
    changePinCard: {
      width: '100%',
      maxWidth: 360,
      backgroundColor: theme.colors.bgCard,
      borderRadius: 24,
      padding: 20,
      borderWidth: 1,
      borderColor: theme.colors.border,
      alignItems: 'center',
      ...theme.shadow.md,
      elevation: 10,
    },
    changePinHeader: {
      width: '100%',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 14,
    },
    changePinTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      flex: 1,
      marginRight: 8,
    },
    changePinIconWrap: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: isDark ? 'rgba(37, 99, 235, 0.2)' : theme.colors.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
    },
    changePinTitle: {
      fontSize: 15,
      fontWeight: '800',
      color: theme.colors.textPrimary,
    },
    changePinSubtitle: {
      fontSize: 11,
      fontWeight: '600',
      color: theme.colors.textMuted,
      marginTop: 2,
    },
    stepperRow: {
      flexDirection: 'row',
      gap: 6,
      marginBottom: 16,
      width: '100%',
    },
    stepBadge: {
      flex: 1,
      paddingVertical: 5,
      paddingHorizontal: 4,
      borderRadius: 8,
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : '#F1F5F9',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : '#E2E8F0',
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepBadgeActive: {
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.primary,
    },
    stepBadgeCompleted: {
      backgroundColor: isDark ? 'rgba(16, 185, 129, 0.2)' : '#D1FAE5',
      borderColor: isDark ? 'rgba(16, 185, 129, 0.4)' : '#A7F3D0',
    },
    stepBadgeText: {
      fontSize: 10,
      fontWeight: '700',
      color: theme.colors.textMuted,
    },
    stepBadgeTextActive: {
      color: '#FFFFFF',
    },
    modalPinDotsContainer: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 12,
      marginBottom: 12,
      paddingVertical: 4,
    },
    modalPinDot: {
      width: 14,
      height: 14,
      borderRadius: 7,
      borderWidth: 2,
      borderColor: theme.colors.border,
      backgroundColor: 'transparent',
    },
    modalPinDotFilled: {
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.primary,
    },
    modalErrorText: {
      color: theme.colors.danger,
      fontSize: 12,
      fontWeight: '600',
      textAlign: 'center',
      marginBottom: 8,
    },
    modalNumpad: {
      gap: 8,
      width: '100%',
      alignItems: 'center',
    },
    modalNumpadRow: {
      flexDirection: 'row',
      gap: 8,
      width: '100%',
      justifyContent: 'center',
    },
    modalNumBtn: {
      flex: 1,
      maxWidth: 96,
      height: 48,
      borderRadius: 14,
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : '#FFFFFF',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : '#E2E8F0',
      alignItems: 'center',
      justifyContent: 'center',
      ...theme.shadow.sm,
    },
    modalNumBtnText: {
      fontSize: 18,
      fontWeight: '700',
      color: theme.colors.textPrimary,
    },
  });

export default makeStyles;
