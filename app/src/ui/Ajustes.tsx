import { useEffect, useState } from 'react';
import type { Ctx } from './App';
import { NOMBRE_VARIANTE } from '../engine/types';
import { getMeta } from '../data/db';
import { encolarSugerencia, enviarCola, restaurarDeFabrica, sincronizar } from '../data/sync';
import { API_BASE } from './App';

export function Ajustes({ ctx }: { ctx: Ctx }) {
  const [cov, setCov] = useState<any[]>([]); const [paq, setPaq] = useState<Record<string, number>>({});
  const [msg, setMsg] = useState(''); const [sug, setSug] = useState({ espanol: '', purepecha: '', comentario: '' });
  const [persist, setPersist] = useState<string>('');
  const refrescar = async () => {
    setCov(await ctx.motor.call('cobertura'));
    const o: Record<string, number> = {};
    for (const id of ['base', 'sierra', 'canada', 'lago', 'cienega']) { const m = await getMeta<{ version: number }>(ctx.db, `paq:${id}`); if (m) o[id] = m.version; }
    setPaq(o);
  };
  useEffect(() => { refrescar(); }, [ctx.listo]);   // eslint-disable-line

  const buscar = async () => {
    setMsg('Buscando actualizaciones…');
    const inf = await sincronizar(ctx.db, fetch, API_BASE);
    if (inf.sinRed) setMsg('No hay conexión con el servidor. Puedes seguir usando la app sin conexión.');
    else if (inf.errores.length) setMsg(`Hubo ${inf.errores.length} paquete(s) que no se instalaron (se conservó la versión anterior): ${inf.errores.map(e => `${e.id}: ${e.motivo}`).join('; ')}`);
    else setMsg(inf.actualizados.length ? `Actualizado: ${inf.actualizados.join(', ')}.` : 'Ya tienes lo más reciente.');
    await enviarCola(ctx.db, fetch, API_BASE);
    await ctx.recargar(); refrescar();
  };
  const restaurar = async () => {
    if (!confirm('Se restaurarán los datos de instalación. Tus grabaciones y tu progreso se conservan. ¿Continuar?')) return;
    const inf = await restaurarDeFabrica(ctx.db, fetch);
    setMsg(inf.errores.length ? 'No se pudo restaurar por completo.' : 'Datos restaurados.'); await ctx.recargar(); refrescar();
  };
  const enviarSug = async () => {
    if (!ctx.variante || !sug.espanol.trim() || !sug.purepecha.trim()) { setMsg('Completa la palabra en español, en purépecha y elige una variante.'); return; }
    await encolarSugerencia(ctx.db, { ...sug, variante: ctx.variante });
    setSug({ espanol: '', purepecha: '', comentario: '' });
    const r = await enviarCola(ctx.db, fetch, API_BASE);
    setMsg(r.pendientes ? 'Sugerencia guardada. Se enviará cuando haya conexión.' : 'Sugerencia enviada. Será revisada por hablantes antes de publicarse.');
  };
  const pedirPersistencia = async () => {
    const ok = await navigator.storage?.persist?.(); setPersist(ok ? 'Almacenamiento protegido.' : 'El navegador no concedió protección de almacenamiento.');
  };

  return (
    <section className="ajustes">
      <h2>Lectura</h2>
      <div className="grupo" role="radiogroup" aria-label="Tamaño del texto">
        {[['Normal', 1], ['Grande', 1.2], ['Muy grande', 1.4]].map(([n, e]) => (
          <button key={n as string} role="radio" aria-checked={ctx.ajustes.escala === e} className={`chip ${ctx.ajustes.escala === e ? 'on' : ''}`} onClick={() => ctx.setAjustes({ ...ctx.ajustes, escala: e as number })}>{n}</button>))}
      </div>
      <label className="interruptor"><input type="checkbox" checked={ctx.ajustes.contraste} onChange={e => ctx.setAjustes({ ...ctx.ajustes, contraste: e.target.checked })} /> Alto contraste</label>
      <label className="interruptor"><input type="checkbox" checked={ctx.ajustes.colaborador} onChange={e => ctx.setAjustes({ ...ctx.ajustes, colaborador: e.target.checked })} /> Modo colaborador (grabar pronunciaciones)</label>

      <h2>Datos sin conexión</h2>
      <p className="nota">Estado: {navigator.onLine ? 'con conexión' : 'sin conexión'} · Paquetes instalados: {Object.entries(paq).map(([k, v]) => `${k} v${v}`).join(', ') || 'ninguno'}</p>
      <div className="grupo"><button className="btn" onClick={buscar}>Buscar actualizaciones</button>
        <button className="btn sec" onClick={restaurar}>Restaurar datos</button>
        <button className="btn sec" onClick={pedirPersistencia}>Proteger almacenamiento</button></div>
      {persist && <p className="nota">{persist}</p>}
      {msg && <p className="banner" role="status">{msg}</p>}

      <h2>Cobertura por variante</h2>
      <div className="deslizable"><table className="tabla"><thead><tr><th>Variante</th><th>Con registro</th><th>Validadas</th></tr></thead>
        <tbody>{cov.map(f => <tr key={f.variante}><td>{NOMBRE_VARIANTE[f.variante as keyof typeof NOMBRE_VARIANTE]}</td><td>{f.conceptos} de {f.total}</td><td>{f.validados}</td></tr>)}</tbody></table></div>
      <p className="nota">Un concepto sin registro en tu variante nunca se rellena con otra: se te avisa.</p>

      <h2>Sugerir una palabra</h2>
      <p className="nota">Se guarda en tu dispositivo y se envía cuando haya conexión. Un equipo de hablantes la revisa antes de publicarla.</p>
      <label className="campo">Español<input value={sug.espanol} maxLength={120} onChange={e => setSug({ ...sug, espanol: e.target.value })} /></label>
      <label className="campo">Purépecha ({ctx.variante ? NOMBRE_VARIANTE[ctx.variante] : 'elige variante'})<input value={sug.purepecha} maxLength={120} onChange={e => setSug({ ...sug, purepecha: e.target.value })} /></label>
      <button className="btn" onClick={enviarSug}>Enviar sugerencia</button>

      <h2>Acerca de</h2>
      <p className="nota">Prototipo MVP v0.1. El vocabulario incluido es una <strong>semilla de pruebas por validar</strong>: ninguna entrada ha sido revisada por hablantes de una variante. No lo uses como referencia lingüística hasta su validación.</p>
    </section>
  );
}
