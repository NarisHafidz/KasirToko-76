/**
 * KasirToko-76 Design System
 * Modern Retail POS Theme — inspired by Moka POS / Majoo / Kasir Pintar
 * Supports Light & Dark mode via ThemeContext
 */

export const lightTheme = {
  mode: 'light' as const,
  colors: {
    bgApp: '#F0F4F8',
    bgCard: '#FFFFFF',
    bgCardElevated: '#FFFFFF',
    bgInput: '#F7F9FC',
    border: '#E2E8F0',
    borderLight: '#EDF2F7',
    textPrimary: '#1A202C',
    textSecondary: '#4A5568',
    textMuted: '#718096',
    primary: '#4F46E5',        // Indigo 600 — CTA utama
    primaryHover: '#4338CA',
    primaryLight: 'rgba(79, 70, 229, 0.1)',
    success: '#059669',        // Emerald 600 — green confirm
    successHover: '#047857',
    successLight: 'rgba(5, 150, 105, 0.1)',
    warning: '#D97706',        // Amber 600 — offline
    warningLight: 'rgba(217, 119, 6, 0.1)',
    danger: '#DC2626',         // Red 600 — delete
    dangerLight: 'rgba(220, 38, 38, 0.1)',
    accent: '#7C3AED',         // Violet 700 — accent
    accentLight: 'rgba(124, 58, 237, 0.1)',
    overlay: 'rgba(0, 0, 0, 0.5)',
    // Header specific
    headerBg: '#4F46E5',
    headerText: '#FFFFFF',
    headerSubText: 'rgba(255,255,255,0.75)',
    // Tab bar
    tabBarBg: '#FFFFFF',
    tabBarActive: '#4F46E5',
    tabBarInactive: '#A0AEC0',
  },
  radius: {
    xs: 6,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
    full: 9999,
  },
  shadow: {
    sm: { elevation: 2 },
    md: { elevation: 4 },
    lg: { elevation: 8 },
  },
};

export const darkTheme = {
  mode: 'dark' as const,
  colors: {
    bgApp: '#0B0F19',
    bgCard: '#131B2E',
    bgCardElevated: '#1E293B',
    bgInput: '#0F172A',
    border: '#2A364F',
    borderLight: '#1E293B',
    textPrimary: '#F8FAFC',
    textSecondary: '#94A3B8',
    textMuted: '#64748B',
    primary: '#6366F1',
    primaryHover: '#4F46E5',
    primaryLight: 'rgba(99, 102, 241, 0.15)',
    success: '#10B981',
    successHover: '#059669',
    successLight: 'rgba(16, 185, 129, 0.15)',
    warning: '#F59E0B',
    warningLight: 'rgba(245, 158, 11, 0.15)',
    danger: '#EF4444',
    dangerLight: 'rgba(239, 68, 68, 0.15)',
    accent: '#8B5CF6',
    accentLight: 'rgba(139, 92, 246, 0.15)',
    overlay: 'rgba(0, 0, 0, 0.75)',
    // Header specific
    headerBg: '#131B2E',
    headerText: '#F8FAFC',
    headerSubText: '#64748B',
    // Tab bar
    tabBarBg: '#131B2E',
    tabBarActive: '#6366F1',
    tabBarInactive: '#64748B',
  },
  radius: {
    xs: 6,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
    full: 9999,
  },
  shadow: {
    sm: { elevation: 2 },
    md: { elevation: 4 },
    lg: { elevation: 8 },
  },
};

export type AppTheme = typeof lightTheme | typeof darkTheme;

// Legacy fallback export (dark as default, unchanged for any unported file)
export const theme = darkTheme;
