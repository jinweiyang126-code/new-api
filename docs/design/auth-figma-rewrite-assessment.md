# 登录 / 注册 Figma 重写评估

> 状态：**首版已落地前端（决策 1–7 已确认）**  
> 设计稿：[UnionMeta-AI — Signup/Login](https://www.figma.com/design/r57a1aMxUHH5NvIBQRXJ43/UnionMeta-AI?node-id=185-9276&m=dev)  
> 文件 / 节点：`r57a1aMxUHH5NvIBQRXJ43` / `185:9276`  
> 评估日期：2026-08-28 · 决策确认：2026-08-28  
> 结论：**中等难度（约 3/5）** — 换壳与视觉对齐；账号模型、OAuth、Turnstile、选组织流程均沿用现网  
> **约束：以 Figma 管呈现，以后台开关和现有接口管能力；不做假按钮、假验证、假开户**  
> **规则：开工前本地化 Figma 资源；导出文件默认勿手改**（同 [homepage-figma-rewrite-assessment.md](./homepage-figma-rewrite-assessment.md) §0.5）  
> **相关：** [frontend-i18n-standard.md](./frontend-i18n-standard.md)、[customer-self-register-design.md](./customer-self-register-design.md)

---

## 0. 已确认决策（2026-08-28）

| # | 议题 | 结论 |
|---|------|------|
| **1** | 改什么 | 登录 / 注册换成 Figma 视觉与步骤编排。账号怎么注册、怎么登录、后台开关，**都按现网**。未配置的 Google/Apple **不画、不做假按钮**。 |
| **2** | 注册邮箱落库 | 与现在一样：仅 `email_verification` 开启时邮箱参与校验并写入；关闭时不为此新开后端。 |
| **3** | 确认密码 | Figma 无第二遍 → **去掉** Confirm password（纯前端，后端本就不收）。 |
| **4** | 「Cloudflare」页 | 底层是现有 **Turnstile**。`turnstile_check` 开了才出现该步，挂真 widget；关了则没有这一页。 |
| **5** | 深浅色 | Auth 页 **跟随 ThemeSwitch**。浅色对齐画板 7/10，深色对齐 16/17。用 scoped token，不套首页固定深色 `landing-theme`，不改全局 `theme.css`。 |
| **6** | 页头入口 | **品牌（Logo）+ Log in（带箭头）+ Sign up（带箭头）**，均为真跳转 `/sign-in`、`/sign-up`。不是首页那种实心大按钮，也不是把入口藏掉。当前页可高亮。 |
| **7** | 无独立稿的页 | 忘记密码、二次验证（2FA）、重置密码、OAuth 回调、**注册后选个人/组织（onboarding）** 套同一套顶栏 + 卡片。**功能必须真实**；选组织流程与接口 **不变**（见 §3.4）。 |

此前误读（已作废，勿再按此实施）：

- 注册只有 Email、没有 User name  
- 登录只有 Email（实际是 **User name/Email 一个框**）  
- 为贴稿新做 Google/Apple 或邮箱即 username  
- 做假的 Cloudflare 页  

---

## 1. 实施约束

**默认只改前端。** 不为贴稿改账号模型、不新增 OAuth provider、不换风控厂商。

### 1.1 允许改动

| 范围 | 说明 |
|------|------|
| `web/src/features/auth/**` | layout、卡片、表单 **呈现**、OAuth 圆标样式、Turnstile/验证码步骤 UI |
| `web/src/components/layout/components/public-header.tsx` | auth 页展示品牌 + Log in / Sign up 箭头入口（不改导航数据源） |
| `web/src/styles/**` | 新建 scoped `auth-theme.css`（或等价），勿污染控制台 |
| `web/src/assets/**` | Logo 等；优先复用 `web/src/assets/landing/` |
| `web/src/i18n/locales/**` | 新/改文案至少同步 `en.json` + `zh.json` |

### 1.2 禁止改动

| 范围 | 说明 |
|------|------|
| Go / 新 API / 新 status 字段 | 不为 Google/Apple、不为「邮箱即账号」开接口 |
| 登录 / 注册 / 2FA / OAuth / Turnstile **控制流** | 成功失败、token、自动 login 后跳转保持原样 |
| 路由 path | 仍是 `/sign-in`、`/sign-up`、`/register`→`/sign-up`、`/forgot-password`、`/otp`、`/reset`、`/onboarding` |
| `invite` / `aff` / `redirect` | 查询参数与现网一致 |
| onboarding 业务 | `customer_self_register_enabled`、邀请跳过、选个人/选组织、`POST` 自助开组织 — **只换皮** |
| 首页 `landing-theme` / 控制台 theme | auth 自管 scoped token |

### 1.3 UI 只读复用的数据

- `useStatus()`：`register_enabled`、`password_login_enabled`、`email_verification`、`turnstile_check` / `turnstile_site_key`、各 OAuth / WeChat / Passkey、协议开关等  
- `useSystemConfig()`：logo、系统名  
- `useTopNavLinks()`：顶栏导航项来源不变  
- `useAuthStore()`：session、2FA flow_token、onboarding 跳转判断  

---

## 2. Figma 与现网对照

板子 `Signup/Login`（约 9850×6970）含登录、注册、输入态、验证码、Turnstile 步、深色变体。代表画板：

| 画板 | 节点（约） | 内容 | 现网对应 |
|------|------------|------|----------|
| 7 | `185:9450` | 默认注册 | `/sign-up` |
| 10 | `185:9284` | 默认登录 | `/sign-in` |
| 9 | `185:9476` | 邮箱 6 格验证码 | 仅 `email_verification` 开 |
| 8 / 13 | `185:9454` 等 | 安全验证步 | 仅 `turnstile_check` 开（真 Turnstile） |
| 01–06 | `185:9280` 等 | 输入 empty / focus / error | 同一表单的视觉态 |
| 16 / 17 | `185:10404` 等 | 深色 + 光晕 | ThemeSwitch = dark |
| 14 / 15 | `185:9296` 等 | 叠在首页 Hero 上 | **首版不做**（路由仍独立 `/sign-in`） |

### 2.1 登录

| 稿 | 现网 | 做法 |
|----|------|------|
| **User name/Email** 一个输入框 | `POST /api/user/login` 的 `username`；后端已 `username = ? OR email = ?` | 一个框，label/placeholder 用 User name/Email |
| Password + 显示/隐藏 | 已有 | 样式对齐（lock + eye） |
| Forgot password? | `/forgot-password` | 保留，真跳转 |
| Log in | 现有提交 | 主按钮视觉贴稿，逻辑不变 |
| OR + 社交圆标 | `OAuthProviders` + Passkey + WeChat | **只渲染 status 已开启的**；点了走现有 OAuth |
| 2FA | `/otp` | 套同一壳，`flow_token` 不变 |

### 2.2 注册

| 稿 | 现网 | 做法 |
|----|------|------|
| **User name** | `register.username` 必填，`max=20` | 独立输入框 |
| Password | 8–20；现网另有 Confirm password | **去掉确认密码** |
| Email | 仅验证开启时展示并必填 | 与现网开关一致（决策 2） |
| Continue | 注册成功后自动 login | 逻辑不变 |
| 协议 | `LegalConsent` + `TermsFooter` | 视觉贴稿；协议开关打开时仍可保留勾选（真链到 `/user-agreement`、`/privacy-policy`） |
| 社交圆标 | 各 OAuth 开关 + `oauth_register_enabled`（前端有读，status 可能未下发，以实际开启的 provider 为准） | 同登录：有配置才显示真按钮 |

`?invite=`、`?aff=` 行为不变。

### 2.3 邮箱验证（画板 9）

仅 `email_verification === true`：进入 6 格 OTP + Resend，仍走 `GET /api/verification` 与注册体里的 `verification_code`。  
关闭：**不出现该页**。

### 2.4 Turnstile（画板 8 / 13）

仅 `turnstile_check === true`：独立一步，**真实** `Turnstile` + 现有 `middleware.TurnstileCheck`。无 token 不能提交登录/注册/发码（与现在一致）。  
关闭：**不出现该页**。  
文案可贴近「安全验证 / 正在确认你是真人」，不冒充未接入的 Cloudflare 产品名，除非法务确认。

### 2.5 OAuth

`GET /api/status` 里为真的才画，例如：`github_oauth`、`discord_oauth`、`oidc_enabled`、`linuxdo_oauth`、`telegram_oauth`、`wechat_login`、`custom_oauth_providers[]`、`passkey_login`。

- 视觉：圆形图标行；多了换行  
- 未配置的 Google/Apple：**不出现**  
- 一个都没开：不渲染 OR 与社交行  
- Passkey：开关开了再显示（稿上没有，放圆标下方次要按钮，真走 WebAuthn）

---

## 3. 页面结构（首版）

```
AuthLayout（新壳）
  → 页头：品牌 + 导航（现网 useTopNavLinks）+ Log in → + Sign up →
  → 居中 AuthCard（约 360px）+ scoped auth-theme
       /sign-in     画板 10
       /sign-up     画板 7
       条件步        画板 9（邮箱验证）/ 画板 8（Turnstile）
       /forgot-password  /otp  /reset  /onboarding  /oauth 回调
            → 同一壳，不追无稿像素；功能全真
```

### 3.1 页头（决策 6）

- 左：品牌 Logo（默认 UnionMeta 时复用 landing 横版 wordmark）  
- 中：现有公开导航  
- 右：**Log in**（箭头）链 `/sign-in`；**Sign up**（箭头）链 `/sign-up`；均为 `<Link>`  
- 语言 / 主题切换保留（深浅色决策 5）  
- 当前路由可高亮对应入口  

### 3.2 主题（决策 5）

仅包在 auth 根节点，例如 `className='auth-theme'`：

- light：浅灰底 + 白卡片（画板 7/10）  
- dark：深底 + 光晕优先 CSS（复用首页 glow 思路，控制体积）  

禁止把整页套上 `.landing-theme`（首页固定 `#1e1e1e`）。

### 3.3 资源

- Logo：复用 `web/src/assets/landing/` 横版 SVG  
- 输入图标、箭头、eye：`lucide-react`  
- 深色光晕：优先 CSS，大图按首页 §0.5 体积预算  
- 禁止提交 `figma.com/api/mcp/asset` 临时 URL  
- 导出 SVG 默认不手改 path；要对齐就改 CSS 或回 Figma 重导  

### 3.4 选组织（决策 7）— 无业务影响

现网顺序（保持）：

1. 注册（若开验证：先过邮箱验证码）  
2. 自动 login  
3. `customer_self_register_enabled` 且无 `invite` → `/onboarding`  
4. 选个人 → 控制台；选组织 → 现有自助开组织接口  

本期只把 onboarding 放进新 Auth 壳。不改：

- 会不会进入该页  
- 邀请注册跳过该页  
- 点「组织」是否真创建  
- sessionStorage `tokenapi.signup_onboarding`  

---

## 4. 建议实施顺序

0. 资源本地化（Logo 等）→ 确认无 MCP 临时 URL  
1. `auth-theme.css` + 重写 `AuthLayout`（页头决策 6 + 卡片舞台）  
2. `/sign-in` 对齐画板 10（User name/Email + 条件 OAuth/Turnstile）  
3. `/sign-up` 对齐画板 7（User name、去掉确认密码、条件 Email/验证码/OAuth/Turnstile）  
4. Turnstile 独立步（仅开关开）  
5. 邮箱验证独立步（仅开关开）  
6. 输入 empty / focus / error；移动端自适应（无单独移动稿）  
7. forgot-password / otp / reset / onboarding / OAuth 回调套壳  
8. i18n：en + zh；`TermsFooter` 等未走 `t()` 的文案一并收口  

**全程：** 提交范围以 `web/` 为主；无 Go、无新 API。WeChat 弹窗两处重复可抽共享组件，行为不变。

---

## 5. 验收清单

### 5.1 产品（本文确认后勾选）

- [x] **1** 只换呈现；OAuth/Turnstile/字段跟后台
- [x] **2** 邮箱落库策略不变
- [x] **3** 无确认密码
- [x] **4** Turnstile 真 widget、跟开关
- [x] **5** 跟随 ThemeSwitch；scoped auth token
- [x] **6** 品牌 + Log in 箭头 + Sign up 箭头，真跳转
- [x] **7** 周边页套壳；onboarding 选组织功能与时机不变

### 5.2 开工前资源

- [x] 必要 Logo 等已在仓库内本地路径
- [x] `web/src/**` 无 `figma.com/api/mcp/asset`

### 5.3 功能回归（做完后）

- [ ] 用户名登录、邮箱登录均可用  
- [ ] 注册 User name + 密码可建号；验证开时必须过 6 格码  
- [ ] 已开启的 GitHub/微信等可走通；未配置的不出现  
- [ ] Turnstile 开：无 token 无法提交；关：无该步  
- [ ] 忘记密码、2FA、重置密码可用  
- [ ] 自助开组织开 + 非邀请：注册验证通过后仍进入选个人/组织，选组织能建成  
- [ ] 邀请注册仍跳过 onboarding  
- [ ] `aff`、`redirect` 仍有效  

---

## 6. 相关文档

- [homepage-figma-rewrite-assessment.md](./homepage-figma-rewrite-assessment.md)（资源规则、landing theme 边界）  
- [frontend-i18n-standard.md](./frontend-i18n-standard.md)  
- [customer-self-register-design.md](./customer-self-register-design.md)（组织自助开户；现网实现为注册后 `/onboarding`，不以旧「注册页 Tab」为准）  
