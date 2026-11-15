import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Maximize2, ZoomIn, ZoomOut } from 'lucide-react';
import { formatClock } from '../utils/timeUtils.js';
import { clamp } from '../utils/validation.js';

const STEPS = [0.1, 0.2, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600, 7200];
const MAX_ZOOM = 64;
const HANDLE_W = 14;

export default function Timeline({
  duration, start, end, currentTime, thumbs, disabled,
  onStartChange, onEndChange, onSeek, onHandleRelease
}) {
  const scrollRef = useRef(null);
  const trackRef = useRef(null);
  const dragRef = useRef(null);
  const pendingCenter = useRef(null);
  const [zoom, setZoom] = useState(1);
  const [viewW, setViewW] = useState(900);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(() => setViewW(el.clientWidth));
    ro.observe(el);
    setViewW(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  useEffect(() => { setZoom(1); }, [duration]);

  const width = Math.max(160, Math.floor(viewW * zoom));
  const pps = duration > 0 ? width / duration : 1; // pixels per second

  const changeZoom = (factor) => {
    const next = clamp(zoom * factor, 1, MAX_ZOOM);
    if (next === zoom) return;
    pendingCenter.current = (scrollRef.current.scrollLeft + viewW / 2) / pps;
    setZoom(next);
  };

  useLayoutEffect(() => {
    if (pendingCenter.current !== null) {
      scrollRef.current.scrollLeft = pendingCenter.current * pps - viewW / 2;
      pendingCenter.current = null;
    }
  }, [pps, viewW]);

  // Keep the playhead visible while playing a zoomed-in timeline.
  useEffect(() => {
    if (dragRef.current || zoom <= 1) return;
    const el = scrollRef.current;
    const x = currentTime * pps;
    if (x < el.scrollLeft + 24 || x > el.scrollLeft + viewW - 24) el.scrollLeft = x - viewW / 2;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTime]);

  const timeAt = (e) => {
    const r = trackRef.current.getBoundingClientRect();
    return clamp((e.clientX - r.left) / pps, 0, duration);
  };

  const down = (kind) => (e) => {
    if (disabled || e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    trackRef.current.setPointerCapture(e.pointerId);
    const t = timeAt(e);
    const offset = kind === 'start' ? t - start : kind === 'end' ? t - end : 0;
    dragRef.current = { kind, offset };
    if (kind === 'seek') onSeek(t);
  };

  const move = (e) => {
    const d = dragRef.current;
    if (!d) return;
    const t = timeAt(e) - d.offset;
    if (d.kind === 'start') onStartChange(t);
    else if (d.kind === 'end') onEndChange(t);
    else onSeek(clamp(t, 0, duration));
  };

  const up = (e) => {
    const d = dragRef.current;
    if (!d) return;
    dragRef.current = null;
    try { trackRef.current.releasePointerCapture(e.pointerId); } catch { /* already released */ }
    if (d.kind !== 'seek') onHandleRelease(d.kind);
  };

  const step = STEPS.find((s) => s * pps >= 90) || STEPS[STEPS.length - 1];
  const ticks = [];
  for (let t = 0; t <= duration; t += step) ticks.push(t);

  const count = thumbs ? thumbs.times.length : 0;
  const interval = count ? duration / count : 0;

  return (
    <section className="panel timeline">
      <div className="timeline-toolbar">
        <h2>Timeline</h2>
        <div className="zoom">
          <button className="icon-btn small" onClick={() => changeZoom(0.5)} title="Zoom out" aria-label="Zoom out"><ZoomOut size={16} /></button>
          <span className="zoom-level">{zoom < 10 ? zoom.toFixed(1) : Math.round(zoom)}×</span>
          <button className="icon-btn small" onClick={() => changeZoom(2)} title="Zoom in" aria-label="Zoom in"><ZoomIn size={16} /></button>
          <button className="icon-btn small" onClick={() => setZoom(1)} title="Fit to view" aria-label="Fit to view"><Maximize2 size={15} /></button>
        </div>
      </div>
      <div className="timeline-scroll" ref={scrollRef}>
        <div
          className="timeline-track"
          ref={trackRef}
          style={{ width }}
          onPointerDown={down('seek')}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
        >
          <div className="ruler">
            {ticks.map((t) => (
              <span key={t} className="tick" style={{ left: t * pps }}>
                <i />{formatClock(t, step < 1)}
              </span>
            ))}
          </div>
          <div className="filmstrip">
            {Array.from({ length: count }, (_, i) => {
              const img = thumbs.images[i];
              return (
                <div
                  key={i}
                  className={`frame ${img ? '' : 'loading'}`}
                  style={{ left: i * interval * pps, width: interval * pps + 1, backgroundImage: img ? `url(${img})` : undefined }}
                />
              );
            })}
          </div>

          <div className="dim" style={{ left: 0, width: start * pps }} />
          <div className="dim" style={{ left: end * pps, width: Math.max(0, (duration - end) * pps) }} />
          <div className="selection" style={{ left: start * pps, width: Math.max(0, (end - start) * pps) }} />

          <div className="handle handle-start" style={{ left: start * pps }} onPointerDown={down('start')} title="Drag to set the start">
            <span />
          </div>
          <div className="handle handle-end" style={{ left: end * pps - HANDLE_W }} onPointerDown={down('end')} title="Drag to set the end">
            <span />
          </div>

          <div className="playhead" style={{ left: currentTime * pps }} />
        </div>
      </div>
    </section>
  );
}
