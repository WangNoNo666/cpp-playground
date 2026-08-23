# 💻 C++20 在线编译器

一个仿 **CPH-NG（VS Code 插件）** 体验的在线 C++20 编译器/刷题环境：

- **CodeMirror 6** 编辑器（本地内置，零 CDN）——流畅书写、One Dark 配色、C++ 语法高亮
- **VS Code 风格多标签**：上方标签栏，可新建 / 关闭 / 双击重命名 / 多文件切换
- **F9 运行样例**：右侧测试用例面板（输入 + 期望输出），一键全部运行并逐项比对通过/失败
- **快捷键齐全**：F9 运行样例 · Ctrl+Enter 自定义输入 · Ctrl+S 保存文件 · Ctrl+N 新建 · Ctrl+W 关闭标签 · Ctrl+O 打开文件 · Tab 缩进 · Ctrl+/ 注释 · Ctrl+F 查找
- **拖拽本地文件**：把 `.cpp/.h/.txt` 拖进页面，自动新建标签打开
- **本地持久化**：代码与测试用例自动保存到浏览器（localStorage），刷新不丢
- **C++20 支持**：默认 `-std=c++20 -O2`，可切换 GCC 最新 / GCC 13 / Clang 等编译器与编译参数

**在线使用：https://wangnono666.github.io/cpp-playground/**

## 编译后端

| 后端 | 说明 |
|---|---|
| Wandbox（默认） | 免费公开 API，支持 C++20/23，稳定 |
| Compiler Explorer | 自动兜底（Wandbox 不可用时） |

> 编译在远端公共服务器进行，代码会上传至第三方（Wandbox / Godbolt），**不要粘贴敏感信息**。

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

## 文件结构

```
cpp-playground/
├── index.html          # 应用本体（HTML/CSS/JS 内联）
├── editor.bundle.js    # CodeMirror 6 打包产物（esbuild 单文件）
├── README.md
└── cpp-smoke.js        # 冒烟测试（node cpp-smoke.js，含真实编译）
```

## 本地运行

双击 `index.html` 即可（需与 `editor.bundle.js` 同目录），或 `npx serve` / 任意静态服务器。

## 开发说明

`editor.bundle.js` 由 CodeMirror 6 + `@codemirror/lang-cpp` + `@codemirror/theme-one-dark` 经 esbuild 打包（IIFE 单文件），无运行时 CDN 依赖。
