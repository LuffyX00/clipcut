'use strict';
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const fileService = require('./fileService');

const CONCURRENCY = 3;
const TIMEOUT_MS = 45000;

/** Adaptive sampling: one thumbnail per ~45 s, but never fewer than 12 or more than 64. */
function thumbnailCount(duration) {
  return Math.max(12, Math.min(64, Math.round(duration / 45)));
}

function extractOne(job, videoPath, time, outFile) {
  return new Promise((resolve) => {
    if (job.cancelled) return resolve(false);
    // -ss before -i = fast keyframe seek; reads only a tiny part of the file.
    const args = [
      '-hide_banner', '-loglevel', 'error', '-nostdin',
      '-ss', time.toFixed(3), '-i', videoPath,
      '-map', '0:v:0', '-frames:v', '1', '-an', '-sn', '-dn',
      '-vf', 'scale=240:-2', '-q:v', '6', '-y', outFile
    ];
    let child;
    try {
      child = spawn('ffmpeg', args, { stdio: ['ignore', 'ignore', 'pipe'] });
    } catch { return resolve(false); }
    job.children.add(child);
    let stderr = '';
    const timer = setTimeout(() => child.kill('SIGKILL'), TIMEOUT_MS);
    child.stderr.on('data', (d) => { if (stderr.length < 2000) stderr += d; });
    child.on('error', () => { clearTimeout(timer); job.children.delete(child); resolve(false); });
    child.on('close', (code) => {
      clearTimeout(timer);
      job.children.delete(child);
      if (code !== 0 && !job.cancelled) fileService.log('warn', `thumbnail at ${time.toFixed(1)}s failed: ${stderr.trim()}`);
      resolve(code === 0);
    });
  });
}

async function start({ videoPath, duration, count, onItem }) {
  const dir = await fileService.makeJobDir('thumbs');
  const job = { cancelled: false, children: new Set(), dir, done: null, cancel: null };
  const times = Array.from({ length: count }, (_, i) => ((i + 0.5) * duration) / count);
  let next = 0;

  async function worker() {
    while (!job.cancelled) {
      const i = next++;
      if (i >= count) return;
      const out = path.join(dir, `t${i}.jpg`);
      const ok = await extractOne(job, videoPath, times[i], out);
      if (ok && !job.cancelled) {
        try {
          const buf = await fs.promises.readFile(out);
          await fs.promises.unlink(out).catch(() => {});
          onItem({ index: i, time: times[i], dataUrl: 'data:image/jpeg;base64,' + buf.toString('base64') });
        } catch { /* skip */ }
      }
    }
  }

  job.done = Promise.all(Array.from({ length: CONCURRENCY }, worker))
    .finally(() => fileService.removeQuiet(dir));
  job.cancel = () => {
    job.cancelled = true;
    for (const c of job.children) c.kill('SIGKILL');
  };
  return { job, times };
}

module.exports = { start, thumbnailCount };
