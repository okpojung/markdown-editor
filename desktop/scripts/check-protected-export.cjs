'use strict';
const names=['three export menu choices','offline default and legacy online compatibility','encrypted full offline roundtrip','protected reopen resave and no storage','wrong password cancellation and fail closed','plaintext consent host preservation and document race'];
const expected=['ko','en','ja','zh'].flatMap(language=>names.map(name=>({language,name})));
function hasCompleteProtectedExport(report){const r=report?.protectedExportBrowser;if(r?.passed!==true||r.nativeFileRoundtrip!==true||!Array.isArray(r.cases)||r.cases.length!==expected.length||r.cases.some(c=>c?.passed!==true))return false;const keys=new Set(r.cases.map(c=>c.language+':'+c.name));return keys.size===expected.length&&expected.every(c=>keys.has(c.language+':'+c.name));}
module.exports={expected,hasCompleteProtectedExport};
