'use strict';
function hasCompleteRenderedTail(report) {
  const r = report?.renderedTailBrowser;
  if (r?.passed !== true || !Array.isArray(r.cases) || r.cases.length !== 34 || r.cases.some(c => c?.passed !== true)) return false;
  const keys = new Set(r.cases.map(c => c.language ? [c.language, c.mode, c.fixture].join(':') : c.fixture));
  if (keys.size !== 34) return false;
  for (const lang of ['ko','en','ja','zh']) for (const mode of ['rendered','split']) for (const fixture of ['table','code','mermaid','html']) {
    if (!keys.has([lang, mode, fixture].join(':'))) return false;
  }
  return keys.has('existing-paragraphs-and-idempotence') && keys.has('undo-redo');
}
module.exports = {hasCompleteRenderedTail};
