import { beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { PurDB, getMeta } from '../src/data/db';
import { instalarSnapshot, leerLexicon, restaurarDeFabrica, sha256, sincronizar, validarPaquete } from '../src/data/sync';
import { guardarGrabacion, resolverAudio } from '../src/data/audio';
import { leerDominio, registrar } from '../src/data/progress';
import { Engine } from '../src/engine/engine';

const leer = (r: string) => readFileSync(`public/data/${r}`, 'utf-8');
/** Fetch simulado: sirve archivos del snapshot y un "servidor" configurable. */
const fetchSnapshot = async (url: string) => {
  const m = url.match(/data\/(.+)$/); if (!m) return new Response('no', { status: 404 });
  return new Response(leer(m[1]), { status: 200 });
};
let db: PurDB; let n = 0;
beforeEach(() => { db = new PurDB('test-' + ++n); });

async function servidor(version: number, mod?: (p: any) => void, corromper = false) {
  const paquetes: Record<string, string> = {}; const items: any[] = [];
  for (const id of ['base', 'sierra', 'canada', 'lago', 'cienega']) {
    const p = JSON.parse(leer(`paquete-${id}.json`)); p.version = version; mod?.(p);
    let t = JSON.stringify(p); const sha = await sha256(t); if (corromper && id === 'base') t = t.replace('nana', 'XXXX');
    paquetes[id] = t; items.push({ id, version, sha256: sha, bytes: t.length, formas: p.formas.length });
  }
  return async (url: string) => {
    if (url.endsWith('/manifest')) return new Response(JSON.stringify({ formato: 1, paquetes: items }));
    const m = url.match(/\/paquetes\/(.+)$/); if (m) return new Response(paquetes[m[1]]);
    return new Response('x', { status: 404 });
  };
}

describe('TC-09 Instalación offline desde snapshot', () => {
  it('instala base y variantes en IndexedDB y el motor traduce con esos datos', async () => {
    const inf = await instalarSnapshot(db, fetchSnapshot as any);
    expect(inf.errores).toEqual([]); expect(inf.actualizados).toHaveLength(5);
    const e = new Engine(await leerLexicon(db));
    expect(e.totalConceptos).toBe(18);
    expect(e.traducir('tierra', 'es-pur', 'sierra').segmentos[0].destino).toBe('echeri');
  });
  it('es idempotente: una segunda ejecución no reinstala', async () => {
    await instalarSnapshot(db, fetchSnapshot as any);
    expect((await instalarSnapshot(db, fetchSnapshot as any)).sinCambios).toHaveLength(5);
  });
});

describe('TC-10 Sincronización y recuperación', () => {
  it('descarga solo paquetes con versión mayor y registra la versión', async () => {
    await instalarSnapshot(db, fetchSnapshot as any);
    const srv = await servidor(2, p => { if (p.id === 'base') p.formas[0].estado = 'validado'; });
    const inf = await sincronizar(db, srv as any, '/api');
    expect(inf.actualizados).toHaveLength(5);
    expect((await getMeta<any>(db, 'paq:base'))!.version).toBe(2);
    expect((await db.formas.get('f00001'))!.estado).toBe('validado');
    expect((await sincronizar(db, srv as any, '/api')).sinCambios).toHaveLength(5);
  });
  it('sin red: informa y conserva los datos locales', async () => {
    await instalarSnapshot(db, fetchSnapshot as any);
    const inf = await sincronizar(db, (async () => { throw new TypeError('offline'); }) as any, '/api');
    expect(inf.sinRed).toBe(true); expect(await db.formas.count()).toBeGreaterThan(0);
  });
  it('rechaza un paquete alterado (checksum) y conserva la versión anterior', async () => {
    await instalarSnapshot(db, fetchSnapshot as any);
    const inf = await sincronizar(db, (await servidor(2, undefined, true)) as any, '/api');
    expect(inf.errores[0]).toMatchObject({ id: 'base' }); expect(inf.errores[0].motivo).toMatch(/suma de verificación/);
    expect((await getMeta<any>(db, 'paq:base'))!.version).toBe(1);
    expect((await db.formas.get('f00001'))!.texto).toBe('nana');
  });
  it('rechaza un paquete de variante que contenga formas de otra variante', async () => {
    await instalarSnapshot(db, fetchSnapshot as any);
    const srv = await servidor(2, p => { if (p.id === 'lago') p.formas.push({ id: 'z1', conceptoId: 'c001', variante: 'sierra', texto: 'x', estado: 'validado', fuente: '' }); });
    const inf = await sincronizar(db, srv as any, '/api');
    expect(inf.errores.find(e => e.id === 'lago')!.motivo).toMatch(/no puede estar en/);
  });
  it('validarPaquete rechaza estructuras malformadas', () => {
    expect(() => validarPaquete(null, 'base')).toThrow();
    expect(() => validarPaquete({ id: 'base', version: 1, conceptos: [], formas: [{ id: 'a', conceptoId: 'b', texto: 'x', variante: 'general', estado: 'raro' }] }, 'base')).toThrow(/estado/);
  });
  it('restaurar de fábrica reconstruye los datos tras un fallo y conserva audios y progreso', async () => {
    await instalarSnapshot(db, fetchSnapshot as any);
    await guardarGrabacion(db, 'f00001', new Blob(['abc'], { type: 'audio/webm' })); await registrar(db, 'c001', true);
    await db.formas.clear(); await db.conceptos.clear();                 // daño simulado
    const inf = await restaurarDeFabrica(db, fetchSnapshot as any);
    expect(inf.errores).toEqual([]); expect(await db.formas.count()).toBe(18);
    expect(await db.audios.count()).toBe(1); expect((await leerDominio(db)).c001.aciertos).toBe(1);
  });
});

describe('TC-11 Audio', () => {
  it('guarda y resuelve la grabación de la forma exacta', async () => {
    await instalarSnapshot(db, fetchSnapshot as any);
    await guardarGrabacion(db, 'f00001', new Blob(['abc'], { type: 'audio/webm' }));
    const a = await resolverAudio(db, await db.formas.get('f00001'));
    expect(a).toMatchObject({ origen: 'local', validado: false });
  });
  it('sin grabación devuelve null (la UI avisa; no se sintetiza ni se sustituye)', async () => {
    await instalarSnapshot(db, fetchSnapshot as any);
    expect(await resolverAudio(db, await db.formas.get('f00002'))).toBeNull();
  });
  it('NO compone la frase con audios de palabras sueltas', async () => {
    await instalarSnapshot(db, fetchSnapshot as any);
    const frase = (await db.formas.toArray()).find(f => f.texto === 'juchari uinapikua')!;
    const palabras = (await db.formas.toArray()).filter(f => ['juchari', 'uinapikua'].includes(f.texto));
    for (const p of palabras) await guardarGrabacion(db, p.id, new Blob(['x']));
    expect(await resolverAudio(db, frase)).toBeNull();
  });
  it('rechaza grabaciones vacías', async () => { await expect(guardarGrabacion(db, 'f1', new Blob([]))).rejects.toThrow(); });
});

describe('TC-12 Progreso de práctica', () => {
  it('acumula aciertos y fallos', async () => {
    await registrar(db, 'c001', true); await registrar(db, 'c001', false); await registrar(db, 'c001', true);
    expect((await leerDominio(db)).c001).toEqual({ aciertos: 2, fallos: 1 });
  });
});
