// Service worker: la app funciona sin señal en el campo.
// - Archivos de la app y datos del modelo: se guardan al instalar (se renuevan cuando cambia VERSION).
// - Bloques de explicación y teselas del mapa base que el usuario ya vio: se guardan al usarlos (máx. ~3000 teselas).
const VERSION = "v2-202611261039";
const BASE = ["./", "index.html", "app.js", "style.css", "manifest.json", "icono.svg",
  "data/grilla.json", "data/zonas.png", "data/municipios.geojson", "data/poblados.json", "data/areas_alto.json",
  "data/meta.json", "data/corredores.geojson", "data/estructuras.geojson", "data/titulos.geojson",
  "data/profundidad_muzo.png", "data/explica.json",
  "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css", "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js",
  "https://cdnjs.cloudflare.com/ajax/libs/proj4js/2.11.0/proj4.js"];
const MAX_TESELAS = 3000;

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(`app-${VERSION}`).then((c) => c.addAll(BASE)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith("app-") && k !== `app-${VERSION}`)
    .map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
async function recortar(cache) {
  const ks = await cache.keys();
  for (let i = 0; i < ks.length - MAX_TESELAS; i++) await cache.delete(ks[i]);
}
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET") return;
  const esTesela = /arcgisonline|tile\.openstreetmap|opentopomap/.test(url.hostname);
  const esDetalle = url.pathname.includes("/data/detalle/");
  if (esTesela || esDetalle) {
    const nombre = esTesela ? "teselas" : `app-${VERSION}`;
    e.respondWith(caches.open(nombre).then(async (c) => {
      const hit = await c.match(e.request);
      if (hit) return hit;
      try {
        const r = await fetch(e.request);
        if (r.ok || r.type === "opaque") { c.put(e.request, r.clone()); if (esTesela) recortar(c); }
        return r;
      } catch (err) { return hit || Response.error(); }
    }));
    return;
  }
  // Lo demás: primero la red (para tener datos nuevos), si no hay señal, lo guardado.
  e.respondWith(fetch(e.request).then((r) => {
    if (r.ok && url.origin === location.origin) caches.open(`app-${VERSION}`).then((c) => c.put(e.request, r.clone()));
    return r;
  }).catch(() => caches.match(e.request, { ignoreSearch: true })));
});
