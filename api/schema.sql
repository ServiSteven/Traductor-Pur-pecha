CREATE TABLE IF NOT EXISTS conceptos(
  id TEXT PRIMARY KEY, tipo TEXT NOT NULL CHECK(tipo IN('palabra','frase')),
  categoria TEXT NOT NULL, es TEXT NOT NULL, nota TEXT NOT NULL DEFAULT '');
CREATE TABLE IF NOT EXISTS formas(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  concepto_id TEXT NOT NULL REFERENCES conceptos(id),
  variante TEXT NOT NULL CHECK(variante IN('general','sierra','canada','lago','cienega')),
  texto TEXT NOT NULL, estado TEXT NOT NULL CHECK(estado IN('validado','por_validar')),
  fuente TEXT NOT NULL DEFAULT '', UNIQUE(concepto_id,variante,texto));
CREATE TABLE IF NOT EXISTS paquetes(id TEXT PRIMARY KEY, version INTEGER NOT NULL DEFAULT 1);
CREATE TABLE IF NOT EXISTS sugerencias(
  id INTEGER PRIMARY KEY AUTOINCREMENT, creada TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  espanol TEXT NOT NULL, purepecha TEXT NOT NULL, variante TEXT NOT NULL,
  comentario TEXT NOT NULL DEFAULT '', estado TEXT NOT NULL DEFAULT 'pendiente');
