import { readFileSync } from 'node:fs';
import type { LexiconData } from '../src/engine/types';

/** Léxico real de semilla (snapshot de la app). */
export function lexiconSemilla(): LexiconData {
  const base = JSON.parse(readFileSync('public/data/paquete-base.json', 'utf-8'));
  return { conceptos: base.conceptos, formas: base.formas };
}
/**
 * Léxico SINTÉTICO solo para probar la lógica de variantes. Las palabras con «~» NO son purépecha:
 * son marcadores técnicos para verificar que ninguna variante se sustituye por otra.
 */
export function lexiconSintetico(): LexiconData {
  const c = (id: string, es: string[], tipo: 'palabra' | 'frase' = 'palabra') => ({ id, tipo, categoria: 'prueba', es, nota: '' });
  const f = (id: string, conceptoId: string, variante: any, texto: string, estado: any = 'validado') =>
    ({ id, conceptoId, variante, texto, estado, fuente: 'sintético' });
  return {
    conceptos: [c('x1', ['casa']), c('x2', ['agua']), c('x3', ['sol']), c('x4', ['luna']), c('x5', ['río']),
      c('x6', ['casa grande'], 'frase'), c('x7', ['perro', 'can'])],
    formas: [
      f('a1', 'x1', 'sierra', 'casa~S'), f('a2', 'x1', 'lago', 'casa~L', 'por_validar'),
      f('a3', 'x2', 'general', 'agua~G', 'por_validar'),
      f('a4', 'x3', 'cienega', 'sol~C'),                       // solo existe en Ciénaga
      f('a5', 'x4', 'lago', 'luna~L'), f('a6', 'x5', 'lago', 'río~L'),
      f('a7', 'x6', 'lago', 'casagrande~L'), f('a8', 'x7', 'sierra', "pe'rro~S"), f('a9', 'x7', 'lago', 'perro~L'),
    ],
  };
}
