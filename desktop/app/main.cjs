'use strict';
const {app, BrowserWindow, Menu, dialog, ipcMain, protocol, shell} = require('electron');
const path = require('node:path');
const os = require('node:os');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const crypto = require('node:crypto');
const {fileURLToPath} = require('node:url');
const security = require('./security.cjs');
const diagnostics = require('./startup-diagnostics.cjs');
const normalArgs = process.argv.filter(a => a.startsWith('--ci-normal-'));
const normalRequested = normalArgs.length > 0;
const normalMode = process.argv.find(a => a.startsWith('--ci-normal-probe='))?.slice('--ci-normal-probe='.length);
const normalOutput = process.argv.find(a => a.startsWith('--ci-normal-output='))?.slice('--ci-normal-output='.length);
let normalProbe = false, normalFinished = false, normalRunning = false, normalTimer, readyTimer, editorLoaded = false, fatal = false;
function logStartup(event, error) {
  try { diagnostics.createLogger({directory:path.join(app.getPath('userData'),'diagnostics'),version:app.getVersion(),platform:process.platform})(event,error); } catch {}
}
function failStartup(event, error) {
  if (fatal || closing) return;
  fatal = true; clearTimeout(readyTimer);
  if (smoke) { void finishSmoke({ok:false,error:'Startup failed'}); return; }
  logStartup(event,error);
  if (normalProbe) { if (normalFinished) { closing = true; app.exit(1); return; } void finishNormal({ok:false,failure:diagnostics.record(event,app.getVersion(),process.platform,error)}); return; }
  const info = diagnostics.record(event,app.getVersion(),process.platform,error);
  let logHint = '사용자 프로필의 diagnostics/startup.log';
  try { logHint = path.join(app.getPath('userData'),'diagnostics','startup.log'); } catch {}
  try { dialog.showErrorBox('Markdown Editor 실행 실패','일반 실행을 완료하지 못했습니다. 앱을 종료합니다. 문서와 프로필은 삭제하지 않았습니다.\n진단 코드: '+info.event+'/'+info.code+'\n진단 로그(기록 가능한 경우): '+logHint); } catch {}
  closing = true; app.exit(1);
}
const APP_ROOT = __dirname;
const EDITOR = path.join(APP_ROOT, 'editor.html');
const smoke = process.argv.includes('--smoke-test');
const smokeArg = process.argv.find(a => a.startsWith('--smoke-output='));
const smokeOutput = smokeArg ? smokeArg.slice('--smoke-output='.length) : null;
let smokeUserData, smokeTimer, smokeFinished = false;
let mainWindow, capabilities, rendererReady = false, closing = false, closePrompt = false;
let state = {dirty: false, lang: 'ko'};
const pendingFiles = [];
const previews = new Map();
const STRINGS = {
  ko: {file:'파일', edit:'편집', view:'내보내기', new:'새 문서', open:'열기', save:'저장', saveas:'다른 이름으로 저장', close:'닫기', md:'md 파일 내보내기', offline:'md.html 파일 내보내기', encrypted:'md.html (암호화) 파일 내보내기', title:'저장하지 않은 변경 사항', message:'저장하지 않은 변경 사항을 버리고 닫을까요?', cancel:'취소', discard:'버리고 닫기', error:'파일 작업을 완료할 수 없습니다.'},
  en: {file:'File', edit:'Edit', view:'Export', new:'New', open:'Open', save:'Save', saveas:'Save As', close:'Close', md:'Export md file', offline:'Export md.html file', encrypted:'Export md.html (encrypted)', title:'Unsaved changes', message:'Discard unsaved changes and close?', cancel:'Cancel', discard:'Discard and close', error:'The file operation could not be completed.'},
  ja: {file:'ファイル', edit:'編集', view:'エクスポート', new:'新規', open:'開く', save:'保存', saveas:'名前を付けて保存', close:'閉じる', md:'mdファイルを書き出す', offline:'md.htmlファイルを書き出す', encrypted:'md.html（暗号化）を書き出す', title:'未保存の変更', message:'未保存の変更を破棄して閉じますか？', cancel:'キャンセル', discard:'破棄して閉じる', error:'ファイル操作を完了できませんでした。'},
  zh: {file:'文件', edit:'编辑', view:'导出', new:'新建', open:'打开', save:'保存', saveas:'另存为', close:'关闭', md:'导出md文件', offline:'导出md.html文件', encrypted:'导出md.html（加密）文件', title:'未保存的更改', message:'放弃未保存的更改并关闭？', cancel:'取消', discard:'放弃并关闭', error:'无法完成文件操作。'}
};
// Only disposable GitHub Actions accounts may mutate the default profile for probes.
if (normalRequested) {
  try {
    if (process.env.GITHUB_ACTIONS !== 'true' || smoke || normalArgs.length !== 2 || !['seed','restore'].includes(normalMode) || !normalOutput || !path.isAbsolute(normalOutput) || !normalOutput.endsWith('.json') || process.argv.some(a => /^--(?:user-data-dir|disable-gpu|disable-software-rasterizer|no-sandbox)(?:=|$)/.test(a))) throw new Error();
    const temporary = fs.realpathSync(os.tmpdir());
    const parent = fs.realpathSync(path.dirname(normalOutput));
    if (!diagnostics.inside(temporary,parent) || fs.existsSync(normalOutput)) throw new Error();
    normalProbe = true;
  } catch { app.exit(1); }
}
process.on('uncaughtException',error => failStartup('uncaughtException',error));
process.on('unhandledRejection',error => failStartup('unhandledRejection',error));
protocol.registerSchemesAsPrivileged([{scheme:'mde-preview', privileges:{standard:true, secure:true}}]);
if (smoke) {
  app.disableHardwareAcceleration();
  if (!smokeOutput || !path.isAbsolute(smokeOutput) || !path.resolve(smokeOutput).startsWith(path.resolve(os.tmpdir()) + path.sep)) app.exit(1);
  else { smokeUserData = fs.mkdtempSync(path.join(os.tmpdir(), 'mde-smoke-')); app.setPath('userData', smokeUserData); }
}
async function finishSmoke(report) {
  if (!smoke || smokeFinished) return;
  smokeFinished = true; clearTimeout(smokeTimer);
  let code = report && report.ok === true ? 0 : 1;
  if (report && report.ok === true && mainWindow && !mainWindow.isDestroyed()) {
    try { const capture = await mainWindow.webContents.capturePage(); await fsp.writeFile(smokeOutput.replace(/\.json$/i, '') + '.png', capture.toPNG(), {flag:'wx',mode:0o600}); }
    catch { report = {...report,screenshotWarning:'Capture unavailable'}; }
  }
  try {
    const output = { ...report, platform:process.platform, arch:process.arch, electron:process.versions.electron, appVersion:app.getVersion() };
    await fsp.writeFile(smokeOutput, JSON.stringify(output, null, 2), {encoding:'utf8', flag:'wx', mode:0o600});
  } catch { code = 1; }
  closing = true;
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.destroy();
  // Chromium can hold userData handles on Windows; cleanup is best-effort.
  if (smokeUserData) await fsp.rm(smokeUserData, {recursive:true, force:true}).catch(() => {});
  app.exit(code);
}
async function finishNormal(report) {
  if (!normalProbe || normalFinished) return;
  normalFinished = true; clearTimeout(readyTimer);
  let code = report.ok === true ? 0 : 1;
  try {
    const userData = fs.realpathSync(app.getPath('userData'));
    const outsideInstall = !diagnostics.inside(fs.realpathSync(path.dirname(process.execPath)),userData);
    const output = {...report,ok:report.ok === true && outsideInstall,phase:normalMode,appVersion:app.getVersion(),platform:process.platform,arch:process.arch,userDataHash:crypto.createHash('sha256').update(userData).digest('hex'),userDataOutsideInstall:outsideInstall,defaultPersistentProfile:true,gpuPolicy:'normal-default',visibleWindow:!!mainWindow?.isVisible()};
    if (!output.ok) code = 1;
    if (mainWindow && !mainWindow.isDestroyed()) {
      try { await mainWindow.webContents.session.flushStorageData(); } catch { output.ok = false; code = 1; }
      if (report.ok) {
        try { const capture = await mainWindow.webContents.capturePage(); await fsp.writeFile(normalOutput.replace(/\.json$/i,'')+'.png',capture.toPNG(),{flag:'wx',mode:0o600}); }
        catch { output.ok = false; code = 1; }
      }
    }
    await fsp.writeFile(normalOutput,JSON.stringify(output,null,2),{flag:'wx',mode:0o600});
  } catch { code = 1; }
  closing = true;
  process.exitCode = code;
  // Successful probes use normal quit so Chromium releases its persistent profile.
  if (code === 0) app.quit(); else app.exit(1);
}
async function runNormalProbe() {
  if (!normalProbe || normalRunning || normalFinished || fatal || !rendererReady || !editorLoaded) return;
  normalRunning = true;
  try {
    const fixture = '# CI normal startup probe\n\nSynthetic restart persistence check.\n';
    const script = normalMode === 'seed'
      ? '(() => { setMode("md"); setAll('+JSON.stringify(fixture)+',"api"); setLanguage("en"); updStatus(); return {markdown:md==='+JSON.stringify(fixture)+'&&cm.getValue()===md&&localStorage.getItem("mde.md")===md,language:uiLang==="en"&&localStorage.getItem("mde.lang")==="en"}; })()'
      : '(() => ({markdown:md==='+JSON.stringify(fixture)+'&&cm.getValue()===md&&localStorage.getItem("mde.md")===md,language:uiLang==="en"&&localStorage.getItem("mde.lang")==="en"}))()';
    const result = await mainWindow.webContents.executeJavaScript(script);
    if (result?.markdown !== true || result?.language !== true || !mainWindow.isVisible()) throw Object.assign(new Error(),{code:'PROBE_FAILED'});
    await finishNormal({ok:true,tests:{markdownPersisted:true,englishPersisted:true}});
  } catch (error) { failStartup('probe',error); }
}
function authorized(event) { if (!security.trustedSender(event, mainWindow, EDITOR)) throw new Error('Operation not permitted'); }
function handle(channel, fn) {
  ipcMain.handle('desktop:' + channel, async (event, ...args) => {
    try { authorized(event); return await fn(...args); } catch { throw new Error('Operation not permitted'); }
  });
}
function on(channel, fn) { ipcMain.on('desktop:' + channel, (event, ...args) => { try { authorized(event); fn(...args); } catch {} }); }
function send(channel, payload) { if (rendererReady && mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('desktop:' + channel, payload); }
function action(name) { if (name === 'close') mainWindow?.close(); else send('menu-action', name); }
async function queueFile(filename) {
  if (typeof filename !== 'string' || !path.isAbsolute(filename)) return;
  if (!rendererReady || !capabilities) { if (pendingFiles.length < 128) pendingFiles.push(filename); return; }
  try { const cap = await capabilities.grant(filename, 'read'); send('open-file', cap); } catch { if (!smoke && mainWindow && !mainWindow.isDestroyed()) dialog.showMessageBox(mainWindow, {type:'error', message:STRINGS[state.lang].error}).catch(() => {}); }
}
function argvFiles(argv) { return argv.filter(a => typeof a === 'string' && !a.startsWith('-') && path.isAbsolute(a) && security.OPEN_EXTENSIONS.has(path.extname(a).toLowerCase())); }
function installMenu() {
  const s = STRINGS[state.lang];
  const item = (key, accelerator) => ({label:s[key], accelerator, click:() => action(key)});
  const template = [
    ...(process.platform === 'darwin' ? [{label:app.name, submenu:[{role:'about'},{type:'separator'},{role:'hide'},{role:'hideOthers'},{role:'unhide'},{type:'separator'},{role:'quit'}]}] : []),
    {label:s.file, submenu:[item('new','CmdOrCtrl+N'), item('open','CmdOrCtrl+O'), item('save','CmdOrCtrl+S'), item('saveas','CmdOrCtrl+Shift+S'), {type:'separator'}, item('close','CmdOrCtrl+W')]},
    {label:s.edit, submenu:[{role:'undo'},{role:'redo'},{type:'separator'},{role:'cut'},{role:'copy'},{role:'paste'},{role:'selectAll'}]},
    {label:s.view, submenu:[item('md'),item('offline'),item('encrypted')]}
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}
async function confirmClose(event) {
  if (closing || !state.dirty) return;
  event.preventDefault(); if (closePrompt) return;
  closePrompt = true;
  try {
    const s = STRINGS[state.lang];
    const answer = await dialog.showMessageBox(mainWindow, {type:'warning', title:s.title, message:s.message, buttons:[s.cancel,s.discard], defaultId:0, cancelId:0, noLink:true});
    if (answer.response === 1 && mainWindow && !mainWindow.isDestroyed()) { closing = true; mainWindow.destroy(); }
  } finally { closePrompt = false; }
}
function setupIPC() {
  handle('pick-open', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {properties:['openFile','multiSelections'], filters:[{name:'Text / Markdown / HTML', extensions:['md','markdown','txt','html']}]});
    if (result.canceled) return null;
    const caps = [];
    for (const filename of result.filePaths) caps.push(await capabilities.grant(filename,'read'));
    return caps;
  });
  handle('read-file', id => capabilities.read(id, mainWindow.webContents.id));
  handle('pick-save', async input => {
    const options = security.saveOptions(input);
    const result = await dialog.showSaveDialog(mainWindow, {defaultPath:options.name, filters:[{name:'Document',extensions:options.extensions}], properties:['showOverwriteConfirmation','createDirectory']});
    if (result.canceled || !result.filePath) return null;
    if (!options.extensions.includes(path.extname(result.filePath).slice(1).toLowerCase())) throw new Error('Operation not permitted');
    return capabilities.grant(result.filePath,'write');
  });
  handle('write-file', (id,text) => capabilities.write(id,text,mainWindow.webContents.id));
  handle('read-asset', id => security.readAsset(APP_ROOT,id));
  handle('create-preview', html => {
    security.checkedText(html); const id = crypto.randomUUID();
    if (previews.size >= 64) previews.delete(previews.keys().next().value);
    previews.set(id,html); return 'mde-preview://content/' + id;
  });
  // Optional external navigation API accepts only explicit http/https schemes, never credentials or local protocols.
  handle('open-external', async value => { const url = security.safeExternalURL(value); if (!url) throw new Error('Operation not permitted'); await shell.openExternal(url); });
  on('report-state', value => {
    if (!value || typeof value.dirty !== 'boolean' || !Object.hasOwn(STRINGS,value.lang)) return;
    const changed = value.lang !== state.lang; state = {dirty:value.dirty,lang:value.lang};
    mainWindow.setDocumentEdited(state.dirty); if (changed) installMenu();
  });
  on('ready', () => { if (rendererReady) return; rendererReady = true; if (editorLoaded) clearTimeout(readyTimer); void runNormalProbe(); for (const filename of pendingFiles.splice(0)) void queueFile(filename); });
  on('smoke-report', report => {
    if (!smoke || !report || typeof report !== 'object' || Array.isArray(report)) return;
    try { if (Buffer.byteLength(JSON.stringify(report)) > 65536 || typeof report.ok !== 'boolean') return; void finishSmoke(report); } catch {}
  });
}
async function createWindow() {
  rendererReady = false; editorLoaded = false; closing = false; state = {dirty:false,lang:'ko'};
  mainWindow = new BrowserWindow({width:1440,height:960,minWidth:800,minHeight:600,show:!smoke,title:'Markdown Editor',icon:path.join(APP_ROOT,'icon.png'),webPreferences:{backgroundThrottling:!smoke,additionalArguments:smoke ? ['--mde-smoke-test'] : [],preload:path.join(APP_ROOT,'preload.cjs'),nodeIntegration:false,nodeIntegrationInSubFrames:false,nodeIntegrationInWorker:false,contextIsolation:true,sandbox:true,webSecurity:true,allowRunningInsecureContent:false,webviewTag:false,devTools:!app.isPackaged}});
  capabilities = new security.CapabilityStore(mainWindow.webContents.id);
  const wc = mainWindow.webContents;
  wc.session.setPermissionRequestHandler((_wc,_permission,callback) => callback(false));
  wc.session.setPermissionCheckHandler(() => false);
  wc.session.on('will-download', event => event.preventDefault());
  wc.session.webRequest.onHeadersReceived((details, callback) => {
    if (details.url.startsWith('file:')) callback({responseHeaders:{...details.responseHeaders,'Content-Security-Policy':[security.APP_CSP]}});
    else callback({});
  });
  wc.setWindowOpenHandler(({url}) => {
    const safe = security.safeExternalURL(url);
    if (safe) void shell.openExternal(safe).catch(() => {});
    return {action:'deny'};
  });
  wc.on('will-navigate', event => event.preventDefault());
  wc.on('will-frame-navigate', event => {
    if (event.isMainFrame || !security.previewId(event.url) || !previews.has(security.previewId(event.url))) event.preventDefault();
  });
  wc.on('will-redirect', event => event.preventDefault());
  wc.on('will-attach-webview', event => event.preventDefault());
  wc.on('will-prevent-unload', event => event.preventDefault());
  mainWindow.on('close', event => { void confirmClose(event).catch(() => {}); });
  mainWindow.on('closed', () => { closing = true; clearTimeout(readyTimer); capabilities?.clear(); previews.clear(); rendererReady = false; mainWindow = null; });
  wc.on('preload-error', (_event,_filename,error) => failStartup('preload-error',error));
  wc.on('render-process-gone', (_event,details) => {
    if (closing) return;
    const code = ({oom:'RENDERER_OOM',crashed:'RENDERER_CRASHED','launch-failed':'RENDERER_LAUNCH_FAILED','integrity-failure':'RENDERER_INTEGRITY_FAILED'})[details?.reason] || 'RENDERER_GONE';
    failStartup('render-process-gone',Object.assign(new Error(),{code}));
  });
  installMenu();
  try {
    await mainWindow.loadFile(EDITOR); editorLoaded = true;
    if (rendererReady) clearTimeout(readyTimer);
    void runNormalProbe();
  } catch (error) { failStartup('loadFile',error); }
}
app.on('open-file', (event, filename) => { event.preventDefault(); void queueFile(filename); });
if (!app.requestSingleInstanceLock()) app.exit(normalRequested ? 1 : 0);
else {
  app.on('second-instance', (_event,argv) => { for (const filename of argvFiles(argv)) void queueFile(filename); if (mainWindow) { if (mainWindow.isMinimized()) mainWindow.restore(); mainWindow.focus(); } });
  for (const filename of argvFiles(process.argv.slice(app.isPackaged ? 1 : 2))) pendingFiles.push(filename);
  if (!smoke) readyTimer = setTimeout(() => failStartup('readyTimeout',Object.assign(new Error(),{code:'READY_TIMEOUT'})),60000);
  if (normalProbe) normalTimer = setTimeout(() => {
    if (normalFinished) { closing = true; app.exit(1); }
    else failStartup('probeTimeout',Object.assign(new Error(),{code:'PROBE_TIMEOUT'}));
  },75000);
  app.whenReady().then(async () => {
    protocol.handle('mde-preview', request => {
      const id = security.previewId(request.url); const html = id && previews.get(id);
      if (typeof html !== 'string') return new Response('Not found',{status:404,headers:{'Content-Security-Policy':security.PREVIEW_CSP}});
      return new Response(html,{headers:{'Content-Type':'text/html; charset=utf-8','Content-Security-Policy':security.PREVIEW_CSP,'X-Content-Type-Options':'nosniff','Cache-Control':'no-store'}});
    });
    setupIPC();
    // Expanded locale and long-link UI suite only; normal startup timeout is unchanged.
    if (smoke) smokeTimer = setTimeout(() => { void finishSmoke({ok:false,error:'Smoke test timeout'}); },120000);
    await createWindow();
    app.on('activate', () => { if (!mainWindow && !fatal && !normalFinished) { if (!smoke) readyTimer = setTimeout(() => failStartup('readyTimeout',Object.assign(new Error(),{code:'READY_TIMEOUT'})),60000); void createWindow().catch(error => failStartup('startup',error)); } });
  }).catch(error => failStartup('startup',error));
  app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
}
