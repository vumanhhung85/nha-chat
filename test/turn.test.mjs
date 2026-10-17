import assert from 'node:assert/strict';
import { makeEnv } from './harness.mjs';
import worker from '../worker/src/index.js';
const env = makeEnv(null); env.TURN_KEY_ID = 'kid'; env.TURN_KEY_API_TOKEN = 'secret';
const ctx = { waitUntil: p => p.catch(() => {}) };
const J = { 'Content-Type': 'application/json' };
const req = async (path, body, tok) => (await worker.fetch(new Request('http://x' + path, { method: body ? 'POST' : 'GET', headers: Object.assign({}, J, tok ? { Authorization: 'Bearer ' + tok } : {}), body: body ? JSON.stringify(body) : undefined }), env, ctx)).json();
const a = await req('/api/login', { member: 'bo', setup_key: env.SETUP_KEY || 'nha-setup', new_pin: '1111' });
const tok = a.token; assert.ok(tok, JSON.stringify(a));
let seen = null; const real = globalThis.fetch;
globalThis.fetch = async (u, o) => {
  if (String(u).startsWith('https://rtc.live.cloudflare.com/')) {
    seen = { u: String(u), auth: o.headers.Authorization, body: o.body };
    return new Response(JSON.stringify({ iceServers: [{ urls: ['stun:stun.cloudflare.com:3478'] }, { urls: ['turn:turn.cloudflare.com:3478?transport=udp', 'turn:turn.cloudflare.com:53?transport=udp', 'turns:turn.cloudflare.com:443?transport=tcp'], username: 'u', credential: 'c' }] }), { status: 201 });
  }
  return real(u, o);
};
const r = await req('/api/call/ice', null, tok);
globalThis.fetch = real;
assert.equal(r.turn, true);
assert.equal(seen.u, 'https://rtc.live.cloudflare.com/v1/turn/keys/kid/credentials/generate-ice-servers');
assert.equal(seen.auth, 'Bearer secret'); assert.equal(JSON.parse(seen.body).ttl, 86400);
const t = r.iceServers[1]; assert.equal(t.username, 'u'); assert.equal(t.credential, 'c');
assert.ok(!t.urls.some(u => /:53/.test(u)), 'bỏ cổng 53');
assert.equal(t.urls.length, 2);
console.log('✅ TURN: gọi đúng API Cloudflare, bỏ cổng 53');
