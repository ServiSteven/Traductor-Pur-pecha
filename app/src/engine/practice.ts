import type { Engine } from './engine';
import type { EstadoSegmento, Variante } from './types';

export interface Pregunta {
  conceptoId: string; tipo: 'es-pur' | 'pur-es'; enunciado: string; pista: string;
  opciones: { texto: string; correcta: boolean }[]; etiqueta: EstadoSegmento;
}
export type Dominio = Record<string, { aciertos: number; fallos: number }>;
export const dominio = (d?: { aciertos: number; fallos: number }) => (d ? Math.max(0, d.aciertos - d.fallos) : 0);

/** Pregunta de opción múltiple. Prioriza conceptos con menor dominio (repaso progresivo). */
export function generarPregunta(e: Engine, v: Variante, progreso: Dominio, rng: () => number = Math.random,
  tipo?: 'es-pur' | 'pur-es'): Pregunta | null {
  const usables = e.buscar('').filter(c => c.tipo === 'palabra').map(c => ({ c, r: e.elegirForma(c.id, v) }))
    .filter(x => x.r.forma);
  if (usables.length < 4) return null;
  const minDom = Math.min(...usables.map(x => dominio(progreso[x.c.id])));
  const pool = usables.filter(x => dominio(progreso[x.c.id]) <= minDom + 1);
  const pick = pool[Math.floor(rng() * pool.length)];
  const t = tipo ?? (rng() < 0.5 ? 'es-pur' : 'pur-es');
  const texto = (x: typeof pick) => (t === 'es-pur' ? x.r.forma!.texto : x.c.es[0]);
  const distractores = shuffle(usables.filter(x => x !== pick && texto(x) !== texto(pick)), rng).slice(0, 3);
  const opciones = shuffle([{ texto: texto(pick), correcta: true }, ...distractores.map(x => ({ texto: texto(x), correcta: false }))], rng);
  return {
    conceptoId: pick.c.id, tipo: t, etiqueta: pick.r.estado, opciones,
    enunciado: t === 'es-pur' ? `¿Cómo se dice «${pick.c.es[0]}» en purépecha?` : `¿Qué significa «${pick.r.forma!.texto}»?`,
    pista: pick.c.categoria,
  };
}
export function shuffle<T>(a: T[], rng: () => number): T[] {
  const r = [...a];
  for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; }
  return r;
}
