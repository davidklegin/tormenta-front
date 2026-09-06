/**
 * Service Worker para Web Push Notifications.
 *
 * Recebe notificações do servidor e exibe mesmo quando o app está fechado.
 */

self.addEventListener('push', function (event) {
  if (!event.data) {
    return;
  }

  const payload = event.data.json();

  const options = {
    body: payload.body || '',
    icon: payload.icon || '/icon-192.png',
    badge: '/icon-badge.png',
    tag: payload.tag || 'tormenta20',
    data: payload.data || {},
    vibrate: [200, 100, 200],
    requireInteraction: true,
  };

  event.waitUntil(self.registration.showNotification(payload.title || 'Tormenta20', options));
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();

  const data = event.notification.data;

  // Abrir o app na tela relevante
  let url = '/';

  if (data.type === 'combat_turn' && data.campaign_id) {
    url = `/campaigns/${data.campaign_id}`;
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
      // Se já tem uma janela aberta, foca nela
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      // Senão, abre uma nova
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});
