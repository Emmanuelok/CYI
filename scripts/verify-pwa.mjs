import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const origin = "https://cyi.test";
const listeners = {};
const buckets = new Map();
const normalize = input => new URL(typeof input === "string" ? input : input.url, origin).href;
class MemoryCache {
  entries = new Map();
  async put(key, response) { this.entries.set(normalize(key), response.clone()); }
  async match(key) { return this.entries.get(normalize(key))?.clone(); }
  async keys() { return [...this.entries.keys()].map(url => new Request(url)); }
  async delete(key) { return this.entries.delete(normalize(key)); }
}
let fetchHandler = async () => { throw new Error("offline"); };
let activated = 0;
let claimed = 0;
const context = vm.createContext({
  URL, Request, Response, Headers, Set, Map, Promise, Error, console,
  fetch: request => fetchHandler(request),
  caches: {
    open: async name => { if (!buckets.has(name)) buckets.set(name, new MemoryCache()); return buckets.get(name); },
    keys: async () => [...buckets.keys()],
    delete: async name => buckets.delete(name),
  },
  self: { location: { origin, href: origin + "/sw.js?v=build-current" },
    addEventListener: (type, listener) => { listeners[type] = listener; },
    skipWaiting: async () => { activated++; }, clients: { claim: async () => { claimed++; } },
  },
});
vm.runInContext(readFileSync(new URL("../public/sw.js", import.meta.url), "utf8"), context);
const call = (name, ...args) => context[name](...args);
const request = (path, options = {}) => ({ url: new URL(path, origin).href, method: "GET", headers: new Headers(), credentials: "same-origin", mode: "cors", cache: "default", ...options });
let assertions = 0;
function check(value, note) { assert.ok(value, note); assertions++; }
for (const input of [
  request("/api/collection"), request("/my-cyi"), request("/my-cyi/reflection"), request("/account"), request("https://player.vimeo.com/video/1"),
  request("/branches", { method: "POST" }), request("/about?_rsc=secret"), request("/about", { headers: new Headers({ rsc: "1" }) }),
  request("/about", { headers: new Headers({ Authorization: "Bearer secret" }) }), request("/about", { headers: new Headers({ Cookie: "session=private" }) }),
  request("/about", { headers: new Headers({ "Next-Router-State-Tree": "private" }) }), request("/about", { cache: "no-store" }),
  request("/media/film.mp4"), request("/media/audio.mp3"), request("/media/photo.webp", { headers: new Headers({ Range: "bytes=0-100" }) }),
]) check(call("excluded", input, new URL(input.url)), `Bypass sensitive request ${input.url}`);
check(!call("excluded", request("/about", { mode: "navigate", credentials: "include" }), new URL(origin + "/about")), "Real browser document navigation remains offline-capable");
check(call("publicPage", new URL(origin + "/devotionals/the-lord-gives-wisdom")), "Public devotional allowlist");
for (const path of ["/connect", "/api/collection", "/my-cyi", "/about?secret=x", "/unknown", "/programmes/a/b"]) check(!call("publicPage", new URL(origin + path)), `Do not cache ${path}`);
for (const headers of [ { "Cache-Control": "private" }, { "Cache-Control": "no-store" }, { "Set-Cookie": "x=y" }, { Vary: "Cookie" }, { Vary: "Authorization" }, { "Content-Type": "text/x-component" } ]) {
  check(!call("cacheable", new Response("private", { headers }), null), "Reject private or RSC response");
}
check(!call("cacheable", new Response("failure", { status: 503 })), "Do not cache a failure");
const coreName = "cyi-pwa-build-current-core";
const core = await context.caches.open(coreName);
await core.put("/offline.html", new Response("offline reading room", { headers: { "Content-Type": "text/html" } }));
await core.put("/about", new Response("anonymous public about", { headers: { "Content-Type": "text/html" } }));
async function fetchEvent(input) {
  let response;
  const work = [];
  listeners.fetch({ request: input, respondWith: value => { response = value; }, waitUntil: value => work.push(value) });
  const result = response ? await response : undefined;
  await Promise.all(work);
  return result;
}
check((await (await fetchEvent(request("/about", { mode: "navigate", credentials: "include" }))).text()) === "anonymous public about", "Offline reload returns cached public HTML with normal browser credentials");
check((await (await fetchEvent(request("/branches", { mode: "navigate", credentials: "include" }))).text()) === "offline reading room", "Missing page returns useful standalone reading room");
check((await fetchEvent(request("/api/collection"))) === undefined, "API is never intercepted or faked offline");
check((await fetchEvent(request("/my-cyi", { mode: "navigate", credentials: "include" }))) === undefined, "Personal collection navigation is not cached or substituted");
let anonymousCredentials;
fetchHandler = async input => { anonymousCredentials = input.credentials; return new Response("public", { headers: { "Content-Type": "text/html" } }); };
await call("anonymousPage", "/branches");
check(anonymousCredentials === "omit", "Cached HTML comes from a separate request without credentials");
for (const path of ["/icons/icon-192.png", "/fonts/manrope.woff2", "/media/camp.webp", "/_next/static/chunks/app.js?dpl=build-123"]) {
  const input = request(path, { mode: "no-cors", credentials: "include" });
  check(!call("excluded", input, new URL(input.url)), `Browser no-cors/include asset is eligible: ${path}`);
  let credentials;
  fetchHandler = async fetched => { credentials = fetched.credentials; return new Response("public asset", { headers: { "Content-Type": path.includes(".js") ? "application/javascript" : "image/png" } }); };
  const first = await fetchEvent(input);
  check((await first.text()) === "public asset" && credentials === "omit", `Public asset cache is populated anonymously: ${path}`);
  fetchHandler = async () => { throw new Error("offline"); };
  check((await (await fetchEvent(input)).text()) === "public asset", `Browser asset loads offline with no-cors/include: ${path}`);
}
for (const path of ["/api/avatar.png", "/my-cyi/photo.png", "/icons/private.json", "/fonts/account", "/media/photo.webp?session=private", "/_next/static/chunks/app.js?token=secret"]) {
  check(call("excluded", request(path, { mode: "no-cors", credentials: "include" }), new URL(origin + path)), `Non-allowlisted include request is excluded: ${path}`);
}
const queued = [];
for (let i = 0; i < 14; i++) queued.push(call("putBounded", "cyi-pwa-bound-media", origin + "/media/" + i + ".webp", new Response("image"), 3, 100));
await Promise.all(queued);
check((await (await context.caches.open("cyi-pwa-bound-media")).keys()).length === 3, "Concurrent cache writes respect cache bound");
await call("putBounded", "cyi-pwa-size-media", origin + "/large.webp", new Response("123456"), 3, 5);
check((await (await context.caches.open("cyi-pwa-size-media")).keys()).length === 0, "Oversize responses are not stored");
let messageTasks = [];
listeners.message({ data: { type: "APPLY_UPDATE" }, source: { url: "https://evil.test" }, waitUntil: p => messageTasks.push(p) });
await Promise.all(messageTasks);
check(activated === 0, "Foreign origins cannot activate updates");
listeners.message({ data: { type: "GET_OFFLINE_STATUS" }, source: { url: origin + "/install" }, ports: [{ postMessage: data => { check(data.ready && data.pages.includes("/about"), "Offline readiness reports actual cached content"); } }], waitUntil: p => messageTasks.push(p) });
await Promise.all(messageTasks);
check(activated === 0, "Reading status never activates a waiting worker");
listeners.message({ data: { type: "APPLY_UPDATE" }, source: { url: origin + "/install" }, waitUntil: p => messageTasks.push(p) });
await Promise.all(messageTasks);
check(activated === 1, "Explicit consent activates update once");
await (await context.caches.open("cyi-pwa-older-static")).put("/_next/static/obsolete.js", new Response("obsolete"));
await (await context.caches.open("cyi-pwa-previous-static")).put("/_next/static/previous.js", new Response("previous app code"));
await context.caches.open("cyi-pwa-previous-core");
await context.caches.open("unrelated-private-cache");
const activationTasks = [];
listeners.activate({ waitUntil: p => activationTasks.push(p) });
await Promise.all(activationTasks);
check(buckets.has(coreName) && buckets.has("cyi-pwa-previous-static") && !buckets.has("cyi-pwa-older-static"), "Activation retains only the current and one previous generation");
check(buckets.has("unrelated-private-cache"), "Cleanup does not alter unrelated caches");
fetchHandler = async () => { throw new Error("offline"); };
check((await (await fetchEvent(request("/_next/static/previous.js"))).text()) === "previous app code", "Old open tabs can still use previous immutable assets after update");
check(claimed === 1, "Activated worker claims clients without reloading them");
const offline = readFileSync(new URL("../public/offline.html", import.meta.url), "utf8");
check((offline.match(/class="reading"/g) || []).length === 21, "Offline document includes all 21 complete devotionals");
check(!offline.includes("<script src="), "Offline reading has no external script dependency");
check(offline.includes("Keep this reading room open to continue reading."), "Direct online visit does not claim service-worker preparation");
const manager = readFileSync(new URL("../app/pwa-manager.tsx", import.meta.url), "utf8");
check(!/onControllerChange[\s\S]*?window\.location\.reload/.test(manager.split("function dismissOffer")[0]), "Controller changes never reload drafts automatically");
console.log(`PWA privacy, offline, bounds and lifecycle checks passed (${assertions} assertions).`);
