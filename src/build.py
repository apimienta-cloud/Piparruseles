"""Arma ../index.html (un solo archivo, funciona sin internet) a partir de app.html + engine.js + datos.json.
Requisitos: Python 3 y `npm install` en esta carpeta (baja SheetJS y JSZip)."""
import json, os
B = os.path.dirname(os.path.abspath(__file__))
P = lambda *a: os.path.join(B, *a)
leer = lambda p: open(p, encoding="utf-8").read()
safe = lambda js: js.replace("</script", "<\\/script")
h = leer(P("app.html"))
partes = {
    "/*XLSX*/": safe(leer(P("node_modules", "xlsx", "dist", "xlsx.core.min.js"))),
    "/*JSZIP*/": safe(leer(P("node_modules", "jszip", "dist", "jszip.min.js"))),
    "/*ENGINE*/": safe(leer(P("engine.js"))),
    "/*DATOS*/": json.dumps(json.load(open(P("datos.json"), encoding="utf-8")), ensure_ascii=False).replace("</", "<\\/"),
    "/*JSX*/": json.dumps(leer(P("..", "convertir_a_ai.jsx")), ensure_ascii=False).replace("</", "<\\/"),
}
for k, v in partes.items():
    assert h.count(k) == 1, k
    h = h.replace(k, v)
open(P("..", "index.html"), "w", encoding="utf-8").write(h)
print("index.html:", len(h) // 1024, "KB")
