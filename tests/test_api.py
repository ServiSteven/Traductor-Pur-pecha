import hashlib, pytest
from fastapi.testclient import TestClient

@pytest.fixture()
def cliente(tmp_path, monkeypatch):
    monkeypatch.setenv("PUREPECHA_ADMIN_TOKEN", "secreto-de-prueba")
    from api import db
    monkeypatch.setattr(db, "DB_PATH", tmp_path / "t.sqlite")
    db.inicializar().close()
    from api.main import app, _ventana
    _ventana.clear()
    return TestClient(app)

def test_manifest_y_checksum(cliente):
    m = cliente.get("/api/manifest").json()
    assert {p["id"] for p in m["paquetes"]} == {"base", "sierra", "canada", "lago", "cienega"}
    for p in m["paquetes"]:
        r = cliente.get(f"/api/paquetes/{p['id']}")
        assert hashlib.sha256(r.content).hexdigest() == p["sha256"]

def test_paquete_base_contiene_formas_generales_por_validar(cliente):
    d = cliente.get("/api/paquetes/base").json()
    assert len(d["conceptos"]) == 18
    assert all(f["variante"] == "general" and f["estado"] == "por_validar" for f in d["formas"])

def test_paquetes_de_variante_no_mezclan_formas(cliente):
    for v in ("sierra", "lago"):
        d = cliente.get(f"/api/paquetes/{v}").json()
        assert all(f["variante"] == v for f in d["formas"])

def test_paquete_inexistente_404(cliente):
    assert cliente.get("/api/paquetes/otra").status_code == 404

def test_sugerencia_valida_y_rechazos(cliente):
    ok = {"espanol": "agua", "purepecha": "itsï", "variante": "lago"}
    assert cliente.post("/api/sugerencias", json=ok).status_code == 201
    assert cliente.post("/api/sugerencias", json={**ok, "variante": "marte"}).status_code == 422
    assert cliente.post("/api/sugerencias", json={**ok, "espanol": "<script>x</script>"}).status_code == 422
    assert cliente.post("/api/sugerencias", json={**ok, "comentario": "x" * 501}).status_code == 422

def test_limite_de_solicitudes(cliente):
    ok = {"espanol": "a", "purepecha": "b", "variante": "lago"}
    codigos = [cliente.post("/api/sugerencias", json=ok).status_code for _ in range(12)]
    assert codigos.count(429) >= 1

def test_admin_requiere_token(cliente):
    assert cliente.get("/api/admin/sugerencias").status_code == 401
    assert cliente.get("/api/admin/sugerencias", headers={"X-Admin-Token": "mal"}).status_code == 401
    assert cliente.get("/api/admin/sugerencias", headers={"X-Admin-Token": "secreto-de-prueba"}).status_code == 200

def test_validar_forma_incrementa_version(cliente):
    h = {"X-Admin-Token": "secreto-de-prueba"}
    antes = {p["id"]: p["version"] for p in cliente.get("/api/manifest").json()["paquetes"]}
    assert cliente.post("/api/admin/formas/1/validar", headers=h).status_code == 200
    despues = {p["id"]: p["version"] for p in cliente.get("/api/manifest").json()["paquetes"]}
    assert despues["base"] == antes["base"] + 1
    assert cliente.get("/api/paquetes/base").json()["formas"][0]["estado"] == "validado"

def test_cabeceras_de_seguridad(cliente):
    r = cliente.get("/api/health")
    assert r.headers["x-content-type-options"] == "nosniff"
