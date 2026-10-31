/// <reference lib="webworker" />
import { Engine } from './engine';
const motor = new Engine();
type Msg = { id: number; op: string; args: unknown[] };
self.onmessage = (ev: MessageEvent<Msg>) => {
  const { id, op, args } = ev.data;
  try {
    // @ts-expect-error despacho dinámico por nombre de operación
    const out = op === 'cargar' ? (motor.cargar(args[0]), true) : motor[op](...args);
    (self as unknown as Worker).postMessage({ id, ok: true, out });
  } catch (e) { (self as unknown as Worker).postMessage({ id, ok: false, error: String(e) }); }
};
