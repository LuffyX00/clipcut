import { useCallback, useEffect, useRef, useState } from 'react';
import { Film, FolderOpen, TriangleAlert } from 'lucide-react';
import Header from './components/Header.jsx';
import VideoPreview from './components/VideoPreview.jsx';
import VideoMetadata from './components/VideoMetadata.jsx';
import Timeline from './components/Timeline.jsx';
import TrimControls from './components/TrimControls.jsx';
import ProcessingStatus from './components/ProcessingStatus.jsx';
import CompletionPanel from './components/CompletionPanel.jsx';
import useTrimSelection from './hooks/useTrimSelection.js';

const api = window.clipcut;

export default function App() {
  const [tools, setTools] = useState(null);
  const [video, setVideo] = useState(null); // { info, mediaUrl }
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [thumbs, setThumbs] = useState(null); // { jobId, times, images }
  const [currentTime, setCurrentTime] = useState(0);
  const [trim, setTrim] = useState({ status: 'idle' });
  const [doneMessage, setDoneMessage] = useState(null);
  const [logPath, setLogPath] = useState(null);

  const videoRef = useRef(null);
  const stopAtRef = useRef(null);
  const currentTimeRef = useRef(0);
  currentTimeRef.current = currentTime;

  const duration = video ? video.info.duration : 0;
  const sel = useTrimSelection(duration, video && video.mediaUrl);
  const selRef = useRef(sel);
  selRef.current = sel;

  const busy = trim.status === 'running';

  // ---- startup + event subscriptions ----
  useEffect(() => {
    api.checkTools().then(setTools).catch(() => setTools({ ffmpeg: { ok: false }, ffprobe: { ok: false } }));
    api.getLogPath().then(setLogPath).catch(() => {});
    const offThumb = api.onThumbnail((p) => {
      setThumbs((t) => {
        if (!t || t.jobId !== p.jobId) return t;
        const images = t.images.slice();
        images[p.index] = p.dataUrl;
        return { ...t, images };
      });
    });
    const offTrim = api.onTrimEvent((ev) => {
      if (ev.type === 'started') setTrim((t) => ({ ...t, outputName: ev.outputName }));
      if (ev.type === 'progress') {
        setTrim((t) => (t.status === 'running' ? { ...t, percent: ev.percent, speed: ev.speed } : t));
      }
    });
    return () => { offThumb(); offTrim(); };
  }, []);

  // ---- open video ----
  const openVideo = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await api.openVideo();
      if (!res.ok) { setLoadError(res.error); return; }
      if (res.canceled) return;
      stopAtRef.current = null;
      setVideo({ info: res.info, mediaUrl: res.mediaUrl });
      setCurrentTime(0);
      setTrim({ status: 'idle' });
      setThumbs(null);
      const t = await api.startThumbnails();
      if (t.ok) setThumbs({ jobId: t.jobId, times: t.times, images: new Array(t.count).fill(null) });
    } catch (e) {
      setLoadError({ message: 'Could not open the video.', details: String(e) });
    } finally {
      setLoading(false);
    }
  }, []);

  // ---- playback helpers ----
  const seek = useCallback((t) => {
    stopAtRef.current = null;
    if (videoRef.current) videoRef.current.currentTime = t;
    setCurrentTime(t);
  }, []);

  const playSelected = () => {
    const v = videoRef.current;
    if (!v || !sel.validation.valid) return;
    v.currentTime = sel.start;
    setCurrentTime(sel.start);
    stopAtRef.current = sel.end;
    v.play().catch(() => {});
  };

  const onHandleRelease = (kind) => {
    const { start, end } = selRef.current;
    seek(kind === 'start' ? start : end);
  };

  // ---- trimming ----
  const handleTrim = async () => {
    if (!video || busy || !sel.validation.valid) return;
    if (videoRef.current) videoRef.current.pause();
    const { start, end } = selRef.current;
    setDoneMessage(null);
    setTrim({ status: 'running', startedAt: Date.now(), percent: 0, start, end, outputName: null });
    try {
      const res = await api.startTrim({ start, end });
      if (res.ok) setTrim({ status: 'done', result: res.result });
      else if (res.error.code === 'CANCELLED') setTrim({ status: 'cancelled' });
      else setTrim({ status: 'error', error: res.error });
    } catch (e) {
      setTrim({ status: 'error', error: { message: 'The trim request failed unexpectedly.', details: String(e) } });
    }
  };

  const handleCancel = () => {
    setTrim((t) => ({ ...t, cancelling: true }));
    api.cancelTrim();
  };

  const playOutput = async () => {
    const r = await api.openOutput();
    setDoneMessage(r.ok ? null : r.message);
  };
  const revealOutput = async () => {
    const r = await api.revealOutput();
    setDoneMessage(r.ok ? null : r.message);
  };

  // ---- keyboard shortcuts: Space = play/pause, I = set start, O = set end ----
  useEffect(() => {
    const onKey = (e) => {
      if (!video || busy) return;
      const tag = (e.target && e.target.tagName) || '';
      if (['INPUT', 'TEXTAREA', 'BUTTON'].includes(tag) && !(tag === 'INPUT' && e.target.type === 'range')) return;
      if (e.code === 'Space') {
        e.preventDefault();
        const v = videoRef.current;
        if (v) { stopAtRef.current = null; if (v.paused) v.play().catch(() => {}); else v.pause(); }
      } else if (e.key === 'i' || e.key === 'I') selRef.current.setStart(currentTimeRef.current);
      else if (e.key === 'o' || e.key === 'O') selRef.current.setEnd(currentTimeRef.current);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [video, busy]);

  const toolsMissing = tools && (!tools.ffmpeg.ok || !tools.ffprobe.ok);

  return (
    <div className="app">
      <Header fileName={video && video.info.fileName} onOpen={openVideo} disabled={busy} loading={loading} />

      {toolsMissing && (
        <div className="banner banner-error">
          <TriangleAlert size={18} />
          <div>
            <strong>FFmpeg {!tools.ffmpeg.ok ? 'and/or ' : ''}FFprobe not found.</strong>
            <p>ClipCut needs them to read and trim videos. Install both with this command, then restart ClipCut:</p>
            <code>sudo apt update &amp;&amp; sudo apt install -y ffmpeg</code>
          </div>
        </div>
      )}

      {loadError && (
        <div className="banner banner-error">
          <TriangleAlert size={18} />
          <div>
            <strong>{loadError.message}</strong>
            {loadError.details && <details><summary>Technical details</summary><pre>{loadError.details}</pre></details>}
          </div>
          <button className="btn btn-secondary" onClick={() => setLoadError(null)}>Dismiss</button>
        </div>
      )}

      {!video ? (
        <main className="empty">
          <Film size={46} strokeWidth={1.3} />
          <h2>Cut a clip out of a long recording</h2>
          <p>Open a video, drag the handles around the part you want, and ClipCut saves it next to the original without re-encoding. Files of 5 GB or more are fine: they are read from disk, never loaded into memory.</p>
          <button className="btn btn-primary btn-large" onClick={openVideo} disabled={loading}>
            <FolderOpen size={18} /> {loading ? 'Reading video…' : 'Open Video'}
          </button>
        </main>
      ) : (
        <main className="workspace">
          <section className="top-row">
            <VideoPreview
              videoRef={videoRef}
              src={video.mediaUrl}
              duration={duration}
              stopAtRef={stopAtRef}
              onTime={setCurrentTime}
            />
            <VideoMetadata info={video.info} />
          </section>

          <Timeline
            duration={duration}
            start={sel.start}
            end={sel.end}
            currentTime={currentTime}
            thumbs={thumbs}
            disabled={busy}
            onStartChange={sel.setStart}
            onEndChange={sel.setEnd}
            onSeek={seek}
            onHandleRelease={onHandleRelease}
          />

          <TrimControls
            start={sel.start}
            end={sel.end}
            selected={sel.selected}
            validation={sel.validation}
            busy={busy}
            onStart={sel.setStart}
            onEnd={sel.setEnd}
            onStartFromPlayhead={() => sel.setStart(currentTimeRef.current)}
            onEndFromPlayhead={() => sel.setEnd(currentTimeRef.current)}
            onPlaySelected={playSelected}
            onTrim={handleTrim}
          />

          {['running', 'error', 'cancelled'].includes(trim.status) && (
            <ProcessingStatus
              trim={trim}
              inputName={video.info.fileName}
              logPath={logPath}
              onCancel={handleCancel}
              onDismiss={() => setTrim({ status: 'idle' })}
            />
          )}

          {trim.status === 'done' && (
            <CompletionPanel
              result={trim.result}
              message={doneMessage}
              onReveal={revealOutput}
              onPlay={playOutput}
              onAnother={() => setTrim({ status: 'idle' })}
            />
          )}
        </main>
      )}
    </div>
  );
}
