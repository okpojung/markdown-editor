'use strict';
// Offline tests: Node built-ins only. No installer or Windows account is created.
const {test}=require('node:test');
const fs=require('node:fs');
const {assertCiWindows,installArgs,within,validateEvidence,verifyWindowsInstall}=require('../scripts/verify-windows-install.cjs');
function check(value,message){if(!value)throw new Error(message||'Assertion failed');}
function rejects(fn){let threw=false;try{fn();}catch{threw=true;}check(threw,'Expected rejection');}
const pkg=JSON.parse(fs.readFileSync(__dirname+'/../package.json','utf8'));
function fixture(scope){const all=scope==='allusers',location=all?'C:\\Program Files\\Markdown Editor':'C:\\Users\\runner\\AppData\\Local\\Programs\\Markdown Editor';return {
 registrations:[{hive:all?'HKLM':'HKCU',installLocation:location,uninstallString:'uninstaller'}],
 programFiles:['C:\\Program Files','C:\\Program Files (x86)'],localPrograms:'C:\\Users\\runner\\AppData\\Local\\Programs',
 shortcuts:[{scope:all?'common':'user',target:location+'\\Markdown Editor.exe'}]
};}
test('assisted NSIS supports current-user and all-user choices without elevating app',()=>{
 const nsis=pkg.build.nsis;
 for(const [key,value] of Object.entries({oneClick:false,perMachine:false,allowElevation:true,selectPerMachineByDefault:true,packElevateHelper:true}))check(nsis[key]===value,'NSIS '+key);
 check(pkg.version==='1.0.5');check(pkg.build.win.requestedExecutionLevel==='asInvoker');check(nsis.runAfterFinish===false);
});
test('CI guard rejects local Windows, other OS and incomplete CI environment',()=>{
 const valid={GITHUB_ACTIONS:'true',GITHUB_RUN_ID:'123',RUNNER_TEMP:'C:\\Temp'};
 assertCiWindows('win32',valid);
 rejects(()=>assertCiWindows('linux',valid));rejects(()=>assertCiWindows('win32',{}));
 for(const key of Object.keys(valid)){const invalid={...valid};delete invalid[key];rejects(()=>assertCiWindows('win32',invalid));}
 rejects(()=>assertCiWindows('win32',{...valid,GITHUB_ACTIONS:'false'}));
});
test('both explicit scope switches leave default directory selection intact',()=>{
 for(const scope of ['currentuser','allusers'])check(JSON.stringify(installArgs(scope))===JSON.stringify(['/S','/'+scope]));
 rejects(()=>installArgs('machine'));check(!installArgs('allusers').some(a=>a.startsWith('/D=')));
});
test('Windows path boundary rejects prefix confusion and traversal',()=>{
 check(within('C:\\Program Files\\Markdown Editor','C:\\Program Files'));
 check(!within('C:\\Program Files-evil\\Markdown Editor','C:\\Program Files'));
 check(!within('C:\\Program Files\\..\\Users\\app','C:\\Program Files'));
 check(!within('D:\\app','C:\\Program Files'));check(!within('C:\\Program Files','C:\\Program Files'));
});
for(const scope of ['currentuser','allusers']){
 test(scope+' accepts correct registry, default root and shortcut target',()=>{check(validateEvidence(scope,fixture(scope)).registration.hive===(scope==='allusers'?'HKLM':'HKCU'));});
 test(scope+' rejects wrong hive and duplicate registrations',()=>{
  const a=fixture(scope);a.registrations[0].hive=scope==='allusers'?'HKCU':'HKLM';rejects(()=>validateEvidence(scope,a));
  const b=fixture(scope);b.registrations.push({...b.registrations[0]});rejects(()=>validateEvidence(scope,b));
 });
 test(scope+' rejects opposite-hive residue, wrong location and missing uninstaller',()=>{
  const a=fixture(scope);a.registrations.push({...a.registrations[0],hive:scope==='allusers'?'HKCU':'HKLM'});rejects(()=>validateEvidence(scope,a));
  const b=fixture(scope);b.registrations[0].installLocation='C:\\Temp\\Markdown Editor';rejects(()=>validateEvidence(scope,b));
  const c=fixture(scope);c.registrations[0].uninstallString='';rejects(()=>validateEvidence(scope,c));
 });
 test(scope+' rejects shortcut missing, opposite scope and wrong target',()=>{
  const a=fixture(scope);a.shortcuts=[];rejects(()=>validateEvidence(scope,a));
  const b=fixture(scope);b.shortcuts[0].scope=scope==='allusers'?'user':'common';rejects(()=>validateEvidence(scope,b));
  const c=fixture(scope);c.shortcuts[0].target='C:\\Wrong\\Markdown Editor.exe';rejects(()=>validateEvidence(scope,c));
 });
}
test('guard precedes all installation side effects and records validation limits',()=>{
 const source=fs.readFileSync(__dirname+'/../scripts/verify-windows-install.cjs','utf8');
 const implementation=verifyWindowsInstall.toString();check(implementation.indexOf('assertCiWindows();')<implementation.indexOf('await powershell('));
 check(source.includes("status:'not-tested',passed:null,accountCreated:false"));
 check(source.includes('temporaryUserData:true,hardwareAccelerationDisabled:true'));
 check(source.includes('finally{await save();}'));check(source.includes("result.uninstall.passed=true"));
 check(!source.includes('New-LocalUser'));check(!source.includes('net user'));
 const coordinator=fs.readFileSync(__dirname+'/../scripts/verify-install.cjs','utf8');
 for(const name of ['build-proof.json','SHA256SUMS.txt','smoke-installed.json','installedSmokePassed','installedSmoke:report','windowsInstallScopes'])check(coordinator.includes(name),name);
});

test('optional InstallLocation can be derived from the quoted NSIS uninstaller',()=>{
 for(const scope of ['currentuser','allusers']){
  const value=fixture(scope),location=value.registrations[0].installLocation;
  value.registrations[0].installLocation='';
  value.registrations[0].uninstallString='"'+location+'\\Uninstall Markdown Editor.exe" /'+scope;
  const observed=validateEvidence(scope,value);
  check(observed.installLocation===location);check(observed.registration.installLocationSource==='registry-uninstall-command');
 }
});
test('missing InstallLocation never executes or trusts arbitrary uninstall text',()=>{
 for(const command of ['cmd.exe /c anything','"C:\\Temp\\Uninstall Markdown Editor.exe" /currentuser','"C:\\Program Files\\Markdown Editor\\evil.exe"','"C:\\Program Files\\Markdown Editor\\Uninstall Markdown Editor.exe" & bad']){
  const value=fixture('allusers');value.registrations[0].installLocation='';value.registrations[0].uninstallString=command;rejects(()=>validateEvidence('allusers',value));
 }
});
