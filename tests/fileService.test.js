import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const fileService = require('../electron/services/fileService.js');

test('output names never overwrite and stay beside the original', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'clipcut-test-'));
  const input = path.join(dir, 'stream.mp4');
  fs.writeFileSync(input, 'original');
  const names = [];
  for (let i = 0; i < 4; i++) {
    const out = await fileService.reserveOutputPath(input);
    assert.equal(path.dirname(out), dir);
    names.push(path.basename(out));
  }
  assert.deepEqual(names, ['stream_trimmed.mp4', 'stream_trimmed_2.mp4', 'stream_trimmed_3.mp4', 'stream_trimmed_4.mp4']);
  assert.equal(fs.readFileSync(input, 'utf8'), 'original');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('existing trimmed file is skipped, not overwritten', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'clipcut-test-'));
  const input = path.join(dir, 'a.mkv');
  fs.writeFileSync(input, 'x');
  fs.writeFileSync(path.join(dir, 'a_trimmed.mkv'), 'keep me');
  const out = await fileService.reserveOutputPath(input);
  assert.equal(path.basename(out), 'a_trimmed_2.mkv');
  assert.equal(fs.readFileSync(path.join(dir, 'a_trimmed.mkv'), 'utf8'), 'keep me');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('concurrent reservations get different names', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'clipcut-test-'));
  const input = path.join(dir, 'v.webm');
  fs.writeFileSync(input, 'x');
  const outs = await Promise.all([1, 2, 3, 4, 5].map(() => fileService.reserveOutputPath(input)));
  assert.equal(new Set(outs).size, 5);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('validateVideoPath rejects missing files and bad input', async () => {
  await assert.rejects(() => fileService.validateVideoPath('/nonexistent/file.mp4'), { code: 'MISSING_INPUT' });
  await assert.rejects(() => fileService.validateVideoPath(''), { code: 'INVALID_PATH' });
  await assert.rejects(() => fileService.validateVideoPath('a\0b'), { code: 'INVALID_PATH' });
});
