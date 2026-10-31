"""Exporta el paquete de instalación (snapshot) que se empaqueta con la PWA."""
import sys
from pathlib import Path
from . import db, paquetes

destino = Path(sys.argv[1] if len(sys.argv) > 1 else db.ROOT / "app" / "public" / "data")
destino.mkdir(parents=True, exist_ok=True)
con = db.inicializar()
for pid in db.PAQUETES:
    (destino / f"paquete-{pid}.json").write_bytes(paquetes.construir(con, pid))
(destino / "manifest.json").write_bytes(paquetes.manifiesto(con))
print("Snapshot exportado en", destino)
