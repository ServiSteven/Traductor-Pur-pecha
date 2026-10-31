import { NOMBRE_VARIANTE, VARIANTES, type Variante } from '../engine/types';
import { GlifoVariante } from './icons';

export function VarianteBar({ valor, onChange }: { valor: Variante | null; onChange: (v: Variante) => void }) {
  return (
    <div className="variantes" role="radiogroup" aria-label="Variante del purépecha">
      {VARIANTES.map(v => (
        <button key={v} role="radio" aria-checked={valor === v} className={`variante ${valor === v ? 'activa' : ''}`} onClick={() => onChange(v)}>
          <GlifoVariante v={v} /><span>{NOMBRE_VARIANTE[v]}</span>
        </button>
      ))}
    </div>
  );
}
