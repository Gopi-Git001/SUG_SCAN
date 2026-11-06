// Run with: npm run test:rules
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ingredientNames, titleCase } from './ingredients.ts';

test('drops amounts, units, serving lines and long text', () => {
  assert.deepEqual(
    ingredientNames([
      'Corn Syrup',
      '17 g added per serving',
      'g added per serving',
      'Includes added sugar per serving',
      'Red 40',
      'A very long sentence that is clearly not an ingredient name',
    ]),
    ['Corn Syrup'],
  );
});

test('keeps names that only look like they contain "g "', () => {
  assert.deepEqual(ingredientNames(['Icing Sugar', 'Brewing Sugar']), ['Icing Sugar', 'Brewing Sugar']);
});

test('removes duplicates case-insensitively, keeping the first spelling', () => {
  assert.deepEqual(ingredientNames(['Corn Syrup', 'corn syrup', ' CORN SYRUP ']), ['Corn Syrup']);
});

test('title-cases names', () => {
  assert.equal(titleCase('high fructose corn syrup'), 'High Fructose Corn Syrup');
  assert.equal(titleCase('HIGH FRUCTOSE CORN SYRUP'), 'High Fructose Corn Syrup');
  assert.equal(titleCase('acesulfame K'), 'Acesulfame K');
  assert.equal(titleCase('HFCS'), 'HFCS');
  assert.equal(titleCase('fructose (from fruit)'), 'Fructose (From Fruit)');
  assert.equal(titleCase('erythritol (sugar alcohol)'), 'Erythritol (Sugar Alcohol)');
});

test('empty and blank lists give no names', () => {
  assert.deepEqual(ingredientNames([]), []);
  assert.deepEqual(ingredientNames(['', '  ']), []);
});
