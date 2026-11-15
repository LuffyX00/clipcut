'use strict';
// Single place for main-process state. The renderer never sends file paths for
// processing: it can only act on the video that the user picked in the native dialog.
module.exports = {
  mainWindow: null,
  currentVideo: null, // { path, info }
  activeTrim: null,
  thumbnailJob: null,
  thumbnailJobId: 0,
  lastOutput: null,
  mediaTokens: new Map() // token -> absolute file path (current video only)
};
