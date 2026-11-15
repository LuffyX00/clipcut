import { Info, PlayCircle, Scissors } from 'lucide-react';
import TimestampInput from './TimestampInput.jsx';
import { formatDuration } from '../utils/timeUtils.js';

export default function TrimControls({
  start, end, selected, validation, busy,
  onStart, onEnd, onStartFromPlayhead, onEndFromPlayhead, onPlaySelected, onTrim
}) {
  return (
    <section className="panel trim-controls">
      <div className="trim-row">
        <TimestampInput id="ts-start" label="Start" value={start} onCommit={onStart} onSetFromPlayhead={onStartFromPlayhead} disabled={busy} />
        <TimestampInput id="ts-end" label="End" value={end} onCommit={onEnd} onSetFromPlayhead={onEndFromPlayhead} disabled={busy} />
        <div className="selected-duration">
          <span className="label">Selected duration</span>
          <strong>{validation.valid ? formatDuration(selected) : '—'}</strong>
        </div>
        <div className="trim-actions">
          <button className="btn btn-secondary" onClick={onPlaySelected} disabled={busy || !validation.valid}>
            <PlayCircle size={17} /> Play Selected
          </button>
          <button className="btn btn-primary" onClick={onTrim} disabled={busy || !validation.valid}>
            <Scissors size={17} /> Trim Video
          </button>
        </div>
      </div>
      {!validation.valid && <p className="form-error">{validation.errors.join(' ')}</p>}
      <p className="hint">
        <Info size={14} />
        Lossless stream copy: no re-encoding. Cuts snap to the nearest keyframe, so the clip may start slightly earlier than the start time and the length may differ by a moment. It is not guaranteed to be frame-exact.
      </p>
    </section>
  );
}
