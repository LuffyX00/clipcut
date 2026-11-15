'use strict';
const { ipcMain, shell } = require('electron');
const fs = require('fs');
const state = require('../state');
const fileService = require('../services/fileService');

function registerFileHandlers() {
  // Only the output produced by this app session can be revealed / opened. No arbitrary paths.
  ipcMain.handle('output:reveal', () => {
    if (!state.lastOutput || !fs.existsSync(state.lastOutput)) return { ok: false, message: 'The output file no longer exists.' };
    shell.showItemInFolder(state.lastOutput);
    return { ok: true };
  });

  ipcMain.handle('output:open', async () => {
    if (!state.lastOutput || !fs.existsSync(state.lastOutput)) return { ok: false, message: 'The output file no longer exists.' };
    const err = await shell.openPath(state.lastOutput);
    return err ? { ok: false, message: `Could not open the file with your default video player. ${err}` } : { ok: true };
  });

  ipcMain.handle('app:logPath', () => fileService.getLogPath());
}

module.exports = { registerFileHandlers };
