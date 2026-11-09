'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {hasCompleteSplitScroll:check,expected}=require('../scripts/check-split-scroll.cjs');
function good(){return {splitScrollBrowser:{passed:true,cases:expected.map(c=>({...c,passed:true}))}};}
test('all exact 52 split cases required',()=>{assert.equal(expected.length,52);assert.equal(check(good()),true)});
test('missing report and empty cases rejected',()=>{for(const r of [null,{}, {splitScrollBrowser:{passed:true,cases:[]}}])assert.equal(check(r),false)});
test('failed, missing, duplicate and foreign cases rejected',()=>{for(const mutate of [r=>r.passed=false,r=>r.cases.pop(),r=>r.cases.push({...r.cases[0]}),r=>r.cases[0].passed=false,r=>r.cases[0].language='other',r=>r.cases[1]={...r.cases[0]},r=>r.cases[0].name='other']){const x=good();mutate(x.splitScrollBrowser);assert.equal(check(x),false)}});
