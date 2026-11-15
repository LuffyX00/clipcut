'use strict';
const { app, BrowserWindow, protocol, shell, Menu } = require('electron');
const path = require('path');
const state = require('./state');
const fileService = require('./services/fileService');
const ffmpegService = require('./services/ffmpegService');
const { registerMediaProtocol } = require('./services/mediaProtocol');
const { registerVideoHandlers, stopThumbnails } = require('./ipc/videoHandlers');
const { registerTrimHandlers } = require('./ipc/trimHandlers');
const { registerFileHandlers } = require('./ipc/fileHandlers');

const isDev = process.env.CLIPCUT_DEV === '1';

protocol.registerSchemesAsPrivileged([
  { scheme: 'clipcut-media', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } }
]);

function createWindow() {
  const win = new BrowserWindow({
    width: 1320,
    height: 880,
    minWidth: 980,
    minHeight: 700,
    backgroundColor: '#0f131b',
    title: 'ClipCut',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true
    }
  });
  state.mainWindow = win;
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (e) => e.preventDefault());

  if (isDev) {
    win.loadURL('http://127.0.0.1:5173');
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }
  win.on('closed', () => { state.mainWindow = null; });
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (state.mainWindow) {
      if (state.mainWindow.isMinimized()) state.mainWindow.restore();
      state.mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    Menu.setApplicationMenu(null);
    fileService.init();
    registerMediaProtocol();
    registerVideoHandlers();
    registerTrimHandlers();
    registerFileHandlers();
    createWindow();
    app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
  });

  // Unexpected shutdown / quit while trimming: stop FFmpeg and remove incomplete files.
  app.on('before-quit', () => {
    ffmpegService.forceStopSync(state.activeTrim);
    stopThumbnails();
    fileService.cleanupTempSync();
  });

  app.on('window-all-closed', () => { app.quit(); });
}

process.on('uncaughtException', (err) => {
  fileService.log('error', `uncaughtException: ${err && err.stack ? err.stack : err}`);
});
process.on('exit', () => { ffmpegService.forceStopSync(state.activeTrim); });
