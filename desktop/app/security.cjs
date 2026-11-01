'use strict';
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const {fileURLToPath} = require('node:url');
const MAX_BYTES = 64 * 1024 * 1024;
const OPEN_EXTENSIONS = new Set(['.md', '.markdown', '.txt', '.html']);
const TOKEN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const APP_CSP = "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self'; frame-src mde-preview:; object-src 'none'; base-uri 'none'; form-action 'none'; worker-src 'none'";
const PREVIEW_CSP = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: https:; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; sandbox allow-scripts";
function fail() { throw new Error('Operation not permitted'); }
function assertToken(id) { if (typeof id !== 'string' || !TOKEN.test(id)) fail(); return id; }
function safeExternalURL(value) {
  if (typeof value !== 'string' || value.length > 4096 || /[\u0000-\u0020\u007f]/.test(value)) return null;
  try { const u = new URL(value); return ['https:', 'http:'].includes(u.protocol) && u.hostname && !u.username && !u.password ? u.href : null; } catch { return null; }
}
function trustedSender(event, window, editorPath) {
  try {
    if (!window || window.isDestroyed() || event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame) return false;
    const u = new URL(event.senderFrame.url);
    const allowedLanguage = /^(?:ko(?:[-_]KR)?|en(?:[-_](?:US|GB))?|ja(?:[-_]JP)?|zh(?:[-_](?:CN|TW|HK|Hans|Hant))?)$/i;
    const seen = new Set();
    for (const [key, value] of u.searchParams) {
      if (!['lang', 'locale'].includes(key) || seen.has(key) || !allowedLanguage.test(value)) return false;
      seen.add(key);
    }
    return u.protocol === 'file:' && !u.hash && fileURLToPath(u) === path.resolve(editorPath);
  } catch { return false; }
}
function saveOptions(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail();
  const extensions = input.extensions === undefined ? ['md'] : input.extensions;
  if (!Array.isArray(extensions) || !extensions.length || extensions.length > 2 || extensions.some(x => x !== 'md' && x !== 'html')) fail();
  let name = typeof input.suggestedName === 'string' ? input.suggestedName : 'Untitled';
  name = path.win32.basename(path.posix.basename(name)).replace(/[<>:"/\\|?*\u0000-\u001f\u007f]/g, '_').replace(/[ .]+$/g, '').slice(0, 180);
  if (!name || /^\.+$/.test(name)) name = 'Untitled';
  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name)) name = '_' + name;
  const ext = path.extname(name).slice(1).toLowerCase();
  if (!extensions.includes(ext)) name = name.replace(/\.[^.]*$/, '') + '.' + extensions[0];
  return {name, extensions: [...new Set(extensions)]};
}
function previewId(url) {
  try { const u = new URL(url); const id = u.pathname.slice(1); return u.protocol === 'mde-preview:' && u.hostname === 'content' && !u.port && !u.username && !u.password && !u.search && !u.hash && TOKEN.test(id) && u.pathname === '/' + id ? id : null; } catch { return null; }
}
function checkedText(text) { if (typeof text !== 'string' || Buffer.byteLength(text, 'utf8') > MAX_BYTES) fail(); return text; }
async function boundedRead(filename) {
  const handle = await fsp.open(filename, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0));
  try {
    const stat = await handle.stat(); if (!stat.isFile() || stat.size > MAX_BYTES) fail();
    const parts = []; let size = 0;
    while (true) {
      const buffer = Buffer.alloc(Math.min(65536, MAX_BYTES + 1 - size));
      const {bytesRead} = await handle.read(buffer, 0, buffer.length, null);
      if (!bytesRead) break;
      size += bytesRead; if (size > MAX_BYTES) fail(); parts.push(buffer.subarray(0, bytesRead));
    }
    return {buffer: Buffer.concat(parts, size), stat};
  } finally { await handle.close(); }
}
class CapabilityStore {
  constructor(owner) { this.owner = owner; this.entries = new Map(); }
  async grant(filename, mode = 'read') {
    if (typeof filename !== 'string' || !path.isAbsolute(filename) || !['read', 'write'].includes(mode)) fail();
    const full = path.resolve(filename); const ext = path.extname(full).toLowerCase();
    if (!(mode === 'write' ? ['.md', '.html'].includes(ext) : OPEN_EXTENSIONS.has(ext))) fail();
    const parent = await fsp.realpath(path.dirname(full));
    const canonical = path.join(parent, path.basename(full));
    const stat = await fsp.lstat(canonical).catch(e => { if (e.code === 'ENOENT' && mode === 'write') return null; throw e; });
    if (stat && (!stat.isFile() || stat.isSymbolicLink())) fail();
    if (mode === 'read' && (!stat || stat.size > MAX_BYTES)) fail();
    if (this.entries.size >= 4096) fail();
    const id = crypto.randomUUID();
    this.entries.set(id, {path: canonical, parent, mode}); return {id, name: path.basename(canonical)};
  }
  async entry(id, owner) {
    assertToken(id); if (owner !== this.owner) fail(); const entry = this.entries.get(id); if (!entry) fail();
    if (await fsp.realpath(path.dirname(entry.path)) !== entry.parent) fail();
    const stat = await fsp.lstat(entry.path).catch(e => { if (e.code === 'ENOENT' && entry.mode === 'write') return null; throw e; });
    if (stat && (!stat.isFile() || stat.isSymbolicLink())) fail(); return {entry, stat};
  }
  async read(id, owner) {
    const {entry} = await this.entry(id, owner); const {buffer, stat} = await boundedRead(entry.path);
    const ext = path.extname(entry.path).toLowerCase();
    return {text: buffer.toString('utf8'), size: buffer.length, lastModified: stat.mtimeMs, type: ext === '.html' ? 'text/html' : ext === '.txt' ? 'text/plain' : 'text/markdown'};
  }
  async write(id, text, owner) {
    checkedText(text); const {entry, stat} = await this.entry(id, owner);
    const temp = path.join(entry.parent, '.' + path.basename(entry.path) + '.' + crypto.randomUUID() + '.tmp');
    let handle;
    try {
      handle = await fsp.open(temp, 'wx', stat ? stat.mode & 0o777 : 0o600);
      await handle.writeFile(text, 'utf8'); await handle.sync(); await handle.close(); handle = null;
      await this.entry(id, owner); await fsp.rename(temp, entry.path);
      return {bytes: Buffer.byteLength(text, 'utf8')};
    } finally { if (handle) await handle.close().catch(() => {}); await fsp.unlink(temp).catch(() => {}); }
  }
  clear() { this.entries.clear(); }
}
async function readAsset(appRoot, id) {
  if (typeof id !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/.test(id) || id.includes('..')) fail();
  const vendor = path.join(appRoot, 'vendor'); const realVendor = await fsp.realpath(vendor);
  const manifestFile = path.join(vendor, 'manifest.json');
  if ((await fsp.lstat(manifestFile)).isSymbolicLink()) fail();
  const {buffer: manifestBuffer} = await boundedRead(manifestFile);
  const manifest = JSON.parse(manifestBuffer.toString('utf8'));
  if (!Array.isArray(manifest.assets)) fail();
  const matches = manifest.assets.filter(a => a && a.id === id); if (matches.length !== 1) fail();
  const asset = matches[0];
  if (typeof asset.url !== 'string' || typeof asset.sha256 !== 'string' || !/^[a-fA-F0-9]{64}$/.test(asset.sha256)) fail();
  if (!/^vendor\/[a-zA-Z0-9._/-]+$/.test(asset.url) || asset.url.includes('..') || asset.url.includes('//')) fail();
  const filename = path.resolve(appRoot, asset.url);
  if (!filename.startsWith(vendor + path.sep)) fail();
  const real = await fsp.realpath(filename);
  if (!real.startsWith(realVendor + path.sep) || (await fsp.lstat(filename)).isSymbolicLink()) fail();
  const {buffer} = await boundedRead(filename);
  if (crypto.createHash('sha256').update(buffer).digest('hex') !== asset.sha256.toLowerCase()) fail();
  return buffer.toString('utf8');
}
module.exports = {MAX_BYTES, OPEN_EXTENSIONS, APP_CSP, PREVIEW_CSP, assertToken, safeExternalURL, trustedSender, saveOptions, previewId, checkedText, boundedRead, CapabilityStore, readAsset};
