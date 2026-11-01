'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
test('editor baseline and native integration points exist',()=>{
 const s=fs.readFileSync(path.join(root,'source/editor.html'),'utf8');
 for(const marker of ['id="sUiLanguage"','function updStatus()','async function libText(url)','f.srcdoc = code +']) assert.ok(s.includes(marker),marker);
});
test('all offline dependencies are fixed and hashed',()=>{
 const m=JSON.parse(fs.readFileSync(path.join(root,'source/vendor-manifest.json')));
 assert.ok(m.assets.length>=40);
 for(const a of m.assets){assert.match(a.sha256,/^[a-f0-9]{64}$/);assert.equal(a.url,'vendor/'+a.id);assert.ok(a.downloadUrl.startsWith('https://'));assert.ok(!a.downloadUrl.includes('@main/'));assert.ok(!a.downloadUrl.includes('mermaid@11/'));}
});
