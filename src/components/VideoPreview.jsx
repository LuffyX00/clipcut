import { useCallback, useEffect, useRef, useState } from 'react';
import { Maximize, Pause, Play, Volume2, VolumeX } from 'lucide-react';
import { formatTime } from '../utils/timeUtils.js';

export default function VideoPreview({ videoRef, src, duration, stopAtRef, onTime }) {
  const wrapRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [error, setError] = useState(false);
  const lastEmit = useRef(0);

  const sync = useCallback((t) => {
    setTime(t);
    onTime(t);
  }, [onTime]);

  // While playing: smooth updates + stop exactly at the end of "Play Selected".
  useEffect(() => {
    if (!playing) return undefined;
    let raf;
    const tick = () => {
      const v = videoRef.current;
      if (v) {
        const stopAt = stopAtRef.current;
        if (stopAt !== null && v.currentTime >= stopAt) {
          v.pause();
          v.currentTime = stopAt;
          stopAtRef.current = null;
          sync(stopAt);
        } else if (performance.now() - lastEmit.current > 80) {
          lastEmit.current = performance.now();
          sync(v.currentTime);
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, videoRef, stopAtRef, sync]);

  useEffect(() => {
    const v = videoRef.current;
    if (v) { v.volume = volume; v.muted = muted; }
  }, [volume, muted, videoRef, src]);

  const toggle = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    stopAtRef.current = null;
    if (v.paused) v.play().catch(() => {});
    else v.pause();
  }, [videoRef, stopAtRef]);

  const seekTo = (t) => {
    const v = videoRef.current;
    if (!v) return;
    stopAtRef.current = null;
    v.currentTime = t;
    sync(t);
  };

  const fullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else wrapRef.current && wrapRef.current.requestFullscreen();
  };

  return (
    <div className="preview" ref={wrapRef}>
      <div className="preview-stage" onClick={toggle}>
        <video
          key={src}
          ref={videoRef}
          src={src}
          preload="metadata"
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)}
          onSeeked={(e) => sync(e.currentTarget.currentTime)}
          onLoadedMetadata={() => setError(false)}
          onError={() => setError(true)}
        />
        {error && (
          <div className="preview-error">
            <strong>This format can’t be previewed here.</strong>
            <span>The built-in player doesn’t support this codec. You can still trim: ClipCut copies the streams without decoding them. Use the timestamp fields to pick your range.</span>
          </div>
        )}
      </div>
      <div className="controls">
        <button className="icon-btn" onClick={toggle} title="Play / pause (Space)" aria-label="Play or pause">
          {playing ? <Pause size={18} /> : <Play size={18} />}
        </button>
        <span className="time">{formatTime(time)}</span>
        <input
          className="seek"
          type="range"
          min={0}
          max={duration}
          step={0.01}
          value={Math.min(time, duration)}
          onChange={(e) => seekTo(Number(e.target.value))}
          aria-label="Seek"
        />
        <span className="time muted">{formatTime(duration)}</span>
        <button className="icon-btn" onClick={() => setMuted((m) => !m)} title="Mute" aria-label="Mute">
          {muted || volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
        </button>
        <input
          className="volume"
          type="range"
          min={0}
          max={1}
          step={0.02}
          value={muted ? 0 : volume}
          onChange={(e) => { setVolume(Number(e.target.value)); setMuted(false); }}
          aria-label="Volume"
        />
        <button className="icon-btn" onClick={fullscreen} title="Full screen" aria-label="Full screen">
          <Maximize size={17} />
        </button>
      </div>
    </div>
  );
}
