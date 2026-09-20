// The share card for /stats (brand/stats-og.png, 1200x630 at 2x): the EMO burned so far as the headline, the real
// cumulative burn curve rising over both pets. Drawn from the live index, so it is as fresh as its last run.
//   node tools/og-stats.mjs                       # in the monorepo: writes apps/web/public/brand/stats-og.png
//   node og-stats.mjs --site <pages checkout>     # in CI (the Pages repo's daily action): writes <site>/brand/stats-og.png
// Self-contained on purpose: pages-deploy.sh copies it (with the font) into the Pages repo, where a GitHub Action
// redraws it every day so the number on the card keeps up between site deploys. The browser is puppeteer when it is
// installed (CI), else the Mac's own Chrome.
import { readFileSync, writeFileSync, unlinkSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url)) + '/';
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const site = resolve(arg('--site', here + '../apps/web/public')) + '/';   // absolute: the portraits are file:// URLs
const out = resolve(arg('--out', site + 'brand/stats-og.png'));
const font = existsSync(here + 'space-grotesk.woff2') ? here + 'space-grotesk.woff2' : here + '../node_modules/.pnpm/@fontsource-variable+space-grotesk@5.3.0/node_modules/@fontsource-variable/space-grotesk/files/space-grotesk-latin-wght-normal.woff2';
const heart = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" width="40" height="40"><g id="heart"><path d="M20.02,35.42 C19.29,34.88 16.94,33.32 15.60,32.20 C14.26,31.08 13.04,29.79 11.96,28.71 C10.89,27.62 9.96,26.72 9.15,25.68 C8.33,24.64 7.61,23.52 7.06,22.46 C6.51,21.41 6.13,20.32 5.85,19.36 C5.57,18.40 5.43,17.60 5.39,16.72 C5.35,15.83 5.42,14.94 5.61,14.06 C5.80,13.17 6.14,12.28 6.53,11.41 C6.92,10.55 7.71,9.28 7.94,8.86 C8.38,8.47 9.59,6.96 10.54,6.54 C11.50,6.12 12.64,6.21 13.67,6.36 C14.69,6.52 15.80,6.92 16.69,7.47 C17.57,8.02 18.40,8.79 18.96,9.63 C19.53,10.47 19.89,12.02 20.07,12.50 C20.26,12.05 20.63,10.58 21.21,9.77 C21.79,8.95 22.69,8.12 23.55,7.61 C24.40,7.09 25.41,6.75 26.34,6.68 C27.28,6.60 28.20,6.76 29.15,7.18 C30.10,7.60 31.55,8.86 32.03,9.20 C32.31,9.58 33.26,10.71 33.68,11.50 C34.11,12.30 34.42,13.13 34.58,13.97 C34.75,14.81 34.80,15.66 34.66,16.52 C34.53,17.38 34.13,18.19 33.76,19.14 C33.40,20.08 33.01,21.07 32.48,22.17 C31.95,23.27 31.37,24.56 30.61,25.74 C29.84,26.92 28.92,28.17 27.89,29.26 C26.86,30.34 25.73,31.23 24.42,32.26 C23.11,33.28 20.76,34.89 20.02,35.42 Z" fill="#E84D7F" stroke="#000000" stroke-width="2.7" stroke-linejoin="round" stroke-linecap="round" /><path d="M10.65,12.90 C10.79,12.61 11.20,11.65 11.54,11.15 C11.88,10.65 12.24,10.24 12.68,9.92 C13.12,9.60 13.62,9.38 14.20,9.25 C14.77,9.11 15.80,9.14 16.12,9.12" fill="none" stroke="#FFFFFF" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" opacity="0.85"/></g></svg>`;

const j = await (await fetch('https://emogotchi.emonad.lol/api/stats')).json();
if (j.error) throw new Error(j.error);
const emo = Math.round(j.cats.burn.emoBurned + j.froks.burn.emoBurned + j.shop.burn.emoBurned);
const mon = j.cats.burn.monBurned + j.froks.burn.monBurned + j.shop.burn.monBurned;
const cranks = j.cats.burn.cranks + j.froks.burn.cranks + j.shop.burn.cranks;
const fmt = (n, dp = 0) => n.toLocaleString('en-US', { maximumFractionDigits: dp });

// the curve: cumulative EMO burned per UTC day, both pets, stretched across the card
const byDay = new Map();
for (const d of [...j.cats.series, ...j.froks.series]) byDay.set(d.day, (byDay.get(d.day) ?? 0) + d.emoBurned);
const today = Math.floor(Date.now() / 86400000) * 86400;
const days = [...byDay.keys()].filter((d) => d < today).sort((a, b) => a - b);   // today is still being written
const pts = []; let t = 0; for (const d of days) { t += byDay.get(d); pts.push(t); }
if (pts.length < 2) pts.unshift(0);
const W = 1200, H = 630, top = 214, base = 560, X0 = 640;   // the curve lives right of the copy
const max = Math.max(1, ...pts);
const X = (i) => X0 + (i / (pts.length - 1)) * (W - X0);
const Y = (v) => base - (v / max) * (base - top);
const line = pts.map((v, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(' ');
const area = `${line} L${W},${H} L${X0},${H} Z`;

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face { font-family: 'SG'; src: url('file://${font}') format('woff2'); font-weight: 300 700; }
html,body { margin:0; width:1200px; height:630px; overflow:hidden; background:#000; font-family:'SG',sans-serif; color:#F8F8FF; -webkit-font-smoothing:antialiased; }
.card { position:relative; width:1200px; height:630px; overflow:hidden; background: radial-gradient(120% 90% at 50% 20%, #3a1f5c 0%, #24123f 55%, #170b2a 100%); }
.dots { position:absolute; inset:0; background-image: radial-gradient(rgba(234,198,234,0.13) 2.6px, transparent 2.8px); background-size:44px 44px; -webkit-mask-image: linear-gradient(180deg, rgba(0,0,0,.9), rgba(0,0,0,.25) 70%, transparent); }
.chart { position:absolute; inset:0; }
.copy { position:absolute; left:72px; top:0; height:630px; width:640px; display:flex; flex-direction:column; justify-content:center; gap:20px; padding-bottom:20px; }
.brand { display:flex; align-items:center; gap:14px; font-weight:700; font-size:44px; letter-spacing:-.02em; }
.brand svg { width:40px; height:40px; }
.eyebrow { display:inline-flex; align-self:flex-start; padding:8px 16px; border-radius:999px; font-size:16px; font-weight:600; letter-spacing:.06em; text-transform:uppercase; color:#EAC6EA; background:rgba(80,40,88,.45); border:1px solid rgba(184,148,216,.3); }
h1 { margin:0; font-size:64px; line-height:1.02; letter-spacing:-.03em; font-weight:700; }
h1 .num { display:block; font-size:118px; letter-spacing:-.05em; line-height:1; margin-bottom:4px; background: linear-gradient(92deg,#ff7aa6,#E84D7F 45%,#B894D8); -webkit-background-clip:text; background-clip:text; color:transparent; filter: drop-shadow(0 0 26px rgba(232,77,127,.35)); }
.sub { margin:0; font-size:22px; line-height:1.4; color:rgba(248,248,255,.8); max-width:600px; }
.sub b { color:#F8F8FF; font-weight:600; }
.foot { position:absolute; left:72px; bottom:34px; font-size:18px; color:rgba(234,198,234,.75); }
.foot b { color:#EAC6EA; font-weight:600; }
.pets { position:absolute; right:26px; bottom:34px; display:flex; align-items:flex-end; }
.pets img { display:block; border-radius:34px; background:#1a1024; box-shadow: 0 30px 60px -20px rgba(0,0,0,.8); }
.pets .cat { width:220px; height:220px; border: 4px solid #E84D7F; box-shadow: 0 0 0 8px rgba(232,77,127,.22), 0 30px 60px -20px rgba(0,0,0,.8); z-index:2; }
.pets .frok { width:156px; height:156px; margin-right:-26px; margin-bottom:0; border: 4px solid #5da03a; box-shadow: 0 0 0 8px rgba(93,160,58,.22), 0 30px 60px -20px rgba(0,0,0,.8); }
.live { position:absolute; right:40px; top:40px; display:inline-flex; align-items:center; gap:10px; padding:10px 18px; border-radius:999px; font-size:17px; font-weight:600; color:#F8F8FF; background:rgba(93,160,58,.16); border:1px solid rgba(93,160,58,.45); }
.live i { width:10px; height:10px; border-radius:999px; background:#5da03a; box-shadow:0 0 0 5px rgba(93,160,58,.25); }
</style></head><body><div class="card">
<div class="dots"></div>
<svg class="chart" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
  <defs>
    <linearGradient id="a" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#E84D7F" stop-opacity=".42"/><stop offset="1" stop-color="#E84D7F" stop-opacity=".02"/></linearGradient>
    <filter id="g" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="8" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    <linearGradient id="m" gradientUnits="userSpaceOnUse" x1="${X0}" y1="0" x2="${X0 + 220}" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#fff" stop-opacity="1"/></linearGradient>
    <mask id="fade"><rect x="0" y="0" width="${W}" height="${H}" fill="url(#m)"/></mask>
  </defs>
  <g mask="url(#fade)"><path d="${area}" fill="url(#a)"/>
  <path d="${line}" fill="none" stroke="#ff7aa6" stroke-width="4" stroke-linejoin="round" stroke-linecap="round" filter="url(#g)"/></g>
</svg>
<div class="copy">
  <div class="brand">${heart} Emogotchi</div>
  <div class="eyebrow">Emogotchi, in numbers</div>
  <h1><span class="num">${fmt(emo)}</span>EMO burned so far.</h1>
  <p class="sub">From <b>${fmt(mon, 0)} MON</b> in <b>${fmt(cranks)} cranks</b>. Every care, name, crank and abuse on both pets, folded from Monad's own event log. Nothing is estimated.</p>
</div>
<div class="live"><i></i> Live from the chain</div>
<div class="pets"><img class="frok" src="file://${site}nft/inversebrah/happy-crown-1024.png"><img class="cat" src="file://${site}nft/happy-crown-1024.png"></div>
<div class="foot"><b>$EMO</b> on Monad · emogotchi.emonad.lol/stats</div>
</div></body></html>`;

const tmp = here + '.stats-card.rendered.html';
writeFileSync(tmp, html);
let puppeteer = null; try { puppeteer = (await import('puppeteer')).default; } catch { /* the Mac's Chrome below */ }
if (puppeteer) {
  const b = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--hide-scrollbars'] });
  const p = await b.newPage(); await p.setViewport({ width: 1200, height: 630, deviceScaleFactor: 2 });
  await p.goto('file://' + tmp, { waitUntil: 'networkidle0' }); await p.evaluate(() => document.fonts.ready);
  await p.screenshot({ path: out }); await b.close();
} else {
  // CHROME lets CI point at the runner's preinstalled browser, so the card can be drawn with no npm install
  execFileSync(process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--window-size=1200,630', '--force-device-scale-factor=2', `--screenshot=${out}`, '--virtual-time-budget=4000', 'file://' + tmp], { stdio: 'ignore' });
}
unlinkSync(tmp);
writeFileSync(out.replace(/\.png$/, '.txt'), `${emo}\n`);   // the number on the card, so CI only commits when it changed
console.log(`wrote ${out}: ${fmt(emo)} EMO, ${pts.length} days`);
