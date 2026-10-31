import { useEffect, useState } from 'react';
import type { Ctx } from './App';
import type { Pregunta } from '../engine/practice';
import { leerDominio, registrar, resumen } from '../data/progress';
import { Etiqueta } from './Etiqueta';

export function Practicar({ ctx }: { ctx: Ctx }) {
  const [q, setQ] = useState<Pregunta | null | undefined>(undefined);
  const [elegida, setElegida] = useState<number | null>(null);
  const [res, setRes] = useState({ aciertos: 0, fallos: 0, dominadas: 0 });
  const v = ctx.variante;
  const siguiente = async () => {
    if (!v) return; setElegida(null);
    setQ(await ctx.motor.call<Pregunta | null>('pregunta', v, await leerDominio(ctx.db)));
    setRes(await resumen(ctx.db));
  };
  useEffect(() => { if (ctx.listo) siguiente(); /* eslint-disable-next-line */ }, [v, ctx.listo]);
  if (!v) return <section className="bienvenida"><h2>Practica tu variante</h2><p>Primero elige una variante arriba.</p></section>;
  if (q === null) return <p className="nota">Aún no hay suficientes palabras para practicar en esta variante.</p>;
  if (!q) return null;
  const responder = async (i: number) => {
    if (elegida !== null) return; setElegida(i);
    await registrar(ctx.db, q.conceptoId, q.opciones[i].correcta); setRes(await resumen(ctx.db));
  };
  return (
    <section>
      <p className="nota" aria-live="polite">Aciertos: {res.aciertos} · Por repasar: {res.fallos} · Palabras dominadas: {res.dominadas}</p>
      <h2 className="pregunta">{q.enunciado}</h2>
      <Etiqueta estado={q.etiqueta} />
      <div className="opciones">
        {q.opciones.map((o, i) => (
          <button key={i} disabled={elegida !== null} onClick={() => responder(i)}
            className={`btn opcion ${elegida !== null ? (o.correcta ? 'bien' : i === elegida ? 'mal' : '') : ''} ${q.tipo === 'es-pur' ? 'pur' : ''}`}>
            {o.texto}{elegida !== null && o.correcta ? ' ✓' : elegida === i ? ' ✗' : ''}
          </button>
        ))}
      </div>
      {elegida !== null && (
        <div role="status">
          <p className="retro">{q.opciones[elegida].correcta ? '¡Muy bien!' : 'Casi. La respuesta correcta está marcada.'}</p>
          <button className="btn principal" onClick={siguiente}>Siguiente</button>
        </div>
      )}
    </section>
  );
}
