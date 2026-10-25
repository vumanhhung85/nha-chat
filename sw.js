/* Nhà Mình — service worker
   - Lưu sẵn giao diện để mở app nhanh
   - Nhận nội dung "Chia sẻ" từ app khác trên Android (share target)
   - Thông báo đẩy (Web Push): hiện thông báo, bấm vào thì mở đúng cuộc trò chuyện */
var CACHE = 'nha-shell-v6';
var SHELL = ['./', 'index.html', 'manifest.json', 'icons/icon-192.png', 'icons/apple-touch-icon.png', 'icons/favicon-32.png'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE && k !== 'nha-share'; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

function handleShare(req) {
  return req.formData().then(function (fd) {
    var files = fd.getAll('files').filter(function (f) { return f && typeof f !== 'string' && f.size > 0; }).slice(0, 10);
    var meta = {
      title: fd.get('title') || '', text: fd.get('text') || '', url: fd.get('url') || '',
      files: files.map(function (f) { return { name: f.name || 'tep', type: f.type || 'application/octet-stream' }; })
    };
    return caches.delete('nha-share').then(function () { return caches.open('nha-share'); }).then(function (c) {
      var jobs = [c.put('/_share/meta', new Response(JSON.stringify(meta), { headers: { 'Content-Type': 'application/json' } }))];
      files.forEach(function (f, i) { jobs.push(c.put('/_share/f' + i, new Response(f, { headers: { 'Content-Type': f.type || 'application/octet-stream' } }))); });
      return Promise.all(jobs);
    });
  }).then(function () {
    return Response.redirect('./?share=1', 303);
  }, function () {
    return Response.redirect('./', 303);
  });
}

self.addEventListener('fetch', function (e) {
  var req = e.request, url = new URL(req.url);
  if (url.origin !== location.origin) return;               // API, ảnh R2… đi thẳng mạng
  if (req.method === 'POST' && /\/share-target$/.test(url.pathname)) { e.respondWith(handleShare(req)); return; }
  if (req.method !== 'GET') return;
  if (req.mode === 'navigate' || /\/(index\.html)?$/.test(url.pathname)) {
    // Ưu tiên bản mới nhất trên mạng, mất mạng thì dùng bản đã lưu
    var isRoot = url.pathname === '/' || url.pathname === '/index.html';
    e.respondWith(fetch(req).then(function (res) {
      if (isRoot) { var copy = res.clone(); caches.open(CACHE).then(function (c) { c.put('index.html', copy); }); }
      return res;
    }).catch(function () { return caches.match('index.html'); }));
    return;
  }
  e.respondWith(caches.match(req).then(function (hit) {
    var net = fetch(req).then(function (res) {
      if (res.ok) { var copy = res.clone(); caches.open(CACHE).then(function (c) { c.put(req, copy); }); }
      return res;
    }).catch(function () { return hit; });
    return hit || net;
  }));
});

/* ---------- Thông báo đẩy ---------- */
self.addEventListener('push', function (e) {
  var d = {};
  try { d = e.data ? e.data.json() : {}; } catch (x) { d = { body: e.data ? e.data.text() : '' }; }
  var scope = self.registration.scope;
  var opt = {
    body: d.body || '',
    tag: d.tag || 'nha',
    renotify: true,
    lang: 'vi',
    icon: new URL('icons/icon-192.png', scope).href,
    badge: new URL('icons/favicon-32.png', scope).href,
    data: { conv: d.conv || '', msg: d.msg || 0, call: d.call || '' }
  };
  if (d.call) { opt.requireInteraction = true; opt.vibrate = [500, 250, 500, 250, 500, 250, 500]; }
  var jobs = [self.registration.showNotification(d.title || 'Nhà Mình', opt)];
  try { if (typeof d.badge === 'number' && self.navigator && self.navigator.setAppBadge) jobs.push(self.navigator.setAppBadge(d.badge).catch(function () {})); } catch (x) {}
  e.waitUntil(Promise.all(jobs));
});

self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  var conv = (e.notification.data && e.notification.data.conv) || '';
  var call = (e.notification.data && e.notification.data.call) || '';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
    for (var i = 0; i < list.length; i++) {
      var c = list[i];
      if (c.url.indexOf(self.registration.scope) === 0 && 'focus' in c) {
        if (conv || call) c.postMessage({ t: 'open', conv: conv, call: call });
        return c.focus();
      }
    }
    return self.clients.openWindow(self.registration.scope + (conv ? '?c=' + encodeURIComponent(conv) + (call ? '&call=' + encodeURIComponent(call) : '') : ''));
  }));
});
