import { FolderOpen, Scissors } from 'lucide-react';

export default function Header({ fileName, onOpen, disabled, loading }) {
  return (
    <header className="header">
      <div className="brand">
        <span className="brand-mark"><Scissors size={18} strokeWidth={2.4} /></span>
        <div>
          <h1>ClipCut</h1>
          <p>Trim videos. Preserve quality.</p>
        </div>
      </div>
      <div className="header-file" title={fileName || ''}>
        {fileName ? fileName : <span className="muted">No video open</span>}
      </div>
      <button className="btn btn-secondary" onClick={onOpen} disabled={disabled || loading}>
        <FolderOpen size={16} />
        {loading ? 'Reading video…' : 'Open Video'}
      </button>
    </header>
  );
}
