import { useEffect, useState } from 'react';
import { Crosshair } from 'lucide-react';
import { formatTime, parseTime } from '../utils/timeUtils.js';

export default function TimestampInput({ id, label, value, onCommit, onSetFromPlayhead, disabled }) {
  const [text, setText] = useState(formatTime(value));
  const [focused, setFocused] = useState(false);
  const [error, setError] = useState(null);

  // Mirror the shared state whenever the user is not typing (e.g. a timeline handle moved).
  useEffect(() => {
    if (!focused) setText(formatTime(value));
  }, [value, focused]);

  const commit = () => {
    const parsed = parseTime(text);
    if (parsed === null) {
      setError('Use HH:MM:SS.mmm');
      setText(formatTime(value));
    } else {
      setError(null);
      onCommit(parsed);
    }
    setFocused(false);
  };

  return (
    <div className="ts-field">
      <label htmlFor={id}>{label}</label>
      <div className={`ts-box ${error ? 'has-error' : ''}`}>
        <input
          id={id}
          value={text}
          disabled={disabled}
          spellCheck={false}
          inputMode="decimal"
          onFocus={(e) => { setFocused(true); setError(null); e.target.select(); }}
          onChange={(e) => { setText(e.target.value); setError(null); }}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur();
            if (e.key === 'Escape') { setText(formatTime(value)); e.currentTarget.blur(); }
          }}
          placeholder="00:00:00.000"
        />
        <button
          type="button"
          className="icon-btn small"
          onMouseDown={(e) => e.preventDefault()}
          onClick={onSetFromPlayhead}
          disabled={disabled}
          title={`Set ${label.toLowerCase()} to the playhead`}
          aria-label={`Set ${label.toLowerCase()} to the playhead`}
        >
          <Crosshair size={15} />
        </button>
      </div>
      <div className="ts-error">{error || ' '}</div>
    </div>
  );
}
