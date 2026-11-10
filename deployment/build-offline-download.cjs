'use strict';
// Build from the canonical editor and the desktop dependency manifest. No fallback to online HTML.
const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const digest=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const safeScript=text=>text.replace(/<\/script/gi,'<\\/script');
async function buildOfflineHtml({source,manifest,loadAsset,logo}){
  const appBlocks=[...source.matchAll(/<script id="appMain">([\s\S]*?)<\/script>/g)],main=appBlocks[0];
  if(appBlocks.length!==1)throw new Error('Canonical app script missing or duplicated');
  const prefix=source.slice(0,source.indexOf('<script id="appMain">'));
  const tags=[...prefix.matchAll(/<link\b[^>]*data-lib-url="([^"]+)"[^>]*>|<script\b[^>]*data-lib-url="([^"]+)"[^>]*>\s*<\/script>/gi)];
  const assets=new Map();
  for(const asset of manifest.assets){if(assets.has(asset.sourceUrl)||!/^[a-zA-Z0-9_.-]+$/.test(asset.id)||!/^[0-9a-f]{64}$/.test(asset.sha256))throw new Error('Invalid dependency manifest');assets.set(asset.sourceUrl,asset);}
  const mermaid=main[1].match(/const MERMAID_URL = "([^"]+)";/)?.[1];
  if(!mermaid||!assets.has(mermaid))throw new Error('Pinned Mermaid dependency missing');
  const report=[],cache=new Map();
  async function textFor(url){if(cache.has(url))return cache.get(url);const asset=assets.get(url);if(!asset)throw new Error('Unpinned dependency');const bytes=Buffer.from(await loadAsset(asset));if(digest(bytes)!==asset.sha256)throw new Error('Dependency hash mismatch: '+asset.id);const text=bytes.toString('utf8');cache.set(url,text);report.push({id:asset.id,sourceUrl:url,sha256:asset.sha256,bytes:bytes.length});return text;}
  let html=source;
  for(const match of tags){const url=match[1]||match[2],text=await textFor(url);const inline=match[1]?'<style data-lib-url="'+url+'">'+text.replace(/<\/style/gi,'<\\/style')+'</style>':'<script data-lib-url="'+url+'">'+safeScript(text)+'</script>';html=html.replace(match[0],()=>inline);}
  if(!tags.some(t=>(t[1]||t[2])===mermaid)){const text=await textFor(mermaid);html=html.replace('<script id="appMain">',()=>'<script data-lib-url="'+mermaid+'">'+safeScript(text)+'</script>\n<script id="appMain">');}
  if(logo)html=html.replace('href="assets/logo.svg"',()=> 'href="data:image/svg+xml;base64,'+Buffer.from(logo).toString('base64')+'"');
  const finalPrefix=html.slice(0,html.indexOf('<script id="appMain">'));
  if(/<(script|link)\b[^>]*(src|href)="https?:/i.test(finalPrefix))throw new Error('Remote dependency remained in offline download');
  return {html,report:{schemaVersion:1,canonicalHtmlSha256:digest(Buffer.from(source)),appMainSha256:digest(Buffer.from(main[1])),bytes:Buffer.byteLength(html),dependencies:report}};
}
async function main(){const root=path.resolve(__dirname,'..'),out=path.resolve(process.argv[2]||path.join(root,'offline-build'));
  const result=await buildOfflineHtml({source:await fs.readFile(path.join(root,'index.html'),'utf8'),manifest:JSON.parse(await fs.readFile(path.join(root,'desktop/source/vendor-manifest.json'),'utf8')),logo:await fs.readFile(path.join(root,'assets/logo.svg')),loadAsset:async asset=>{const url=new URL(asset.downloadUrl);if(url.protocol!=='https:'||!['cdn.jsdelivr.net','raw.githubusercontent.com'].includes(url.hostname))throw new Error('Unexpected dependency host');const response=await fetch(url,{redirect:'error',signal:AbortSignal.timeout(30000)});if(!response.ok)throw new Error('Dependency download failed: '+asset.id);return Buffer.from(await response.arrayBuffer());}});
  await fs.mkdir(out,{recursive:true});await fs.writeFile(path.join(out,'markdown-editor.html'),result.html);await fs.writeFile(path.join(out,'markdown-editor.build.json'),JSON.stringify(result.report,null,2));console.log(JSON.stringify({offline:true,bytes:result.report.bytes,dependencies:result.report.dependencies.length,canonicalHtmlSha256:result.report.canonicalHtmlSha256}));
}
if(require.main===module)main().catch(error=>{console.error(error.message);process.exitCode=1;});
module.exports={buildOfflineHtml};
