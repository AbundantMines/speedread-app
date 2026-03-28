export const Colors = {
  // Backgrounds
  bg: '#0a0a0a',
  card: '#111111',
  elevated: '#1a1a1a',

  // Accent
  gold: '#c9a84c',
  goldLight: '#e0c06a',
  goldDark: '#a07830',

  // Text
  textPrimary: '#e8e0d0',
  textMuted: '#8a8070',
  textDisabled: '#4a4040',

  // Borders
  border: '#2a2a2a',
  borderLight: '#3a3a3a',

  // Status
  success: '#4caf50',
  error: '#f44336',
  warning: '#ff9800',

  // Overlays
  overlay: 'rgba(0,0,0,0.7)',
  overlayLight: 'rgba(0,0,0,0.4)',

  // Light theme (for toggle)
  lightBg: '#f5f0e8',
  lightCard: '#ffffff',
  lightText: '#1a1a1a',
  lightMuted: '#6a6060',
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const Radius = {
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  full: 999,
};

export const Typography = {
  // Font sizes
  xs: 11,
  sm: 13,
  md: 15,
  lg: 17,
  xl: 22,
  xxl: 28,
  display: 40,
  hero: 56,

  // Font weights
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
  heavy: '800' as const,
};

export const Shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 5,
  },
  gold: {
    shadowColor: '#c9a84c',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
};
