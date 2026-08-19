
// ==========================================
// SERVICE WORKER UNTUK PWA & NOTIFIKASI
// ==========================================

self.addEventListener("install", (e) => {
  console.log("[Service Worker] Installed");
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  console.log("[Service Worker] Activated");
});

self.addEventListener("fetch", (e) => {
  // Biarkan network lalu secara normal supaya data MQTT kekal live
  e.respondWith(fetch(e.request));
});

// Menangkap event Push Notification dari pelayan/latar belakang
self.addEventListener('push', function(event) {
    let data = { title: 'AMARAN TPMS LORI', body: 'Tayar bermasalah dikesan!' };
    
    if (event.data) {
        try {
            data = event.data.json();
        } catch (e) {
            data.body = event.data.text();
        }
    }

    const options = {
        body: data.body,
        icon: '192icon.png',
        badge: '192icon.png',
        vibrate: [300, 100, 300, 100, 300], // Getar berulang kali
        tag: 'tpms-warning',
        renotify: true
    };

    event.waitUntil(
        self.registration.showNotification(data.title, options)
    );
});

// Tindakan apabila pengguna klik pada notifikasi
self.addEventListener('notificationclick', function(event) {
    event.notification.close();
    event.waitUntil(
        clients.openWindow('./index.html')
    );
});
