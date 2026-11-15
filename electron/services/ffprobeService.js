'use strict';
const { spawn } = require('child_process');
const path = require('path');
const fsp = require('fs').promises;
const { ClipCutError } = require('./errors');

function runCapture(cmd, args, { timeoutMs = 60000 } = {}) {
  return new Promise((resolve, reject) => {
    let child;
    try {
      child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] }); // no shell, argument array
    } catch (e) { return reject(e); }
    let out = '';
    let err = '';
    const timer = setTimeout(() => child.kill('SIGKILL'), timeoutMs);
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { if (err.length < 20000) err += d; });
    child.on('error', (e) => { clearTimeout(timer); reject(e); });
    child.on('close', (code) => { clearTimeout(timer); resolve({ code, stdout: out, stderr: err }); });
  });
}

async function checkTool(name) {
  try {
    const r = await runCapture(name, ['-version'], { timeoutMs: 10000 });
    if (r.code !== 0) return { ok: false, version: null };
    const m = /version\s+(\S+)/.exec(r.stdout);
    return { ok: true, version: m ? m[1] : 'unknown' };
  } catch {
    return { ok: false, version: null };
  }
}

async function checkTools() {
  const [ffmpeg, ffprobe] = await Promise.all([checkTool('ffmpeg'), checkTool('ffprobe')]);
  return { ffmpeg, ffprobe };
}

function parseRate(r) {
  if (!r || r === '0/0') return null;
  const [n, d] = String(r).split('/').map(Number);
  if (!Number.isFinite(n)) return null;
  if (!d) return n || null;
  return n / d;
}

function gcd(a, b) { return b ? gcd(b, a % b) : a; }

function describeStream(s) {
  const type = s.codec_type || 'other';
  const out = {
    index: s.index,
    type,
    codec: s.codec_name || 'unknown',
    codecLong: s.codec_long_name || null,
    profile: s.profile || null,
    language: (s.tags && s.tags.language) || null,
    title: (s.tags && s.tags.title) || null,
    bitRate: s.bit_rate ? Number(s.bit_rate) : null,
    isDefault: !!(s.disposition && s.disposition.default),
    isAttachedPic: !!(s.disposition && s.disposition.attached_pic)
  };
  if (type === 'video') {
    out.width = s.width || null;
    out.height = s.height || null;
    out.fps = parseRate(s.avg_frame_rate) || parseRate(s.r_frame_rate);
    out.pixFmt = s.pix_fmt || null;
    if (s.display_aspect_ratio && s.display_aspect_ratio !== '0:1') {
      out.aspect = s.display_aspect_ratio;
    } else if (s.width && s.height) {
      const g = gcd(s.width, s.height);
      out.aspect = `${s.width / g}:${s.height / g}`;
    } else out.aspect = null;
  }
  if (type === 'audio') {
    out.channels = s.channels || null;
    out.channelLayout = s.channel_layout || null;
    out.sampleRate = s.sample_rate ? Number(s.sample_rate) : null;
  }
  return out;
}

async function probeFile(filePath) {
  let result;
  try {
    result = await runCapture('ffprobe', [
      '-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', '-i', filePath
    ]);
  } catch (e) {
    if (e.code === 'ENOENT') {
      throw new ClipCutError('TOOL_MISSING', 'FFprobe is not installed. Install it with: sudo apt install ffmpeg');
    }
    throw e;
  }
  if (result.code !== 0) {
    throw new ClipCutError('CORRUPT_INPUT',
      'FFprobe could not read this file. It may be corrupted, incomplete, or not a video.',
      result.stderr.slice(-1500));
  }
  let data;
  try { data = JSON.parse(result.stdout); } catch {
    throw new ClipCutError('CORRUPT_INPUT', 'FFprobe returned unreadable data for this file.');
  }
  const st = await fsp.stat(filePath);
  const streams = (data.streams || []).map(describeStream);
  const primaryVideo = streams.find((s) => s.type === 'video' && !s.isAttachedPic) || null;
  const audio = streams.filter((s) => s.type === 'audio');
  const subs = streams.filter((s) => s.type === 'subtitle');

  let duration = data.format && data.format.duration ? Number(data.format.duration) : NaN;
  if (!Number.isFinite(duration) || duration <= 0) {
    const durs = (data.streams || []).map((s) => Number(s.duration)).filter((n) => Number.isFinite(n) && n > 0);
    duration = durs.length ? Math.max(...durs) : NaN;
  }
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new ClipCutError('UNKNOWN_DURATION', 'ClipCut could not determine the length of this video. The file may be damaged or still downloading.');
  }
  return {
    path: filePath,
    fileName: path.basename(filePath),
    directory: path.dirname(filePath),
    sizeBytes: st.size,
    container: {
      formatName: (data.format && data.format.format_name) || 'unknown',
      formatLongName: (data.format && data.format.format_long_name) || null
    },
    duration,
    bitRate: data.format && data.format.bit_rate ? Number(data.format.bit_rate) : null,
    video: primaryVideo,
    audio,
    streams,
    counts: {
      video: streams.filter((s) => s.type === 'video' && !s.isAttachedPic).length,
      audio: audio.length,
      subtitle: subs.length,
      other: streams.length - streams.filter((s) => ['video', 'audio', 'subtitle'].includes(s.type)).length
    }
  };
}

module.exports = { runCapture, checkTools, probeFile };
