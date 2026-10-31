"""Respaldo en caliente de la base (API de backup de SQLite). Uso: python -m api.backup [destino]"""
import sqlite3, sys, datetime
from . import db
dest = sys.argv[1] if len(sys.argv) > 1 else f"respaldo-{datetime.date.today()}.sqlite"
src, out = db.conectar(), sqlite3.connect(dest)
src.backup(out); out.close(); src.close()
print("Respaldo creado:", dest)
