'use strict';
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process'),crypto=require('node:crypto');
const {run}=require('./smoke.cjs');
const {assertCiWindows,verifyWindowsInstall}=require('./verify-windows-install.cjs');
const root=path.resolve(__dirname,'..'),release=path.join(root,'release');
const exec=(command,args)=>new Promise((resolve,reject)=>{const p=cp.spawn(command,args,{stdio:'inherit'});p.on('error',reject);p.on('exit',code=>code===0?resolve():reject(new Error(command+' exited '+code)));});
(async()=>{
 if(process.platform==='win32')assertCiWindows();
 const files=(await fs.readdir(release)).filter(f=>/\.(exe|dmg|AppImage|deb)$/.test(f));
 if(!files.length)throw new Error('No installers created');
 const install=process.platform==='win32'?null:await fs.mkdtemp(path.join(os.tmpdir(),'mde-install-'));
 let binary, windowsResult, mounted=null, installedPackage=null;
 try {
  if(process.platform==='win32') {
   const installers=files.filter(f=>f.endsWith('.exe'));if(installers.length!==1)throw new Error('Expected one NSIS installer');
   windowsResult=await verifyWindowsInstall({root,installer:path.join(release,installers[0]),runSmoke:run,normalStartup:async(binary,scope)=>require('./verify-normal.cjs').runNormal(binary,'installed-'+scope)});
  }else if(process.platform==='darwin'){
   const dmg=path.join(release,files.find(f=>f.endsWith('.dmg')));await exec('hdiutil',['verify',dmg]);
   mounted=path.join(install,'mounted');await fs.mkdir(mounted);
   await exec('hdiutil',['attach',dmg,'-nobrowse','-readonly','-mountpoint',mounted]);
   await exec('ditto',[path.join(mounted,'Markdown Editor.app'),path.join(install,'Markdown Editor.app')]);
   await exec('codesign',['--verify','--deep','--strict',path.join(install,'Markdown Editor.app')]);
   binary=path.join(install,'Markdown Editor.app/Contents/MacOS/Markdown Editor');
  }else{
   const deb=path.join(release,files.find(f=>f.endsWith('.deb')));
   if((await fs.readFile(deb)).subarray(0,8).toString()!=='!<arch>\n')throw new Error('Invalid Debian package');
   await exec('sudo',['apt-get','install','-y',deb]);
   installedPackage=cp.execFileSync('dpkg-deb',['-f',deb,'Package'],{encoding:'utf8'}).trim();
   binary='/usr/bin/markdown-editor';
   const image=path.join(release,files.find(f=>f.endsWith('.AppImage')));
   if((await fs.readFile(image)).subarray(0,4).toString('hex')!=='7f454c46')throw new Error('Invalid AppImage');
  }
  const output=windowsResult?windowsResult.output:path.join(os.tmpdir(),'mde-installed-'+process.platform+'-'+process.arch+'-'+Date.now()+'.json');
  const report=windowsResult?windowsResult.report:await run(binary,[],output);
  await fs.mkdir(path.join(root,'proof'),{recursive:true});
  await fs.copyFile(output,path.join(root,'proof/smoke-installed.json'));
  try{await fs.copyFile(output.replace(/\.json$/,'.png'),path.join(root,'proof/smoke-installed.png'));}catch{}
  const metadata=[];
  for(const file of files){const b=await fs.readFile(path.join(release,file));metadata.push({file,bytes:b.length,sha256:crypto.createHash('sha256').update(b).digest('hex')});}
  const source=await fs.readFile(path.join(root,'source/editor.html'));
  const lock=await fs.readFile(path.join(root,'package-lock.json'));
  const proof={sourceCommit:process.env.GITHUB_SHA||null,runId:process.env.GITHUB_RUN_ID||null,runAttempt:process.env.GITHUB_RUN_ATTEMPT||null,platform:process.platform,arch:process.arch,electron:report.electron,appVersion:report.appVersion,installedSmokePassed:report.ok,installedSmoke:report,editorSha256:crypto.createHash('sha256').update(source).digest('hex'),lockSha256:crypto.createHash('sha256').update(lock).digest('hex'),signing:process.platform==='darwin'?'ad-hoc, not Developer ID signed or notarized':'not publisher-signed',linuxSmokeSandboxDisabled:process.platform==='linux',artifacts:metadata};
  if(windowsResult){proof.windowsInstallScopes=windowsResult.scopes;proof.installedNormalStartups=windowsResult.scopes.scopes.map(s=>({scope:s.scope,...s.normalStartup}));}
  await fs.writeFile(path.join(root,'proof/build-proof.json'),JSON.stringify(proof,null,2));
  await fs.writeFile(path.join(root,'proof/SHA256SUMS.txt'),metadata.map(a=>a.sha256+'  '+a.file).join('\n')+'\n');
  console.log(JSON.stringify(proof));
 }finally{
  if(mounted)await exec('hdiutil',['detach',mounted]).catch(()=>{});
  if(installedPackage)await exec('sudo',['dpkg','-r',installedPackage]).catch(()=>{});
  // Windows scope verifier owns confirmed uninstall and cleanup in its own finally block.
 }
})().catch(e=>{console.error(e.message);process.exit(1)});
