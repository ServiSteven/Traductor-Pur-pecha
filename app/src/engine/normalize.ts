const APOSTROFOS = /[’‘ʼ`´′']/g;

/** Clave exacta para purépecha: minúsculas, NFC, apóstrofos unificados y espacios colapsados. */
export function clavePur(s: string): string {
  return s.normalize('NFC').toLowerCase().replace(APOSTROFOS, "'").replace(/\s+/g, ' ').trim();
}
/** Clave tolerante: sin diacríticos (ï→i, á→a) ni apóstrofos. Solo para coincidencias aproximadas. */
export function claveLaxaPur(s: string): string {
  return clavePur(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/'/g, '');
}
/** Clave para español: minúsculas, sin acentos, espacios colapsados. */
export function claveEs(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}
const BORDES = /^[\s¿?¡!.,;:"“”()\[\]«»]+|[\s¿?¡!.,;:"“”()\[\]«»]+$/g;
export function tokenizar(s: string): string[] {
  return s.split(/\s+/).map(t => t.replace(BORDES, '')).filter(Boolean);
}
export const ARTICULOS = new Set(['el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas']);

/** Variantes del término español tras reglas básicas (sin artículo, singular). */
export function candidatosEs(token: string): { clave: string; regla?: string }[] {
  const base = claveEs(token);
  const out: { clave: string; regla?: string }[] = [{ clave: base }];
  if (base.endsWith('es') && base.length > 4) out.push({ clave: base.slice(0, -2), regla: 'plural → singular' });
  if (base.endsWith('s') && base.length > 3) out.push({ clave: base.slice(0, -1), regla: 'plural → singular' });
  return out;
}
