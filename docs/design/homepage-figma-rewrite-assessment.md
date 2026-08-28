# 主页 Figma 重写评估

> 状态：**实施中（4C 首版已落地前端）**  
> 设计稿：[UnionMeta-AI — Home](https://www.figma.com/design/r57a1aMxUHH5NvIBQRXJ43/UnionMeta-AI?node-id=55-3500)  
> 评估日期：2026-08-27 · 决策确认：2026-08-28  
> 结论：**中等难度（约 3/5）** — 非从零搭建，主要是视觉对齐与区块重组  
> **约束：仅换 UI，不改后台逻辑**（见 §0）  
> **规则：开工前先本地化 Figma 资源；导出文件默认勿手改**（见 §0.5）  
> **首版范围：4C** — Hero / Models / Enterprise / Footer + Get in Touch + 隐藏多余 section（见 §0.7）  
> **相关：** 首页 JS 首包偏大的排查与优化方案见 [frontend-bundle-optimization.md](./frontend-bundle-optimization.md)（与本次切图无关，属原有依赖引入方式）

---

## 0. 实施约束（已确认）

**只改前端呈现，不动后端。**

### 0.1 允许改动

| 范围 | 说明 |
|------|------|
| `web/src/features/home/**` | section 组件、布局、样式、动画 |
| `web/src/components/layout/**` | `PublicHeader`、`Footer` 等公共壳 UI |
| `web/src/styles/**` | landing 专用 CSS 变量、动画（尽量 scoped，避免波及控制台） |
| `web/src/assets/**` | Figma 导出的 SVG / 图片 |
| `web/src/i18n/locales/**` | 文案调整（仅翻译 JSON，无 API 变更） |

### 0.2 禁止改动

| 范围 | 说明 |
|------|------|
| Go 后端 | 不新增/修改 controller、router、model、option |
| API | 不新增接口；现有 `/api/status`、`/api/home_page_content` 等调用方式不变 |
| 系统设置表单 | 不为 landing 新增后台配置项（如联系邮箱、FeedbackUrl 类扩展） |
| 认证 / 注册 / 路由守卫 | CTA 仍链到现有 `/sign-up`、`/dashboard` 等 |
| `HomePageContent` 覆盖逻辑 | iframe / HTML / Markdown 分支保持原样 |

### 0.3 UI 层复用现有数据（只读）

- **`useStatus()`**：logo、docs 链接、注册开关、demo 模式等 — 只改展示
- **`useTopNavLinks()`**：导航项 — 只改样式，不改数据来源
- **`useHomePageContent()`**：自定义首页 — 逻辑不动
- **`useAuthStore()`**：已登录时 CTA 文案/跳转 — 逻辑不动
- **Enterprise「Create enterprise account」**：仍走现有 `/sign-up` 或 onboarding，不新增开户 API

### 0.4 对评估的影响

- 难度 **略降**：无需前后端联调、迁移、部署顺序
- 「Get in Touch」弹窗：邮箱 **写死** `support@unionmeta.com`（§0.7），**不新增后台配置**
- 工作量仍主要在 CSS / 布局 / 响应式 / i18n

### 0.5 资源本地化规则（开工前必做）

**每个 section 写 UI 代码之前，须先把该 section 用到的 Figma 导出资源下载到工程内；禁止在会提交的代码里使用 Figma MCP 临时 URL。**

#### 为什么

- Figma MCP / `figma.com/api/mcp/asset/*` 链接 **约 7 天过期**，不能作为生产依赖
- 本地 SVG 可 diff、可离线构建、不依赖外网

#### 存放目录

```
web/src/assets/landing/
  hero-glow-1.svg          # Ellipse 6017
  hero-glow-2.svg          # Ellipse 6018
  hero-glow-3.svg          # Ellipse 6019
  unionmeta-logo-horizontal.svg
  …                        # 按 section 增补，kebab-case 命名
```

- 仅 landing 专用资源放此目录；可复用全站 logo 则优先 `web/src/assets/logo.tsx` 等现有文件
- 在组件中通过 `import` 或 `/src/assets/landing/...` 引用，**不得**硬编码 `https://www.figma.com/api/mcp/asset/...`

#### 下载方式（任选）

1. Figma 设计稿中选中图层 → Export → SVG（推荐）
2. Cursor Figma MCP `download_assets` → 目标路径 `web/src/assets/landing/`
3. 开发调试可临时用 MCP URL，**合并前必须替换为本地路径**

#### 不必下载（用代码 / 现成库）

| 类型 | 做法 |
|------|------|
| 模型 / 应用 logo | `@lobehub/icons` + `getLobeIcon()` |
| Header 语言 / 主题图标 | `lucide-react` 或现有 custom icon |
| 渐变标题、pill 按钮、深色背景 | Tailwind / CSS 变量 |
| Stats 数字 | 现有 `features/home/constants.ts` |

#### 按 section 的最低资源清单

| Section | 开工前至少本地化 |
|---------|------------------|
| Hero + Header | 背景光晕 ×3、横版 Logo（若与现组件不同）、可选 CTA 箭头 |
| ModelsStrip | 通常 **无**（icons 库） |
| Enterprise | 若有 Figma 专属插图再补；否则可先写 UI |
| Footer | 通常 **无**（Logo 复用 Hero） |
| Get in Touch 弹窗 | Logo 复用；邮件 icon 用 lucide |

#### 验收

- [ ] `web/src/assets/landing/` 已创建且资源已入库
- [ ] `grep` 全库无 `figma.com/api/mcp/asset` 出现在 `web/src/**`
- [ ] 对应 section 的 PR 仅引用本地 `import` 路径

#### 勿改导出文件（保真规则）

**默认：不要手改 `web/src/assets/landing/` 里从 Figma 下载的 SVG/PNG 内容。**

手改 path、渐变 stop、filter、opacity、viewBox 等，很容易与 Figma 稿不一致，后续也难以对照设计稿排查「为何不像」。

| 需求 | 正确做法 | 避免 |
|------|----------|------|
| 位置 / 大小 | 外层 CSS：`absolute`、`width`、`transform` | 改 SVG 内 `width`/`height` |
| 透明度 / 混合 | 包一层 `div` + `opacity` / `mix-blend-mode` | 改 SVG 内 `opacity` |
| 主题色 icon | 回 Figma 导出带 `currentColor` 的版本，或 **复制** 为 `*- themed.svg` 再改 | 直接改唯一一份导出 |
| 光晕不够 / 颜色偏了 | 回 Figma 调图层后 **重新 Export 覆盖** | 在代码里「试」改 gradient |
| 体积优化 | 保留 `*.svg` 原文件；可选另存 `*.optimized.svg` 并肉眼对比 | SVGO 就地覆盖且无视觉回归 |

**若必须改 SVG：** 复制一份（如 `hero-glow-1.themed.svg`），**保留 Figma 原导出不动**，便于 diff 与重新导出覆盖。

**与 Figma 不一致时：** 优先怀疑 CSS 布局/缩放，其次回 Figma 重导；不要长期维护「改过的」单份资源当唯一来源。

**实施顺序：** 先完成 **当前要做 section** 的资源本地化 → 再改该 section 的 TSX/CSS（见 §5 步骤 0）。

#### 大资源与加载性能

Figma 导出常会偏大（光晕 ellipse、@2x PNG、带 filter 的 SVG）。**不能直接把大文件丢进仓库而不处理**，否则拖慢首页 LCP/FCP。

##### 优先级（从高到低）

1. **能用 CSS 就不用图片** — 现网 Hero 已用 `radial-gradient` 做光晕（见 `hero.tsx`），与 Figma 三枚 ellipse **视觉对齐时优先 CSS**，体积接近 0
2. **必须上图时控格式与尺寸** — 简单图形 SVG；照片/复杂渐变用 **WebP**（必要时 AVIF），避免无压缩 PNG
3. **只加载当前路由需要的资源** — landing 资源仅在 `features/home/**` 内 `import`，不要进全局 bundle
4. **首屏 vs 非首屏分开策略** — 见下表

##### 体积预算（建议，入库前自检）

| 类型 | 单文件建议 | 超出时 |
|------|-----------|--------|
| 装饰 SVG（光晕、纹理） | ≤ 20 KB | 改 CSS 光晕，或 Figma 简化图层后重导 |
| Logo SVG | ≤ 30 KB | Figma「Outline stroke」+ 仅导出必要图层 |
| 位图（若有） | ≤ 80 KB（WebP） | 压缩 / 降分辨率 / `srcset` 多档 |
| **Hero 区合计（首屏）** | ≤ 100 KB | 必须减载或改 CSS |

自检：Windows `Get-Item` / `ls -la` 看字节数；PR 里注明最大资源体积。

##### 首屏 / 非首屏

| 资源 | 策略 |
|------|------|
| Header Logo | 可同步 `import`（小 SVG）；LCP 候选时可 `fetchPriority="high"` |
| Hero 背景光晕 | **优先 CSS**；若用 SVG：`decoding="async"`、`aria-hidden`，一般 **不** preload |
| Models / Enterprise 插图 | 低于 fold → `loading="lazy"` + `decoding="async"` |
| 弹窗内图片 | 弹窗打开后再挂载组件（自然延迟加载） |

##### Figma 导出设置（从源头变小）

- Export **1x**，不要默认 @2x/@3x（除非 Retina 位图且无法用 CSS）
- 光晕/模糊层：在 Figma 检查是否可改为纯渐变；filter -heavy 图层导出 SVG 往往很大
- 位图：Export **WebP** 或 PNG 后再用 Squoosh / `cwebp` 转 WebP，**另存** `*.webp`，保留原导出对照（配合「勿改原文件」规则）

##### 优化文件时的规则（与保真并存）

- Figma 原导出 **保留** `hero-glow-1.svg`
- 压缩版 **另存** `hero-glow-1.optimized.svg` 或改用 CSS，**肉眼对比 Figma 截图**后再替换引用
- 禁止：未对比就 SVGO 覆盖唯一源文件

##### 不推荐

- 多枚全屏 PNG 光晕（动辄数百 KB～MB）
- 首页一次性 `import` 所有 section 的大图
- 对装饰图 `preload`（抢带宽、拖 LCP）
- 为 landing 引入新 CDN/后端图片服务（本期 **仅 UI**，无后台变更）

##### 验收（性能）

- [ ] Hero 首屏静态资源合计 ≤ 100 KB（或已用 CSS 替代大图）
- [ ] 无单文件 > 200 KB 进入 `web/src/assets/landing/`（除非 PR 说明理由）
- [ ] 折叠以下图片均 `loading="lazy"`（若用 `<img>`）
- [ ] Lighthouse / Network：首页无 MB 级装饰资源

### 0.6 Landing 底色与全站 Theme

Figma Home 画布底色为 **`#1e1e1e`**，文字主色约 **`#f4f4f4`**、次级 **`#a3a3a3`**、边框 **`#3a3a3a`**、品牌按钮 **`#7b50e3`**。

现网 `PublicLayout` 使用全站 semantic token（`bg-background` / `text-foreground`）：

| 模式 | 现网 `--background`（约） | 与 Figma 差异 |
|------|---------------------------|---------------|
| light | 白色 | 完全不同 |
| dark | `oklch(0.235 0 0)` ≈ `#3a3a3a` 量级 | **比 Figma 更亮**，且随 theme preset 变化 |

**不要**为对齐 Figma 去改 `theme.css` 全局 dark/light（会波及控制台、设置页等）。

#### 推荐：Landing 局部 Theme（scoped tokens）

仅在首页（及若需一致的 `/` 默认 landing）包一层 **`landing-theme`**，覆盖局部 CSS 变量，不动全局 theme、不改后台。

```tsx
// features/home/index.tsx — 概念示例
<PublicLayout showMainContainer={false} className='landing-theme'>
  …
</PublicLayout>
```

```css
/* web/src/styles/landing-theme.css — 从 Figma 变量表取值 */
.landing-theme {
  --background: #1e1e1e;
  --foreground: #f4f4f4;
  --muted-foreground: #a3a3a3;
  --border: #3a3a3a;
  --primary: #7b50e3;
  --primary-foreground: #ffffff;
  /* 按需补 card / accent，避免 section 内硬编码 */
  background-color: var(--background);
  color: var(--foreground);
}
```

`PublicHeader` / `Footer` 已在 layout 内且用 `bg-background`、`text-foreground` 时，会 **自动继承** 这层变量，无需逐组件改色。

#### 与主题切换（ThemeSwitch）的关系

| 方案 | 说明 | 推荐 |
|------|------|------|
| **A. Landing 固定深色** | `/` 始终 Figma 深色；Header 上主题开关对首页无效或隐藏 | ✅ 与 Figma / 多数营销站一致 |
| B. Landing 跟随 dark，light 仍用 Figma 色 | light 用户也看到 `#1e1e1e` | 可选，本质同 A |
| C. Landing 完全跟随全站 light/dark | light 下首页变白，**与 Figma 不一致** | ❌ 除非另有 light 稿 |

**建议选 A**：营销首页固定 `landing-theme`；用户进 Console / Dashboard 仍用原有 theme。

#### 其它 public 页（pricing / rankings）

默认 **不** 套 `landing-theme`，继续跟全站 theme；若产品要求全 public 统一深色，再单独评估。

#### 验收

- [ ] 仅 `web/src/styles/landing-theme.css` + Home 根节点 class，未改全局 `theme.css` 默认值
- [ ] 首页背景目测 ≈ `#1e1e1e`，控制台/other 页不受影响
- [ ] section 内无散落 `#1e1e1e` 硬编码（统一走变量）

### 0.7 产品决策（2026-08-28 已确认）

| # | 决策 | 结论 |
|---|------|------|
| **1A** | Figma 没有的 section | **隐藏** Showcase / Features / HowItWorks / CTA（组件文件可保留，仅 `home/index.tsx` 不渲染） |
| **2A** | Get in Touch 邮箱 | **写死** `support@unionmeta.com`（不读 status、不新增后台项） |
| **3A** | 移动端 | **开发自适应**（无单独 Figma 移动稿；按现网断点收拢） |
| **4C** | 首版范围 | **完整对齐 Figma**：Hero + Models + Enterprise + Footer + Get in Touch 弹窗 + 1A 隐藏多余 section |

#### 首版目标页面结构

```
PublicLayout + landing-theme
  → PublicHeader（样式对齐 Figma）
  → Hero（含 stats）
  → ModelsStrip（散点 / 响应式）
  → Enterprise
  → Footer
  → Get in Touch Dialog（邮箱常量）
```

不渲染：Showcase、Features、HowItWorks、CTA。

---

## 1. Figma 与 MCP

### 1.1 链接解析

| 字段 | 值 |
|------|-----|
| fileKey | `r57a1aMxUHH5NvIBQRXJ43` |
| nodeId | `55:3500`（页面 **Home**） |
| 主要子节点 | Hero `66:4829`、模型区 `66:4719`、Enterprise `66:4894`、Footer `66:4796`、联系弹窗 `66:5025` |

### 1.2 MCP 连接状态（2026-08-27 实测）

| 项目 | 状态 |
|------|------|
| Cursor MCP 命名空间 | `user-figma` ✅ |
| 文件读取 | ✅ `get_metadata` / `get_design_context` 可用 |
| 账号 | `jinwei.yang126@gmail.com` |
| 团队席位 | **View**（读设计 OK；Figma 内写操作可能受限） |

### 1.3 设计稿页面结构（Figma）

```
Header
  → Hero（含 eyebrow、双行标题、副文案、CTA、四列 stats）
  → Compatible models / Supported Applications（散点图标布局）
  → Enterprise（组织 / 工作区说明 + 三列能力卡片）
  → Footer
  → Get in Touch 弹窗（support@unionmeta.com）
```

---

## 2. 现网主页架构

路由 `/` → `web/src/routes/index.tsx` → `features/home/index.tsx`，使用 `PublicLayout`（非 Dashboard）。

### 2.1 当前默认区块（9 段）

```
Hero
  → Showcase（终端 API 演示）
  → ModelsStrip
  → Features
  → Enterprise
  → HowItWorks
  → Stats
  → CTA
  → Footer
```

### 2.2 关键文件

| 用途 | 路径 |
|------|------|
| 首页编排 | `web/src/features/home/index.tsx` |
| 各 section | `web/src/features/home/components/sections/*.tsx` |
| 静态数据 | `web/src/features/home/constants.ts` |
| 公共头 | `web/src/components/layout/components/public-header.tsx` |
| 页脚 | `web/src/components/layout/components/footer.tsx` |
| 动画 | `web/src/components/animate-in-view.tsx` |
| 模型图标 | `web/src/lib/lobe-icon.tsx`（`@lobehub/icons`） |
| 主题 token | `web/src/styles/theme.css`、`web/src/styles/index.css` |
| i18n | `web/src/i18n/locales/*.json`（7 语言） |

### 2.3 后台覆盖

系统设置 → 站点 → `HomePageContent` 可配置 iframe / HTML / Markdown，**有内容时跳过默认 landing**。重写需保持该逻辑不变。

---

## 3. Figma vs 现网对照

| Figma 区块 | 现网组件 | 重合度 | 备注 |
|-----------|---------|--------|------|
| Header | `PublicHeader` | 高 | 导航项、Sign Up、语言/主题图标需对齐样式 |
| Hero + stats | `Hero` + `Stats` | 高 | Figma 将 stats 并入 Hero；需合并或调整顺序 |
| 模型 / 应用 | `ModelsStrip` | 中 | 文案一致；Figma 为散点布局，现为 pill badge 横排 |
| Enterprise | `Enterprise` | 高 | 组织 / 工作区层级图已有，视觉需对齐 |
| Footer | `Footer` | 高 | 链路与 demo 模式逻辑保留 |
| Get in Touch 弹窗 | 无 | 新（纯 UI） | `Dialog` + 邮箱常量 `support@unionmeta.com`（§0.7 / 2A） |
| Showcase 终端演示 | `Showcase` | — | **首版不渲染**（§0.7 / 1A） |
| Features 六宫格 | `Features` | — | **首版不渲染**（§0.7 / 1A） |
| How it works | `HowItWorks` | — | **首版不渲染**（§0.7 / 1A） |
| 底部 CTA | `CTA` | — | **首版不渲染**（§0.7 / 1A） |

### 3.1 文案（已基本对齐）

以下 i18n key 现网已有，重写时优先复用：

- `Connect. Route. Scale. Instantly.`
- `Compatible models`
- `One protocol. Models from OpenAI, Claude, Gemini, DeepSeek, Qwen, and more.`
- `Supported Applications`
- `Enterprise plan` / `Customers and workspaces`

### 3.2 视觉差异（主要工作量）

- 深色营销背景（Figma `#1e1e1e`）与背景光晕 ellipse
- 字体 **Public Sans**（现网 `theme.css` 已引入）
- 渐变标题：`Better Models & Better Prices`（cyan → purple）
- 品牌主色 pill 按钮（Figma `#7b50e3`）
- 模型图标散点定位 vs 现有 flex-wrap

---

## 4. 难度评估

**总评：中等（3/5）**

### 4.1 为什么不算难

- 首页路由、layout、section 拆分、shadcn/ui、Tailwind、i18n、滚动动画均已就绪
- 模型 logo 依赖 `@lobehub/icons`，无需从零找素材
- 与 Figma 对应的业务区块（Hero、Models、Enterprise、Footer）大部分已有实现

### 4.2 为什么不是小改

| 因素 | 级别 | 说明 |
|------|------|------|
| 区块重组 | 低 | 已确认 1A：隐藏 4 段，仅改 `home/index.tsx` 编排 |
| 视觉还原 | 中 | 渐变、光晕、字体、按钮形态需逐段调 |
| 响应式 | 中 | Figma 1920 桌面稿；3A 由开发自适应 |
| i18n | 中 | 新文案需同步 7 个 locale 文件 |
| 资源 | 低 | Figma MCP 导出 SVG **7 天过期**，需下载到 `web/src/assets` |
| 全站 theme | 低–中 | 深色 landing 与控制台 theme 一致性 |
| 后台覆盖 | 低 | 不改 `HomePageContent` 与任何 Go/API |

### 4.3 工作量粗估

| 范围 | 难度 | 预估 |
|------|------|------|
| 仅 Hero + Header | 低–中 | 0.5–1 天 |
| 主要区块对齐（Hero / Models / Enterprise / Footer） | 中 | 2–3 天 |
| 像素级还原 + 移动端 + 弹窗 + i18n | 中–高 | 4–6 天 |

---

## 5. 建议实施顺序

0. **资源本地化（必做）**：按 §0.5 为即将开发的 section 导出 SVG 到 `web/src/assets/landing/`，确认无 MCP 临时 URL 后再写组件
1. **Design tokens**：品牌色、Public Sans、landing 深色变量（避免每段硬编码）
2. **Hero + PublicHeader**：最快可见效果，可与 Figma 截图对比
3. **ModelsStrip 布局**：散点 / 网格响应式（风险最高的一段）
4. **Enterprise + Footer**：在现有组件上改视觉
5. **Get in Touch 弹窗**：纯 UI `Dialog`，邮箱常量 `support@unionmeta.com`（2A）
6. **首页编排**：`home/index.tsx` 按 1A 不渲染 Showcase / Features / HowItWorks / CTA
7. **i18n**：新/改文案同步 7 个 locale 文件

**全程约束：** 所有 PR 仅含 `web/` 下文件，不含 `*.go`、路由定义变更、新 API。

### 5.1 首版交付（已确认 4C）

一次交付对齐 Figma 的完整 landing：

1. `landing-theme` + PublicHeader + Hero（含 stats）
2. ModelsStrip + Enterprise + Footer
3. Get in Touch 弹窗
4. 隐藏 Showcase / Features / HowItWorks / CTA

可按 section 拆 PR，但目标范围是 **4C 全量**，不是仅 Hero+Header。

---

## 6. 实施前检查清单

### 6.1 产品决策（已全部确认）

- [x] **1A** 隐藏 Showcase / Features / HowItWorks / CTA
- [x] **2A** Get in Touch 邮箱写死 `support@unionmeta.com`
- [x] **3A** 移动端由开发自适应
- [x] **4C** 首版完整对齐 Figma（含弹窗）
- [x] Landing 底色：scoped `landing-theme` 固定深色（§0.6）
- [x] Public Sans：现网已引入，无需另开 webfont 决策

### 6.2 开工步骤 0（资源，动手前完成）

- [x] §0.5：`web/src/assets/landing/` 已创建；Hero 等必要资源已入库
- [x] 无 `figma.com/api/mcp/asset` 出现在将提交的 `web/src/**`

---

## 7. 相关文档

- [customer-experience-iteration-design.md](./customer-experience-iteration-design.md)
- [frontend-i18n-standard.md](./frontend-i18n-standard.md)
