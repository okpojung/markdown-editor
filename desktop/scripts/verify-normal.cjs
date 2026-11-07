'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const cp = require('node:child_process');
const root = path.resolve(__dirname,'..');
// Never terminate by executable name: only this invocation's child tree/group.
function stopTree(child) {
  if (!child.pid || child.exitCode !== null || child.signalCode !== null) return;
  if (process.platform === 'win32') {
    const killer = cp.spawn('taskkill',['/PID',String(child.pid),'/T','/F'],{stdio:'ignore',windowsHide:true});
    killer.on('error',() => { try { child.kill('SIGKILL'); } catch {} });
  } else {
    try { process.kill(-child.pid,'SIGKILL'); } catch { try { child.kill('SIGKILL'); } catch {} }
  }
}
function launch(executable,args) {
  return new Promise(resolve => {
    let child, done = false, timedOut = false, timer, cleanupTimer;
    const finish = value => { if (done) return; done = true; clearTimeout(timer); clearTimeout(cleanupTimer); resolve(value); };
    try {
      child = cp.spawn(executable,args,{stdio:'ignore',env:{...process.env,ELECTRON_RUN_AS_NODE:undefined},detached:process.platform !== 'win32',windowsHide:false});
      timer = setTimeout(() => {
        timedOut = true; stopTree(child);
        cleanupTimer = setTimeout(() => finish({ok:false,error:'CHILD_TIMEOUT'}),10000);
      },100000);
      child.once('error',() => finish({ok:false,error:'CHILD_START_FAILED'}));
      child.once('close',(code,signal) => finish({ok:code === 0 && !timedOut,exitCode:code,signal:signal || null,...(timedOut?{error:'CHILD_TIMEOUT'}:{})}));
    } catch { finish({ok:false,error:'CHILD_START_FAILED'}); }
  });
}
async function runNormal(executable,label='installed') {
  if (process.env.GITHUB_ACTIONS !== 'true') return {ok:false,error:'CI_ONLY'};
  if (typeof executable !== 'string' || !path.isAbsolute(executable) || !/^[a-zA-Z0-9][a-zA-Z0-9-]{0,63}$/.test(label)) return {ok:false,error:'INVALID_INPUT'};
  let temporary;
  const phases = {};
  try {
    temporary = await fs.mkdtemp(path.join(os.tmpdir(),'mde-normal-'));
    await fs.mkdir(path.join(root,'proof'),{recursive:true});
    for (const phase of ['seed','restore']) {
      const output = path.join(temporary,phase+'.json');
      const evidence = path.join(root,'proof','normal-'+label+'-'+phase);
      // No GPU flags, profile override, smoke mode, or sandbox relaxation.
      const execution = await launch(executable,['--ci-normal-probe='+phase,'--ci-normal-output='+output]);
      let report = null, reportError = null, screenshot = false;
      try {
        const stat = await fs.stat(output);
        if (stat.size > 65536) throw new Error();
        await fs.copyFile(output,evidence+'.json'); // Preserve app failure reports too.
        report = JSON.parse(await fs.readFile(output,'utf8'));
      } catch { reportError = 'REPORT_MISSING_OR_INVALID'; }
      try { await fs.copyFile(output.replace(/\.json$/,'.png'),evidence+'.png'); screenshot = true; } catch {}
      const valid = report?.ok === true && report.phase === phase && report.defaultPersistentProfile === true && report.userDataOutsideInstall === true && report.gpuPolicy === 'normal-default' && report.visibleWindow === true && /^[a-f0-9]{64}$/.test(report.userDataHash || '') && report.tests?.markdownPersisted === true && report.tests?.englishPersisted === true;
      phases[phase] = {ok:execution.ok && valid && screenshot,execution,report,screenshot,...(reportError?{error:reportError}:{})};
      if (!report) await fs.writeFile(evidence+'.runner.json',JSON.stringify({ok:false,phase,execution,error:reportError},null,2));
    }
    const sameProfile = !!phases.seed.report?.userDataHash && phases.seed.report.userDataHash === phases.restore.report?.userDataHash;
    return {ok:phases.seed.ok && phases.restore.ok && sameProfile,label,sameProfile,gpuPolicy:'normal-default',gpuCompatibilityVerified:false,phases};
  } catch { return {ok:false,label,error:'NORMAL_VERIFICATION_FAILED',phases}; }
  finally { if (temporary) await fs.rm(temporary,{recursive:true,force:true}).catch(() => {}); }
}
if (require.main === module) runNormal(process.argv[2],process.argv[3] || 'installed').then(result => { console.log(JSON.stringify(result)); if (!result.ok) process.exitCode = 1; });
module.exports = {runNormal};
