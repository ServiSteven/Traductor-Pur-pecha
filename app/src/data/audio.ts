import type { Forma } from '../engine/types';
import type { PurDB } from './db';

export interface AudioResuelto { origen: 'local' | 'paquete'; url: string; validado: boolean }

/**
 * Política de audio (MVP):
 *  - Un audio pertenece a UNA forma (y por tanto a UNA variante): no se reutiliza entre variantes.
 *  - No se concatenan audios de palabras para armar frases: podría producir pronunciaciones incorrectas.
 *    Solo se reproduce una grabación hecha para esa forma exacta.
 *  - Sin grabación => devuelve null y la interfaz lo comunica.
 */
export async function resolverAudio(db: PurDB, forma: Forma | null | undefined, baseAudio = './'): Promise<AudioResuelto | null> {
  if (!forma) return null;
  const local = await db.audios.get(forma.id);
  if (local) return { origen: 'local', url: URL.createObjectURL(local.blob), validado: false };
  if (forma.audio) return { origen: 'paquete', url: baseAudio + forma.audio, validado: forma.estado === 'validado' };
  return null;
}
export async function guardarGrabacion(db: PurDB, formaId: string, blob: Blob) {
  if (!blob.size) throw new Error('La grabación está vacía');
  await db.audios.put({ formaId, blob, mime: blob.type || 'audio/webm', creado: Date.now(), validado: false });
}
export const borrarGrabacion = (db: PurDB, formaId: string) => db.audios.delete(formaId);
export const formasConAudio = async (db: PurDB) => new Set((await db.audios.toCollection().primaryKeys()) as string[]);
