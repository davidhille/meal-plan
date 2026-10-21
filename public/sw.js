// Service Worker: macht die App installierbar und lädt die Oberfläche schneller.
// Daten (/api) kommen immer live vom Server und werden nie zwischengespeichert.
const CACHE = 'speiseplaner-v5';

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(['/', '/manifest.webmanifest', '/icons/icon-192.png'])));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

  // Seite selbst: immer zuerst frisch vom Server (neue Version sofort), offline die gespeicherte
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put('/', copy));
          return res;
        })
        .catch(() => caches.match('/'))
    );
    return;
  }

  // Gebaute Dateien haben einen Hash im Namen und ändern sich nie → aus dem Speicher
  if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/icons/')) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(CACHE).then((c) => c.put(req, copy));
            }
            return res;
          })
      )
    );
  }
});

// Erinnerung zum Bewerten (Web Push vom Worker, siehe worker/push.ts)
self.addEventListener('push', (event) => {
  let msg = { title: 'miyummy', body: '', url: '/', tag: 'speiseplaner' };
  try {
    msg = { ...msg, ...event.data.json() };
  } catch {
    // ohne lesbaren Inhalt: allgemeine Meldung
  }
  event.waitUntil(
    self.registration.showNotification(msg.title, {
      body: msg.body,
      tag: msg.tag,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: { url: msg.url },
    })
  );
});

// Tipp auf die Benachrichtigung: offene App nach vorne holen, sonst öffnen
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || '/', self.location.origin);
  const rateName = target.searchParams.get('bewerten');
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (list) => {
      const open = list.find((c) => new URL(c.url).origin === self.location.origin);
      if (!open) return self.clients.openWindow(target.href);
      // App ist schon offen: nach vorne holen und das Bewerten-Fenster per Nachricht öffnen (kein Neuladen)
      await open.focus().catch(() => {});
      if (rateName) {
        open.postMessage({ type: 'bewerten', name: rateName });
        return;
      }
      return open.navigate(target.href).catch(() => {});
    })
  );
});
