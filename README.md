# Generador de placas · Tiendas Montevideo

Herramienta de **Wasabi** para armar las placas mensuales de rebajas de Tiendas Montevideo (feed 1080×1350 y story 1080×1920) a partir del Excel del cliente y las fotos de producto, y terminar en un único archivo de Illustrator.

**Usar online:** https://apimienta-cloud.github.io/Piparruseles/
(también se puede descargar `index.html` y abrirlo con doble clic: funciona sin internet).

> Las fotos y el Excel **no se suben a ningún lado**: todo se procesa en el navegador de quien lo usa.

## Cómo se usa

1. **Cargar Excel**: el del cliente, tal cual viene (.xls / .xlsx).
2. **Cargar fotos**: si el archivo empieza con el número de fila del Excel (`3 16020920000000.jpg`) o se llama como el producto, se asigna solo. Si no, en cada placa: **Cambiar foto**.
3. Revisar cada placa de la lista:
   - Arrastrar la foto para encuadrar; zoom con el control o **Ctrl + rueda**; **Espejar**; **Cubrir y centrar**.
   - Corregir títulos, precios o medidas si hace falta.
   - La **Portada** lleva foto elegida a mano.
4. **Descargar placas (.zip)**.
5. Descomprimir el zip. En Illustrator: **Archivo › Secuencias de comandos › Otra secuencia de comandos…** (Ctrl+F12) → `convertir_a_ai.jsx` → elegir la carpeta. Se arma **un solo .ai** con una mesa de trabajo por placa y una capa por producto.

## Qué hace solo

- Agrupa en una misma placa las variantes de un producto:
  - medidas: `130x150`, `Diámetro 38`
  - plazas: `1P`, `1.5P`, `2P`, "Plaza y media"
  - cama: Queen, King, Super King, Extra King, Matrimonial (y Twin / Full cuando hay más de un tamaño)
  - palabras: Chico, Mediano, Grande, etc. (solo cuando hay 2 o más tamaños del mismo producto)
- Redondea precios (.5 sube) con punto de miles, y arma la caja de precio con la plantilla corta (3 cifras) o larga (4 cifras).
- Calcula el % y la fecha de la portada desde el encabezado del Excel ("DEL 1 al 15/11" → "Hasta el 15 de Noviembre").
- Recuerda en cada computadora cómo se cortó cada título y cómo se encuadró cada foto (menú ⋯ › Exportar / Importar memoria para pasarla a otra persona).

## Especificaciones de la plantilla

| | Feed | Story |
|---|---|---|
| Título línea fina (Azo Sans Light) | 53 pt | 58,3 pt |
| Título línea itálica (Athelas Bold Italic) | 79 pt | 86,9 pt |
| Precio con descuento (Azo Sans Bold, verde #8BD30F) | 40 pt | 44 pt |
| Precio tachado (Azo Sans Bold) | 28 pt | 30,8 pt |
| Radio de la caja de precio | 12 px | 13,2 px |
| Logo (esquina sup. izq., desde la mesa) | X 347,316 · Y 1250 | X 610,624 · Y 158,91 |

Las fuentes (Adobe Fonts) no están incluidas: los SVG las piden por nombre y se ven al abrirlos en Illustrator. La vista previa del navegador usa fuentes parecidas.

## Para modificarlo

El código está en `src/`:

- `app.html`: interfaz (HTML/CSS/JS).
- `engine.js`: lógica (lectura del Excel, agrupación, precios, armado del SVG).
- `datos.json`: plantilla (tamaños, posiciones, colores, fuentes), logo, títulos y encuadres conocidos.
- `build.py`: arma `index.html` en un solo archivo.

```bash
cd src
npm install        # baja SheetJS y JSZip
python3 build.py   # genera ../index.html
```

`convertir_a_ai.jsx` (en la raíz) es el script de Illustrator; `build.py` lo mete adentro de `index.html` para que venga en cada zip.

## Librerías incluidas

- [SheetJS Community Edition](https://sheetjs.com) (Apache 2.0): lectura de Excel.
- [JSZip](https://stuk.github.io/jszip/) (MIT): armado del .zip.
