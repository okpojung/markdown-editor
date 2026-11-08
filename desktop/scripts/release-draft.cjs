'use strict';
// Importing this file performs no I/O, network calls or credential lookup.
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const {spawn} = require('node:child_process');
const {hasCompleteRenderedTail} = require('./check-rendered-tail.cjs');
const {hasCompleteTableGrid} = require('./check-table-grid.cjs');
const PLATFORMS = ['windows-x64','mac-intel-x64','mac-apple-arm64','linux-x64'];
const JOBS = ['lock','build (windows-2025, x64, win, windows-x64)','build (macos-15-intel, x64, mac, mac-intel-x64)','build (macos-15, arm64, mac, mac-apple-arm64)','build (ubuntu-24.04, x64, linux, linux-x64)'];
const fail = code => { throw new Error(code); };
function inputs(env) {
  const c = {runId:env.BUILD_RUN_ID, sha:env.SOURCE_SHA, version:env.VERSION, repo:env.GITHUB_REPOSITORY, trustedSha:env.GITHUB_SHA};
  if (!/^[1-9][0-9]{0,19}(?![\s\S])/.test(c.runId || '')) fail('INPUT_RUN_ID');
  if (!/^[0-9a-f]{40}(?![\s\S])/.test(c.sha || '') || !/^[0-9a-f]{40}(?![\s\S])/.test(c.trustedSha || '')) fail('INPUT_SHA');
  if (!/^(0|[1-9][0-9]{0,5})\.(0|[1-9][0-9]{0,5})\.(0|[1-9][0-9]{0,5})(?![\s\S])/.test(c.version || '')) fail('INPUT_VERSION');
  if (!/^[A-Za-z0-9][A-Za-z0-9-]{0,38}\/[A-Za-z0-9_.-]{1,100}(?![\s\S])/.test(c.repo || '') || c.repo.split('/')[1] === '..') fail('INPUT_REPO');
  if (env.GITHUB_ACTIONS !== 'true' || env.CI !== 'true' || env.GITHUB_EVENT_NAME !== 'workflow_dispatch' || env.GITHUB_REF !== 'refs/heads/main' || env.GITHUB_WORKFLOW_REF !== c.repo+'/.github/workflows/release-draft.yml@refs/heads/main' || env.GITHUB_WORKFLOW_SHA !== c.trustedSha) fail('TRUSTED_MAIN_ONLY');
  return Object.freeze(c);
}
function validateRun(c, run, jobs, candidate, trusted) {
  if (String(run?.id) !== c.runId || run?.repository?.full_name !== c.repo || run?.head_repository?.full_name !== c.repo || run.path !== '.github/workflows/desktop-build.yml' || run.head_sha !== c.sha || run.status !== 'completed' || run.conclusion !== 'success' || !Number.isSafeInteger(run.run_attempt) || run.run_attempt < 1) fail('BUILD_RUN');
  if (!Array.isArray(jobs) || jobs.length !== JOBS.length || new Set(jobs.map(j=>j.name)).size !== JOBS.length || jobs.some(j=>!JOBS.includes(j.name) || j.status !== 'completed' || j.conclusion !== 'success' || String(j.run_id) !== c.runId)) fail('BUILD_JOBS');
  if (candidate?.sha !== c.sha || trusted?.sha !== c.trustedSha || !/^[0-9a-f]{40}(?![\s\S])/.test(candidate?.commit?.tree?.sha || '') || candidate.commit.tree.sha !== trusted?.commit?.tree?.sha) fail('TRUSTED_TREE_MISMATCH');
}
function selectArtifacts(c, artifacts) {
  if (!Array.isArray(artifacts)) fail('ARTIFACT_LIST');
  return PLATFORMS.map(p=>{
    const matches = artifacts.filter(a=>a.name === 'markdown-editor-'+p);
    if (matches.length !== 1 || matches[0].expired !== false || !Number.isSafeInteger(matches[0].id) || matches[0].id < 1) fail('ARTIFACT_SELECTION');
    const a=matches[0];
    if (a.workflow_run && (String(a.workflow_run.id)!==c.runId || a.workflow_run.head_sha!==c.sha)) fail('ARTIFACT_SOURCE');
    return {name:a.name,id:a.id};
  });
}
function expectedFiles(version) {
  return [['win-x64.exe'],['mac-x64.dmg'],['mac-arm64.dmg'],['linux-amd64.deb','linux-x86_64.AppImage']].map(xs=>xs.map(x=>'MarkdownEditor-'+version+'-'+x));
}
function validateProof(c, proof, index) {
  const platform = ['win32','darwin','darwin','linux'][index], arch = index===2?'arm64':'x64';
  if (!proof || String(proof.runId)!==c.runId || proof.sourceCommit!==c.sha || proof.appVersion!==c.version || proof.platform!==platform || proof.arch!==arch || proof.installedSmokePassed!==true || proof.installedSmoke?.ok!==true || proof.installedSmoke?.appVersion!==c.version || !hasCompleteRenderedTail(proof.installedSmoke) || !hasCompleteTableGrid(proof.installedSmoke)) fail('BUILD_PROOF');
  const expected = expectedFiles(c.version)[index];
  if (!Array.isArray(proof.artifacts) || proof.artifacts.length!==expected.length || new Set(proof.artifacts.map(a=>a?.file)).size!==expected.length) fail('PROOF_ARTIFACTS');
  for (const a of proof.artifacts) if (!a || !expected.includes(a.file) || path.basename(a.file)!==a.file || !Number.isSafeInteger(a.bytes) || a.bytes<1 || !/^[0-9a-f]{64}(?![\s\S])/.test(a.sha256 || '')) fail('PROOF_ARTIFACTS');
  return {platform,arch,runId:c.runId,sourceCommit:c.sha,appVersion:c.version,installedSmokePassed:true,renderedTailCases:34,tableGridCases:52,artifacts:proof.artifacts.map(a=>({file:a.file,bytes:a.bytes,sha256:a.sha256}))};
}
function validateBytes(record, bytes) {
  if (record.bytes!==bytes.length || record.sha256!==crypto.createHash('sha256').update(bytes).digest('hex')) fail('INSTALLER_DIGEST');
}
function validateReleaseFiles(expected, actual) {
  if (!Array.isArray(actual) || actual.length!==expected.length || new Set(actual).size!==actual.length || actual.some(n=>!expected.includes(n))) fail('RELEASE_FILES');
}
function releaseArgs(c, directory) {
  return ['release','create','v'+c.version,'--repo',c.repo,'--draft','--target',c.sha,'--title','Markdown Editor '+c.version,'--notes-file',path.join(directory,'release-notes.txt'),...expectedFiles(c.version).flat().map(f=>path.join(directory,f)),path.join(directory,'SHA256SUMS.txt')];
}
async function api(token, endpoint, absent=false) {
  let response;
  try { response=await fetch('https://api.github.com'+endpoint,{headers:{Authorization:'Bearer '+token,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'},redirect:'error',signal:AbortSignal.timeout(30000)}); } catch { fail('API_TRANSPORT'); }
  if (absent) { if(response.status!==404) {await response.body?.cancel();fail('TAG_OR_RELEASE_EXISTS_OR_UNREADABLE');} await response.body?.cancel();return; }
  if (!response.ok) {await response.body?.cancel();fail('API_STATUS');}
  try {return await response.json();} catch {fail('API_JSON');}
}
async function pages(token, endpoint, key) {
  const all=[];
  for(let page=1;page<=100;page++) {const data=await api(token,endpoint+(endpoint.includes('?')?'&':'?')+'per_page=100&page='+page);const list=key==='__array'?data:data?.[key];if(!Array.isArray(list))fail('API_LIST');all.push(...list);if(list.length<100)return all;}
  fail('API_PAGE_LIMIT');
}
async function absent(c, token) {
  const base='/repos/'+c.repo;
  await api(token,base+'/git/ref/tags/v'+c.version,true);
  await api(token,base+'/releases/tags/v'+c.version,true);
  const releases=await pages(token,base+'/releases','__array');
  if(releases.some(r=>r.tag_name==='v'+c.version))fail('RELEASE_EXISTS');
}
async function preflight(c, token) {
  const base='/repos/'+c.repo;
  const run=await api(token,base+'/actions/runs/'+c.runId);
  const jobs=await pages(token,base+'/actions/runs/'+c.runId+'/jobs?filter=latest','jobs');
  const candidate=await api(token,base+'/commits/'+c.sha);
  const trusted=await api(token,base+'/commits/'+c.trustedSha);
  validateRun(c,run,jobs,candidate,trusted);
  const artifacts=selectArtifacts(c,await pages(token,base+'/actions/runs/'+c.runId+'/artifacts','artifacts'));
  await absent(c,token);
  return {runAttempt:run.run_attempt,artifacts};
}
async function regular(file) {const stat=await fs.lstat(file);if(!stat.isFile()||stat.isSymbolicLink())fail('NONREGULAR_FILE');}
async function directory(dir) {const stat=await fs.lstat(dir);if(!stat.isDirectory()||stat.isSymbolicLink())fail('NONREGULAR_DIRECTORY');}
async function rejectLinks(dir, allowedInstallers, inRelease=false, artifactRoot=dir) {
  await directory(dir);
  for(const item of await fs.readdir(dir,{withFileTypes:true})) {
    const file=path.join(dir,item.name);
    if(item.isSymbolicLink())fail('SYMLINK');
    if(item.isDirectory()) {if(inRelease)fail('NESTED_RELEASE_PATH');await rejectLinks(file,allowedInstallers,file===path.join(artifactRoot,'release'),artifactRoot);}
    else if(!item.isFile())fail('NONREGULAR_FILE');
    else if(/\.(exe|dmg|deb|appimage)(?![\s\S])/i.test(item.name) && (!inRelease || !allowedInstallers.includes(item.name)))fail('EXTRA_INSTALLER');
  }
}
async function verifyDownloads(c, inputDir, outputDir, runAttempt) {
  await directory(inputDir);
  validateReleaseFiles(PLATFORMS.map(p=>'markdown-editor-'+p),await fs.readdir(inputDir));
  const evidence=[], entries=[];
  for(let i=0;i<PLATFORMS.length;i++) {
    const dir=path.join(inputDir,'markdown-editor-'+PLATFORMS[i]), expected=expectedFiles(c.version)[i];
    await rejectLinks(dir,expected);
    const proofFile=path.join(dir,'proof','build-proof.json');await directory(path.dirname(proofFile));await regular(proofFile);
    let proof;try{proof=JSON.parse(await fs.readFile(proofFile,'utf8'));}catch{fail('PROOF_JSON');}
    const verified=validateProof(c,proof,i);
    if(String(proof.runAttempt)!==String(runAttempt))fail('PROOF_ATTEMPT');
    const release=path.join(dir,'release');await directory(release);
    validateReleaseFiles(expected,await fs.readdir(release));
    for(const a of verified.artifacts) {const file=path.join(release,a.file);await regular(file);const bytes=await fs.readFile(file);validateBytes(a,bytes);entries.push({record:a,bytes});}
    evidence.push(verified);
  }
  await fs.mkdir(outputDir);
  for(const entry of entries)await fs.writeFile(path.join(outputDir,entry.record.file),entry.bytes,{flag:'wx'});
  const sums=entries.map(e=>e.record.sha256+'  '+e.record.file).sort().join('\n')+'\n';
  await fs.writeFile(path.join(outputDir,'SHA256SUMS.txt'),sums,{flag:'wx'});
  await fs.writeFile(path.join(outputDir,'release-proof.json'),JSON.stringify({schemaVersion:1,buildRunId:c.runId,buildRunAttempt:runAttempt,sourceCommit:c.sha,trustedWorkflowCommit:c.trustedSha,appVersion:c.version,platforms:evidence},null,2)+'\n',{flag:'wx'});
  await fs.writeFile(path.join(outputDir,'release-notes.txt'),'Windows 설치파일은 미서명입니다. macOS는 ad-hoc 서명만 있으며 Developer ID 서명 및 공증은 없습니다. AppImage 실제 실행은 검증하지 않았으며 Linux 설치 실행 검증은 DEB 기준입니다.\n',{flag:'wx'});
}
async function createDraft(c, token, directory) {
  const cleanEnv={PATH:process.env.PATH,HOME:process.env.HOME,GH_CONFIG_DIR:path.join(directory,'gh-config'),GH_TOKEN:token,GH_HOST:'github.com',GH_PROMPT_DISABLED:'1',GH_NO_UPDATE_NOTIFIER:'1'};
  await new Promise((resolve,reject)=>{const child=spawn('gh',releaseArgs(c,directory),{shell:false,stdio:'ignore',env:cleanEnv});child.once('error',()=>reject(new Error('DRAFT_CREATE_FAILED')));child.once('exit',code=>code===0?resolve():reject(new Error('DRAFT_CREATE_FAILED')));});
  const matches=(await pages(token,'/repos/'+c.repo+'/releases','__array')).filter(r=>r.tag_name==='v'+c.version);
  if(matches.length!==1)fail('DRAFT_CONFIRMATION');
  const release=matches[0],expected=[...expectedFiles(c.version).flat(),'SHA256SUMS.txt'];
  if(release.draft!==true || release.target_commitish!==c.sha)fail('DRAFT_CONFIRMATION');
  validateReleaseFiles(expected,release.assets?.map(a=>a.name));
}
async function main() {
  const c=inputs(process.env),mode=process.argv[2];
  if(!['preflight','publish'].includes(mode))fail('MODE');
  const token=process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  if(typeof token!=='string'||!token)fail('CI_TOKEN_REQUIRED');
  const checked=await preflight(c,token);
  if(mode==='publish') {
    const base=process.env.RUNNER_TEMP;if(!base||!path.isAbsolute(base))fail('RUNNER_TEMP');
    const output=path.join(base,'markdown-release-draft');
    await verifyDownloads(c,path.join(base,'markdown-release-input'),output,checked.runAttempt);
    await absent(c,token);
    await createDraft(c,token,output);
  }
  console.log(mode==='preflight'?'Release preflight passed.':'Draft release created; not published.');
}
module.exports={inputs,validateRun,selectArtifacts,expectedFiles,validateProof,validateBytes,validateReleaseFiles,releaseArgs,verifyDownloads};
if(require.main===module)main().catch(()=>{console.error('Release draft stopped: validation, API or draft creation failed. No secrets or remote error bodies are logged.');process.exitCode=1;});
