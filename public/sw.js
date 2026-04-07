// ============================================================
// Service Worker — Opções PRO X
// Handles persistent push notifications for Box Tracker alerts
// ============================================================

const CACHE_NAME = 'opcoes-prox-v2';

// Install — activate immediately
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// Activate — claim all clients immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(
    self.clients.claim().then(() => {
      console.log('[SW] Activated and claimed all clients');
    })
  );
});

// Listen for push notification messages from the app
self.addEventListener('message', (event) => {
  console.log('[SW] Received message:', event.data?.type);
  
  if (event.data && event.data.type === 'BOX_ALERT') {
    const { title, body, tag, data } = event.data;
    const isUrgent = data?.priority === 'urgent';
    
    event.waitUntil(
      self.registration.showNotification(title, {
        body,
        icon: '/favicon.png',
        badge: '/favicon.png',
        tag: tag || 'box-tracker-alert',
        vibrate: isUrgent
          ? [300, 100, 300, 100, 300, 100, 500]
          : [200, 100, 200, 100, 300],
        requireInteraction: true,
        renotify: true,
        silent: data?.sound === false,
        actions: [
          { action: 'open', title: '📊 Ver Box Tracker' },
          { action: 'dismiss', title: 'Dispensar' },
        ],
        data: data || {},
      }).then(() => {
        console.log('[SW] Notification shown:', title);
      }).catch((err) => {
        console.error('[SW] Notification error:', err);
      })
    );
  }
  
  // Ping/pong for health check
  if (event.data && event.data.type === 'PING') {
    event.source?.postMessage({ type: 'PONG', timestamp: Date.now() });
  }
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  if (event.action === 'dismiss') return;
  
  // Open or focus the Box Tracker page
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Try to find an existing window and focus it
      for (const client of clientList) {
        if (client.url.includes('/box-tracker') && 'focus' in client) {
          return client.focus();
        }
      }
      // If no window found, navigate existing one
      for (const client of clientList) {
        if ('focus' in client) {
          client.navigate('/box-tracker');
          return client.focus();
        }
      }
      // Last resort: open new window
      if (self.clients.openWindow) {
        return self.clients.openWindow('/box-tracker');
      }
    })
  );
});

// Handle fetch — passthrough (SW exists for notifications only)
self.addEventListener('fetch', (event) => {
  return;
});
