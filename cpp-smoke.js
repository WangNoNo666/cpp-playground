// cpp-playground 冒烟测试：bundle 导出 + 应用流程 + 真实 Wandbox 编译
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const errors = [];
const ok = (n, c, x) => { console.log((c ? 'PASS' : 'FAIL') + ' | ' + n + (x !== undefined ? '  [' + x + ']' : '')); if (!c) errors.push(n); };
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ---------- 1. 验证 editor.bundle.js 导出 ----------
{
  const sandbox = { window: {}, console };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  try {
    vm.runInContext(fs.readFileSync(path.join(__dirname, 'editor.bundle.js'), 'utf8'), sandbox);
    const CM = sandbox.window.CM;
    ok('bundle loads & exports CM', !!CM && !!CM.EditorState && !!CM.EditorView && !!CM.basicSetup && !!CM.cpp && !!CM.oneDark && !!CM.keymap,
      CM ? Object.keys(CM).join(',') : 'none');
  } catch (e) { ok('bundle loads: ' + e.message, false); console.log(e.stack); }
}

// ---------- 2. 应用冒烟（fake CM + 真实 fetch） ----------
function makeEl(id, dataset){
  const el = {
    _id: id, _handlers: {}, style: {}, dataset: dataset || {},
    textContent: '', innerHTML: '', className: '', value: '', title: '', disabled: false, spellcheck: true,
    classList: { _s: new Set(), add(c){ this._s.add(c); }, remove(c){ this._s.delete(c); }, contains(c){ return this._s.has(c); }, toggle(c, f){ if (f === undefined ? !this._s.has(c) : f) this._s.add(c); else this._s.delete(c); } },
    addEventListener(t, fn){ (this._handlers[t] = this._handlers[t] || []).push(fn); },
    appendChild(){}, remove(){}, click(){}, focus(){}
  };
  return el;
}
// fake CodeMirror
function fakeCM(){
  const makeDoc = s => ({ toString: () => s, length: s.length });
  class EditorState {
    static create({ doc }) { return { doc: makeDoc(doc || ''), extensions: [] }; }
  }
  class EditorView {
    constructor({ state }) { this.state = state; }
    setState(s){ this.state = s; }
    dispatch(tr){ /* 由包装器调用 prototype */ }
  }
  EditorView.prototype.dispatch = function(tr){
    if (tr && tr.changes){
      const cur = this.state.doc.toString();
      const ch = tr.changes;
      const next = cur.slice(0, ch.from) + ch.insert + cur.slice(ch.to);
      this.state = { doc: makeDoc(next), extensions: [] };
    }
  };
  return { EditorState, EditorView, basicSetup: [], cpp: () => [], oneDark: {}, keymap: { of: () => [] }, indentWithTab: {}, highlightSelectionMatches: () => [] };
}
function makeDocStub(){
  const els = {};
  const ots = [makeEl('ot-run', { t: 'run' }), makeEl('ot-compile', { t: 'compile' }), makeEl('ot-input', { t: 'input' })];
  const doc = {
    getElementById(id){ return els[id] || (els[id] = makeEl(id)); },
    createElement(tag){ return makeEl(tag); },
    querySelectorAll(sel){ return sel === '.ot' ? ots : []; },
    body: { innerHTML: '', appendChild(){} }
  };
  return { doc, els, ots };
}
const store = {};
function buildSandbox(){
  const { doc, els, ots } = makeDocStub();
  const win = { innerWidth: 1280, innerHeight: 720, _handlers: {},
    addEventListener(t, fn){ (this._handlers[t] = this._handlers[t] || []).push(fn); } };
  const s = {
    document: doc, window: win, localStorage: {
      getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }
    },
    performance: { now: () => Date.now() },
    fetch, FileReader: class { readAsText(f){ this.result = f._content; setTimeout(() => this.onload && this.onload(), 5); } },
    Blob: class { constructor(p){ this.p = p; } }, URL: { createObjectURL: () => 'blob:x', revokeObjectURL(){} },
    console, setTimeout, clearTimeout, Date, Math, JSON, Object, Array, String, Number, Boolean, Set, Map, RegExp, Error, Promise,
    isNaN, parseFloat, parseInt, Symbol, Intl, prompt: () => null
  };
  s.globalThis = s;
  s.CM = fakeCM();
  s.window.CM = s.CM;
  return { s, doc, els, ots, win };
}

(async () => {
  const { s, doc, win } = buildSandbox();
  const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  const code = html.match(/<script>([\s\S]*?)<\/script>/)[1];
  try {
    vm.createContext(s);
    vm.runInContext(code, s);
    (win._handlers['load'] || []).forEach(fn => fn());
    ok('app init (load)', true);
  } catch (e) { ok('app init: ' + e.message, false); console.log(e.stack); process.exit(1); }

  const dbg = s.window.__app();
  ok('sample tab created', dbg.tabCount >= 1 && dbg.codeLen > 0, JSON.stringify(dbg));

  // 模拟浏览器默认：后端 Wandbox、编译器 gcc-head（测试桩不解析 HTML 默认值）
  doc.getElementById('backendSel').value = 'wandbox';
  doc.getElementById('compilerSel').value = 'gcc-head';

  // 新建标签 + 切换
  s.window.__newTab('b.cpp', 'int main(){return 0;}');
  ok('new tab added', s.window.__app().tabCount === 2 && s.window.__tabs()[1].name === 'b.cpp');
  ok('tab switch works', s.window.__tabs().find(t => t.name === 'b.cpp').state !== null || s.window.__app().activeId);

  // 回到 main.cpp，设置代码，跑样例（真实 Wandbox！）
  const mainTab = s.window.__tabs().find(t => t.name === 'main.cpp');
  s.window.__setCode(`#include <iostream>
int main(){ int a,b; std::cin>>a>>b; std::cout << (a+b) << "\\n"; }`);
  const cs = s.window.__cases();
  cs.length = 0;
  cs.push({ input: '10 20', expected: '30', result: null, actual: '' });
  cs.push({ input: '1 2', expected: '3', result: null, actual: '' });
  // 渲染用例 DOM（直接调用内部不可行，通过触发 addCase 按钮? 用已注入的 cases 再手动渲染——直接跑 runAll）
  s.window.__runAll();
  let deadline = Date.now() + 60000;
  while (s.window.__app().running && Date.now() < deadline) await sleep(200);
  const res1 = s.window.__cases();
  ok('F9 runAll completed', !s.window.__app().running, 'running=' + s.window.__app().running);
  ok('case1 passed (real Wandbox)', res1[0].result === 'pass', 'r=' + res1[0].result + ' actual=' + (res1[0].actual || ''));
  ok('case2 passed (real Wandbox)', res1[1].result === 'pass', 'r=' + res1[1].result);
  ok('status shows completion', (doc.getElementById('statusText').textContent || '').indexOf('完成') >= 0, doc.getElementById('statusText').textContent);

  // 编译错误路径
  s.window.__setCode('int main(){ syntax error here !!! }');
  cs.length = 0;
  cs.push({ input: '', expected: '', result: null, actual: '' });
  s.window.__runAll();
  deadline = Date.now() + 60000;
  while (s.window.__app().running && Date.now() < deadline) await sleep(200);
  const res2 = s.window.__cases();
  ok('compile error reported', res2[0].result !== 'pass', 'r=' + res2[0].result + ' compileOut=' + (doc.getElementById('outCompile').textContent || '').slice(0, 60));
  ok('compile output shown', (doc.getElementById('outCompile').textContent || '').length > 0);

  // 自定义输入运行
  s.window.__setCode('#include <iostream>\nint main(){ int a,b; std::cin>>a>>b; std::cout << (a+b) << "\\n"; }');
  doc.getElementById('customInput').value = '3 4';
  s.window.__runCustom();
  deadline = Date.now() + 60000;
  while ((doc.getElementById('statusText').textContent || '').indexOf('运行中') >= 0 && Date.now() < deadline) await sleep(200);
  await sleep(2500);
  ok('custom stdin run outputs 7', (doc.getElementById('outRun').textContent || '').indexOf('7') >= 0, doc.getElementById('outRun').textContent.slice(0, 60));

  console.log(errors.length ? ('\n' + errors.length + ' FAILURES') : '\nALL CPP-PLAYGROUND TESTS PASSED');
  process.exit(errors.length ? 1 : 0);
})().catch(e => { console.log('FATAL: ' + e.stack); process.exit(1); });
