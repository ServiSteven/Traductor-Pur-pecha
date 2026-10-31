"""API de sincronización (FastAPI). Sirve manifiesto y paquetes; recibe sugerencias moderadas."""
import hmac, os, time
from collections import defaultdict, deque
from fastapi import Depends, FastAPI, Header, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel, Field, field_validator
from . import db, paquetes

ORIGENES = [o for o in os.environ.get("PUREPECHA_CORS", "http://localhost:5173,http://localhost:4173").split(",") if o]
app = FastAPI(title="API Traductor Español–Purépecha", version="0.1.0", docs_url=None, redoc_url=None)
app.add_middleware(CORSMiddleware, allow_origins=ORIGENES, allow_methods=["GET", "POST"],
                   allow_headers=["Content-Type", "X-Admin-Token"])


def con_db():
    con = db.conectar()
    try:
        yield con
    finally:
        con.close()


@app.middleware("http")
async def cabeceras_seguras(request: Request, call_next):
    resp = await call_next(request)
    resp.headers["X-Content-Type-Options"] = "nosniff"
    resp.headers["Cache-Control"] = "no-store"
    resp.headers["Referrer-Policy"] = "no-referrer"
    return resp


# Limitador sencillo en memoria (por IP) para el endpoint público de escritura.
_ventana: dict[str, deque] = defaultdict(deque)
def limitar(request: Request, maximo=10, segundos=60):
    ip = request.client.host if request.client else "?"
    q, ahora = _ventana[ip], time.time()
    while q and ahora - q[0] > segundos:
        q.popleft()
    if len(q) >= maximo:
        raise HTTPException(429, "Demasiadas solicitudes")
    q.append(ahora)


def admin(x_admin_token: str = Header(default="")):
    esperado = os.environ.get("PUREPECHA_ADMIN_TOKEN", "")
    if not esperado or not hmac.compare_digest(x_admin_token.encode(), esperado.encode()):
        raise HTTPException(401, "No autorizado")


class Sugerencia(BaseModel):
    espanol: str = Field(min_length=1, max_length=120)
    purepecha: str = Field(min_length=1, max_length=120)
    variante: str
    comentario: str = Field(default="", max_length=500)

    @field_validator("variante")
    @classmethod
    def _v(cls, v):
        if v not in db.VARIANTES:
            raise ValueError("variante desconocida")
        return v

    @field_validator("espanol", "purepecha", "comentario")
    @classmethod
    def _limpiar(cls, v):
        if any(c in v for c in "<>\x00"):
            raise ValueError("caracteres no permitidos")
        return v.strip()


@app.get("/api/health")
def health():
    return {"ok": True}


@app.get("/api/manifest")
def manifest(con=Depends(con_db)):
    return Response(paquetes.manifiesto(con), media_type="application/json")


@app.get("/api/paquetes/{pid}")
def paquete(pid: str, con=Depends(con_db)):
    if pid not in db.PAQUETES:
        raise HTTPException(404, "Paquete inexistente")
    return Response(paquetes.construir(con, pid), media_type="application/json")


@app.post("/api/sugerencias", status_code=201)
def sugerir(s: Sugerencia, request: Request, con=Depends(con_db)):
    limitar(request)
    con.execute("INSERT INTO sugerencias(espanol,purepecha,variante,comentario) VALUES(?,?,?,?)",
                (s.espanol, s.purepecha, s.variante, s.comentario))
    con.commit()
    return {"recibida": True, "estado": "pendiente de validación"}


@app.get("/api/admin/sugerencias", dependencies=[Depends(admin)])
def listar(con=Depends(con_db)):
    return [dict(r) for r in con.execute("SELECT * FROM sugerencias ORDER BY id DESC LIMIT 200")]


@app.post("/api/admin/formas/{forma_id}/validar", dependencies=[Depends(admin)])
def validar(forma_id: int, con=Depends(con_db)):
    fila = con.execute("SELECT variante FROM formas WHERE id=?", (forma_id,)).fetchone()
    if not fila:
        raise HTTPException(404, "Forma inexistente")
    con.execute("UPDATE formas SET estado='validado' WHERE id=?", (forma_id,))
    pid = "base" if fila["variante"] == "general" else fila["variante"]
    con.execute("UPDATE paquetes SET version=version+1 WHERE id=?", (pid,))
    con.commit()
    return {"validada": forma_id, "paquete": pid}
