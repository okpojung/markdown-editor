'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const {hasCompleteRenderedTail} = require('../scripts/check-rendered-tail.cjs');
function fixture() {
  const cases = [];
  for (const language of ['ko','en','ja','zh']) for (const mode of ['rendered','split']) for (const fixture of ['table','code','mermaid','html']) cases.push({language,mode,fixture,passed:true});
  cases.push({fixture:'existing-paragraphs-and-idempotence',passed:true},{fixture:'undo-redo',passed:true});
  return {renderedTailBrowser:{passed:true,cases}};
}
test('all rendered tail cases are required', () => {
  assert.equal(hasCompleteRenderedTail(fixture()), true);
  assert.equal(hasCompleteRenderedTail({ok:true}), false);
  const r = fixture(); r.renderedTailBrowser.cases.pop();
  assert.equal(hasCompleteRenderedTail(r), false);
});
test('failed or duplicate cases cannot satisfy the contract', () => {
  const r = fixture(); r.renderedTailBrowser.cases[0].passed = false;
  assert.equal(hasCompleteRenderedTail(r), false);
  const d = fixture(); d.renderedTailBrowser.cases[1] = {...d.renderedTailBrowser.cases[0]};
  assert.equal(hasCompleteRenderedTail(d), false);
});
test('canonical editor and browser regression scripts parse', () => {
  const root = path.resolve(__dirname, '../..');
  const html = fs.readFileSync(path.join(root,'index.html'),'utf8');
  const script = html.match(/<script id="appMain">([\s\S]*?)<\/script>/)[1];
  assert.doesNotThrow(() => new vm.Script(script));
  assert.match(script, /plugins:\s*\[renderedTailPlugin\]/);
  assert.doesNotThrow(() => new vm.Script(fs.readFileSync(path.join(root,'tests/rendered-tail.browser.js'),'utf8')));
});
test('bundle and installer proof use the canonical source', () => {
  for (const file of ['bundle.cjs','verify-install.cjs']) {
    const text = fs.readFileSync(path.join(__dirname,'../scripts',file),'utf8');
    assert.ok(text.includes("path.join(root,'..','index.html')"));
    assert.ok(!text.includes("fs.readFile(path.join(root,'source/editor.html'))"));
  }
});
