"""Construcción determinista de paquetes de datos (base + una por variante)."""
import hashlib, json


def _dump(obj) -> bytes:
    return json.dumps(obj, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")


def construir(con, paquete_id: str) -> bytes:
    version = con.execute("SELECT version FROM paquetes WHERE id=?", (paquete_id,)).fetchone()["version"]
    if paquete_id == "base":
        conceptos = [
            {"id": r["id"], "tipo": r["tipo"], "categoria": r["categoria"],
             "es": [s.strip() for s in r["es"].split("|") if s.strip()], "nota": r["nota"]}
            for r in con.execute("SELECT * FROM conceptos ORDER BY id")]
        variante = "general"
    else:
        conceptos, variante = [], paquete_id
    formas = [
        {"id": f"f{r['id']:05d}", "conceptoId": r["concepto_id"], "variante": r["variante"],
         "texto": r["texto"], "estado": r["estado"], "fuente": r["fuente"]}
        for r in con.execute("SELECT * FROM formas WHERE variante=? ORDER BY id", (variante,))]
    return _dump({"id": paquete_id, "version": version, "conceptos": conceptos, "formas": formas})


def manifiesto(con) -> bytes:
    items = []
    for r in con.execute("SELECT id FROM paquetes ORDER BY id"):
        cuerpo = construir(con, r["id"])
        datos = json.loads(cuerpo)
        items.append({"id": r["id"], "version": datos["version"], "sha256": hashlib.sha256(cuerpo).hexdigest(),
                      "bytes": len(cuerpo), "formas": len(datos["formas"])})
    return _dump({"formato": 1, "paquetes": items})
