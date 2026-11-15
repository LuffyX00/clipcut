import { formatBitrate, formatBytes, formatDuration } from '../utils/timeUtils.js';

function Row({ label, value }) {
  return (
    <div className="meta-row">
      <dt>{label}</dt>
      <dd>{value ?? '—'}</dd>
    </div>
  );
}

function streamDetail(s) {
  if (s.type === 'video') {
    return [s.width && s.height ? `${s.width}×${s.height}` : null, s.fps ? `${Number(s.fps.toFixed(3))} fps` : null, s.pixFmt].filter(Boolean).join(', ');
  }
  if (s.type === 'audio') {
    return [s.channelLayout || (s.channels ? `${s.channels} ch` : null), s.sampleRate ? `${s.sampleRate} Hz` : null].filter(Boolean).join(', ');
  }
  return s.title || '';
}

export default function VideoMetadata({ info }) {
  const v = info.video;
  return (
    <aside className="panel metadata">
      <h2>Video details</h2>
      <dl>
        <Row label="Container" value={`${info.container.formatLongName || info.container.formatName}`} />
        <Row label="Duration" value={formatDuration(info.duration)} />
        <Row label="File size" value={formatBytes(info.sizeBytes)} />
        <Row label="Resolution" value={v && v.width ? `${v.width} × ${v.height}` : null} />
        <Row label="Frame rate" value={v && v.fps ? `${Number(v.fps.toFixed(3))} fps` : null} />
        <Row label="Aspect ratio" value={v ? v.aspect : null} />
        <Row label="Video codec" value={v ? `${v.codec}${v.profile ? ` (${v.profile})` : ''}` : null} />
        <Row label="Audio" value={info.audio.length ? info.audio.map((a) => a.codec).join(', ') : 'none'} />
        <Row label="Overall bitrate" value={formatBitrate(info.bitRate)} />
      </dl>
      <h3>Streams ({info.streams.length})</h3>
      <ul className="streams">
        {info.streams.map((s) => (
          <li key={s.index}>
            <span className={`stream-type t-${s.type}`}>{s.type}</span>
            <span className="stream-codec">{s.codec}</span>
            <span className="stream-detail">
              {streamDetail(s)}{s.language ? ` · ${s.language}` : ''}
            </span>
          </li>
        ))}
      </ul>
    </aside>
  );
}
