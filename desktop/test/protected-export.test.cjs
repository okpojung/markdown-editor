'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{webcrypto,randomBytes}=require('node:crypto');
const source=fs.readFileSync(path.resolve(__dirname,'../../index.html'),'utf8');
const start='/* MDE_PROTECTED_HTML_START */',end='/* MDE_PROTECTED_HTML_END */';
const moduleSource=source.slice(source.indexOf(start)+start.length,source.indexOf(end));
const ctx=vm.createContext({window:{},crypto:webcrypto,TextEncoder,TextDecoder,Uint8Array,atob,btoa});
vm.runInContext(moduleSource,ctx);
const api=ctx.window.EmmEncryptedHtml,codec=api.createHtmlCrypto();
const password=()=>String.fromCharCode(65,55)+randomBytes(20).toString('hex');
const text='<html><body><textarea id="mdData">한국어 日本語 中文 &amp; offline</textarea></body></html>';
const clone=value=>JSON.parse(JSON.stringify(value));
async function independentKey(secret,salt,usage){const material=await webcrypto.subtle.importKey('raw',new TextEncoder().encode(secret),'PBKDF2',false,['deriveKey']);return webcrypto.subtle.deriveKey({name:'PBKDF2',hash:'SHA-256',iterations:600000,salt},material,{name:'AES-GCM',length:256},false,[usage]);}
const aad=kind=>new TextEncoder().encode(JSON.stringify(['emm-protected-html',1,kind,'PBKDF2-SHA256',600000,'AES-256-GCM']));
test('shared editor and native menu expose exactly the three requested export choices',()=>{
  assert(source.includes('data-act="md"'));assert(source.includes('data-act="offline"'));assert(source.includes('data-act="encrypted"'));assert(!source.includes('data-act="online"'));
  const native=fs.readFileSync(path.resolve(__dirname,'../app/main.cjs'),'utf8');assert(native.includes("item('md'),item('offline'),item('encrypted')"));assert(!native.includes("item('online')"));
});
test('complete editor script and crypto runtime parse without execution',()=>{new vm.Script(source.match(/<script id="appMain">([\s\S]*?)<\/script>/)[1]);assert.equal(typeof api.encryptStandaloneHtml,'function');assert.equal(typeof api.decryptStandaloneHtml,'function');});
test('EMM password categories and Unicode codepoint length are preserved',()=>{
  assert(codec.passwordValidationError('a'.repeat(7)));assert(codec.passwordValidationError('Aa'.repeat(5)));assert(codec.passwordValidationError('a'.repeat(8)+' '));
  assert.equal(codec.passwordValidationError('한'.repeat(7)+'7'),null);assert.equal(codec.passwordValidationError('a'.repeat(7)+'!'),null);assert.equal(codec.passwordValidationError('a'.repeat(255)+'7'),null);assert(codec.passwordValidationError('a'.repeat(256)+'7'));
});
test('WebCrypto roundtrip preserves UTF-8 and randomizes salt and IV',async()=>{
  const p=password(),a=await codec.encrypt(text,p,'markdown'),b=await codec.encrypt(text,p,'markdown');assert.equal(a.format,'emm-protected-html');assert.equal(a.iterations,600000);assert.equal(Buffer.from(a.salt,'base64').length,16);assert.equal(Buffer.from(a.iv,'base64').length,12);assert.notEqual(a.salt,b.salt);assert.notEqual(a.iv,b.iv);assert.equal((await codec.decrypt(a,p)).html,text);
});
test('independent EMM v1 wire implementation decrypts this output and vice versa',async()=>{
  const p=password(),e=await codec.encrypt(text,p,'markdown');const k=await independentKey(p,Buffer.from(e.salt,'base64'),'decrypt');const decoded=await webcrypto.subtle.decrypt({name:'AES-GCM',iv:Buffer.from(e.iv,'base64'),additionalData:aad('markdown'),tagLength:128},k,Buffer.from(e.data,'base64'));assert.equal(new TextDecoder().decode(decoded),text);
  const salt=randomBytes(16),iv=randomBytes(12),key=await independentKey(p,salt,'encrypt'),data=await webcrypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:aad('markdown'),tagLength:128},key,new TextEncoder().encode(text));const other={format:'emm-protected-html',version:1,kind:'markdown',kdf:'PBKDF2-SHA256',cipher:'AES-256-GCM',iterations:600000,salt:salt.toString('base64'),iv:iv.toString('base64'),data:Buffer.from(data).toString('base64')};assert.equal((await codec.decrypt(other,p)).html,text);
});
test('wrong password and changed kind, salt, IV, or ciphertext fail authentication',async()=>{
  const p=password(),e=await codec.encrypt(text,p,'markdown');await assert.rejects(codec.decrypt(e,password()));
  for(const key of ['kind','salt','iv','data']){const changed=clone(e);if(key==='kind')changed.kind='map';else{const b=Buffer.from(changed[key],'base64');b[0]^=1;changed[key]=b.toString('base64');}await assert.rejects(codec.decrypt(changed,p));}
});
test('schema rejects algorithm, iteration, version, field and malformed-base64 changes',async()=>{
  const e=await codec.encrypt(text,password(),'markdown');for(const [key,value] of [['version',2],['iterations',1],['cipher','AES-128-GCM'],['kdf','PBKDF2-SHA1'],['salt','!'],['iv','AA=='],['extra',true],['data','abcd!===']]){const changed=clone(e);changed[key]=value;assert.throws(()=>codec.validate(changed));}
});
test('locked HTML contains ciphertext but no document or password and keeps an opaque sandbox',async()=>{
  const p=password(),html=await api.encryptStandaloneHtml(text,p,'markdown','ko');assert(!html.includes(text));assert(!html.includes(p));assert(html.includes('id="emm-encrypted-payload"'));assert(html.includes("connect-src 'none'"));assert(html.includes("object-src 'none'"));assert(!/sandbox="[^"]*allow-same-origin/.test(html));assert(!/sandbox="[^"]*allow-top-navigation/.test(html));assert(html.includes('mdeenc:lock'));
});
test('storage, import and export code retain protection and never execute imported HTML in the app origin',()=>{
  assert(source.includes('if (!PROTECTED_DOCUMENT && !EMBEDDED && !EMM && !IS_IFRAME)'));assert(source.includes('if(PROTECTED_DOCUMENT)return;'));assert(source.includes("if(ISOLATED_PROTECTED)kind='encrypted'"));assert(source.includes('data-encrypted="1"'));assert(source.includes('scriptSafe(APP_JS)'));assert(!source.includes('document.write('));assert(source.includes('epoch===exportDocumentEpoch'));assert(source.includes('ticket!==documentLoadSequence'));assert.equal([...source.matchAll(/async function loadFile\(/g)].length,1);assert(source.includes('initialHandle&&initialKind===kind'));assert(source.includes('PROTECTED_DOCUMENT&&!encrypted&&!confirm'));
});

test('missing secure WebCrypto fails closed for encryption and decryption',async()=>{const empty=vm.createContext({window:{},crypto:undefined,TextEncoder,TextDecoder,Uint8Array,atob,btoa});vm.runInContext(moduleSource,empty);const unavailable=empty.window.EmmEncryptedHtml.createHtmlCrypto(),p=password(),e=await codec.encrypt(text,p,'markdown');await assert.rejects(unavailable.encrypt(text,p,'markdown'));await assert.rejects(unavailable.decrypt(e,p));});
