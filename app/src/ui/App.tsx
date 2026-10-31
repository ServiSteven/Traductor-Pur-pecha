import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { EngineClient } from '../engine/client';
import type { Variante } from '../engine/types';
import { PurDB } from '../data/db';
import { enviarCola, instalarSnapshot, leerLexicon, sincronizar } from '../data/sync';
import { VarianteBar } from './VarianteBar';
import { Traducir } from './Traducir';
import { Diccionario } from './Diccionario';
import { Practicar } from './Practicar';
import { Ajustes } from './Ajustes';
import { IcAjustes, IcLibro, IcPracticar, IcTraducir } from './icons';

export const API_BASE: string = (import.meta.env.VITE_API_BASE as string) ?? '/api';
export interface Ajustes { escala: number; contraste: boolean; colaborador: boolean }
export interface Ctx {
  db: PurDB; motor: EngineClient; variante: Variante | null; listo: boolean;
  ajustes: Ajustes; setAjustes: (a: Ajustes) => void; colaborador: boolean; recargar: () => Promise<void>;
}
const leer = <T,>(k: string, def: T): T => { try { const s = localStorage.getItem(k); return s ? JSON.parse(s) : def; } catch { return def; } };
const guardar = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* almacenamiento no disponible */ } };

type Tab = 'traducir' | 'diccionario' | 'practicar' | 'ajustes';
const TABS: { id: Tab; t: string; i: JSX.Element }[] = [
  { id: 'traducir', t: 'Traducir', i: <IcTraducir /> }, { id: 'diccionario', t: 'Diccionario', i: <IcLibro /> },
  { id: 'practicar', t: 'Practicar', i: <IcPracticar /> }, { id: 'ajustes', t: 'Ajustes', i: <IcAjustes /> },
];

export function App() {
  const db = useMemo(() => new PurDB(), []); const motor = useMemo(() => new EngineClient(), []);
  const [tab, setTab] = useState<Tab>('traducir'); const [listo, setListo] = useState(false); const [error, setError] = useState('');
  const [variante, setVar] = useState<Variante | null>(() => leer<Variante | null>('variante', null));
  const [ajustes, setAj] = useState<Ajustes>(() => leer('ajustes', { escala: 1, contraste: false, colaborador: false }));
  const [abrir, setAbrir] = useState<string | null>(null); const [offline, setOffline] = useState(!navigator.onLine);
  const arrancado = useRef(false);

  const recargar = useCallback(async () => { await motor.call('cargar', await leerLexicon(db)); setListo(true); }, [db, motor]);
  useEffect(() => {
    if (arrancado.current) return; arrancado.current = true;
    (async () => {
      try {
        const inf = await instalarSnapshot(db, fetch);                                   // 1ª vez: instala desde el paquete incluido
        if (inf.errores.length) setError('No se pudo instalar parte de los datos. Ve a Ajustes → Restaurar datos.');
        await recargar();
        if (navigator.onLine) { await sincronizar(db, fetch, API_BASE); await enviarCola(db, fetch, API_BASE); await recargar(); }
      } catch { setError('No se pudieron cargar los datos. Conéctate una vez para instalarlos o usa Ajustes → Restaurar datos.'); }
    })();
  }, [db, recargar]);
  useEffect(() => {
    const a = () => setOffline(true), b = () => setOffline(false);
    addEventListener('offline', a); addEventListener('online', b); return () => { removeEventListener('offline', a); removeEventListener('online', b); };
  }, []);
  useEffect(() => {
    document.documentElement.style.setProperty('--escala', String(ajustes.escala));
    document.documentElement.dataset.contraste = ajustes.contraste ? 'alto' : 'normal';
    document.documentElement.dataset.escala = ajustes.escala > 1.1 ? 'grande' : 'normal'; guardar('ajustes', ajustes);
  }, [ajustes]);

  const ctx: Ctx = { db, motor, variante, listo, ajustes, setAjustes: setAj, colaborador: ajustes.colaborador, recargar };
  return (
    <div className="app">
      <header>
        <h1>Purépecha <small>⇄ Español</small></h1>
        <span className={`estado ${offline ? 'off' : 'on'}`} role="status">{offline ? 'Sin conexión · todo funciona' : 'Con conexión'}</span>
        <VarianteBar valor={variante} onChange={v => { setVar(v); guardar('variante', v); }} />
      </header>
      <main>
        {error && <p className="banner error" role="alert">{error}</p>}
        {!listo && !error && <p className="nota" role="status">Preparando datos…</p>}
        {listo && tab === 'traducir' && <Traducir ctx={ctx} onComparar={id => { setAbrir(id); setTab('diccionario'); }} />}
        {listo && tab === 'diccionario' && <Diccionario ctx={ctx} abrir={abrir} setAbrir={setAbrir} />}
        {listo && tab === 'practicar' && <Practicar ctx={ctx} />}
        {tab === 'ajustes' && <Ajustes ctx={ctx} />}
      </main>
      <nav aria-label="Secciones">
        {TABS.map(t => <button key={t.id} aria-current={tab === t.id ? 'page' : undefined} className={tab === t.id ? 'activa' : ''} onClick={() => setTab(t.id)}>{t.i}<span>{t.t}</span></button>)}
      </nav>
    </div>
  );
}
