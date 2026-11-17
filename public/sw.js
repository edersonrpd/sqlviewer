/*
 * Service worker do SQL Viewer: guarda a própria aplicação (HTML, scripts, estilos,
 * fontes e ícones) para ela abrir sem internet. Só arquivos do próprio site, nunca dados:
 * o que é colado continua só na memória da página.
 *
 * - Página: rede primeiro (pega a versão nova quando há internet), cache se estiver offline.
 * - /_next/static/*: cache primeiro (os nomes mudam a cada versão, o conteúdo nunca).
 * - Demais arquivos do site: cache, atualizado em segundo plano.
 */
const CACHE = "sqlviewer-app-v1";
const MAX_ARQUIVOS = 400;

/** Arquivos citados no HTML da página (scripts, estilos, fontes, ícones). */
function arquivosDaPagina(html) {
  const urls = new Set();
  for (const m of html.matchAll(/(?:src|href)="(\/[^"]+)"/g)) {
    const u = m[1].replace(/&amp;/g, "&");
    if (u.startsWith("/_next/") || u.startsWith("/icones/") || /^\/(icon|apple-icon|manifest)/.test(u)) urls.add(u);
  }
  return [...urls];
}

async function guardarPagina(resposta) {
  const cache = await caches.open(CACHE);
  await cache.put("/", resposta.clone());
  const html = await resposta.text();
  await Promise.all(
    arquivosDaPagina(html).map(async (u) => {
      if (await cache.match(u)) return;
      try {
        const r = await fetch(u);
        if (r.ok) await cache.put(u, r);
      } catch {
        // offline no meio da cópia: fica para a próxima visita
      }
    }),
  );
  await limitar(cache);
}

/** Mantém o cache pequeno: descarta os arquivos mais antigos (de versões anteriores). */
async function limitar(cache) {
  const chaves = await cache.keys();
  const excedente = chaves.length - MAX_ARQUIVOS;
  for (let i = 0; i < excedente; i++) if (new URL(chaves[i].url).pathname !== "/") await cache.delete(chaves[i]);
}

self.addEventListener("install", (e) => {
  e.waitUntil(
    fetch("/", { cache: "no-store" })
      .then((r) => (r.ok ? guardarPagina(r) : undefined))
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((nomes) => Promise.all(nomes.filter((n) => n.startsWith("sqlviewer-") && n !== CACHE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req)
        .then((r) => {
          if (r.ok && url.pathname === "/") e.waitUntil(guardarPagina(r.clone()));
          return r;
        })
        .catch(async () => (await caches.match("/")) ?? Response.error()),
    );
    return;
  }

  if (url.pathname.startsWith("/_next/static/")) {
    e.respondWith(
      caches.match(req).then(
        (salvo) =>
          salvo ??
          fetch(req).then((r) => {
            if (r.ok) {
              const copia = r.clone();
              e.waitUntil(caches.open(CACHE).then((c) => c.put(req, copia)));
            }
            return r;
          }),
      ),
    );
    return;
  }

  // ícones, manifesto e outros arquivos do site
  e.respondWith(
    caches.match(req).then((salvo) => {
      const rede = fetch(req)
        .then((r) => {
          if (r.ok) {
            const copia = r.clone();
            e.waitUntil(caches.open(CACHE).then((c) => c.put(req, copia)));
          }
          return r;
        })
        .catch(() => salvo ?? Response.error());
      return salvo ?? rede;
    }),
  );
});
