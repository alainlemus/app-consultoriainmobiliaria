/**
 * Liga del QR de asesor: https://consultoriainmobiliaria.com.mx/a/{codigo}
 * (también consultoriainmobiliaria://a/{codigo} en desarrollo).
 * Cuando la app ya está instalada, iOS/Android la abren directo con esa URL
 * (universal links / app links) y hay que sacar el código de la ruta.
 */
export function codigoDesdeUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  // Solo la ruta raíz /a/{codigo} (no /blog/a/...). Acepta https://host/a/X,
  // esquema://a/X (en el esquema propio el "host" es "a") y /a/X a secas.
  const m = url.match(/^(?:[a-z][a-z0-9+.-]*:\/\/[^/]*)?\/?a\/([A-Za-z0-9-]{4,12})(?:[/?#]|$)/i);
  if (!m) return null;
  const codigo = m[1].replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  return codigo.length >= 4 ? codigo : null;
}
