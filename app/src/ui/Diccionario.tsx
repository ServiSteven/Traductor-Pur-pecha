import { useEffect, useState } from 'react';
import type { Ctx } from './App';
import type { Concepto, Forma, VarianteForma } from '../engine/types';
import { NOMBRE_VARIANTE } from '../engine/types';
import { AudioBoton } from './AudioBoton';
import { Etiqueta } from './Etiqueta';
import { GlifoVariante, IcCerrar } from './icons';

export const CATEGORIA: Record<string, string> = { familia: 'Familia', naturaleza: 'Naturaleza', numeros: 'Números', alimentos: 'Alimentos', cultura: 'Cultura', general: 'General' };
const BIOCULTURAL = new Set(['naturaleza', 'alimentos', 'cultura']);

function Detalle({ ctx, id, cerrar }: { ctx: Ctx; id: string; cerrar: () => void }) {
  const [c, setC] = useState<Concepto | undefined>();
  const [grupos, setGrupos] = useState<{ variante: VarianteForma; formas: Forma[] }[]>([]);
  useEffect(() => { ctx.db.conceptos.get(id).then(setC); ctx.motor.call('comparar', id).then(setGrupos); }, [id, ctx]);
  if (!c) return null;
  return (
    <div className="hoja" role="dialog" aria-modal="true" aria-label={`Detalle de ${c.es[0]}`}>
      <div className="hoja-cuerpo">
        <button className="btn redondo cerrar" onClick={cerrar} aria-label="Cerrar"><IcCerrar /></button>
        <h2>{c.es.join(' · ')}</h2>
        {BIOCULTURAL.has(c.categoria) && <p className="insignia">Concepto biocultural · {CATEGORIA[c.categoria]}</p>}
        {c.nota && <p className="nota-bio">{c.nota} <em>(descripción por validar con la comunidad)</em></p>}
        <h3>Comparar variantes</h3>
        <ul className="comparador">
          {grupos.map(g => (
            <li key={g.variante} className={g.formas.length ? '' : 'vacia'}>
              <div className="var"><GlifoVariante v={g.variante} size={22} /><strong>{NOMBRE_VARIANTE[g.variante]}</strong></div>
              {g.formas.length === 0 && <p className="nota">Sin registro todavía. No se sustituye con otra variante.</p>}
              {g.formas.map(f => (
                <div key={f.id} className="forma">
                  <p className="pur grande">{f.texto}</p>
                  <Etiqueta estado={f.estado === 'validado' ? 'validada' : g.variante === 'general' ? 'referencia_general' : 'por_validar'} />
                  <AudioBoton db={ctx.db} forma={f} colaborador={ctx.colaborador} />
                </div>
              ))}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function Diccionario({ ctx, abrir, setAbrir }: { ctx: Ctx; abrir: string | null; setAbrir: (id: string | null) => void }) {
  const [q, setQ] = useState(''); const [cat, setCat] = useState<string | undefined>();
  const [lista, setLista] = useState<Concepto[]>([]); const [cats, setCats] = useState<string[]>([]);
  useEffect(() => { ctx.motor.call<string[]>('categorias').then(setCats); }, [ctx.listo, ctx.motor]);
  useEffect(() => { ctx.motor.call<Concepto[]>('buscar', q, cat).then(setLista); }, [q, cat, ctx.listo, ctx.motor]);
  return (
    <section>
      <label className="campo"><span className="visually-hidden">Buscar en el diccionario</span>
        <input type="search" value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar palabra…" /></label>
      <div className="ejemplos">
        <button className={`chip ${!cat ? 'on' : ''}`} onClick={() => setCat(undefined)}>Todo</button>
        {cats.map(c => <button key={c} className={`chip ${cat === c ? 'on' : ''}`} onClick={() => setCat(c)}>{CATEGORIA[c] ?? c}</button>)}
      </div>
      {lista.length === 0 && <p className="nota">No hay resultados. Prueba con otra escritura.</p>}
      <ul className="lista">
        {lista.map(c => (
          <li key={c.id}><button className="fila" onClick={() => setAbrir(c.id)}>
            <span className="fila-es">{c.es[0]}</span><span className="nota">{CATEGORIA[c.categoria] ?? c.categoria}{c.tipo === 'frase' ? ' · frase' : ''}</span>
          </button></li>
        ))}
      </ul>
      {abrir && <Detalle ctx={ctx} id={abrir} cerrar={() => setAbrir(null)} />}
    </section>
  );
}
