// The arithmetic: node --test test/unit.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import * as L from '../js/logic.js';
import US from '../js/data/us-geo.js';
import STATES from '../js/data/states.js';
import COUNTRIES from '../js/data/countries.js';
import WORLD from '../js/data/world-geo.js';
import { WORDS, answerIn } from '../js/data/words.js';

const CODES = Object.keys(US.states);

test('the map has the 50 states and DC, and every one has a card', () => {
  assert.equal(CODES.length, 51);
  for (const c of CODES) {
    const s = STATES[c];
    assert.ok(s, `no card for ${c}`);
    assert.equal(s.dontMiss.length, 3, c);
    assert.equal(s.trip.days.length, 3, c);
    for (const k of ['name', 'nickname', 'missing', 'fact', 'season']) assert.ok(s[k], `${c} has no ${k}`);
    assert.ok(s.lookFor.what && s.lookFor.line && s.eat.what && s.eat.line, c);
  }
});

test('every country card fits the map and the card layout', () => {
  const continents = new Set(['Africa', 'Asia', 'Europe', 'North America', 'South America', 'Oceania', 'Antarctica']);
  for (const [c, co] of Object.entries(COUNTRIES)) {
    assert.ok(WORLD.places[c], `${c} has a card but no shape on the map`);
    assert.ok(continents.has(co.continent), `${c}: ${co.continent}`);
    assert.equal(co.dontMiss.length, 3, c);
    assert.ok(co.missing && co.lookFor && co.eat && co.fact, c);
  }
  assert.ok(Object.keys(COUNTRIES).length >= 211);
});

test('neighbours go both ways, and Alaska and Hawaii have none', () => {
  for (const [c, ns] of Object.entries(US.neighbors)) for (const n of ns) assert.ok(US.neighbors[n].includes(c), `${c}–${n}`);
  assert.deepEqual(US.neighbors.AK, []);
  assert.deepEqual(US.neighbors.HI, []);
  assert.deepEqual(US.neighbors.DC, ['MD', 'VA']);
});

test('tally counts been as lived, visited and passed through, but not want to go', () => {
  const t = L.tally({ WI: 'lived', IL: 'visited', IN: 'passed', CO: 'want' }, CODES);
  assert.deepEqual(t, { lived: 1, visited: 1, passed: 1, want: 1, been: 3 });
});

test('regions cover every state exactly once', () => {
  const all = L.REGIONS.flatMap(r => r.codes).sort();
  assert.deepEqual(all, [...CODES].sort());
});

test('milestones', () => {
  const four = L.MILESTONES.find(m => m.name === 'Four Corners');
  assert.deepEqual(L.milestone(four, new Set(['AZ', 'UT'])).need, ['CO', 'NM']);
  assert.equal(L.milestone(four, new Set(['AZ', 'UT', 'CO', 'NM'])).done, true);
  const coast = L.MILESTONES.find(m => m.name === 'Coast to coast');
  assert.equal(L.milestone(coast, new Set(['NY'])).done, false);
  assert.equal(L.milestone(coast, new Set(['NY', 'CA'])).done, true);
  const lower = L.MILESTONES.find(m => m.name === 'The lower 48');
  const all48 = new Set(CODES.filter(c => !['AK', 'HI', 'DC'].includes(c)));
  assert.equal(L.milestone(lower, all48).done, true);
  assert.equal(L.milestone(L.MILESTONES.find(m => m.name === 'All fifty'), all48).done, false);
});

test('a road trip goes through touching states you haven’t been to, from one you have', () => {
  const marks = { WI: 'lived' };
  const [trip, alt] = L.roadTrips(marks, US);
  assert.equal(trip.from === null, false);
  assert.equal(trip.path.length, 6);
  assert.ok(US.neighbors[trip.from].includes(trip.path[0]));
  for (let i = 1; i < trip.path.length; i++) assert.ok(US.neighbors[trip.path[i - 1]].includes(trip.path[i]), trip.path.join());
  assert.ok(trip.path.every(c => !marks[c] && c !== 'AK' && c !== 'HI'));
  assert.ok(alt.path.every(c => !trip.path.includes(c)), 'the second trip shares a state');
});

test('road trips: none left to drive, and a start from nowhere', () => {
  const marks = Object.fromEntries(CODES.filter(c => c !== 'AK' && c !== 'HI').map(c => [c, 'visited']));
  assert.deepEqual(L.roadTrips(marks, US), []);
  const [t] = L.roadTrips({}, US);
  assert.equal(t.from, null);
  assert.equal(t.path.length, 6);
  // Want-to-go states still count as new.
  assert.ok(L.roadTrips({ WI: 'lived', MN: 'want' }, US)[0]);
});

test('word guesses: where you grew up wins, and other places show up as “also”', () => {
  const soda = WORDS.find(w => w.id === 'soda');
  const g = L.guessWord(soda, 'WI', ['IL', 'TX'], answerIn);
  assert.equal(g.key, 'soda');
  assert.match(g.hint, /pop/);
  assert.deepEqual(g.also.map(a => a.key).sort(), ['coke', 'pop']);
  assert.equal(L.guessWord(soda, null, ['TX', 'GA', 'MN'], answerIn).key, 'coke');
  assert.equal(L.guessWord(soda, null, [], answerIn), null);
  assert.equal(answerIn(WORDS.find(w => w.id === 'fountain'), 'WI'), 'bubbler');
});

test('every word lists only real states and real answers', () => {
  for (const w of WORDS) {
    assert.ok(w.says[w.base], w.id);
    const seen = new Set();
    for (const [k, list] of Object.entries(w.map)) {
      assert.ok(w.says[k], `${w.id}: ${k}`);
      for (const s of list.split(' ')) {
        assert.ok(CODES.includes(s), `${w.id}: ${s}`);
        assert.ok(!seen.has(s), `${w.id}: ${s} listed twice`);
        seen.add(s);
      }
    }
    for (const s of Object.keys(w.hints)) assert.ok(CODES.includes(s), `${w.id} hint ${s}`);
  }
});

test('sounds like: a Wisconsin set of answers matches Wisconsin best', () => {
  const answers = Object.fromEntries(WORDS.map(w => [w.id, answerIn(w, 'WI')]));
  const ranked = L.soundsLike(answers, WORDS, CODES, answerIn);
  assert.equal(ranked[0][0], 'WI');
  assert.equal(ranked[0][1], 1);
});

test('share links round-trip, and ignore junk', () => {
  const me = { us: { WI: 'lived', CA: 'want', DC: 'passed' }, world: { FR: 'visited' }, name: 'Mark & Co' };
  const hash = L.shareHash(me);
  assert.equal(hash, '#s=CAwDCpWIl&c=FRv&n=Mark%20%26%20Co');
  const back = L.readHash(hash, new Set(CODES), new Set(['FR']));
  assert.deepEqual(back, me);
  assert.equal(L.readHash('#nothing', null, null), null);
  assert.deepEqual(L.readHash('#s=ZZlWIx<script>CAv', new Set(CODES)).us, { CA: 'visited' });
});

test('compare', () => {
  assert.deepEqual(L.compare({ WI: 'lived', IL: 'want' }, { WI: 'visited', CA: 'passed' }, ['WI', 'IL', 'CA']), { WI: 'both', IL: null, CA: 'theirs' });
});

test('daily pick is stable within a day and changes with the salt', () => {
  const items = [...'abcdefghijklmnop'];
  assert.deepEqual(L.dailyPick(items, 5, 0, 100), L.dailyPick(items, 5, 0, 100));
  assert.notDeepEqual(L.dailyPick(items, 5, 0, 100), L.dailyPick(items, 5, 1, 100));
  assert.equal(new Set(L.dailyPick(items, 5, 0, 100)).size, 5);
});
