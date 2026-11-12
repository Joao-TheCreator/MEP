// Service worker: makes the app installable, caches static assets and shows the
// phone notices (Web Push, design §23). Game data is always fetched from the
// network (server is the source of truth).
const CACHE = "sitio-v2";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;
  // immutable build assets: cache-first
  if (url.pathname.startsWith("/_next/static/") || /\.(svg|png|woff2?)$/.test(url.pathname)) {
    e.respondWith(
      caches.open(CACHE).then(async (c) => {
        const hit = await c.match(e.request);
        if (hit) return hit;
        const res = await fetch(e.request);
        if (res.ok) c.put(e.request, res.clone());
        return res;
      }),
    );
  }
});

// a notice from the notify cron: { title, body, url, tag }
self.addEventListener("push", (e) => {
  let msg = { title: "Sítio Dae Han", body: "", url: "/", tag: "sitio" };
  try {
    msg = { ...msg, ...e.data.json() };
  } catch {
    if (e.data) msg.body = e.data.text();
  }
  e.waitUntil(
    self.registration.showNotification(msg.title, {
      body: msg.body,
      tag: msg.tag,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      data: { url: msg.url },
    }),
  );
});

// tapping the notice opens the game on the right tab (or focuses it)
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = new URL(e.notification.data?.url || "/", self.location.origin).href;
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if (new URL(c.url).origin === self.location.origin && "focus" in c) {
          c.navigate(url).catch(() => {});
          return c.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
