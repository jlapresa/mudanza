// Service worker: guarda en caché las páginas y recursos ya visitados para que la app
// abra con conexión débil. Los cambios sin conexión los gestiona la cola en IndexedDB.
const CACHE = "mudanza-v1";
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", (e) => {
  const r = e.request;
  if (r.method !== "GET") return;
  const url = new URL(r.url);
  if (url.origin !== location.origin || url.pathname.startsWith("/api/auth")) return;
  const estatico = url.pathname.startsWith("/_next/static") || url.pathname.startsWith("/api/fotos");
  if (estatico) {
    e.respondWith(
      caches.open(CACHE).then(async (c) => {
        const hit = await c.match(r);
        if (hit) return hit;
        const resp = await fetch(r);
        if (resp.ok) c.put(r, resp.clone());
        return resp;
      }),
    );
    return;
  }
  if (r.mode === "navigate") {
    e.respondWith(
      fetch(r)
        .then((resp) => {
          const copia = resp.clone();
          caches.open(CACHE).then((c) => c.put(r, copia));
          return resp;
        })
        .catch(() => caches.match(r).then((x) => x || new Response("Sin conexión. Vuelve a intentarlo en un momento.", { headers: { "content-type": "text/plain; charset=utf-8" } }))),
    );
  }
});
