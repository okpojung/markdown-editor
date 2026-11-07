'use strict';
const fs = require('node:fs');
const path = require('node:path');
const MAX_BYTES = 128 * 1024, FILE_BYTES = MAX_BYTES / 2;
const EVENTS = new Set(['startup','loadFile','preload-error','render-process-gone','readyTimeout','uncaughtException','unhandledRejection','probe','probeTimeout']);
const NAMES = new Set(['Error','TypeError','RangeError','ReferenceError','SyntaxError','URIError','EvalError','AggregateError']);
const CODES = new Set(['EACCES','EPERM','ENOENT','ENOSPC','EROFS','EIO','EMFILE','ETIMEDOUT','ERR_FAILED','ERR_FILE_NOT_FOUND','ERR_ACCESS_DENIED','ERR_ABORTED','ERR_NOT_IMPLEMENTED','ERR_INVALID_URL','ERR_TIMED_OUT','ERR_CONNECTION_REFUSED','ERR_INTERNET_DISCONNECTED','ERR_NETWORK_CHANGED','ERR_NAME_NOT_RESOLVED','RENDERER_GONE','RENDERER_OOM','RENDERER_CRASHED','RENDERER_LAUNCH_FAILED','RENDERER_INTEGRITY_FAILED','READY_TIMEOUT','PROBE_FAILED','PROBE_TIMEOUT']);
// Explicit allowlists only. No message, stack, console, arbitrary codes or caller objects.
function record(event, version, platform, error) {
  let name = 'UnknownError', code = 'UNKNOWN';
  try { const value = error?.name; if (NAMES.has(value)) name = value; } catch {}
  try { const value = error?.code; if (CODES.has(value)) code = value; } catch {}
  return {event:EVENTS.has(event)?event:'startup',appVersion:typeof version==='string' && /^\d{1,5}\.\d{1,5}\.\d{1,5}(?:-[a-zA-Z0-9.]{1,32})?$/.test(version)?version:'unknown',platform:['win32','darwin','linux'].includes(platform)?platform:'unknown',name,code};
}
function createLogger({directory, version, platform, io = fs}) {
  return (event, error) => {
    try {
      const filename = path.join(directory,'startup.log');
      const line = JSON.stringify({at:new Date().toISOString(),...record(event,version,platform,error)})+'\n';
      io.mkdirSync(directory,{recursive:true,mode:0o700});
      try { if (io.statSync(filename+'.1').size > FILE_BYTES) io.unlinkSync(filename+'.1'); } catch (e) { if (e.code !== 'ENOENT') return false; }
      let size = 0;
      try { size = io.statSync(filename).size; } catch (e) { if (e.code !== 'ENOENT') return false; }
      if (size + Buffer.byteLength(line) > FILE_BYTES) {
        try { io.unlinkSync(filename+'.1'); } catch (e) { if (e.code !== 'ENOENT') return false; }
        if (size > FILE_BYTES) io.unlinkSync(filename);
        else io.renameSync(filename,filename+'.1');
      }
      io.appendFileSync(filename,line,{encoding:'utf8',mode:0o600});
      return true;
    } catch { return false; }
  };
}
function inside(parent, target) {
  const relative = path.relative(path.resolve(parent),path.resolve(target));
  return relative === '' || (!relative.startsWith('..'+path.sep) && relative !== '..' && !path.isAbsolute(relative));
}
module.exports = {createLogger,record,inside,MAX_BYTES,FILE_BYTES};
