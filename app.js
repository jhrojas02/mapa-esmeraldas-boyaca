// Guía de exploración esmeraldífera · Occidente de Boyacá (Modelo A v2)
// Página estática: lee los datos de data/ y no envía nada a ningún servidor.
"use strict";

const ZONAS_CORTAS = ["Muy favorable", "Favorable", "No se sabe", "Poco favorable", "Nada favorable", "Sin evaluar"];
// Resultado en una frase, para leer de un vistazo (y para escuchar)
const VEREDICTO = [
  "Aquí el terreno se parece mucho a donde hay minas de esmeralda.",
  "Aquí el terreno se parece a donde hay minas, pero no es seguro.",
  "Con lo que se sabe hoy, el mapa no puede decir si aquí es bueno o malo.",
  "Aquí el terreno se parece poco a donde hay minas.",
  "Con lo que se sabe hoy, aquí es poco probable encontrar esmeralda.",
  "Aquí la roca es de tipo Peñas Blancas: el mapa no sabe evaluarla.",
];
// Términos técnicos de las explicaciones → palabras de mina
const SENCILLO = [
  [/la roca donde se forma la esmeralda \(Formación Muzo o Paja\)/g, "la tierra negra donde se forma la esmeralda (Formación Muzo)"],
  [/las formaciones Capotes o Furatena, que tocan a la roca de la esmeralda/g, "las rocas que tocan a la tierra negra (Capotes o Furatena)"],
  [/las formaciones que acompañan a la roca de la esmeralda/g, "las rocas que acompañan a la tierra negra"],
  [/por las fallas subieron los fluidos que formaron la esmeralda/g, "por las fallas subió el agua caliente que formó la esmeralda"],
  [/lejos de los caminos de los fluidos/g, "lejos de los caminos de esa agua"],
  [/por donde pudieron subir los fluidos/g, "por donde pudo subir esa agua"],
  [/por donde subieron los fluidos en Muzo y Coscuez/g, "por donde subió el agua que formó la esmeralda en Muzo y Coscuez"],
  [/ \(albitización\)/g, ""],
  [/la cresta de un pliegue \(anticlinal\)/g, "la cresta de un pliegue (donde las capas se doblan)"],
];
const EXPLICACION = [
  "Se parece mucho a donde hoy hay minas de esmeralda, y el mapa está muy seguro.",
  "Se parece a donde hay minas, pero el mapa está menos seguro.",
  "Con la información actual el mapa no puede decidir.",
  "Probablemente no es buen sitio, aunque el mapa no está del todo seguro.",
  "Con lo que se sabe hoy, es poco probable que sea buen sitio.",
  "Roca tipo Peñas Blancas (Formación Rosablanca): el mapa no sabe evaluarla.",
];
const CRITERIOS = {
  C: "cerca de la cresta de un pliegue (anticlinal) en roca favorable",
  F: "cerca de una falla",
  X: "cerca de un cruce de fallas",
  L: "sobre o junto a una fractura que se ve en el relieve (valle o quiebre recto)",
};
const ESTILO_CORREDOR = {
  prioritario: { color: "#7a0177", fillColor: "#f768a1", weight: 1.5, fillOpacity: 0.55 },
  secundario: { color: "#b8860b", fillColor: "#ffd92f", weight: 1, fillOpacity: 0.4 },
};
// Borde de cada línea para que se vea sobre el satélite (y no se confunda la falla con los límites municipales)
const BORDE_LINEA = { falla: "#ffffff", fractura: "#3a2a00", pliegue: "#00343a" };
// Líneas del mapa: solo 3 tipos, en palabras sencillas. Las demás (fracturas en otras direcciones, contactos) se
// omiten porque casi no pesan en el mapa y confunden.
const LINEA_DE = { falla: "falla", falla_inversa: "falla", charnela: "pliegue", lineamiento_nne: "fractura" };
const ESTILO_LINEA = {
  falla: { color: "#111111", weight: 3, dashArray: "9 6", opacity: 1 },
  fractura: { color: "#ffb300", weight: 3, opacity: 0.95 },
  pliegue: { color: "#00e5ff", weight: 4, opacity: 0.95 },
};
const TEXTO_LINEA = {
  falla: ["Falla", "Grieta grande donde la roca se partió y se movió. Por las fallas subió el agua caliente que formó la esmeralda.",
    "Del mapa geológico del Servicio Geológico Colombiano."],
  fractura: ["Fractura del terreno", "Valle o quiebre recto que suele marcar roca rota. Va en la misma dirección que las fallas de la esmeralda en Muzo y Coscuez (hacia el norte-noreste).",
    "La encontró el programa en la forma del terreno: confírmela en el campo, puede ser un camino o una quebrada."],
  pliegue: ["Cresta de un pliegue", "Donde las capas de roca se doblan hacia arriba. Ahí la roca se raja y se abren vetas.",
    "Del mapa geológico del Servicio Geológico Colombiano."],
};
const RADIO_KM = 5;
const AREA_MIN_KM2 = 0.25;
const ZOOM_DETALLE = 13;   // desde aquí se muestran corredores y estructuras

let D = {}, G = {};       // datos cargados y grilla decodificada
let map, capaZonas, capaMunicipios, capaCorredores, capaEstructuras, capaTitulos, capaProf;
let marcadorSel, circuloSel, capaCercanas;
let textoVoz = "";        // lo que dice el botón «Escuchar»

// ---------------------------------------------------------------- utilidades
const $ = (s) => document.querySelector(s);
const norm = (s) => (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmtKm = (k) => (k < 1 ? `${Math.round(k * 1000)} m` : `${k.toFixed(1).replace(".", ",")} km`);
const fmtNum = (v, d = 1) => v.toFixed(d).replace(".", ",");
const RUMBOS = ["norte", "nororiente", "oriente", "suroriente", "sur", "suroccidente", "occidente", "noroccidente"];
const color = (z) => G.colores[z];
function chip(z) {
  const oscuro = z === 0 || z === 4;
  return `<span class="zona-chip" style="background:${color(z)};color:${oscuro ? "#fff" : "#222"}">${ZONAS_CORTAS[z]}</span>`;
}
function b64(s, Tipo = Uint8Array) {
  const bin = atob(s), u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return new Tipo(u8.buffer);
}

// ---------------------------------------------------------------- grilla (EPSG:9377)
const aXY = (lat, lon) => proj4(G.proj4, [lon, lat]);
const aLatLon = (x, y) => { const [lon, lat] = proj4(G.proj4).inverse([x, y]); return [lat, lon]; };
// Cuadrícula del formulario de la encuesta: cuadros de 1 km numerados desde la esquina noroeste del área
// (columna de oeste a este, fila de norte a sur); hojas de 9 × 6 cuadros, letra A–J por filas y número 1–6 por columnas.
const HOJA_C = 9, HOJA_F = 6, LETRAS = "ABCDEFGHIJ";
function cuadroEncuesta(lat, lon) {
  const [x, y] = aXY(lat, lon);
  const col = Math.floor((x - G.x0) / 1000) + 1, fila = Math.floor((G.y0 - y) / 1000) + 1;
  const hf = Math.floor((fila - 1) / HOJA_F), hc = Math.floor((col - 1) / HOJA_C);
  if (col < 1 || fila < 1 || hf >= LETRAS.length || hc >= 6) return null;
  return { hoja: `${LETRAS[hf]}${hc + 1}`, col, fila };
}
function capaCuadricula() {
  const hojas = L.layerGroup(), km = L.layerGroup();
  const ll = (x, y) => aLatLon(G.x0 + x * 1000, G.y0 - y * 1000);
  const nC = Math.ceil(G.W * G.res / 1000), nF = Math.ceil(G.H * G.res / 1000);
  for (let hf = 0; hf * HOJA_F < nF && hf < LETRAS.length; hf++) for (let hc = 0; hc * HOJA_C < nC && hc < 6; hc++) {
    const x0 = hc * HOJA_C, y0 = hf * HOJA_F, x1 = x0 + HOJA_C, y1 = y0 + HOJA_F;
    L.polygon([ll(x0, y0), ll(x1, y0), ll(x1, y1), ll(x0, y1)], { color: "#ffd400", weight: 2, fill: false, interactive: false })
      .bindTooltip(`${LETRAS[hf]}${hc + 1}`, { permanent: true, direction: "center", className: "etiqueta-hoja" }).addTo(hojas);
  }
  for (let c = 0; c <= nC; c++) L.polyline([ll(c, 0), ll(c, nF)], { color: "#ffd400", weight: 0.6, opacity: 0.7, interactive: false }).addTo(km);
  for (let f = 0; f <= nF; f++) L.polyline([ll(0, f), ll(nC, f)], { color: "#ffd400", weight: 0.6, opacity: 0.7, interactive: false }).addTo(km);
  const g = L.layerGroup([hojas]);
  const verKm = () => { if (map.getZoom() >= 12 && map.hasLayer(g)) g.addLayer(km); else g.removeLayer(km); };
  map.on("zoomend", verKm); g.on("add", verKm);
  return g;
}
const PIN = L.divIcon({ className: "pin", iconSize: [30, 40], iconAnchor: [15, 38],
  html: `<svg viewBox="0 0 30 40" width="30" height="40" aria-hidden="true"><path d="M15 1C7.3 1 1 7.1 1 14.7 1 25 15 39 15 39s14-14 14-24.3C29 7.1 22.7 1 15 1z" fill="#0d6b50" stroke="#fff" stroke-width="2"/><path d="M15 7l6 5.2-6 10.3-6-10.3z" fill="#7ee2b8"/></svg>` });
const centro = (i) => [G.x0 + ((i % G.W) + 0.5) * G.res, G.y0 - (Math.floor(i / G.W) + 0.5) * G.res];
function indice(lat, lon) {
  const [x, y] = aXY(lat, lon);
  const c = Math.floor((x - G.x0) / G.res), r = Math.floor((G.y0 - y) / G.res);
  if (r < 0 || r >= G.H || c < 0 || c >= G.W) return -1;
  const i = r * G.W + c;
  return G.z[i] === 255 ? -1 : i;
}
function rumbo(x0, y0, x1, y1) {
  const g = (Math.atan2(x1 - x0, y1 - y0) * 180 / Math.PI + 360) % 360;
  return RUMBOS[Math.round(g / 45) % 8];
}
function resumenRadio(lat, lon, km) {
  const [x, y] = aXY(lat, lon), cont = [0, 0, 0, 0, 0, 0], m = km * 1000, n = Math.ceil(m / G.res);
  const c0 = Math.floor((x - G.x0) / G.res), r0 = Math.floor((G.y0 - y) / G.res);
  for (let r = Math.max(0, r0 - n); r <= Math.min(G.H - 1, r0 + n); r++)
    for (let c = Math.max(0, c0 - n); c <= Math.min(G.W - 1, c0 + n); c++) {
      const i = r * G.W + c, z = G.z[i];
      if (z === 255) continue;
      const [cx, cy] = centro(i);
      if ((cx - x) ** 2 + (cy - y) ** 2 <= m * m) cont[z]++;
    }
  return cont;
}
function areasCercanas(lat, lon) {
  // Distancia al cuadro más cercano de cada área (no a su centro): un área grande cuenta desde su borde.
  const [x, y] = aXY(lat, lon), best = new Map(), aqui = G.a[indice(lat, lon)] || 0;
  for (const i of G.celdasArea) {
    const [cx, cy] = centro(i), d = Math.hypot(cx - x, cy - y), id = G.a[i], b = best.get(id);
    if (!b || d < b.d) best.set(id, { d, i });
  }
  return D.areas.filter((a) => a.km2 >= AREA_MIN_KM2 && best.has(a.id)).map((a) => {
    const b = best.get(a.id), [cx, cy] = centro(b.i), [la, lo] = aLatLon(cx, cy);
    return { ...a, d: b.d / 1000, dir: rumbo(x, y, cx, cy), latC: la, lonC: lo, dentro: a.id === aqui };
  }).sort((a, b) => a.d - b.d);
}
const dondeTxt = (a) => (a.dentro ? "aquí mismo" : `${fmtKm(Math.max(a.d, 0.1))} al ${a.dir}`);

// Punto dentro de polígono (GeoJSON Polygon / MultiPolygon, con huecos)
function enAnillo(lon, lat, anillo) {
  let dentro = false;
  for (let i = 0, j = anillo.length - 1; i < anillo.length; j = i++) {
    const [xi, yi] = anillo[i], [xj, yj] = anillo[j];
    if ((yi > lat) !== (yj > lat) && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) dentro = !dentro;
  }
  return dentro;
}
function enPoligono(lon, lat, geom) {
  const polis = geom.type === "Polygon" ? [geom.coordinates] : geom.type === "MultiPolygon" ? geom.coordinates : [];
  return polis.some((p) => enAnillo(lon, lat, p[0]) && !p.slice(1).some((h) => enAnillo(lon, lat, h)));
}
function buscarEn(fc, lat, lon) {
  return fc.features.filter((f) => {
    const b = f._bbox || (f._bbox = L.geoJSON(f).getBounds());
    return b.contains([lat, lon]) && enPoligono(lon, lat, f.geometry);
  });
}

// ---------------------------------------------------------------- carga
async function cargar() {
  const get = (f) => fetch(`data/${f}`).then((r) => { if (!r.ok) throw new Error(f); return r.json(); });
  const [grilla, municipios, poblados, areas, meta, corredores, estructuras, titulos, explica] = await Promise.all([
    get("grilla.json"), get("municipios.geojson"), get("poblados.json"), get("areas_alto.json"),
    get("meta.json"), get("corredores.geojson"), get("estructuras.geojson"), get("titulos.geojson"), get("explica.json")]);
  D = { explica, municipios, poblados, areas, meta, corredores, estructuras, titulos };
  G = { ...grilla, z: b64(grilla.z), pa: b64(grilla.pa), pb: b64(grilla.pb), a: b64(grilla.a, Uint16Array),
    r1: b64(grilla.r1), r2: b64(grilla.r2), prof: b64(grilla.prof), pmin: b64(grilla.pmin), pmax: b64(grilla.pmax) };
  G.celdasArea = [];
  for (let i = 0; i < G.a.length; i++) if (G.a[i]) G.celdasArea.push(i);
}

// ---------------------------------------------------------------- mapa
function iniciarMapa() {
  map = L.map("map", { zoomControl: false, preferCanvas: true, renderer: L.canvas({ tolerance: 10 }), maxZoom: 19 });
  L.control.zoom({ position: "topright" }).addTo(map);
  const satelite = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    { maxZoom: 19, maxNativeZoom: 18, attribution: "Imagen: Esri, Maxar, Earthstar Geographics" });
  const calles = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    { maxZoom: 19, attribution: "© OpenStreetMap" });
  const topo = L.tileLayer("https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
    { maxZoom: 19, maxNativeZoom: 17, attribution: "© OpenTopoMap (CC-BY-SA)" });
  satelite.addTo(map);

  capaZonas = L.imageOverlay("data/zonas.png", G.zonas_png_bounds, { opacity: 0.6, className: "pixelado" }).addTo(map);

  capaCorredores = L.geoJSON(D.corredores, {
    style: (f) => ESTILO_CORREDOR[f.properties.tipo],
    onEachFeature: (f, l) => l.on("click", (e) => { L.DomEvent.stop(e); seleccionar(e.latlng.lat, e.latlng.lng, "Punto seleccionado en el mapa"); }),
  });
  const bordes = L.geoJSON(D.estructuras, {
    filter: (f) => LINEA_DE[f.properties.tipo], interactive: false,
    style: (f) => { const t = LINEA_DE[f.properties.tipo]; return { color: BORDE_LINEA[t], weight: ESTILO_LINEA[t].weight + 3, opacity: 0.75 }; },
  });
  const lineas = L.geoJSON(D.estructuras, {
    filter: (f) => LINEA_DE[f.properties.tipo],
    style: (f) => ESTILO_LINEA[LINEA_DE[f.properties.tipo]],
    onEachFeature: (f, l) => {
      const [t, d, fuente] = TEXTO_LINEA[LINEA_DE[f.properties.tipo]];
      l.bindPopup(`<div class="pop-linea"><b>${t}${f.properties.nombre ? ": " + esc(f.properties.nombre) : ""}</b><p>${d}</p><small>${fuente}</small></div>`,
        { maxWidth: 260, autoPan: true });
      const w = ESTILO_LINEA[LINEA_DE[f.properties.tipo]].weight;
      l.on("mouseover", () => l.setStyle({ weight: w + 3 })); l.on("mouseout", () => l.setStyle({ weight: w }));
      l.on("click", (e) => L.DomEvent.stop(e));
    },
  });
  capaEstructuras = L.layerGroup([bordes, lineas]);
  capaTitulos = L.geoJSON(D.titulos, {
    style: { color: "#00e5ff", weight: 1.5, fill: true, fillOpacity: 0.04, dashArray: "4 3" },
    interactive: false,
  });
  capaProf = L.imageOverlay("data/profundidad_muzo.png", G.prof_png_bounds, { opacity: 0.8 });

  capaMunicipios = L.geoJSON(D.municipios, {
    style: { fill: false, color: "#ffffff", weight: 2, opacity: 0.9 },
    interactive: false,
    onEachFeature: (f, l) => l.bindTooltip(f.properties.shapeName.toUpperCase(),
      { permanent: true, direction: "center", className: "etiqueta-mun" }),
  }).addTo(map);

  capaCercanas = L.layerGroup().addTo(map);
  const capas = {
    "Zonas de potencial": capaZonas,
    "Sitios para buscar (de cerca)": capaCorredores,
    "Fallas y fracturas (de cerca)": capaEstructuras,
    "Profundidad de la Fm. Muzo": capaProf,
    "Títulos mineros (ANM)": capaTitulos,
    "Municipios": capaMunicipios,
    "Cuadrícula de la encuesta (hojas y cuadros de 1 km)": capaCuadricula(),
  };
  L.control.layers({ "Satélite": satelite, "Calles": calles, "Relieve": topo }, capas, { collapsed: true }).addTo(map);
  L.control.scale({ imperial: false }).addTo(map);

  // Corredores y estructuras: solo de cerca (en la vista general serían ruido). El usuario puede apagarlos.
  const quiere = { corr: true, est: false };
  map.on("overlayadd", (e) => { if (e.layer === capaCorredores) quiere.corr = true; if (e.layer === capaEstructuras) quiere.est = true; });
  map.on("overlayremove", (e) => { if (e.layer === capaCorredores && map.getZoom() >= ZOOM_DETALLE) quiere.corr = false;
    if (e.layer === capaEstructuras && map.getZoom() >= ZOOM_DETALLE) quiere.est = false; });
  const porZoom = () => {
    const cerca = map.getZoom() >= ZOOM_DETALLE;
    for (const [capa, k] of [[capaCorredores, "corr"], [capaEstructuras, "est"]]) {
      if (cerca && quiere[k] && !map.hasLayer(capa)) capa.addTo(map);
      if (!cerca && map.hasLayer(capa)) map.removeLayer(capa);
    }
    capaZonas.setOpacity(cerca ? 0.4 : 0.6);
    $("#aviso-zoom").hidden = cerca;
  };
  map.on("zoomend", porZoom);
  const botonLineas = L.control({ position: "topright" });
  botonLineas.onAdd = () => {
    const b = L.DomUtil.create("button", "leaflet-control chip-lineas");
    const pintar = () => { b.classList.toggle("activo", quiere.est); b.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 17 9 7l4 6 3-4 5 8"/></svg>${quiere.est ? "Ocultar fallas y fracturas" : "Ver fallas y fracturas"}`; };
    L.DomEvent.disableClickPropagation(b);
    b.onclick = () => {
      quiere.est = !quiere.est; pintar();
      if (quiere.est && map.getZoom() < ZOOM_DETALLE) map.setZoom(ZOOM_DETALLE); else porZoom();
      if (!quiere.est && map.hasLayer(capaEstructuras)) map.removeLayer(capaEstructuras);
    };
    map.on("overlayadd overlayremove", pintar);
    pintar(); return b;
  };
  botonLineas.addTo(map);

  const ley = L.control({ position: "bottomright" });   // se oculta en celulares (CSS)
  ley.onAdd = () => {
    const div = L.DomUtil.create("div", "leaflet-control leyenda-mapa");
    div.innerHTML = ZONAS_CORTAS.map((n, z) => `<div><i style="background:${color(z)}"></i>${n}</div>`).join("") +
      `<div class="sep"></div><div class="tit">Al acercarse</div>` +
      `<div><i style="background:${ESTILO_CORREDOR.prioritario.fillColor};border-color:${ESTILO_CORREDOR.prioritario.color}"></i>Buscar aquí primero</div>` +
      `<div><i style="background:${ESTILO_CORREDOR.secundario.fillColor};border-color:${ESTILO_CORREDOR.secundario.color}"></i>Vale la pena revisar</div>` +
      `<div><b class="ln falla"></b>Falla</div>` +
      `<div><b class="ln" style="border-top:3px solid #ffb300"></b>Fractura del terreno</div>` +
      `<div><b class="ln" style="border-top:4px solid #00e5ff"></b>Cresta de pliegue</div>`;
    return div;
  };
  ley.addTo(map);

  map.fitBounds(capaZonas.getBounds());
  porZoom();
  map.on("click", (e) => seleccionar(e.latlng.lat, e.latlng.lng, "Punto seleccionado en el mapa"));
}

function marcadorNumero(lat, lon, n, tip) {
  const icon = L.divIcon({ className: "num", html: `<span>${n}</span>`, iconSize: [24, 24], iconAnchor: [12, 12] });
  L.marker([lat, lon], { icon }).bindTooltip(tip).addTo(capaCercanas).on("click", () => map.flyTo([lat, lon], 15));
}
function barra(cont) {
  const tot = cont.reduce((a, b) => a + b, 0) || 1;
  return `<div class="barra">${cont.map((v, z) => v ? `<span style="width:${(100 * v) / tot}%;background:${color(z)}" title="${ZONAS_CORTAS[z]}"></span>` : "").join("")}</div>`;
}

// ---------------------------------------------------------------- cajas del detalle
function cajaPunto(i) {
  if (i < 0) return `<div class="caja">Este punto está fuera del área estudiada.</div>`;
  const z = G.z[i];
  let h = `<div class="caja"><h3>En este cuadro de ${G.res} m</h3>${chip(z)}<div>${EXPLICACION[z]}</div>`;
  if (z !== 5) h += `<div class="hint">Probabilidad de estar entre el 10 % más favorable: ${G.pa[i]} %</div>`;
  return h + `</div>`;
}
function cajaCorredor(lat, lon) {
  const fs = buscarEn(D.corredores, lat, lon);
  if (!fs.length) return "";
  const p = fs.sort((a, b) => (a.properties.tipo === "prioritario" ? -1 : 1))[0].properties;
  const razones = Object.keys(CRITERIOS).filter((k) => p[k]).map((k) => `<li>${CRITERIOS[k]}</li>`).join("");
  return `<div class="caja corredor ${p.tipo}"><h3>${p.tipo === "prioritario" ? "Sitio para buscar primero" : "Sitio que vale la pena revisar"}</h3>` +
    `<div>Aquí hay tierra negra (o rocas vecinas a menos de 1 km) y además está:</div><ul>${razones}</ul>` +
    `<div class="hint">Recórralo por quebradas y cortes de camino buscando las señales de la “Guía de campo”. Es un sitio para recorrer, no un punto exacto (error de 50 a 100 m).</div></div>`;
}
function cajaProfundidad(i) {
  if (i < 0 || G.prof[i] === 255) return "";
  const p = G.prof[i] * 5, lo = G.pmin[i] * 5, hi = G.pmax[i] * 5;
  if (p < 10) return `<div class="caja"><h3>Bajo tierra</h3>Aquí <b>aflora la Formación Muzo</b> (o está a pocos metros): la roca donde se forma la esmeralda está en superficie.</div>`;
  return `<div class="caja"><h3>Bajo tierra (estimado)</h3>La Formación Muzo estaría a unos <b>${Math.round(p / 10) * 10} m</b> de profundidad` +
    ` (entre ${Math.round(lo / 10) * 10} y ${Math.round(hi / 10) * 10} m), bajo la Formación Capotes.` +
    `<div class="hint">Cálculo aproximado con el buzamiento de las capas medido en la región. No reemplaza un estudio de campo.</div></div>`;
}
function cajaTitulo(lat, lon) {
  const fs = buscarEn(D.titulos, lat, lon);
  if (!fs.length) return `<div class="caja"><h3>Títulos mineros</h3>Este punto no está dentro de un título minero de esmeralda vigente registrado en la ANM.<div class="hint">Para explorar o explotar se necesita un título o autorización de la Agencia Nacional de Minería.</div></div>`;
  return `<div class="caja aviso"><h3>Dentro de un título minero</h3>` + fs.map((f) => {
    const p = f.properties;
    return `<div><b>${esc(p.CODIGO_EXPEDIENTE)}</b> · ${esc(p.MODALIDAD)} · etapa: ${esc(p.ETAPA || "—")}</div>`;
  }).join("") + `<div class="hint">Trabajar dentro de un título ajeno sin permiso del titular es ilegal.</div></div>`;
}

// ---------------------------------------------------------------- explicaciones (por qué sí / por qué no)
const BLOQUES = new Map();
async function bloque(i) {
  const B = D.explica.bloque, r = Math.floor(i / G.W), c = i % G.W, key = `${Math.floor(r / B)}_${Math.floor(c / B)}`;
  if (!BLOQUES.has(key)) {
    BLOQUES.set(key, fetch(`data/detalle/${key}.json`).then((x) => x.json()).then((j) => {
      const celdas = b64(j.celdas, Uint16Array), pos = new Map();
      celdas.forEach((l, k) => pos.set(l, k));
      return { pos, val: j.valores.map((v) => b64(v, Int16Array)), con: j.contrib.map((v) => b64(v, Int16Array)),
        extras: Object.fromEntries(Object.entries(j.extras || {}).map(([k, v]) => [k, b64(v, Int16Array)])),
        gq: b64(j.gq_dist_km, Int16Array) };
    }));
  }
  const t = await BLOQUES.get(key), k = t.pos.get((r % B) * B + (c % B));
  if (k === undefined) return null;
  return { val: t.val.map((a) => a[k]), con: t.con.map((a) => a[k] / 1000),
    acuerdo: t.extras.acuerdo ? t.extras.acuerdo[k] / 1000 : null, gqKm: t.gq[k] / 10 };
}
const NULO = -32768;
function valorReal(v, q) { return q === NULO ? null : v.tipo === "roca" ? q : q / v.escala; }
function fmtValor(v, x) {
  if (x === null || x === undefined) return "sin dato";
  switch (v.tipo) {
    case "dist": return x < 1000 ? `${Math.max(30, Math.round(x / 10) * 10)} m` : `${fmtNum(x / 1000)} km`;
    case "num2": return fmtNum(x, 2);
    case "frac": return `${Math.round(x * 100)} %`;
    case "pct": return `${Math.round(x * 100)} %`;
    case "log10": return `${fmtNum(10 ** x, x < 0 ? 2 : 1)}`;
    case "m1": return `${x >= 0 ? "+" : "−"}${fmtNum(Math.abs(x))} m`;
    case "m0": return `${Math.round(x).toLocaleString("es-CO")} m`;
    case "grados": return `${Math.round(x)}°`;
    case "z": return x >= 0 ? `${fmtNum(x)} desv. más verde que su entorno` : `${fmtNum(-x)} desv. menos verde que su entorno`;
    case "roca": return D.explica.roca_texto[D.explica.roles[x]] || "sin dato";
  }
  return String(x);
}
function percentil(v, x) {
  const p = v.percentiles_region; if (!p || x === null) return null;
  let k = 0; while (k < p.length - 1 && p[k + 1] <= x) k++;
  return Math.round((k / (p.length - 1)) * 100);
}
function frase(v, x, c) {
  let t = v.tipo === "roca" ? `Está sobre ${fmtValor(v, x).replace(/^Formación/, "la Formación")}`
    : (c > 0 ? v.favor : v.contra).replace("{v}", fmtValor(v, x));
  for (const [re, r] of SENCILLO) t = t.replace(re, r);
  return t;
}
async function explicar(i, ctx) {
  const caja = document.getElementById("porque");
  let d;
  try { d = await bloque(i); } catch (e) { d = null; }
  if (!caja || !document.body.contains(caja)) return;
  if (!d) { caja.innerHTML = `<h3>¿Por qué?</h3><div class="hint">No hay explicación disponible para este cuadro.</div>`; return; }
  const items = D.explica.variables.map((v, k) => ({ v, x: valorReal(v, d.val[k]), c: d.con[k] }))
    .filter((o) => o.x !== null && !o.v.contrario && Math.abs(o.c) >= 0.1);
  const favor = items.filter((o) => o.c > 0).sort((a, b) => b.c - a.c).slice(0, 2);
  const contra = items.filter((o) => o.c < 0).sort((a, b) => a.c - b.c).slice(0, 2);
  const z = G.z[i];
  const intro = z <= 1 ? "Se parece a donde hay minas en esto:"
    : z >= 3 ? "Se parece poco a donde hay minas:"
    : "Hay cosas que ayudan y cosas que no:";
  const lista = (arr, cls) => arr.length ? `<ul class="porque ${cls}">${arr.map((o) => `<li>${esc(frase(o.v, o.x, o.c))}</li>`).join("")}</ul>` : `<div class="hint">Nada importante.</div>`;
  caja.innerHTML = `<h3>¿Por qué?</h3><div>${intro}</div>` +
    (z >= 3 ? `<div class="sub contra">Lo que no ayuda</div>${lista(contra, "contra")}<div class="sub favor">Lo que ayuda</div>${lista(favor, "favor")}`
      : `<div class="sub favor">Lo que ayuda</div>${lista(favor, "favor")}<div class="sub contra">Lo que no ayuda</div>${lista(contra, "contra")}`) +
    `<button class="link" id="ver-detalle">Ver la explicación completa (técnica)</button>`;
  const prim = (z >= 3 ? contra : favor).map((o) => frase(o.v, o.x, o.c));
  if (prim.length) textoVoz += " " + intro + " " + prim.join(". ") + ".";
  document.getElementById("ver-detalle").addEventListener("click", () => detalle(i, d, ctx));
}
function barraEfecto(c) {
  const w = Math.min(50, Math.abs(c) * 35);
  return `<div class="efecto"><span class="${c >= 0 ? "pos" : "neg"}" style="width:${w}%;${c >= 0 ? "left:50%" : `left:${50 - w}%`}"></span></div>`;
}
function detalle(i, d, ctx) {
  const z = G.z[i], E = D.explica;
  const filas = E.variables.map((v, k) => ({ v, x: valorReal(v, d.val[k]), c: d.con[k] }))
    .sort((a, b) => Math.abs(b.c) - Math.abs(a.c));
  const tot = filas.reduce((s, o) => s + o.c, 0);
  let h = `<h2>Explicación detallada</h2><div class="hint">${esc(ctx.titulo)} · ${ctx.lat.toFixed(5)}, ${ctx.lon.toFixed(5)} · cuadro de ${G.res} m</div>`;
  h += `<h3>1. Cómo se decidió la zona</h3><p>${chip(z)}</p>
    <p>El modelo no da un “sí” o “no”: calcula 2.000 versiones posibles del mapa, todas compatibles con los datos, y
    mira en cuántas este cuadro queda entre el <b>10 % más favorable</b> de toda la región y en cuántas queda en la
    <b>mitad menos favorable</b>.</p>
    <ul><li>Entre el 10 % más favorable: <b>${G.pa[i]} %</b> de las versiones.</li>
    <li>En la mitad menos favorable: <b>${G.pb[i]} %</b> de las versiones.</li></ul>
    <p class="hint">Reglas: potencial alto si lo primero pasa del 50 % (confianza alta desde 80 %); potencial bajo si
    lo segundo pasa del 50 % (alta desde 80 %); si ninguno, incierto.</p>`;
  if (d.acuerdo !== null) h += `<p>Al repetir todo el ajuste 5 veces con distinto azar, este cuadro quedó en la misma zona
    ${Math.round(d.acuerdo * 5)} de 5 veces${d.acuerdo < 1 ? " (su clasificación es <b>poco estable</b>: tómela con cautela)" : ""}.</p>`;
  h += `<h3>2. Qué pesa en este cuadro</h3>
    <p class="hint">“Efecto” es cuánto sube (verde) o baja (rojo) el puntaje de este cuadro frente a un cuadro promedio
    de la región. “Donde hay minas” es el valor típico (mediana) en los cuadros con minas conocidas. El puntaje total
    de este cuadro frente al promedio es <b>${tot >= 0 ? "+" : "−"}${fmtNum(Math.abs(tot), 2)}</b> (en escala logit).</p>
    <div class="tabla-wrap"><table class="tabla"><thead><tr><th>Variable</th><th>Aquí</th><th>Donde hay minas</th><th>Efecto</th></tr></thead><tbody>` +
    filas.map((o) => {
      const p = percentil(o.v, o.x);
      const tip = o.v.tipo === "roca"
        ? Object.entries(o.v.rol_minas || {}).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([r, f]) => `${Math.round(f * 100)} % en ${E.roca_texto[r].split(",")[0]}`).join("; ")
        : fmtValor(o.v, o.v.tipico_minas);
      const rel = p === null ? "" : o.v.tipo === "dist" ? (p <= 50 ? `<small>más cerca que el ${100 - p} % de la región</small>` : `<small>más lejos que el ${p} % de la región</small>`)
        : (p >= 50 ? `<small>más alto que el ${p} % de la región</small>` : `<small>más bajo que el ${100 - p} % de la región</small>`);
      const nota = o.v.contrario ? `<br><small class="aviso-txt">Efecto contrario a lo que espera la geología: puede ser un artefacto de los datos.</small>` : "";
      return `<tr><td>${esc(o.v.nombre)}${nota}</td><td>${esc(fmtValor(o.v, o.x))}<br>${rel}</td><td>${esc(tip)}</td><td>${barraEfecto(o.c)}<small>${o.c >= 0 ? "+" : "−"}${fmtNum(Math.abs(o.c), 2)}</small></td></tr>`;
    }).join("") + `</tbody></table></div>`;
  h += `<h3>3. Qué no sabe el modelo aquí</h3><ul>
    <li>La geología viene de mapas 1:100.000: los límites de las formaciones y las fallas pueden estar corridos 50 a 100 m.</li>
    <li>${d.gqKm > 6 ? `No hay muestras de sedimentos de quebrada a menos de 6 km (la más cercana está a ${fmtNum(d.gqKm)} km): la química no aporta en este cuadro.` : `La muestra de sedimentos más cercana está a ${fmtNum(d.gqKm)} km; la química de este cuadro es una interpolación.`}</li>
    <li>${esc(E.nota_neutralizadas)}</li>
    <li>El modelo aprende de 48 cuadros con minas conocidas, casi todas del tipo Muzo-Coscuez. No ve vetas, túneles ni lo que saben los mineros (eso será el Modelo B).</li></ul>
    <h3>4. Qué hacer con esto</h3><p>${z <= 1 ? "Vale la pena recorrer la zona: busque los corredores al acercarse y las señales de la Guía de campo." : z === 2 ? "Si hay otras señales en el terreno (vetas de calcita, albitita, lutita negra), puede valer la pena mirar; si no, hay zonas más favorables cerca." : "Hay zonas más favorables en la región; revise la lista de áreas cercanas."}</p>`;
  $("#modal-cuerpo").innerHTML = h;
  $("#modal").hidden = false;
}

// ---------------------------------------------------------------- corredor más cercano y GPX
function corredorCercano(lat, lon, tipo = "prioritario") {
  const [x, y] = aXY(lat, lon);
  let best = null;
  if (buscarEn(D.corredores, lat, lon).some((f) => f.properties.tipo === tipo)) return { d: 0, lat, lon, dir: "" };
  for (const f of D.corredores.features) {
    if (f.properties.tipo !== tipo) continue;
    const polis = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
    for (const p of polis) for (const [lo, la] of p[0]) {
      if (Math.abs(la - lat) > 0.1 || Math.abs(lo - lon) > 0.1) continue;
      const [cx, cy] = aXY(la, lo), d = Math.hypot(cx - x, cy - y);
      if (!best || d < best.d) best = { d, lat: la, lon: lo, cx, cy };
    }
  }
  return best ? { d: best.d / 1000, lat: best.lat, lon: best.lon, dir: rumbo(x, y, best.cx, best.cy) } : null;
}
function descargarGPX(lat, lon, titulo, areas) {
  const x = (s) => esc(s);
  let wpt = `<wpt lat="${lat.toFixed(6)}" lon="${lon.toFixed(6)}"><name>${x(titulo)}</name><desc>Punto consultado</desc></wpt>\n`;
  areas.forEach((a, k) => { wpt += `<wpt lat="${a.latC.toFixed(6)}" lon="${a.lonC.toFixed(6)}"><name>Área ${k + 1} (${fmtNum(a.km2)} km²)</name><desc>Potencial alto, ${a.confianza_alta_pct} % confianza alta</desc></wpt>\n`; });
  let trk = "", n = 0;
  for (const f of D.corredores.features) {
    const polis = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
    for (const p of polis) {
      const anillo = p[0];
      if (!anillo.some(([lo, la]) => Math.abs(la - lat) < 0.03 && Math.abs(lo - lon) < 0.03)) continue;
      const pr = f.properties, por = Object.keys(CRITERIOS).filter((k) => pr[k]).map((k) => CRITERIOS[k]).join("; ");
      trk += `<trk><name>Corredor ${pr.tipo} ${++n}</name><desc>${x(por)}</desc><trkseg>${anillo.map(([lo, la]) => `<trkpt lat="${la.toFixed(6)}" lon="${lo.toFixed(6)}"/>`).join("")}</trkseg></trk>\n`;
    }
  }
  const gpx = `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="Guía de exploración esmeraldífera" xmlns="http://www.topografix.com/GPX/1/1">\n<metadata><name>${x(titulo)}</name><desc>Guía de exploración (no garantiza esmeralda). Corredores a ~3 km del punto.</desc></metadata>\n${wpt}${trk}</gpx>`;
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([gpx], { type: "application/gpx+xml" }));
  a.download = `esmeraldas_${lat.toFixed(4)}_${lon.toFixed(4)}.gpx`;
  document.body.appendChild(a); a.click(); a.remove();
}

// ---------------------------------------------------------------- guardar un municipio para usar sin señal
async function guardarMunicipio(f, boton) {
  const b = L.geoJSON(f).getBounds(), B = D.explica.bloque;
  const esquinas = [b.getSouthWest(), b.getNorthEast(), b.getNorthWest(), b.getSouthEast()].map((p) => aXY(p.lat, p.lng));
  const xs = esquinas.map((p) => p[0]), ys = esquinas.map((p) => p[1]);
  const c0 = Math.max(0, Math.floor((Math.min(...xs) - G.x0) / G.res / B)), c1 = Math.floor((Math.max(...xs) - G.x0) / G.res / B);
  const r0 = Math.max(0, Math.floor((G.y0 - Math.max(...ys)) / G.res / B)), r1 = Math.floor((G.y0 - Math.min(...ys)) / G.res / B);
  const urls = [];
  for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) urls.push(`data/detalle/${r}_${c}.json`);
  let ok = 0;
  for (const u of urls) { try { const res = await fetch(u); if (res.ok) ok++; } catch (_) {} boton.textContent = `Guardando… ${ok}/${urls.length}`; }
  boton.textContent = `✓ Guardado. Sin señal verá las zonas y las explicaciones; las fotos del satélite solo donde ya miró.`;
  boton.disabled = true;
}

// ---------------------------------------------------------------- tutorial (primera visita)
function tutorial() {
  let visto = false;
  try { visto = localStorage.getItem("tutorial_v3") === "1"; } catch (_) {}
  if (visto) return;
  const pasos = [
    ["Bienvenido", "Esta es una <b>guía de exploración</b>: muestra dónde el terreno se parece a donde hoy hay minas de esmeralda. No garantiza que haya esmeralda."],
    ["Colores", "<b>Rojo</b>: favorable, se parece a donde hay minas. <b>Azul</b>: poco favorable. <b>Gris</b>: no se sabe. Mientras más fuerte el color, más seguro está el mapa."],
    ["¿Qué hay donde estoy?", "Toque el botón verde <b>¿Qué hay donde estoy?</b> o escriba el nombre de su vereda. También puede tocar cualquier punto del mapa. La app le dice en una frase si ese sitio es favorable y <b>por qué</b>."],
    ["Acérquese", "De cerca aparecen los <b>sitios para buscar</b>: en rosado, <b>buscar aquí primero</b>; en amarillo, <b>vale la pena revisar</b>. Son tierra negra junto a fallas, pliegues o fracturas. Con el botón <b>Ver fallas y fracturas</b> puede ver esas líneas y tocarlas para saber qué son."],
    ["Sin señal", "Antes de salir al monte, busque su municipio o vereda y toque <b>Guardar para usar sin señal</b>. Revise siempre los títulos mineros antes de trabajar."],
  ];
  let k = 0;
  const div = document.createElement("div");
  div.id = "tutorial";
  const pintar = () => {
    div.innerHTML = `<div class="tut-caja"><div class="hint">${k + 1} de ${pasos.length}</div><h2>${pasos[k][0]}</h2><p>${pasos[k][1]}</p>
      <div class="tut-botones"><button class="btn" id="tut-saltar">Saltar</button><button class="btn primario" id="tut-sig">${k < pasos.length - 1 ? "Siguiente" : "Empezar"}</button></div></div>`;
    div.querySelector("#tut-saltar").onclick = cerrar;
    div.querySelector("#tut-sig").onclick = () => { if (k < pasos.length - 1) { k++; pintar(); } else cerrar(); };
  };
  const cerrar = () => { div.remove(); try { localStorage.setItem("tutorial_v3", "1"); } catch (_) {} };
  pintar(); document.body.appendChild(div);
}

// ---------------------------------------------------------------- selección de un lugar
function seleccionar(lat, lon, titulo, subtitulo = "") {
  activarTab("buscar");
  if (marcadorSel) map.removeLayer(marcadorSel);
  if (circuloSel) map.removeLayer(circuloSel);
  capaCercanas.clearLayers();
  marcadorSel = L.marker([lat, lon], { icon: PIN }).addTo(map);
  circuloSel = L.circle([lat, lon], { radius: RADIO_KM * 1000, color: "#fff", weight: 2, dashArray: "6 6", fill: false, interactive: false }).addTo(map);

  const i = indice(lat, lon);
  const todas = areasCercanas(lat, lon);
  const cerca = todas.slice(0, 5);
  const cont = resumenRadio(lat, lon, RADIO_KM);
  const kmCelda = (G.res / 1000) ** 2;
  const enRadio = todas.filter((a) => a.d <= RADIO_KM);
  cerca.forEach((a, k) => marcadorNumero(a.latC, a.lonC, k + 1, `Área ${k + 1}: ${dondeTxt(a)}`));

  const z = i >= 0 ? G.z[i] : -1;
  const mun = buscarEn(D.municipios, lat, lon)[0];
  const enTitulo = i >= 0 && buscarEn(D.titulos, lat, lon).length > 0;
  textoVoz = `${titulo}. ${z >= 0 ? ZONAS_CORTAS[z] + ". " + VEREDICTO[z] : "Este punto está fuera del área estudiada."}`;

  // 1. Resultado en una frase
  let html = `<h2>${esc(titulo)}</h2>${subtitulo ? `<div class="hint">${esc(subtitulo)}</div>` : ""}`;
  html += z >= 0
    ? `<div class="veredicto" style="--zc:${color(z)}"><div class="veredicto-etq">${ZONAS_CORTAS[z]}</div>` +
      `<div class="veredicto-txt">${VEREDICTO[z]}</div><div class="veredicto-nota">Es una guía: no garantiza que haya esmeralda.</div></div>`
    : `<div class="caja">Este punto está fuera del área estudiada.</div>`;

  // 2. Acciones rápidas
  const urlPunto = `${location.origin}${location.pathname}#${lat.toFixed(5)},${lon.toFixed(5)}`;
  const msgWA = `Guía de exploración esmeraldífera · ${titulo}: ${z >= 0 ? ZONAS_CORTAS[z] + ". " + VEREDICTO[z] : ""} Véalo en el mapa: ${urlPunto}`;
  html += `<div class="acciones">
    <button class="accion" id="escuchar"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11"/></svg><span>Escuchar</span></button>
    <a class="accion" href="https://wa.me/?text=${encodeURIComponent(msgWA)}" target="_blank" rel="noopener"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20l1.3-3.9A8 8 0 1 1 8 19.1z"/><path d="M9 9.5c0 3 2.5 5.5 5.5 5.5l1-1.5-2-1-1 .8a4 4 0 0 1-2-2l.8-1-1-2z"/></svg><span>WhatsApp</span></a>
    <a class="accion" href="https://www.google.com/maps/dir/?api=1&destination=${lat.toFixed(6)},${lon.toFixed(6)}" target="_blank" rel="noopener"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2 4 20l8-4 8 4z"/></svg><span>Cómo llegar</span></a>
  </div>`;

  // 3. Por qué (corto)
  if (i >= 0 && z !== 5) html += `<div class="caja" id="porque"><h3>¿Por qué?</h3><div class="hint">Cargando…</div></div>`;
  // Lo legal va siempre a la vista cuando aplica
  if (enTitulo) html += cajaTitulo(lat, lon);
  // 4. Hacia dónde caminar
  const corr = corredorCercano(lat, lon);
  if (corr) html += `<div class="caja"><h3>¿Hacia dónde camino?</h3>${corr.d < 0.03 ? "Está <b>dentro</b> de un sitio para buscar primero." :
    `El sitio para buscar primero más cercano está a <b>${fmtKm(corr.d)} al ${corr.dir}</b>.`}
    <button class="btn" id="ir-corredor">Ver ese sitio en el mapa</button></div>`;
  html += cajaCorredor(lat, lon);
  // 5. Sin señal
  if (mun) html += `<button class="btn guardar" id="guardar-aqui"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v11M7 10l5 5 5-5M5 20h14"/></svg>Guardar ${esc(mun.properties.shapeName)} para usar sin señal</button>`;

  // 6. Lo demás, plegado
  const cu = cuadroEncuesta(lat, lon);
  html += `<details class="mas"><summary>Más información</summary>`;
  html += `<div class="coords">${lat.toFixed(5)}, ${lon.toFixed(5)} · <a href="https://www.google.com/maps/search/?api=1&query=${lat.toFixed(6)},${lon.toFixed(6)}" target="_blank" rel="noopener">abrir en Google Maps</a> · <a href="#" id="compartir">copiar enlace</a></div>`;
  if (cu) html += `<div class="hint">Mapa de la encuesta: hoja <b>${cu.hoja}</b>, cuadro columna <b>${cu.col}</b>, fila <b>${cu.fila}</b></div>`;
  html += cajaPunto(i) + cajaProfundidad(i);
  html += `<div class="caja"><h3>A menos de ${RADIO_KM} km</h3>${barra(cont)}`;
  const alto = (cont[0] + cont[1]) * kmCelda;
  html += alto > 0
    ? `<div>Hay <b>${fmtNum(alto)} km²</b> de zona favorable en ${enRadio.length} área(s).</div>`
    : `<div>No hay zonas favorables a menos de ${RADIO_KM} km.</div>`;
  html += `</div>`;
  if (cerca.length) {
    html += `<div class="caja"><h3>Zonas favorables más cercanas</h3><ul class="cerca">` +
      cerca.map((a, k) => `<li data-lat="${a.latC}" data-lon="${a.lonC}"><b>${k + 1}.</b> ${dondeTxt(a)}` +
        ` · ${fmtNum(a.km2)} km²${a.municipio ? ` · ${esc(a.municipio)}` : ""}` +
        `<br><small class="hint">${a.confianza_alta_pct} % muy favorable · toque para ir y ver los sitios para buscar</small></li>`).join("") + `</ul></div>`;
  }
  if (i >= 0 && !enTitulo) html += cajaTitulo(lat, lon);
  html += `<button class="btn" id="gpx">Descargar para GPS (punto, zonas y sitios para buscar)</button></details>`;
  $("#detalle").innerHTML = html;
  $("#detalle").querySelectorAll(".cerca li").forEach((li) =>
    li.addEventListener("click", () => map.flyTo([+li.dataset.lat, +li.dataset.lon], 15)));
  history.replaceState(null, "", `#${lat.toFixed(5)},${lon.toFixed(5)}`);
  if (corr) $("#ir-corredor").addEventListener("click", () => map.flyTo([corr.lat, corr.lon], 16));
  if (mun) $("#guardar-aqui").addEventListener("click", (e) => guardarMunicipio(mun, e.currentTarget));
  $("#gpx").addEventListener("click", () => descargarGPX(lat, lon, titulo, cerca));
  $("#escuchar").addEventListener("click", (e) => hablar(e.currentTarget));
  $("#compartir").addEventListener("click", async (e) => {
    e.preventDefault();
    try { await navigator.clipboard.writeText(urlPunto); e.target.textContent = "enlace copiado"; } catch (_) { prompt("Copie este enlace:", urlPunto); }
  });

  map.flyTo([lat, lon], Math.max(map.getZoom(), 12), { duration: 0.8 });
  mostrarPanel();
  // Llevar el panel al resultado (en el celular quedaba debajo del buscador)
  setTimeout(() => { const pn = $("#panel"); pn.scrollTo({ top: $("#detalle").offsetTop - pn.offsetTop - 70, behavior: "smooth" }); }, 80);
  if (i >= 0 && G.z[i] !== 5) explicar(i, { lat, lon, titulo });
}

// ---------------------------------------------------------------- escuchar (voz del celular, funciona sin señal)
function hablar(boton) {
  const span = boton.querySelector("span");
  if (!("speechSynthesis" in window)) { span.textContent = "No disponible"; return; }
  if (speechSynthesis.speaking) { speechSynthesis.cancel(); span.textContent = "Escuchar"; return; }
  const u = new SpeechSynthesisUtterance(textoVoz);
  const voces = speechSynthesis.getVoices();
  u.voice = voces.find((v) => v.lang === "es-CO") || voces.find((v) => v.lang.startsWith("es-4") || v.lang === "es-MX" || v.lang === "es-US") ||
    voces.find((v) => v.lang.startsWith("es")) || null;
  u.lang = u.voice ? u.voice.lang : "es-CO"; u.rate = 0.95;
  u.onend = u.onerror = () => { span.textContent = "Escuchar"; };
  span.textContent = "Detener"; speechSynthesis.speak(u);
}

// ---------------------------------------------------------------- buscador
function iniciarBuscador() {
  const items = [
    ...D.poblados.map((p) => ({ nombre: p.nombre, sub: `${p.tipo === "town" ? "Pueblo" : p.tipo === "vereda" ? "Vereda" : p.tipo === "village" || p.tipo === "hamlet" ? "Caserío" : "Lugar"}${p.municipio ? " · " + p.municipio : ""}`, lat: p.lat, lon: p.lon })),
    ...D.municipios.features.map((f) => {
      const c = L.geoJSON(f).getBounds().getCenter();
      return { nombre: f.properties.shapeName, sub: "Municipio", lat: c.lat, lon: c.lng, mun: f };
    }),
  ].map((x) => ({ ...x, k: norm(x.nombre) }));

  const q = $("#q"), ul = $("#sugerencias");
  let sel = -1, actuales = [];
  const pintar = () => {
    ul.innerHTML = actuales.map((x, k) => `<li class="${k === sel ? "sel" : ""}" data-k="${k}">${esc(x.nombre)}<br><small>${esc(x.sub)}</small></li>`).join("");
    ul.hidden = !actuales.length;
  };
  const elegir = (x) => {
    q.value = x.nombre; ul.hidden = true;
    if (x.mun) { seleccionarMunicipio(x.mun); return; }
    seleccionar(x.lat, x.lon, x.nombre, x.sub);
  };
  q.addEventListener("input", () => {
    const t = norm(q.value);
    actuales = t.length < 2 ? [] : items.filter((x) => x.k.includes(t))
      .sort((a, b) => (a.k.startsWith(t) ? 0 : 1) - (b.k.startsWith(t) ? 0 : 1) || a.k.length - b.k.length).slice(0, 12);
    sel = -1; pintar();
  });
  q.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") { sel = Math.min(sel + 1, actuales.length - 1); pintar(); e.preventDefault(); }
    else if (e.key === "ArrowUp") { sel = Math.max(sel - 1, 0); pintar(); e.preventDefault(); }
    else if (e.key === "Enter" && actuales.length) elegir(actuales[Math.max(sel, 0)]);
  });
  ul.addEventListener("click", (e) => { const li = e.target.closest("li"); if (li) elegir(actuales[+li.dataset.k]); });
  document.addEventListener("click", (e) => { if (!e.target.closest(".search")) ul.hidden = true; });

  $("#ubicacion").addEventListener("click", () => {
    if (!navigator.geolocation) { alertaDetalle("Este navegador no permite obtener la ubicación."); return; }
    const btnUb = $("#ubicacion"), original = btnUb.innerHTML;
    btnUb.textContent = "Buscando su ubicación…"; btnUb.disabled = true;
    const restaurar = () => { btnUb.innerHTML = original; btnUb.disabled = false; };
    navigator.geolocation.getCurrentPosition(
      (p) => { restaurar(); seleccionar(p.coords.latitude, p.coords.longitude, "Su ubicación"); },
      () => { restaurar(); alertaDetalle("No fue posible obtener la ubicación. Revise los permisos del navegador o busque su pueblo por nombre."); },
      { enableHighAccuracy: true, timeout: 15000 });
  });
}
function alertaDetalle(msg) { $("#detalle").innerHTML = `<div class="caja">${esc(msg)}</div>`; }

// ---------------------------------------------------------------- municipios
function seleccionarMunicipio(f) {
  activarTab("buscar");
  capaCercanas.clearLayers();
  if (marcadorSel) map.removeLayer(marcadorSel);
  if (circuloSel) map.removeLayer(circuloSel);
  map.flyToBounds(L.geoJSON(f).getBounds(), { padding: [20, 20], duration: 0.8 });
  const p = f.properties, km = [0, 1, 2, 3, 4, 5].map((z) => p[`km2_${z}`] || 0);
  const tot = km.reduce((a, b) => a + b, 0);
  const areas = D.areas.filter((a) => a.municipio === p.shapeName && a.km2 >= AREA_MIN_KM2).slice(0, 8);
  areas.forEach((a, k) => marcadorNumero(a.lat, a.lon, k + 1, `${fmtNum(a.km2)} km²`));
  let html = `<h2>${esc(p.shapeName)}</h2><div class="hint">Municipio · ${tot.toFixed(0)} km² dentro del área estudiada</div>`;
  html += `<div class="caja"><h3>Cómo se reparte el territorio</h3>${barra(km)}<ul class="leyenda">` +
    km.map((v, z) => v ? `<li><i style="background:${color(z)}"></i>${ZONAS_CORTAS[z]}: ${fmtNum(v)} km² (${Math.round((100 * v) / tot)} %)</li>` : "").join("") + `</ul></div>`;
  if (areas.length) {
    html += `<div class="caja"><h3>Zonas favorables más grandes</h3><ul class="cerca">` +
      areas.map((a, k) => `<li data-lat="${a.lat}" data-lon="${a.lon}"><b>${k + 1}.</b> ${fmtNum(a.km2)} km² · ${a.confianza_alta_pct} % muy favorable</li>`).join("") + `</ul></div>`;
  } else {
    html += `<div class="caja">Este municipio no tiene zonas favorables dentro del área estudiada.</div>`;
  }
  html += `<button class="btn" id="guardar-mun">Guardar los datos de ${esc(p.shapeName)} para usar sin señal</button>`;
  $("#detalle").innerHTML = html;
  $("#detalle").querySelectorAll(".cerca li").forEach((li) =>
    li.addEventListener("click", () => map.flyTo([+li.dataset.lat, +li.dataset.lon], 15)));
  $("#guardar-mun").addEventListener("click", (e) => guardarMunicipio(f, e.target));
  mostrarPanel();
}
function iniciarMunicipios() {
  const feats = [...D.municipios.features].sort((a, b) =>
    (b.properties.km2_0 + b.properties.km2_1) - (a.properties.km2_0 + a.properties.km2_1));
  $("#lista-municipios").innerHTML = feats.map((f, k) => {
    const p = f.properties, km = [0, 1, 2, 3, 4, 5].map((z) => p[`km2_${z}`] || 0);
    return `<li data-k="${k}"><b>${esc(p.shapeName)}</b>${barra(km)}<small>Zona favorable: ${fmtNum(km[0] + km[1])} km²</small></li>`;
  }).join("");
  $("#lista-municipios").addEventListener("click", (e) => {
    const li = e.target.closest("li"); if (li) seleccionarMunicipio(feats[+li.dataset.k]);
  });
}

// ---------------------------------------------------------------- pestañas y panel
function activarTab(t) {
  document.querySelectorAll(".tab").forEach((b) => b.classList.toggle("active", b.dataset.tab === t));
  document.querySelectorAll(".tab-body").forEach((s) => s.classList.toggle("active", s.id === `tab-${t}`));
}
function mostrarPanel() { $("#panel").classList.remove("oculto"); setTimeout(() => map.invalidateSize(), 50); }

async function main() {
  try { await cargar(); }
  catch (e) {
    $("#cargando").innerHTML = "No se pudieron cargar los datos del mapa.<br><small>Si abrió el archivo directamente desde el computador, use la versión publicada en internet.</small>";
    return;
  }
  iniciarMapa();
  iniciarBuscador();
  iniciarMunicipios();
  $("#leyenda").innerHTML = ZONAS_CORTAS.map((n, z) => `<li><i style="background:${color(z)}"></i><span><b>${n}.</b> ${EXPLICACION[z]}</span></li>`).join("");
  $("#meta").textContent = `${D.meta.modelo} · Inferencia: ${D.meta.inferencia} · Datos del ${D.meta.fecha} · Cuadros de ${D.meta.res_m} m; corredores a 30 m.`;
  document.querySelectorAll(".tab").forEach((b) => b.addEventListener("click", () => activarTab(b.dataset.tab)));
  $("#toggle-panel").addEventListener("click", () => { $("#panel").classList.toggle("oculto"); setTimeout(() => map.invalidateSize(), 50); });
  $("#cerrar-modal").addEventListener("click", () => { $("#modal").hidden = true; });
  $("#modal").addEventListener("click", (e) => { if (e.target.id === "modal") $("#modal").hidden = true; });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") $("#modal").hidden = true; });
  const senal = () => { $("#sin-senal").hidden = navigator.onLine; };
  addEventListener("online", senal); addEventListener("offline", senal); senal();
  if ("speechSynthesis" in window) speechSynthesis.getVoices();   // carga las voces con anticipación
  $("#cargando").remove();
  const m = location.hash.match(/^#(-?\d+\.?\d*),(-?\d+\.?\d*)$/);
  if (m) seleccionar(+m[1], +m[2], "Punto compartido");
  if (!m) tutorial();
  if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => {});
}
main();
