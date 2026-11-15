#!/usr/bin/env bash
# Generates small sample videos in several containers (needs ffmpeg). Output: tests/samples/
set -euo pipefail
OUT="$(dirname "$0")/samples"; mkdir -p "$OUT"
SRC="-f lavfi -i testsrc2=size=1280x720:rate=30 -f lavfi -i sine=frequency=440:sample_rate=48000 -t 60"
ffmpeg -y -loglevel error $SRC -c:v libx264 -g 60 -c:a aac "$OUT/sample.mp4"
ffmpeg -y -loglevel error $SRC -c:v libx264 -g 60 -c:a aac "$OUT/sample.mkv"
ffmpeg -y -loglevel error $SRC -c:v libx264 -g 60 -c:a aac "$OUT/sample.mov"
ffmpeg -y -loglevel error $SRC -c:v libvpx-vp9 -g 60 -c:a libopus "$OUT/sample.webm"
ffmpeg -y -loglevel error $SRC -c:v mpeg4 -g 60 -c:a mp3 "$OUT/sample.avi"
ffmpeg -y -loglevel error $SRC -c:v libx264 -g 60 -c:a aac -f mpegts "$OUT/sample.ts"
# two audio tracks:
ffmpeg -y -loglevel error -f lavfi -i testsrc2=size=640x360:rate=30 -f lavfi -i sine=frequency=440 -f lavfi -i sine=frequency=880 \
  -map 0 -map 1 -map 2 -t 30 -c:v libx264 -c:a aac "$OUT/two-audio.mkv"
echo "Samples written to $OUT"
