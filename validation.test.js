'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { validDate } = require('../server');

test('accepts real calendar dates', () => {
  assert.equal(validDate('2026-11-15'), true);
  assert.equal(validDate('2024-02-29'), true);
});

test('rejects impossible and malformed dates', () => {
  assert.equal(validDate('2026-02-29'), false);
  assert.equal(validDate('2026-13-01'), false);
  assert.equal(validDate('2026-04-31'), false);
  assert.equal(validDate('15-11-2026'), false);
  assert.equal(validDate(''), false);
});
