import Dexie, { type Table } from 'dexie';
import type { Concepto, Forma } from '../engine/types';

export interface AudioLocal { formaId: string; blob: Blob; mime: string; creado: number; validado: false }
export interface Meta { clave: string; valor: unknown }
export interface Progreso { conceptoId: string; aciertos: number; fallos: number; ultima: number }

export class PurDB extends Dexie {
  conceptos!: Table<Concepto, string>;
  formas!: Table<Forma, string>;
  audios!: Table<AudioLocal, string>;
  meta!: Table<Meta, string>;
  progreso!: Table<Progreso, string>;
  constructor(nombre = 'purepecha-mvp') {
    super(nombre);
    this.version(1).stores({
      conceptos: 'id,categoria', formas: 'id,conceptoId,variante', audios: 'formaId', meta: 'clave', progreso: 'conceptoId',
    });
  }
}
export const getMeta = async <T,>(db: PurDB, clave: string) => (await db.meta.get(clave))?.valor as T | undefined;
export const setMeta = (db: PurDB, clave: string, valor: unknown) => db.meta.put({ clave, valor });
