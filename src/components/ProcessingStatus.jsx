import { useEffect, useState } from 'react';
import { AlertTriangle, Loader2, X } from 'lucide-react';
import { formatElapsed, formatTime } from '../utils/timeUtils.js';

function useElapsed(startedAt, active) {
  const [ms, setMs] = useState(0);
  useEffect(() => {
    if (!active) return undefined;
    const id = setInterval(() => setMs(Date.now() - startedAt), 500);
    setMs(Date.now() - startedAt);
    return () => clearInterval(id);
  }, [startedAt, active]);
  return ms;
}

export default function ProcessingStatus({ trim, inputName, onCancel, onDismiss, logPath }) {
  const running = trim.status === 'running';
  const elapsed = useElapsed(trim.startedAt, running);

  if (trim.status === 'cancelled') {
    return (
      <section className="panel status status-note">
        <div>
          <strong>Trimming cancelled.</strong>
          <p>The unfinished clip was removed. Your original video was not changed.</p>
        </div>
        <button className="btn btn-secondary" onClick={onDismiss}>Dismiss</button>
      </section>
    );
  }

  if (trim.status === 'error') {
    return (
      <section className="panel status status-error">
        <AlertTriangle size={20} />
        <div className="grow">
          <strong>The clip could not be created.</strong>
          <p>{trim.error.message}</p>
          {trim.error.details && (
            <details>
              <summary>Technical details</summary>
              <pre>{trim.error.details}</pre>
              {logPath && <p className="muted">Log file: {logPath}</p>}
            </details>
          )}
        </div>
        <button className="btn btn-secondary" onClick={onDismiss}>Dismiss</button>
      </section>
    );
  }

  const pct = Math.max(0, Math.min(100, trim.percent || 0));
  return (
    <section className="panel status">
      <div className="status-head">
        <div className="status-title">
          <Loader2 size={18} className="spin" />
          <strong>{trim.cancelling ? 'Cancelling…' : 'Trimming (stream copy)…'}</strong>
          <span className="pct">{pct.toFixed(0)}%</span>
        </div>
        <button className="btn btn-danger" onClick={onCancel} disabled={trim.cancelling}>
          <X size={16} /> Cancel
        </button>
      </div>
      <div className="progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className="progress-bar" style={{ width: `${pct}%` }} />
      </div>
      <dl className="status-grid">
        <div><dt>Input</dt><dd title={inputName}>{inputName}</dd></div>
        <div><dt>Start</dt><dd>{formatTime(trim.start)}</dd></div>
        <div><dt>End</dt><dd>{formatTime(trim.end)}</dd></div>
        <div><dt>Output</dt><dd>{trim.outputName || '…'}</dd></div>
        <div><dt>Elapsed</dt><dd>{formatElapsed(elapsed)}</dd></div>
        <div><dt>Speed</dt><dd>{trim.speed || '—'}</dd></div>
      </dl>
    </section>
  );
}
