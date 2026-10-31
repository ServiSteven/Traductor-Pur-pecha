import { useEffect, useRef, useState } from 'react';
import type { Ctx } from './App';
import type { Direccion, Forma, Resultado, Segmento } from '../engine/types';
import { NOMBRE_VARIANTE } from '../engine/types';
import { AudioBoton } from './AudioBoton';
import { Etiqueta } from './Etiqueta';
import { IcCambiar, IcAviso } from './icons';

const EJEMPLOS: Record<Direccion, string[]> = {
  'es-pur': ['flor', 'madre', 'tierra', 'tamal de corunda', 'nuestra fuerza', 'la flor es grande'],
  'pur-es': ['nana', 'tata', 'tsïtsïki', 'kurhúnda', 'juchari uinapikua', 'tsitsiki'],
};

function FormaAudio({ ctx, formaId }: { ctx: Ctx; formaId?: string }) {
  const [f, setF] = useState<Forma | undefined>();
  useEffect(() => { formaId ? ctx.db.formas.get(formaId).then(setF) : setF(undefined); }, [formaId, ctx.db]);
  return <AudioBoton db={ctx.db} forma={f} colaborador={ctx.colaborador} />;
}

function Tarjeta({ s, ctx, dir, grande, onComparar }: { s: Segmento; ctx: Ctx; dir: Direccion; grande: boolean; onComparar: (id: string) => void }) {
  return (
    <article className={`tarjeta ${s.estado}`}>
      <p className="origen">{s.origen}</p>
      <p className={`destino ${grande ? 'grande' : ''} ${dir === 'es-pur' ? 'pur' : ''}`}>{s.destino ?? '—'}</p>
      <Etiqueta estado={s.estado} />
      {s.alternativas.length > 0 && <p className="nota">También: {s.alternativas.join(', ')}</p>}
      {s.varianteForma && s.destino && <p className="nota">Forma: {NOMBRE_VARIANTE[s.varianteForma]}</p>}
      {s.avisos.map((a, i) => <p key={i} className="aviso"><IcAviso /> <span>{a}</span></p>)}
      {s.reglas.length > 0 && <p className="nota">Reglas aplicadas: {s.reglas.join(', ')}</p>}
      {dir === 'es-pur' && s.destino && <FormaAudio ctx={ctx} formaId={s.formaId} />}
      {dir === 'pur-es' && s.formaId && <FormaAudio ctx={ctx} formaId={s.formaId} />}
      {s.conceptoId && <button className="btn texto" onClick={() => onComparar(s.conceptoId!)}>Comparar variantes</button>}
    </article>
  );
}

export function Traducir({ ctx, onComparar }: { ctx: Ctx; onComparar: (id: string) => void }) {
  const [dir, setDir] = useState<Direccion>('es-pur');
  const [texto, setTexto] = useState(''); const [res, setRes] = useState<Resultado | null>(null);
  const v = ctx.variante; const refRes = useRef<HTMLDivElement>(null);

  const traducir = async (t = texto) => {
    if (!v) return;
    setRes(await ctx.motor.call<Resultado>('traducir', t, dir, v));
    setTimeout(() => refRes.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 50);
  };
  useEffect(() => { setRes(null); }, [dir, v]);

  if (!v) return <section className="bienvenida"><h2>¿De qué región es tu purépecha?</h2><p>Elige una variante arriba. La app no elige por ti: cada región tiene sus propias palabras.</p></section>;
  return (
    <section>
      <div className="direccion">
        <span className="lengua">{dir === 'es-pur' ? 'Español' : 'Purépecha'}</span>
        <button className="btn redondo" aria-label="Cambiar dirección de la traducción" onClick={() => { setDir(dir === 'es-pur' ? 'pur-es' : 'es-pur'); setTexto(''); }}><IcCambiar /></button>
        <span className="lengua">{dir === 'es-pur' ? 'Purépecha' : 'Español'}</span>
      </div>
      <label className="campo">
        <span className="visually-hidden">Texto a traducir</span>
        <textarea value={texto} rows={2} maxLength={300} placeholder={dir === 'es-pur' ? 'Escribe en español…' : 'Escribe en purépecha…'}
          lang={dir === 'es-pur' ? 'es-MX' : 'tsz'} onChange={e => setTexto(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); traducir(); } }} />
      </label>
      <button className="btn principal" onClick={() => traducir()}>Traducir</button>
      {res && res.tipo !== 'vacia' && (
        <div className="resultado" aria-live="polite" ref={refRes}>
          {res.tipo === 'exacta'
            ? <Tarjeta s={res.segmentos[0]} ctx={ctx} dir={dir} grande onComparar={onComparar} />
            : <>
                <p className="banner"><IcAviso /> <span>{res.avisos[0]}</span></p>
                {res.segmentos.map((s, i) => <Tarjeta key={i} s={s} ctx={ctx} dir={dir} grande={false} onComparar={onComparar} />)}
              </>}
          {res.tipo === 'segmentada' && res.avisos.slice(1).map((a, i) => <p key={i} className="aviso"><IcAviso /> <span>{a}</span></p>)}
        </div>
      )}
      <div className="ejemplos" aria-label="Ejemplos">
        {EJEMPLOS[dir].map(e => <button key={e} className="chip" onClick={() => { setTexto(e); traducir(e); }}>{e}</button>)}
      </div>

    </section>
  );
}
