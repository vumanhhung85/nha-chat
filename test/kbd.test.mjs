import { chromium } from 'playwright';
const b = await chromium.launch(); const wait=ms=>new Promise(r=>setTimeout(r,ms));
const ctx = await b.newContext({ viewport:{width:768,height:1024}, hasTouch:true, userAgent:'Mozilla/5.0 (iPad; CPU OS 15_8 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.6 Mobile/15E148 Safari/604.1'});
const p = await ctx.newPage();
await p.goto('http://localhost:8080/?api=http://localhost:8787');
await p.click('#skipInstall'); await p.click('.who[data-id="linhnhi"]');
for (const k of ['3','3','3','3']) await p.click(`.pad button[data-k="${k}"]`);
await p.waitForSelector('.conv'); await p.click('.conv[data-id="family"]'); await p.waitForSelector('.m');
await p.focus('#cin');
for (const t of ['kbd một','kbd hai','kbd ba']) {
  await p.keyboard.type(t);
  await p.tap('#cSend');
  await p.waitForFunction(x=>[...document.querySelectorAll('.bub .tx')].some(e=>e.textContent.includes(x)),t);
  const st = await p.evaluate(()=>({f:document.activeElement&&document.activeElement.id,v:document.querySelector('#cin').value}));
  console.log(t, JSON.stringify(st)); if (st.f!=='cin'||st.v!=='') { console.log('FAIL'); process.exit(1); }
}
console.log('OK'); await b.close();
