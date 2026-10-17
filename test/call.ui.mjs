// Gọi 1-1 với workerd thật (wrangler dev :8788) + web :8080, hai trình duyệt dùng camera/mic giả
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
const API = 'http://localhost:8788';
const J = { 'Content-Type': 'application/json' };
const post = async (p, b, t) => (await fetch(API + p, { method: 'POST', headers: Object.assign({}, J, t ? { Authorization: 'Bearer ' + t } : {}), body: JSON.stringify(b) })).json();
const get = async (p, t) => (await fetch(API + p, { headers: { Authorization: 'Bearer ' + t } })).json();
const login = async (m, pin) => { const a = await post('/api/login', { member: m, setup_key: 'nha-setup', new_pin: pin }); return a.token || (await post('/api/login', { member: m, pin })).token; };
const tBo = await login('bo', '1111'), tNhi = await login('linhnhi', '5555');
const errors = [];
const browser = await chromium.launch({ args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--disable-features=WebRtcHideLocalIpsWithMdns', '--autoplay-policy=no-user-gesture-required'] });
async function app(token, tag, opts) {
  const ctx = await browser.newContext(Object.assign({ permissions: ['microphone', 'camera'] }, opts));
  await ctx.addInitScript(t => { localStorage.setItem('nha_token', t); localStorage.setItem('nha_api', 'http://localhost:8788'); }, token);
  const p = await ctx.newPage();
  p.on('console', m => { if (m.type() === 'error' && !/ERR_TUNNEL|ytimg|stun|ERR_NAME|ERR_INTERNET/.test(m.text())) errors.push(tag + ': ' + m.text()); });
  p.on('pageerror', e => errors.push(tag + ' PAGEERROR: ' + e.message));
  await p.goto('http://localhost:8080/?api=' + API);
  await p.waitForSelector('#scrMain:not(.hidden) .conv');
  await p.click('.conv[data-id="bo_linhnhi"]');
  await p.waitForSelector('#cCall');
  return p;
}
const bo = await app(tBo, 'bo', { viewport: { width: 412, height: 915 } });
const nhi = await app(tNhi, 'nhi', { viewport: { width: 768, height: 1024 } });
await bo.waitForFunction(() => /đang mở app/.test(document.querySelector('#cSub').textContent), null, { timeout: 10000 });
await nhi.waitForFunction(() => /đang mở app/.test(document.querySelector('#cSub').textContent), null, { timeout: 10000 });
const vis = (p, sel) => p.$eval(sel, e => !e.classList.contains('hidden'));
const stText = p => p.textContent('#cuSt');

// 1) Gọi video: Bố gọi → Linh Nhi thấy cuộc gọi đến → nghe → cả hai kết nối
await bo.click('#cVid');
await nhi.waitForSelector('#callUi:not(.hidden) #cuYes', { timeout: 6000 });
assert.match(await nhi.textContent('#cuName'), /Bố/);
assert.match(await stText(nhi), /video đến/);
assert.match(await stText(bo), /đổ chuông/);
await nhi.click('#cuYes');
await bo.waitForFunction(() => /^\d+:\d\d$/.test(document.querySelector('#cuSt').textContent), null, { timeout: 15000 });
await nhi.waitForFunction(() => /^\d+:\d\d$/.test(document.querySelector('#cuSt').textContent), null, { timeout: 15000 });
// có hình thật từ phía bên kia
for (const [p, tag] of [[bo, 'bo'], [nhi, 'nhi']]) {
  await p.waitForFunction(() => { const v = document.querySelector('#callRv'); return v && v.videoWidth > 0; }, null, { timeout: 10000 });
}
await bo.screenshot({ path: '/tmp/claude-0/shots/call-video-bo.png' });
// tắt mic / cam
await bo.click('#cuMute'); assert.match(await bo.textContent('#cuBtns'), /Bật mic/);
await bo.click('#cuCam'); assert.match(await bo.textContent('#cuBtns'), /Bật cam/);
await bo.click('#cuMute'); await bo.click('#cuCam');
await new Promise(r => setTimeout(r, 1500));
await nhi.click('#cuEnd');
await bo.waitForSelector('#callUi.hidden', { state: 'attached', timeout: 6000 });
await nhi.waitForSelector('#callUi.hidden', { state: 'attached' });
// nhật ký trong chat
await bo.waitForFunction(() => /Cuộc gọi video · \d+:\d\d/.test(document.querySelector('#msgs').textContent), null, { timeout: 8000 });
console.log('✓ gọi video, có hình 2 chiều, nhật ký trong chat');

// 2) Gọi thoại bị từ chối
await nhi.click('#cCall');
await bo.waitForSelector('#callUi:not(.hidden) #cuNo', { timeout: 6000 });
await bo.click('#cuNo');
await nhi.waitForSelector('#callUi.hidden', { state: 'attached', timeout: 6000 });
await bo.waitForFunction(() => /bị từ chối/.test(document.querySelector('#msgs').textContent), null, { timeout: 8000 });
console.log('✓ từ chối cuộc gọi');

// 3) Người gọi hủy khi đang đổ chuông → cuộc gọi nhỡ
await bo.click('#cCall');
await nhi.waitForSelector('#callUi:not(.hidden) #cuYes', { timeout: 6000 });
await bo.click('#cuEnd');
await nhi.waitForSelector('#callUi.hidden', { state: 'attached', timeout: 6000 });
await nhi.waitForFunction(() => /Cuộc gọi nhỡ/.test(document.querySelector('#msgs').textContent), null, { timeout: 8000 });
console.log('✓ cuộc gọi nhỡ');

// 4) Gọi thoại bình thường + bận
await bo.click('#cCall');
await nhi.waitForSelector('#callUi:not(.hidden) #cuYes', { timeout: 6000 });
await nhi.click('#cuYes');
await bo.waitForFunction(() => /^\d+:\d\d$/.test(document.querySelector('#cuSt').textContent), null, { timeout: 15000 });
const busy = await post('/api/call/invite', { conv: 'bo_linhnhi', video: false }, tNhi);
assert.match(JSON.stringify(busy), /bận|busy/);
await bo.click('#cuEnd');
await nhi.waitForSelector('#callUi.hidden', { state: 'attached', timeout: 6000 });
await bo.waitForFunction(() => /Cuộc gọi thoại · \d+:\d\d/.test(document.querySelector('#msgs').textContent), null, { timeout: 8000 });
console.log('✓ gọi thoại + báo bận');

const pend = await get('/api/call/pending', tNhi); assert.equal(pend.call, null);
const ice = await get('/api/call/ice', tBo); console.log('ICE:', JSON.stringify(ice).slice(0, 120));
await browser.close();
if (errors.length) { console.log('❌ Lỗi:\n' + errors.join('\n')); process.exit(1); }
console.log('✅ Gọi 1-1 đạt');
