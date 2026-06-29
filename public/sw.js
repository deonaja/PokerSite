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
  const url = data.url || '/'
  const options = {
    body: data.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    // Vibrate on Android (ignored on iOS/desktop). Short pulse-gap-pulse.
    vibrate: [200, 100, 200],
    data: { url },
  }
  // A tag collapses/replaces a prior notification of the same tag. Without
  // renotify, that replacement is SILENT (no banner/sound) — so a second push
  // with the same tag looks like "nothing happened" if the first is still in
  // the tray. renotify forces a fresh alert each time.
  if (data.tag) {
    options.tag = data.tag
    options.renotify = true
  }

  // On Android Chrome, when the app is in the FOREGROUND the native banner
  // doesn't appear — the OS assumes the user can already see the app. To make
  // notifications visible in that case, broadcast the payload to every open
  // client window so the app can render an in-app toast alongside (the native
  // notification still drops into the tray). Backgrounded → only native fires.
  event.waitUntil(
    Promise.all([
      self.registration.showNotification(title, options),
      self.clients
        .matchAll({ type: 'window', includeUncontrolled: true })
        .then((clientList) => {
          for (const client of clientList) {
            client.postMessage({
              type: 'push',
              payload: { title, body: data.body || '', url, tag: data.tag },
            })
          }
        }),
    ])
  )
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
