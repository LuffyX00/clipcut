import { CheckCircle2, FolderOpen, Play, RotateCcw, TriangleAlert } from 'lucide-react';
import { formatBytes, formatDuration, formatTime } from '../utils/timeUtils.js';

export default function CompletionPanel({ result, message, onReveal, onPlay, onAnother }) {
  const delta = result.duration - result.requestedDuration;
  return (
    <section className="panel done">
      <div className="done-head">
        <CheckCircle2 size={22} />
        <div>
          <strong>Clip saved</strong>
          <p>{result.outputName}</p>
        </div>
      </div>
      <dl className="status-grid">
        <div><dt>File size</dt><dd>{formatBytes(result.sizeBytes)}</dd></div>
        <div><dt>Duration</dt><dd>{formatDuration(result.duration)}</dd></div>
        <div><dt>Format</dt><dd>{result.format}{result.codecs.video ? ` · ${result.codecs.video}` : ''}{result.codecs.audio.length ? ` + ${result.codecs.audio.join(', ')}` : ''}</dd></div>
        <div className="wide"><dt>Location</dt><dd title={result.directory}>{result.directory}</dd></div>
      </dl>
      {Math.abs(delta) > 0.1 && (
        <p className="hint">
          <TriangleAlert size={14} />
          You asked for {formatTime(result.requestedStart)} → {formatTime(result.requestedEnd)} ({formatDuration(result.requestedDuration)}). Because stream copy cuts at keyframes, the clip is {formatDuration(Math.abs(delta))} {delta > 0 ? 'longer' : 'shorter'}.
        </p>
      )}
      {result.warnings.map((w) => (
        <p className="hint warn" key={w}><TriangleAlert size={14} />{w}</p>
      ))}
      {message && <p className="form-error">{message}</p>}
      <div className="done-actions">
        <button className="btn btn-secondary" onClick={onReveal}><FolderOpen size={16} /> Open Output Folder</button>
        <button className="btn btn-secondary" onClick={onPlay}><Play size={16} /> Play Trimmed Video</button>
        <button className="btn btn-primary" onClick={onAnother}><RotateCcw size={16} /> Trim Another Section</button>
      </div>
    </section>
  );
}
