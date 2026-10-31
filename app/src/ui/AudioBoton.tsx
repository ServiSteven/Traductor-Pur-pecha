import { useEffect, useRef, useState } from 'react';
import type { Forma } from '../engine/types';
import { NOMBRE_VARIANTE } from '../engine/types';
import type { PurDB } from '../data/db';
import { guardarGrabacion, resolverAudio } from '../data/audio';
import { IcAltavoz, IcMic } from './icons';

interface Props { db: PurDB; forma: Forma | null | undefined; colaborador: boolean }
export function AudioBoton({ db, forma, colaborador }: Props) {
  const [msg, setMsg] = useState(''); const [grabando, setGrabando] = useState(false);
  const rec = useRef<MediaRecorder | null>(null);
  useEffect(() => setMsg(''), [forma?.id]);
  if (!forma) return null;

  const reproducir = async () => {
    const a = await resolverAudio(db, forma);
    if (!a) { setMsg(`Aún no hay grabación de «${forma.texto}» para ${NOMBRE_VARIANTE[forma.variante]}.`); return; }
    setMsg(a.validado ? '' : 'Grabación local, aún sin validar.');
    new Audio(a.url).play().catch(() => setMsg('No se pudo reproducir el audio en este dispositivo.'));
  };
  const grabar = async () => {
    if (grabando) { rec.current?.stop(); return; }
    if (!navigator.mediaDevices || typeof MediaRecorder === 'undefined') { setMsg('Este dispositivo no permite grabar audio.'); return; }
    try {
      const flujo = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(flujo); const partes: Blob[] = [];
      mr.ondataavailable = e => e.data.size && partes.push(e.data);
      mr.onstop = async () => {
        flujo.getTracks().forEach(t => t.stop()); setGrabando(false);
        try { await guardarGrabacion(db, forma.id, new Blob(partes, { type: mr.mimeType })); setMsg('Grabación guardada en este dispositivo (sin validar).'); }
        catch { setMsg('No se pudo guardar la grabación.'); }
      };
      rec.current = mr; mr.start(); setGrabando(true); setMsg('Grabando… toca de nuevo para terminar.');
    } catch { setMsg('No se concedió permiso para usar el micrófono.'); }
  };
  return (
    <div className="audio">
      <button className="btn icono" onClick={reproducir} aria-label={`Escuchar ${forma.texto}`}><IcAltavoz /> <span>Escuchar</span></button>
      {colaborador && <button className={`btn icono sec ${grabando ? 'rojo' : ''}`} onClick={grabar}><IcMic /> <span>{grabando ? 'Detener' : 'Grabar'}</span></button>}
      {msg && <p className="nota" role="status">{msg}</p>}
    </div>
  );
}
