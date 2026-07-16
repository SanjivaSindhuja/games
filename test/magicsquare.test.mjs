// Unit tests for the pure game logic in magicsquare.html.
// Run: node test/magicsquare.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const html = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'magicsquare.html'), 'utf8');
const js = html.slice(html.indexOf('<script>') + 8, html.indexOf('</script>'));

// Extract the pure functions from the page's IIFE by name.
function extract(name) {
  const start = js.indexOf(`function ${name}(`);
  assert.ok(start !== -1, `function ${name} found in source`);
  let depth = 0, i = js.indexOf('{', start);
  for (; i < js.length; i++) {
    if (js[i] === '{') depth++;
    else if (js[i] === '}' && --depth === 0) break;
  }
  return js.slice(start, i + 1);
}
const MC = n => n * (n * n + 1) / 2;
const rng = eval('(' + extract('rng') + ')');
const magic = eval('(' + extract('magic') + ')');
const fmt = eval('(' + extract('fmt') + ')');

// Mirrors the page's sums/isWon logic over a plain cells array.
function sums(cells, N) {
  const r = [], c = [];
  for (let i = 0; i < N; i++) {
    r.push(cells.slice(i * N, i * N + N).reduce((a, b) => a + b, 0));
    c.push(cells.filter((_, k) => k % N === i).reduce((a, b) => a + b, 0));
  }
  let d1 = 0, d2 = 0;
  for (let i = 0; i < N; i++) { d1 += cells[i * N + i]; d2 += cells[i * N + (N - 1 - i)]; }
  return { r, c, d1, d2 };
}
function isWon(cells, N) {
  if (!cells.every(v => v)) return false;
  const s = sums(cells, N), t = MC(N);
  return s.r.every(v => v === t) && s.c.every(v => v === t) && s.d1 === t && s.d2 === t;
}

let ran = 0;
function test(name, fn) { fn(); ran++; console.log('ok -', name); }

test('magic constants for each size', () => {
  assert.equal(MC(3), 15); assert.equal(MC(4), 34); assert.equal(MC(5), 65);
});

test('rng is deterministic per seed (daily puzzle identical for everyone)', () => {
  const a = rng(42), b = rng(42), c = rng(43);
  const seqA = [a(), a(), a()], seqB = [b(), b(), b()];
  assert.deepEqual(seqA, seqB);
  assert.notDeepEqual(seqA, [c(), c(), c()]);
  seqA.forEach(v => assert.ok(v >= 0 && v < 1, 'rng in [0,1)'));
});

test('magic() produces valid magic squares for 3/4/5 across 100 seeds each', () => {
  for (const n of [3, 4, 5]) {
    for (let seed = 0; seed < 100; seed++) {
      const f = magic(n, rng(seed));
      const t = MC(n), s = sums(f, n);
      s.r.forEach(v => assert.equal(v, t, `${n}x${n} seed ${seed} row`));
      s.c.forEach(v => assert.equal(v, t, `${n}x${n} seed ${seed} col`));
      assert.equal(s.d1, t, `${n}x${n} seed ${seed} diag ↘`);
      assert.equal(s.d2, t, `${n}x${n} seed ${seed} diag ↙`);
      assert.deepEqual([...f].sort((x, y) => x - y), Array.from({ length: n * n }, (_, i) => i + 1),
        `${n}x${n} seed ${seed} uses each of 1..n² exactly once`);
    }
  }
});

test('magic() varies across seeds (random transforms give board variety)', () => {
  const boards = new Set();
  for (let seed = 0; seed < 20; seed++) boards.add(magic(4, rng(seed)).join(','));
  assert.ok(boards.size > 1, 'different seeds give different boards');
});

test('isWon accepts solved boards', () => {
  assert.equal(isWon([2, 7, 6, 9, 5, 1, 4, 3, 8], 3), true);
  assert.equal(isWon(magic(5, rng(7)), 5), true);
});

test('isWon rejects incomplete and broken boards', () => {
  assert.equal(isWon([2, 7, 6, 9, 5, 1, 4, 3, 0], 3), false, 'incomplete board');
  assert.equal(isWon([7, 2, 6, 9, 5, 1, 4, 3, 8], 3), false, 'one swap breaks it');
});

test('broken-mode board: pair swap breaks the win, swapping back repairs it', () => {
  const cells = magic(4, rng(3));
  [cells[0], cells[5]] = [cells[5], cells[0]];
  assert.equal(isWon(cells, 4), false);
  [cells[0], cells[5]] = [cells[5], cells[0]];
  assert.equal(isWon(cells, 4), true);
});

test('fmt formats seconds as m:ss', () => {
  assert.equal(fmt(0), '0:00');
  assert.equal(fmt(61.4), '1:01');
  assert.equal(fmt(600), '10:00');
});

test('daily size cycle covers all three sizes', () => {
  assert.deepEqual([0, 1, 2].map(d => 3 + (d % 3)).sort(), [3, 4, 5]);
});

console.log(`\n${ran} tests passed`);
