'use strict';
// Native-only updater. Loading this module performs no network calls.
const path=require('node:path');
const {execFile}=require('node:child_process');
const FEED=Object.freeze({provider:'github',owner:'okpojung',repo:'markdown-editor',releaseType:'release'});
const PUBLISHER='HNG Life';
function stableVersion(v){return typeof v==='string'&&/^(0|[1-9][0-9]{0,5})\.(0|[1-9][0-9]{0,5})\.(0|[1-9][0-9]{0,5})(?![\s\S])/.test(v);}
function newer(a,b){if(!stableVersion(a)||!stableVersion(b))return false;const x=a.split('.').map(Number),y=b.split('.').map(Number);for(let i=0;i<3;i++){if(x[i]!==y[i])return x[i]>y[i];}return false;}
function trustedConfig(c){const names=Array.isArray(c?.publisherName)?c.publisherName:[c?.publisherName];return c?.provider===FEED.provider&&c.owner===FEED.owner&&c.repo===FEED.repo&&names.length===1&&names[0]===PUBLISHER;}
function verifyWindowsInstaller(filename,{run=execFile,systemRoot=process.env.SystemRoot||'C:\\Windows'}={}){
 if(typeof filename!=='string'||!path.win32.isAbsolute(filename)||!filename.toLowerCase().endsWith('.exe')||/[\r\n\0]/.test(filename))return Promise.reject(new Error('UPDATE_SIGNATURE'));
 const quoted=filename.replace(/'/g,"''");
 const command="$ErrorActionPreference='Stop'; [Console]::OutputEncoding=[System.Text.UTF8Encoding]::new($false); $OutputEncoding=[Console]::OutputEncoding; $s=Get-AuthenticodeSignature -LiteralPath '"+quoted+"'; [pscustomobject]@{ valid=($s.Status -eq [System.Management.Automation.SignatureStatus]::Valid); file=$s.Path; publisher=if($s.SignerCertificate){$s.SignerCertificate.GetNameInfo([System.Security.Cryptography.X509Certificates.X509NameType]::SimpleName,$false)}else{''} } | ConvertTo-Json -Compress";
 return new Promise((resolve,reject)=>run(path.win32.join(systemRoot,'System32','WindowsPowerShell','v1.0','powershell.exe'),['-NoLogo','-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(command,'utf16le').toString('base64')],{windowsHide:true,timeout:20000,maxBuffer:8192,shell:false},(error,stdout,stderr)=>{
  try{if(error||stderr)throw new Error();const r=JSON.parse(stdout);if(r.valid!==true||r.publisher!==PUBLISHER||typeof r.file!=='string'||path.win32.normalize(r.file).toLowerCase()!==path.win32.normalize(filename).toLowerCase())throw new Error();resolve(null);}catch{reject(new Error('UPDATE_SIGNATURE'));}
 }));
}
function createUpdateController({updater,currentVersion,config,supported,enabled=true,notify=()=>{},verify=verifyWindowsInstaller}){
 let status={phase:supported?(trustedConfig(config)&&updater?'idle':'signing-required'):'unsupported',currentVersion,autoDownload:enabled===true},candidate=null,file=null,checkTask=null,downloadTask=null,installTask=null,epoch=0;
 const available=supported&&!!updater&&trustedConfig(config)&&stableVersion(currentVersion);
 const snapshot=()=>({...status});
 const emit=(phase,extra={})=>{status={currentVersion,autoDownload:status.autoDownload,phase,...extra};try{notify(snapshot());}catch{}return snapshot();};
 const failed=()=>{candidate=null;file=null;return emit('error');};
 if(available){
  updater.autoDownload=false;updater.autoInstallOnAppQuit=false;updater.channel='latest';updater.allowPrerelease=false;updater.allowDowngrade=false;updater.disableWebInstaller=true;updater.disableDifferentialDownload=true;
  // The upstream verifier can skip failures on old PowerShell. This verifier never does.
  updater.verifyUpdateCodeSignature=(_publishers,filename)=>verify(filename);
  updater.logger={info(){},warn(){},debug(){},error(){}};
  updater.on('error',failed);
  updater.on('checking-for-update',()=>emit('checking'));
  updater.on('update-not-available',()=>{candidate=null;file=null;emit('up-to-date');});
  updater.on('update-available',info=>{if(!newer(info?.version,currentVersion)){failed();return;}candidate=info.version;emit('available',{version:candidate});});
  updater.on('download-progress',p=>{if(downloadTask&&candidate)emit('downloading',{version:candidate,percent:Math.max(0,Math.min(100,Number(p?.percent)||0))});});
  updater.on('update-downloaded',info=>{if(info?.version!==candidate||typeof info.downloadedFile!=='string'){failed();return;}file=info.downloadedFile;});
 }
 const download=()=>{
  if(!available||!candidate||installTask||status.phase==='installing')return Promise.resolve(snapshot());if(downloadTask)return downloadTask;
  const version=candidate,token=epoch;file=null;emit('downloading',{version,percent:0});
  downloadTask=(async()=>{try{await updater.downloadUpdate();if(token!==epoch||version!==candidate||!file)throw new Error();await verify(file);if(token!==epoch||version!==candidate)throw new Error();return emit('ready',{version});}catch{return failed();}finally{downloadTask=null;}})();return downloadTask;
 };
 const check=()=>{
  if(!available||downloadTask||installTask||status.phase==='ready'||status.phase==='installing')return Promise.resolve(snapshot());if(checkTask)return checkTask;
  epoch++;candidate=null;file=null;emit('checking');
  checkTask=(async()=>{try{await updater.checkForUpdates();if(candidate&&status.autoDownload)return await download();return snapshot();}catch{return failed();}finally{checkTask=null;}})();return checkTask;
 };
 const setEnabled=value=>{if(typeof value!=='boolean')throw new TypeError('Boolean required');status.autoDownload=value;notify(snapshot());return snapshot();};
 const install=(confirm,beforeQuit=async()=>true)=>{
  if(!available||status.phase!=='ready'||!file||typeof confirm!=='function')return Promise.resolve(false);if(installTask)return installTask;
  const installer=file,version=candidate;
  installTask=(async()=>{try{await verify(installer);if(!await confirm())return false;await verify(installer);if(typeof beforeQuit!=='function'||!await beforeQuit())return false;if(file!==installer||candidate!==version||status.phase!=='ready')return false;emit('installing',{version});updater.quitAndInstall(true,true);return true;}catch{failed();return false;}finally{installTask=null;}})();return installTask;
 };
 return Object.freeze({snapshot,check,download,setEnabled,install});
}
module.exports={FEED,PUBLISHER,stableVersion,newer,trustedConfig,verifyWindowsInstaller,createUpdateController};
