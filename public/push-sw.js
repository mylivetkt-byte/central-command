// Service worker dedicado a Web Push para el driver.
// No cachea nada del app shell, solo maneja notificaciones push.

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "Nuevo pedido", body: event.data ? event.data.text() : "" };
  }

  const title = data.title || "Nuevo pedido disponible";
  const options = {
    body: data.body || "Toca para ver el detalle",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    vibrate: [200, 100, 200],
    tag: data.delivery_id ? `delivery-${data.delivery_id}` : "push",
    renotify: true,
    requireInteraction: true,
    data: {
      url: data.url || "/driver",
      delivery_id: data.delivery_id,
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || "/driver";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
    }),
  );
});