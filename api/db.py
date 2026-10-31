"""Acceso a SQLite (prototipo). En producción: PostgreSQL con el mismo esquema."""
import csv, os, sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DB_PATH = Path(os.environ.get("PUREPECHA_DB", ROOT / "api" / "purepecha.sqlite"))
CSV_PATH = ROOT / "data" / "lexicon.csv"
VARIANTES = ["sierra", "canada", "lago", "cienega"]
PAQUETES = ["base"] + VARIANTES


def conectar(path=None):
    con = sqlite3.connect(str(path or DB_PATH))
    con.row_factory = sqlite3.Row
    con.execute("PRAGMA foreign_keys=ON")
    return con


def inicializar(path=None, csv_path=CSV_PATH):
    """Crea el esquema y carga el CSV (idempotente)."""
    con = conectar(path)
    con.executescript((ROOT / "api" / "schema.sql").read_text(encoding="utf-8"))
    with open(csv_path, encoding="utf-8", newline="") as fh:
        for r in csv.DictReader(fh):
            con.execute(
                "INSERT OR IGNORE INTO conceptos(id,tipo,categoria,es,nota) VALUES(?,?,?,?,?)",
                (r["id"], r["tipo"], r["categoria"], r["espanol"], r.get("nota", "")))
            if r["purepecha"].strip():
                con.execute(
                    "INSERT OR IGNORE INTO formas(concepto_id,variante,texto,estado,fuente) VALUES(?,?,?,?,?)",
                    (r["id"], r["variante"], r["purepecha"].strip(), r["estado"], r.get("fuente", "")))
    for p in PAQUETES:
        con.execute("INSERT OR IGNORE INTO paquetes(id,version) VALUES(?,1)", (p,))
    con.commit()
    return con
