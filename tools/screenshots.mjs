// Renders the README screenshots (docs/*.png) and the link preview (og.png):  node tools/screenshots.mjs
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
let pw;
try { pw = require('playwright'); } catch { pw = require(join(execSync('npm root -g').toString().trim(), 'playwright')); }
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json', '.json': 'application/json' };
const server = createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  let body;
  try { body = await readFile(join(root, path === '/' ? 'index.html' : path)); } catch { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': TYPES[extname(path)] || 'text/html' });
  res.end(body);
}).listen(0);
const base = `http://localhost:${server.address().port}/`;
const browser = await pw.chromium.launch();
await mkdir(join(root, 'docs'), { recursive: true });

// Someone who grew up in Wisconsin, lived in Chicago and Denver, and gets around.
const SAMPLE = {
  us: { WI: 'lived', IL: 'lived', CO: 'lived', MN: 'visited', MI: 'visited', IA: 'visited', CA: 'visited', NY: 'visited', MA: 'visited',
    AZ: 'visited', NV: 'visited', UT: 'visited', NM: 'visited', TX: 'visited', LA: 'visited', TN: 'visited', FL: 'visited', DC: 'visited',
    WY: 'passed', NE: 'passed', IN: 'passed', OH: 'passed', KS: 'passed', MT: 'want', ME: 'want', HI: 'want', AK: 'want', OR: 'want' },
  world: { US: 'lived', CA: 'visited', MX: 'visited', GB: 'visited', IE: 'visited', FR: 'visited', IT: 'visited', ES: 'visited', DE: 'visited',
    IS: 'visited', JP: 'want', PE: 'want', NZ: 'want', MA: 'want' },
  grewUp: 'WI', answers: {}, name: '',
};

async function open(viewport, deviceScaleFactor, tab = 'us') {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor, hasTouch: true, serviceWorkers: 'block', colorScheme: 'light' });
  const page = await ctx.newPage();
  await page.addInitScript(([sample, tab]) => {
    localStorage.setItem('been-there.v1', JSON.stringify(sample));
    localStorage.setItem('been-there.tab', tab);
  }, [SAMPLE, tab]);
  await page.goto(base);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
  return page;
}

// Phone screenshots for the README.
{
  const page = await open({ width: 390, height: 844 }, 2);
  await page.screenshot({ path: join(root, 'docs/phone-states.png') });
  await page.evaluate(() => beenThere.open('us', 'MT'));
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(root, 'docs/phone-card.png') });
  await page.context().close();
}
{
  const page = await open({ width: 390, height: 844 }, 2, 'words');
  await page.click('.word[data-id="soda"] [data-wmap]');
  await page.evaluate(() => scrollTo(0, document.querySelector('.word[data-id="soda"]').offsetTop - 12));
  await page.waitForTimeout(200);
  await page.screenshot({ path: join(root, 'docs/phone-words.png') });
  await page.context().close();
}

// Link preview, 1200 x 630: a card with the name on the left and the real map on the right.
{
  const page = await open({ width: 1200, height: 630 }, 1);
  await page.evaluate(() => {
    const svg = document.querySelector('.map-us');
    const card = document.createElement('div');
    card.innerHTML = `
      <div class="og-words">
        <div class="og-brand"><svg class="pin" viewBox="0 0 24 32"><path d="M12 1C6 1 1.5 5.5 1.5 11.4 1.5 19 12 31 12 31s10.5-12 10.5-19.6C22.5 5.5 18 1 12 1z"/><circle cx="12" cy="11.2" r="4"/></svg>Been There</div>
        <p>Mark where you’ve been. See what you’re missing.</p>
        <ul><li data-s="lived"><i></i>Lived</li><li data-s="visited"><i></i>Visited</li><li data-s="passed"><i></i>Passed through</li><li data-s="want"><i></i>Want to go</li></ul>
      </div>`;
    card.className = 'og';
    const holder = document.createElement('div');
    holder.className = 'og-map';
    holder.appendChild(svg);
    card.appendChild(holder);
    document.body.replaceChildren(card);
    const st = document.createElement('style');
    st.textContent = `
      body { padding: 0; margin: 0; }
      .og { width: 1200px; height: 630px; display: grid; grid-template-columns: 400px 1fr; align-items: center; background: var(--paper); padding: 0 40px 0 64px; box-sizing: border-box; }
      .og-brand { display: flex; align-items: center; gap: 16px; font: 600 74px/1 var(--serif); letter-spacing: -.01em; }
      .og-brand .pin { width: 44px; height: 59px; }
      .og p { font: 400 30px/1.3 var(--serif); color: var(--ink-2); margin: 22px 0 30px; }
      .og ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 12px; font: 600 24px var(--sans); }
      .og li { display: flex; align-items: center; gap: 12px; }
      .og li i { width: 26px; height: 26px; border-radius: 50%; border: 1px solid rgba(0,0,0,.18); }
      .og-map .map { width: 100%; }
      .og-map .lbl { opacity: 0 !important; }`;
    document.head.appendChild(st);
  });
  await page.waitForTimeout(200);
  await page.screenshot({ path: join(root, 'og.png') });
  await page.context().close();
}

await browser.close();
server.close();
console.log('screenshots written');
