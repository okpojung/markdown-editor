'use strict';
const {contextBridge, ipcRenderer} = require('electron');
if (process.isMainFrame) {
  const invoke = (channel, ...args) => ipcRenderer.invoke('desktop:' + channel, ...args);
  const send = (channel, ...args) => ipcRenderer.send('desktop:' + channel, ...args);
  const subscribe = (channel, callback) => {
    if (typeof callback !== 'function') throw new TypeError('Callback required');
    const listener = (_event, value) => callback(value);
    ipcRenderer.on('desktop:' + channel, listener);
    return () => ipcRenderer.removeListener('desktop:' + channel, listener);
  };
  contextBridge.exposeInMainWorld('desktopAPI', Object.freeze({
    smokeTest:process.argv.includes('--mde-smoke-test'),
    getUpdateState:() => invoke('update-state'),
    checkForUpdates:() => invoke('update-check'),
    downloadUpdate:() => invoke('update-download'),
    installUpdate:() => invoke('update-install'),
    setAutoUpdate:value => invoke('update-preferences',value),
    onUpdateState:callback => subscribe('update-state',callback),
    pickOpen:() => invoke('pick-open'),
    readFile:id => invoke('read-file',id),
    pickSave:options => invoke('pick-save',options),
    writeFile:(id,text) => invoke('write-file',id,text),
    readAsset:id => invoke('read-asset',id),
    createPreview:html => invoke('create-preview',html),
    openExternal:url => invoke('open-external',url),
    reportState:value => send('report-state',value),
    ready:() => send('ready'),
    onOpenFile:callback => subscribe('open-file',callback),
    onMenuAction:callback => subscribe('menu-action',callback),
    smokeReport:report => send('smoke-report',report)
  }));
}
