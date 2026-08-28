# 前端首包 / 首页加载优化方案

> 状态：**方案 A、B、C、D 已落地**  
> 记录日期：2026-08-28 · A/B/C/D 实施：2026-08-28  
> 背景：本地打开首页时 JS 下载体积偏大；与 [主页 Figma 重写](./homepage-figma-rewrite-assessment.md) 同期排查  
> **约束：只改前端打包与加载方式，不改 Go 后台 / API / 数据库**

---

## 1. 现象

本地访问 `http://localhost:3000/`（当时为 **`npm run dev` / Node 开发服务**）时，首页 HTML 引用的静态资源中，以下文件体积最大：

| 文件（开发模式） | 约体积 | 说明 |
|------------------|--------|------|
| `vendors-…lobehub_icons…js` | **~35.8 MB** | 未压缩；含 `@lobehub/icons` + katex 相关 |
| `/static/js/index.js` | **~18 MB** | 未压缩主业务包 |
| `vendor-ui-primitives.js` | ~1.6 MB | UI 基础库 |
| `vendor-tanstack.js` / `lib-react.js` | 各约 1.2 MB | 框架拆包 |

CSS、UnionMeta landing SVG、`/api/status` 等均很小（毫秒级），**不是瓶颈**。

> 注意：开发模式 **不 minify**，且 `rsbuild.config.ts` 在 dev 下关闭了 TanStack 路由 `autoCodeSplitting`，本地数字会明显大于线上。评估线上效果必须以 **`npm run build`** 为准。

---

## 2. 生产构建实测（2026-08-28）

命令：`web/` 下 `npm run build`。

### 2.1 `index.html` 首屏同步脚本（gzip 估算）

| 资源 | raw | gzip 约 |
|------|-----|---------|
| `index.js` | ~3.5 MB | **~979 KB** |
| 共享包 `2549.js`（含 lobehub/katex 痕迹） | ~791 KB | **~239 KB** |
| React / TanStack / UI vendors | 合计 ~670 KB | **~213 KB** |
| CSS | ~430 KB | **~67 KB** |
| **首屏合计** | ~5.3 MB | **~1.5 MB gzip** |

生产比开发好看很多，但 **~1.5 MB gzip 首包仍偏重**，弱网下打开首页会感觉「加载忙」。

### 2.2 与本次 landing UI 的关系

- UnionMeta logo / `landing-theme.css`：**几 KB～十几 KB**，可忽略。
- 大包主因是 **原有依赖引入方式**（见 §3），不是 Figma 切图。

---

## 3. 根因

| # | 根因 | 位置 / 证据 |
|---|------|-------------|
| 1 | **`@lobehub/icons` 整包命名空间导入**，难以 tree-shake | `web/src/lib/lobe-icon.tsx`：`import * as LobeIcons from '@lobehub/icons'`；`node_modules/@lobehub/icons` 磁盘约 **36 MB**；首页 Models 实际只用约 **8** 个图标名 |
| 2 | **i18n 全量静态导入 7 个 locale JSON** | `web/src/i18n/config.ts` 同步 `import` en/zh/zh-TW/ja/fr/ru/vi；单文件约 400 KB+ |
| 3 | **KaTeX** 经 Markdown 进入共享图 | `web/src/components/ui/markdown.tsx` 等；首页未必需要公式仍可能跟载 |
| 4 | 开发模式放大观感 | `output.minify` 仅 production；dev 下 `autoCodeSplitting: false` |

调用 `getLobeIcon` 的页面较多（首页、定价、渠道、模型表等），任一同步引用整包都会把图标库拉进可达图。

---

## 4. 优化方案（按优先级）

**全部仅改 `web/`，不涉及后台。**

| ID | 方案 | 预期收益 | 难度 | 建议顺序 |
|----|------|----------|------|----------|
| **A** | 去掉 `import * as LobeIcons`：首页 Models **具名/白名单按需 import**；管理端改为动态 `import()` 或有限 map | 首页与首包可显著去掉大块 icons | 中 | **先做** |
| **B** | i18n **按语言懒加载**（默认只打当前/回退语言，切换语言再加载） | 主包少约 1–2 MB raw 量级 | 中 | 第二 |
| **C** | KaTeX / 数学 Markdown **动态 import**，用到公式再加载 | 缩小共享包 | 低～中 | 第三 |
| **D** | `rsbuild` `splitChunks` 将 `@lobehub/icons`、`katex` 独立 cacheGroup，并配合 A/C 异步加载 | 首屏不阻塞并行下载 | 低 | 配合 A/C |
| **E** | 性能评估统一用 **production build + preview/部署产物**，不用 dev 体积当线上指标 | 避免误判 | 无 | 流程 |

### 4.1 方案 A 细则（推荐首刀）

1. **首页** `models-strip.tsx`：对 `OpenAI` / `Claude` / `Gemini` / `Qwen` / `DeepSeek` / `Doubao` / `Github` / `Cline` 等改为 `@lobehub/icons` 下的 **按路径/具名导入**（包内已有分目录，如 `es/OpenAI`），不经过 `getLobeIcon` 整包。
2. **`getLobeIcon`**：改为  
   - 常用图标静态 map，或  
   - `import(\`@lobehub/icons/es/${baseKey}\`)` 动态加载 + 缓存；  
   **禁止** `import * as LobeIcons`。
3. 回归：定价页、渠道/模型表、Provider badge 等图标展示仍正常。

### 4.2 方案 B 细则

1. `i18n/config.ts` 不再静态 import 全部 JSON。
2. 启动只注册默认语言（如 `en` + 用户已选语言）；`i18n.on('languageChanged')` 或切换器内动态 `import('./locales/xx.json')`。
3. 注意与 `frontend-i18n-standard.md` 一致：key 规范不变，只改加载时机。

### 4.3 方案 C / D 细则

1. Markdown 中 `katex` / `katex.min.css` 改为异步加载（或仅在检测到 math 节点时加载）。
2. `rsbuild.config.ts` 增加 cacheGroup，例如匹配 `node_modules[\\/]@lobehub[\\/]icons`、`node_modules[\\/]katex`，避免与业务主包缠在一起；**必须**配合动态 import，否则仍会进首屏。

### 4.4 不做 / 低优先

- 为减包而删掉首页 Models 图标（体验差）。
- 压缩 UnionMeta SVG（已极小，收益可忽略）。
- 为减包而改后端或 `/api/status`。

---

## 5. 验收标准

| 项 | 标准 |
|----|------|
| 范围 | 无 Go / API / DB schema 变更 |
| 开发 | `npm run typecheck` 通过；首页 Models 图标仍正确 |
| 生产 | `npm run build` 成功；对比优化前后 **`index.html` 同步脚本 gzip 合计**（目标：明显低于当前 ~1.5 MB，理想首屏 JS gzip **&lt; 800 KB** 量级，以实测为准） |
| 功能 | 定价/渠道/模型等使用 `getLobeIcon` 的页面抽测通过；语言切换（若做 B）正常 |
| 本地对照 | 可用 `curl` / DevTools Network 对 `/static/js/*` 排序体积，勿仅看 dev |

### 5.1 建议对比命令（生产预览）

```bash
cd web
npm run build
npm run preview   # 或用现有静态托管方式指向 dist
# 打开首页 → Network 按 Size 排序，记录 index + 首屏 vendors gzip
```

---

## 6. 与其它文档的关系

| 文档 | 关系 |
|------|------|
| [homepage-figma-rewrite-assessment.md](./homepage-figma-rewrite-assessment.md) | Landing UI 重写；§0.5 大资源规则。本文件专讲 **JS 首包**，互补 |
| [frontend-i18n-standard.md](./frontend-i18n-standard.md) | 做方案 B 时遵守文案/key 标准，仅改加载策略 |

---

## 7. 决策记录

| 日期 | 结论 |
|------|------|
| 2026-08-28 | 已确认存在优化空间；方案 A→B→C/D 待排期实施 |
| 2026-08-28 | 用户确认：优化方案 **不影响后台代码**；先落本文档，实施另开 |
| 2026-08-28 | **方案 A 已实施**：去掉 `import * as LobeIcons`；首页 Models 静态按需 import；`getLobeIcon` → 异步 `LobeIcon` + 动态 `import(\`@lobehub/icons/es/${name}/index.js\`)`（webpackInclude 限制品牌目录）；`katex` 仍可走 async cacheGroup |
| 2026-08-28 | **方案 B 已实施**：`i18n/config.ts` 仅同步打包 `en`；其余语言 `import()` 懒加载；`changeLanguage` 前 `ensureLocaleLoaded`；`main.tsx` 经 `initI18n()` 后再渲染 |
| 2026-08-28 | **方案 C 已实施**：`katex-loader.ts` 动态 `import('katex')` + CSS；`Markdown` 仅在检测到 `$$` / math fence 时加载；无公式内容不拉 KaTeX |
| 2026-08-28 | **方案 D 已实施**：细化 `splitChunks`（home 图标白名单合并、其余 `lobe-icon-*`、`vendor-katex`、`locale-*`）；Rspack 的 `name` 不可返回 `false`，改为按路径字符串命名 |

### 7.1 方案 A 实施后实测（production build）

| 项 | 优化前 | 优化后 |
|----|--------|--------|
| 开发态整包 lobehub vendors | ~35.8 MB sync | 不再以整包 sync vendors 形式出现 |
| `index.html` 同步脚本 gzip 合计 | ~1.5 MB | ~1.5 MB（**主因仍是 i18n 全量进 `index.js`**，见方案 B） |
| lobehub 加载方式 | 进共享 sync 图 | **按图标异步 chunk**（构建后 `async/` 下大量 &lt;50KB 小包，约 400+） |
| 首页 Models 图标 | 经 `getLobeIcon` 整包 | `@lobehub/icons/es/{Claude,OpenAI,…}` 静态具名，不经 barrel |

**结论：** A 已消除「整包 icons 进主图」；首屏 gzip 要再降需做 **B（i18n 懒加载）**。

### 7.2 方案 B 实施后实测（production build，A+B）

| 项 | A 之后 | A+B 之后 |
|----|--------|----------|
| `index.js` raw / gzip | ~3.5 MB / ~979 KB | **~1.1 MB / ~260 KB** |
| `index.html` 同步脚本+CSS gzip 合计 | ~1.5 MB | **~0.76 MB（~778 KB）** |
| 非英语 locale | 全进主包 | 独立 async chunk，切换语言时再下载 |

**结论：** 首屏 gzip 已降到文档目标 **&lt; 800 KB** 量级。

### 7.3 方案 C 实施后实测（production build，A+B+C）

| 项 | A+B | A+B+C |
|----|-----|-------|
| 首屏同步脚本+CSS gzip 合计 | ~778 KB | **~698 KB** |
| KaTeX JS/CSS | 曾在同步共享包（如原 `2549` + css） | **`async/vendor-katex*.js`（~257 KB）+ `vendor-katex*.css`**，仅含公式 Markdown 时加载 |
| 无公式 Markdown / 首页默认 landing | 仍可能间接带上 katex | **不下载 KaTeX** |

### 7.4 方案 D 实施后实测（production build，A+B+C+D）

`rsbuild.config.ts` `splitChunks.cacheGroups` 调整要点：

| cacheGroup | 作用 |
|------------|------|
| `vendor-lobehub-icons-home` | 首页 Models 白名单 8 图标合并为 **一个** async 包（~105 KB）；首页在 prod 为路由异步包，故用 `chunks: 'async'`，不是 `initial` |
| `vendor-lobehub-icons-async` | 其余 `LobeIcon` 动态 import **按品牌目录命名**（`lobe-icon-*`）；禁止整包固定 `name`（曾合成 ~5 MB） |
| `vendor-katex` | KaTeX 独立 async（配合 C） |
| `locale-json` | 懒加载语言包命名为 `locale-{lang}` |

| 项 | A+B+C | A+B+C+D |
|----|-------|---------|
| 首屏同步脚本+CSS gzip 合计 | ~698 KB | **~704 KB**（拆包微调，首屏量级不变） |
| 首页 Models 图标 | 分散在多个 async 小包 | **`async/vendor-lobehub-icons-home*.js`（~105 KB）** |
| 其它 lobehub 图标 | 自动/分散 async | **`lobe-icon-{Brand}*.js`（约 600+）**，无整包 mega chunk |
| 非英语 locale | async | **`locale-zh` / `locale-ja` 等稳定文件名** |
| KaTeX | `vendor-katex` async | 同上 |

**结论：** D 主要改善 **缓存稳定性与并行下载结构**；首屏 gzip 已由 A+B+C 压到目标区间，D 不再追求再砍首屏。

---

## 8. 待办勾选

- [x] A：首页图标按需 + 改造 `getLobeIcon`
- [x] B：i18n 按语言懒加载
- [x] C：KaTeX 动态加载
- [x] D：`splitChunks` — home 白名单合并、其余按图标命名、katex/locale 独立；**禁止**整包 `@lobehub/icons` mega async
- [x] E：用 production 产物做前后对比并回填实测数字（§7.1–§7.4）
