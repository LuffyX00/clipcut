import test from 'node:test';
import assert from 'node:assert/strict';
import { validateRange, clamp } from '../src/utils/validation.js';

test('valid range', () => assert.equal(validateRange(1, 5, 10).valid, true));
test('negative start', () => assert.equal(validateRange(-1, 5, 10).valid, false));
test('start >= end', () => {
  assert.equal(validateRange(5, 5, 10).valid, false);
  assert.equal(validateRange(6, 5, 10).valid, false);
});
test('end after duration', () => assert.equal(validateRange(1, 11, 10).valid, false));
test('NaN', () => assert.equal(validateRange(NaN, 5, 10).valid, false));
test('clamp', () => assert.equal(clamp(15, 0, 10), 10));
