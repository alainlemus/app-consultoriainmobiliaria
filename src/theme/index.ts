/**
 * Tema visual — idéntico al manual de marca de consultoriaInmobiliaria
 * Fuente: resources/css/app.css del proyecto Laravel
 */

export const Colors = {
  // Brand blacks / grays — PANTONE Neutral Black C / 4287 C
  dark: {
    900: '#222121',
    800: '#353030',
    700: '#4b4441',
    600: '#5a5555',
    500: '#707070',
    400: '#888080',
    300: '#a09898',
  },

  // Brand gold — PANTONE 2007 C
  gold: {
    50:  '#fdf8ec',
    100: '#f7e9c0',
    200: '#eed48a',
    300: '#debb5a',
    400: '#cd9d36', // primary gold
    500: '#b98a28',
    600: '#9f7320',
    700: '#7e5a18',
    800: '#5e4210',
    900: '#3e2c0a',
  },

  // Brand reds — PANTONE 2350 C / 1815 C
  crimson: {
    500: '#9c1006',
    600: '#810f00',
    700: '#650c00',
  },

  // Neutral backgrounds
  cream: {
    50:  '#faf8f3',
    100: '#f5f0e8',
    200: '#ede8db',
    300: '#e0d8c8',
  },

  // Utilidades
  white:   '#ffffff',
  black:   '#000000',
  success: '#16a34a',
  warning: '#d97706',
  error:   '#dc2626',
  info:    '#2563eb',
};

export const Typography = {
  fontFamily: {
    sans:   'System',  // Helvetica Neue en iOS, Roboto en Android
    serif:  'System',
  },
  fontSize: {
    xs:   11,
    sm:   13,
    base: 15,
    lg:   17,
    xl:   20,
    '2xl': 24,
    '3xl': 30,
    '4xl': 36,
  },
  fontWeight: {
    normal:    '400' as const,
    medium:    '500' as const,
    semibold:  '600' as const,
    bold:      '700' as const,
    extrabold: '800' as const,
    black:     '900' as const,
  },
  letterSpacing: {
    tight:   -0.5,
    normal:  0,
    wide:    1,
    wider:   2,
    widest:  3,
  },
};

export const Spacing = {
  xs:   4,
  sm:   8,
  md:   12,
  base: 16,
  lg:   20,
  xl:   24,
  '2xl': 32,
  '3xl': 40,
  '4xl': 48,
  '5xl': 64,
};

export const Radius = {
  none: 0,
  sm:   2,   // rounded-sm de Tailwind — estilo "arquitectónico" de la marca
  base: 4,
  md:   6,
  lg:   10,
  full: 9999,
};

export const Shadows = {
  sm: {
    shadowColor: Colors.dark[900],
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  base: {
    shadowColor: Colors.dark[900],
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 4,
  },
  lg: {
    shadowColor: Colors.dark[900],
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 8,
    elevation: 8,
  },
};

// Alias semánticos para uso rápido en componentes
export const Theme = {
  // Fondo principal de pantallas
  bgScreen:     Colors.cream[50],
  bgCard:       Colors.white,
  bgDark:       Colors.dark[900],
  bgInput:      Colors.cream[100],

  // Textos
  textPrimary:  Colors.dark[800],
  textSecondary:Colors.dark[600],
  textMuted:    Colors.dark[400],
  textGold:     Colors.gold[400],
  textOnDark:   Colors.cream[50],

  // Bordes
  borderLight:  Colors.cream[300],
  borderGold:   Colors.gold[400],
  borderDark:   Colors.dark[600],

  // Accent
  accent:       Colors.gold[400],
  accentDark:   Colors.gold[600],
  danger:       Colors.crimson[600],
  success:      Colors.success,
};

export default { Colors, Typography, Spacing, Radius, Shadows, Theme };
