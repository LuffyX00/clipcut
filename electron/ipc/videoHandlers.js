'use strict';
const { ipcMain, dialog } = require('electron');
const crypto = require('crypto');
const state = require('../state');
const fileService = require('../services/fileService');
const { checkTools, probeFile } = require('../services/ffprobeService');
const thumbnailService = require('../services/thumbnailService');
const { toPlain } = require('../services/errors');

const VIDEO_EXTENSIONS = ['mp4', 'mkv', 'mov', 'webm', 'avi', 'flv', 'mpg', 'mpeg', 'm4v', 'wmv', 'ts', 'mts', 'm2ts'];

function send(channel, payload) {
  const w = state.mainWindow;
  if (w && !w.isDestroyed()) w.webContents.send(channel, payload);
}

function stopThumbnails() {
  if (state.thumbnailJob) { state.thumbnailJob.cancel(); state.thumbnailJob = null; }
}

function registerVideoHandlers() {
  ipcMain.handle('tools:check', () => checkTools());

  ipcMain.handle('video:open', async () => {
    try {
      const res = await dialog.showOpenDialog(state.mainWindow, {
        title: 'Open video',
        properties: ['openFile'],
        filters: [
          { name: 'Video files', extensions: VIDEO_EXTENSIONS },
          { name: 'All files', extensions: ['*'] }
        ]
      });
      if (res.canceled || !res.filePaths.length) return { ok: true, canceled: true };
      const { path: abs } = await fileService.validateVideoPath(res.filePaths[0]);
      const info = await probeFile(abs);
      if (!info.video) {
        return { ok: false, error: { code: 'NO_VIDEO', message: 'This file has no video stream. ClipCut only trims videos.' } };
      }
      stopThumbnails();
      state.currentVideo = { path: abs, info };
      state.lastOutput = null;
      state.mediaTokens.clear();
      const token = crypto.randomUUID();
      state.mediaTokens.set(token, abs);
      fileService.log('info', `opened ${abs} (${info.container.formatName}, ${info.duration.toFixed(1)}s)`);
      return { ok: true, info, mediaUrl: `clipcut-media://video/${token}` };
    } catch (e) {
      fileService.log('error', `open failed: ${e && e.stack ? e.stack : e}`);
      return { ok: false, error: toPlain(e) };
    }
  });

  ipcMain.handle('thumbnails:start', async () => {
    const v = state.currentVideo;
    if (!v) return { ok: false };
    stopThumbnails();
    const jobId = ++state.thumbnailJobId;
    const count = thumbnailService.thumbnailCount(v.info.duration);
    try {
      const { job, times } = await thumbnailService.start({
        videoPath: v.path,
        duration: v.info.duration,
        count,
        onItem: (item) => send('thumbnails:item', { jobId, ...item })
      });
      state.thumbnailJob = job;
      return { ok: true, jobId, count, times };
    } catch (e) {
      fileService.log('error', `thumbnails failed: ${e}`);
      return { ok: false };
    }
  });

  ipcMain.handle('thumbnails:cancel', () => { stopThumbnails(); return true; });
}

module.exports = { registerVideoHandlers, stopThumbnails };
