/* 독립 홈페이지 배포 사본 전용. EMM 저장소 원본/연동에는 적용하지 않는다. */
window.addEventListener('message', function (event) {
  var data = event.data;
  if (!data || typeof data !== 'object' || typeof data.type !== 'string' || !data.type.startsWith('mde:')) return;
  if (event.origin !== location.origin || (event.source !== window.parent && event.source !== window.opener)) event.stopImmediatePropagation();
}, true);
