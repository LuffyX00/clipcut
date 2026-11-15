import test from 'node:test';
import assert from 'node:assert/strict';
import { formatTime, parseTime, formatBytes } from '../src/utils/timeUtils.js';

test('formatTime formats HH:MM:SS.mmm', () => {
  assert.equal(formatTime(0), '00:00:00.000');
  assert.equal(formatTime(61.5), '00:01:01.500');
  assert.equal(formatTime(3725.042), '01:02:05.042');
  assert.equal(formatTime(-5), '00:00:00.000');
});

test('parseTime accepts several forms', () => {
  assert.equal(parseTime('00:01:01.500'), 61.5);
  assert.equal(parseTime('01:02:05.042'), 3725.042);
  assert.equal(parseTime('2:30'), 150);
  assert.equal(parseTime('45'), 45);
  assert.equal(parseTime('45.5'), 45.5);
  assert.equal(parseTime('00:00:01,5'), 1.5);
});

test('parseTime rejects invalid text', () => {
  for (const bad of ['', 'abc', '00:61:00', '01:02:75', '-1', '1:2:3:4', '00:00:00.1234']) {
    assert.equal(parseTime(bad), null, bad);
  }
});

test('format/parse round trip', () => {
  for (const t of [0, 0.001, 59.999, 3600, 21599.123]) {
    assert.ok(Math.abs(parseTime(formatTime(t)) - t) < 0.0006);
  }
});

test('formatBytes', () => {
  assert.equal(formatBytes(7.5e9), '7.50 GB');
});
