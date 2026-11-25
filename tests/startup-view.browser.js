/* Disposable fixture only. Native smoke or isolated local browser harness. */
async function runStartupViewRegression(){
 if(!window.MDE||(!window.desktopAPI?.smokeTest&&!$('#mdData')?.dataset.name?.startsWith('cursor-regression')))throw Error('Isolated startup-view fixture required');
 const pause=()=>new Promise(r=>setTimeout(r,0)),cases=[],before={text:md,mode,left:splitLeft,lang:uiLang,start:S.startMode,settings:SAFE_STORAGE.getItem('mde.settings'),legacy:SAFE_STORAGE.getItem('mde.mode'),saved:DOC.saved};
 const visible=b=>b.getClientRects().length>0;
 const check=(value,name,language='shared',left='shared')=>{if(!value)throw Error('Startup view '+language+'/'+left+'/'+name);cases.push({language,left,name,passed:true});};
 const seed=async left=>{MDE.ed.blur();MDE.setMarkdown('# Fixture\n\nBody\n\nTail');MDE.setSplitLeft(left);MDE.setMode('split');await pause();};
 try{
  for(const language of ['ko','en','ja','zh']){
   MDE.setLanguage(language,false);
   for(const left of ['md','outline']){
    await seed(left);const pane=$(left==='md'?'#srcPane':'#outPane'),close=pane.querySelector('[data-close-left]'),r=close.getBoundingClientRect(),p=pane.getBoundingClientRect();
    check(visible(close)&&visible($('#wwPane [data-close-right]'))&&r.right<=p.right&&p.right-r.right<30&&r.top-p.top<65,'corner controls',language,left);
    close.click();await pause();check(mode==='rendered'&&visible($('#wwPane'))&&!visible(pane),'close left',language,left);
    check([...document.querySelectorAll('.pane-close')].every(b=>!visible(b)),'single view hides X',language,left);
    await seed(left);$('#wwPane [data-close-right]').click();await pause();check(mode===left&&visible(pane)&&!visible($('#wwPane'))&&[...document.querySelectorAll('.pane-close')].every(b=>!visible(b)),'close right',language,left);
    await seed(left);let expected;
    if(left==='md'){lastFocus='src';MDE.cm.replaceRange(' pending',{line:2,ch:4});expected='# Fixture\n\nBody pending\n\nTail';}
    else{const row=$('#outline .row[data-line="2"]');row._edit(false);const tx=row.querySelector('.tx');tx.textContent='Body pending';tx.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText',data:'Body pending'}));expected='# Fixture\n\nBody pending\n\nTail';}
    $('#wwPane [data-close-right]').click();await pause();check(md===expected&&MDE.cm.getValue()===expected,'close flushes pending input',language,left);
   }
   MDE.setMode('rendered');
   for(const start of ['md','outline','rendered','split']){drawSettings();const field=$('#sStartMode');field.value=start;field.dispatchEvent(new Event('change',{bubbles:true}));SAFE_STORAGE.setItem('mde.mode','md');check(S.startMode===start&&loadSettings().startMode===start&&mode==='rendered','saved startup '+start,language);}
   drawSettings();check($('#sVersion').textContent==='1.0.8'&&$('#sWebsite').href==='https://md-editor.baro.me/'&&$('#sStartMode').getAttribute('aria-describedby')==='sStartModeHint','about and accessible setting',language);
  }
  SAFE_STORAGE.setItem('mde.settings','{}');SAFE_STORAGE.setItem('mde.mode','split');check(loadSettings().startMode==='rendered','fresh default ignores previous view');
  let invalid=true;for(const value of [null,'bad','split\n',{},1]){SAFE_STORAGE.setItem('mde.settings',JSON.stringify({startMode:value}));invalid=invalid&&loadSettings().startMode==='rendered';}check(invalid&&normalizeStartMode('outline')==='outline','invalid preference fallback');
 }finally{
  cancelOutlineModelEdit();S.startMode=before.start;SAFE_STORAGE.setItem('mde.settings',before.settings===null?'{}':before.settings);SAFE_STORAGE.setItem('mde.mode',before.legacy===null?'':before.legacy);MDE.setLanguage(before.lang,false);MDE.setSplitLeft(before.left);MDE.setMarkdown(before.text);MDE.setMode(before.mode);DOC.saved=before.saved;updStatus();
  // Let deferred outline selection/focus restoration settle before another suite.
  await new Promise(resolve=>setTimeout(resolve,450));
 }
 return {passed:true,cases};
}
