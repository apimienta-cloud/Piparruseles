/* Motor de placas Tiendas Montevideo: Excel -> productos -> SVG (feed / story). Sin dependencias de UI. */
const Motor = (function () {
  let D = null; // datos: config, logo, titulos, encuadres
  const MESES = ["", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

  function init(datos) { D = datos; }
  const cfg = () => D.config;

  function norm(s) {
    return String(s == null ? "" : s).normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase()
      .replace(/[^a-z0-9]+/g, " ").trim();
  }
  const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const redondear = x => Math.floor(Number(x) + 0.5 + 1e-9);
  const fmtPrecio = n => "$" + String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const num = v => Math.round(v * 100) / 100; // para que el SVG quede prolijo

  // ------------------------------------------------------------------ Excel
  const VARIANTES = [
    [/\s+(\d+(?:[.,]\d+)?)\s*[x×X*]\s*(\d+(?:[.,]\d+)?)\s*(?:cm)?\s*$/, m => `${m[1]} x ${m[2]}`],
    [/\s+(\d+(?:[.,]5)?|\d\s*1\/2|\d\s*½)\s*P(?:l(?:aza)?s?)?\.?\s*$/i, m => plazas(m[1])],
    [/\s+(plaza\s+y\s+media|una\s+plaza|dos\s+plazas|\d+(?:[.,]5)?\s+plazas?)\s*$/i, m => plazas(m[1])],
    [/\s+(?:Ø|diam(?:etro)?\.?)?\s*(\d+(?:[.,]\d+)?)\s*(?:cm)?\s*$/i, m => `Diámetro ${m[1]}`],
  ];
  function plazas(t) {
    t = norm(t).replace(/plazas?/, "").trim();
    let n;
    if (t === "y media" || t === "una y media") n = 1.5;
    else if (t === "una") n = 1;
    else if (t === "dos") n = 2;
    else if (/^\d\s*1\s*2$|^\d 5$/.test(t)) n = Number(t[0]) + 0.5;  // "1 1/2", "1.5" (norm deja "1 5")
    else n = Number(t.replace(",", "."));
    const txt = Number.isInteger(n) ? String(n) : `${Math.floor(n)} 1/2`;
    return `${txt} Plaza${n === 1 ? "" : "s"}`;
  }

  // tamaños con palabras: solo se usan para agrupar cuando hay 2+ filas que difieren únicamente en esa palabra
  const TALLAS = {
    chico: "Chico", chica: "Chica", ch: "Chico", pequeno: "Pequeño", pequena: "Pequeña", peq: "Pequeño", mini: "Mini",
    mediano: "Mediano", mediana: "Mediana", med: "Mediano", md: "Mediano",
    grande: "Grande", gde: "Grande", grd: "Grande", extragrande: "Extra Grande",
    twin: "Twin", full: "Full",
    xs: "XS", s: "S", m: "M", l: "L", xl: "XL", xxl: "XXL",
  };
  /** busca la última palabra de tamaño en el nombre: devuelve {resto, talla} o null */
  function separarTalla(base) {
    const w = String(base).split(/\s+/);
    const junta = [];
    for (let i = 0; i < w.length; i++) {
      const a = norm(w[i]), b = i + 1 < w.length ? norm(w[i + 1]) : "";
      if (a === "extra" && b === "grande") { junta.push([w[i] + " " + w[i + 1], a + b]); i++; }
      else junta.push([w[i], a]);
    }
    for (let i = junta.length - 1; i >= 0; i--) {
      if (TALLAS[junta[i][1]] && junta.length > 1) {
        return { resto: junta.filter((_, j) => j !== i).map(x => x[0]).join(" "), talla: TALLAS[junta[i][1]] };
      }
    }
    return null;
  }

  // medidas de cama: siempre son medida (como las plazas), aunque haya un solo tamaño
  const CAMA = { queen: "Queen", king: "King", superking: "Super King", extraking: "Extra King", californiaking: "California King",
    kingsize: "King", queensize: "Queen", matrimonial: "Matrimonial" };
  function separarCama(base) {
    const w = String(base).split(/\s+/);
    for (let i = w.length - 1; i >= 0; i--) {
      const a = norm(w[i]), prev = i > 0 ? norm(w[i - 1]) : "", next = i + 1 < w.length ? norm(w[i + 1]) : "";
      let k = null, desde = i, hasta = i;
      if (a === "king" && ["super", "extra", "california"].includes(prev)) { k = prev + "king"; desde = i - 1; }
      else if (CAMA[a]) k = a;
      if (!k) continue;
      if (next === "size") hasta = i + 1;
      const resto = w.filter((_, j) => j < desde || j > hasta).join(" ").trim();
      if (!resto) return null;
      return { resto, talla: CAMA[k] };
    }
    return null;
  }

  function separarVariante(desc) {
    desc = String(desc).replace(/\s+/g, " ").trim();
    for (const [rx, f] of VARIANTES) {
      const m = desc.match(rx);
      if (m) return [desc.slice(0, m.index).trim(), f(m)];
    }
    return [desc, null];
  }

  /** filas = array de arrays (sheet_to_json header:1) */
  function leerFilas(filas) {
    let hdr = -1;
    for (let i = 0; i < filas.length; i++) {
      if ((filas[i] || []).some(v => norm(v).startsWith("descrip"))) { hdr = i; break; }
    }
    if (hdr < 0) throw new Error("No encontré la fila de encabezado con 'Descripción' en el Excel.");
    const encabezado = filas.slice(0, hdr).flat().filter(v => v != null && v !== "").join(" ");
    const cols = {};
    (filas[hdr] || []).forEach((v, j) => { if (v != null && v !== "") cols[norm(v)] = j; });
    const k = Object.keys(cols);
    const cDesc = cols[k.find(x => x.startsWith("descrip"))];
    const kRed = k.find(x => x.includes("redond") || x.includes("oferta") || x.includes("promo"));
    const cRed = kRed != null ? cols[kRed] : null;
    const kPre = k.find(x => x.startsWith("precio") && cols[x] !== cRed);
    const cPre = cols[kPre];
    const kNro = k.find(x => ["nro", "n", "numero", "no"].includes(x));
    const cNro = kNro != null ? cols[kNro] : null;
    const out = [];
    for (const r of filas.slice(hdr + 1)) {
      if (!r) continue;
      const d = r[cDesc], p = r[cPre];
      if (d == null || d === "" || p == null || p === "" || isNaN(Number(p))) continue;
      const precio = redondear(p);
      const oferta = cRed != null && r[cRed] != null && r[cRed] !== "" && !isNaN(Number(r[cRed])) ? redondear(r[cRed]) : null;
      const nro = cNro != null && r[cNro] != null && !isNaN(Number(r[cNro])) ? Number(r[cNro]) : out.length + 1;
      let [base, variante] = separarVariante(d);
      const cama = separarCama(base);
      if (cama) { base = cama.resto; variante = variante ? `${cama.talla} ${variante}` : cama.talla; }
      out.push({ nro, desc: String(d).trim(), base, variante, precio, oferta });
    }
    agruparTallas(out);
    return { encabezado, filas: out };
  }

  /** Si 2+ filas tienen el mismo nombre salvo una palabra de tamaño (Chico/Grande, Queen/King…), pasan a ser variantes */
  function agruparTallas(filas) {
    const claves = {};
    filas.forEach((f, i) => {
      const t = separarTalla(f.base);
      if (!t) return;
      const k = norm(t.resto);
      (claves[k] = claves[k] || []).push({ i, t });
    });
    // un producto con el mismo nombre pero sin tamaño ni medida es otro producto: no mezclar
    const basesSinTalla = new Set(filas.filter(f => !separarTalla(f.base) && !f.variante).map(f => norm(f.base)));
    for (const k in claves) {
      const g = claves[k];
      if (g.length < 2 || basesSinTalla.has(k)) continue;
      if (new Set(g.map(x => x.t.talla + "|" + (filas[x.i].variante || ""))).size < g.length) continue; // tallas repetidas: no es un tamaño
      for (const { i, t } of g) {
        const f = filas[i];
        f.base = t.resto;
        f.variante = f.variante ? `${t.talla} ${f.variante}` : t.talla;
      }
    }
  }

  function agrupar(filas) {
    const grupos = [], idx = {};
    for (const f of filas) {
      const k = norm(f.base);
      if (!(k in idx)) { idx[k] = grupos.length; grupos.push({ base: f.base, nros: [], variantes: [] }); }
      const g = grupos[idx[k]];
      g.nros.push(f.nro);
      g.variantes.push({ precio: f.precio, oferta: f.oferta, variante: f.variante });
    }
    return grupos;
  }

  function fechaHasta(enc) {
    const m = String(enc).match(/al\s+(\d{1,2})\s*\/\s*(\d{1,2})/i);
    return m ? [`Hasta el ${Number(m[1])}`, `de ${MESES[Number(m[2])]}`] : ["", ""];
  }

  function porcentaje(filas) {
    const d = filas.filter(f => f.oferta).map(f => 1 - f.oferta / f.precio);
    return d.length ? Math.round(d.reduce((a, b) => a + b, 0) / d.length * 100) : 0;
  }

  // ------------------------------------------------------------------ títulos
  const CONECTORES = new Set(["de", "para", "con", "sin", "y", "en"]);
  function partirTitulo(base, memoria) {
    const k = norm(base);
    const tabla = Object.assign({}, D.titulos, memoria || {});
    for (const n in tabla) if (norm(n) === k) return { l1: tabla[n][0], l2: tabla[n][1], auto: false };
    const w = base.split(/\s+/);
    if (w.length === 1) return { l1: "", l2: w[0], auto: true };
    let n = 1;
    if (w[w.length - 1].length <= 4 && w.length >= 3) n = 2;
    if (w.length - n >= 1 && CONECTORES.has(norm(w[w.length - n - 1])) && w.length - n - 1 >= 2) n += 1;
    return { l1: w.slice(0, -n).join(" "), l2: w.slice(-n).join(" "), auto: true };
  }

  // ------------------------------------------------------------------ fotos
  function emparejar(grupos, archivos) {
    const usados = new Set(), res = {};
    const portada = archivos.find(f => norm(f.replace(/\.[^.]+$/, "")).includes("portada")) || null;
    if (portada) usados.add(portada);
    const punt = [];
    grupos.forEach((g, gi) => {
      const tb = new Set(norm(g.base).split(" "));
      for (const f of archivos) {
        if (usados.has(f)) continue;
        const stem = norm(f.replace(/\.[^.]+$/, ""));
        const nm = stem.match(/^(\d+)\b/);
        // "3.jpg", "3 16020920000000.jpg", "03 - barrote.jpg": empieza con el Nro del Excel
        if (nm && g.nros.includes(Number(nm[1]))) { punt.push([3 - g.nros.indexOf(Number(nm[1])) * 0.01, gi, f]); continue; }
        const tf = new Set(stem.split(" ").filter(t => t && !/^\d+$/.test(t)));
        if (!tf.size) continue;
        let inter = 0; tf.forEach(t => { if (tb.has(t)) inter++; });
        let s = inter / tf.size * 0.7 + inter / tb.size * 0.3;
        if (nm && g.nros.includes(Number(nm[1]))) s += 1;
        punt.push([s, gi, f]);
      }
    });
    punt.sort((a, b) => b[0] - a[0]);
    for (const [s, gi, f] of punt) {
      if (s < 0.45 || gi in res || usados.has(f)) continue;
      res[gi] = f; usados.add(f);
    }
    return { asignadas: res, portada };
  }

  function encuadreGuardado(nombre, fmt, memoria) {
    const k = norm(nombre);
    if (memoria && memoria[k + "|" + fmt]) return memoria[k + "|" + fmt];
    const e = D.encuadres.find(e => norm(e.nombre) === k && e.formato === fmt);
    return e ? { espejo: e.espejo, zoom: e.zoom, x: e.x, y: e.y } : null;
  }

  /** encuadre -> {s, x, y, espejo} en px del lienzo. enc: {zoom,x,y,espejo}; encFeed para derivar story. */
  function calcularEncuadre(iw, ih, W, H, enc, encFeed) {
    const cover = Math.max(W / iw, H / ih);
    if (enc) return { s: cover * enc.zoom, x: enc.x, y: enc.y, espejo: !!enc.espejo };
    if (encFeed) {
      const fW = 1080, fH = 1350, fcover = Math.max(fW / iw, fH / ih);
      const fz = encFeed.zoom, fs = fcover * fz;
      const z = fz < 1 ? fz : 1 + (fz - 1) * 0.5;
      const s = cover * z, nw = iw * s, nh = ih * s;
      const u = (fW / 2 - encFeed.x) / fs;
      let x = W / 2 - u * s;
      x = nw >= W ? Math.min(0, Math.max(W - nw, x)) : (W - nw) / 2;
      let y;
      if (encFeed.y > 0) y = H - nh;
      else {
        const rel = Math.abs(fH - fs * ih) > 1 ? encFeed.y / (fH - fs * ih) : 0.5;
        y = rel * (H - nh);
      }
      return { s, x, y, espejo: !!encFeed.espejo };
    }
    const s = cover;
    return { s, x: -(iw * s - W) / 2, y: -(ih * s - H) / 2, espejo: false };
  }
  /** pasa de {s,x,y} a lo que se guarda (zoom relativo al "cubrir") */
  function aGuardar(iw, ih, W, H, fr) {
    const cover = Math.max(W / iw, H / ih);
    return { zoom: num(fr.s / cover * 1000) / 1000, x: num(fr.x), y: num(fr.y), espejo: !!fr.espejo };
  }
  function cubre(iw, ih, W, H, fr) {
    return fr.x <= 0.5 && fr.y <= 0.5 && fr.x + iw * fr.s >= W - 0.5 && fr.y + ih * fr.s >= H - 0.5;
  }

  // ------------------------------------------------------------------ SVG
  function font(rol, tam, preview) {
    const f = cfg().fuentes[rol];
    const fam = preview ? f.preview_web : f.illustrator;
    return `font-family="${esc(fam)}" font-size="${num(tam)}" font-weight="${f.peso}" font-style="${f.estilo}"`;
  }

  function capaTitulo(L, l1, l2, pv) {
    const T = L.titulo, bl = cfg().colores.blanco;
    let s = "";
    if (l1) s += `<text x="${T.x}" y="${T.base1}" fill="${bl}" ${font("titulo_sans", T.tam1, pv)}>${esc(l1)}</text>\n`;
    s += `<text x="${T.x}" y="${T.base2}" fill="${bl}" ${font("titulo_serif", T.tam2, pv)}>${esc(l2)}</text>`;
    return `<g id="Titulo">\n${s}\n</g>`;
  }

  function capaPrecios(L, variantes, pv) {
    const P = L.precios, C = cfg().colores, n = variantes.length, out = [];
    variantes.forEach((v, i) => {
      const top = P.caja_top_ultima - (n - 1 - i) * P.paso;
      const conOferta = v.oferta != null && v.oferta !== "" && Number(v.oferta) !== Number(v.precio);
      const nuevo = fmtPrecio(conOferta ? v.oferta : v.precio);
      const viejo = conOferta ? fmtPrecio(v.precio) : null;
      const largo = Math.max(nuevo.length, (viejo || "").length);
      const p = Object.assign({}, largo <= 4 ? P.corta : P.larga);
      const extra = Math.max(0, largo - 6) * 0.6 * P.tam_tachado;
      p.ancho += extra * 1.6; p.verde_fin += extra * 0.6; p.tachado_x1 += extra * 0.6; p.tachado_x2 += extra * 1.6;
      const x0 = P.caja_x, w = p.ancho, base = top + P.base_offset;
      let g = `<rect x="${x0}" y="${top}" width="${num(w)}" height="${P.caja_alto}" rx="${P.radio}" fill="${C.caja_relleno}" fill-opacity="${C.caja_opacidad}" stroke="${C.blanco}" stroke-width="${P.trazo}"/>\n`;
      if (viejo) {
        g += `<text x="${num(x0 + p.verde_fin)}" y="${base}" text-anchor="end" fill="${C.verde}" ${font("precio", P.tam_precio, pv)}>${esc(nuevo)}</text>\n`;
        const t1 = x0 + p.tachado_x1, t2 = x0 + p.tachado_x2, ty = top + P.tachado_y_offset;
        g += `<text x="${num((t1 + t2) / 2)}" y="${base}" text-anchor="middle" fill="${C.blanco}" ${font("precio", P.tam_tachado, pv)}>${esc(viejo)}</text>\n`;
        g += `<line x1="${num(t1)}" y1="${num(ty)}" x2="${num(t2)}" y2="${num(ty)}" stroke="${C.blanco}" stroke-width="${P.grosor_tachado}"/>\n`;
      } else {
        g += `<text x="${num(x0 + w / 2)}" y="${base}" text-anchor="middle" fill="${C.verde}" ${font("precio", P.tam_precio, pv)}>${esc(nuevo)}</text>\n`;
      }
      if (v.variante) g += `<text x="${num(x0 + w / 2)}" y="${top + P.medida_offset}" text-anchor="middle" fill="${C.blanco}" ${font("medida", P.tam_medida, pv)}>${esc(v.variante)}</text>\n`;
      out.push(`<g id="Precio_${i + 1}">\n${g}</g>`);
    });
    return `<g id="Precios">\n${out.join("\n")}\n</g>`;
  }

  function capaPortada(L, d, pv) {
    const C = cfg().colores, b = L.portada.base, numTxt = String(d.pct);
    const fin = 467 + (numTxt.length - 2) * 145, lx = fin + 20, tx = fin + 40;
    let s = `<text x="${fin}" y="${b}" text-anchor="end" fill="${C.verde}" ${font("portada_num", 418, pv)}>${esc(numTxt)}</text>\n`;
    s += `<text x="${fin - 2}" y="${b - 216}" fill="${C.verde}" ${font("portada_num", 92, pv)}>%</text>\n`;
    s += `<line x1="${lx}" y1="${b - 205}" x2="${lx}" y2="${b - 2}" stroke="${C.verde}" stroke-width="2.5"/>\n`;
    s += `<text x="${tx}" y="${b - 166}" fill="${C.blanco}" ${font("portada_sans", 47, pv)}>${esc(d.linea1)}</text>\n`;
    s += `<text x="${tx}" y="${b - 103}" fill="${C.blanco}" ${font("titulo_serif", 69, pv)}>${esc(d.linea2)}</text>\n`;
    if (d.fecha1) s += `<text x="${tx}" y="${b - 50}" fill="${C.verde}" ${font("portada_sans", 51, pv)}>${esc(d.fecha1)}</text>\n`;
    if (d.fecha2) s += `<text x="${tx}" y="${b - 3}" fill="${C.verde}" ${font("portada_sans", 51, pv)}>${esc(d.fecha2)}</text>`;
    return `<g id="Portada">\n${s}\n</g>`;
  }

  function capaLogo(L) {
    const lg = L.logo, vb = D.logo.vb, k = lg.ancho / vb[2];
    return `<g id="Logo">\n<g transform="translate(${lg.x},${lg.y}) scale(${k.toFixed(5)}) translate(${-vb[0]},${-vb[1]})">${D.logo.inner}</g>\n</g>`;
  }

  /**
   * placa: {tipo:'producto'|'portada', l1,l2,variantes | pct,linea1,linea2,fecha1,fecha2}
   * foto: null | {href, x, y, w, h, extHref}  (href/extHref = data URL)
   * preview: true usa fuentes web y omite la foto si foto===null
   */
  function svg(fmt, placa, foto, preview) {
    const L = cfg().formatos[fmt], W = L.ancho, H = L.alto, capas = [];
    if (foto) {
      let f = `<clipPath id="recorte"><rect width="${W}" height="${H}"/></clipPath>\n<g clip-path="url(#recorte)">\n`;
      if (foto.extHref) f += `<image id="Fondo_extendido" width="${W}" height="${H}" xlink:href="${foto.extHref}"/>\n`;
      f += `<image id="Foto_producto" x="${num(foto.x)}" y="${num(foto.y)}" width="${num(foto.w)}" height="${num(foto.h)}" preserveAspectRatio="none" xlink:href="${foto.href}"/>\n</g>`;
      capas.push(`<g id="Foto">\n${f}\n</g>`);
    } else if (!preview) {
      capas.push(`<g id="Foto">\n<rect width="${W}" height="${H}" fill="#9a958f"/>\n</g>`);
    }
    if (placa.tipo === "portada") {
      capas.push(capaPortada(L, placa, preview));
      if (L.portada.logo) capas.push(capaLogo(L));
    } else {
      capas.push(capaTitulo(L, placa.l1, placa.l2, preview));
      capas.push(capaPrecios(L, placa.variantes, preview));
      capas.push(capaLogo(L));
    }
    return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}px" height="${H}px" viewBox="0 0 ${W} ${H}">\n${capas.join("\n")}\n</svg>\n`;
  }

  function slug(s) {
    return String(s).normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  }

  return { init, norm, redondear, fmtPrecio, separarVariante, separarTalla, agruparTallas, leerFilas, agrupar, fechaHasta, porcentaje, partirTitulo,
    emparejar, encuadreGuardado, calcularEncuadre, aGuardar, cubre, svg, slug, cfg: () => D.config };
})();
if (typeof module !== "undefined") module.exports = Motor;
