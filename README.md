# 💻 C++20 在线编译器

一个仿 **CPH-NG（VS Code 插件）** 体验的在线 C++20 编译器/刷题环境：

- **CodeMirror 6** 编辑器（本地内置，零 CDN）——流畅书写、One Dark 配色、C++ 语法高亮
- **VS Code 风格多标签**：上方标签栏，可新建 / 关闭 / 双击重命名 / 多文件切换
- **F9 运行样例**：右侧测试用例面板（输入 + 期望输出），一键全部运行并逐项比对通过/失败，**每个用例显示耗时**
- **用例抓取**：粘贴题目 URL（AtCoder / Codeforces）自动抓取样例输入输出
- **自定义时限**：可设单次运行时限（毫秒），**超时自动中止请求，防止卡死**（标记 ⏱ 超时）
- **代码分享**：📤 一键复制带代码+用例的分享链接，好友打开即加载
- **大样例本地上传**：每个用例有"上传"按钮，或直接把 `.in/.out` 文件**拖到用例输入/期望框**上自动填入
- **拖拽本地代码**：`.cpp/.h/.txt` 拖进页面自动新建标签（修复了编辑器拦截拖拽的问题）
- **快捷键齐全**：F9 运行样例 · Ctrl+Enter 自定义输入 · Ctrl+S 保存 · Ctrl+N 新建 · Ctrl+W 关闭 · Ctrl+O 打开 · Tab 缩进 · Ctrl+/ 注释 · Ctrl+F 查找
- **本地持久化**：代码、用例、后端/编译器/时限设置自动保存（localStorage）
- **C++20 支持**：默认 `-std=c++20 -O2`，可切换 GCC 最新 / GCC 13 / Clang 等编译器

**在线使用：https://wangnono666.github.io/cpp-playground/**

## 编译后端

| 后端 | 说明 |
|---|---|
| Wandbox（默认） | 免费公开 API，支持 C++20/23，稳定 |
| Compiler Explorer | 自动兜底（Wandbox 不可用时） |

> 编译在远端公共服务器进行，代码会上传至第三方（Wandbox / Godbolt），**不要粘贴敏感信息**。
> 时间显示为客户端实测耗时（含编译与网络）；内存统计后端不提供，显示为 —。

## 快捷键

| 快捷键 | 功能 |
|---|---|
| `F9` | 编译并运行全部测试用例（比对期望输出） |
| `Ctrl+Enter` | 用「自定义输入」框的内容运行当前代码 |
| `Ctrl+S` | 下载当前文件 |
| `Ctrl+N` / `Ctrl+W` | 新建 / 关闭标签 |
| `Ctrl+O` | 打开本地文件 |
| `Tab` / `Shift+Tab` | 缩进 / 反缩进 |
| `Ctrl+/` | 行注释 / 取消注释 |
| `Ctrl+F` | 查找替换 |

## 用例抓取

在测试用例面板顶部输入题目 URL 点「抓取」：
- **AtCoder**：`https://atcoder.jp/contests/xxx/tasks/xxx`（直连或代理自动兜底）
- **Codeforces**：`https://codeforces.com/problemset/problem/xxx/xxx`
- 其他站点走通用解析（样例输入/输出块）

## 文件结构

```
cpp-playground/
├── index.html          # 应用本体（HTML/CSS/JS 内联）
├── editor.bundle.js    # CodeMirror 6 打包产物（esbuild 单文件）
├── README.md
└── cpp-smoke.js        # 冒烟测试（node cpp-smoke.js，含真实编译与网络）
```

## 本地运行

双击 `index.html` 即可（需与 `editor.bundle.js` 同目录），或 `npx serve` / 任意静态服务器。

## 开发说明

`editor.bundle.js` 由 CodeMirror 6 + `@codemirror/lang-cpp` + `@codemirror/theme-one-dark` 经 esbuild 打包（IIFE 单文件），无运行时 CDN 依赖。
