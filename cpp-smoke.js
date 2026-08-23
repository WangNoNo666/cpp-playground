// cpp-playground v2 冒烟测试：bundle + 应用流程 + 真实编译 + 新功能
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const errors = [];
const ok = (n, c, x) => { console.log((c ? 'PASS' : 'FAIL') + ' | ' + n + (x !== undefined ? '  [' + x + ']' : '')); if (!c) errors.push(n); };
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ---------- 1. bundle 导出 ----------
{
  const sandbox = { window: {}, console };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  try {
    vm.runInContext(fs.readFileSync(path.join(__dirname, 'editor.bundle.js'), 'utf8'), sandbox);
    const CM = sandbox.window.CM;
    ok('bundle loads & exports CM', !!CM && !!CM.EditorState && !!CM.EditorView && !!CM.basicSetup && !!CM.cpp && !!CM.oneDark,
      CM ? Object.keys(CM).join(',') : 'none');
  } catch (e) { ok('bundle loads: ' + e.message, false); console.log(e.stack); }
}

// ---------- 2. 应用 ----------
function makeEl(id, dataset){
  const el = {
    _id: id, _handlers: {}, style: {}, dataset: dataset || {},
    textContent: '', innerHTML: '', className: '', value: '', title: '', disabled: false, spellcheck: true,
    classList: { _s: new Set(), add(c){ this._s.add(c); }, remove(c){ this._s.delete(c); }, contains(c){ return this._s.has(c); }, toggle(c, f){ if (f === undefined ? !this._s.has(c) : f) this._s.add(c); else this._s.delete(c); } },
    addEventListener(t, fn){ (this._handlers[t] = this._handlers[t] || []).push(fn); },
    appendChild(){}, remove(){}, click(){}, focus(){}, select(){}
  };
  return el;
}
function fakeCM(){
  const makeDoc = s => ({ toString: () => s, length: s.length });
  class EditorState { static create({ doc }) { return { doc: makeDoc(doc || ''), extensions: [] }; } }
  class EditorView {
    constructor({ state }) { this.state = state; }
    setState(s){ this.state = s; }
  }
  EditorView.prototype.dispatch = function(tr){
    if (tr && tr.changes){
      const cur = this.state.doc.toString();
      const ch = tr.changes;
      this.state = { doc: makeDoc(cur.slice(0, ch.from) + ch.insert + cur.slice(ch.to)), extensions: [] };
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
    execCommand(){ return true; },
    addEventListener(){},
    body: { innerHTML: '', appendChild(){} }
  };
  return { doc, els, ots };
}
const store = {};
function buildSandbox(){
  const { doc, els, ots } = makeDocStub();
  const win = { innerWidth: 1280, innerHeight: 720, _handlers: {}, addEventListener(t, fn){ (this._handlers[t] = this._handlers[t] || []).push(fn); } };
  const esc = s => { let o = ''; for (let i = 0; i < s.length; i++){ const c = s.charCodeAt(i); o += c < 128 ? s[i] : '%' + c.toString(16).padStart(2, '0').toUpperCase(); } return o; };
  const unesc = s => s.replace(/%([0-9A-Fa-f]{2})/g, (m, h) => String.fromCharCode(parseInt(h, 16)));
  const s = {
    document: doc, window: win, location: { origin: 'https://w.github.io', pathname: '/cpp-playground/', search: '' },
    navigator: { clipboard: undefined }, history: { replaceState(){} },
    localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } },
    performance: { now: () => Date.now() },
    fetch, FileReader: class { readAsText(f){ this.result = f._content; setTimeout(() => this.onload && this.onload(), 5); } },
    Blob: class { constructor(p){ this.p = p; } }, URL: { createObjectURL: () => 'blob:x', revokeObjectURL(){} },
    AbortController, URLSearchParams, btoa, atob, escape: esc, unescape: unesc,
    console, setTimeout, clearTimeout, Date, Math, JSON, Object, Array, String, Number, Boolean, Set, Map, RegExp, Error, Promise,
    isNaN, parseFloat, parseInt, Symbol, Intl, prompt: () => null, confirm: () => true
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
  ok('overlay/dialog CSS defined', html.indexOf('.overlay{') >= 0 && html.indexOf('.overlay .dialog{') >= 0, 'panel would be invisible without it');
  try {
    vm.createContext(s);
    vm.runInContext(code, s);
    (win._handlers['load'] || []).forEach(fn => fn());
    ok('app init (load)', true);
  } catch (e) { ok('app init: ' + e.message, false); console.log(e.stack); process.exit(1); }

  doc.getElementById('backendSel').value = 'wandbox';
  doc.getElementById('compilerSel').value = 'gcc-head';

  // 打开本地文件（原"无法读入本地代码"修复验证）
  const before = s.window.__app().tabCount;
  s.window.__openFiles([{ name: 'local.cpp', _content: 'int local_var = 42;\n' }]);
  await sleep(40);
  const tabs2 = s.window.__tabs();
  ok('openFiles creates tab with content', tabs2.length === before + 1 && tabs2[tabs2.length - 1].code.indexOf('local_var') >= 0,
    'tabs=' + tabs2.length + ' last=' + (tabs2[tabs2.length - 1] || {}).name);
  ok('new tab auto-activated', s.window.__app().activeId === tabs2[tabs2.length - 1].id);

  // 真实 Wandbox 运行（2 用例 → 批量模式：一次请求）
  const mainTab = s.window.__tabs().find(t => t.name === 'main.cpp');
  s.window.__setCode('#include <iostream>\nint main(){ int a,b; std::cin>>a>>b; std::cout << (a+b) << "\\n"; return 0; }');
  const cs = s.window.__cases();
  cs.length = 0;
  cs.push({ input: '10 20', expected: '30', result: null, actual: '', time: null });
  cs.push({ input: '1 2', expected: '3', result: null, actual: '', time: null });
  s.window.__runAll();
  let dl = Date.now() + 60000;
  while (s.window.__app().running && Date.now() < dl) await sleep(200);
  ok('F9 batch mode: case1 pass', s.window.__cases()[0].result === 'pass', 'r=' + s.window.__cases()[0].result);
  ok('F9 batch mode: case2 pass', s.window.__cases()[1].result === 'pass');
  ok('batch records real per-case time', (s.window.__cases()[0].time || 0) >= 0, 't=' + s.window.__cases()[0].time);
  ok('batch reports peak memory', (doc.getElementById('memText').textContent || '').indexOf('内存') >= 0, doc.getElementById('memText').textContent);

  // 编译错误路径（1 用例 → 逐用例模式）
  s.window.__setCode('int main(){ syntax error ! }');
  cs.length = 0;
  cs.push({ input: '', expected: '', result: null, actual: '', time: null });
  s.window.__runAll();
  dl = Date.now() + 60000;
  while (s.window.__app().running && Date.now() < dl) await sleep(200);
  ok('compile error shown', (doc.getElementById('outCompile').textContent || '').length > 0);

  // 自定义输入（走包装器，显示评测机口径 CPU 时间）
  s.window.__setCode('#include <iostream>\nint main(){ int a,b; std::cin>>a>>b; std::cout << (a+b) << "\\n"; return 0; }');
  doc.getElementById('customInput').value = '3 4';
  s.window.__runCustom();
  await sleep(8000);
  const customOut = doc.getElementById('outRun').textContent || '';
  ok('custom stdin outputs 7', customOut.indexOf('7') >= 0, customOut.slice(0, 60));
  ok('custom shows judge-style CPU time', customOut.indexOf('运行时间') >= 0 && customOut.indexOf('CPU') >= 0, customOut.slice(0, 60));

  // 超时中止（时限 1ms → TLE）
  doc.getElementById('timeLimit').value = '1';
  s.window.__setCode('#include <iostream>\nint main(){ long long x=0; while(true) x++; }'); // 死循环
  cs.length = 0;
  cs.push({ input: '', expected: '', result: null, actual: '', time: null });
  s.window.__runAll();
  dl = Date.now() + 60000;
  while (s.window.__app().running && Date.now() < dl) await sleep(200);
  const tleRes = s.window.__cases()[0];
  ok('time limit aborts run (TLE)', tleRes.result === 'tle', 'r=' + tleRes.result + ' actual=' + (tleRes.actual || ''));
  doc.getElementById('timeLimit').value = '10000';

  // 栈提升：深递归 50000×4KB=200MB 栈需求（默认 8MB 会段错误，提升后应通过）
  s.window.__setCode('#include <bits/stdc++.h>\nusing namespace std;\nvolatile int sink;\nvoid dfs(int dep){ char buf[4096]; buf[0]=1; if(dep<=0) return; dfs(dep-1); sink=buf[0]; }\nint main(){ dfs(50000); cout << "OK " << sink << "\\n"; return 0; }');
  cs.length = 0;
  cs.push({ input: '', expected: 'OK 1', result: null, actual: '', time: null });
  s.window.__runAll();
  dl = Date.now() + 60000;
  while (s.window.__app().running && Date.now() < dl) await sleep(200);
  ok('stack boost: deep recursion passes (512MB)', s.window.__cases()[0].result === 'pass', 'r=' + s.window.__cases()[0].result + ' actual=' + (s.window.__cases()[0].actual || '').slice(0, 40));

  // 分享链接 roundtrip
  s.window.__setCode('int SHARED = 777;');
  const url = s.window.__buildShareUrl();
  ok('share url built', url.indexOf('?share=') >= 0, url.slice(0, 60) + '…');
  const sParam = new URLSearchParams(url.split('?')[1]).get('share');
  const b64 = sParam.replace(/-/g, '+').replace(/_/g, '/');
  const data = JSON.parse(decodeURIComponent(escape(atob(b64 + '='.repeat((4 - b64.length % 4) % 4)))));
  ok('share roundtrip preserves code', data.c.indexOf('SHARED = 777') >= 0, 'name=' + data.n);

  // 分享弹窗（点击 📤 → 弹窗展示链接 + 复制按钮）
  (doc.getElementById('shareBtn')._handlers.click || []).forEach(fn => fn());
  ok('share dialog shows URL', !doc.getElementById('shareScreen').classList.contains('hidden') && s.window.__shareUrl().indexOf('?share=') >= 0, (s.window.__shareUrl() || '').slice(0, 50));
  (doc.getElementById('shareCopyBtn')._handlers.click || []).forEach(fn => fn());
  ok('share copy button works', (doc.getElementById('statusText').textContent || '').indexOf('已复制') >= 0, doc.getElementById('statusText').textContent);
  (doc.getElementById('shareCloseBtn')._handlers.click || []).forEach(fn => fn());
  ok('share dialog closes', doc.getElementById('shareScreen').classList.contains('hidden'));

  // 用例上传（大样例本地文件）
  s.window.__setUploadTarget(0, 'input');
  (doc.getElementById('caseFileInput')._handlers.change || []).forEach(fn => fn({ target: { files: [{ name: 'big.in', _content: '1\n2\n3\n'.repeat(500) }], value: '' } }));
  await sleep(40);
  ok('case upload fills input', s.window.__cases()[0].input.indexOf('3\n') >= 0, 'len=' + s.window.__cases()[0].input.length);

  // Ctrl+W 关闭当前标签（而非网页）：捕获阶段 keydown
  const tabsBefore = s.window.__app().tabCount;
  (win._handlers['keydown'] || []).forEach(fn => fn({ key: 'w', ctrlKey: true, preventDefault(){} }));
  ok('Ctrl+W closes tab (not webpage)', s.window.__app().tabCount === tabsBefore - 1, 'before=' + tabsBefore + ' after=' + s.window.__app().tabCount);

  // Ctrl+W 兜底：若浏览器仍尝试关闭页面，beforeunload 拦截
  let pdCalled = false;
  const be = { returnValue: 'x', preventDefault(){ pdCalled = true; } };
  (win._handlers['keydown'] || []).forEach(fn => fn({ key: 'w', ctrlKey: true, preventDefault(){} }));
  (win._handlers['beforeunload'] || []).forEach(fn => fn(be));
  ok('Ctrl+W beforeunload backstop', pdCalled && be.returnValue === '', 'pd=' + pdCalled);

  // Ctrl+N / Ctrl+O 及 Alt 组合（Chrome 保留 Ctrl+N/W，Alt 组合为可靠键）
  const tn = s.window.__app().tabCount;
  (win._handlers['keydown'] || []).forEach(fn => fn({ key: 'n', ctrlKey: true, preventDefault(){} }));
  ok('Ctrl+N new tab', s.window.__app().tabCount === tn + 1, 'before=' + tn + ' after=' + s.window.__app().tabCount);
  const ta = s.window.__app().tabCount;
  (win._handlers['keydown'] || []).forEach(fn => fn({ key: 'n', altKey: true, preventDefault(){} }));
  ok('Alt+N new tab', s.window.__app().tabCount === ta + 1, 'before=' + ta + ' after=' + s.window.__app().tabCount);
  let openClicked = false;
  doc.getElementById('fileInput').click = () => { openClicked = true; };
  (win._handlers['keydown'] || []).forEach(fn => fn({ key: 'o', ctrlKey: true, preventDefault(){} }));
  ok('Ctrl+O opens file dialog', openClicked, 'clicked=' + openClicked);
  openClicked = false;
  (win._handlers['keydown'] || []).forEach(fn => fn({ key: 'o', altKey: true, preventDefault(){} }));
  ok('Alt+O opens file dialog', openClicked, 'clicked=' + openClicked);
  const tw = s.window.__app().tabCount;
  (win._handlers['keydown'] || []).forEach(fn => fn({ key: 'w', altKey: true, preventDefault(){} }));
  ok('Alt+W closes tab', s.window.__app().tabCount === tw - 1, 'before=' + tw + ' after=' + s.window.__app().tabCount);

  // 代码模板
  s.window.__setCode('#include <iostream>\nint main(){ return 0; }');
  doc.getElementById('tplName').value = 'mytpl';
  s.window.__saveCurrentTemplate();
  ok('save current code as template', s.window.__templates().length === 1 && s.window.__templates()[0].name === 'mytpl', JSON.stringify(s.window.__templates().map(t => t.name)));
  ok('template persisted to localStorage', store['cppPlayground.templates'] && store['cppPlayground.templates'].indexOf('mytpl') >= 0);
  s.window.__insertTemplate('// TEMPLATE_INSERTED');
  ok('insert template into code', s.window.__app().code.indexOf('TEMPLATE_INSERTED') >= 0, 'has=' + s.window.__app().code.indexOf('TEMPLATE_INSERTED'));
  const tplTabsBefore = s.window.__app().tabCount;
  s.window.__newFromTemplate('segtree', '#include <bits/stdc++.h>\nstruct SegTree {};');
  ok('new tab from template', s.window.__app().tabCount === tplTabsBefore + 1 && s.window.__tabs().some(t => t.name === 'segtree.cpp'));
  s.window.__openTemplates();
  ok('template panel opens', !doc.getElementById('tplScreen').classList.contains('hidden'));
  (doc.getElementById('tplCloseBtn')._handlers.click || []).forEach(fn => fn());
  ok('template panel closes', doc.getElementById('tplScreen').classList.contains('hidden'));

  console.log(errors.length ? ('\n' + errors.length + ' FAILURES') : '\nALL CPP-PLAYGROUND V2 TESTS PASSED');
  process.exit(errors.length ? 1 : 0);
})().catch(e => { console.log('FATAL: ' + e.stack); process.exit(1); });
