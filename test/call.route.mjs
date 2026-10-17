// Loa mặc định khi gọi: thoại → Bluetooth/loa trong, video → loa ngoài (giả lập danh sách loa)
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
const API = 'http://localhost:8788', J = { 'Content-Type': 'application/json' };
const post = async (p, b, t) => (await fetch(API + p, { method: 'POST', headers: Object.assign({}, J, t ? { Authorization: 'Bearer ' + t } : {}), body: JSON.stringify(b) })).json();
const login = async (m, pin) => { const a = await post('/api/login', { member: m, setup_key: 'nha-setup', new_pin: pin }); return a.token || (await post('/api/login', { member: m, pin })).token; };
const tBo = await login('bo', '1111'), tNhi = await login('linhnhi', '5555');
const browser = await chromium.launch({ args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--disable-features=WebRtcHideLocalIpsWithMdns', '--autoplay-policy=no-user-gesture-required'] });
async function app(token, stub) {
  const ctx = await browser.newContext({ permissions: ['microphone', 'camera'], viewport: { width: 412, height: 915 } });
  await ctx.addInitScript(t => { localStorage.setItem('nha_token', t); localStorage.setItem('nha_api', 'http://localhost:8788'); }, token);
  if (stub) await ctx.addInitScript(() => {
    window.__outs = [{ kind: 'audiooutput', deviceId: 'spk', label: 'Speakerphone' }, { kind: 'audiooutput', deviceId: 'ear', label: 'Earpiece' }];
    window.__sink = [];
    const orig = navigator.mediaDevices.enumerateDevices.bind(navigator.mediaDevices);
    navigator.mediaDevices.enumerateDevices = async () => (await orig()).filter(d => d.kind !== 'audiooutput').concat(window.__outs);
    HTMLMediaElement.prototype.setSinkId = function (id) { window.__sink.push(id); return Promise.resolve(); };
  });
  const p = await ctx.newPage();
  await p.goto('http://localhost:8080/?api=' + API);
  await p.waitForSelector('#scrMain:not(.hidden) .conv');
  await p.click('.conv[data-id="bo_linhnhi"]'); await p.waitForSelector('#cCall');
  return p;
}
const bo = await app(tBo, true), nhi = await app(tNhi, false);
await bo.waitForFunction(() => /đang mở app/.test(document.querySelector('#cSub').textContent), null, { timeout: 10000 });
const last = () => bo.evaluate(() => window.__sink[window.__sink.length - 1]);
const conn = p => p.waitForFunction(() => /^\d+:\d\d$/.test(document.querySelector('#cuSt').textContent), null, { timeout: 15000 });
// gọi thoại → loa trong; cắm Bluetooth → tự chuyển sang Bluetooth
await bo.click('#cCall'); await nhi.waitForSelector('#cuYes'); await nhi.click('#cuYes'); await conn(bo);
await bo.waitForFunction(() => window.__sink.length > 0); assert.equal(await last(), 'ear');
await bo.evaluate(() => { window.__outs.push({ kind: 'audiooutput', deviceId: 'bt', label: 'Bluetooth Buds' }); navigator.mediaDevices.dispatchEvent(new Event('devicechange')); });
await bo.waitForFunction(() => window.__sink[window.__sink.length - 1] === 'bt', null, { timeout: 4000 });
// người dùng chọn tay → không bị tự đổi nữa
await bo.click('#cuSpk'); await bo.waitForSelector('#cuMenu');
await bo.evaluate(() => [...document.querySelectorAll('#cuMenu button')].find(b => /Loa ngoài/.test(b.textContent)).click());
await bo.waitForFunction(() => window.__sink[window.__sink.length - 1] === 'spk');
await bo.evaluate(() => { navigator.mediaDevices.dispatchEvent(new Event('devicechange')); });
await new Promise(r => setTimeout(r, 600)); assert.equal(await last(), 'spk');
await bo.click('#cuEnd'); await nhi.waitForSelector('#callUi.hidden', { state: 'attached' });
console.log('✓ gọi thoại: loa trong → Bluetooth → giữ lựa chọn tay');
// gọi video → loa ngoài (dù có Bluetooth)
await bo.evaluate(() => { window.__sink.length = 0; });
await bo.click('#cVid'); await nhi.waitForSelector('#cuYes'); await nhi.click('#cuYes'); await conn(bo);
await bo.waitForFunction(() => window.__sink.length > 0); assert.equal(await last(), 'spk');
await bo.click('#cuEnd');
console.log('✓ gọi video: loa ngoài');
await browser.close();
