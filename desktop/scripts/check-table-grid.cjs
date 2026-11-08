'use strict';
function hasCompleteTableGrid(report) {
  const result=report?.tableGridBrowser;
  if(result?.passed!==true||!Array.isArray(result.cases)||result.cases.length!==52||result.cases.some(c=>c?.passed!==true))return false;
  const key=c=>c.language?[c.language,c.mode,c.target,c.rows,c.cols].join(':'):c.fixture;
  const keys=new Set(result.cases.map(key));
  if(keys.size!==52)return false;
  for(const language of ['ko','en','ja','zh'])for(const [mode,target] of [['md','src'],['rendered','ww'],['split','src'],['split','ww']])for(const [rows,cols] of [[1,1],[3,3],[8,10]])if(!keys.has([language,mode,target,rows,cols].join(':')))return false;
  return ['escape-cancel','keyboard-dimensions','existing-table-edit','advanced-options'].every(k=>keys.has(k));
}
module.exports={hasCompleteTableGrid};
