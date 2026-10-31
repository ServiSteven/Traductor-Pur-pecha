import { describe, expect, it } from 'vitest';
import { Engine, AVISO_SEGMENTADA } from '../src/engine/engine';
import { generarPregunta } from '../src/engine/practice';
import { claveLaxaPur, clavePur } from '../src/engine/normalize';
import { lexiconSemilla, lexiconSintetico } from './fixtures';

const sint = () => new Engine(lexiconSintetico());
const semilla = () => new Engine(lexiconSemilla());

describe('TC-01 Traducción de palabras (español → purépecha)', () => {
  it('traduce una palabra del léxico real y la marca por validar / referencia general', () => {
    const r = semilla().traducir('flor', 'es-pur', 'lago');
    expect(r.segmentos[0].destino).toBe('tsïtsïki');
    expect(r.segmentos[0].estado).toBe('referencia_general');
    expect(r.segmentos[0].avisos.join(' ')).toMatch(/sin variante confirmada/);
  });
  it('ignora mayúsculas, acentos y signos', () => {
    expect(semilla().traducir('¿MAMÁ?', 'es-pur', 'sierra').segmentos[0].destino).toBe('nana');
    expect(semilla().traducir('Madre', 'es-pur', 'sierra').segmentos[0].destino).toBe('nana');
  });
  it('aplica reglas básicas: artículo y plural', () => {
    const s = semilla().traducir('las flores', 'es-pur', 'lago').segmentos[0];
    expect(s.destino).toBe('tsïtsïki');
    expect(s.reglas).toEqual(expect.arrayContaining(['artículo omitido', 'plural → singular']));
  });
});

describe('TC-02 Traducción inversa (purépecha → español)', () => {
  it('traduce con la forma exacta', () => {
    expect(semilla().traducir('tsïtsïki', 'pur-es', 'lago').segmentos[0].destino).toBe('flor');
  });
  it('acepta escritura sin diéresis o con apóstrofo distinto y avisa que es aproximada', () => {
    const s = semilla().traducir('tsitsiki', 'pur-es', 'lago').segmentos[0];
    expect(s.destino).toBe('flor'); expect(s.aproximada).toBe(true);
    expect(s.avisos.join(' ')).toMatch(/aproximada/);
    expect(semilla().traducir('k’eri', 'pur-es', 'lago').segmentos[0].destino).toBe('grande');
  });
  it('conserva sinónimos como alternativas', () => {
    const s = semilla().traducir('nana', 'pur-es', 'sierra').segmentos[0];
    expect(s.destino).toBe('madre'); expect(s.alternativas).toContain('mamá');
  });
});

describe('TC-03 Frases', () => {
  it('traduce una frase registrada completa', () => {
    const r = semilla().traducir('nuestra fuerza', 'es-pur', 'sierra');
    expect(r.tipo).toBe('exacta'); expect(r.segmentos[0].destino).toBe('juchari uinapikua');
    expect(semilla().traducir('juchari uinapikua', 'pur-es', 'sierra').segmentos[0].destino).toBe('nuestra fuerza');
  });
  it('una oración no registrada se segmenta, avisa y NO se presenta como traducción final', () => {
    const r = semilla().traducir('la flor es grande', 'es-pur', 'lago');
    expect(r.tipo).toBe('segmentada'); expect(r.completa).toBe(false);
    expect(r.avisos).toContain(AVISO_SEGMENTADA);
    const es = r.segmentos.find(s => s.origen === 'es')!;
    expect(es.estado).toBe('no_encontrada'); expect(es.destino).toBeNull();
  });
});

describe('TC-04 Palabras inexistentes y entrada vacía', () => {
  it('informa que no está en el diccionario y no inventa traducción', () => {
    const r = semilla().traducir('computadora', 'es-pur', 'lago');
    expect(r.segmentos[0].estado).toBe('no_encontrada'); expect(r.segmentos[0].destino).toBeNull(); expect(r.completa).toBe(false);
  });
  it('entrada vacía', () => { expect(semilla().traducir('   ', 'es-pur', 'lago').tipo).toBe('vacia'); });
});

describe('TC-05 Aislamiento de variantes (léxico sintético)', () => {
  it('cada variante devuelve su propia forma', () => {
    expect(sint().traducir('casa', 'es-pur', 'sierra').segmentos[0].destino).toBe('casa~S');
    expect(sint().traducir('casa', 'es-pur', 'lago').segmentos[0].destino).toBe('casa~L');
  });
  it('una forma por validar de la variante se marca como tal', () => {
    expect(sint().traducir('casa', 'es-pur', 'lago').segmentos[0].estado).toBe('por_validar');
    expect(sint().traducir('casa', 'es-pur', 'sierra').segmentos[0].estado).toBe('validada');
  });
  it('NO sustituye una variante por otra: si falta, "no disponible" y avisa dónde sí existe', () => {
    const s = sint().traducir('casa', 'es-pur', 'canada').segmentos[0];
    expect(s.destino).toBeNull(); expect(s.estado).toBe('no_disponible');
    expect(s.otrasVariantes).toEqual(expect.arrayContaining(['sierra', 'lago']));
    expect(sint().traducir('sol', 'es-pur', 'lago').segmentos[0].destino).toBeNull();
  });
  it('usa la referencia general solo si no hay forma de la variante, y lo rotula', () => {
    const s = sint().traducir('agua', 'es-pur', 'sierra').segmentos[0];
    expect(s.destino).toBe('agua~G'); expect(s.estado).toBe('referencia_general');
  });
  it('en sentido inverso avisa si la forma pertenece a otra variante', () => {
    const s = sint().traducir('casa~S', 'pur-es', 'lago').segmentos[0];
    expect(s.destino).toBe('casa'); expect(s.avisos.join(' ')).toMatch(/pertenece a la variante Sierra/);
  });
  it('la regla de preferencia es estable con homónimos: prefiere la variante elegida', () => {
    expect(sint().traducir('perro', 'es-pur', 'sierra').segmentos[0].destino).toBe("pe'rro~S");
    expect(sint().traducir('perro', 'es-pur', 'lago').segmentos[0].destino).toBe('perro~L');
  });
  it('la segmentación respeta la coincidencia más larga y la variante', () => {
    const r = sint().traducir('casa grande', 'es-pur', 'lago');
    expect(r.tipo).toBe('exacta'); expect(r.segmentos[0].destino).toBe('casagrande~L');
    const r2 = sint().traducir('luna y río', 'es-pur', 'lago');
    expect(r2.segmentos.map(s => s.destino)).toEqual(['luna~L', null, 'río~L']);
  });
});

describe('TC-06 Comparador, cobertura y búsqueda', () => {
  it('el comparador no mezcla ni rellena variantes ausentes', () => {
    const c = sint().comparar('x1');
    expect(c.find(x => x.variante === 'canada')!.formas).toHaveLength(0);
    expect(c.find(x => x.variante === 'sierra')!.formas[0].texto).toBe('casa~S');
  });
  it('la cobertura cuenta por variante', () => {
    const cov = sint().cobertura();
    expect(cov.find(x => x.variante === 'lago')).toMatchObject({ conceptos: 5, validados: 4 });
    expect(cov.find(x => x.variante === 'canada')).toMatchObject({ conceptos: 0, validados: 0 });
  });
  it('busca por español y por purépecha (tolerante)', () => {
    expect(semilla().buscar('tamal').map(c => c.id)).toEqual(expect.arrayContaining(['c010', 'c011']));
    expect(semilla().buscar('kurhunda').map(c => c.id)).toContain('c010');
  });
});

describe('TC-07 Normalización', () => {
  it('claves exacta y laxa', () => {
    expect(clavePur(" K’ERI ")).toBe("k'eri");
    expect(claveLaxaPur('Tsïtsïki')).toBe('tsitsiki');
  });
});

describe('TC-08 Modo práctica', () => {
  it('genera preguntas válidas con 4 opciones y una correcta', () => {
    const e = semilla(); let i = 0; const rng = () => ((i = (i * 9301 + 49297) % 233280) / 233280) || 0.3;
    for (let k = 0; k < 20; k++) {
      const q = generarPregunta(e, 'lago', {}, rng)!;
      expect(q.opciones).toHaveLength(4); expect(q.opciones.filter(o => o.correcta)).toHaveLength(1);
      expect(new Set(q.opciones.map(o => o.texto)).size).toBe(4);
    }
  });
  it('prioriza conceptos con menor dominio', () => {
    const e = semilla(); const dom: any = {};
    for (const c of e.buscar('')) if (c.id !== 'c003' && c.tipo === 'palabra') dom[c.id] = { aciertos: 5, fallos: 0 };
    expect(generarPregunta(e, 'lago', dom, () => 0.1, 'es-pur')!.conceptoId).toBe('c003');
  });
  it('no genera preguntas si no hay suficiente contenido', () => {
    expect(new Engine({ conceptos: lexiconSintetico().conceptos.slice(0, 2), formas: [] }).pregunta('lago', {})).toBeNull();
  });
});
