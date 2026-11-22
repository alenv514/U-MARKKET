self.addEventListener('push', function (event) {
  if (event.data) {
    const data = event.data.json()
    const options = {
      body: data.body,
      icon: data.icon || '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      vibrate: [100, 50, 100], // Will only vibrate on supported devices if system allows
      data: {
        dateOfArrival: Date.now(),
        primaryKey: '2',
        url: data.url || '/'
      }
    }
    event.waitUntil(self.registration.showNotification(data.title, options))
  }
})

self.addEventListener('notificationclick', function (event) {
  event.notification.close()
  let urlToOpen = '/'
  try {
    const rawUrl = event.notification.data && event.notification.data.url
    if (typeof rawUrl === 'string') {
      const parsed = new URL(rawUrl, self.location.origin)
      if (parsed.origin === self.location.origin) {
        urlToOpen = parsed.pathname + parsed.search + parsed.hash
      }
    }
  } catch {
    urlToOpen = '/'
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i]
        if (client.url.startsWith(self.location.origin) && 'focus' in client) {
          client.navigate(urlToOpen)
          return client.focus()
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen)
      }
    })
  )
})
