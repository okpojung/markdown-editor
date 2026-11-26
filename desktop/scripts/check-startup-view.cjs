'use strict';
const STARTUP_CASES=[];
for(const language of ['ko','en','ja','zh']){
 for(const left of ['md','outline'])for(const name of ['corner controls','close left','single view hides X','close right','close flushes pending input'])STARTUP_CASES.push({language,left,name,passed:true});
 for(const start of ['md','outline','rendered','split'])STARTUP_CASES.push({language,left:'shared',name:'saved startup '+start,passed:true});
 STARTUP_CASES.push({language,left:'shared',name:'about and accessible setting',passed:true});
}
for(const name of ['fresh default ignores previous view','invalid preference fallback'])STARTUP_CASES.push({language:'shared',left:'shared',name,passed:true});
function hasCompleteStartupView(report){const suite=report?.startupViewBrowser;if(report?.tests?.startupViewBrowser!==true||suite?.passed!==true||!Array.isArray(suite.cases)||suite.cases.length!==STARTUP_CASES.length)return false;const key=c=>JSON.stringify([c.language,c.left,c.name]);const remaining=new Set(STARTUP_CASES.map(key));for(const c of suite.cases){if(c?.passed!==true||!remaining.delete(key(c)))return false;}return remaining.size===0;}
function needsUpdates(version){const p=String(version).split('.').map(Number);return p[0]>1||(p[0]===1&&(p[1]>0||(p[1]===0&&p[2]>=8)));}
module.exports={STARTUP_CASES,hasCompleteStartupView,needsUpdates};
