import { Engine } from './engine';
import type { LexiconData } from './types';

type Op = 'cargar' | 'traducir' | 'buscar' | 'categorias' | 'comparar' | 'cobertura' | 'elegirForma' | 'pregunta';
/** Cliente del motor: usa Web Worker (no bloquea la UI); si no existe, ejecuta en el hilo principal. */
export class EngineClient {
  private w?: Worker; private n = 0; private pend = new Map<number, [(v: any) => void, (e: any) => void]>();
  private local?: Engine;
  constructor() {
    if (typeof Worker !== 'undefined') {
      this.w = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
      this.w.onmessage = ev => {
        const p = this.pend.get(ev.data.id); if (!p) return; this.pend.delete(ev.data.id);
        ev.data.ok ? p[0](ev.data.out) : p[1](new Error(ev.data.error));
      };
    } else this.local = new Engine();
  }
  call<T = any>(op: Op, ...args: unknown[]): Promise<T> {
    if (this.local) return Promise.resolve((op === 'cargar' ? (this.local.cargar(args[0] as LexiconData), true) : (this.local as any)[op](...args)) as T);
    return new Promise((res, rej) => { const id = ++this.n; this.pend.set(id, [res, rej]); this.w!.postMessage({ id, op, args }); });
  }
}
