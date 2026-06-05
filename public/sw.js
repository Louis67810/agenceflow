self.addEventListener('push', (event) => {
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch {
      data = { title: 'AgenceFlow', body: event.data.text() };
    }
  }

  const title = data.title || 'AgenceFlow';
  const options = {
    body: data.body || '',
    icon: data.icon || '/web-app-icon.svg',
    badge: data.badge || '/web-app-badge.svg',
    tag: data.tag || 'agenceflow-notification',
    data: { url: data.url || '/admin/agenda' },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = new URL(event.notification.data?.url || '/admin/agenda', self.location.origin).href;

  event.waitUntil((async () => {
    const clientsList = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of clientsList) {
      if ('focus' in client) {
        await client.focus();
        if ('navigate' in client) return client.navigate(targetUrl);
      }
    }
    return clients.openWindow(targetUrl);
  })());
});
