// ============================================================
// Service Worker — Opções PRO X
// Handles persistent push notifications for Box Tracker alerts
// ============================================================

const CACHE_NAME = 'opcoes-prox-v1';

// Install — activate immediately
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// Activate — claim all clients
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Listen for push notification messages from the app
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'BOX_ALERT') {
    const { title, body, tag, data } = event.data;
    
    self.registration.showNotification(title, {
      body,
      icon: '/favicon.png',
      badge: '/favicon.png',
      tag: tag || 'box-tracker-alert',
      vibrate: [200, 100, 200, 100, 300],
      requireInteraction: true,
      renotify: true,
      actions: [
        { action: 'open', title: '📊 Ver Box Tracker' },
        { action: 'dismiss', title: 'Dispensar' },
      ],
      data: data || {},
    });
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
      // If no window found, open a new one
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

// Handle fetch — network first, no aggressive caching (just SW for notifications)
self.addEventListener('fetch', (event) => {
  // Don't intercept oauth routes
  if (event.request.url.includes('/~oauth')) return;
  
  // Pass through all requests — we only need SW for notifications
  return;
});
