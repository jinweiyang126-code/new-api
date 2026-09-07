# 登录 / 注册：业务预检后再进人机验证（方案 A）

状态：方案 A **已落地**（后端预检接口 + 前端门禁；本地 `new-api-dev` 已重建）  
日期：2026-09-03 · 细节确认：2026-09-04 · 实现：2026-09-04  
相关页面：`/sign-in`、`/sign-up`  
相关现状：Cloudflare Turnstile（CF）分步页

---

## 1. 问题

开启 Turnstile 时，前端在**尚未校验账号密码 / 用户名占用等业务结果**的情况下，可能先切到 CF 人机页。

| 流程 | 现象 |
|------|------|
| 登录 | 表单本地校验通过且尚无 Turnstile token → 立刻 `setView('turnstile')`，**不请求**登录接口。错账号/错密码也会先看到 CF，通过后再登录失败。 |
| 注册（开邮箱验证） | 发码前有 `check-email`：邮箱已占用会留在表单。用户名占用、错验证码等仍可能先 CF 再失败。 |
| 注册（关邮箱验证） | 接近登录：无业务预检则先 CF，再 `register`。 |

安全上：错误凭证最终仍被后端拒绝；正式 `login` / `register` / 发信仍走 `TurnstileCheck`。  
体验上：用户会误以为「错信息也能继续」。

根因（登录）：`user-auth-form.tsx` 的 `onSubmit` 在 `showTurnstileSlot && !turnstileToken` 时直接进 CF。

---

## 2. 选定方案：A — 登录 / 注册都做轻量预检

原则：**先业务预检，通过后再进人机；正式提交仍强制 Turnstile。**

### 2.1 登录

1. 用户点 Continue → 调用**登录预检**，**不要求** Turnstile。
2. 预检失败（凭证无效）→ 留在表单，错误文案**复用正式登录失败文案**，**不**进 CF。
3. 预检成功且尚无 token → 进入 CF；通过后带 token 调正式 `POST /api/user/login`。
4. 预检成功且**已有** token → **不**直接正式登录；仍走与现网一致的后续门禁（`validateTurnstile` 后正式 login；无 token 才进 CF 页）。不做「预检成功 + 已有 token → 跳过 CF 整页直接 login」的短路优化。

预检接口：

- `POST /api/user/login/precheck`
- Body：`username` + `password`（与登录一致）
- 成功：`{ success: true }`（表示凭证正确，可进入后续人机 / 登录）
- 失败：文案与正式登录失败一致（统一口径，**不区分**用户名不存在 / 密码错误，若正式登录本身已统一则直接复用）
- **不**发 session、**不**推进 2FA、**不**写登录态
- 限流：复用现有 **`CriticalRateLimit`（默认 20 次 / 20 分钟 / IP）**，不加 Turnstile

正式 `POST /api/user/login`：保持现有 `CriticalRateLimit` + `TurnstileCheck` + 现有 2FA 等逻辑。

### 2.2 注册

**开邮箱验证**

- 保持现有 `POST /api/user/check-email`（邮箱占用预检）。
- **新建** `POST /api/user/check-username`（对标 check-email），在进 CF / 发码或注册前调用。
- **本版对验证码也做预检**（在进 CF / 正式 register 前校验验证码是否有效；具体接口可新建或复用现有能力，实现时选定）。
- 发验证码、正式注册：继续现有 Turnstile + 限流。

**关邮箱验证**

- 用户名（及若有邮箱）预检通过后再进 CF，再 `register`。

### 2.3 明确不做（本方案范围外）

- 方案 C：仅依赖离屏预取 token（治标，错密仍可能进 CF）。
- 方案 D：放宽正式 login「可先无 Turnstile 试一次」（与现中间件冲突，撞库面更大）。
- 「预检连续失败 N 次后再要求 CF 才能继续预检」的混合策略：**本版不做**（见 §3.3 说明；若以后要做再单独立项）。

---

## 3. 防刷分层（与现网对齐）

### 3.1 现有邮箱检验 `POST /api/user/check-email` 防刷

| 措施 | 说明 |
|------|------|
| `CriticalRateLimit`（按 IP） | 默认约 20 次 / 20 分钟；注释写明靠此缓解探测，**未挂 Turnstile** |
| `GlobalAPIRateLimit` | 整站 API 一层 |
| `anonymousRequestBodyLimit` | 匿名请求体大小限制 |
| 瘦响应 | 仅 `{ available: bool }`，不发信、不建会话 |

发验证码 `/api/verification` 更严：`EmailVerificationRateLimit`（**30 秒内最多 2 次 / IP**，代码写死）+ **必须 Turnstile**。

### 3.2 方案 A（已确认）

| 接口 | Turnstile | 限流 |
|------|-----------|------|
| 登录预检 | 否 | **现有 Critical**（20 / 20 分钟） |
| 用户名预检 `check-username` | 否 | 对标 `check-email`（Critical + 瘦响应） |
| 邮箱预检 | 否（现状） | 现状 Critical |
| 验证码预检（本版） | 否（预检本身） | Critical 或与发信同级策略，实现时与现网对齐 |
| 正式 login / register / 发信 | 是（现状） | 现状 Critical 或 EV |

风险：登录预检扩大撞库试探面 → 生产务必开启 Critical 限流；失败文案与正式登录一致且不暴露「用户不存在 / 密码错误」差异。

### 3.3 「失败 N 次后再要求 CF 才能预检」是什么（本版不做）

含义：预检接口本身**默认不要 CF**；但若同一 IP（或账号）连续预检失败达到 N 次，则**下一次预检也必须先过人机**，通过后再允许继续调预检。用于在「体验优先（错密不进 CF）」和「防撞库」之间加一道渐进门槛。

本版**不采用**：仅依赖 Critical 限流 + 正式接口 Turnstile。

---

## 4. 限流配置方式（现状说明）

下列项为**环境变量**配置（`common/init.go`），**不是**后台「系统设置」页；改后通常需**重启**。

| 项 | 环境变量 | 默认 |
|----|----------|------|
| Critical 开关 | `CRITICAL_RATE_LIMIT_ENABLE` | `true` |
| Critical 次数 | `CRITICAL_RATE_LIMIT` | `20` |
| Critical 窗口（秒） | `CRITICAL_RATE_LIMIT_DURATION` | `1200` |
| 全局 API 开关 | `GLOBAL_API_RATE_LIMIT_ENABLE` | `true` |
| 全局 API 次数 | `GLOBAL_API_RATE_LIMIT` | `360` |
| 全局 API 窗口（秒） | `GLOBAL_API_RATE_LIMIT_DURATION` | `180` |
| 匿名请求体上限 | `ANONYMOUS_REQUEST_BODY_LIMIT_KB` | `512` |

对比：`EmailVerificationRateLimit`（2 次 / 30 秒）为**代码常量**，无环境变量。  
后台系统设置中的「模型请求限流」与上述 Critical / Global API 无关。

---

## 5. 前端改造要点（实现时）

1. **登录** `user-auth-form.tsx`：Continue → 预检 → 成功后按现有门禁（无 token 进 CF；有 token 则 validate 后正式 login，**不**因预检成功而另开短路）。
2. **注册** `sign-up-form.tsx`：`ensureEmailAvailable` + **用户名预检** + **验证码预检（本版）**；通过后再进 CF / register。
3. CF 通过后的 `pendingSubmit` / `pendingAction` 链路保持。
4. 预检失败文案与正式登录失败文案一致。

---

## 6. 后端改造要点（实现时）

1. 新增 `POST /api/user/login/precheck`：`CriticalRateLimit` + `anonymousRequestBodyLimit`，**不加** `TurnstileCheck`。
2. 复用现有密码校验逻辑，但不签发 session / 2FA flow；失败文案对齐正式登录。
3. 新增 `POST /api/user/check-username`，行为对齐 `CheckEmail`。
4. 本版增加验证码预检能力（接口形态实现时选定）。
5. 单测：预检错误凭证 / 正确凭证；限流；正式 login 无 token 仍失败；用户名占用；验证码预检。

---

## 7. 验收标准

- [x] 错密码 / 不存在用户：不进入 CF 页，表单直接报错（文案同正式登录）。（接口：`login/precheck` 返回与正式登录同文案；前端已先预检再进 CF）
- [ ] 正确密码 + 需 Turnstile：先预检成功，再进 CF，再登录成功（或进 2FA）。（待浏览器手测）
- [x] 预检成功且已有 token：不跳过既有门禁去「直接正式登录」。（`user-auth-form` 预检后仍走 `validateTurnstile` / CF 页）
- [x] 注册：已占用邮箱 / 用户名在进 CF 前被拦下；错误验证码本版预检可拦下。（接口 + 表单门禁已接）
- [ ] 正式 login / register / 发信无有效 Turnstile token 时仍被拒绝。（既有中间件未改；待手测确认）
- [ ] 预检接口在限流打开时可被 IP 限流触发。（路由已挂 `CriticalRateLimit`；待压测确认）

---

## 8. 决策记录

| 项 | 结论 |
|----|------|
| 方案 | **A**（登录 + 注册轻量预检） |
| 登录预检限流 | **现有 Critical**（20 / 20 分钟） |
| 登录预检失败文案 | **复用正式登录文案** |
| 用户名预检 | **新建 `check-username`** |
| 验证码 | **本版做预检** |
| 预检成功且已有 token | **不直接正式登录**；后续门禁与现网一致 |
| 失败 N 次后再要求 CF 才能预检 | **本版不做**（见 §3.3） |
| 防刷 | 预检无人机 + Critical；正式接口继续 CF |
| 对标 | 邮箱 `check-email` 的限流分层 |
| 实现 | **已落地**（2026-09-04） |
