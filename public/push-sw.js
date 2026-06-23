self.addEventListener("push", function (event) {
  let data = {};

  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = {
      title: "New Store",
      body: "Você recebeu uma nova notificação.",
      url: "/me",
    };
  }

  const title = data.title || "New Store";

  const options = {
    body: data.body || "Você recebeu uma nova notificação.",
    icon: "/logo192.png",
    badge: "/logo192.png",
    data: {
      url: data.url || "/me",
      event_key: data.event_key || null,
      category: data.category || null,
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();

  const url =
    event.notification && event.notification.data && event.notification.data.url
      ? event.notification.data.url
      : "/me";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (clientList) {
      for (const client of clientList) {
        if ("focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }

      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});
