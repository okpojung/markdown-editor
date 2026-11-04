'use strict';
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process');
const SCOPES=['currentuser','allusers'];
function assertCiWindows(platform=process.platform,env=process.env){
 if(platform!=='win32'||env.GITHUB_ACTIONS!=='true'||!env.GITHUB_RUN_ID||!env.RUNNER_TEMP)throw new Error('Installation verification restricted to GitHub Actions Windows; local installation prohibited');
}
function installArgs(scope){if(!SCOPES.includes(scope))throw new Error('Unknown scope');return ['/S','/'+scope];}
function within(file,root){if(!file||!root)return false;const rel=path.win32.relative(root,file);return rel!==''&&rel!=='..'&&!rel.startsWith('..\\')&&!path.win32.isAbsolute(rel);}
function validateEvidence(scope,state){
 const hive=scope==='allusers'?'HKLM':'HKCU',entries=state.registrations.filter(e=>e.hive===hive);
 if(entries.length!==1||state.registrations.some(e=>e.hive!==hive))throw new Error('Uninstall registration scope/count mismatch');
 const entry=entries[0],roots=scope==='allusers'?state.programFiles:[state.localPrograms];
 if(!entry.uninstallString||!roots.some(root=>within(entry.installLocation,root)))throw new Error('Unexpected default location or missing uninstall command');
 const target=path.win32.join(entry.installLocation,'Markdown Editor.exe').toLowerCase();
 const links=state.shortcuts.filter(e=>path.win32.normalize(e.target).toLowerCase()===target),expected=scope==='allusers'?'common':'user';
 if(!links.some(e=>e.scope===expected)||links.some(e=>e.scope!==expected))throw new Error('Start menu scope/target mismatch');
 return {registration:entry,installLocation:entry.installLocation,shortcuts:links};
}
function execute(file,args,timeout=180000,verbatim=false){return new Promise((resolve,reject)=>{
 let output='',done=false,overflow=false;
 const child=cp.spawn(file,args,{windowsHide:true,windowsVerbatimArguments:verbatim,argv0:verbatim?'"'+file+'"':undefined,stdio:['ignore','pipe','pipe'],env:{...process.env,ELECTRON_RUN_AS_NODE:undefined}});
 const finish=(error)=>{if(done)return;done=true;clearTimeout(timer);error?reject(error):resolve(output.trim());};
 const timer=setTimeout(()=>{if(child.pid){const killer=cp.spawn('taskkill.exe',['/PID',String(child.pid),'/T','/F'],{stdio:'ignore',windowsHide:true});killer.on('error',()=>{});}finish(new Error('Windows verification subprocess timeout'));},timeout);
 child.stdout.on('data',data=>{if(output.length<2097152)output+=data;else overflow=true;});
 child.stderr.on('data',()=>{}); // Never print raw errors, command arguments or environment.
 child.on('error',()=>finish(new Error('Windows verification subprocess failed to start')));
 child.on('exit',code=>{
  if(code===0&&!overflow){finish(null);return;}
  const error=new Error('Windows verification subprocess failed (exit '+code+')');
  try{const details=JSON.parse(output);if(details.ciError==='PS_INSPECTION_FAILED')error.ciDiagnostic={category:/^[a-zA-Z]{1,40}$/.test(details.category)?details.category:'Unknown',hresult:Number.isInteger(details.hresult)?details.hresult:null};}catch{}
  finish(error);
 });
});}
async function powershell(script){return execute('powershell.exe',['-NoLogo','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-EncodedCommand',Buffer.from("$ErrorActionPreference='Stop'; [Console]::OutputEncoding=New-Object System.Text.UTF8Encoding($false); try {\n"+script+"\n} catch { [pscustomobject]@{ciError='PS_INSPECTION_FAILED';category=[string]$_.CategoryInfo.Category;hresult=$_.Exception.HResult} | ConvertTo-Json -Compress; exit 1 }",'utf16le').toString('base64')]);}
async function inspect(){return JSON.parse(await powershell(String.raw`
$registrations=@();
foreach($hive in @('HKCU','HKLM')) { foreach($view in @('Registry64','Registry32')) {
 # HKCU uninstall keys are shared between WOW64 views on modern Windows.
 if($hive -eq 'HKCU' -and $view -eq 'Registry32'){continue}
 $h=if($hive -eq 'HKCU'){[Microsoft.Win32.RegistryHive]::CurrentUser}else{[Microsoft.Win32.RegistryHive]::LocalMachine};
 $base=[Microsoft.Win32.RegistryKey]::OpenBaseKey($h,[Microsoft.Win32.RegistryView]::$view);
 try { $uninstall=$base.OpenSubKey('Software\Microsoft\Windows\CurrentVersion\Uninstall');
  if($null -eq $uninstall){continue}
  try { foreach($name in $uninstall.GetSubKeyNames()) {
   $key=$uninstall.OpenSubKey($name);
   try { $display=[string]$key.GetValue('DisplayName');
    if($display -eq 'Markdown Editor' -or $display.StartsWith('Markdown Editor ')) {
     $registrations += [pscustomobject]@{hive=$hive;view=$view;key=$name;displayName=$display;installLocation=[string]$key.GetValue('InstallLocation');uninstallString=[string]$key.GetValue('UninstallString')}
    }
   } finally {$key.Dispose()}
  }} finally {$uninstall.Dispose()}
 } finally {$base.Dispose()}
}}
$shell=New-Object -ComObject WScript.Shell;$shortcuts=@();
foreach($kind in @('common','user')) {
 $folder=if($kind -eq 'common'){[Environment]::GetFolderPath('CommonPrograms')}else{[Environment]::GetFolderPath('Programs')};
 if(Test-Path -LiteralPath $folder) {foreach($file in Get-ChildItem -LiteralPath $folder -Filter 'Markdown Editor.lnk' -Recurse -File) {
  $shortcut=$shell.CreateShortcut($file.FullName);
  if($file.BaseName -eq 'Markdown Editor' -or [IO.Path]::GetFileName($shortcut.TargetPath) -eq 'Markdown Editor.exe') {
   $shortcuts += [pscustomobject]@{scope=$kind;path=$file.FullName;target=$shortcut.TargetPath}
  }
 }}
}
$roots=@(@($env:ProgramW6432,$env:ProgramFiles,[Environment]::GetEnvironmentVariable('ProgramFiles(x86)')) | Where-Object {$_} | Select-Object -Unique);
[pscustomobject]@{registrations=@($registrations);shortcuts=@($shortcuts);programFiles=$roots;localPrograms=(Join-Path $env:LOCALAPPDATA 'Programs')} | ConvertTo-Json -Depth 6 -Compress
`));}
async function exists(file){try{await fs.access(file);return true;}catch{return false;}}
async function waitUntil(check){const until=Date.now()+45000;do{if(await check())return;await new Promise(resolve=>setTimeout(resolve,500));}while(Date.now()<until);throw new Error('Uninstall cleanup incomplete');}
async function verifyWindowsInstall({root,installer,runSmoke,normalStartup}){
 assertCiWindows(); // Before any installation or filesystem mutation.
 if(JSON.parse(await powershell('([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator) | ConvertTo-Json -Compress'))!==true)throw new Error('Elevated Windows CI runner required');
 if((await fs.readFile(installer)).subarray(0,2).toString()!=='MZ')throw new Error('Invalid EXE');
 const proofDir=path.join(root,'proof');await fs.mkdir(proofDir,{recursive:true});
 const proof={schemaVersion:1,platform:'win32',runId:process.env.GITHUB_RUN_ID,scopes:[],ok:false,
  smokeLimitations:{temporaryUserData:true,hardwareAccelerationDisabled:true,normalInteractiveLaunchValidated:false,description:'Installed --smoke-test uses a temporary profile and disables GPU; it does not validate ordinary launch.'},
  standardLocalAccount:{status:'not-tested',passed:null,accountCreated:false,crossAccountLaunchValidated:false,userDataIsolationValidated:false,reason:'No standard account created. Different-account normal launch and per-account userData isolation have not been validated.'}};
 const save=()=>fs.writeFile(path.join(proofDir,'windows-install-scopes.json'),JSON.stringify(proof,null,2)+'\n');let last;
 try {
  const baseline=await inspect();
  if(baseline.registrations.length||baseline.shortcuts.length)throw new Error('Pre-existing installation/shortcut; refusing changes');
  for(const parent of [...baseline.programFiles,baseline.localPrograms])if(await exists(path.join(parent,'Markdown Editor')))throw new Error('Pre-existing default installation directory; refusing changes');
  for(const scope of SCOPES){
   const result={scope,stage:'install',installerArguments:installArgs(scope),status:'running',smokePassed:false,uninstall:{attempted:false,passed:false}};proof.scopes.push(result);await save();let location;
   try {
    await execute(installer,installArgs(scope));result.stage='registry-and-start-menu';
    let evidence,lastValidation;const installDeadline=Date.now()+15000;result.validationAttempts=0;
    do {
     result.validationAttempts++;
     try{const state=await inspect();result.observed=state;evidence=validateEvidence(scope,state);await save();break;}
     catch(error){lastValidation=error;if(error.ciDiagnostic)result.inspectionDiagnostic=error.ciDiagnostic;}
     await save();if(Date.now()<installDeadline)await new Promise(resolve=>setTimeout(resolve,500));
    }while(Date.now()<installDeadline);
    if(!evidence)throw lastValidation||new Error('Install validation incomplete');
    location=evidence.installLocation;
    Object.assign(result,evidence);result.stage='installed-binary';const binary=path.join(location,'Markdown Editor.exe');
    if(!await exists(binary))throw new Error('Installed binary missing');
    result.stage='installed-smoke';
    const output=path.join(os.tmpdir(),'mde-installed-win32-'+scope+'-'+Date.now()+'.json'),report=await runSmoke(binary,[],output);
    if(report.ok!==true)throw new Error('Installed smoke failed');
    result.smokePassed=true;result.smoke=report;
    await fs.copyFile(output,path.join(proofDir,'smoke-installed-'+scope+'.json'));
    await fs.copyFile(output.replace(/\.json$/,'.png'),path.join(proofDir,'smoke-installed-'+scope+'.png')).catch(()=>{});
    if(normalStartup){result.stage='normal-startup';result.normalStartup=await normalStartup(binary,scope);if(result.normalStartup.ok!==true)throw new Error('Normal startup did not pass');}
    last={report,output};result.status='passed';result.stage='verified';
   }catch(error){
    result.status='failed';
    result.failureCode=error.ciDiagnostic?'WINDOWS_INSPECTION_FAILED':({'Uninstall registration scope/count mismatch':'REGISTRY_SCOPE_MISMATCH','Unexpected default location or missing uninstall command':'INSTALL_LOCATION_MISMATCH','Start menu scope/target mismatch':'SHORTCUT_SCOPE_MISMATCH','Installed binary missing':'BINARY_MISSING','Installed smoke failed':'SMOKE_FAILED','Normal startup did not pass':'NORMAL_STARTUP_FAILED'})[error.message]||'CHECK_FAILED';
    throw new Error('Windows '+scope+' verification failed; inspect windows-install-scopes.json');
   }
   finally{
    result.uninstall.attempted=true;
    try{
     if(!location){const state=await inspect(),roots=scope==='allusers'?state.programFiles:[state.localPrograms];
      const entries=state.registrations.filter(e=>e.hive===(scope==='allusers'?'HKLM':'HKCU')&&roots.some(root=>within(e.installLocation,root)));
      if(entries.length===1)location=entries[0].installLocation;
      if(!location)for(const parent of roots){const candidate=path.join(parent,'Markdown Editor');if(await exists(candidate)){location=candidate;break;}}
     }
     if(!location)throw new Error('Installation not found for confirmed cleanup');
     const names=(await fs.readdir(location)).filter(name=>/^Uninstall.*\.exe$/i.test(name));if(names.length!==1)throw new Error('Missing/ambiguous uninstaller');
     // In-place NSIS avoids asynchronous TEMP copy. _?= must be last.
     await execute(path.join(location,names[0]),['/S','/'+scope,'_?='+location],180000,true);
     await waitUntil(async()=>{const state=await inspect(),files=await fs.readdir(location).catch(()=>[]);return !state.registrations.length&&!state.shortcuts.length&&files.every(name=>/^Uninstall.*\.exe$/i.test(name));});
     for(const name of await fs.readdir(location).catch(()=>[])){if(!/^Uninstall.*\.exe$/i.test(name))throw new Error('Residual installed files');await fs.unlink(path.join(location,name));}
     await fs.rmdir(location);result.uninstall.passed=true;
    }catch{result.status='failed';result.cleanupFailure=true;throw new Error('Windows '+scope+' uninstall/cleanup verification failed');}
    finally{await save();}
   }
  }
  proof.ok=proof.scopes.length===2&&proof.scopes.every(e=>e.status==='passed'&&e.uninstall.passed);
  proof.smokeLimitations.normalInteractiveLaunchValidated=proof.scopes.length===2&&proof.scopes.every(e=>e.normalStartup&&e.normalStartup.ok===true);
  if(!proof.ok)throw new Error('Windows scope verification incomplete');return {...last,scopes:proof};
 }finally{await save();}
}
module.exports={assertCiWindows,installArgs,within,validateEvidence,verifyWindowsInstall};
if(require.main===module){
 (async()=>{assertCiWindows();const root=path.resolve(__dirname,'..'),names=(await fs.readdir(path.join(root,'release'))).filter(name=>name.endsWith('.exe'));if(names.length!==1)throw new Error('Expected one NSIS installer');await verifyWindowsInstall({root,installer:path.join(root,'release',names[0]),runSmoke:require('./smoke.cjs').run});})().catch(()=>{console.error('Windows verification failed; inspect proof/windows-install-scopes.json');process.exitCode=1;});
}
