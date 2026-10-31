// Been There: the page. Two maps (the states and the world), a card for each place, and the word guesses.
import US from './data/us-geo.js';
import WORLD from './data/world-geo.js';
import STATES from './data/states.js';
import COUNTRIES from './data/countries.js';
import { WORDS, answerIn } from './data/words.js';
import { MapView, el } from './map.js';
import * as L from './logic.js';
import { savePicture } from './picture.js';

const ADDRESS = 'https://junkdrawer.works/been-there/';
const KEY = 'been-there.v1';
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const framed = (() => { try { return window.top !== window.self; } catch { return true; } })();

// ---- Saved state
const blank = () => ({ us: {}, world: {}, grewUp: null, answers: {}, name: '' });
function load() {
  try {
    const d = JSON.parse(localStorage.getItem(KEY));
    if (d && typeof d === 'object') return { ...blank(), ...d, us: d.us || {}, world: d.world || {}, answers: d.answers || {} };
  } catch { /* nothing saved, or storage is off */ }
  return blank();
}
let me = load();
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(me)); } catch { /* private window: it lasts the visit */ } };
const pref = (k, v) => { try { if (v === undefined) return localStorage.getItem('been-there.' + k); localStorage.setItem('been-there.' + k, v); } catch { return null; } };

const US_CODES = Object.keys(US.states).sort((a, b) => usName(a).localeCompare(usName(b)));
const STATE_CODES = US_CODES.filter(L.isState);
const WORLD_CODES = Object.keys(WORLD.places).sort((a, b) => worldName(a).localeCompare(worldName(b)));
// The 195 countries everyone counts: the UN's 193 members, the Vatican and Palestine.
const NOT_COUNTED = new Set('AS AI AQ AW AX BL BM BQ BV CC CK CW CX EH FK FO GF GG GI GL GP GS GU HK HM IM IO JE KY MF MO MP MQ MS NC NF NU PF PM PN PR RE SH SJ SX TC TF TK TW UM VG VI WF YT XK'.split(' '));
const COUNTRY_CODES = WORLD_CODES.filter(c => !NOT_COUNTED.has(c));
const WORLD_KM2 = Object.values(WORLD.places).reduce((s, p) => s + p.km2, 0);
const US_KM2 = Object.values(US.states).reduce((s, p) => s + p.km2, 0);
const CONTINENTS = ['Africa', 'Asia', 'Europe', 'North America', 'South America', 'Oceania', 'Antarctica'];
const continentOf = c => COUNTRIES[c]?.continent || null;

function usName(c) { return STATES[c]?.name || c; }
function worldName(c) { return COUNTRIES[c]?.name || WORLD.places[c]?.n || c; }
const flag = c => c === 'AQ' || c.length !== 2 ? '🧊' : String.fromCodePoint(...[...c].map(ch => 0x1F1A5 + ch.charCodeAt(0)));
const fold = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const ALIASES = { US: 'usa america united states', GB: 'uk britain great britain england scotland wales northern ireland', NL: 'holland',
  CZ: 'czech republic', CI: 'ivory coast', MM: 'burma', SZ: 'swaziland', MK: 'macedonia', TR: 'turkiye', CV: 'cape verde',
  TL: 'east timor', KR: 'korea', CD: 'congo kinshasa zaire', CG: 'congo brazzaville', VA: 'holy see vatican', AE: 'uae dubai abu dhabi',
  VI: 'virgin islands', PS: 'gaza west bank', FM: 'micronesia', VN: 'viet nam', LA: 'laos', RU: 'russia', CN: 'china', TW: 'taiwan' };

const KINDS = {
  us: { marks: () => me.us, name: usName, codes: US_CODES, noun: 'state', nouns: 'states' },
  world: { marks: () => me.world, name: worldName, codes: WORLD_CODES, noun: 'country', nouns: 'countries' },
};

// ---- What's on screen
const ui = {
  tab: ['us', 'world', 'words'].includes(pref('tab')) ? pref('tab') : 'us',
  brush: { us: null, world: null },
  open: null, // { kind, code }
  route: null,
  view: 'mine', // 'mine', 'theirs' (a shared map) or 'compare'
  shared: null,
  salt: { us: 0, world: 0 },
};

function setMark(kind, code, status) {
  const marks = KINDS[kind].marks();
  if (!status || marks[code] === status) delete marks[code]; else marks[code] = status;
  // A state you've been to puts the United States on the world map too.
  if (kind === 'us' && L.isBeen(marks[code])) {
    const lived = marks[code] === 'lived';
    if (!L.isBeen(me.world.US) || (lived && me.world.US !== 'lived')) me.world.US = lived ? 'lived' : 'visited';
  }
  if (kind === 'us' && me.grewUp === code && marks[code] !== 'lived') me.grewUp = null;
  save();
  render();
}

// ---- Maps
const BOXES = [['VT', 834, 82], ['NH', 935, 152], ['MA', 935, 176], ['RI', 935, 200], ['CT', 935, 224], ['NJ', 935, 262], ['DE', 935, 286], ['MD', 935, 310], ['DC', 935, 334]];
const maps = {};
function makeMaps() {
  maps.us = new MapView($('us-map'), {
    w: US.w, h: US.h, kind: 'us', shapes: US.states, boxes: BOXES, labels: true, maxZoom: 6, title: 'Map of the United States',
    label: usName, onTap: code => tap('us', code), routeFromFirst: true,
  });
  maps.world = new MapView($('world-map'), {
    w: WORLD.w, h: WORLD.h, kind: 'world', shapes: WORLD.places, maxZoom: 14, title: 'Map of the world',
    label: worldName, onTap: code => tap('world', code),
    before: g => {
      el('path', { d: WORLD.sphere, class: 'sea' }, g);
      el('path', { d: WORLD.grat, class: 'grat' }, g);
      if (WORLD.other) el('path', { d: WORLD.other, class: 'other' }, g);
    },
  });
  for (const kind of ['us', 'world']) {
    const wrap = $(`${kind}-map`);
    wrap.querySelector('.zoomer').addEventListener('click', e => {
      const z = e.target.closest('[data-zoom]')?.dataset.zoom;
      if (z === 'in') maps[kind].zoomBy(1.6); else if (z === 'out') maps[kind].zoomBy(1 / 1.6); else if (z === 'reset') maps[kind].reset();
    });
    maps[kind].onZoom = k => {
      wrap.querySelector('[data-zoom=reset]').hidden = k <= 1.01;
      wrap.classList.toggle('zoomed', k > 1.01);
      wrap.style.setProperty('--k', k);
    };
    maps[kind].onZoom(1);
  }
}

function tap(kind, code) {
  const brush = ui.brush[kind];
  if (brush && ui.view === 'mine') { setMark(kind, code, brush); flash(kind, code); return; }
  openCard(kind, code);
  // On a phone the card comes up from the bottom: keep the map in view above it, so another tap switches cards.
  if (innerWidth < 980) {
    const r = $(`${kind}-map`).getBoundingClientRect();
    if (r.top < 0 || r.bottom > innerHeight * 0.42) scrollBy({ top: r.top - 6, behavior: 'smooth' });
  }
}
// A quick word on the hint line about what a tap just did.
function flash(kind, code) {
  const s = KINDS[kind].marks()[code];
  const note = $(`${kind}-hint`).querySelector('.did');
  if (note) note.textContent = s ? `${KINDS[kind].name(code)}: ${L.LABEL[s]}.` : `${KINDS[kind].name(code)}: cleared.`;
}

function statusFor(kind) {
  const mine = KINDS[kind].marks();
  if (ui.view === 'mine' || !ui.shared) return c => mine[c];
  const theirs = ui.shared[kind];
  if (ui.view === 'theirs') return c => theirs[c];
  const cmp = L.compare(mine, theirs, KINDS[kind].codes);
  return c => cmp[c];
}

// ---- Rendering
function render() {
  for (const kind of ['us', 'world']) {
    maps[kind].paint(statusFor(kind));
    legend(kind);
    hint(kind);
  }
  usSummary(); usBlocks(); rows('us', $('us-rows'), US_CODES); smalls();
  worldSummary(); worldBlocks(); continents(); find();
  banner();
  maps.us.route(ui.view === 'mine' || ui.view === 'compare' ? ui.route : null);
  if (ui.open) card(ui.open.kind, ui.open.code);
  if (ui.tab === 'words') words();
}

const pct = (a, b) => b ? Math.round(100 * a / b) : 0;
const list = names => names.length <= 2 ? names.join(' and ') : names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1];

function smalls() {
  const st = statusFor('us');
  $('us-smalls').innerHTML = BOXES.map(([c]) => `<button type="button" data-pick="us:${c}" ${st(c) ? `data-s="${st(c)}"` : ''} class="${ui.open?.code === c ? 'sel' : ''}" aria-label="${esc(usName(c))}">${c}</button>`).join('');
}

function legend(kind) {
  const host = $(`${kind}-legend`);
  if (ui.view === 'compare') {
    const st = statusFor(kind);
    const n = s => KINDS[kind].codes.filter(c => st(c) === s).length;
    const who = esc(ui.shared.name || 'Them');
    host.innerHTML = `<span class="key" data-s="both"><i></i>Both of you <b>${n('both')}</b></span>`
      + `<span class="key" data-s="mine"><i></i>Only you <b>${n('mine')}</b></span>`
      + `<span class="key" data-s="theirs"><i></i>Only ${who} <b>${n('theirs')}</b></span>`;
    return;
  }
  const marks = ui.view === 'theirs' ? ui.shared[kind] : KINDS[kind].marks();
  const counted = kind === 'us' ? US_CODES : WORLD_CODES;
  const t = L.tally(marks, counted);
  host.innerHTML = L.STATUSES.map(s => {
    const on = ui.brush[kind] === s;
    return `<button type="button" class="key" data-s="${s}" aria-pressed="${on}" ${ui.view !== 'mine' ? 'disabled' : ''}><i></i>${L.LABEL[s]} <b>${t[s]}</b></button>`;
  }).join('');
}

function hint(kind) {
  const host = $(`${kind}-hint`);
  const k = KINDS[kind];
  const b = ui.brush[kind];
  if (ui.view !== 'mine') { host.innerHTML = `Tap a ${k.noun} to read about it.`; return; }
  host.classList.toggle('armed', !!b);
  host.innerHTML = b
    ? `Tap ${k.nouns} to mark them <b>${L.LABEL[b]}</b>. Tap one again to clear it. <button type="button" class="link" data-done>Done</button> <span class="did" aria-live="polite"></span>`
    : `Tap a ${k.noun} to see what you’re missing there. To mark a lot of them at once, pick a color first.`;
}

function usSummary() {
  const host = $('us-summary');
  const marks = ui.view === 'theirs' ? ui.shared.us : me.us;
  if (ui.view === 'compare') {
    const st = statusFor('us');
    const n = s => STATE_CODES.filter(c => st(c) === s).length;
    const neither = STATE_CODES.filter(c => !st(c)).length;
    host.innerHTML = `<p class="big"><b>${n('both')}</b> states you’ve both been to</p><p class="sub">${n('mine')} only you, ${n('theirs')} only ${esc(ui.shared.name || 'them')}, and ${neither} neither of you.</p>`;
    return;
  }
  const t = L.tally(marks, STATE_CODES);
  const km2 = US_CODES.filter(c => L.isBeen(marks[c])).reduce((s, c) => s + US.states[c].km2, 0);
  const whose = ui.view === 'theirs' ? `${esc(ui.shared.name || 'They')}’ve` : 'You’ve';
  const bits = [];
  if (t.been) bits.push(`${pct(km2, US_KM2)}% of the country by area`);
  if (t.lived) bits.push(`lived in ${t.lived}`);
  if (t.passed) bits.push(`${t.passed} just passing through`);
  if (L.isBeen(marks.DC)) bits.push('and DC');
  host.innerHTML = `<p class="big"><b>${t.been}</b> of 50 states</p><p class="sub">${t.been ? whose + ' seen ' + bits.join(' · ') : 'Tap the states you’ve been to, or pick a color below to mark several.'}</p>`;
}

function worldSummary() {
  const host = $('world-summary');
  const marks = ui.view === 'theirs' ? ui.shared.world : me.world;
  if (ui.view === 'compare') {
    const st = statusFor('world');
    const n = s => COUNTRY_CODES.filter(c => st(c) === s).length;
    host.innerHTML = `<p class="big"><b>${n('both')}</b> countries you’ve both been to</p><p class="sub">${n('mine')} only you and ${n('theirs')} only ${esc(ui.shared.name || 'them')}.</p>`;
    return;
  }
  const t = L.tally(marks, COUNTRY_CODES);
  const others = WORLD_CODES.filter(c => NOT_COUNTED.has(c) && L.isBeen(marks[c])).length;
  const conts = new Set(WORLD_CODES.filter(c => L.isBeen(marks[c])).map(continentOf).filter(Boolean));
  const km2 = WORLD_CODES.filter(c => L.isBeen(marks[c])).reduce((s, c) => s + WORLD.places[c].km2, 0);
  const bits = [];
  if (t.been || others) {
    bits.push(`${conts.size} of 7 continents`);
    const p = 100 * km2 / WORLD_KM2;
    bits.push(`${p > 0 && p < 1 ? 'under 1' : Math.round(p)}% of the world’s land`);
    if (others) bits.push(`plus ${others} other place${others > 1 ? 's' : ''}`);
  }
  host.innerHTML = `<p class="big"><b>${t.been}</b> of 195 countries</p><p class="sub">${bits.length ? bits.join(' · ') : 'Tap the countries you’ve been to, or find them by name below.'}</p>`;
}

const stateLink = c => `<button type="button" class="place" data-open="us:${c}">${esc(usName(c))}</button>`;
const worldLink = c => `<button type="button" class="place" data-open="world:${c}">${esc(worldName(c))}</button>`;

function usBlocks() {
  const host = $('us-blocks');
  const marks = me.us;
  const out = [];
  if (ui.view === 'compare') {
    const both = { ...me.us };
    for (const [c, s] of Object.entries(ui.shared.us)) if (L.isBeen(s) && !L.isBeen(both[c])) both[c] = s;
    out.push(tripBlock(both, `A road trip for the two of you`));
    const neither = STATE_CODES.filter(c => !L.isBeen(me.us[c]) && !L.isBeen(ui.shared.us[c]));
    out.push(`<section class="block"><h2>Neither of you has been to</h2><p class="chips">${neither.map(stateLink).join(' ') || 'Nowhere. Between you, you’ve covered the country.'}</p></section>`);
    host.innerHTML = out.join('');
    return;
  }
  if (ui.view === 'theirs') { host.innerHTML = ''; return; }
  out.push(tripBlock(marks, 'Your next road trip'));
  // Things not seen yet, a fresh handful each day.
  const unseen = US_CODES.filter(c => !L.isBeen(marks[c]) && STATES[c]);
  if (unseen.length) {
    const picks = L.dailyPick(unseen, 5, ui.salt.us);
    out.push(`<section class="block"><h2>What you haven’t seen yet</h2><ul class="unseen">${picks.map((c, i) => {
      const dm = STATES[c].dontMiss[(i + ui.salt.us) % STATES[c].dontMiss.length];
      return `<li><button type="button" class="unseen-row" data-open="us:${c}"><b>${esc(dm.what)}</b><span class="where">${esc(usName(c))}</span><span class="why">${esc(dm.why)}</span></button></li>`;
    }).join('')}</ul><button type="button" class="ghost small" data-more="us">Show me others</button></section>`);
  }
  const want = US_CODES.filter(c => marks[c] === 'want');
  out.push(`<section class="block"><h2>On your list</h2>${want.length ? `<ul class="want">${want.map(c => `<li><button type="button" class="want-row" data-open="us:${c}"><b>${esc(usName(c))}</b><span>${esc(STATES[c]?.trip ? 'Start in ' + STATES[c].trip.start + '. ' + STATES[c].trip.days[0] : '')}</span></button></li>`).join('')}</ul>` : '<p class="muted">Mark states <b>Want to go</b> and they’ll show up here with a plan for a long weekend.</p>'}</section>`);
  const been = new Set(US_CODES.filter(c => L.isBeen(marks[c])));
  out.push(`<section class="block"><h2>Region by region</h2><ul class="bars">${L.REGIONS.map(r => {
    const have = r.codes.filter(c => been.has(c)).length;
    return `<li><span class="bar-name">${r.name}</span><span class="bar" style="--p:${pct(have, r.codes.length)}%"></span><span class="bar-n">${have} of ${r.codes.length}</span></li>`;
  }).join('')}</ul></section>`);
  out.push(`<section class="block stamps-block"><h2>Milestones</h2><ul class="stamps">${L.MILESTONES.map((m, i) => {
    const p = L.milestone(m, been);
    const sub = p.done ? (m.line || 'Done.') : p.need.length && p.need.length <= 3 ? `Still to go: ${list(p.need.map(usName))}.` : p.have != null ? `${p.have} of ${p.of} so far.` : (m.line || '');
    return `<li class="stamp ${p.done ? 'done' : ''}" style="--r:${((i * 37) % 9) - 4}deg"><b>${m.name}</b><span>${esc(sub)}</span></li>`;
  }).join('')}</ul></section>`);
  host.innerHTML = out.join('');
}

function tripBlock(marks, title) {
  const trips = L.roadTrips(marks, US, { max: 6, count: 2 });
  const left = ['AK', 'HI'].filter(c => !L.isBeen(marks[c]));
  if (!trips.length) {
    return `<section class="block trip"><h2>${title}</h2><p>You’ve been to every state you can drive to.${left.length ? ` That leaves the flights: ${list(left.map(usName))}.` : ''}</p></section>`;
  }
  const [t, alt] = trips;
  const showing = ui.route && ui.route.join() === [t.from, ...t.path].filter(Boolean).join();
  const from = t.from ? `, starting from ${esc(usName(t.from))}` : '';
  const n = t.path.length;
  return `<section class="block trip"><h2>${title}</h2>
    <p><b>${n} new state${n > 1 ? 's' : ''}</b> in one drive${from}:</p>
    <p class="leg">${t.path.map(stateLink).join('<span class="arrow" aria-hidden="true">→</span>')}</p>
    <div class="row-btns"><button type="button" class="ghost small" data-route="${[t.from, ...t.path].filter(Boolean).join(',')}" aria-pressed="${showing}">${showing ? 'Hide it on the map' : 'Show it on the map'}</button>
    ${ui.view === 'mine' ? `<button type="button" class="ghost small" data-want="${t.path.join(',')}">Add them to Want to go</button>` : ''}</div>
    ${alt ? `<p class="alt">Or ${alt.path.length}: ${alt.path.map(stateLink).join('<span class="arrow" aria-hidden="true">→</span>')}${alt.from ? ` from ${esc(usName(alt.from))}` : ''}.</p>` : ''}
    ${left.length ? `<p class="alt">And when you’re ready to fly: ${list(left.map(stateLink))}.</p>` : ''}
  </section>`;
}

function worldBlocks() {
  const host = $('world-blocks');
  if (ui.view !== 'mine') {
    if (ui.view === 'compare') {
      const neither = COUNTRY_CODES.filter(c => !L.isBeen(me.world[c]) && !L.isBeen(ui.shared.world[c]) && COUNTRIES[c]);
      const picks = L.dailyPick(neither, 8, 7);
      host.innerHTML = `<section class="block"><h2>Somewhere new for both of you</h2><p class="chips">${picks.map(worldLink).join(' ')}</p></section>`;
    } else host.innerHTML = '';
    return;
  }
  const marks = me.world;
  const out = [];
  const unseen = WORLD_CODES.filter(c => !L.isBeen(marks[c]) && COUNTRIES[c]);
  if (unseen.length) {
    const picks = L.dailyPick(unseen, 5, 100 + ui.salt.world);
    out.push(`<section class="block"><h2>What you haven’t seen yet</h2><ul class="unseen">${picks.map((c, i) => {
      const co = COUNTRIES[c];
      return `<li><button type="button" class="unseen-row" data-open="world:${c}"><b>${esc(co.dontMiss[i % co.dontMiss.length])}</b><span class="where">${flag(c)} ${esc(co.name)}</span><span class="why">${esc(co.missing)}</span></button></li>`;
    }).join('')}</ul><button type="button" class="ghost small" data-more="world">Show me others</button></section>`);
  }
  const want = WORLD_CODES.filter(c => marks[c] === 'want');
  out.push(`<section class="block"><h2>On your list</h2>${want.length ? `<ul class="want">${want.map(c => `<li><button type="button" class="want-row" data-open="world:${c}"><b>${flag(c)} ${esc(worldName(c))}</b><span>${esc(COUNTRIES[c]?.missing || '')}</span></button></li>`).join('')}</ul>` : '<p class="muted">Mark countries <b>Want to go</b> and they’ll gather here.</p>'}</section>`);
  const been = new Set(WORLD_CODES.filter(c => L.isBeen(marks[c])));
  out.push(`<section class="block"><h2>Continent by continent</h2><ul class="bars">${CONTINENTS.map(name => {
    const all = (name === 'Antarctica' ? ['AQ'] : COUNTRY_CODES.filter(c => continentOf(c) === name));
    const have = all.filter(c => been.has(c)).length;
    return `<li><span class="bar-name">${name}</span><span class="bar" style="--p:${pct(have, all.length)}%"></span><span class="bar-n">${name === 'Antarctica' ? (have ? 'Yes' : 'Not yet') : `${have} of ${all.length}`}</span></li>`;
  }).join('')}</ul></section>`);
  host.innerHTML = out.join('');
}

function rowHTML(kind, c) {
  const st = statusFor(kind)(c);
  const name = KINDS[kind].name(c);
  const lab = st ? (ui.view === 'compare' ? { both: 'Both', mine: 'You', theirs: esc(ui.shared.name || 'Them') }[st] : L.LABEL[st]) : '';
  return `<li><button type="button" class="row" data-pick="${kind}:${c}">${kind === 'world' ? `<span class="flag" aria-hidden="true">${flag(c)}</span>` : `<span class="code" aria-hidden="true">${c}</span>`}<span class="nm">${esc(name)}</span><span class="st" ${st ? `data-s="${st}"` : ''}>${lab}</span></button></li>`;
}
function rows(kind, host, codes) { host.innerHTML = codes.map(c => rowHTML(kind, c)).join(''); }

function continents() {
  const host = $('continents');
  const open = new Set([...host.querySelectorAll('details[open]')].map(d => d.dataset.c));
  const groups = [...CONTINENTS, 'Other places'];
  host.innerHTML = '<h2 class="list-h">Every country, by continent</h2>' + groups.map(g => {
    const codes = g === 'Other places'
      ? WORLD_CODES.filter(c => !continentOf(c))
      : WORLD_CODES.filter(c => continentOf(c) === g);
    const been = codes.filter(c => L.isBeen(KINDS.world.marks()[c])).length;
    return `<details data-c="${g}" ${open.has(g) ? 'open' : ''}><summary>${g} <span class="muted">${been ? `· ${been} so far` : ''}</span></summary><ul class="rows">${codes.map(c => rowHTML('world', c)).join('')}</ul></details>`;
  }).join('');
}

function find() {
  const q = fold($('find').value.trim());
  const host = $('find-rows');
  if (!q) { host.innerHTML = ''; return; }
  const hits = WORLD_CODES.filter(c => fold(worldName(c)).includes(q) || (ALIASES[c] || '').includes(q) || fold(WORLD.places[c].n).includes(q)).slice(0, 8);
  host.innerHTML = hits.length ? hits.map(c => rowHTML('world', c)).join('') : '<li class="muted none">Nothing by that name.</li>';
}

function banner() {
  const host = $('banner');
  if (!ui.shared) { host.hidden = true; return; }
  host.hidden = false;
  const name = esc(ui.shared.name || 'Someone');
  const ts = L.tally(ui.shared.us, STATE_CODES).been, tw = L.tally(ui.shared.world, COUNTRY_CODES).been;
  const mine = Object.keys(me.us).length + Object.keys(me.world).length > 0;
  host.innerHTML = `<p><b>${name}’s map</b>: ${ts} state${ts === 1 ? '' : 's'} and ${tw} countr${tw === 1 ? 'y' : 'ies'}.</p>
    <div class="row-btns">
      <button type="button" data-view="theirs" aria-pressed="${ui.view === 'theirs'}">Theirs</button>
      ${mine ? `<button type="button" data-view="compare" aria-pressed="${ui.view === 'compare'}">Compare with mine</button>` : ''}
      <button type="button" data-view="mine" aria-pressed="${ui.view === 'mine'}">${mine ? 'Mine' : 'Start my own'}</button>
      <button type="button" class="ghost" data-adopt>Use this map</button>
      <button type="button" class="ghost" data-unshare aria-label="Close the shared map">✕</button>
    </div>`;
}

// ---- The card for one place
function openCard(kind, code) {
  ui.open = { kind, code };
  card(kind, code);
  const sheet = $('sheet');
  sheet.hidden = false;
  document.body.classList.add('sheet-open');
  maps[kind].select(code);
  smalls();
  $('card').scrollTop = 0;
  requestAnimationFrame(() => sheet.classList.add('in'));
}
function closeCard() {
  if (!ui.open) return;
  maps[ui.open.kind].select(null);
  ui.open = null;
  smalls();
  const sheet = $('sheet');
  sheet.classList.remove('in');
  document.body.classList.remove('sheet-open');
  setTimeout(() => { if (!ui.open) sheet.hidden = true; }, 220);
}

function picker(kind, code) {
  const cur = KINDS[kind].marks()[code];
  const theirs = ui.shared && ui.view !== 'mine' ? ui.shared[kind][code] : undefined;
  return `${ui.shared && ui.view !== 'mine' ? `<p class="theirs">${esc(ui.shared.name || 'Them')}: ${theirs ? L.LABEL[theirs] : 'not yet'}. You:</p>` : ''}
    <div class="picker" role="group" aria-label="Your mark">${L.STATUSES.map(s => `<button type="button" data-set="${kind}:${code}:${s}" data-s="${s}" aria-pressed="${cur === s}"><i></i>${L.LABEL[s]}</button>`).join('')}</div>
    ${kind === 'us' && cur === 'lived' ? `<label class="grew-check"><input type="checkbox" data-grew="${code}" ${me.grewUp === code ? 'checked' : ''}> I grew up here</label>` : ''}`;
}

function card(kind, code) {
  const host = $('card');
  host.innerHTML = kind === 'us' ? stateCard(code) : countryCard(code);
}

function stateCard(code) {
  const s = STATES[code];
  const head = `<header class="card-head"><button type="button" class="grab" data-close aria-label="Close"></button>
    <div><h2 id="card-name">${esc(s?.name || code)}</h2>${s?.nickname ? `<p class="nick">${esc(s.nickname)}</p>` : ''}</div>
    <button type="button" class="x" data-close aria-label="Close">✕</button></header>`;
  if (!s) return head + picker('us', code);
  const talk = WORDS.filter(w => answerIn(w, code) !== w.base).map(w => w.says[answerIn(w, code)].say);
  const notes = WORDS.map(w => w.hints[code]).filter(Boolean);
  return head + picker('us', code) + `
    <p class="missing">${esc(s.missing)}</p>
    <h3>Don’t miss</h3>
    <ul class="dont">${s.dontMiss.map(d => `<li><b>${esc(d.what)}</b> ${esc(d.why)}</li>`).join('')}</ul>
    <h3>A long weekend</h3>
    <p class="start">Start in ${esc(s.trip.start)}.</p>
    <ol class="days">${s.trip.days.map((d, i) => `<li><span class="day">Day ${i + 1}</span> ${esc(d)}</li>`).join('')}</ol>
    <div class="pair">
      <div class="look"><h3>Keep an eye out for</h3><p><b>${esc(s.lookFor.what)}.</b> ${esc(s.lookFor.line)}</p></div>
      <div class="eat"><h3>Eat</h3><p><b>${esc(s.eat.what)}.</b> ${esc(s.eat.line)}</p></div>
    </div>
    <h3>Odd fact</h3><p>${esc(s.fact)}</p>
    <h3>When to go</h3><p>${esc(s.season)}</p>
    <h3>How they talk</h3>
    <p>${talk.length ? `Here they say ${list(talk.map(t => `<i>${esc(t)}</i>`))}.` : 'Nothing on the word list sets it apart: it’s soda, sub and you guys here, mostly.'}${notes.length ? ` <span class="muted">(${esc(notes.slice(0, 2).join('; '))}.)</span>` : ''}</p>
    ${US.neighbors[code].length ? `<h3>Next door</h3><p class="chips">${US.neighbors[code].map(stateLink).join(' ')}</p>` : ''}`;
}

function countryCard(code) {
  const c = COUNTRIES[code];
  const name = worldName(code);
  const head = `<header class="card-head"><button type="button" class="grab" data-close aria-label="Close"></button>
    <div><h2 id="card-name"><span class="flag" aria-hidden="true">${flag(code)}</span> ${esc(name)}</h2>${c ? `<p class="nick">${[c.capital, c.continent].filter(Boolean).map(esc).join(' · ')}</p>` : ''}</div>
    <button type="button" class="x" data-close aria-label="Close">✕</button></header>`;
  const usLink = code === 'US' ? `<p><button type="button" class="ghost small" data-tab="us">Open the map of the states</button></p>` : '';
  if (!c) return head + picker('world', code) + usLink + `<p class="muted">No card for this one yet, but you can still mark it.</p>`;
  return head + picker('world', code) + usLink + `
    <p class="missing">${esc(c.missing)}</p>
    <h3>Don’t miss</h3>
    <ul class="dont plain">${c.dontMiss.map(d => `<li>${esc(d)}</li>`).join('')}</ul>
    <div class="pair">
      <div class="look"><h3>Keep an eye out for</h3><p>${esc(c.lookFor)}</p></div>
      <div class="eat"><h3>Eat</h3><p>${esc(c.eat)}</p></div>
    </div>
    <h3>Odd fact</h3><p>${esc(c.fact)}</p>
    ${NOT_COUNTED.has(code) ? `<p class="muted small-note">Not one of the 195 countries in the count, but it’s on the map, and it counts toward your continents and land.</p>` : ''}`;
}

// ---- How you talk
const PALETTE = ['--c1', '--c2', '--c3', '--c4', '--c5', '--c6', '--c7'];
function lived() { return US_CODES.filter(c => me.us[c] === 'lived'); }

function words() {
  const sel = $('grew-up');
  if (!sel.options.length) {
    sel.innerHTML = `<option value="">Pick a state</option>${US_CODES.map(c => `<option value="${c}">${esc(usName(c))}</option>`).join('')}<option value="abroad">Outside the US</option>`;
  }
  sel.value = me.grewUp || '';
  const grew = me.grewUp && me.grewUp !== 'abroad' ? me.grewUp : null;
  const others = lived().filter(c => c !== grew);
  $('lived-line').innerHTML = others.length
    ? `You’ve also lived in ${list(others.map(c => esc(usName(c))))}, from your map. Those count a little too.`
    : `Mark the states you’ve lived in on the <button type="button" class="link" data-tab="us">States map</button> and they count a little too.`;
  const host = $('words');
  const open = new Set([...host.querySelectorAll('.word.show-map')].map(n => n.dataset.id));
  const asking = new Set([...host.querySelectorAll('.word.asking')].map(n => n.dataset.id));
  let right = 0, answered = 0;
  host.innerHTML = WORDS.map(w => {
    const g = L.guessWord(w, grew, others, answerIn);
    const a = me.answers[w.id];
    if (a && g) { answered++; if (a === g.key) right++; }
    const say = k => w.says[k]?.say || 'something else';
    let guessHTML;
    if (!g) guessHTML = `<p class="guess muted">Pick where you grew up and it’ll guess.</p>`;
    else {
      const also = g.also.length ? ` After ${list(g.also[0].from.map(usName))}, <i>${esc(say(g.also[0].key))}</i> may slip out too.` : '';
      guessHTML = `<p class="guess">You say <b>${esc(say(g.key))}</b>.</p>
        <p class="why">${esc(w.says[g.key].where)}${g.hint ? ` In ${esc(usName(grew))}, ${esc(g.hint)}.` : ''}${also}</p>`;
    }
    let vote;
    if (a && !asking.has(w.id)) {
      const ok = g && a === g.key;
      vote = `<p class="verdict ${ok ? 'yes' : 'no'}">${ok ? 'Got it right.' : `You say <b>${esc(say(a))}</b>.`} <button type="button" class="link" data-reask="${w.id}">Change</button></p>`;
    } else if (asking.has(w.id) || (a && asking.has(w.id))) {
      vote = `<p class="which">What do you say?</p><div class="choices">${Object.keys(w.says).filter(k => !g || k !== g.key).map(k => `<button type="button" data-say="${w.id}:${k}">${esc(w.says[k].say)}</button>`).join('')}<button type="button" data-say="${w.id}:other">something else</button></div>`;
    } else if (g) {
      vote = `<div class="vote"><button type="button" data-say="${w.id}:${g.key}">That’s me</button><button type="button" class="ghost" data-nope="${w.id}">Not me</button></div>`;
    } else vote = '';
    return `<li class="word ${open.has(w.id) ? 'show-map' : ''} ${asking.has(w.id) ? 'asking' : ''}" data-id="${w.id}">
      <p class="ask">${esc(w.ask)}</p>${guessHTML}${vote}
      <button type="button" class="link where-btn" data-wmap="${w.id}" aria-expanded="${open.has(w.id)}">${open.has(w.id) ? 'Hide the map' : 'Where people say what'}</button>
      <div class="wmap" ${open.has(w.id) ? '' : 'hidden'}></div>
    </li>`;
  }).join('');
  for (const id of open) wordMap(id);
  $('word-score').textContent = answered ? `Right on ${right} of ${answered} so far.` : '';
  sounds();
}

function wordMap(id) {
  const w = WORDS.find(x => x.id === id);
  const li = $('words').querySelector(`.word[data-id="${id}"]`);
  const box = li.querySelector('.wmap');
  box.hidden = false;
  if (box.firstChild) return;
  const keys = Object.keys(w.says);
  const color = k => `var(${PALETTE[keys.indexOf(k) % PALETTE.length]})`;
  const m = new MapView(box, { w: US.w, h: US.h, kind: 'mini', shapes: US.states, boxes: BOXES, label: usName, title: `Where people say each answer to: ${w.ask}` });
  m.fill(c => color(answerIn(w, c)));
  const used = new Set(US_CODES.map(c => answerIn(w, c)));
  const key = document.createElement('ul');
  key.className = 'wkey';
  key.innerHTML = keys.filter(k => used.has(k)).map(k => `<li><i style="background:${color(k)}"></i><b>${esc(w.says[k].say)}</b> <span>${esc(w.says[k].where)}</span></li>`).join('');
  box.appendChild(key);
}

function sounds() {
  const host = $('sounds');
  const answers = Object.fromEntries(Object.entries(me.answers).filter(([, v]) => v !== 'other'));
  const n = Object.keys(answers).length;
  if (n < 5) { host.hidden = n === 0; host.innerHTML = n ? `<h2>Where you sound like you’re from</h2><p class="muted">Answer ${5 - n} more and it’ll have a go.</p>` : ''; return; }
  host.hidden = false;
  const ranked = L.soundsLike(answers, WORDS, US_CODES, answerIn);
  const top = ranked[0][1];
  const best = ranked.filter(([, s]) => s >= top - 0.001).map(([c]) => c);
  const shown = best.length > 4 ? best.slice(0, 4) : best;
  host.innerHTML = `<h2>Where you sound like you’re from</h2>
    <p>Your answers match <b>${list(shown.map(c => esc(usName(c))))}</b>${best.length > 4 ? ` and ${best.length - 4} more` : ''} best: ${Math.round(top * 100)}% of the time.</p>
    <div class="smap"></div><p class="muted small-note">Darker means more of your answers match how people there usually talk.</p>`;
  const m = new MapView(host.querySelector('.smap'), { w: US.w, h: US.h, kind: 'mini', shapes: US.states, boxes: BOXES, label: c => `${usName(c)}: ${Math.round(100 * (ranked.find(r => r[0] === c)?.[1] || 0))}%`, title: 'How well each state matches your answers' });
  const score = new Map(ranked);
  const low = ranked[ranked.length - 1][1];
  m.fill(c => {
    const t = top > low ? (score.get(c) - low) / (top - low) : 1;
    return `color-mix(in oklab, var(--match) ${Math.round(8 + 92 * t ** 1.5)}%, var(--land))`;
  });
}

// ---- Share
function shareLink() {
  const base = /(^|\.)junkdrawer\.works$|^localhost$|^127\./.test(location.hostname) ? location.origin + location.pathname : ADDRESS;
  return base + L.shareHash({ us: me.us, world: me.world, name: me.name });
}
function openShare() {
  $('share-name').value = me.name || '';
  $('share-link').value = shareLink();
  $('share-note').textContent = '';
  $('share-pic').hidden = framed;
  $('share').hidden = false;
  $('share-copy').focus();
}

// ---- Events
function setTab(tab) {
  ui.tab = tab;
  pref('tab', tab);
  for (const t of ['us', 'world', 'words']) {
    $(`tab-${t}`).setAttribute('aria-selected', String(t === tab));
    $(`v-${t}`).hidden = t !== tab;
  }
  if (ui.open && ui.open.kind !== tab) closeCard();
  if (tab === 'words') words();
}

function wire() {
  for (const t of ['us', 'world', 'words']) $(`tab-${t}`).addEventListener('click', () => setTab(t));
  document.addEventListener('click', e => {
    const t = e.target.closest('button, input, [data-open]');
    if (!t) return;
    const d = t.dataset;
    if (d.open) { const [kind, code] = d.open.split(':'); if (kind !== ui.tab) setTab(kind); openCard(kind, code); return; }
    if (d.pick) {
      const [kind, code] = d.pick.split(':');
      if (ui.brush[kind] && ui.view === 'mine') { setMark(kind, code, ui.brush[kind]); flash(kind, code); }
      else { openCard(kind, code); if (kind === 'world') maps.world.focus(code, WORLD.places[code].tiny ? 8 : 2.5); }
      return;
    }
    if (d.set) { const [kind, code, s] = d.set.split(':'); setMark(kind, code, s); return; }
    if (d.close != null) { closeCard(); return; }
    if (d.tab) { setTab(d.tab); return; }
    if (d.done != null) { const kind = t.closest('#v-us') ? 'us' : 'world'; ui.brush[kind] = null; render(); return; }
    if (t.classList.contains('key') && t.closest('.legend')) {
      const kind = t.closest('#v-us') ? 'us' : 'world';
      const s = d.s;
      ui.brush[kind] = ui.brush[kind] === s ? null : s;
      if (ui.brush[kind]) closeCard();
      legend(kind); hint(kind);
      return;
    }
    if (d.more) { ui.salt[d.more]++; d.more === 'us' ? usBlocks() : worldBlocks(); return; }
    if (d.route) { const r = d.route.split(','); ui.route = ui.route && ui.route.join() === r.join() ? null : r; if (ui.route) maps.us.reset(); render(); if (ui.route) $('us-map').scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
    if (d.want) { for (const c of d.want.split(',')) if (!me.us[c]) me.us[c] = 'want'; save(); render(); return; }
    if (d.say) { const [id, k] = d.say.split(':'); me.answers[id] = k; save(); const li = t.closest('.word'); li?.classList.remove('asking'); words(); return; }
    if (d.nope) { t.closest('.word').classList.add('asking'); words(); return; }
    if (d.reask) { t.closest('.word').classList.add('asking'); delete me.answers[d.reask]; save(); words(); return; }
    if (d.wmap) {
      const li = t.closest('.word');
      const on = li.classList.toggle('show-map');
      t.setAttribute('aria-expanded', String(on));
      t.textContent = on ? 'Hide the map' : 'Where people say what';
      if (on) wordMap(d.wmap); else li.querySelector('.wmap').hidden = true;
      return;
    }
    if (d.grew) { me.grewUp = t.checked ? d.grew : null; save(); return; }
    if (d.view) { ui.view = d.view; ui.brush = { us: null, world: null }; render(); return; }
    if (d.adopt != null) {
      // Asks once, on the button itself, before replacing marks you already have.
      const has = Object.keys(me.us).length + Object.keys(me.world).length;
      if (has && !t.dataset.sure) { t.dataset.sure = '1'; t.textContent = 'Replace my map with this one?'; t.classList.add('warn'); return; }
      me.us = { ...ui.shared.us }; me.world = { ...ui.shared.world }; save();
      unshare();
      return;
    }
    if (d.unshare != null) { unshare(); return; }
  });
  $('grew-up').addEventListener('change', e => { me.grewUp = e.target.value || null; save(); words(); });
  $('find').addEventListener('input', find);
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if (!$('share').hidden) { $('share').hidden = true; return; }
    closeCard();
  });
  // Share
  $('share-open').addEventListener('click', openShare);
  $('share-close').addEventListener('click', () => { $('share').hidden = true; });
  $('share').addEventListener('click', e => { if (e.target === $('share')) $('share').hidden = true; });
  $('share-name').addEventListener('input', e => { me.name = e.target.value.trim(); save(); $('share-link').value = shareLink(); });
  $('share-copy').addEventListener('click', async () => {
    const link = $('share-link').value;
    try {
      if (navigator.share && matchMedia('(pointer: coarse)').matches && !framed) { await navigator.share({ title: 'Been There', url: link }); return; }
      await navigator.clipboard.writeText(link);
      $('share-note').textContent = 'Copied.';
    } catch (err) {
      if (err?.name === 'AbortError') return;
      $('share-link').select();
      $('share-note').textContent = 'Selected: copy it from the box.';
    }
  });
  $('share-pic').addEventListener('click', async () => {
    $('share-note').textContent = 'Drawing it…';
    try { await savePicture(ui.tab === 'world' ? 'world' : 'us', pictureData()); $('share-note').textContent = ''; }
    catch { $('share-note').textContent = 'Couldn’t make the picture here.'; }
  });
  addEventListener('hashchange', readShared);
}

function pictureData() {
  return {
    us: { geo: US, marks: me.us, boxes: BOXES, been: L.tally(me.us, STATE_CODES).been, pct: pct(US_CODES.filter(c => L.isBeen(me.us[c])).reduce((s, c) => s + US.states[c].km2, 0), US_KM2) },
    world: { geo: WORLD, marks: me.world, been: L.tally(me.world, COUNTRY_CODES).been, continents: new Set(WORLD_CODES.filter(c => L.isBeen(me.world[c])).map(continentOf).filter(Boolean)).size },
    name: me.name,
  };
}

function readShared() {
  const got = L.readHash(location.hash, new Set(US_CODES), new Set(WORLD_CODES));
  if (!got) return;
  ui.shared = got;
  const mine = Object.keys(me.us).length + Object.keys(me.world).length > 0;
  ui.view = mine ? 'compare' : 'theirs';
  ui.brush = { us: null, world: null };
  render();
}
function unshare() {
  ui.shared = null; ui.view = 'mine';
  history.replaceState(null, '', location.pathname + location.search);
  render();
}

makeMaps();
wire();
setTab(ui.tab);
readShared();
render();

// For tools/screenshots.mjs and the tests.
window.beenThere = { open: openCard, close: closeCard, setTab, ui, maps, render, get me() { return me; } };

try {
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) navigator.serviceWorker.register('sw.js').catch(() => {});
} catch { /* a sandboxed frame: no offline copy */ }
