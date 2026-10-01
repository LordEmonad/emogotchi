// Emogotchi's service worker: push notifications and what a tap on one opens. Nothing else, on purpose: no caching, so
// a deploy is live the moment it lands and nothing here can ever serve a stale bundle on the origin that holds keys.
// Pushes come from worker/push.js (a pet's clock, an Emotown message, a fight); the payload is JSON { title, body, url, tag }.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { body: e.data ? e.data.text() : '' }; }
  const title = typeof d.title === 'string' && d.title ? d.title : 'Emogotchi';
  const url = typeof d.url === 'string' ? d.url : '/';
  e.waitUntil(self.registration.showNotification(title, {
    body: typeof d.body === 'string' ? d.body : '',
    icon: '/icon-192.png',
    badge: '/badge-96.png',
    tag: typeof d.tag === 'string' ? d.tag : undefined,
    renotify: typeof d.tag === 'string',
    data: { url },
  }));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || '/', self.location.origin);
  if (url.origin !== self.location.origin) return;   // only ever our own pages
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    for (const c of list) {
      if ('focus' in c) { if ('navigate' in c) c.navigate(url.href).catch(() => {}); return c.focus(); }
    }
    return self.clients.openWindow(url.href);
  }));
});
