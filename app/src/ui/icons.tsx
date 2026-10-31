import type { VarianteForma } from '../engine/types';
const P = { fill: 'none', stroke: 'currentColor', strokeWidth: 2.2, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
const S = ({ children, size = 28 }: { children: React.ReactNode; size?: number }) =>
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false" {...P}>{children}</svg>;

/** Cada variante tiene un glifo propio: se reconoce sin depender del color ni de saber leer. */
export const GlifoVariante = ({ v, size }: { v: VarianteForma; size?: number }) => (
  <S size={size}>{{
    sierra: <path d="M2 20 9 6l4 8 3-4 6 10Z" />,
    canada: <path d="M3 5c3 0 5 4 9 14 4-10 6-14 9-14" />,
    lago: <><path d="M2 9c3-3 5 3 8 0s5 3 8 0 3 0 4 0" /><path d="M2 15c3-3 5 3 8 0s5 3 8 0 3 0 4 0" /></>,
    cienega: <><path d="M6 21V8M12 21V3M18 21V10" /><path d="M6 8c-1-2 0-3 0-4 1 1 1 3 0 4Zm12 2c-1-2 0-3 0-4 1 1 1 3 0 4Z" /></>,
    general: <circle cx="12" cy="12" r="8" strokeDasharray="3 3" />,
  }[v]}</S>
);
export const IcTraducir = () => <S><path d="M4 8h14l-4-4M20 16H6l4 4" /></S>;
export const IcLibro = () => <S><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2Z" /><path d="M8 7h7" /></S>;
export const IcPracticar = () => <S><path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.2 6.5 20.2l1-6.2L3 9.6l6.2-.9Z" /></S>;
export const IcAjustes = () => <S><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" /></S>;
export const IcAltavoz = ({ size }: { size?: number }) => <S size={size}><path d="M4 9v6h4l5 4V5L8 9Z" /><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" /></S>;
export const IcMic = () => <S><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></S>;
export const IcCambiar = () => <S><path d="M7 4v14m0 0-3-3m3 3 3-3M17 20V6m0 0-3 3m3-3 3 3" /></S>;
export const IcAviso = () => <S size={20}><path d="M12 3 2 20h20Z" /><path d="M12 10v4M12 17.5v.01" /></S>;
export const IcOk = () => <S size={20}><circle cx="12" cy="12" r="9" /><path d="m8 12.5 3 3 5-6" /></S>;
export const IcNo = () => <S size={20}><circle cx="12" cy="12" r="9" /><path d="m9 9 6 6M15 9l-6 6" /></S>;
export const IcInfo = () => <S size={20}><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8v.01" /></S>;
export const IcCerrar = () => <S size={24}><path d="m6 6 12 12M18 6 6 18" /></S>;
