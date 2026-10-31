import type { Dominio } from '../engine/practice';
import type { PurDB } from './db';

export async function registrar(db: PurDB, conceptoId: string, acierto: boolean) {
  const p = (await db.progreso.get(conceptoId)) ?? { conceptoId, aciertos: 0, fallos: 0, ultima: 0 };
  if (acierto) p.aciertos++; else p.fallos++;
  p.ultima = Date.now();
  await db.progreso.put(p);
}
export async function leerDominio(db: PurDB): Promise<Dominio> {
  const o: Dominio = {};
  for (const p of await db.progreso.toArray()) o[p.conceptoId] = { aciertos: p.aciertos, fallos: p.fallos };
  return o;
}
export async function resumen(db: PurDB) {
  const ps = await db.progreso.toArray();
  const aciertos = ps.reduce((a, p) => a + p.aciertos, 0), fallos = ps.reduce((a, p) => a + p.fallos, 0);
  return { aciertos, fallos, dominadas: ps.filter(p => p.aciertos - p.fallos >= 2).length };
}
