/* CYI public-content PWA. Change VERSION whenever the offline shell changes.
 * Private collections, credentials, RSC payloads, media streams and APIs are never cached.
 * Waiting updates activate only after an explicit APPLY_UPDATE message or normal browser lifecycle.
 */
const VERSION = (new URL(self.location.href).searchParams.get("v") || "2026-09-13.1").replace(/[^a-zA-Z0-9.-]/g, "").slice(0, 64);
const PREFIX = "cyi-pwa-";
const CACHE = {
  core: `${PREFIX}${VERSION}-core`,
  pages: `${PREFIX}${VERSION}-pages`,
  static: `${PREFIX}${VERSION}-static`,
  media: `${PREFIX}${VERSION}-media`,
};
const OFFLINE_URL = "/offline.html";
const CORE_PAGES = ["/", "/about", "/branches", "/environments", "/precious-moments", "/devotionals/the-lord-gives-wisdom", "/install"];
const CORE_ASSETS = [OFFLINE_URL, "/icons/icon-192.png", "/icons/icon-512.png", "/icons/apple-touch-icon.png", "/fonts/manrope.woff2", "/fonts/barlow-condensed-800.ttf"];
const PUBLIC_PAGES = new Set([...CORE_PAGES, "/explore", "/archive", "/projects", "/resources", "/leadership", "/gallery", "/stories", "/ministries", "/privacy"]);
const MAX = { pages: 20, static: 96, media: 36 };
const MAX_BYTES = { page: 2 * 1024 * 1024, static: 4 * 1024 * 1024, media: 1536 * 1024 };

function publicPage(url) {
  return url.origin === self.location.origin && !url.search &&
    (PUBLIC_PAGES.has(url.pathname) || /^\/(?:devotionals|programmes|branches|projects|resources)\/[a-z0-9-]+\/?$/.test(url.pathname));
}

function assetKind(url) {
  if (url.origin !== self.location.origin) return "";
  if (url.pathname.startsWith("/_next/static/") && /\.(?:js|css|woff2?|ttf|otf|png|jpe?g|webp|avif|svg|ico)$/i.test(url.pathname) &&
      [...url.searchParams.keys()].every(key => key === "dpl")) return "static";
  if (url.search) return "";
  if (/^\/fonts\/[^/]+\.(?:woff2?|ttf|otf)$/i.test(url.pathname) ||
      /^\/icons\/[^/]+\.(?:png|svg|ico)$/i.test(url.pathname) || url.pathname === "/favicon.png") return "static";
  if (/^\/media\/[^/]+\.(?:png|jpe?g|webp|avif|svg)$/i.test(url.pathname)) return "media";
  return "";
}

function excluded(request, url) {
  return request.method !== "GET" || url.origin !== self.location.origin ||
    request.headers.has("authorization") || request.headers.has("cookie") ||
    (request.credentials === "include" && request.mode !== "navigate" && !assetKind(url)) || request.headers.has("range") ||
    request.cache === "no-store" || request.headers.has("rsc") ||
    request.headers.has("next-router-state-tree") || request.headers.has("next-router-prefetch") ||
    request.headers.has("next-action") || url.searchParams.has("_rsc") ||
    /(?:^|\/)api(?:\/|$)/.test(url.pathname) ||
    /^\/(?:my-cyi|account|admin|auth|login|logout|collection)(?:\/|$)/.test(url.pathname) ||
    /\.(?:mp4|webm|m3u8|mp3|m4a|ogg|wav)(?:$|\?)/i.test(url.pathname);
}

function cacheable(response, expectedType) {
  if (!response || !response.ok || response.status !== 200 || response.redirected || response.type === "opaque") return false;
  const policy = response.headers.get("cache-control") || "";
  const vary = response.headers.get("vary") || "";
  const type = response.headers.get("content-type") || "";
  return !/(?:private|no-store)/i.test(policy) && !response.headers.has("set-cookie") &&
    !/(?:\*|cookie|authorization)/i.test(vary) && !type.includes("text/x-component") &&
    (!expectedType || expectedType.test(type));
}

const cacheWrites = new Map();
function putBounded(name, key, response, limit, maxBytes) {
  // Serialize writes per cache so concurrent image requests cannot exceed the limit.
  const previous = cacheWrites.get(name) || Promise.resolve();
  const pending = previous.catch(() => {}).then(async () => {
    if (Number(response.headers.get("content-length")) > maxBytes) return;
    const bytes = await response.clone().arrayBuffer();
    if (bytes.byteLength > maxBytes) return;
    const cache = await caches.open(name);
    await cache.put(key, response);
    const keys = await cache.keys();
    await Promise.all(keys.slice(0, Math.max(0, keys.length - limit)).map(old => cache.delete(old)));
  }).catch(() => { /* Storage limits must not break the online experience. */ });
  cacheWrites.set(name, pending);
  return pending;
}

async function anonymousPage(path, cacheName = CACHE.pages) {
  const url = new URL(path, self.location.origin);
  if (!publicPage(url)) return;
  const response = await fetch(new Request(url.href, { credentials: "omit", cache: "reload", headers: { Accept: "text/html" } }));
  if (!cacheable(response, /text\/html/i)) return;
  await putBounded(cacheName, url.href, response.clone(), cacheName === CACHE.core ? 64 : MAX.pages, MAX_BYTES.page);
  return response;
}

async function preloadShellAssets(response) {
  if (!response) return;
  const html = await response.text();
  const urls = [...html.matchAll(/(?:src|href)=["']([^"']+)["']/g)]
    .map(match => new URL(match[1].replace(/&amp;/g, "&"), self.location.origin))
    .filter(url => url.origin === self.location.origin && url.pathname.startsWith("/_next/static/") && /\.(?:js|css)$/.test(url.pathname));
  await Promise.allSettled([...new Set(urls.map(url => url.href))].slice(0, 48).map(async href => {
    const response = await fetch(new Request(href, { credentials: "omit" }));
    if (cacheable(response)) await putBounded(CACHE.static, href, response, MAX.static, MAX_BYTES.static);
  }));
}

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    // This standalone page is the only required install dependency.
    const fallback = await fetch(new Request(new URL(OFFLINE_URL, self.location.origin), { credentials: "omit", cache: "reload" }));
    if (!cacheable(fallback, /text\/html/i)) throw new Error("Offline page is unavailable");
    await (await caches.open(CACHE.core)).put(OFFLINE_URL, fallback);
    await Promise.allSettled([
      ...CORE_ASSETS.filter(path => path !== OFFLINE_URL).map(async path => {
        const response = await fetch(new Request(new URL(path, self.location.origin), { credentials: "omit", cache: "reload" }));
        if (cacheable(response)) await putBounded(CACHE.core, path, response, 64, MAX_BYTES.static);
      }),
      ...CORE_PAGES.map(async path => preloadShellAssets(await anonymousPage(path, CACHE.core))),
    ]);
    // Do not call skipWaiting here: an update must not interrupt an open reflection or form.
  })());
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const current = new Set(Object.values(CACHE));
    const keys = await caches.keys();
    const oldGenerations = [...new Set(keys.filter(key => key.startsWith(PREFIX) && !current.has(key)).map(key => key.replace(/-(?:core|pages|static|media)$/, "")))];
    const previousGeneration = oldGenerations.at(-1);
    // One previous generation keeps old hashed assets usable in tabs awaiting a manual reload.
    await Promise.all(keys.filter(key => key.startsWith(PREFIX) && !current.has(key) && (!previousGeneration || !key.startsWith(previousGeneration + "-"))).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

async function documentFallback(url) {
  const cached = await (await caches.open(CACHE.pages)).match(url.href) || await (await caches.open(CACHE.core)).match(url.href);
  return cached || await (await caches.open(CACHE.core)).match(OFFLINE_URL) ||
    new Response("CYI is offline. Reconnect and try again.", { status: 503, headers: { "Content-Type": "text/plain" } });
}

async function networkDocument(request, url) {
  try {
    const response = await fetch(request);
    if (response.status >= 500) return documentFallback(url);
    return response;
  } catch {
    return documentFallback(url);
  }
}

async function cachedAsset(request, cacheName, maxEntries, maxBytes) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request) || await (await caches.open(CACHE.core)).match(request);
  if (cached) return cached;
  if (new URL(request.url).pathname.startsWith("/_next/static/")) {
    const names = await caches.keys();
    const previous = names.filter(name => name.startsWith(PREFIX) && name.endsWith("-static") && name !== CACHE.static).at(-1);
    if (previous) {
      const oldAsset = await (await caches.open(previous)).match(request);
      if (oldAsset) return oldAsset;
    }
  }
  // Only allowlisted public assets reach this function. Fetch their anonymous copy,
  // including for the browser's normal no-cors/include image and classic-script requests.
  const anonymous = new Request(request.url, { credentials: "omit", headers: { Accept: request.headers.get("accept") || "*/*" } });
  const response = await fetch(anonymous);
  if (cacheable(response)) await putBounded(cacheName, request.url, response.clone(), maxEntries, maxBytes);
  return response;
}

self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);
  if (excluded(request, url)) return;
  if (request.mode === "navigate") {
    if (!publicPage(url)) {
      // Unknown public form routes are not stored. A connection failure gets a static guide.
      event.respondWith(fetch(request).catch(() => documentFallback(new URL(OFFLINE_URL, self.location.origin))));
      return;
    }
    event.respondWith(networkDocument(request, url));
    // Cache an independently fetched anonymous copy, never the credentialed navigation response.
    event.waitUntil(anonymousPage(url.href).catch(() => {}));
    return;
  }
  const kind = assetKind(url);
  if (kind === "static") {
    event.respondWith(cachedAsset(request, CACHE.static, MAX.static, MAX_BYTES.static));
  } else if (kind === "media") {
    event.respondWith(cachedAsset(request, CACHE.media, MAX.media, MAX_BYTES.media));
  }
});

self.addEventListener("message", event => {
  // Only same-origin window clients can request a cache write or update activation.
  if (!event.source?.url || new URL(event.source.url).origin !== self.location.origin) return;
  if (event.data?.type === "APPLY_UPDATE") {
    event.waitUntil(self.skipWaiting());
  } else if (event.data?.type === "CACHE_PUBLIC_PAGE" && typeof event.data.path === "string") {
    event.waitUntil(anonymousPage(event.data.path).catch(() => {}));
  } else if (event.data?.type === "GET_OFFLINE_STATUS") {
    event.waitUntil((async () => {
      const core = await caches.open(CACHE.core);
      const pages = await caches.open(CACHE.pages);
      const paths = [...await core.keys(), ...await pages.keys()].map(key => new URL(key.url)).filter(publicPage).map(url => url.pathname);
      event.ports[0]?.postMessage({ type: "OFFLINE_STATUS", version: VERSION, pages: [...new Set(paths)], ready: !!(await core.match(OFFLINE_URL)) });
    })());
  }
});
