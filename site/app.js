'use strict';

// This landing-page demo only switches presentation. It never stores document data.
(() => {
  const tabs = Array.from(document.querySelectorAll('[role="tab"][data-view]'));
  const panels = Array.from(document.querySelectorAll('.demo-panel[role="tabpanel"]'));
  const status = document.getElementById('view-status');
  const descriptions = {
    source: '원문 · 마크다운 문법으로 간결하게',
    outline: '아웃라인 · 문서의 구조를 한눈에',
    render: '렌더링 · 읽는 모습 그대로',
    split: '분할 · 원문과 결과를 나란히'
  };

  function selectView(tab, moveFocus = false) {
    const panelId = tab.getAttribute('aria-controls');
    tabs.forEach(item => {
      const selected = item === tab;
      item.setAttribute('aria-selected', String(selected));
      item.tabIndex = selected ? 0 : -1;
    });
    panels.forEach(panel => { panel.hidden = panel.id !== panelId; });
    status.textContent = descriptions[tab.dataset.view];
    if (moveFocus) tab.focus();
  }

  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => selectView(tab));
    tab.addEventListener('keydown', event => {
      let next;
      if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
      if (event.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length;
      if (event.key === 'Home') next = 0;
      if (event.key === 'End') next = tabs.length - 1;
      if (next === undefined) return;
      event.preventDefault();
      selectView(tabs[next], true);
    });
  });

  const demo = document.getElementById('demo-editor');
  const themeToggle = document.querySelector('.theme-toggle');
  if (demo && themeToggle) themeToggle.addEventListener('click', () => {
    const dark = demo.dataset.theme !== 'dark';
    demo.dataset.theme = dark ? 'dark' : 'light';
    themeToggle.setAttribute('aria-pressed', String(dark));
    themeToggle.setAttribute('aria-label', dark ? '예제 화면 어두운 테마 끄기' : '예제 화면 어두운 테마 켜기');
    themeToggle.querySelector('.theme-label').textContent = dark ? '밝은 테마' : '어두운 테마';
  });

  const menuButton = document.querySelector('.menu-toggle');
  const navigation = document.getElementById('main-nav');
  function setMenu(open, restoreFocus = false) {
    menuButton.setAttribute('aria-expanded', String(open));
    menuButton.querySelector('.sr-only').textContent = open ? '메뉴 닫기' : '메뉴 열기';
    navigation.classList.toggle('is-open', open);
    if (restoreFocus) menuButton.focus();
  }
  menuButton.addEventListener('click', () => {
    setMenu(menuButton.getAttribute('aria-expanded') !== 'true');
  });
  navigation.addEventListener('click', event => {
    if (event.target.closest('a')) setMenu(false);
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && menuButton.getAttribute('aria-expanded') === 'true') {
      setMenu(false, true);
    }
  });
  document.addEventListener('click', event => {
    if (!event.target.closest('.header-inner')) setMenu(false);
  });
  const desktop = window.matchMedia('(min-width: 1201px)');
  desktop.addEventListener('change', () => setMenu(false));
})();
