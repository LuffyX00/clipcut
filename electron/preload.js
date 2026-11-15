'use strict';
// The ONLY bridge between the UI and the main process. No Node, no fs, no paths from the UI.
const { contextBridge, ipcRenderer } = require('electron');

function subscribe(channel, cb) {
  const handler = (_e, payload) => cb(payload);
  ipcRenderer.on(channel, handler);
  return () => ipcRenderer.removeListener(channel, handler);
}

contextBridge.exposeInMainWorld('clipcut', {
  checkTools: () => ipcRenderer.invoke('tools:check'),
  openVideo: () => ipcRenderer.invoke('video:open'),
  startThumbnails: () => ipcRenderer.invoke('thumbnails:start'),
  cancelThumbnails: () => ipcRenderer.invoke('thumbnails:cancel'),
  startTrim: (range) => ipcRenderer.invoke('trim:start', { start: Number(range.start), end: Number(range.end) }),
  cancelTrim: () => ipcRenderer.invoke('trim:cancel'),
  revealOutput: () => ipcRenderer.invoke('output:reveal'),
  openOutput: () => ipcRenderer.invoke('output:open'),
  getLogPath: () => ipcRenderer.invoke('app:logPath'),
  onThumbnail: (cb) => subscribe('thumbnails:item', cb),
  onTrimEvent: (cb) => subscribe('trim:event', cb)
});
