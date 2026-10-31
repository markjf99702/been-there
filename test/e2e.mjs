// Uses the app in Chromium through the real page:  node test/e2e.mjs  (needs Playwright)
// Skeleton from the junkdrawer skill: the checks at the bottom are the ones every project wants;
// add the ones that prove this app does its job.
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
let pw;
try { pw = require('playwright'); } catch { pw = require(join(execSync('npm root -g').toString().trim(), 'playwright')); }
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json', '.json': 'application/json' };
// The server answers the way GitHub Pages does: a browser may keep each file for ten minutes, and asks again by its
// ETag. `net` is the connection: 'up', 'down' (the server drops every connection) or 'stalled' (a train, a captive
// wifi: it takes each request and holds on to it). With `release` set it serves the next release (see the end).
let net = 'up', release = false;
const held = [];
const server = createServer((req, res) => {
  if (net === 'down') { req.socket.destroy(); return; }
  if (net === 'stalled') { held.push([req, res]); return; }
  serve(req, res);
}).listen(0);
async function serve(req, res) {
  let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (path.endsWith('/')) path += 'index.html';
  let body;
  try { body = await readFile(join(root, path)); } catch { res.writeHead(404); res.end(); return; }
  if (release && path === '/sw.js') body = Buffer.from(String(body).replace(/const FILES = '[0-9a-f]*'/, "const FILES = 'next'"));
  if (release && path === '/index.html') body = Buffer.concat([body, Buffer.from('<!-- the next release -->\n')]);
  const etag = `"${createHash('sha1').update(body).digest('hex').slice(0, 16)}"`;
  const head = { etag, 'cache-control': 'max-age=600', 'content-type': TYPES[extname(path)] || 'text/html' };
  if (req.headers['if-none-match'] === etag) { res.writeHead(304, head); res.end(); return; }
  res.writeHead(200, head);
  res.end(body);
}
const base = `http://localhost:${server.address().port}/`;
// Waits for ok() to come true, for up to ms, or fails saying what didn't happen.
const until = async (ok, ms, what) => {
  for (const end = Date.now() + ms; !(await ok());) { assert.ok(Date.now() < end, what); await new Promise(r => setTimeout(r, 100)); }
};

const browser = await pw.chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
const page = await ctx.newPage();
const problems = [];
page.on('pageerror', e => problems.push(e.message));
page.on('console', m => { if (m.type() === 'error') problems.push(m.text()); });
page.on('requestfailed', r => problems.push('failed: ' + r.url()));
page.on('request', r => { if (!r.url().startsWith(base)) problems.push('left the site: ' + r.url()); });

await page.goto(base);
await page.evaluate(() => document.fonts.ready);

// Taps a state or country on a map at its label point, the way a finger would.
async function tapShape(kind, code) {
  const box = await page.evaluate(([kind, code]) => {
    const m = beenThere.maps[kind];
    const s = m.o.shapes[code];
    const pt = m.svg.createSVGPoint(); pt.x = s.x; pt.y = s.y;
    const p = pt.matrixTransform(m.g.getScreenCTM());
    return { x: p.x, y: p.y };
  }, [kind, code]);
  await page.touchscreen.tap(box.x, box.y);
}
const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem('been-there.v1') || '{}'));

// A first visit: nothing marked yet.
assert.match(await page.textContent('#us-summary'), /0\s*of 50 states/);

// Tap Wisconsin: its card opens, and marking it Lived saves it and puts the US on the world map.
await tapShape('us', 'WI');
await page.waitForSelector('#sheet.in');
assert.equal((await page.textContent('#card-name')).trim(), 'Wisconsin');
assert.match(await page.textContent('#card'), /Keep an eye out for/);
assert.match(await page.textContent('#card'), /A long weekend/);
await page.click('[data-set="us:WI:lived"]');
assert.equal((await saved()).us.WI, 'lived');
assert.equal((await saved()).world.US, 'lived');
await page.click('[data-grew="WI"]');
assert.equal((await saved()).grewUp, 'WI');
// Tapping another state on the map switches the card.
await tapShape('us', 'IA');
assert.equal((await page.textContent('#card-name')).trim(), 'Iowa');
await page.click('#card .x');
await page.waitForFunction(() => document.getElementById('sheet').hidden);

// Pick a color, then tap several states to mark them; tap one again to clear it.
await page.click('#us-legend [data-s="visited"]');
for (const c of ['IL', 'MN', 'MI', 'CO']) await tapShape('us', c);
await tapShape('us', 'CO');
assert.deepEqual(Object.keys((await saved()).us).sort(), ['IL', 'MI', 'MN', 'WI']);
assert.equal(await page.getAttribute('.map-us path[data-code="MN"]', 'data-s'), 'visited');
await page.click('#us-hint [data-done]');
// The small states under the map work too.
await page.click('#us-smalls [data-pick="us:RI"]');
assert.equal((await page.textContent('#card-name')).trim(), 'Rhode Island');
await page.click('[data-set="us:RI:want"]');
await page.click('#card .x');
assert.match(await page.textContent('#us-summary'), /4\s*of 50 states/);

// The road trip starts next to somewhere you've been and adds new states; it can add them to Want to go.
const trip = await page.textContent('.trip');
assert.match(trip, /6 new states/);
await page.click('[data-route]');
assert.ok(await page.$('.map-us .road'), 'the route is not on the map');
await page.click('[data-want]');
assert.ok(Object.values((await saved()).us).filter(s => s === 'want').length >= 6);

// The world: find a country by name, open it, mark it.
await page.click('#tab-world');
await page.fill('#find', 'peru');
await page.click('#find-rows [data-pick="world:PE"]');
assert.match(await page.textContent('#card-name'), /Peru/);
await page.click('[data-set="world:PE:visited"]');
await page.click('#card .x');
await page.fill('#find', 'holland');
assert.match(await page.textContent('#find-rows'), /Netherlands/);
assert.match(await page.textContent('#world-summary'), /2\s*of 195 countries/); // Peru, and the US from the states
await page.fill('#find', '');
await page.waitForTimeout(50);

// How you talk: grew up in Wisconsin, so it's soda and a bubbler; say no to one and pick another.
await page.click('#tab-words');
assert.equal(await page.inputValue('#grew-up'), 'WI');
assert.match(await page.textContent('.word[data-id="soda"] .guess'), /soda/);
assert.match(await page.textContent('.word[data-id="fountain"] .guess'), /bubbler/);
await page.click('.word[data-id="soda"] [data-say^="soda:"]');
await page.click('.word[data-id="yall"] [data-nope]');
await page.click('.word[data-id="yall"] [data-say="yall:yall"]');
assert.deepEqual((await saved()).answers, { soda: 'soda', yall: 'yall' });
assert.match(await page.textContent('#word-score'), /Right on 1 of 2/);
await page.click('.word[data-id="sub"] [data-wmap]');
assert.equal(await page.locator('.word[data-id="sub"] .map path').count(), 51);
for (const id of ['fountain', 'sub', 'cart']) await page.click(`.word[data-id="${id}"] [data-say^="${id}:"]`);
assert.match(await page.textContent('#sounds'), /Where you sound like you’re from/);
assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'the words page scrolls sideways');

// Share: the link carries the map, and opening it somewhere else shows it, and compares it with yours.
await page.click('#tab-us');
await page.click('#share-open');
await page.fill('#share-name', 'Mark');
const link = await page.inputValue('#share-link');
assert.match(link, /#s=.*WIl.*&c=.*PEv.*&n=Mark/);
await page.click('#share-close');
{
  const other = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, serviceWorkers: 'block' });
  const p2 = await other.newPage();
  await p2.goto(link.replace(/^https?:\/\/[^/]+\/(been-there\/)?/, base));
  assert.match(await p2.textContent('#banner'), /Mark’s map/);
  assert.equal(await p2.getAttribute('.map-us path[data-code="WI"]', 'data-s'), 'lived');
  await p2.click('[data-adopt]');
  await p2.waitForTimeout(100);
  assert.equal(JSON.parse(await p2.evaluate(() => localStorage.getItem('been-there.v1'))).us.WI, 'lived');
  // Someone with a map of their own sees the two compared.
  await p2.evaluate(() => { localStorage.setItem('been-there.v1', JSON.stringify({ us: { WI: 'visited', TX: 'lived' }, world: {} })); });
  await p2.goto(link.replace(/^https?:\/\/[^/]+\/(been-there\/)?/, base));
  await p2.reload();
  assert.equal(await p2.getAttribute('.map-us path[data-code="WI"]', 'data-s'), 'both');
  assert.equal(await p2.getAttribute('.map-us path[data-code="TX"]', 'data-s'), 'mine');
  assert.equal(await p2.getAttribute('.map-us path[data-code="IL"]', 'data-s'), 'theirs');
  assert.match(await p2.textContent('#us-summary'), /1\s*states? you’ve both been to/);
  // Using their map when you have your own asks first, on the button.
  await p2.click('[data-adopt]');
  assert.match(await p2.textContent('[data-adopt]'), /Replace my map/);
  assert.equal(JSON.parse(await p2.evaluate(() => localStorage.getItem('been-there.v1'))).us.TX, 'lived');
  await p2.click('[data-adopt]');
  assert.equal(JSON.parse(await p2.evaluate(() => localStorage.getItem('been-there.v1'))).us.TX, undefined);
  assert.equal(await p2.isVisible('#banner'), false);
  await other.close();
}

// The picture renders.
const size = await page.evaluate(async () => {
  const { picture } = await import('./js/picture.js');
  const c = await picture('us', { us: { geo: (await import('./js/data/us-geo.js')).default, marks: beenThere.me.us, boxes: [], been: 4, pct: 10 }, name: 'Mark' });
  return [c.width, c.height, c.toDataURL().length > 20000];
});
assert.deepEqual(size, [1080, 1350, true]);

// Fits a phone: nothing scrolls sideways.
assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'the page scrolls sideways on a phone');

// Works offline once it has been opened. The server goes down as well as the browser: in some Chromium builds the
// browser's offline switch alone doesn't stop the service worker's own requests, and this passed with no copy at all.
await page.waitForFunction(() => navigator.serviceWorker?.controller, null, { timeout: 10000 });
const title = await page.title();
net = 'down';
await ctx.setOffline(true);
await page.reload();
assert.equal(await page.title(), title, 'the page did not open offline');
await ctx.setOffline(false);

// On a connection that's up but not answering, it opens from the copy too, after the worker's few seconds' wait for
// the network: the page and every file it loads (were any of them left waiting on the network, it wouldn't open).
net = 'stalled';
const t0 = Date.now();
await page.reload({ timeout: 10000 }).catch(() => {});
const took = Date.now() - t0;
assert.ok(took < 8000, `the page took ${took} ms to open on a stalled connection`);
assert.equal(await page.title(), title, 'the page did not open on a stalled connection');
net = 'up';
for (const [req, res] of held.splice(0)) serve(req, res);

// A new release: every file in the new copy comes from the server, though the browser still has its own copies of
// the old ones for ten minutes. (The next release changes index.html, and so FILES in sw.js, as a real one does.)
release = true;
await page.evaluate(async () => (await navigator.serviceWorker.getRegistration()).update());
await until(() => page.evaluate(async () => !!(await (await caches.match('index.html'))?.text())?.includes('<!-- the next release -->')),
  10000, "the new release's offline copy kept the old index.html");
release = false;

assert.deepEqual(problems.filter(p => !p.startsWith('failed:')), [], 'problems while using it');
await browser.close();
server.close();

// sw.js changes whenever a file it keeps does, so a release replaces the whole offline copy at once: FILES in sw.js is
// a fingerprint of every file in SHELL (sha1 of each, in the list's order, an address like './' read as its
// index.html; the first 8 hex of the sha1 of those).
const sw = await readFile(join(root, 'sw.js'), 'utf8');
const shell = [...sw.match(/SHELL = \[([^\]]*)\]/)[1].replace(/\/\/.*/g, '').matchAll(/'([^']*)'/g)].map(m => m[1]);
const all = createHash('sha1');
for (const f of shell) all.update(createHash('sha1').update(await readFile(join(root, f.endsWith('/') ? f + 'index.html' : f))).digest());
const files = all.digest('hex').slice(0, 8);
assert.equal(sw.match(/const FILES = '([0-9a-f]*)'/)?.[1], files, `a file sw.js keeps for offline has changed: set FILES in sw.js to '${files}'`);
console.log('all good');
