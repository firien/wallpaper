(function() {
  var $cacheName, $prefix, $urls, clearPreviousCaches, tag;

  tag = '2';

  $prefix = 'WALLPAPER';

  $cacheName = `${$prefix}-${tag}`;

  $urls = ['/wallpaper/bundle.fa6b2ff660225ed38954.js', '/wallpaper/javascripts/index.361a87f057db138e1cdf.js', '/wallpaper/javascripts/worker.fc1a8a370ee02fae536d.js', '/wallpaper/stylesheets/index.17ab6e38c1a2be578904.css', '/wallpaper/images/icon-152.2ddfea64487a68dc9247.png', '/wallpaper/images/icon-167.fcb0a0a29f380f1d9937.png', '/wallpaper/images/icon-180.e19bd0c394cfa5bff277.png', '/wallpaper/images/icon-192.dff211fb3b1f56231b67.png', '/wallpaper/images/icon-512.e30b9f0096c2761c6181.png', '/wallpaper/pwa.14204bfe81a0e47671e8.js', '/wallpaper/manifest.webmanifest', '/wallpaper/index.html', '/wallpaper/'];

  self.addEventListener('install', function(event) {
    return event.waitUntil(caches.open($cacheName).then(function(cache) {
      return cache.addAll($urls);
    }));
  });

  clearPreviousCaches = function() {
    return caches.keys().then(function(keys) {
      return Promise.all(keys.filter(function(key) {
        return (key !== $cacheName) && key.startsWith($prefix);
      }).map(function(key) {
        return caches.delete(key);
      }));
    });
  };

  self.addEventListener('activate', function(event) {
    return event.waitUntil(clearPreviousCaches());
  });

  self.addEventListener('fetch', function(event) {
    return event.respondWith(caches.open($cacheName).then(function(cache) {
      return cache.match(event.request, {
        ignoreSearch: true
      });
    }).then(function(response) {
      return response || fetch(event.request);
    }));
  });

  self.addEventListener('message', function(event) {
    if (event.data.action === 'skipWaiting') {
      return self.skipWaiting();
    }
  });

}).call(this);
