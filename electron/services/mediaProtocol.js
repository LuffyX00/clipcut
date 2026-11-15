'use strict';
const { protocol } = require('electron');
const fs = require('fs');
const path = require('path');
const { Readable } = require('stream');
const state = require('../state');

const MAX_CHUNK = 16 * 1024 * 1024; // answer open-ended range requests in 16 MB slices
const MIME = {
  '.mp4': 'video/mp4', '.m4v': 'video/mp4', '.mov': 'video/quicktime', '.webm': 'video/webm',
  '.mkv': 'video/x-matroska', '.avi': 'video/x-msvideo', '.flv': 'video/x-flv',
  '.mpg': 'video/mpeg', '.mpeg': 'video/mpeg', '.ts': 'video/mp2t', '.mts': 'video/mp2t',
  '.wmv': 'video/x-ms-wmv'
};

/**
 * Serves ONLY the currently opened video, by random token, with HTTP range support.
 * The file is streamed in slices from disk: it is never loaded into RAM.
 */
function registerMediaProtocol() {
  protocol.handle('clipcut-media', async (request) => {
    try {
      const token = new URL(request.url).pathname.replace(/^\/+/, '');
      const filePath = state.mediaTokens.get(token);
      if (!filePath) return new Response('Not found', { status: 404 });
      const { size } = await fs.promises.stat(filePath);
      const type = MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
      const headers = { 'Content-Type': type, 'Accept-Ranges': 'bytes' };
      let start = 0;
      let end = size - 1;
      let status = 200;
      const range = request.headers.get('range');
      if (range) {
        const m = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
        if (!m || (m[1] === '' && m[2] === '')) {
          return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } });
        }
        if (m[1] === '') {
          start = Math.max(0, size - Number(m[2]));
        } else {
          start = Number(m[1]);
          end = m[2] !== '' ? Math.min(Number(m[2]), size - 1) : Math.min(size - 1, start + MAX_CHUNK - 1);
        }
        if (start > end || start >= size) {
          return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } });
        }
        status = 206;
        headers['Content-Range'] = `bytes ${start}-${end}/${size}`;
      }
      headers['Content-Length'] = String(end - start + 1);
      const stream = fs.createReadStream(filePath, { start, end });
      return new Response(Readable.toWeb(stream), { status, headers });
    } catch (e) {
      return new Response('Error', { status: 500 });
    }
  });
}

module.exports = { registerMediaProtocol };
