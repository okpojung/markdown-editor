'use strict';
const expected=[
  {
    "language": "ko",
    "name": "source scroll matches block"
  },
  {
    "language": "ko",
    "name": "rendered scroll matches block"
  },
  {
    "language": "ko",
    "name": "rendered scroll preserves source selection"
  },
  {
    "language": "ko",
    "name": "source cursor reveals corresponding block"
  },
  {
    "language": "ko",
    "name": "source selection preserves rendered selection"
  },
  {
    "language": "ko",
    "name": "rendered cursor reveals corresponding block"
  },
  {
    "language": "ko",
    "name": "rendered selection preserves source selection"
  },
  {
    "language": "ko",
    "name": "scrolling and selection never change document"
  },
  {
    "language": "en",
    "name": "source scroll matches block"
  },
  {
    "language": "en",
    "name": "rendered scroll matches block"
  },
  {
    "language": "en",
    "name": "rendered scroll preserves source selection"
  },
  {
    "language": "en",
    "name": "source cursor reveals corresponding block"
  },
  {
    "language": "en",
    "name": "source selection preserves rendered selection"
  },
  {
    "language": "en",
    "name": "rendered cursor reveals corresponding block"
  },
  {
    "language": "en",
    "name": "rendered selection preserves source selection"
  },
  {
    "language": "en",
    "name": "scrolling and selection never change document"
  },
  {
    "language": "ja",
    "name": "source scroll matches block"
  },
  {
    "language": "ja",
    "name": "rendered scroll matches block"
  },
  {
    "language": "ja",
    "name": "rendered scroll preserves source selection"
  },
  {
    "language": "ja",
    "name": "source cursor reveals corresponding block"
  },
  {
    "language": "ja",
    "name": "source selection preserves rendered selection"
  },
  {
    "language": "ja",
    "name": "rendered cursor reveals corresponding block"
  },
  {
    "language": "ja",
    "name": "rendered selection preserves source selection"
  },
  {
    "language": "ja",
    "name": "scrolling and selection never change document"
  },
  {
    "language": "zh",
    "name": "source scroll matches block"
  },
  {
    "language": "zh",
    "name": "rendered scroll matches block"
  },
  {
    "language": "zh",
    "name": "rendered scroll preserves source selection"
  },
  {
    "language": "zh",
    "name": "source cursor reveals corresponding block"
  },
  {
    "language": "zh",
    "name": "source selection preserves rendered selection"
  },
  {
    "language": "zh",
    "name": "rendered cursor reveals corresponding block"
  },
  {
    "language": "zh",
    "name": "rendered selection preserves source selection"
  },
  {
    "language": "zh",
    "name": "scrolling and selection never change document"
  },
  {
    "language": "shared",
    "name": "source bottom follows rendered bottom"
  },
  {
    "language": "shared",
    "name": "source top follows rendered top"
  },
  {
    "language": "shared",
    "name": "rendered bottom follows source bottom"
  },
  {
    "language": "shared",
    "name": "rendered top follows source top"
  },
  {
    "language": "shared",
    "name": "no scroll feedback oscillation"
  },
  {
    "language": "shared",
    "name": "no follow outside split mode"
  },
  {
    "language": "shared",
    "name": "short document safe"
  },
  {
    "language": "shared",
    "name": "empty document safe"
  },
  {
    "language": "shared",
    "name": "mapping rebuilt after document replacement"
  },
  {
    "language": "shared",
    "name": "mapping and listeners rebound after locale rebuild"
  },
  {
    "language": "shared",
    "name": "source edit debounce refreshes mapping"
  },
  {
    "language": "shared",
    "name": "rendered edit debounce refreshes mapping"
  },
  {
    "language": "ko",
    "name": "long link and EMM syntax source text follows visible text"
  },
  {
    "language": "ko",
    "name": "long link and EMM syntax rendered text follows source text"
  },
  {
    "language": "en",
    "name": "long link and EMM syntax source text follows visible text"
  },
  {
    "language": "en",
    "name": "long link and EMM syntax rendered text follows source text"
  },
  {
    "language": "ja",
    "name": "long link and EMM syntax source text follows visible text"
  },
  {
    "language": "ja",
    "name": "long link and EMM syntax rendered text follows source text"
  },
  {
    "language": "zh",
    "name": "long link and EMM syntax source text follows visible text"
  },
  {
    "language": "zh",
    "name": "long link and EMM syntax rendered text follows source text"
  },
  {
    "language": "ko",
    "name": "table header inline source follows rendered cell"
  },
  {
    "language": "ko",
    "name": "table body inline rendered follows source cell"
  },
  {
    "language": "en",
    "name": "table header inline source follows rendered cell"
  },
  {
    "language": "en",
    "name": "table body inline rendered follows source cell"
  },
  {
    "language": "ja",
    "name": "table header inline source follows rendered cell"
  },
  {
    "language": "ja",
    "name": "table body inline rendered follows source cell"
  },
  {
    "language": "zh",
    "name": "table header inline source follows rendered cell"
  },
  {
    "language": "zh",
    "name": "table body inline rendered follows source cell"
  }
];
function hasCompleteSplitScroll(report){const r=report?.splitScrollBrowser;if(r?.passed!==true||!Array.isArray(r.cases)||r.cases.length!==expected.length||r.cases.some(c=>c?.passed!==true))return false;const keys=new Set(r.cases.map(c=>c.language+':'+c.name));return keys.size===expected.length&&expected.every(c=>keys.has(c.language+':'+c.name));}
module.exports={hasCompleteSplitScroll,expected};
