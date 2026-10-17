// Kiểm tra push / notificationclick trong sw.js bằng self giả
import vm from 'node:vm'; import { readFileSync } from 'node:fs'; import assert from 'node:assert/strict';
const handlers = {}; const shown = []; const opened = []; const msgs = []; let badge = null; let wins = [];
const self = {
  addEventListener: (n, f) => { handlers[n] = f; }, skipWaiting() {}, clients: { claim() {}, matchAll: async () => wins, openWindow: async u => { opened.push(u); } },
  registration: { scope: 'https://nha.tytlinhxuan.cloud/', showNotification: async (t, o) => { shown.push({ t, o }); } },
  navigator: { setAppBadge: async n => { badge = n; } }, location: { origin: 'https://nha.tytlinhxuan.cloud' }
};
vm.runInNewContext(readFileSync(new URL('../sw.js', import.meta.url), 'utf8'), { self, caches: {}, URL, Response, fetch, location: self.location, console });
const run = async f => { let p; f({ waitUntil: x => { p = x; } }); await p; };
await run(w => handlers.push({ data: { json: () => ({ title: 'Bố', body: 'Con ăn cơm', conv: 'family', msg: 5, tag: 'c-family', badge: 3 }) }, waitUntil: w.waitUntil }));
assert.equal(shown[0].t, 'Bố'); assert.equal(shown[0].o.tag, 'c-family'); assert.equal(shown[0].o.data.conv, 'family'); assert.equal(badge, 3);
assert.ok(shown[0].o.icon.startsWith('https://nha.tytlinhxuan.cloud/icons/'));
// dữ liệu hỏng vẫn phải hiện thông báo (iOS bắt buộc)
await run(w => handlers.push({ data: { json: () => { throw new Error('x'); }, text: () => 'xin chào' }, waitUntil: w.waitUntil }));
assert.equal(shown[1].o.body, 'xin chào');
await run(w => handlers.push({ data: null, waitUntil: w.waitUntil })); assert.equal(shown[2].t, 'Nhà Mình');
// bấm: không có cửa sổ → mở mới đúng cuộc trò chuyện
let closed = 0;
await run(w => handlers.notificationclick({ notification: { close: () => closed++, data: { conv: 'bo_me' } }, waitUntil: w.waitUntil }));
assert.deepEqual(opened, ['https://nha.tytlinhxuan.cloud/?c=bo_me']);
// có cửa sổ → focus + postMessage
let focused = 0; wins = [{ url: 'https://nha.tytlinhxuan.cloud/', focus: async () => { focused++; }, postMessage: m => msgs.push(m) }];
await run(w => handlers.notificationclick({ notification: { close: () => closed++, data: { conv: 'family' } }, waitUntil: w.waitUntil }));
assert.equal(focused, 1); assert.equal(JSON.stringify(msgs), JSON.stringify([{ t: 'open', conv: 'family', call: '' }])); assert.equal(opened.length, 1);
console.log('✅ sw.js push/notificationclick đạt');
// Thông báo cuộc gọi đến: giữ nguyên cho tới khi bấm, bấm vào mở đúng cuộc gọi
shown.length = 0;
await run(w => handlers.push({ data: { json: () => ({ title: 'Bố đang gọi', body: 'x', conv: 'bo_linhnhi', call: 'abc', tag: 'call-abc' }) }, waitUntil: w.waitUntil }));
assert.equal(shown[0].o.requireInteraction, true); assert.equal(shown[0].o.data.call, 'abc');
console.log('✅ sw: thông báo cuộc gọi đến');
