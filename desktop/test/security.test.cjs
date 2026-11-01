'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const {pathToFileURL} = require('node:url');
const s = require('../app/security.cjs');
async function fixture(t) { const dir = await fs.mkdtemp(path.join(os.tmpdir(),'mde-security-')); t.after(() => fs.rm(dir,{recursive:true,force:true})); return dir; }
test('external URL scheme allowlist, credentials and control bytes', () => {
  assert.equal(s.safeExternalURL('https://example.com/a'),'https://example.com/a');
  assert.equal(s.safeExternalURL('http://localhost:8080/'),'http://localhost:8080/');
  for (const url of ['file:///etc/passwd','javascript:alert(1)','data:text/html,x','mde-preview://content/x','ftp://a.com','https://user:secret@example.com','https://example.com/\n',' https://example.com',null,{}]) assert.equal(s.safeExternalURL(url),null);
});
test('sender requires exact webContents, mainFrame and local editor', () => {
  const filename = path.resolve('editor.html'); const frame = {url:pathToFileURL(filename).href}; const wc = {mainFrame:frame}; const win = {webContents:wc,isDestroyed:() => false};
  assert.equal(s.trustedSender({sender:wc,senderFrame:frame},win,filename),true);
  assert.equal(s.trustedSender({sender:{},senderFrame:frame},win,filename),false);
  assert.equal(s.trustedSender({sender:wc,senderFrame:{url:frame.url}},win,filename),false);
  for (const query of ['?lang=ko','?lang=en-US','?locale=zh-Hant','?lang=ja_JP&locale=ja']) { frame.url = pathToFileURL(filename).href + query; assert.equal(s.trustedSender({sender:wc,senderFrame:frame},win,filename),true); }
  for (const query of ['?lang=fr','?smoke=1','?lang=ko&other=x','?lang=ko&lang=en','?locale=../../ko','?lang=']) { frame.url = pathToFileURL(filename).href + query; assert.equal(s.trustedSender({sender:wc,senderFrame:frame},win,filename),false); }
  for (const url of ['https://example.com/',pathToFileURL(filename).href+'?x=1',pathToFileURL(path.resolve('other.html')).href]) { frame.url = url; assert.equal(s.trustedSender({sender:wc,senderFrame:frame},win,filename),false); }
});
test('save names strip paths, reserved names, unsupported extensions', () => {
  assert.deepEqual(s.saveOptions({suggestedName:'../../report.exe',extensions:['md']}),{name:'report.md',extensions:['md']});
  assert.equal(s.saveOptions({suggestedName:'C:\\private\\CON.txt',extensions:['html']}).name,'_CON.html');
  assert.equal(s.saveOptions({suggestedName:'x.html',extensions:['md','html']}).name,'x.html');
  for (const extensions of [[],['exe'],['md','txt'],null,'md']) assert.throws(() => s.saveOptions({extensions}));
  assert.equal(s.saveOptions().name,'Untitled.md');
});
test('preview URL is strict UUID-only origin with no query or path traversal', () => {
  const id = crypto.randomUUID(); const url = 'mde-preview://content/'+id;
  assert.equal(s.previewId(url),id);
  for (const bad of [url+'?x=1',url+'#x',url+'/x','https://content/'+id,'mde-preview://evil/'+id,'mde-preview://user@content/'+id,'mde-preview://content/../../etc/passwd']) assert.equal(s.previewId(bad),null);
  assert.throws(() => s.assertToken('../../file')); assert.throws(() => s.assertToken({}));
});
test('UTF-8 byte bound rejects nonstrings and multibyte overflow', () => {
  assert.equal(s.checkedText('한글'),'한글'); assert.throws(() => s.checkedText(Buffer.from('x')));
  assert.throws(() => s.checkedText('한'.repeat(Math.floor(s.MAX_BYTES/3)+1)));
});
test('capabilities expose only id/name and enforce owner and ID boundaries', async t => {
  const dir = await fixture(t); const filename = path.join(dir,'note.md'); await fs.writeFile(filename,'한글');
  const store = new s.CapabilityStore(42); const cap = await store.grant(filename);
  assert.deepEqual(Object.keys(cap).sort(),['id','name']); assert.equal(cap.name,'note.md');
  const result = await store.read(cap.id,42); assert.equal(result.text,'한글'); assert.equal(result.size,6); assert.equal(result.type,'text/markdown'); assert.equal(typeof result.lastModified,'number');
  await assert.rejects(store.read(cap.id,43)); await assert.rejects(store.read('../../note.md',42)); await assert.rejects(store.read(crypto.randomUUID(),42));
  store.clear(); await assert.rejects(store.read(cap.id,42));
});
test('atomic write handles existing and new files without temporary leftovers', async t => {
  const dir = await fixture(t); const filename = path.join(dir,'note.md'); await fs.writeFile(filename,'original');
  const store = new s.CapabilityStore('owner'); const cap = await store.grant(filename);
  assert.deepEqual(await store.write(cap.id,'교체','owner'),{bytes:6}); assert.equal(await fs.readFile(filename,'utf8'),'교체');
  await assert.rejects(store.write(cap.id,{},'owner')); assert.equal(await fs.readFile(filename,'utf8'),'교체');
  const newCap = await store.grant(path.join(dir,'new.html'),'write'); await store.write(newCap.id,'<p>ok</p>','owner');
  assert.deepEqual((await fs.readdir(dir)).sort(),['new.html','note.md']);
});
test('extension and regular-file checks reject arbitrary or oversized files', async t => {
  const dir = await fixture(t); const store = new s.CapabilityStore(1);
  await fs.writeFile(path.join(dir,'bad.exe'),'x'); await assert.rejects(store.grant(path.join(dir,'bad.exe')));
  await assert.rejects(store.grant(path.join(dir,'bad.txt'),'write')); await assert.rejects(store.grant('relative.md'));
  const huge = path.join(dir,'huge.md'); await fs.writeFile(huge,''); await fs.truncate(huge,s.MAX_BYTES+1);
  await assert.rejects(store.grant(huge)); await assert.rejects(s.boundedRead(huge));
});
test('symlinks are rejected at grant and before writes', async t => {
  const dir = await fixture(t); const original = path.join(dir,'original.md'); const link = path.join(dir,'link.md'); await fs.writeFile(original,'preserve');
  try { await fs.symlink(original,link); } catch (e) { if (e.code === 'EPERM' || e.code === 'EACCES') { t.skip('OS symlink privilege unavailable'); return; } throw e; }
  const store = new s.CapabilityStore(1); await assert.rejects(store.grant(link));
  const selected = path.join(dir,'selected.md'); await fs.writeFile(selected,'selected'); const cap = await store.grant(selected); await fs.unlink(selected); await fs.symlink(original,selected);
  await assert.rejects(store.write(cap.id,'bad',1)); assert.equal(await fs.readFile(original,'utf8'),'preserve');
});
test('assets require manifest ID, local vendor path, and matching SHA-256', async t => {
  const dir = await fixture(t); await fs.mkdir(path.join(dir,'vendor'));
  const text = 'window.library = true;'; const sha256 = crypto.createHash('sha256').update(text).digest('hex');
  await fs.writeFile(path.join(dir,'vendor','lib.js'),text);
  const manifest = path.join(dir,'vendor','manifest.json');
  await fs.writeFile(manifest,JSON.stringify({assets:[{id:'lib.js',url:'vendor/lib.js',sha256}]}));
  assert.equal(await s.readAsset(dir,'lib.js'),text);
  for (const id of ['../lib.js','vendor/lib.js','unknown','lib..js']) await assert.rejects(s.readAsset(dir,id));
  await fs.writeFile(path.join(dir,'vendor','lib.js'),'tampered'); await assert.rejects(s.readAsset(dir,'lib.js'));
  for (const url of ['https://example.com/lib.js','vendor/../../outside.js','/vendor/lib.js']) { await fs.writeFile(manifest,JSON.stringify({assets:[{id:'lib.js',url,sha256}]})); await assert.rejects(s.readAsset(dir,'lib.js')); }
});
test('CSP separates app and untrusted preview execution', () => {
  assert.match(s.APP_CSP,/script-src 'self';/); assert.match(s.APP_CSP,/connect-src 'self';/);
  assert.match(s.PREVIEW_CSP,/connect-src 'none';/); assert.match(s.PREVIEW_CSP,/frame-src 'none';/); assert.match(s.PREVIEW_CSP,/sandbox allow-scripts/);
});
