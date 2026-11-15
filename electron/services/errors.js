'use strict';

class ClipCutError extends Error {
  constructor(code, message, details) {
    super(message);
    this.name = 'ClipCutError';
    this.code = code;
    this.details = details || null;
  }
}

function toPlain(err) {
  if (err instanceof ClipCutError) {
    return { code: err.code, message: err.message, details: err.details };
  }
  return {
    code: 'UNEXPECTED',
    message: 'Something unexpected went wrong. Technical details were saved to the ClipCut log file.',
    details: String((err && err.message) || err)
  };
}

module.exports = { ClipCutError, toPlain };
