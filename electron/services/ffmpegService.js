'use strict';
const { spawn } = require('child_process');
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const { ClipCutError } = require('./errors');
const fileService = require('./fileService');
const { probeFile } = require('./ffprobeService');

// Output container = original container (same extension), written with the matching FFmpeg muxer.
const MUXERS = {
  '.mp4': 'mp4', '.m4v': 'mp4', '.mov': 'mov', '.mkv': 'matroska', '.webm': 'webm',
  '.avi': 'avi', '.flv': 'flv', '.mpg': 'mpeg', '.mpeg': 'mpeg',
  '.ts': 'mpegts', '.mts': 'mpegts', '.m2ts': 'mpegts', '.wmv': 'asf', '.asf': 'asf'
};

// Every attempt is still pure stream copy (-c copy). Later attempts only leave out stream
// types the container cannot hold, and the user is told about it. Nothing is re-encoded.
const MAP_ATTEMPTS = [
  { map: ['-map', '0'], note: null },
  {
    map: ['-map', '0:v?', '-map', '0:a?', '-map', '0:s?'],
    note: 'Some extra streams (data tracks or attachments) cannot be stored in this container and were left out. Video, audio and subtitles were copied unchanged.'
  },
  {
    map: ['-map', '0:v?', '-map', '0:a?'],
    note: 'The subtitle tracks of the original are not compatible with this container and were left out. Video and audio were copied unchanged.'
  }
];

function buildArgs({ inputPath, tempPath, start, clip, map, muxer }) {
  const a = [
    '-hide_banner', '-nostdin', '-loglevel', 'error',
    '-progress', 'pipe:1', '-nostats',
    '-ss', start.toFixed(3),          // input seeking (fast, jumps by keyframe)
    '-i', inputPath,
    '-t', clip.toFixed(3),            // output duration
    ...map,
    '-ignore_unknown',
    '-c', 'copy',                     // NO re-encoding
    '-map_metadata', '0',
    '-avoid_negative_ts', 'make_zero'
  ];
  if (muxer === 'mp4' || muxer === 'mov') a.push('-movflags', '+faststart');
  if (muxer) a.push('-f', muxer);
  a.push('-y', tempPath); // tempPath is a brand-new unique hidden file created by ClipCut
  return a;
}

function classify(stderr) {
  if (/No space left on device/i.test(stderr)) return 'DISK_SPACE';
  if (/Permission denied/i.test(stderr)) return 'PERMISSION';
  if (/moov atom not found|Invalid data found when processing input|corrupt/i.test(stderr)) return 'CORRUPT_INPUT';
  if (/Could not find tag for codec|not currently supported in container|Unsupported codec|codec not supported|Invalid argument/i.test(stderr)) return 'INCOMPATIBLE_CONTAINER';
  return 'FFMPEG_FAILED';
}

function runFfmpeg(job, args, clip, onProgress) {
  return new Promise((resolve, reject) => {
    let child;
    try {
      child = spawn('ffmpeg', args, { stdio: ['ignore', 'pipe', 'pipe'] }); // never uses a shell
    } catch (e) { return reject(e); }
    job.child = child;
    let buf = '';
    let cur = {};
    let stderr = '';
    child.stdout.on('data', (d) => {
      buf += d;
      let i;
      while ((i = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, i).trim();
        buf = buf.slice(i + 1);
        const eq = line.indexOf('=');
        if (eq < 0) continue;
        cur[line.slice(0, eq)] = line.slice(eq + 1);
        if (line.startsWith('progress=')) {
          const us = Number(cur.out_time_us !== undefined ? cur.out_time_us : cur.out_time_ms);
          if (Number.isFinite(us) && us >= 0) {
            onProgress({
              percent: Math.min(99.9, (us / 1e6 / clip) * 100),
              speed: cur.speed || null,
              sizeBytes: Number(cur.total_size) || null
            });
          }
          cur = {};
        }
      }
    });
    child.stderr.on('data', (d) => { stderr = (stderr + d).slice(-8000); });
    child.on('error', (e) => {
      if (e.code === 'ENOENT') reject(new ClipCutError('TOOL_MISSING', 'FFmpeg is not installed. Install it with: sudo apt install ffmpeg'));
      else reject(e);
    });
    child.on('close', (code, signal) => {
      if (job.killTimer) clearTimeout(job.killTimer);
      job.child = null;
      resolve({ code, signal, stderr });
    });
  });
}

function cancelJob(job) {
  if (!job || job.cancelled) return;
  job.cancelled = true;
  if (job.child) {
    job.child.kill('SIGTERM');
    job.killTimer = setTimeout(() => { if (job.child) job.child.kill('SIGKILL'); }, 4000);
  }
}

/** Synchronous emergency stop, used when the app is quitting. */
function forceStopSync(job) {
  if (!job) return;
  job.cancelled = true;
  try { if (job.child) job.child.kill('SIGKILL'); } catch { /* ignore */ }
  if (job.tempPath) fileService.removeQuietSync(job.tempPath);
  if (job.outputPath) fileService.removeIfEmptyFileSync(job.outputPath);
}

async function execute(job, { inputPath, info, start, end, onEvent }) {
  const clip = end - start;
  const outDir = path.dirname(inputPath);
  const ext = path.extname(inputPath);
  const muxer = MUXERS[ext.toLowerCase()] || null;

  // Disk space check (estimate from average bitrate + 10% + 64 MB safety margin).
  const free = await fileService.freeSpace(outDir);
  const needed = Math.ceil(info.sizeBytes * Math.min(1, clip / info.duration) * 1.1) + 64 * 1024 * 1024;
  if (free !== null && free < needed) {
    throw new ClipCutError('DISK_SPACE',
      `Not enough free disk space next to the original video. About ${(needed / 1e9).toFixed(2)} GB is needed, ${(free / 1e9).toFixed(2)} GB is free.`);
  }

  const outputPath = await fileService.reserveOutputPath(inputPath);
  job.outputPath = outputPath;
  const tempPath = fileService.tempSiblingPath(inputPath);
  job.tempPath = tempPath;
  onEvent({ type: 'started', outputName: path.basename(outputPath), outputPath });
  fileService.log('info', `trim start: ${inputPath} ${start.toFixed(3)}-${end.toFixed(3)} -> ${outputPath}`);

  let note = null;
  let lastFail = null;
  let ok = false;
  for (let i = 0; i < MAP_ATTEMPTS.length; i++) {
    const attempt = MAP_ATTEMPTS[i];
    const args = buildArgs({ inputPath, tempPath, start, clip, map: attempt.map, muxer });
    fileService.log('info', `ffmpeg attempt ${i + 1}: ffmpeg ${args.map((x) => JSON.stringify(x)).join(' ')}`);
    onEvent({ type: 'progress', percent: 0, speed: null, sizeBytes: null });
    const r = await runFfmpeg(job, args, clip, (p) => onEvent({ type: 'progress', ...p }));
    if (job.cancelled) throw new ClipCutError('CANCELLED', 'Trimming was cancelled. No output file was kept.');
    if (r.code === 0) { ok = true; note = attempt.note; break; }
    lastFail = { code: classify(r.stderr), stderr: r.stderr };
    fileService.log('error', `ffmpeg attempt ${i + 1} failed (exit ${r.code}): ${r.stderr.trim()}`);
    await fileService.removeQuiet(tempPath);
    if (!['INCOMPATIBLE_CONTAINER', 'FFMPEG_FAILED'].includes(lastFail.code)) break;
  }

  if (!ok) {
    const code = lastFail ? lastFail.code : 'FFMPEG_FAILED';
    const messages = {
      DISK_SPACE: 'The disk ran out of space while writing the clip.',
      PERMISSION: 'ClipCut does not have permission to write the clip in this folder.',
      CORRUPT_INPUT: 'FFmpeg could not read the original video. The file may be damaged or incomplete.',
      INCOMPATIBLE_CONTAINER: `The ${ext || 'original'} container cannot hold these streams without re-encoding. ClipCut never re-encodes, so this clip could not be created.`,
      FFMPEG_FAILED: 'FFmpeg could not trim this video using stream copy. ClipCut does not re-encode, so no clip was created.'
    };
    throw new ClipCutError(code, messages[code], lastFail ? lastFail.stderr.slice(-1500) : null);
  }

  // Validate the actual result.
  let outInfo;
  try {
    outInfo = await probeFile(tempPath);
  } catch (e) {
    throw new ClipCutError('OUTPUT_INVALID', 'FFmpeg finished, but the resulting file could not be verified, so it was discarded.', e.details || e.message);
  }
  const warnings = [];
  if (note) warnings.push(note);
  const iv = info.video, ov = outInfo.video;
  if (iv && (!ov || ov.codec !== iv.codec || ov.width !== iv.width || ov.height !== iv.height)) {
    warnings.push('The output video stream differs from the original. Please check the clip before using it.');
  }
  if (info.audio[0] && (!outInfo.audio[0] || outInfo.audio[0].codec !== info.audio[0].codec)) {
    warnings.push('The first audio stream of the output differs from the original. Please check the clip before using it.');
  }

  await fsp.rename(tempPath, outputPath); // atomically replaces only our own empty placeholder
  job.tempPath = null;
  const st = await fsp.stat(outputPath);
  fileService.log('info', `trim done: ${outputPath} (${st.size} bytes, ${outInfo.duration.toFixed(3)}s)`);

  return {
    outputPath,
    outputName: path.basename(outputPath),
    directory: outDir,
    sizeBytes: st.size,
    duration: outInfo.duration,
    requestedDuration: clip,
    requestedStart: start,
    requestedEnd: end,
    format: ext ? ext.slice(1).toUpperCase() : (outInfo.container.formatName || 'unknown'),
    formatName: outInfo.container.formatName,
    codecs: {
      video: ov ? ov.codec : null,
      audio: outInfo.audio.map((a) => a.codec)
    },
    counts: outInfo.counts,
    warnings
  };
}

function startTrim(opts) {
  const job = { cancelled: false, child: null, killTimer: null, outputPath: null, tempPath: null };
  const promise = (async () => {
    try {
      return await execute(job, opts);
    } catch (err) {
      // Clean up anything incomplete. The original is never touched.
      if (job.tempPath) await fileService.removeQuiet(job.tempPath);
      if (job.outputPath) await fileService.removeIfEmptyFile(job.outputPath);
      if (!(err instanceof ClipCutError && err.code === 'CANCELLED')) {
        fileService.log('error', `trim failed: ${err && err.stack ? err.stack : err}`);
      } else fileService.log('info', 'trim cancelled by user');
      throw err;
    }
  })();
  return { job, promise };
}

module.exports = { startTrim, cancelJob, forceStopSync, MUXERS };
