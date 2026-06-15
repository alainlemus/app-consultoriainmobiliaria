/**
 * useResponsive — escalado dinámico de UI para pantallas de distintos tamaños.
 *
 * Problema: los asesores son personas mayores con dispositivos Android variados
 * (Samsung Galaxy A-series 6.0"–6.7"). Los textos fijos se ven muy pequeños.
 *
 * Solución: escalar los tamaños de fuente y espaciado proporcionalmente
 * al ancho de la pantalla, tomando 375px (iPhone SE) como base de diseño.
 * En pantallas más grandes los textos crecen; en las más pequeñas no se rompen.
 */

import { Dimensions, PixelRatio } from 'react-native';

const BASE_WIDTH = 375;  // ancho de referencia (iPhone SE / Android compacto)
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

/** Ratio respecto a la pantalla de referencia, con límite superior e inferior */
const scale = Math.min(Math.max(SCREEN_WIDTH / BASE_WIDTH, 0.9), 1.3);

/**
 * Escala un tamaño de fuente proporcionalmente al ancho de pantalla.
 * Ejemplos:
 *   - iPhone SE (375px)   → factor 1.0  → sin cambios
 *   - Samsung A54 (412px) → factor 1.09 → +9% más grande
 *   - Samsung A34 (390px) → factor 1.04 → +4% más grande
 *   - pantalla < 340px    → factor 0.9  → mínimo para no romperse
 */
export function fs(size: number): number {
  return Math.round(PixelRatio.roundToNearestPixel(size * scale));
}

/**
 * Escala espaciado (padding, margin, gap) proporcionalmente.
 * Menos agresivo que fs() — solo escala un 60% del ratio.
 */
export function sp(size: number): number {
  const spaceScale = 1 + (scale - 1) * 0.6;
  return Math.round(PixelRatio.roundToNearestPixel(size * spaceScale));
}

/** Ancho de la pantalla actual */
export const screenWidth = SCREEN_WIDTH;

/** Alto de la pantalla actual */
export const screenHeight = SCREEN_HEIGHT;

/** true si la pantalla es "pequeña" (< 380px — ej: iPhone SE, algunos Android entry-level) */
export const isSmallScreen = SCREEN_WIDTH < 380;

/** true si la pantalla es "grande" (≥ 400px — Samsung Galaxy A-series y similares) */
export const isLargeScreen = SCREEN_WIDTH >= 400;
