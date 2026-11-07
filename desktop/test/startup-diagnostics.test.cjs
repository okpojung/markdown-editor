'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {createLogger,record,inside,MAX_BYTES,FILE_BYTES} = require('../app/startup-diagnostics.cjs');
function temporary(t) { const dir = fs.mkdtempSync(path.join(os.tmpdir(),'mde-log-unit-')); t.after(() => fs.rmSync(dir,{recursive:true,force:true})); return dir; }
function logger(dir,extra={}) { return createLogger({directory:dir,version:'1.0.1',platform:'win32',...extra}); }
test('fixed metadata and allowlisted error fields only',t => {
  const dir = temporary(t);
  assert.equal(logger(dir)('loadFile',Object.assign(new TypeError('private document'),{code:'ENOENT'})),true);
  const logged = JSON.parse(fs.readFileSync(path.join(dir,'startup.log'),'utf8'));
  assert.match(logged.at,/^\d{4}-\d{2}-\d{2}T/); delete logged.at;
  assert.deepEqual(logged,{event:'loadFile',appVersion:'1.0.1',platform:'win32',name:'TypeError',code:'ENOENT'});
});
test('paths, tokens, console, document text and stack are never logged',t => {
  const dir = temporary(t), secret = 'C:\\Users\\Private\\token-secret-document';
  logger(dir)('preload-error',{name:secret,code:secret,message:secret,stack:secret,console:secret,toJSON(){throw new Error(secret);}});
  const text = fs.readFileSync(path.join(dir,'startup.log'),'utf8');
  assert.equal(text.includes(secret),false);
  assert.equal(JSON.parse(text).name,'UnknownError');
  assert.equal(JSON.parse(text).code,'UNKNOWN');
});
test('changing getters cannot bypass redaction',t => {
  const dir = temporary(t); let names = 0, codes = 0;
  const error = {get name(){ return ++names === 1 ? 'Error' : 'private-token'; },get code(){ return ++codes === 1 ? 'ENOENT' : 'private-token'; }};
  assert.equal(logger(dir)('startup',error),true);
  assert.equal(fs.readFileSync(path.join(dir,'startup.log'),'utf8').includes('private-token'),false);
});
test('untrusted metadata falls back to constants',() => {
  assert.deepEqual(record('/private/path','token-secret','private',{name:'CustomError',code:'custom-token'}),{event:'startup',appVersion:'unknown',platform:'unknown',name:'UnknownError',code:'UNKNOWN'});
});
test('throwing error getters cannot crash logging',t => {
  const dir = temporary(t), error = Object.defineProperties({}, {name:{get(){throw new Error();}},code:{get(){throw new Error();}}});
  assert.equal(logger(dir)('startup',error),true);
});
test('rotating two files together stays within 128 KiB',t => {
  const dir = temporary(t), log = logger(dir);
  for (let i=0;i<2500;i++) assert.equal(log('startup',new Error('discarded')),true);
  const sizes = fs.readdirSync(dir).map(n => fs.statSync(path.join(dir,n)).size);
  assert.equal(sizes.length,2);
  assert.ok(sizes.every(n => n <= FILE_BYTES));
  assert.ok(sizes.reduce((a,b)=>a+b,0) <= MAX_BYTES);
  for (const name of fs.readdirSync(dir)) for (const line of fs.readFileSync(path.join(dir,name),'utf8').trim().split('\n')) assert.equal(JSON.parse(line).event,'startup');
});
test('oversized pre-existing log is discarded instead of archived',t => {
  const dir = temporary(t);
  fs.writeFileSync(path.join(dir,'startup.log'),Buffer.alloc(MAX_BYTES*2));
  assert.equal(logger(dir)('startup',null),true);
  assert.ok(fs.statSync(path.join(dir,'startup.log')).size <= FILE_BYTES);
});
test('oversized old archive is bounded even before next rotation',t => {
  const dir = temporary(t);
  fs.writeFileSync(path.join(dir,'startup.log.1'),Buffer.alloc(MAX_BYTES*2));
  assert.equal(logger(dir)('startup',null),true);
  const bytes = fs.readdirSync(dir).reduce((sum,name) => sum+fs.statSync(path.join(dir,name)).size,0);
  assert.ok(bytes <= MAX_BYTES);
});
for (const operation of ['mkdirSync','statSync','unlinkSync','renameSync','appendFileSync']) {
  test('I/O failure is safe: '+operation,t => {
    const dir = temporary(t);
    fs.writeFileSync(path.join(dir,'startup.log'),Buffer.alloc(FILE_BYTES));
    const io = {...fs,[operation](){throw new Error('private path');}};
    let result;
    assert.doesNotThrow(() => { result = logger(dir,{io})('startup',new Error()); });
    assert.equal(result,false);
  });
}
test('inside rejects sibling prefix and parent traversal',() => {
  const parent = path.join(os.tmpdir(),'mde-parent');
  assert.equal(inside(parent,path.join(parent,'child')),true);
  assert.equal(inside(parent,parent+'-other'),false);
  assert.equal(inside(parent,path.dirname(parent)),false);
});
test('runNormal refuses non-CI execution before spawning or writing',async () => {
  const previous = process.env.GITHUB_ACTIONS;
  delete process.env.GITHUB_ACTIONS;
  try { assert.deepEqual(await require('../scripts/verify-normal.cjs').runNormal('/not-an-app'),{ok:false,error:'CI_ONLY'}); }
  finally { if (previous === undefined) delete process.env.GITHUB_ACTIONS; else process.env.GITHUB_ACTIONS = previous; }
});
