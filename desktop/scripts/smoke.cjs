'use strict';
const fs=require('node:fs/promises');
const path=require('node:path');
const os=require('node:os');
const cp=require('node:child_process');
const root=path.resolve(__dirname,'..');
async function run(executable,prefix,output) {
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'markdown-editor-smoke-'));
  const fixture=path.join(dir,'fixture.md');
  await fs.writeFile(fixture,'# Electron native file smoke test\n\nKeep Korean 한국어 / 日本語 / 中文 content.\n');
  const args=[...prefix,'--smoke-test','--smoke-output='+output,fixture];
  const command=process.platform==='linux'?'xvfb-run':executable;
  const commandArgs=process.platform==='linux'?['-a',executable,'--no-sandbox',...args]:args;
  await new Promise((resolve,reject)=>{
    const child=cp.spawn(command,commandArgs,{stdio:'inherit',env:{...process.env,ELECTRON_RUN_AS_NODE:undefined}});
    const timer=setTimeout(()=>{child.kill('SIGKILL');reject(new Error('Electron smoke timeout'));},100000);
    child.on('error',reject);child.on('exit',code=>{clearTimeout(timer);code===0?resolve():reject(new Error('Electron smoke exit '+code));});
  });
  const report=JSON.parse(await fs.readFile(output,'utf8'));
  if(!report.ok)throw new Error('Smoke reported failure: '+JSON.stringify(report));
  return report;
}
async function main(){
  const output=path.join(os.tmpdir(),'markdown-smoke-'+process.platform+'-'+process.arch+'-'+Date.now()+'.json');
  const executable=process.argv[2]||require('electron');
  const packaged=!!process.argv[2];
  const report=await run(executable,packaged?[]:[root],output);
  await fs.mkdir(path.join(root,'proof'),{recursive:true});
  const label=packaged?'packaged':'development';
  await fs.copyFile(output,path.join(root,'proof/smoke-'+label+'.json'));
  try{await fs.copyFile(output.replace(/\.json$/,'.png'),path.join(root,'proof/smoke-'+label+'.png'));}catch{}
  console.log(JSON.stringify({ok:true,label,platform:process.platform,arch:process.arch,report}));
}
if(require.main===module)main().catch(e=>{console.error(e.message);process.exit(1);});
module.exports={run};
