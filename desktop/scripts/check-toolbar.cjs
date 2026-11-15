'use strict';
const names=[];for(const target of ['src','ww'])for(const kind of ['ul','ol','task'])for(const test of ['empty marker','empty cancel','type after marker','toggle keeps text'])names.push(target+'/'+kind+'/'+test);names.push('split/default MD','split/outline left','split/close keeps rendered','split/content unchanged','toolbar/file first','toolbar/no duplicate close','toolbar/file close retained','toolbar/no wrap');
for(const kind of ['ul','ol','task'])for(const test of ['remove marker','keep parent'])names.push('nested/'+kind+'/'+test);
const TOOLBAR_CASES=['ko','en','ja','zh'].flatMap(language=>names.map(name=>({language,name,passed:true})));
function hasCompleteToolbar(report){const r=report?.toolbarBrowser;if(report?.tests?.toolbarBrowser!==true||r?.passed!==true||!Array.isArray(r.cases)||r.cases.length!==TOOLBAR_CASES.length)return false;const expected=new Set(TOOLBAR_CASES.map(c=>c.language+'\0'+c.name)),seen=new Set();for(const c of r.cases){const key=c?.language+'\0'+c?.name;if(c?.passed!==true||!expected.has(key)||seen.has(key))return false;seen.add(key);}return seen.size===expected.size;}
module.exports={hasCompleteToolbar,TOOLBAR_CASES};
