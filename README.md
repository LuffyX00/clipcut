# ClipCut — Trim videos. Preserve quality.

ClipCut is a small, free desktop app for Ubuntu that cuts clips out of very large videos
(5 GB, 7 GB, 10 GB and more) **without re-encoding**. It uses FFmpeg stream copy
(`-c copy`), so the clip keeps the original codec, resolution, frame rate, audio and quality.
Nothing is uploaded anywhere. Your original file is never modified.

Stack: Electron + React + Vite (JavaScript/JSX only), FFmpeg + FFprobe.

---

## 1. Install what you need (Ubuntu 24.04)

Copy and paste these into a terminal.

**FFmpeg and FFprobe**

```bash
sudo apt update
sudo apt install -y ffmpeg
ffmpeg -version && ffprobe -version
```

**Node.js 20 or newer** (Ubuntu's default Node is too old):

```bash
sudo apt install -y curl
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v   # should print v20.x or newer
```

## 2. Install the project

Unzip the project, then:

```bash
cd clipcut
npm install
```

## 3. Run it (development mode)

```bash
npm run dev
```

The ClipCut window opens. Click **Open Video**.

## 4. Build and launch the finished app

Quick launch from the built files:

```bash
npm run build
npm start
```

Create an installable package (AppImage and .deb, written to `release/`):

```bash
npm run dist
sudo apt install ./release/clipcut_1.0.0_amd64.deb     # installs it, then find "ClipCut" in your app menu
# or, without installing:
chmod +x release/ClipCut-1.0.0.AppImage
./release/ClipCut-1.0.0.AppImage --no-sandbox
```

(Exact file names depend on the version in `package.json`.)

## 5. How to use it

1. **Open Video**: pick your recording. Details appear on the right, thumbnails appear on the timeline.
2. Drag the amber handles, or type exact times (`HH:MM:SS.mmm`) in Start and End. They are always in sync.
   The crosshair button next to each field sets it to the playhead.
3. **Play Selected** previews just your range.
4. **Trim Video** saves the clip **in the same folder as the original**:
   `stream.mp4` → `stream_trimmed.mp4`, then `stream_trimmed_2.mp4`, … Existing files are never overwritten.

Shortcuts: `Space` play/pause · `I` set start to playhead · `O` set end to playhead.

### Honest limits of stream copy

* Cuts happen on **keyframes**. The clip can start a little before your start time and its length can
  differ by a moment. It is not guaranteed to be frame-exact. ClipCut reports the real length afterwards.
* Some codec/container combinations cannot be copied. ClipCut then tells you why. It **never** silently re-encodes.
* If the original container cannot hold every stream (e.g. certain subtitle or data tracks in MP4), ClipCut
  still copies video + audio unchanged and tells you which streams were left out.
* The preview uses Chromium's player. Some codecs (for example HEVC or AC-3 audio) may not preview.
  Trimming still works, because streams are copied, not decoded.
* Real limits depend on free disk space (the clip needs room next to the original) and the filesystem.

## 6. Troubleshooting

**"The SUID sandbox helper binary was found, but is not configured correctly"** (Ubuntu 24.04)
Ubuntu 24.04 restricts the Chromium sandbox. The `npm run dev`, `npm start` scripts already pass `--no-sandbox`.
For an AppImage add `--no-sandbox` yourself. The `.deb` normally works without it. To allow the sandbox system-wide instead:

```bash
sudo sysctl -w kernel.apparmor_restrict_unprivileged_userns=0
```

**Banner says FFmpeg/FFprobe not found** → `sudo apt install -y ffmpeg`, restart ClipCut.

**`npm install` fails on the Electron download** → check your internet connection and retry; use Node 20+.

**Port 5173 in use during `npm run dev`** → close the other Vite process or `fuser -k 5173/tcp`.

**"Not enough free disk space"** → free up space in the folder that contains the original.

**Preview is black or says it can't preview** → see "limits" above; trimming still works.

**Log file** (technical details for debugging): `~/.config/clipcut/logs/clipcut.log`

**Leftover files after a crash**: unfinished clips are hidden files named `.clipcut-*` next to the original,
plus a possible 0-byte `*_trimmed*` file. Both are safe to delete. ClipCut cleans up after cancel and normal quit.

## 7. Tests

```bash
npm test                         # unit tests: time parsing, validation, safe output naming
bash tests/make-test-videos.sh   # creates MP4/MKV/MOV/WebM/AVI/TS samples (+ two-audio MKV) in tests/samples
# trim one with ClipCut, then prove nothing was re-encoded:
bash tests/verify-copy.sh tests/samples/sample.mkv tests/samples/sample_trimmed.mkv
```

Manual checklist: small and very large files, each container, multiple audio streams, subtitles, invalid
timestamps, existing `_trimmed` names, cancel mid-run, original unchanged (size + modified time).

## 8. Project layout

```
electron/   main.js, preload.js (restricted API), ipc/ handlers, services/ (ffmpeg, ffprobe, thumbnails, files)
src/        React UI: components/, hooks/useTrimSelection.js (single shared selection state), utils/
tests/      unit tests + shell scripts
```

Security: `contextIsolation: true`, `nodeIntegration: false`, sandboxed renderer, and a preload that
exposes only a handful of functions. The UI never sends file paths to be processed: the main process
only works on the video chosen in the native dialog. FFmpeg is always started with `spawn` and an
argument array (never a shell string).
