/**
 * Elige el kilometraje más probable a partir del texto que el OCR leyó en la
 * foto del tablero. Función pura (sin React Native) para poder probarla.
 *
 * Reglas:
 *  - Ignora horas (12:30) y renglones del parcial («TRIP»).
 *  - «12,430» o «12.430» se leen como 12430 (separador de miles).
 *  - Números con 1 o 2 decimales (123.4) son el parcial: se descartan.
 *  - Candidatos de 5 a 7 dígitos; si el vehículo tiene menos de 10,000 km,
 *    también de 3 a 4.
 *  - Con km actual: el más cercano que sea mayor o igual. Si todos son
 *    menores, no propone nada (seguramente el OCR leyó otra cosa).
 *  - Sin km actual: prefiere el renglón con «ODO» o «KM», luego el más largo.
 */
export function elegirKm(texto: string | null | undefined, kmActual: number | null = null): number | null {
  if (!texto) return null;

  const minDigitos = kmActual !== null && kmActual < 10000 ? 3 : 5;
  type Cand = { valor: number; digitos: number; odo: boolean };
  const candidatos: Cand[] = [];

  for (const crudo of texto.toUpperCase().split(/\r?\n/)) {
    if (/\bTRIP\b|\bPARCIAL\b/.test(crudo)) continue;
    const odo = /\bODO\b|\bKM\b|\bODOMETRO\b/.test(crudo);

    const linea = crudo
      .replace(/(\d)O|O(\d)/g, (_m, a: string | undefined, b: string | undefined) => (a ? `${a}0` : `0${b}`)) // O leída en lugar de 0
      .replace(/\b\d{1,2}:\d{2}(:\d{2})?\b/g, ' ')                                    // horas 12:30
      .replace(/\b\d{1,3}(?:[.,]\d{3})+\b/g, m => m.replace(/[.,]/g, ''))             // miles 12,430
      .replace(/\b\d+[.,]\d{1,2}\b/g, ' ');                                           // decimales (parcial)

    for (const m of linea.matchAll(/\d+/g)) {
      const crudoNum = m[0];
      const sinCeros = crudoNum.replace(/^0+(?=\d)/, '');
      if (crudoNum.length > 7 || sinCeros.length < minDigitos) continue;
      candidatos.push({ valor: Number(sinCeros), digitos: crudoNum.length, odo });
    }
  }

  if (candidatos.length === 0) return null;

  if (kmActual !== null) {
    const validos = candidatos.filter(c => c.valor >= kmActual);
    if (validos.length === 0) return null;
    validos.sort((a, b) => a.valor - b.valor);
    return validos[0].valor;
  }

  candidatos.sort((a, b) => Number(b.odo) - Number(a.odo) || b.digitos - a.digitos || b.valor - a.valor);
  return candidatos[0].valor;
}
