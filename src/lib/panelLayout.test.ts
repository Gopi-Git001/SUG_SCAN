// Run with: npm run test:rules
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fitsTwoLines, type MeasuredRow, planCut } from './panelLayout.ts';

test('one or two lines broken between words fit', () => {
  assert.equal(fitsTwoLines('Lactose', ['Lactose']), true);
  assert.equal(fitsTwoLines('Apple Juice', ['Apple ', 'Juice']), true);
  assert.equal(fitsTwoLines('Apple Juice', ['Apple', ' Juice']), true);
  assert.equal(fitsTwoLines('Corn-Syrup', ['Corn-', 'Syrup']), true);
});

test('a break inside a word does not fit', () => {
  assert.equal(fitsTwoLines('Strawberries', ['Strawberr', 'ies']), false);
});

test('three lines do not fit', () => {
  assert.equal(fitsTwoLines('High Fructose Corn Syrup', ['High ', 'Fructose ', 'Corn Syrup']), false);
});

const rows = (...bottoms: [MeasuredRow['kind'], number, number][]) => bottoms.map(([kind, bottom, items]) => ({ kind, bottom, items }));

test('everything fits: no cut', () => {
  assert.deepEqual(planCut(rows(['verdict', 40, 0], ['title', 80, 0], ['items', 110, 1]), 200, 26, 6), { visible: 3, hidden: 0 });
});

test('cuts to the last full row that leaves room for "+N more"', () => {
  const r = rows(['verdict', 40, 0], ['title', 80, 0], ['items', 110, 2], ['items', 140, 2], ['items', 170, 1]);
  // 140 + 6 + 26 = 172 > 160, so the second items row goes too.
  assert.deepEqual(planCut(r, 160, 26, 6), { visible: 3, hidden: 3 });
});

test('never leaves a section title without items', () => {
  const r = rows(['verdict', 40, 0], ['title', 80, 0], ['items', 110, 1], ['title', 150, 0], ['items', 180, 1]);
  assert.deepEqual(planCut(r, 170, 10, 6), { visible: 3, hidden: 1 });
});

test('always keeps the verdict row', () => {
  assert.deepEqual(planCut(rows(['verdict', 40, 0], ['title', 80, 0], ['items', 110, 3]), 20, 26, 6), { visible: 1, hidden: 3 });
});
