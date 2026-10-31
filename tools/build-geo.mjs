// Builds the map shapes the app draws:  node tools/build-geo.mjs  (after npm install)
// Writes js/data/us-geo.js and js/data/world-geo.js from the us-atlas and world-atlas packages (US Census and
// Natural Earth, both public domain), simplified so the maps stay small, as SVG path strings.
import { readFile, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as topo from 'topojson-client';
import * as simp from 'topojson-simplify';
import { geoPath, geoArea, geoCentroid, geoEqualEarth, geoGraticule } from 'd3-geo';
import countries from 'i18n-iso-countries';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const load = async p => JSON.parse(await readFile(join(root, 'node_modules', p), 'utf8'));
const EARTH_KM2 = 6371.0088 ** 2;
const round = (n, d = 1) => Math.round(n * 10 ** d) / 10 ** d;

const FIPS = {
  '01': 'AL', '02': 'AK', '04': 'AZ', '05': 'AR', '06': 'CA', '08': 'CO', '09': 'CT', '10': 'DE', '11': 'DC',
  '12': 'FL', '13': 'GA', '15': 'HI', '16': 'ID', '17': 'IL', '18': 'IN', '19': 'IA', '20': 'KS', '21': 'KY',
  '22': 'LA', '23': 'ME', '24': 'MD', '25': 'MA', '26': 'MI', '27': 'MN', '28': 'MS', '29': 'MO', '30': 'MT',
  '31': 'NE', '32': 'NV', '33': 'NH', '34': 'NJ', '35': 'NM', '36': 'NY', '37': 'NC', '38': 'ND', '39': 'OH',
  '40': 'OK', '41': 'OR', '42': 'PA', '44': 'RI', '45': 'SC', '46': 'SD', '47': 'TN', '48': 'TX', '49': 'UT',
  '50': 'VT', '51': 'VA', '53': 'WA', '54': 'WV', '55': 'WI', '56': 'WY',
};

// The point a label or a route goes through: the middle of a state's biggest piece, nudged where that lands badly.
const NUDGE = { FL: [14, 6], MI: [8, 18], LA: [-10, 0], KY: [6, 2], VA: [8, 4], ID: [0, 22], CA: [-8, 0], MD: [6, -4],
  NY: [6, 2], HI: [8, 0], AK: [0, 0], MN: [-4, 6], OK: [10, 0], WV: [-2, 4], NC: [6, 0], MA: [-6, 0] };
function labelPoint(path, feature) {
  const g = feature.geometry;
  let best = g;
  if (g.type === 'MultiPolygon') {
    let top = -1;
    for (const coords of g.coordinates) {
      const piece = { type: 'Polygon', coordinates: coords };
      const a = path.area(piece);
      if (a > top) { top = a; best = piece; }
    }
  }
  return path.centroid(best);
}

// ---- The United States: Albers USA, already projected to 975 x 610, Alaska and Hawaii in their usual boxes.
{
  const albers = await load('us-atlas/states-albers-10m.json');
  const plain = await load('us-atlas/states-10m.json');
  const t = simp.simplify(simp.presimplify(albers), 0.5);
  const path = geoPath(); path.digits(1);
  const states = {}; const order = [];
  const real = new Map(topo.feature(plain, plain.objects.states).features.map(f => [f.id, f]));
  const geoms = t.objects.states.geometries;
  for (const f of topo.feature(t, t.objects.states).features) {
    const code = FIPS[f.id];
    const [x, y] = labelPoint(path, f);
    const [nx, ny] = NUDGE[code] || [0, 0];
    const r = real.get(f.id);
    const [lon, lat] = geoCentroid(r);
    states[code] = { d: path(f), x: round(x + nx), y: round(y + ny), km2: Math.round(geoArea(r) * EARTH_KM2), lon: round(lon, 2), lat: round(lat, 2) };
    order.push(code);
  }
  const nb = topo.neighbors(geoms);
  const neighbors = {};
  geoms.forEach((g, i) => { neighbors[FIPS[g.id]] = nb[i].map(j => FIPS[geoms[j].id]).sort(); });
  const out = { w: 975, h: 610, states, neighbors };
  await writeFile(join(root, 'js/data/us-geo.js'),
    '// Made by tools/build-geo.mjs from us-atlas (US Census Bureau, public domain). Don’t edit by hand.\nexport default ' + JSON.stringify(out) + ';\n');
  console.log('us', Object.keys(states).length, 'states', JSON.stringify(out).length, 'bytes');
}

// ---- The world: Equal Earth, so areas compare fairly, from Natural Earth's 1:50m countries.
{
  const world = await load('world-atlas/countries-50m.json');
  // Pieces without an ISO code of their own: Kosovo has one by convention (XK). The others join the country the UN
  // counts them in, or stay plain land.
  const BY_NAME = { Kosovo: 'XK', Somaliland: 'SO', 'N. Cyprus': 'CY', 'Ashmore and Cartier Is.': 'AU' };
  for (const g of world.objects.countries.geometries) {
    const name = g.properties.name;
    g.properties.code = BY_NAME[name] || (g.id ? countries.numericToAlpha2(g.id) : null) || null;
    if (name === 'Ashmore and Cartier Is.') g.properties.code = null; // a reef; it'd only make Australia's outline odd
  }
  // Short names for the places without a card of their own (the app's cards have their own names).
  const NAMES = { FK: 'Falkland Islands', GS: 'South Georgia', IO: 'British Indian Ocean Territory', TF: 'French Southern Lands',
    HM: 'Heard and McDonald Islands', VG: 'British Virgin Islands', MF: 'Saint-Martin', SX: 'Sint Maarten', BL: 'Saint-Barthélemy',
    PM: 'Saint-Pierre and Miquelon', WF: 'Wallis and Futuna', MP: 'Northern Mariana Islands', AX: 'Åland', SH: 'Saint Helena', PN: 'Pitcairn Islands' };
  const pre = simp.presimplify(world);
  const t = simp.simplify(pre, simp.quantile(pre, 0.12));
  const W = 1000;
  const proj = geoEqualEarth().rotate([-10, 0]).fitWidth(W, { type: 'Sphere' });
  const path = geoPath(proj); path.digits(1);
  const H = Math.ceil(path.bounds({ type: 'Sphere' })[1][1]);
  const realFeatures = topo.feature(world, world.objects.countries).features;

  const geoms = t.objects.countries.geometries;
  const byCode = new Map();
  geoms.forEach(g => { const c = g.properties.code; if (c) (byCode.get(c) || byCode.set(c, []).get(c)).push(g); });
  const places = {};
  for (const [code, gs] of byCode) {
    const merged = topo.merge(t, gs);
    const feature = { type: 'Feature', geometry: merged };
    const real = realFeatures.filter(f => f.properties.code === code || (code === 'SO' && f.properties.name === 'Somaliland') || (code === 'CY' && f.properties.name === 'N. Cyprus') || (code === 'XK' && f.properties.name === 'Kosovo'));
    const km2 = Math.round(real.reduce((s, f) => s + geoArea(f), 0) * EARTH_KM2);
    const [x, y] = labelPoint(path, feature);
    const [[x0, y0], [x1, y1]] = path.bounds(feature);
    const d = path(feature);
    const big = Math.max(x1 - x0, y1 - y0);
    places[code] = { n: NAMES[code] || countries.getName(code, 'en') || code, d: d || '', x: round(x), y: round(y), km2, ...(big < 4 ? { tiny: 1 } : {}) };
  }
  // Tuvalu is too small for the 1:50m set. It gets a dot.
  const [tx, ty] = proj([179.2, -8.5]);
  places.TV = { n: 'Tuvalu', d: '', x: round(tx), y: round(ty), km2: 26, tiny: 1 };

  const sphere = path({ type: 'Sphere' });
  const grat = path(geoGraticule().step([30, 30]).precision(5)());
  // Plain land that belongs to no one we list (Siachen, Australia's Indian Ocean islands), drawn but not tappable.
  const plain = geoms.filter(g => !g.properties.code);
  const other = plain.length ? path(topo.merge(t, plain)) : '';
  const out = { w: W, h: H, sphere, grat, other, places };
  await writeFile(join(root, 'js/data/world-geo.js'),
    '// Made by tools/build-geo.mjs from world-atlas (Natural Earth, public domain). Don’t edit by hand.\nexport default ' + JSON.stringify(out) + ';\n');
  console.log('world', Object.keys(places).length, 'places', JSON.stringify(out).length, 'bytes', 'h', H);
}
