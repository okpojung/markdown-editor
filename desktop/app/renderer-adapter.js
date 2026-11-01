'use strict';
(() => {
  const api = window.desktopAPI;
  if (!api) return;
  const aborted = () => new DOMException('Canceled', 'AbortError');
  const handle = meta => Object.freeze({
    kind: 'file', name: meta.name,
    async getFile() {
      const data = await api.readFile(meta.id);
      return new File([data.text], meta.name, {type:data.type || 'text/plain', lastModified:data.lastModified});
    },
    async createWritable() {
      let pending = '', closed = false;
      return {
        async write(value) {
          if (closed) throw new Error('Writer closed');
          pending = typeof value === 'string' ? value : value instanceof Blob ? await value.text() : new TextDecoder().decode(value);
        },
        async close() {
          if (closed) return;
          await api.writeFile(meta.id, pending);
          closed = true;
        },
        async abort() { closed = true; pending = ''; }
      };
    }
  });
  window.desktopMakeHandle = handle;
  window.showOpenFilePicker = async () => {
    const files = await api.pickOpen();
    if (!files || !files.length) throw aborted();
    return files.map(handle);
  };
  window.showSaveFilePicker = async options => {
    const accept = options?.types?.[0]?.accept || {};
    const extensions = Object.values(accept).flat().map(v => String(v).replace(/^\./, '')).filter(v => ['md','html'].includes(v));
    const meta = await api.pickSave({suggestedName:options?.suggestedName || 'document.md', extensions:extensions.length ? extensions : ['md']});
    if (!meta) throw aborted();
    return handle(meta);
  };
  // A sandboxed HTML preview is never an editor integration peer.
  window.addEventListener('message', event => {
    if (typeof event.data?.type === 'string' && event.data.type.startsWith('mde:')) event.stopImmediatePropagation();
  }, true);
  document.addEventListener('click', event => {
    const a = event.target.closest?.('a[href]');
    if (!a || !event.isTrusted || !/^https?:/i.test(a.href)) return;
    event.preventDefault();
    api.openExternal(a.href).catch(() => {});
  }, true);
})();
