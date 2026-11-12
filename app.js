// Zonas de potencial esmeraldífero · Occidente de Boyacá (Modelo A)
// Página estática: lee los datos de data/ y no envía nada a ningún servidor.
"use strict";

const ZONAS_CORTAS = ["Potencial alto · confianza alta", "Potencial alto · confianza media", "Incierto",
  "Potencial bajo · confianza media", "Potencial bajo · confianza alta", "No evaluado"];
const EXPLICACION = [
  "Se parece mucho a donde hoy hay minas de esmeralda, y el modelo está muy seguro.",
  "Se parece a donde hay minas, pero el modelo está menos seguro.",
  "Con la información actual el modelo no puede decidir.",
  "Probablemente no es favorable, aunque el modelo no está del todo seguro.",
  "Con lo que se sabe hoy, es poco probable que sea favorable.",
  "Formación Rosablanca (tipo Peñas Blancas): el modelo no sabe evaluarla.",
];
const RADIO_KM = 5;
const AREA_MIN_KM2 = 0.25;   // áreas de potencial alto de al menos 4 cuadros; los cuadros sueltos no se listan

let D = {};               // datos cargados
let map, capaZonas, capaMunicipios, marcadorSel, circuloSel, capaCercanas;

// ---------------------------------------------------------------- utilidades
const $ = (s) => document.querySelector(s);
const norm = (s) => (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const R = 6371;
function distKm(a, b, c, d) {
  const r = Math.PI / 180, dl = (c - a) * r, dn = (d - b) * r;
  const h = Math.sin(dl / 2) ** 2 + Math.cos(a * r) * Math.cos(c * r) * Math.sin(dn / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
function rumbo(a, b, c, d) {
  const r = Math.PI / 180;
  const y = Math.sin((d - b) * r) * Math.cos(c * r);
  const x = Math.cos(a * r) * Math.sin(c * r) - Math.sin(a * r) * Math.cos(c * r) * Math.cos((d - b) * r);
  const g = (Math.atan2(y, x) / r + 360) % 360;
  return ["norte", "nororiente", "oriente", "suroriente", "sur", "suroccidente", "occidente", "noroccidente"][Math.round(g / 45) % 8];
}
const fmtKm = (k) => (k < 1 ? `${Math.round(k * 1000)} m` : `${k.toFixed(1).replace(".", ",")} km`);
const color = (z) => D.celdas.colores[z];
function chip(z) {
  const oscuro = z === 0 || z === 4;
  return `<span class="zona-chip" style="background:${color(z)};color:${oscuro ? "#fff" : "#222"}">${ZONAS_CORTAS[z]}</span>`;
}

// ---------------------------------------------------------------- carga
async function cargar() {
  const get = (f) => fetch(`data/${f}`).then((r) => { if (!r.ok) throw new Error(f); return r.json(); });
  const [celdas, zonas, municipios, poblados, areas, meta] = await Promise.all([
    get("celdas.json"), get("zonas.geojson"), get("municipios.geojson"), get("poblados.json"),
    get("areas_alto.json"), get("meta.json")]);
  D = { celdas, zonas, municipios, poblados, areas, meta };
}

// ---------------------------------------------------------------- mapa
function iniciarMapa() {
  map = L.map("map", { zoomControl: true, preferCanvas: true });
  const satelite = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    { maxZoom: 18, attribution: "Imagen: Esri, Maxar, Earthstar Geographics" });
  const calles = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    { maxZoom: 18, attribution: "© OpenStreetMap" });
  const topo = L.tileLayer("https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
    { maxZoom: 17, attribution: "© OpenTopoMap (CC-BY-SA)" });
  satelite.addTo(map);

  capaZonas = L.geoJSON(D.zonas, {
    style: (f) => ({ fillColor: color(f.properties.z), color: color(f.properties.z), weight: 0.4,
      fillOpacity: f.properties.z === 2 ? 0.25 : 0.55 }),
    interactive: false,
  }).addTo(map);

  capaMunicipios = L.geoJSON(D.municipios, {
    style: { fill: false, color: "#ffffff", weight: 2, opacity: 0.9 },
    interactive: false,
    onEachFeature: (f, l) => l.bindTooltip(f.properties.shapeName.toUpperCase(),
      { permanent: true, direction: "center", className: "etiqueta-mun" }),
  }).addTo(map);

  capaCercanas = L.layerGroup().addTo(map);
  L.control.layers({ "Satélite": satelite, "Calles": calles, "Relieve": topo },
    { "Zonas de potencial": capaZonas, "Municipios": capaMunicipios }, { collapsed: true }).addTo(map);
  L.control.scale({ imperial: false }).addTo(map);

  const ley = L.control({ position: "bottomright" });   // se oculta en celulares (CSS)
  ley.onAdd = () => {
    const div = L.DomUtil.create("div", "leaflet-control leyenda-mapa");
    div.innerHTML = ZONAS_CORTAS.map((n, z) => `<div><i style="background:${color(z)}"></i>${n}</div>`).join("");
    return div;
  };
  ley.addTo(map);

  map.fitBounds(capaZonas.getBounds());
  map.on("click", (e) => seleccionar(e.latlng.lat, e.latlng.lng, "Punto seleccionado en el mapa"));
}

// ---------------------------------------------------------------- consultas
function celdaEn(lat, lon) {
  const c = D.celdas, maxKm = (c.res_m / 1000) * 0.75;
  let mejor = -1, dmin = Infinity;
  for (let i = 0; i < c.lat.length; i++) {
    if (Math.abs(c.lat[i] - lat) > 0.01 || Math.abs(c.lon[i] - lon) > 0.01) continue;
    const d = distKm(lat, lon, c.lat[i], c.lon[i]);
    if (d < dmin) { dmin = d; mejor = i; }
  }
  return dmin <= maxKm ? mejor : -1;
}
function resumenRadio(lat, lon, km) {
  const c = D.celdas, cont = [0, 0, 0, 0, 0, 0], dlat = km / 111;
  for (let i = 0; i < c.lat.length; i++) {
    if (Math.abs(c.lat[i] - lat) > dlat || Math.abs(c.lon[i] - lon) > dlat * 1.01) continue;
    if (distKm(lat, lon, c.lat[i], c.lon[i]) <= km) cont[c.z[i]]++;
  }
  return cont;
}
function areasCercanas(lat, lon, n = 5) {
  // Distancia al cuadro más cercano de cada área (no a su centro): así un área grande cuenta desde su borde.
  const c = D.celdas, best = new Map();
  for (let i = 0; i < c.a.length; i++) {
    const id = c.a[i];
    if (!id) continue;
    const d = distKm(lat, lon, c.lat[i], c.lon[i]);
    const b = best.get(id);
    if (!b || d < b.d) best.set(id, { d, lat: c.lat[i], lon: c.lon[i] });
  }
  return D.areas.filter((a) => a.km2 >= AREA_MIN_KM2 && best.has(a.id)).map((a) => {
    const b = best.get(a.id);
    return { ...a, d: b.d, dir: rumbo(lat, lon, b.lat, b.lon), latC: b.lat, lonC: b.lon };
  }).sort((a, b) => a.d - b.d).slice(0, n);
}
const dondeTxt = (a) => (a.d <= 0.2 ? "aquí mismo" : `${fmtKm(a.d)} al ${a.dir}`);
function marcadorNumero(a, n, tip) {
  const icon = L.divIcon({ className: "num", html: `<span>${n}</span>`, iconSize: [24, 24], iconAnchor: [12, 12] });
  L.marker([a.lat, a.lon], { icon }).bindTooltip(tip).addTo(capaCercanas).on("click", () => map.flyTo([a.lat, a.lon], 14));
}
function barra(cont) {
  const tot = cont.reduce((a, b) => a + b, 0) || 1;
  return `<div class="barra">${cont.map((v, z) => v ? `<span style="width:${(100 * v) / tot}%;background:${color(z)}" title="${ZONAS_CORTAS[z]}"></span>` : "").join("")}</div>`;
}

// ---------------------------------------------------------------- selección de un lugar
function seleccionar(lat, lon, titulo, subtitulo = "") {
  activarTab("buscar");
  if (marcadorSel) map.removeLayer(marcadorSel);
  if (circuloSel) map.removeLayer(circuloSel);
  capaCercanas.clearLayers();
  marcadorSel = L.marker([lat, lon]).addTo(map);
  circuloSel = L.circle([lat, lon], { radius: RADIO_KM * 1000, color: "#fff", weight: 2, dashArray: "6 6", fill: false }).addTo(map);

  const i = celdaEn(lat, lon);
  const todas = areasCercanas(lat, lon, Infinity);
  const cerca = todas.slice(0, 5);
  const cont = resumenRadio(lat, lon, RADIO_KM);
  const kmCelda = (D.celdas.res_m / 1000) ** 2;
  const enRadio = todas.filter((a) => a.d <= RADIO_KM);

  cerca.forEach((a, k) => marcadorNumero({ lat: a.latC, lon: a.lonC }, k + 1, `Área ${k + 1}: ${dondeTxt(a)}`));

  let html = `<h2>${esc(titulo)}</h2>${subtitulo ? `<div class="hint">${esc(subtitulo)}</div>` : ""}`;
  if (i >= 0) {
    const z = D.celdas.z[i];
    html += `<div class="caja"><h3>En este punto</h3>${chip(z)}<div>${EXPLICACION[z]}</div>`;
    if (z !== 5) html += `<div class="hint">Probabilidad de estar entre lo más favorable: ${D.celdas.pa[i]} %</div>`;
    html += `</div>`;
  } else {
    html += `<div class="caja">Este punto está fuera del área estudiada.</div>`;
  }
  html += `<div class="caja"><h3>A menos de ${RADIO_KM} km</h3>${barra(cont)}`;
  const alto = (cont[0] + cont[1]) * kmCelda;
  html += alto > 0
    ? `<div>Hay <b>${alto.toFixed(1).replace(".", ",")} km²</b> de potencial alto en ${enRadio.length} área(s).</div>`
    : `<div>No hay zonas de potencial alto a menos de ${RADIO_KM} km.</div>`;
  html += `</div>`;
  if (cerca.length) {
    html += `<div class="caja"><h3>Áreas de potencial alto más cercanas</h3><ul class="cerca">` +
      cerca.map((a, k) => `<li data-lat="${a.latC}" data-lon="${a.lonC}"><b>${k + 1}.</b> ${dondeTxt(a)}` +
        ` · ${a.km2.toFixed(1).replace(".", ",")} km²${a.municipio ? ` · ${esc(a.municipio)}` : ""}` +
        `<br><small class="hint">${a.confianza_alta_pct} % con confianza alta</small></li>`).join("") + `</ul></div>`;
  }
  html += `<p class="hint">Recuerde: “potencial alto” significa que se parece a donde hay minas; no garantiza esmeralda.</p>`;
  $("#detalle").innerHTML = html;
  $("#detalle").querySelectorAll(".cerca li").forEach((li) =>
    li.addEventListener("click", () => map.flyTo([+li.dataset.lat, +li.dataset.lon], 14)));

  map.flyTo([lat, lon], 12, { duration: 0.8 });
  mostrarPanel();
}

// ---------------------------------------------------------------- buscador
function iniciarBuscador() {
  const items = [
    ...D.poblados.map((p) => ({ nombre: p.nombre, sub: `${p.tipo === "town" ? "Pueblo" : p.tipo === "village" ? "Vereda / caserío" : "Lugar"}${p.municipio ? " · " + p.municipio : ""}`, lat: p.lat, lon: p.lon })),
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
    $("#ubicacion").textContent = "Buscando su ubicación…";
    navigator.geolocation.getCurrentPosition(
      (p) => { $("#ubicacion").textContent = "📍 Usar mi ubicación"; seleccionar(p.coords.latitude, p.coords.longitude, "Su ubicación"); },
      () => { $("#ubicacion").textContent = "📍 Usar mi ubicación"; alertaDetalle("No fue posible obtener la ubicación. Revise los permisos del navegador o busque su pueblo por nombre."); },
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
  const capa = L.geoJSON(f);
  map.flyToBounds(capa.getBounds(), { padding: [20, 20], duration: 0.8 });
  const p = f.properties, km = [0, 1, 2, 3, 4, 5].map((z) => p[`km2_${z}`] || 0);
  const tot = km.reduce((a, b) => a + b, 0);
  const areas = D.areas.filter((a) => a.municipio === p.shapeName && a.km2 >= AREA_MIN_KM2).slice(0, 8);
  areas.forEach((a, k) => marcadorNumero(a, k + 1, `${a.km2.toFixed(1).replace(".", ",")} km²`));
  let html = `<h2>${esc(p.shapeName)}</h2><div class="hint">Municipio · ${tot.toFixed(0)} km² dentro del área estudiada</div>`;
  html += `<div class="caja"><h3>Cómo se reparte el territorio</h3>${barra(km)}<ul class="leyenda">` +
    km.map((v, z) => v ? `<li><i style="background:${color(z)}"></i>${ZONAS_CORTAS[z]}: ${v.toFixed(1).replace(".", ",")} km² (${Math.round((100 * v) / tot)} %)</li>` : "").join("") + `</ul></div>`;
  if (areas.length) {
    html += `<div class="caja"><h3>Áreas de potencial alto más grandes</h3><ul class="cerca">` +
      areas.map((a, k) => `<li data-lat="${a.lat}" data-lon="${a.lon}"><b>${k + 1}.</b> ${a.km2.toFixed(1).replace(".", ",")} km² · ${a.confianza_alta_pct} % con confianza alta</li>`).join("") + `</ul></div>`;
  } else {
    html += `<div class="caja">Este municipio no tiene áreas de potencial alto dentro del área estudiada.</div>`;
  }
  $("#detalle").innerHTML = html;
  $("#detalle").querySelectorAll(".cerca li").forEach((li) =>
    li.addEventListener("click", () => map.flyTo([+li.dataset.lat, +li.dataset.lon], 14)));
  mostrarPanel();
}
function iniciarMunicipios() {
  const feats = [...D.municipios.features].sort((a, b) =>
    (b.properties.km2_0 + b.properties.km2_1) - (a.properties.km2_0 + a.properties.km2_1));
  $("#lista-municipios").innerHTML = feats.map((f, k) => {
    const p = f.properties, km = [0, 1, 2, 3, 4, 5].map((z) => p[`km2_${z}`] || 0);
    return `<li data-k="${k}"><b>${esc(p.shapeName)}</b>${barra(km)}<small>Potencial alto: ${(km[0] + km[1]).toFixed(1).replace(".", ",")} km²</small></li>`;
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
  $("#meta").textContent = `${D.meta.modelo} · Inferencia: ${D.meta.inferencia} · Datos del ${D.meta.fecha} · Cuadros de ${D.meta.res_m} m.`;
  document.querySelectorAll(".tab").forEach((b) => b.addEventListener("click", () => activarTab(b.dataset.tab)));
  $("#toggle-panel").addEventListener("click", () => { $("#panel").classList.toggle("oculto"); setTimeout(() => map.invalidateSize(), 50); });
  $("#cargando").remove();
}
main();
