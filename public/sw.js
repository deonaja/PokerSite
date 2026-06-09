/* PokerAja service worker — PUSH ONLY.
 *
 * Deliberately does NO offline caching: the app needs the network/DB to be
 * useful, so caching was intentionally skipped when the PWA was added. This
 * worker exists solely to receive Web Push events and surface notifications
 * (which require an active service worker).
 */

// Show a notification when a push arrives. Payload is JSON: {title, body, url}.
self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { body: event.data ? event.data.text() : '' }
  }

  const title = data.title || 'PokerAja'
  const options = {
    body: data.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: { url: data.url || '/' },
    tag: data.tag || undefined, // same tag collapses/replaces a prior notification
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

// Focus an existing app tab (or open one) when the notification is clicked.
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const targetUrl = (event.notification.data && event.notification.data.url) || '/'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        // Reuse a tab already on the same origin.
        if ('focus' in client) {
          client.navigate(targetUrl).catch(() => {})
          return client.focus()
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl)
    })
  )
})

// Activate immediately on update so push handling is never stale.
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))
