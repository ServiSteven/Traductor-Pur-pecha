import type { Concepto, Forma, LexiconData } from '../engine/types';
import { type PurDB, getMeta, setMeta } from './db';

export interface ItemManifiesto { id: string; version: number; sha256: string; bytes: number; formas: number }
export interface Manifiesto { formato: number; paquetes: ItemManifiesto[] }
export interface Paquete { id: string; version: number; conceptos: Concepto[]; formas: Forma[] }
export interface Informe { actualizados: string[]; sinCambios: string[]; errores: { id: string; motivo: string }[]; sinRed: boolean }
type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;

const IDS = ['base', 'sierra', 'canada', 'lago', 'cienega'];
const VAR = ['general', 'sierra', 'canada', 'lago', 'cienega'];

export async function sha256(texto: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

/** Valida estructura y, sobre todo, que un paquete de variante no contenga formas de otra variante. */
export function validarPaquete(p: any, idEsperado: string): asserts p is Paquete {
  const fallo = (m: string) => { throw new Error(`Paquete inválido: ${m}`); };
  if (!p || typeof p !== 'object') fallo('no es un objeto');
  if (p.id !== idEsperado) fallo(`id ${p.id} ≠ ${idEsperado}`);
  if (!Number.isInteger(p.version) || p.version < 1) fallo('versión');
  if (!Array.isArray(p.conceptos) || !Array.isArray(p.formas)) fallo('listas ausentes');
  if (idEsperado !== 'base' && p.conceptos.length) fallo('un paquete de variante no define conceptos');
  const varEsperada = idEsperado === 'base' ? 'general' : idEsperado;
  for (const c of p.conceptos) {
    if (typeof c.id !== 'string' || !Array.isArray(c.es) || !c.es.length || !['palabra', 'frase'].includes(c.tipo)) fallo(`concepto ${c?.id}`);
  }
  for (const f of p.formas) {
    if (typeof f.id !== 'string' || typeof f.conceptoId !== 'string' || typeof f.texto !== 'string' || !f.texto || f.texto.length > 200) fallo(`forma ${f?.id}`);
    if (!VAR.includes(f.variante)) fallo(`variante ${f.variante}`);
    if (f.variante !== varEsperada) fallo(`la forma ${f.id} es de «${f.variante}» y no puede estar en «${idEsperado}»`);
    if (!['validado', 'por_validar'].includes(f.estado)) fallo(`estado ${f.estado}`);
  }
}

/** Instala un paquete de forma atómica: si algo falla, la transacción revierte y lo anterior queda intacto. */
export async function instalarPaquete(db: PurDB, p: Paquete, sha: string) {
  await db.transaction('rw', db.conceptos, db.formas, db.meta, async () => {
    if (p.id === 'base') {
      await db.conceptos.clear();
      await db.conceptos.bulkPut(p.conceptos);
      await db.formas.where('variante').equals('general').delete();
    } else await db.formas.where('variante').equals(p.id).delete();
    await db.formas.bulkPut(p.formas);
    await setMeta(db, `paq:${p.id}`, { version: p.version, sha256: sha });
  });
}

async function descargar(f: Fetcher, url: string, ms = 6000): Promise<string> {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await f(url, { signal: ctl.signal, cache: 'no-store' });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.text();
  } finally { clearTimeout(t); }
}

async function traer(db: PurDB, f: Fetcher, base: string, item: ItemManifiesto, ruta: (id: string) => string) {
  const texto = await descargar(f, base + ruta(item.id));
  if ((await sha256(texto)) !== item.sha256) throw new Error('la suma de verificación no coincide');
  const p = JSON.parse(texto); validarPaquete(p, item.id);
  await instalarPaquete(db, p, item.sha256);
}

/** Primera instalación desde el paquete incluido en la app (snapshot precacheado por el Service Worker). */
export async function instalarSnapshot(db: PurDB, f: Fetcher, base = './data/', forzar = false): Promise<Informe> {
  const inf: Informe = { actualizados: [], sinCambios: [], errores: [], sinRed: false };
  const man: Manifiesto = JSON.parse(await descargar(f, base + 'manifest.json'));
  for (const item of man.paquetes) {
    const actual = await getMeta<{ version: number }>(db, `paq:${item.id}`);
    if (!forzar && actual) { inf.sinCambios.push(item.id); continue; }
    try { await traer(db, f, base, item, id => `paquete-${id}.json`); inf.actualizados.push(item.id); }
    catch (e) { inf.errores.push({ id: item.id, motivo: String((e as Error).message) }); }
  }
  return inf;
}

/** Actualización contra la API. Sin red => informe `sinRed`, los datos locales siguen intactos. */
export async function sincronizar(db: PurDB, f: Fetcher, api: string): Promise<Informe> {
  const inf: Informe = { actualizados: [], sinCambios: [], errores: [], sinRed: false };
  let man: Manifiesto;
  try { man = JSON.parse(await descargar(f, api + '/manifest')); } catch { inf.sinRed = true; return inf; }
  for (const item of man.paquetes) {
    if (!IDS.includes(item.id)) continue;
    const actual = await getMeta<{ version: number }>(db, `paq:${item.id}`);
    if (actual && actual.version >= item.version) { inf.sinCambios.push(item.id); continue; }
    try { await traer(db, f, api, item, id => `/paquetes/${id}`); inf.actualizados.push(item.id); }
    catch (e) { inf.errores.push({ id: item.id, motivo: String((e as Error).message) }); }
  }
  await setMeta(db, 'ultimaSync', Date.now());
  return inf;
}

/** Recuperación ante fallos: borra datos lingüísticos locales y reinstala el snapshot. Conserva audios y progreso. */
export async function restaurarDeFabrica(db: PurDB, f: Fetcher, base = './data/') {
  await db.transaction('rw', db.conceptos, db.formas, db.meta, async () => {
    await db.conceptos.clear(); await db.formas.clear(); await db.meta.clear();
  });
  return instalarSnapshot(db, f, base, true);
}

export async function leerLexicon(db: PurDB): Promise<LexiconData> {
  return { conceptos: await db.conceptos.toArray(), formas: await db.formas.toArray() };
}

/** Cola local de sugerencias: se guardan sin red y se envían al reconectar (la API las deja "pendientes de validación"). */
export interface SugerenciaLocal { espanol: string; purepecha: string; variante: string; comentario: string }
export async function encolarSugerencia(db: PurDB, s: SugerenciaLocal) {
  const cola = (await getMeta<SugerenciaLocal[]>(db, 'colaSugerencias')) ?? [];
  await setMeta(db, 'colaSugerencias', [...cola, s]);
}
export async function enviarCola(db: PurDB, f: Fetcher, api: string): Promise<{ enviadas: number; pendientes: number }> {
  const cola = (await getMeta<SugerenciaLocal[]>(db, 'colaSugerencias')) ?? [];
  const resto: SugerenciaLocal[] = [];
  for (const s of cola) {
    try {
      const r = await f(api + '/sugerencias', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(s) });
      if (!r.ok && r.status !== 422) resto.push(s);       // 422 = inválida: se descarta, no se reintenta
    } catch { resto.push(s); }
  }
  await setMeta(db, 'colaSugerencias', resto);
  return { enviadas: cola.length - resto.length, pendientes: resto.length };
}
