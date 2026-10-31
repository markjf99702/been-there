// The parts of Been There that are only arithmetic: counting, regions, milestones, the road trip and the word
// guesses. No DOM here, so test/unit.test.mjs can check it all in Node.

export const STATUSES = ['lived', 'visited', 'passed', 'want'];
export const LABEL = { lived: 'Lived', visited: 'Visited', passed: 'Passed through', want: 'Want to go' };
export const isBeen = s => s === 'lived' || s === 'visited' || s === 'passed';

// The 50 states, without DC: the count everyone means by "how many states have you been to".
export const isState = code => code !== 'DC';

export function tally(marks, codes) {
  const t = { lived: 0, visited: 0, passed: 0, want: 0, been: 0 };
  for (const c of codes) {
    const s = marks[c];
    if (!s) continue;
    t[s]++;
    if (isBeen(s)) t.been++;
  }
  return t;
}

// Regions sized like the compartments of a drawer: every state in exactly one.
export const REGIONS = [
  ['New England', 'CT ME MA NH RI VT'],
  ['Mid-Atlantic', 'NY NJ PA DE MD DC'],
  ['Southeast', 'VA WV NC SC GA FL'],
  ['Deep South', 'KY TN AL MS LA AR'],
  ['Great Lakes', 'OH IN IL MI WI MN'],
  ['Great Plains', 'IA MO ND SD NE KS OK'],
  ['Southwest', 'TX NM AZ NV'],
  ['Mountain West', 'MT WY CO ID UT'],
  ['Pacific', 'WA OR CA AK HI'],
].map(([name, list]) => ({ name, codes: list.split(' ') }));

// Milestones, stamped like a passport once every state in them has been been to.
export const MILESTONES = [
  { name: 'Coast to coast', line: 'An Atlantic state and a Pacific one.', test: b => ['ME', 'NH', 'MA', 'RI', 'CT', 'NY', 'NJ', 'DE', 'MD', 'VA', 'NC', 'SC', 'GA', 'FL'].some(c => b.has(c)) && ['WA', 'OR', 'CA', 'AK', 'HI'].some(c => b.has(c)) },
  { name: 'Four Corners', codes: 'AZ CO NM UT', line: 'The only place four states meet.' },
  { name: 'Route 66', codes: 'IL MO KS OK TX NM AZ CA', line: 'Chicago to Santa Monica, all eight states.' },
  { name: 'All of New England', codes: 'CT ME MA NH RI VT' },
  { name: 'The original thirteen', codes: 'DE PA NJ GA CT MA MD SC NH VA NY NC RI' },
  { name: 'Down the Mississippi', codes: 'MN WI IA IL MO KY TN AR MS LA', line: 'Every state the river touches.' },
  { name: 'The Great Lakes', codes: 'MN WI IL IN MI OH PA NY', line: 'Every state with a Great Lakes shore.' },
  { name: 'The Gulf Coast', codes: 'TX LA MS AL FL' },
  { name: 'Off the mainland', codes: 'AK HI' },
  { name: 'Half the states', count: 25 },
  { name: 'The lower 48', count: 48, lower48: true },
  { name: 'All fifty', count: 50 },
].map(m => ({ ...m, codes: m.codes ? m.codes.split(' ') : null }));

export function milestone(m, been) {
  if (m.test) return { done: m.test(been), have: null, need: [] };
  if (m.count) {
    const pool = [...been].filter(c => isState(c) && (!m.lower48 || (c !== 'AK' && c !== 'HI')));
    return { done: pool.length >= m.count, have: pool.length, of: m.count, need: [] };
  }
  const need = m.codes.filter(c => !been.has(c));
  return { done: need.length === 0, have: m.codes.length - need.length, of: m.codes.length, need };
}

// Miles between two points on the globe.
export function miles(a, b) {
  const r = Math.PI / 180;
  const dLat = (b.lat - a.lat) * r, dLon = (b.lon - a.lon) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLon / 2) ** 2;
  return 3958.8 * 2 * Math.asin(Math.sqrt(h));
}

// The road trip that adds the most new states: a drive from somewhere you've been, through states that touch, none
// of them visited yet. Ties go to the shorter drive, and to starting from home (a state you've lived in).
// Returns up to `count` trips that don't share a state, best first: { from, path: [codes], miles }.
export function roadTrips(marks, geo, { max = 6, count = 2 } = {}) {
  const drivable = c => c !== 'AK' && c !== 'HI';
  const codes = Object.keys(geo.neighbors).filter(drivable);
  const been = new Set(codes.filter(c => isBeen(marks[c])));
  const fresh = c => !been.has(c);
  const at = c => geo.states[c];
  const home = new Set(codes.filter(c => marks[c] === 'lived'));
  // Where a trip can start: next to a state you've been to (from there), or anywhere when you've been to none.
  const starts = been.size
    ? [...been].flatMap(b => geo.neighbors[b].filter(n => drivable(n) && fresh(n)).map(n => ({ from: b, first: n })))
    : codes.map(c => ({ from: null, first: c }));

  const trips = [];
  const taken = new Set();
  for (let round = 0; round < count; round++) {
    let best = null;
    const better = t => !best || t.path.length > best.path.length
      || (t.path.length === best.path.length && t.score < best.score);
    for (const { from, first } of starts) {
      if (taken.has(first)) continue;
      const path = [first];
      const seen = new Set(path);
      const walk = (miles0) => {
        const last = path[path.length - 1];
        const score = miles0 + (from && home.size && !home.has(from) ? 800 : 0);
        const t = { from, path: [...path], miles: Math.round(miles0), score };
        if (better(t)) best = t;
        if (path.length >= max) return;
        for (const n of geo.neighbors[last]) {
          if (!drivable(n) || !fresh(n) || seen.has(n) || taken.has(n)) continue;
          path.push(n); seen.add(n);
          walk(miles0 + miles(at(last), at(n)));
          path.pop(); seen.delete(n);
        }
      };
      walk(from ? miles(at(from), at(first)) : 0);
    }
    if (!best) break;
    trips.push(best);
    best.path.forEach(c => taken.add(c));
  }
  return trips.map(({ score, ...t }) => t);
}

// ---- Words

// A guess at how someone says a word, from where they grew up (counted three times) and everywhere else they've
// lived. Returns { key, hint, also }: the answer, any split inside the state they grew up in, and other answers
// they may have picked up, with where from.
export function guessWord(word, grewUp, lived, answerIn) {
  const weights = new Map();
  const from = new Map();
  const add = (state, w) => {
    const k = answerIn(word, state);
    weights.set(k, (weights.get(k) || 0) + w);
    if (!from.has(k)) from.set(k, []);
    from.get(k).push(state);
  };
  if (grewUp) add(grewUp, 3);
  for (const s of lived) if (s !== grewUp) add(s, 1);
  if (!weights.size) return null;
  const order = [...weights.entries()].sort((a, b) => b[1] - a[1] || (grewUp && a[0] === answerIn(word, grewUp) ? -1 : 1));
  const key = order[0][0];
  const hint = grewUp ? word.hints[grewUp] || null : null;
  const also = order.slice(1).map(([k]) => ({ key: k, from: from.get(k) }));
  return { key, hint, also };
}

// How well each state's way of talking matches someone's answers: the share of answered words where the state's
// usual answer is theirs. Returns [[state, share]], best first.
export function soundsLike(answers, words, states, answerIn) {
  const done = words.filter(w => answers[w.id]);
  if (!done.length) return [];
  return states.map(s => {
    const hits = done.filter(w => answerIn(w, s) === answers[w.id]).length;
    return [s, hits / done.length];
  }).sort((a, b) => b[1] - a[1]);
}

// ---- Share links: #s=WIlILvCAw&c=FRvJPw&n=Name  (l lived, v visited, p passed through, w want to go)
const LETTER = { lived: 'l', visited: 'v', passed: 'p', want: 'w' };
const FROM_LETTER = { l: 'lived', v: 'visited', p: 'passed', w: 'want' };

export function encodeMarks(marks) {
  return Object.entries(marks).filter(([, s]) => LETTER[s]).sort().map(([c, s]) => c + LETTER[s]).join('');
}
export function decodeMarks(text, valid) {
  const marks = {};
  for (const [, c, l] of String(text || '').matchAll(/([A-Z]{2})([lvpw])/g)) if (!valid || valid.has(c)) marks[c] = FROM_LETTER[l];
  return marks;
}
export function shareHash({ us, world, name }) {
  const parts = [];
  const s = encodeMarks(us), c = encodeMarks(world);
  if (s) parts.push('s=' + s);
  if (c) parts.push('c=' + c);
  if (name) parts.push('n=' + encodeURIComponent(name.slice(0, 40)));
  return '#' + parts.join('&');
}
export function readHash(hash, validUS, validWorld) {
  const p = new URLSearchParams(String(hash || '').replace(/^#/, ''));
  if (!p.has('s') && !p.has('c')) return null;
  return { us: decodeMarks(p.get('s'), validUS), world: decodeMarks(p.get('c'), validWorld), name: (p.get('n') || '').slice(0, 40) };
}

// Two maps side by side: who's been where.
export function compare(mine, theirs, codes) {
  const out = {};
  for (const c of codes) {
    const a = isBeen(mine[c]), b = isBeen(theirs[c]);
    out[c] = a && b ? 'both' : a ? 'mine' : b ? 'theirs' : null;
  }
  return out;
}

// A stable pick of n items for the day, so a list doesn't reshuffle on every visit but changes from day to day.
export function dailyPick(items, n, salt = 0, day = Math.floor(Date.now() / 864e5)) {
  let a = (day * 2654435761 + salt * 40503) >>> 0;
  const rand = () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [copy[i], copy[j]] = [copy[j], copy[i]]; }
  return copy.slice(0, n);
}
