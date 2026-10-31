import type { EstadoSegmento } from '../engine/types';
import { IcAviso, IcInfo, IcNo, IcOk } from './icons';

const TXT: Record<EstadoSegmento, { t: string; c: string; i: JSX.Element }> = {
  validada: { t: 'Validada', c: 'ok', i: <IcOk /> },
  por_validar: { t: 'Por validar', c: 'warn', i: <IcAviso /> },
  referencia_general: { t: 'Referencia general (sin variante confirmada)', c: 'info', i: <IcInfo /> },
  no_disponible: { t: 'No disponible en esta variante', c: 'none', i: <IcNo /> },
  no_encontrada: { t: 'No está en el diccionario', c: 'none', i: <IcNo /> },
};
/** El estado se comunica con icono + texto + color: nunca solo con color. */
export const Etiqueta = ({ estado }: { estado: EstadoSegmento }) =>
  <span className={`etiqueta ${TXT[estado].c}`}>{TXT[estado].i}<span>{TXT[estado].t}</span></span>;
