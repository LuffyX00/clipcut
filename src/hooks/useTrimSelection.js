import { useCallback, useEffect, useMemo, useState } from 'react';
import { MIN_SELECTION, clamp, validateRange } from '../utils/validation.js';

/**
 * ONE source of truth for the selection. The timeline handles and both timestamp
 * inputs all read from and write to this state, so they can never disagree.
 */
export default function useTrimSelection(duration, resetKey) {
  const [range, setRange] = useState({ start: 0, end: duration || 0 });
  const gap = Math.min(MIN_SELECTION, (duration || 0) / 2);

  useEffect(() => {
    setRange({ start: 0, end: duration || 0 });
  }, [duration, resetKey]);

  const setStart = useCallback((value) => {
    setRange((r) => ({ start: clamp(value, 0, Math.max(0, r.end - gap)), end: r.end }));
  }, [gap]);

  const setEnd = useCallback((value) => {
    setRange((r) => ({ start: r.start, end: clamp(value, Math.min(duration, r.start + gap), duration) }));
  }, [gap, duration]);

  const reset = useCallback(() => setRange({ start: 0, end: duration || 0 }), [duration]);

  const validation = useMemo(() => validateRange(range.start, range.end, duration), [range, duration]);

  return { start: range.start, end: range.end, selected: range.end - range.start, setStart, setEnd, reset, validation };
}
