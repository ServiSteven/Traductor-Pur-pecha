export type Variante = 'sierra' | 'canada' | 'lago' | 'cienega';
export type VarianteForma = Variante | 'general';
export type Estado = 'validado' | 'por_validar';
export const VARIANTES: Variante[] = ['sierra', 'canada', 'lago', 'cienega'];
export const NOMBRE_VARIANTE: Record<VarianteForma, string> = {
  sierra: 'Sierra', canada: 'Cañada', lago: 'Lago', cienega: 'Ciénaga', general: 'Referencia general',
};

export interface Concepto { id: string; tipo: 'palabra' | 'frase'; categoria: string; es: string[]; nota: string }
export interface Forma {
  id: string; conceptoId: string; variante: VarianteForma; texto: string;
  estado: Estado; fuente: string; audio?: string;
}
export interface LexiconData { conceptos: Concepto[]; formas: Forma[] }

export type Direccion = 'es-pur' | 'pur-es';
/** Cómo se debe presentar un segmento al usuario. */
export type EstadoSegmento =
  | 'validada'            // forma validada de la variante elegida
  | 'por_validar'         // forma de la variante elegida, sin validar
  | 'referencia_general'  // sin forma para la variante; se muestra la de referencia general (no confirmada)
  | 'no_disponible'       // el concepto existe pero no hay forma utilizable (otras variantes no se sustituyen)
  | 'no_encontrada';      // la palabra no está en el léxico

export interface Segmento {
  origen: string;
  destino: string | null;
  estado: EstadoSegmento;
  conceptoId?: string;
  formaId?: string;
  varianteForma?: VarianteForma;
  aproximada: boolean;
  reglas: string[];
  avisos: string[];
  otrasVariantes: VarianteForma[];
  alternativas: string[];
}
export interface Resultado {
  direccion: Direccion;
  variante: Variante;
  entrada: string;
  tipo: 'vacia' | 'exacta' | 'segmentada';
  segmentos: Segmento[];
  completa: boolean;
  avisos: string[];
}
