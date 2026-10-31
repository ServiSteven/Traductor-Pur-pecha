// Pruebas de extremo a extremo en Chromium real: instalación, offline, traducción, API, accesibilidad y rendimiento.
// Uso: (con la API en :8000 y `vite preview` en :4173)  node tests/e2e.mjs
import { chromium } from 'playwright-core';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const URL = process.env.APP_URL ?? 'http://localhost:4173/';
const API = process.env.API_URL ?? 'http://localhost:8000';
const OUT = '../docs/evidencia'; mkdirSync(OUT, { recursive: true });
const axeSrc = readFileSync('node_modules/axe-core/axe.min.js', 'utf-8');
const R = []; const reg = (id, nombre, ok, detalle) => { R.push({ id, nombre, ok, detalle }); console.log(ok ? 'PASS' : 'FAIL', id, nombre, '–', detalle); };

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 360, height: 740 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, permissions: [] });
const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(String(e)));
const cdp = await ctx.newCDPSession(page);
const traducir = async (t) => { await page.getByPlaceholder(/Escribe en/).fill(t); await page.locator('main').getByRole('button', { name: 'Traducir', exact: true }).click(); await page.waitForFunction(t => (document.querySelector('.resultado .origen')?.textContent ?? '').trim().toLowerCase().startsWith(t.split(' ')[0].toLowerCase()), t); };

// ── E1: primera carga en condiciones de gama baja (CPU 4x más lenta, red 3G) ──
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
await cdp.send('Network.enable');
await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 300, downloadThroughput: 400 * 1024 / 8, uploadThroughput: 400 * 1024 / 8 });
const t0 = Date.now(); await page.goto(URL); await page.getByText('¿De qué región es tu purépecha?').waitFor({ timeout: 60000 });
const tCarga = Date.now() - t0;
reg('E-01', 'Primera carga útil con 3G lenta y CPU 4× más lenta (meta ≤ 5 s)', tCarga <= 5000, `${tCarga} ms`);
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
await page.screenshot({ path: `${OUT}/01-bienvenida.png` });

// ── E2: sin variante impuesta; elegir Lago y traducir ──
const radios = await page.getByRole('radio').count();
reg('E-02', 'No hay variante preseleccionada (4 opciones, ninguna activa)', radios === 4 && (await page.locator('.variante.activa').count()) === 0, `${radios} opciones`);
await page.getByRole('radio', { name: 'Lago' }).click();
const tt = Date.now(); await traducir('flor'); const tTrad = Date.now() - tt;
const txt = await page.locator('.resultado').innerText();
reg('E-03', 'Traducir «flor» (Lago) → tsïtsïki con aviso de referencia general', txt.includes('tsïtsïki') && /Referencia general/.test(txt), txt.replace(/\n+/g, ' | ').slice(0, 140));
reg('E-04', 'Tiempo de respuesta de traducción (meta ≤ 500 ms)', tTrad <= 500, `${tTrad} ms (incluye clic y render)`);
await page.screenshot({ path: `${OUT}/02-traduccion.png` });

// ── E3: audio sin grabación ──
await page.getByRole('button', { name: /Escuchar/ }).first().click();
const msgAudio = await page.locator('.audio .nota').first().innerText();
reg('E-05', 'Sin grabación: se informa y no se sustituye ni sintetiza', /Aún no hay grabación/.test(msgAudio), msgAudio);

// ── E4: frase y oración ──
await traducir('nuestra fuerza'); reg('E-06', 'Frase registrada «nuestra fuerza» → juchari uinapikua', (await page.locator('.resultado').innerText()).includes('juchari uinapikua'), 'ok');
await traducir('la flor es grande'); const o = await page.locator('.resultado').innerText();
reg('E-07', 'Oración no registrada: segmentada, con advertencia y sin traducción final', /Traducción por segmentos/.test(o) && /No está en el diccionario/.test(o), 'aviso mostrado');
await page.screenshot({ path: `${OUT}/03-segmentada.png` });
await traducir('computadora'); reg('E-08', 'Palabra inexistente: «No está en el diccionario»', /No está en el diccionario/.test(await page.locator('.resultado').innerText()), 'ok');

// ── E5: sentido inverso aproximado ──
await page.getByRole('button', { name: /Cambiar dirección/ }).click(); await traducir('tsitsiki');
const inv = await page.locator('.resultado').innerText();
reg('E-09', 'Purépecha → español con escritura aproximada (tsitsiki → flor) y aviso', inv.includes('flor') && /aproximada/i.test(inv), 'ok');

// ── E6: diccionario y comparador ──
await page.getByRole('button', { name: 'Diccionario' }).click(); await page.getByRole('button', { name: /^madre/ }).click();
const comp = await page.locator('.hoja').innerText();
reg('E-10', 'Comparador: 5 grupos y las variantes sin datos no se rellenan', (await page.locator('.comparador > li').count()) === 5 && /Sin registro todavía/.test(comp), 'ok');
await page.waitForTimeout(500); await page.screenshot({ path: `${OUT}/04-comparador.png` }); await page.getByRole('button', { name: 'Cerrar' }).click();

// ── E7: práctica ──
await page.getByRole('button', { name: 'Practicar' }).click(); await page.locator('.opciones').waitFor();
const nOp = await page.locator('.btn.opcion').count(); await page.locator('.btn.opcion').first().click();
reg('E-11', 'Práctica: 4 opciones y retroalimentación inmediata', nOp === 4 && (await page.locator('.retro').count()) === 1, `${nOp} opciones`);
await page.screenshot({ path: `${OUT}/05-practica.png` });

// ── E8: sincronización con el servidor real ──
await page.getByRole('button', { name: 'Ajustes' }).click(); await page.getByRole('button', { name: 'Buscar actualizaciones' }).click();
await page.getByText(/Ya tienes lo más reciente|Actualizado/).waitFor();
const v1 = await page.getByText(/Paquetes instalados/).innerText();
reg('E-12', 'Sincronización con API real (sin cambios): paquetes v1', /base v1/.test(v1), v1);
const adm = await fetch(`${API}/api/admin/formas/1/validar`, { method: 'POST', headers: { 'X-Admin-Token': 'test' } });
await page.getByRole('button', { name: 'Buscar actualizaciones' }).click(); await page.getByText(/Actualizado: base/).waitFor();
const v2 = await page.getByText(/Paquetes instalados/).innerText();
reg('E-13', 'Validación en el servidor → la app descarga solo el paquete base v2 (delta)', adm.ok && /base v2/.test(v2) && /sierra v1/.test(v2), v2);
await page.locator('nav').getByRole('button', { name: 'Diccionario' }).click(); await page.getByRole('button', { name: /^madre/ }).click();
const compV = await page.locator('.hoja').innerText();
reg('E-14', 'Tras sincronizar, la forma validada en el servidor aparece como «Validada» en el comparador', /Validada/.test(compV), (compV.match(/Validada|Referencia general[^\n]*/g) ?? []).join(' / '));
await page.getByRole('button', { name: 'Cerrar' }).click(); await page.locator('nav').getByRole('button', { name: 'Ajustes' }).click();
await page.screenshot({ path: `${OUT}/06-ajustes.png` }); // (se captura tras volver)

// ── E9: OFFLINE real: SW activo, red cortada, recarga ──
await page.evaluate(() => navigator.serviceWorker.ready);
await page.waitForTimeout(800);
await ctx.setOffline(true);
await page.reload(); await page.locator('.estado.off').waitFor({ timeout: 15000 });
await traducir('tierra'); const off = await page.locator('.resultado').innerText();
reg('E-15', 'OFFLINE: recarga sin red y traduce «tierra» → echeri', off.includes('echeri'), 'app y datos servidos desde caché + IndexedDB');
await page.getByRole('button', { name: 'Diccionario' }).click(); await page.getByRole('searchbox').fill('tamal'); await page.waitForFunction(() => document.querySelectorAll('.fila').length <= 2, null, { timeout: 5000 }).catch(() => {});
reg('E-16', 'OFFLINE: diccionario busca «tamal» (2 conceptos)', (await page.locator('.fila').count()) === 2, `${await page.locator('.fila').count()} resultados`);
await page.getByRole('button', { name: 'Ajustes' }).click(); await page.getByRole('button', { name: 'Buscar actualizaciones' }).click();
await page.getByText(/No hay conexión con el servidor/).waitFor();
reg('E-17', 'OFFLINE: «Buscar actualizaciones» informa sin romper la app', true, 'mensaje mostrado, datos intactos');
await page.screenshot({ path: `${OUT}/07-offline.png` });
await ctx.setOffline(false);

// ── E10: recuperación ante fallo (IndexedDB dañada) ──
await page.evaluate(async () => { const r = indexedDB.open('purepecha-mvp'); await new Promise(res => r.onsuccess = res); const db = r.result;
  await new Promise(res => { const tx = db.transaction(['formas', 'conceptos'], 'readwrite'); tx.objectStore('formas').clear(); tx.objectStore('conceptos').clear(); tx.oncomplete = res; }); db.close(); });
page.once('dialog', d => d.accept()); await page.getByRole('button', { name: 'Restaurar datos' }).click(); await page.getByText('Datos restaurados.').waitFor();
await page.locator('nav').getByRole('button', { name: 'Traducir' }).click(); await traducir('padre');
reg('E-18', 'Recuperación: tras vaciar IndexedDB, «Restaurar datos» reinstala y traduce «padre» → tata', (await page.locator('.resultado').innerText()).includes('tata'), 'ok');

// ── E11: accesibilidad (axe-core, WCAG 2.1 A/AA) + tamaño de objetivos táctiles ──
async function axe(nombre) {
  await page.evaluate(axeSrc);
  const r = await page.evaluate(async () => await window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] }));
  return { nombre, violaciones: r.violations.map(v => `${v.id} (${v.nodes.length})`), pasadas: r.passes.length };
}
const axeRes = [];
for (const t of ['Traducir', 'Diccionario', 'Practicar', 'Ajustes']) { await page.locator('nav').getByRole('button', { name: t }).click(); await page.waitForTimeout(250); axeRes.push(await axe(t)); }
const totV = axeRes.flatMap(a => a.violaciones);
reg('E-19', 'axe-core WCAG 2.1 A/AA en las 4 pantallas (0 violaciones)', totV.length === 0, totV.length ? JSON.stringify(axeRes) : `${axeRes.reduce((s, a) => s + a.pasadas, 0)} verificaciones pasadas`);
await page.locator('nav').getByRole('button', { name: 'Traducir' }).click();
const chicos = await page.evaluate(() => [...document.querySelectorAll('button,input,textarea')].map(e => { const r = e.getBoundingClientRect(); return { n: (e.textContent || e.getAttribute('aria-label') || e.tagName).trim().slice(0, 20), w: r.width, h: r.height }; }).filter(x => x.w > 0 && (x.w < 44 || x.h < 44)));
reg('E-20', 'Objetivos táctiles ≥ 44×44 px (360 px de ancho)', chicos.length === 0, chicos.length ? JSON.stringify(chicos) : 'todos cumplen');
const desborde = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
reg('E-21', 'Sin desplazamiento horizontal a 360 px', !desborde, desborde ? 'hay desborde' : 'ok');

// ── E12: memoria y texto grande ──
await page.locator('nav').getByRole('button', { name: 'Ajustes' }).click(); await page.getByRole('radio', { name: 'Muy grande' }).click();
await page.locator('nav').getByRole('button', { name: 'Traducir' }).click(); await traducir('nuestra fuerza');
const desb2 = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
reg('E-22', 'Texto «Muy grande» (140 %) sin desborde horizontal', !desb2, 'ok'); await page.screenshot({ path: `${OUT}/08-texto-grande.png` });
const heap = await page.evaluate(() => performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576 * 10) / 10 : -1);
reg('E-23', 'Memoria JS en uso tras un recorrido completo (meta ≤ 150 MB)', heap >= 0 && heap <= 150, `${heap} MB (heap JS)`);
reg('E-24', 'Sin errores de JavaScript no controlados', errs.length === 0, errs.join(' | ') || 'ninguno');

writeFileSync(`${OUT}/resultados-e2e.json`, JSON.stringify({ fecha: new Date().toISOString(), resultados: R, axe: axeRes }, null, 2));
await browser.close();
const fallos = R.filter(r => !r.ok); console.log(`\n${R.length - fallos.length}/${R.length} pruebas E2E aprobadas`); process.exit(fallos.length ? 1 : 0);
