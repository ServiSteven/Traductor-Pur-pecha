# Traductor Español–Purépecha · MVP alpha (v0.1)

Prototipo para análisis de diseño, arquitectura y funcionalidad mínima. **No es una versión de producción.**

## Qué incluye
- **PWA** (React + Vite + TypeScript) offline-first: Service Worker (Workbox), IndexedDB (Dexie), motor de traducción en Web Worker.
- **Traducción** ES↔PUR de palabras y frases; segmentación con aviso para oraciones no registradas; búsqueda tolerante (acentos, ï, apóstrofos).
- **4 variantes** (Sierra, Cañada, Lago, Ciénaga) con selección manual, sin variante preseleccionada y **sin sustituir una variante por otra**.
- **Estados visibles**: Validada · Por validar · Referencia general (sin variante confirmada) · No disponible · No está en el diccionario.
- **Audio**: reproduce la grabación de la forma exacta; «Modo colaborador» permite grabar (MediaRecorder). Sin grabación se avisa; no se compone audio.
- **Diccionario** con conceptos bioculturales y comparador de variantes; **Practicar** (opción múltiple con repaso por dominio).
- **API FastAPI + SQLite**: manifiesto/paquetes con SHA-256, sugerencias validadas con límite de solicitudes, endpoints de administración con token.

## Importante: datos
`data/lexicon.csv` es una **semilla de 18 entradas, todas «por validar»** y sin variante asignada. No hay datos por variante: debe aportarlos y validarlos
un equipo de hablantes/lingüistas. Para añadirlos: una fila por forma, con `variante` = sierra|canada|lago|cienega|general y `estado` = validado|por_validar.

## Ejecutar
```bash
# API (opcional; la app funciona sin ella)
pip install -r requirements.txt
export PUREPECHA_ADMIN_TOKEN=cambia-esto
python -m api.export_snapshot            # regenera app/public/data desde el CSV
uvicorn api.main:app --port 8000

# App
cd app && npm install
npm run dev                              # desarrollo (proxy /api → :8000)
npm run build && npm run preview         # versión instalable/offline en :4173
```
## Pruebas
`cd app && npx vitest run` (37) · `python -m pytest tests` (9) · `node tests/e2e.mjs` (24; requiere API en :8000, `npm run preview` y Chromium).

## Límites conocidos del alpha
- Sin audios incluidos ni datos por variante validados.
- Traducción por diccionario + reglas mínimas; no gramática purépecha completa.
- Entrada por voz: Fase 2. Sugerencias: cola local, sin panel de moderación.
- Pendiente: pruebas en dispositivos físicos y con usuarios; primera carga en 3G+CPU 4× medida entre 4.4 y 5.4 s (meta ≤ 5 s).
