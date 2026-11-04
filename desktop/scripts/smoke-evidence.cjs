'use strict';
const fs=require('node:fs/promises'),path=require('node:path');
async function preserveSmokeEvidence(output,label,directory=path.resolve(__dirname,'../proof')) {
 const safe=String(label||path.basename(output,'.json')).replace(/[^a-zA-Z0-9._-]/g,'_').replace(/^\.+/,'').slice(0,96)||'smoke';
 await fs.mkdir(directory,{recursive:true});const result={report:false,screenshot:false};
 for(const [source,target,key] of [[output,'failed-'+safe+'.json','report'],[output.replace(/\.json$/i,'')+'.png','failed-'+safe+'.png','screenshot']]){
  try{await fs.copyFile(source,path.join(directory,target));result[key]=true;}catch(e){if(e.code!=='ENOENT')result.copyError=e.code||'COPY_FAILED';}
 }
 return result;
}
module.exports={preserveSmokeEvidence};
