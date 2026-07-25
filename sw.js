// Service worker asas untuk PWA
self.addEventListener("install", (e) => {
  console.log("[Service Worker] Installed");
});

self.addEventListener("fetch", (e) => {
  // Biarkan network lalu secara normal supaya data MQTT kekal live
  e.respondWith(fetch(e.request));
});