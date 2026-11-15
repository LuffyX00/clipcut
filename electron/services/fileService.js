'use strict';
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { ClipCutError } = require('./errors');

let tempRoot = path.join(os.tmpdir(), 'clipcut');
let logFile = null;

function init() {
  const { app } = require('electron'); // lazy so this module can be unit-tested in plain Node
  tempRoot = path.join(app.getPath('temp'), 'clipcut');
  fs.mkdirSync(tempRoot, { recursive: true });
  cleanupTempSync();
  const logDir = path.join(app.getPath('userData'), 'logs');
  fs.mkdirSync(logDir, { recursive: true });
  logFile = path.join(logDir, 'clipcut.log');
  try {
    if (fs.statSync(logFile).size > 2 * 1024 * 1024) fs.renameSync(logFile, logFile + '.old');
  } catch { /* no log yet */ }
  log('info', `ClipCut started (pid ${process.pid})`);
}

function getLogPath() { return logFile; }

function log(level, message) {
  const line = `${new Date().toISOString()} [${level}] ${message}\n`;
  if (!logFile) { if (level !== 'debug') console.log(line.trim()); return; }
  fs.appendFile(logFile, line, () => {});
}

function cleanupTempSync() {
  try {
    for (const entry of fs.readdirSync(tempRoot)) {
      fs.rmSync(path.join(tempRoot, entry), { recursive: true, force: true });
    }
  } catch { /* ignore */ }
}

async function makeJobDir(prefix) {
  await fsp.mkdir(tempRoot, { recursive: true });
  return fsp.mkdtemp(path.join(tempRoot, `${prefix}-`));
}

async function removeQuiet(p) {
  try { await fsp.rm(p, { recursive: true, force: true }); } catch { /* ignore */ }
}

function removeQuietSync(p) {
  try { fs.rmSync(p, { recursive: true, force: true }); } catch { /* ignore */ }
}

/** Remove a file only if it exists and is empty (used for our reserved placeholder). */
async function removeIfEmptyFile(p) {
  try {
    const st = await fsp.stat(p);
    if (st.isFile() && st.size === 0) await fsp.unlink(p);
  } catch { /* ignore */ }
}

function removeIfEmptyFileSync(p) {
  try {
    const st = fs.statSync(p);
    if (st.isFile() && st.size === 0) fs.unlinkSync(p);
  } catch { /* ignore */ }
}

async function validateVideoPath(p) {
  if (typeof p !== 'string' || !p || p.includes('\0')) {
    throw new ClipCutError('INVALID_PATH', 'That file path is not valid.');
  }
  const abs = path.resolve(p);
  let st;
  try {
    st = await fsp.stat(abs);
  } catch (e) {
    if (e.code === 'ENOENT') throw new ClipCutError('MISSING_INPUT', 'The original video could not be found. It may have been moved, renamed or deleted.');
    if (e.code === 'EACCES') throw new ClipCutError('PERMISSION', 'ClipCut does not have permission to read this file.');
    throw e;
  }
  if (!st.isFile()) throw new ClipCutError('INVALID_PATH', 'The selected item is not a file.');
  try {
    await fsp.access(abs, fs.constants.R_OK);
  } catch {
    throw new ClipCutError('PERMISSION', 'ClipCut does not have permission to read this file.');
  }
  return { path: abs, size: st.size };
}

async function freeSpace(dir) {
  try {
    const s = await fsp.statfs(dir);
    return Number(s.bavail) * Number(s.bsize);
  } catch {
    return null; // unknown: do not block the operation
  }
}

/**
 * Atomically reserve a unique output name next to the original:
 *   name_trimmed.ext, name_trimmed_2.ext, name_trimmed_3.ext ...
 * The file is created with the exclusive flag 'wx', so an existing file can never be reused.
 */
async function reserveOutputPath(inputPath) {
  const dir = path.dirname(inputPath);
  const ext = path.extname(inputPath);
  const base = path.basename(inputPath, ext);
  try {
    await fsp.access(dir, fs.constants.W_OK);
  } catch {
    throw new ClipCutError('PERMISSION', 'ClipCut cannot write to the folder that contains the original video. Check the folder permissions.');
  }
  for (let n = 1; n <= 99999; n++) {
    const name = n === 1 ? `${base}_trimmed${ext}` : `${base}_trimmed_${n}${ext}`;
    const candidate = path.join(dir, name);
    try {
      const fh = await fsp.open(candidate, 'wx');
      await fh.close();
      return candidate;
    } catch (e) {
      if (e.code === 'EEXIST') continue;
      if (e.code === 'EACCES' || e.code === 'EPERM' || e.code === 'EROFS') {
        throw new ClipCutError('PERMISSION', 'ClipCut cannot write to the folder that contains the original video.');
      }
      if (e.code === 'ENOSPC') throw new ClipCutError('DISK_SPACE', 'There is no free space left on the disk that holds the original video.');
      if (e.code === 'ENAMETOOLONG') throw new ClipCutError('FILENAME_TOO_LONG', 'The original filename is too long to add "_trimmed" to it.');
      throw e;
    }
  }
  throw new ClipCutError('OUTPUT_NAME', 'Could not find a free output filename.');
}

/** Hidden temp file in the same folder (same filesystem, so the final rename is instant). */
function tempSiblingPath(inputPath) {
  const dir = path.dirname(inputPath);
  const ext = path.extname(inputPath);
  return path.join(dir, `.clipcut-${crypto.randomBytes(6).toString('hex')}${ext}`);
}

module.exports = {
  init, getLogPath, log, cleanupTempSync, makeJobDir, removeQuiet, removeQuietSync,
  removeIfEmptyFile, removeIfEmptyFileSync, validateVideoPath, freeSpace,
  reserveOutputPath, tempSiblingPath
};
