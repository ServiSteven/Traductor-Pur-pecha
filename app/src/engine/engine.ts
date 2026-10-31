import { ARTICULOS, candidatosEs, clavePur, claveEs, claveLaxaPur, tokenizar } from './normalize';
import type {
  Concepto, Direccion, EstadoSegmento, Forma, LexiconData, Resultado, Segmento, Variante, VarianteForma,
} from './types';
import { VARIANTES } from './types';
import { generarPregunta, type Dominio } from './practice';

export const AVISO_SEGMENTADA =
  'Traducción por segmentos: el orden y la gramática del purépecha pueden ser distintos. No la uses como traducción final.';
const MAX_N = 6;

export class Engine {
  private conceptos = new Map<string, Concepto>();
  private formasPorConcepto = new Map<string, Forma[]>();
  private esIdx = new Map<string, string[]>();             // claveEs -> conceptoIds
  private purExacto = new Map<string, Forma[]>();
  private purLaxo = new Map<string, Forma[]>();

  constructor(datos?: LexiconData) { if (datos) this.cargar(datos); }

  cargar(d: LexiconData) {
    this.conceptos.clear(); this.formasPorConcepto.clear(); this.esIdx.clear();
    this.purExacto.clear(); this.purLaxo.clear();
    for (const c of d.conceptos) {
      this.conceptos.set(c.id, c);
      for (const e of c.es) push(this.esIdx, claveEs(e), c.id);
    }
    for (const f of d.formas) {
      if (!this.conceptos.has(f.conceptoId)) continue; // forma huérfana: se ignora
      push(this.formasPorConcepto, f.conceptoId, f);
      push(this.purExacto, clavePur(f.texto), f);
      push(this.purLaxo, claveLaxaPur(f.texto), f);
    }
  }
  get totalConceptos() { return this.conceptos.size; }
  concepto(id: string) { return this.conceptos.get(id); }
  formasDe(id: string) { return this.formasPorConcepto.get(id) ?? []; }

  /** Regla central: qué forma mostrar para un concepto en una variante, sin mezclar variantes. */
  elegirForma(conceptoId: string, v: Variante): { forma: Forma | null; estado: EstadoSegmento; otras: VarianteForma[] } {
    const fs = this.formasDe(conceptoId);
    const otras = [...new Set(fs.filter(f => f.variante !== v && f.variante !== 'general').map(f => f.variante))];
    const propias = fs.filter(f => f.variante === v);
    if (propias.length) {
      const f = propias.find(x => x.estado === 'validado') ?? propias[0];
      return { forma: f, estado: f.estado === 'validado' ? 'validada' : 'por_validar', otras };
    }
    const gen = fs.find(f => f.variante === 'general');
    if (gen) return { forma: gen, estado: 'referencia_general', otras };
    return { forma: null, estado: 'no_disponible', otras };
  }

  traducir(texto: string, dir: Direccion, v: Variante): Resultado {
    const tokens = tokenizar(texto);
    const base: Resultado = { direccion: dir, variante: v, entrada: texto, tipo: 'vacia', segmentos: [], completa: false, avisos: [] };
    if (!tokens.length) return base;

    // 1) Intento con la entrada completa (frase o palabra, con reglas).
    const completo = dir === 'es-pur' ? this.segEs(tokens, v) : this.segPur(tokens, v);
    if (completo) return { ...base, tipo: 'exacta', segmentos: [completo], completa: completo.destino !== null };

    // 2) Segmentación voraz por la coincidencia más larga.
    const segs: Segmento[] = [];
    for (let i = 0; i < tokens.length;) {
      let hecho = false;
      for (let n = Math.min(MAX_N, tokens.length - i); n >= 1; n--) {
        const sub = tokens.slice(i, i + n);
        const s = dir === 'es-pur' ? this.segEs(sub, v) : this.segPur(sub, v);
        if (s) { segs.push(s); i += n; hecho = true; break; }
      }
      if (!hecho) {
        if (dir === 'es-pur' && ARTICULOS.has(claveEs(tokens[i]))) {
          segs.push(this.vacio(tokens[i], 'no_encontrada', ['Artículo sin equivalente directo en purépecha: se omite.'], 'artículo omitido', true));
        } else segs.push(this.vacio(tokens[i], 'no_encontrada', ['Esta palabra aún no está en el diccionario.']));
        i++;
      }
    }
    const utiles = segs.filter(s => !(s.estado === 'no_encontrada' && s.reglas.includes('artículo omitido')));
    const completa = utiles.every(s => s.destino !== null);
    const avisos = tokens.length > 1 ? [AVISO_SEGMENTADA] : [];
    if (!completa) avisos.push('Faltan palabras o no hay traducción disponible para todas. Revisa los segmentos marcados.');
    return { ...base, tipo: 'segmentada', segmentos: segs, completa, avisos };
  }

  private vacio(origen: string, estado: EstadoSegmento, avisos: string[], regla?: string, aprox = false): Segmento {
    return { origen, destino: null, estado, aproximada: aprox, reglas: regla ? [regla] : [], avisos, otrasVariantes: [], alternativas: [] };
  }

  /** español → purépecha para un trozo de texto; null si no hay coincidencia en el léxico. */
  private segEs(tokens: string[], v: Variante): Segmento | null {
    let ts = tokens; const reglas: string[] = [];
    if (ts.length > 1 && ARTICULOS.has(claveEs(ts[0]))) { ts = ts.slice(1); reglas.push('artículo omitido'); }
    const frase = ts.join(' ');
    const intentos = ts.length === 1 ? candidatosEs(frase) : [{ clave: claveEs(frase) }];
    for (const it of intentos) {
      const ids = this.esIdx.get(it.clave);
      if (!ids?.length) continue;
      const conReglas = it.regla ? [...reglas, it.regla] : reglas;
      return this.armarEs(tokens.join(' '), ids, v, conReglas);
    }
    return null;
  }
  private armarEs(origen: string, ids: string[], v: Variante, reglas: string[]): Segmento {
    const evals = ids.map(id => ({ id, ...this.elegirForma(id, v) }));
    const mejor = evals.find(e => e.forma) ?? evals[0];
    const seg: Segmento = {
      origen, destino: mejor.forma?.texto ?? null, estado: mejor.estado, conceptoId: mejor.id,
      formaId: mejor.forma?.id, varianteForma: mejor.forma?.variante, aproximada: false, reglas,
      avisos: [], otrasVariantes: mejor.otras,
      alternativas: evals.filter(e => e !== mejor && e.forma).map(e => e.forma!.texto),
    };
    this.avisosForma(seg, v);
    return seg;
  }

  /** purépecha → español. */
  private segPur(tokens: string[], v: Variante): Segmento | null {
    const frase = tokens.join(' ');
    let formas = this.purExacto.get(clavePur(frase)); let aprox = false;
    if (!formas?.length) { formas = this.purLaxo.get(claveLaxaPur(frase)); aprox = !!formas?.length; }
    if (!formas?.length) return null;
    // Preferir la forma de la variante elegida; luego general; luego cualquier otra (con aviso).
    const f = formas.find(x => x.variante === v) ?? formas.find(x => x.variante === 'general') ?? formas[0];
    const c = this.conceptos.get(f.conceptoId)!;
    const seg: Segmento = {
      origen: tokens.join(' '), destino: c.es[0],
      estado: f.variante === v ? (f.estado === 'validado' ? 'validada' : 'por_validar')
        : f.variante === 'general' ? 'referencia_general' : (f.estado === 'validado' ? 'validada' : 'por_validar'),
      conceptoId: c.id, formaId: f.id, varianteForma: f.variante, aproximada: aprox,
      reglas: aprox ? ['coincidencia aproximada (acentos o apóstrofos)'] : [], avisos: [],
      otrasVariantes: [], alternativas: c.es.slice(1),
    };
    if (aprox) seg.avisos.push(`Coincidencia aproximada con «${f.texto}». Revisa la escritura.`);
    if (f.variante !== v && f.variante !== 'general')
      seg.avisos.push(`Esta forma pertenece a la variante ${nombre(f.variante)}, distinta de la seleccionada.`);
    this.avisosForma(seg, v, true);
    return seg;
  }

  private avisosForma(seg: Segmento, v: Variante, reversa = false) {
    if (seg.estado === 'por_validar') seg.avisos.push('Esta forma aún no ha sido validada por hablantes.');
    if (seg.estado === 'referencia_general') seg.avisos.push(reversa
      ? 'Forma de referencia general: su variante no está confirmada ni validada.'
      : `No hay forma registrada para ${nombre(v)}. Se muestra una referencia general sin variante confirmada ni validada.`);
    if (seg.estado === 'no_disponible') seg.avisos.push(`Sin traducción disponible para ${nombre(v)}.`);
    if (seg.otrasVariantes.length && !reversa)
      seg.avisos.push(`Existe en otras variantes (${seg.otrasVariantes.map(nombre).join(', ')}); no se sustituye automáticamente. Usa «Comparar variantes».`);
  }

  /** Búsqueda para el diccionario (prefijo/contiene, tolerante). */
  buscar(q: string, categoria?: string): Concepto[] {
    const ke = claveEs(q), kp = claveLaxaPur(q);
    const res = [...this.conceptos.values()].filter(c => {
      if (categoria && c.categoria !== categoria) return false;
      if (!ke) return true;
      if (c.es.some(e => claveEs(e).includes(ke))) return true;
      return this.formasDe(c.id).some(f => claveLaxaPur(f.texto).includes(kp));
    });
    return res.sort((a, b) => a.es[0].localeCompare(b.es[0], 'es'));
  }
  categorias(): string[] { return [...new Set([...this.conceptos.values()].map(c => c.categoria))].sort(); }

  /** Todas las formas de un concepto por variante, sin mezclar: las ausentes quedan nulas. */
  comparar(conceptoId: string) {
    const fs = this.formasDe(conceptoId);
    const orden: VarianteForma[] = [...VARIANTES, 'general'];
    return orden.map(v => ({ variante: v, formas: fs.filter(f => f.variante === v) }));
  }

  cobertura() {
    const total = this.conceptos.size;
    const filas = VARIANTES.map(v => {
      const ids = new Set(this.allFormas().filter(f => f.variante === v).map(f => f.conceptoId));
      const val = new Set(this.allFormas().filter(f => f.variante === v && f.estado === 'validado').map(f => f.conceptoId));
      return { variante: v as VarianteForma, conceptos: ids.size, validados: val.size, total };
    });
    const g = this.allFormas().filter(f => f.variante === 'general');
    filas.push({ variante: 'general', conceptos: new Set(g.map(f => f.conceptoId)).size,
      validados: new Set(g.filter(f => f.estado === 'validado').map(f => f.conceptoId)).size, total });
    return filas;
  }
  pregunta(v: Variante, progreso: Dominio, tipo?: 'es-pur' | 'pur-es') { return generarPregunta(this, v, progreso, Math.random, tipo); }
  private allFormas(): Forma[] { return [...this.formasPorConcepto.values()].flat(); }
}

function push<K, V>(m: Map<K, V[]>, k: K, v: V) { const a = m.get(k); if (a) a.push(v); else m.set(k, [v]); }
const nombre = (v: VarianteForma) => ({ sierra: 'Sierra', canada: 'Cañada', lago: 'Lago', cienega: 'Ciénaga', general: 'referencia general' }[v]);
