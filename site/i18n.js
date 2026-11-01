'use strict';
// Only fixed developer-authored dictionaries are used. No user content or innerHTML.
(() => {
  const messages = window.MDE_SITE_MESSAGES;
  if (!messages) return;
  const locales = ['ko', 'en', 'ja', 'zh'];
  const codes = {ko:'KR', en:'EN', ja:'JP', zh:'CN'};
  const normalize = value => { const code = String(value || '').toLowerCase(); return /^(zh|zh-cn|zh-hans)$/.test(code) ? 'zh' : locales.includes(code) ? code : null; };
  const index = new Map(Object.entries(messages.ko).map(([key, value]) => [value, key]));
  const bindings = [];
  const walker = document.createTreeWalker(document.documentElement, NodeFilter.SHOW_TEXT);
  let node;
  while ((node = walker.nextNode())) {
    if (node.parentElement?.closest('script,style,noscript,.lang-picker')) continue;
    const original = node.data;
    const key = index.get(original.trim());
    if (key) bindings.push({node, key, prefix:original.match(/^\s*/)[0], suffix:original.match(/\s*$/)[0]});
  }
  const attributes = [];
  document.querySelectorAll('[aria-label],[title],meta[name="description"]').forEach(element => {
    ['aria-label', 'title', 'content'].forEach(name => {
      const key = index.get(element.getAttribute(name));
      if (key) attributes.push({element, name, key});
    });
  });
  let language = 'ko';
  let stored = null;
  try { stored = localStorage.getItem('mde.site.lang'); } catch (_) { /* Storage may be disabled. */ }
  const picker = document.querySelector('.lang-picker');
  const trigger = picker?.querySelector('.lang-toggle');
  const panel = picker?.querySelector('.lang-panel');
  const options = Array.from(picker?.querySelectorAll('.lang-option') || []);
  const menu = document.querySelector('.menu-toggle');
  const translate = value => messages[language][index.get(value)] ?? value;
  function closePicker(restoreFocus = false) {
    if (!trigger || !panel) return;
    panel.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
    options.forEach(option => { option.tabIndex = -1; });
    if (restoreFocus) trigger.focus();
  }
  function openPicker(position = null) {
    if (!trigger || !panel) return;
    if (menu?.getAttribute('aria-expanded') === 'true') menu.click();
    panel.hidden = false;
    trigger.setAttribute('aria-expanded', 'true');
    options.forEach(option => { option.tabIndex = 0; });
    (options[position] || options.find(option => option.dataset.lang === language))?.focus();
  }
  function updateLinks() {
    document.querySelectorAll('a[href]').forEach(link => {
      if (link.hasAttribute('download')) return;
      const raw = link.getAttribute('href');
      if (!raw || /^(https?:|mailto:|tel:)/i.test(raw)) return;
      const url = new URL(raw, location.href);
      if (url.origin !== location.origin || !['/', '/why-markdown/', '/editor/'].includes(url.pathname)) return;
      url.searchParams.set('lang', language);
      link.setAttribute('href', url.pathname + url.search + url.hash);
    });
  }
  function apply(next, historyMode = null) {
    language = normalize(next) || 'ko';
    document.documentElement.lang = language === 'zh' ? 'zh-Hans' : language;
    bindings.forEach(binding => { binding.node.data = binding.prefix + messages[language][binding.key] + binding.suffix; });
    attributes.forEach(binding => binding.element.setAttribute(binding.name, messages[language][binding.key]));
    if (trigger) {
      trigger.querySelector('.lang-current').textContent = codes[language];
      trigger.querySelector('use').setAttribute('href', '#flag-' + language);
      trigger.setAttribute('aria-label', translate('언어 선택') + ': ' + options.find(option => option.dataset.lang === language)?.querySelector('.lang-native').textContent);
    }
    if (panel) panel.setAttribute('aria-label', translate('언어 선택'));
    options.forEach(option => {
      const selected = option.dataset.lang === language;
      option.setAttribute('aria-checked', String(selected));
      if (selected) option.setAttribute('aria-current', 'true'); else option.removeAttribute('aria-current');
    });
    try { localStorage.setItem('mde.site.lang', language); } catch (_) { /* Keep working without storage. */ }
    if (historyMode) {
      const url = new URL(location.href);
      url.searchParams.set('lang', language);
      if (url.href !== location.href) history[historyMode + 'State'](null, '', url);
    }
    updateLinks();
    window.dispatchEvent(new Event('mde:languagechange'));
  }
  window.mdeI18n = {translate, get language(){return language;}, normalize};
  trigger?.addEventListener('click', () => panel.hidden ? openPicker() : closePicker());
  trigger?.addEventListener('keydown', event => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); openPicker(event.key === 'ArrowUp' ? options.length - 1 : 0); }
  });
  options.forEach((option, index) => {
    option.addEventListener('click', () => { const next = option.dataset.lang; closePicker(true); if (next !== language) apply(next, 'push'); });
    option.addEventListener('keydown', event => {
      let target;
      if (event.key === 'ArrowDown' || event.key === 'ArrowRight') target = (index + 1) % options.length;
      if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') target = (index - 1 + options.length) % options.length;
      if (event.key === 'Home') target = 0;
      if (event.key === 'End') target = options.length - 1;
      if (target !== undefined) { event.preventDefault(); options[target].focus(); }
    });
  });
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && panel && !panel.hidden) { event.preventDefault(); closePicker(true); } });
  document.addEventListener('click', event => { if (!picker?.contains(event.target)) closePicker(); });
  picker?.addEventListener('focusout', event => { if (!picker.contains(event.relatedTarget)) closePicker(); });
  menu?.addEventListener('click', () => closePicker());
  window.addEventListener('popstate', () => { closePicker(); apply(normalize(new URL(location.href).searchParams.get('lang')) || 'ko'); });
  apply(normalize(new URL(location.href).searchParams.get('lang')) || normalize(stored) || 'ko', 'replace');
})();
