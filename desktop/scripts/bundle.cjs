'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const cp = require('node:child_process');
const sharp = require('sharp');
const root = path.resolve(__dirname, '..');
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
function replaceOnce(text, before, after) {
  if (text.split(before).length !== 2) throw new Error('Editor integration point changed: '+before.slice(0,70));
  return text.replace(before, after);
}
(async () => {
  const manifest = JSON.parse(await fs.readFile(path.join(root,'source/vendor-manifest.json'),'utf8'));
  const appDir = path.join(root,'app');
  await fs.mkdir(path.join(appDir,'vendor'),{recursive:true});
  for (const asset of manifest.assets) {
    if (!/^[a-zA-Z0-9_.-]+$/.test(asset.id) || asset.url !== 'vendor/'+asset.id) throw new Error('Invalid asset path');
    const response = await fetch(asset.downloadUrl);
    if (!response.ok) throw new Error('Dependency unavailable: '+asset.id+' '+response.status);
    const bytes = Buffer.from(await response.arrayBuffer());
    if (sha(bytes) !== asset.sha256) throw new Error('Dependency hash mismatch: '+asset.id);
    await fs.writeFile(path.join(appDir,asset.url),bytes);
  }
  await fs.writeFile(path.join(appDir,'vendor/manifest.json'),JSON.stringify(manifest,null,2));
  let html = await fs.readFile(path.join(root,'source/editor.html'),'utf8');
  const css = html.match(/<style id="appStyle">([\s\S]*?)<\/style>/)[1];
  const scriptMatch = html.match(/<script id="appMain">([\s\S]*?)<\/script>/);
  let js = scriptMatch[1];
  js = replaceOnce(js,'const APP_CSS = document.getElementById("appStyle").textContent;','const APP_CSS = window.desktopAppStyle || document.getElementById("appStyle").textContent;');
  js = replaceOnce(js,'const APP_JS = document.getElementById("appMain").textContent;','const APP_JS = window.desktopAppScript || document.getElementById("appMain").textContent;');
  js = replaceOnce(js,'async function libText(url) {','async function libText(url) {\n  if (window.desktopAPI && window.desktopAssetMap[url]) return window.desktopAPI.readAsset(window.desktopAssetMap[url]);');
  js = replaceOnce(js,'function updStatus() {','function updStatus() {\n  if (window.desktopAPI) window.desktopAPI.reportState({dirty: typeof DOC !== "undefined" && md !== DOC.saved, lang:uiLang});');
  js = replaceOnce(js,'function doClose() {','function doClose() {\n  if (window.desktopAPI) { window.close(); return; }');
  js = replaceOnce(js,'window.addEventListener("beforeunload", (e) => {','window.addEventListener("beforeunload", (e) => { if (window.desktopAPI) return;');
  js = replaceOnce(js,'console.warn(e); downloadText(data, nameFor(kind), type);','if (window.desktopAPI) { alert(tr("파일을 만들지 못했습니다: ")+e.message); return false; } console.warn(e); downloadText(data, nameFor(kind), type);');
  const previewLine = js.split('\n').find(l => l.includes('f.srcdoc = code +'));
  if (!previewLine) throw new Error('Missing HTML preview integration point');
  js = replaceOnce(js,previewLine,previewLine.replace('f.srcdoc =','const previewDocument =')+'\n    if (window.desktopAPI) window.desktopAPI.createPreview(previewDocument).then(url => { if (f.isConnected) f.src=url; }).catch(() => { f.title="Preview unavailable"; }); else f.srcdoc=previewDocument;');
  js += '\n'+await fs.readFile(path.join(root,'scripts/renderer-integration.txt'),'utf8');
  new Function(js);
  const assetMap = Object.fromEntries(manifest.assets.map(a => [a.sourceUrl,a.id]));
  const assetByUrl = new Map(manifest.assets.map(a => [a.sourceUrl,a]));
  const initialPrefix = html.slice(0,html.indexOf('<script id="appMain">'));
  const urls = [...new Set([...initialPrefix.matchAll(/data-lib-url="([^"]+)"/g)].map(m=>m[1]))];
  for (const url of urls) {
    const asset = assetByUrl.get(url);
    if (!asset) throw new Error('Unpinned dependency: '+url);
    html = html.replaceAll('src="'+url+'"','src="'+asset.url+'"').replaceAll('href="'+url+'"','href="'+asset.url+'"');
  }
  const mermaidUrl = js.match(/const MERMAID_URL = "([^"]+)";/)[1];
  const mermaidAsset = assetByUrl.get(mermaidUrl);
  if (!mermaidAsset) throw new Error('Mermaid not vendored');
  html = html.replace(/<style id="appStyle">[\s\S]*?<\/style>/,'<link rel="stylesheet" href="editor.css">');
  html = html.replace(scriptMatch[0],'<script data-lib-url="'+mermaidUrl+'" src="'+mermaidAsset.url+'"></script>\n<script src="asset-map.js"></script>\n<script src="renderer-adapter.js"></script>\n<script id="appMain" src="editor.js"></script>');
  html = html.replace('<meta charset="utf-8">','<meta charset="utf-8">\n<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'self\'; style-src \'self\' \'unsafe-inline\'; img-src \'self\' data: https:; font-src \'self\' data:; connect-src \'self\'; frame-src mde-preview:; worker-src \'self\' blob:; object-src \'none\'; base-uri \'none\'">');
  await fs.writeFile(path.join(appDir,'editor.html'),html);
  await fs.writeFile(path.join(appDir,'editor.css'),css);
  await fs.writeFile(path.join(appDir,'editor.js'),js);
  await fs.writeFile(path.join(appDir,'asset-map.js'),'window.desktopAssetMap=Object.freeze('+JSON.stringify(assetMap)+');\nwindow.desktopAppStyle='+JSON.stringify(css)+';\nwindow.desktopAppScript='+JSON.stringify(js)+';\n');
  await fs.copyFile(path.join(root,'source/LICENSE'),path.join(appDir,'LICENSE'));
  const logo = await fs.readFile(path.join(root,'source/logo.svg'));
  const png = await sharp(logo,{density:300}).resize(1024,1024,{fit:'contain',background:'#fafaf7'}).png().toBuffer();
  await fs.writeFile(path.join(root,'build/icon.png'),png);
  await fs.writeFile(path.join(appDir,'icon.png'),png);
  const icoModule = await import('png-to-ico');
  const icoFn = icoModule.default || icoModule;
  const icoInput = await sharp(png).resize(256,256).png().toBuffer();
  await fs.writeFile(path.join(root,'build/icon-256.png'),icoInput);
  await fs.writeFile(path.join(root,'build/icon.ico'),await icoFn(path.join(root,'build/icon-256.png')));
  if (process.platform === 'darwin') {
    const set = path.join(root,'build/icon.iconset'); await fs.mkdir(set,{recursive:true});
    for (const size of [16,32,128,256,512]) for (const scale of [1,2]) await sharp(png).resize(size*scale,size*scale).png().toFile(path.join(set,'icon_'+size+'x'+size+(scale===2?'@2x':'')+'.png'));
    cp.execFileSync('iconutil',['-c','icns',set,'-o',path.join(root,'build/icon.icns')]);
  }
  console.log(JSON.stringify({ok:true,sourceSha:sha(await fs.readFile(path.join(root,'source/editor.html'))),assets:manifest.assets.length,uiLanguages:4}));
})().catch(e=>{ console.error(e.message); process.exit(1); });
