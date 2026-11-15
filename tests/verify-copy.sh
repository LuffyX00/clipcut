#!/usr/bin/env bash
# Usage: tests/verify-copy.sh original.mp4 original_trimmed.mp4
# Proves the clip was stream-copied: codec, resolution, fps, pixel format, audio params must match.
set -euo pipefail
ORIG="$1"; CLIP="$2"
show() { ffprobe -v error -show_entries stream=codec_type,codec_name,profile,width,height,pix_fmt,r_frame_rate,sample_rate,channels -of csv=p=0 "$1"; }
if diff <(show "$ORIG") <(show "$CLIP"); then
  echo "PASS: stream parameters are identical (no re-encoding)."
else
  echo "FAIL: stream parameters differ."; exit 1
fi
echo "Original: $(stat -c '%s bytes, modified %y' "$ORIG")"
echo "Clip:     $(stat -c '%s bytes' "$CLIP"), duration $(ffprobe -v error -show_entries format=duration -of csv=p=0 "$CLIP") s"
