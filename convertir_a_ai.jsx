// Junta todas las placas (SVG) de una carpeta en UN SOLO archivo .ai,
// con una mesa de trabajo por placa (feed y story una al lado de la otra) y una capa por producto.
// Uso en Illustrator: Archivo > Secuencias de comandos > Otra secuencia de comandos... (Ctrl+F12)
#target illustrator
(function () {
    var carpeta = Folder.selectDialog("Elegí la carpeta con los SVG de las placas");
    if (!carpeta) return;
    var archivos = carpeta.getFiles("*.svg");
    if (!archivos.length) { alert("No hay archivos .svg en esa carpeta.\nAcordate de descomprimir el .zip primero."); return; }
    archivos.sort(function (a, b) {
        var x = decodeURI(a.name), y = decodeURI(b.name);
        return x < y ? -1 : (x > y ? 1 : 0);
    });

    // agrupar feed / story de cada placa
    var placas = [], idx = {}, hayFeed = false, hayStory = false;
    for (var i = 0; i < archivos.length; i++) {
        var nom = decodeURI(archivos[i].name).replace(/\.svg$/i, "");
        var m = nom.match(/^(.*)_(feed|story)$/i);
        var base = m ? m[1] : nom, fmt = m ? m[2].toLowerCase() : "feed";
        if (!idx.hasOwnProperty(base)) { idx[base] = placas.length; placas.push({ base: base, feed: null, story: null }); }
        placas[idx[base]][fmt] = archivos[i];
        if (fmt == "feed") hayFeed = true; else hayStory = true;
    }

    // grilla: cada celda = feed + story lado a lado
    var W = 1080, HF = 1350, HS = 1920, GAP = 100, SEP = 300, MAXCANVAS = 15000;
    // posición exacta del logo (esquina superior izquierda, medida desde la esquina superior izquierda de la mesa)
    // tomada del archivo "Ubicación Logo.ai"
    var LOGO = { feed: [347.316, 1250], story: [610.624, 158.91] };
    var buscar = function (cont, nombre) {
        for (var q = 0; q < cont.pageItems.length; q++) {
            var it = cont.pageItems[q];
            if (it.name == nombre) return it;
            if (it.typename == "GroupItem") { var r = buscar(it, nombre); if (r) return r; }
        }
        return null;
    };
    var cellW = (hayFeed ? W : 0) + (hayFeed && hayStory ? GAP : 0) + (hayStory ? W : 0);
    var cellH = Math.max(hayFeed ? HF : 0, hayStory ? HS : 0);
    var cols = Math.max(1, Math.min(placas.length, Math.floor((MAXCANVAS + SEP) / (cellW + SEP))));
    var rows = Math.ceil(placas.length / cols);
    var totalW = cols * cellW + (cols - 1) * SEP;
    var totalH = rows * cellH + (rows - 1) * SEP;
    if (totalH > MAXCANVAS) {
        alert("Son demasiadas placas para un solo archivo (" + placas.length + ").\nDividí los SVG en dos carpetas y corré el script en cada una.");
        return;
    }

    var nivel = app.userInteractionLevel;
    app.userInteractionLevel = UserInteractionLevel.DONTDISPLAYALERTS;
    var sistema = app.coordinateSystem;
    app.coordinateSystem = CoordinateSystem.DOCUMENTCOORDINATESYSTEM;

    var doc = app.documents.add(DocumentColorSpace.RGB, W, HF);
    var capaInicial = doc.layers[0];
    var r0 = doc.artboards[0].artboardRect; // [izq, arriba, der, abajo]
    var cx = (r0[0] + r0[2]) / 2, cy = (r0[1] + r0[3]) / 2;
    var izq0 = cx - totalW / 2, arr0 = cy + totalH / 2;

    var n = 0, errores = [], primera = true;
    for (var p = 0; p < placas.length; p++) {
        var col = p % cols, fila = Math.floor(p / cols);
        var x0 = izq0 + col * (cellW + SEP), y0 = arr0 - fila * (cellH + SEP);
        var capa = doc.layers.add();
        capa.name = placas[p].base;
        var lista = [];
        if (placas[p].feed) lista.push(["feed", placas[p].feed]);
        if (placas[p].story) lista.push(["story", placas[p].story]);
        for (var f = 0; f < lista.length; f++) {
            var fmt = lista[f][0], archivo = lista[f][1];
            var alto = fmt == "feed" ? HF : HS;
            var izq = x0 + ((fmt == "story" && hayFeed) ? W + GAP : 0);
            var rect = [izq, y0, izq + W, y0 - alto];
            try {
                var src = app.open(archivo);
                app.coordinateSystem = CoordinateSystem.DOCUMENTCOORDINATESYSTEM;
                var sr = src.artboards[0].artboardRect;
                // juntar todo lo de la placa en un grupo, respetando el orden de apilado
                var items = [];
                var juntar = function (lay) {
                    lay.locked = false; lay.visible = true;
                    for (var k = 0; k < lay.pageItems.length; k++) items.push(lay.pageItems[k]);
                    for (var s = 0; s < lay.layers.length; s++) juntar(lay.layers[s]);
                };
                for (var L = 0; L < src.layers.length; L++) juntar(src.layers[L]);
                // rectángulo invisible del tamaño exacto de la mesa: sirve de referencia para ubicar la placa
                var ref = src.layers[0].pathItems.rectangle(sr[1], sr[0], sr[2] - sr[0], sr[1] - sr[3]);
                ref.filled = false; ref.stroked = false; ref.name = "__ref_mesa";
                items.push(ref);
                var g = src.layers[0].groupItems.add();
                for (var k2 = items.length - 1; k2 >= 0; k2--) items[k2].move(g, ElementPlacement.PLACEATBEGINNING);
                var dup = g.duplicate(capa, ElementPlacement.PLACEATEND);
                // Illustrator conserva la posición del archivo original: medir la referencia y alinearla a la mesa nueva
                var refDup = dup.pageItems.getByName("__ref_mesa");
                var gb = refDup.geometricBounds; // [izq, arriba, der, abajo]
                dup.translate(rect[0] - gb[0], rect[1] - gb[1]);
                refDup.remove();
                // logo: ubicarlo exacto según el archivo de referencia (mismas medidas que el panel Transformar)
                var logo = buscar(dup, "Logo");
                if (logo) logo.position = [rect[0] + LOGO[fmt][0], rect[1] - LOGO[fmt][1]];
                dup.name = placas[p].base + "_" + fmt;
                src.close(SaveOptions.DONOTSAVECHANGES);
                app.activeDocument = doc;

                var ab;
                if (primera) { ab = doc.artboards[0]; ab.artboardRect = rect; primera = false; }
                else ab = doc.artboards.add(rect);
                ab.name = placas[p].base + "_" + fmt;
                n++;
            } catch (e) {
                errores.push(decodeURI(archivo.name) + ": " + e);
                try { if (app.activeDocument != doc) app.activeDocument.close(SaveOptions.DONOTSAVECHANGES); } catch (e2) {}
                app.activeDocument = doc;
            }
        }
    }
    try { if (capaInicial.pageItems.length == 0) capaInicial.remove(); } catch (e3) {}

    var salida = new File(carpeta.fsName + "/" + decodeURI(carpeta.name) + ".ai");
    var opts = new IllustratorSaveOptions();
    opts.pdfCompatible = true;
    doc.saveAs(salida, opts);

    app.coordinateSystem = sistema;
    app.userInteractionLevel = nivel;
    app.executeMenuCommand("fitall");
    alert(n + " mesas de trabajo guardadas en:\n" + salida.fsName + (errores.length ? "\n\nErrores:\n" + errores.join("\n") : ""));
})();
