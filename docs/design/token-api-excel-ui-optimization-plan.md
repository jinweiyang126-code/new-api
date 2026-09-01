# Token API Excel UI 优化方案

> 来源：`Token API.xlsx`（Sign up / Home / Model Square）  
> 设计稿：[UnionMeta-AI Figma](https://www.figma.com/design/r57a1aMxUHH5NvIBQRXJ43/UnionMeta-AI?node-id=55-3500&p=f)  
> 状态：**已开工实施中**（收到开工指令后）  
> 更新日期：2026-09-01

### 实施进度（本轮）

| 项 | 状态 |
|----|------|
| 首页恢复 Showcase / Features / HowItWorks / CTA（Stats 模块已去掉，数字留在 Hero） | 已完成 |
| Enterprise 去掉 Get in Touch | 已完成 |
| Auth 圆角 12px / 浅色 glow / placeholder / focus / 顶距 128px | 已完成 |
| Forgot password 点状下划线（“...”观感）去掉 | 已完成 |
| Resend 倒计时展示修复 | 已完成 |
| 验证页 Back + 改邮箱图标 | 已完成 |
| `POST /api/user/check-email` + 注册 blur/提交校验 | 已完成 |
| Model Square 折叠 ≤6 全展、卡片整卡点击/悬停复制/标签 +N | 已完成 |
| 搜索框白色描边 focus | 已完成 |
| Hero 底部数字统计 | **保留**；独立 Stats 模块已去掉 |
| Figma 专用 SVG 切图（侧边栏 icon、Enterprise 打勾等） | 已接入（见 `web/src/assets/figma/`） |
| Get in Touch 弹窗精细样式 | 已换 Figma Security 图标 + 圆角 12px |
| Auth OAuth 深/浅按钮底色 | 浅 `#fff` / 深 `#1e1e1e`（对齐 Figma） |
| Auth Continue 胶囊按钮 / 占位词条 | 已对齐 Figma |
| Model Card 圆角 20px / 浅色白底悬停 `#f9f9f9` | 已对齐 Figma Light |
| 浅色首页 token（card `#fdfdfd` / border `#e8e8e8` / org 蓝底） | 已对齐 |
| Enterprise 浅色：org 行、圆角 20、打勾徽章、Layers/功能图标 | 已对齐 |
| ModelsStrip 浅色软阴影 + Cursor cube | 已对齐 |
| Hero 浅色描边按钮 `#3a3a3a` | 已对齐 |
| Pricing 筛选空勾选框浅色 `#fdfdfd`/`#dbdbdb` | 已对齐 |
| Get in Touch 弹窗：Logo → 标题 32px → 邮箱条 → CTA | 已对齐 Light |
| HowItWorks / CTA 描边 / ModelsStrip 64px 瓷砖 | 已对齐 |
| Model Square 侧栏白底 + 搜索浅色 focus | 已对齐（浅色外扩 ring） |
| 营销顶栏滚动浅色半透白 | 已加强 |
| Auth 验证页：去掉 Continue，满 6 位自动提交 | 已按确认实现 |
| Model Square 顶部 glow 与首页 landing-glow 统一 | 已修 |
| Enterprise 顶标 UnionMeta mark + 正文 16px | 已修 |
| OTP 浅色默认边框 / OAuth stack 12px / 忘记密码占位 | 已修 |
| Footer 顶链与 tagline 同行对齐 | 已修 |

---

## 1. 已确认决策

| # | 议题 | 决策 |
|---|------|------|
| 1 | 实施范围 | **三块全做**：Sign up & Login、Home、Model Square |
| 2 | 首页被删模块 | **按中间态 `3a0139f8` 恢复**下列模块（见 §3） |
| 3 | Get in Touch | **仅去掉 Enterprise 区内按钮**；Footer / 联系弹窗保留 |
| 4 | 邮箱占用提示 | **新增后端接口**，在注册上一步（填邮箱）提示 |
| 5 | 设计资源 | 对照上述 Figma 链接导出 SVG / 对齐样式 |
| 6 | 导航 Doc | **不改前端**；由后台控制显示 |

### 第五节「近期已做」核对

| 项 | 状态 |
|----|------|
| 深色 Auth 背景 `#161616`、边框 `#2E2E2E` | 已优化，验收可关 |
| OAuth 品牌图标 | 已优化，验收可关（若 Figma 仍有差异再微调） |
| Turnstile 预加载 + 登录无法律勾选 | 已优化，验收可关 |
| 验证码 Resend 倒计时 | **已修复**（拼接 `(Ns)`，避免 i18n 插值丢失） |

---

## 2. 首页模块对照

### 2.1 当前（Figma 改版后）

```
Hero → ModelsStrip → Enterprise → Footer (+ GetInTouchDialog)
```

### 2.2 中间态 `3a0139f8`（恢复目标参考）

```
Hero
→ Showcase          ← 恢复（#2）
→ ModelsStrip
→ Features          ← 恢复（#4）
→ Enterprise
→ HowItWorks        ← 恢复（#6）
→ Stats             ← 恢复（#7）
→ CTA               ← 恢复（#8）
→ Footer
```

说明：编号对应中间态从上到下的模块序号（1=Hero … 9=Footer）。

### 2.3 第 2 点确认恢复清单

| 中间态序号 | 模块 | 动作 |
|------------|------|------|
| 2 | **Showcase** | 恢复挂载（含终端演示） |
| 4 | **Features** | 恢复挂载 |
| 6 | **HowItWorks** | 恢复挂载 |
| 7 | **Stats** | 恢复挂载 |
| 8 | **CTA** | 恢复挂载 |

不改装配顺序意图：与 `3a0139f8` 一致，即：

`Hero → Showcase → ModelsStrip → Features → Enterprise → HowItWorks → Stats → CTA → Footer`

### 2.4 已知重叠（实现时注意）

- **Stats** 与 Hero 底部数字统计重复 → **已确认：去掉独立 Stats 模块，保留 Hero 底部数字**。
- **CTA** 与 Hero / Enterprise 按钮可能重复 → 保留装配，样式跟中间态 + Figma 微调。
- **Features** 与 Enterprise 下半能力卡片主题接近 → 均恢复，验收时再看是否减负。

---

## 3. Sign up & Login（P1）

### 3.1 设计 Token / 样式

| 问题 | 修改意见 |
|------|----------|
| 输入框 / OAuth 按钮圆角 | 统一 **12px** |
| 深色背景 | `#161616`（已有则验收） |
| 浅色背景 | 与首页 hero 一致（白 + 弥散 glow） |
| OAuth 描边 | `#2E2E2E` |
| OAuth 背景 | `#ffffff` |
| 输入框激活描边 | `#A3A3A3`，粗细 1px |
| Placeholder | 深色 `#A3A3A3` 50%；浅色 `#A3A3A3` 100%；词条按 Figma |
| 内容区顶距 | **128px**（注册 / 验证等 Auth 模块） |
| Auth 顶栏左右边距 | **32px**（仅 Auth，不影响首页等） |
| Forgot password 下方多余 `...` | 去掉 |
| 报错文案 | 出现在对应输入框下方 |
| OTP 输入框 | 圆角 12px；默认描边 `#2E2E2E`；选中 `#A3A3A3` 1px |

### 3.2 流程 UX

| 问题 | 修改意见 |
|------|----------|
| Resend 倒计时未展示 | **必修**：排查 `isResendActive` / 发码后状态 / 文案插值 |
| 验证页右上角 | `Log in` → **Back**，回注册并保留已填信息 |
| 邮箱旁修改图标 | 点击可改注册邮箱 |
| 邮箱占用提示提前 | **新接口**（见 §6） |

OAuth logo：若与 Figma 不一致，按设计稿换 SVG。

主要涉及：`auth-theme.css`、`auth-layout.tsx`、`auth-text-field.tsx`、`oauth-providers.tsx`、`auth-email-verify-step.tsx`、`sign-up-form.tsx`、`public-header.tsx`（auth variant）。

---

## 4. Home（P0 为主）

### 4.1 结构

- 按 §2.3 恢复 Showcase / Features / HowItWorks / Stats / CTA。
- Enterprise：**去掉 Get in Touch 按钮**；Footer 联系入口与弹窗保留。

### 4.2 Excel 其它 UI（与恢复并行）

| 区域 | 要点 |
|------|------|
| Hero | 标题/副标题尽量一行；按钮左右排布；背景色块按设计/原版对齐；导航 logo；**Doc 不改前端** |
| 导航滚动 | 尽量恢复原滚动样式；找不到则滚动时加背景；全局 PublicHeader 同步 |
| ModelsStrip | 加大标题间距与 logo 间距；区域加宽；logo 后虚线；app 名一行；圆角 12px |
| Enterprise | 小字 16px；设计稿 SVG（logo/打勾）；Organization 蓝色；圆角 12px；灰底色值 + 深色模式同步 |
| Footer | 「Powerful API Management Platform」与右侧链接居中；标题距横线 40px；线色 + 深浅色同步 |
| 弹窗 | Get in Touch 弹窗样式按设计修（入口保留） |
| 浅色模式 | 全局同步 |

主要涉及：`home/index.tsx`、`hero.tsx`、`showcase.tsx`、`features.tsx`、`models-strip.tsx`、`enterprise.tsx`、`how-it-works.tsx`、`stats.tsx`、`cta.tsx`、`footer.tsx`、`public-header.tsx`、`landing-theme.css`。

---

## 5. Model Square / Pricing（P0）

| 问题 | 修改意见 |
|------|----------|
| 侧边栏每 tab | 默认只展 4 项，其余 More；**≤6 全部展示**；各组都启用（不只 Vendors） |
| 侧边栏 icon | 设计稿 SVG |
| 搜索框聚焦 | 白色描边 |
| 卡片 | 去掉 Details；整卡可点进详情；复制按钮默认隐藏、悬停显示；标签最多 3 个 +N |
| 浅色背景色块 | 与首页背景色块一致 |

主要涉及：`pricing-sidebar.tsx`、`search-bar.tsx`、`model-card.tsx`、`pricing/index.tsx`。

---

## 6. 新增接口：邮箱占用校验（第 4 点）

**目标：** 注册填邮箱步骤即可提示「邮箱已被占用」，不必等到后续步骤。

**建议（实现开工时细化）：**

- 方法/路径草案：`GET` 或 `POST` `/api/user/check-email`（或等价命名）
- 入参：邮箱
- 出参：是否可用 / 是否已占用（注意防枚举：可统一文案或限流）
- 前端：注册表单 blur 或进入下一步前调用；失败提示在邮箱输入框下方
- 复用现有 `CheckUserExistOrDeleted` / `ErrEmailAlreadyTaken` 逻辑，**不要**暴露多余用户信息

---

## 7. 建议实施顺序

| 阶段 | 内容 | 备注 |
|------|------|------|
| Phase 0 | Figma 切图 / SVG | 依赖设计资源 |
| Phase 1 | Auth / Landing 设计 token | 圆角、色值、placeholder、glow |
| Phase 2 | Auth 布局 + 表单 + Resend 倒计时 + Back/改邮箱 | 含新邮箱校验接口联调 |
| Phase 3 | Home：恢复 2/4/6/7/8 + Excel UI + 去 Enterprise Get in Touch | 对照 `3a0139f8` 装配 |
| Phase 4 | Model Square | 筛选 / 卡片 / 背景 |
| Phase 5 | 深浅色 + 响应式 + 视觉验收 | — |

**约束：** 本文档为方案与进度存档。细节以 Figma 与验收反馈为准。

---

## 8. 验收对照（Excel Sheet）

- Sign up：待启动项按 §3；第五节已优化项可优先关闭；Resend 倒计时必须验收通过。
- Home：模块顺序与中间态一致；Enterprise 无 Get in Touch；其余 P0 UI 按 §4。
- Model Square：按 §5；样式以 Figma 为准。

---

## 9. 参考 commit

| Commit | 说明 |
|--------|------|
| `3a0139f8` | 首页中间态装配（恢复目标） |
| `4c21ec08` | 更早 Token API 品牌版（无 Showcase） |
| `3bc0d51b` | Figma 公共页/Auth 改版（当前精简首页来源） |
