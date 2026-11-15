'use strict';
const { ipcMain } = require('electron');
const state = require('../state');
const fileService = require('../services/fileService');
const ffmpegService = require('../services/ffmpegService');
const { ClipCutError, toPlain } = require('../services/errors');

function send(channel, payload) {
  const w = state.mainWindow;
  if (w && !w.isDestroyed()) w.webContents.send(channel, payload);
}

function registerTrimHandlers() {
  ipcMain.handle('trim:start', async (_e, req) => {
    try {
      if (state.activeTrim) throw new ClipCutError('BUSY', 'A trim is already running.');
      const v = state.currentVideo;
      if (!v) throw new ClipCutError('NO_VIDEO', 'Open a video first.');
      const start = Number(req && req.start);
      const end = Number(req && req.end);
      if (!Number.isFinite(start) || !Number.isFinite(end)) throw new ClipCutError('INVALID_RANGE', 'The start and end times are not valid numbers.');
      if (start < 0) throw new ClipCutError('INVALID_RANGE', 'The start time cannot be negative.');
      if (end > v.info.duration + 0.001) throw new ClipCutError('INVALID_RANGE', 'The end time is after the end of the video.');
      if (end - start < 0.01) throw new ClipCutError('INVALID_RANGE', 'The end time must be after the start time.');
      await fileService.validateVideoPath(v.path); // original still there and readable?

      const { job, promise } = ffmpegService.startTrim({
        inputPath: v.path,
        info: v.info,
        start,
        end: Math.min(end, v.info.duration),
        onEvent: (ev) => send('trim:event', ev)
      });
      state.activeTrim = job;
      try {
        const result = await promise;
        state.lastOutput = result.outputPath;
        return { ok: true, result };
      } finally {
        state.activeTrim = null;
      }
    } catch (e) {
      return { ok: false, error: toPlain(e) };
    }
  });

  ipcMain.handle('trim:cancel', () => {
    if (state.activeTrim) ffmpegService.cancelJob(state.activeTrim);
    return true;
  });
}

module.exports = { registerTrimHandlers };
