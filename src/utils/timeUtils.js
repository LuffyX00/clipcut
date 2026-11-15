const pad = (n, w = 2) => String(n).padStart(w, '0');

/** seconds -> "HH:MM:SS.mmm" */
export function formatTime(sec) {
  if (!Number.isFinite(sec) || sec < 0) sec = 0;
  const totalMs = Math.round(sec * 1000);
  const ms = totalMs % 1000;
  const s = Math.floor(totalMs / 1000) % 60;
  const m = Math.floor(totalMs / 60000) % 60;
  const h = Math.floor(totalMs / 3600000);
  return `${pad(h)}:${pad(m)}:${pad(s)}.${pad(ms, 3)}`;
}

/**
 * Parses "HH:MM:SS.mmm", "MM:SS.mmm", "SS.mmm" (also "," as decimal separator).
 * Returns seconds, or null when the text is not a valid timestamp.
 */
export function parseTime(text) {
  if (typeof text !== 'string') return null;
  const m = /^(?:(?:(\d+):)?(\d+):)?(\d+)(?:[.,](\d{1,3}))?$/.exec(text.trim());
  if (!m) return null;
  const hasH = m[1] !== undefined;
  const hasM = m[2] !== undefined;
  const h = hasH ? Number(m[1]) : 0;
  const min = hasM ? Number(m[2]) : 0;
  const s = Number(m[3]);
  const ms = m[4] ? Number(m[4].padEnd(3, '0')) : 0;
  if (hasM && s >= 60) return null;
  if (hasH && min >= 60) return null;
  return h * 3600 + min * 60 + s + ms / 1000;
}

/** Short clock for the ruler: H:MM:SS or M:SS (optionally with tenths). */
export function formatClock(sec, tenths = false) {
  if (!Number.isFinite(sec) || sec < 0) sec = 0;
  const t = Math.round(sec * 10) / 10;
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  const sStr = tenths ? s.toFixed(1).padStart(4, '0') : pad(Math.floor(s));
  return h > 0 ? `${h}:${pad(m)}:${sStr}` : `${m}:${sStr}`;
}

export function formatDuration(sec) {
  if (!Number.isFinite(sec) || sec < 0) sec = 0;
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h} h ${m} min ${Math.floor(s)} s`;
  if (m > 0) return `${m} min ${s.toFixed(1)} s`;
  return `${s.toFixed(2)} s`;
}

export function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return '—';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  let v = bytes;
  while (v >= 1000 && i < units.length - 1) { v /= 1000; i++; }
  return `${v.toFixed(i === 0 ? 0 : v >= 100 ? 0 : 2)} ${units[i]}`;
}

export function formatBitrate(bps) {
  if (!Number.isFinite(bps) || bps <= 0) return '—';
  return bps >= 1e6 ? `${(bps / 1e6).toFixed(2)} Mb/s` : `${Math.round(bps / 1e3)} kb/s`;
}

export function formatElapsed(ms) {
  const s = Math.floor(ms / 1000);
  return `${pad(Math.floor(s / 60))}:${pad(s % 60)}`;
}
