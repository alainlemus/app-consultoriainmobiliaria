/** Lo que entrega Play Store sobre cómo se llegó a instalar la app. */
export type InstallReferrerInfo = {
  /** Cadena `referrer` de la liga a Play Store, p. ej. "utm_source=qr&codigo_asesor=K7M2PX". */
  installReferrer: string;
  referrerClickTimestampSeconds: number;
  installBeginTimestampSeconds: number;
};
