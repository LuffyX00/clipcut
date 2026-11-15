export const MIN_SELECTION = 0.05; // seconds

export function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v));
}

/** Returns { valid, errors[] } for a start/end pair against the video duration. */
export function validateRange(start, end, duration) {
  const errors = [];
  if (!Number.isFinite(start) || !Number.isFinite(end)) errors.push('Start and end must be valid times.');
  else {
    if (start < 0) errors.push('Start cannot be negative.');
    if (end > duration + 0.001) errors.push('End cannot be after the end of the video.');
    if (start >= end) errors.push('Start must be before end.');
    else if (end - start < 0.01) errors.push('The selection is too short.');
  }
  return { valid: errors.length === 0, errors };
}
