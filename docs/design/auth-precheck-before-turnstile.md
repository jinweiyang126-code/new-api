# 登录 / 注册：业务预检后再进人机验证（方案 A）

状态：已选定方案，**待确认实现细节后改代码**  
日期：2026-09-03  
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

1. 用户点 Continue → 调用**登录预检**（新建接口，见下），**不要求** Turnstile。
2. 预检失败（凭证无效）→ 留在表单 toast / 错误提示，**不**进 CF。
3. 预检成功且尚无 token → 进入 CF；通过后带 token 调正式 `POST /api/user/login`。
4. 若后台已预取到 token → 预检成功后可直接正式登录（可选优化）。

预检接口建议：

- `POST /api/user/login/precheck`（名称可调整）
- Body：`username` + `password`（与登录一致）
- 成功：`{ success: true }`（表示凭证正确，可进人机）
- 失败：统一文案「凭证无效」之类，**不区分**用户名不存在 / 密码错误（防枚举）
- **不**发 session、**不**推进 2FA、**不**写登录态

正式 `POST /api/user/login`：保持现有 `CriticalRateLimit` + `TurnstileCheck` + 现有 2FA 等逻辑。

### 2.2 注册

**开邮箱验证**

- 保持现有 `POST /api/user/check-email`（邮箱占用预检）。
- **新增**用户名可用预检（对标 check-email），在进 CF / 发码或注册前调用。
- 发验证码、正式注册：继续现有 Turnstile + 限流。

**关邮箱验证**

- 用户名（及若有邮箱）预检通过后再进 CF，再 `register`。

验证码对错：若无单独「校验验证码」接口，仍可能在正式 `register` 时暴露；可作为后续增强，不阻塞方案 A 主路径。

### 2.3 明确不做（本方案范围外）

- 方案 C：仅依赖离屏预取 token（治标，错密仍可能进 CF）。
- 方案 D：放宽正式 login「可先无 Turnstile 试一次」（与现中间件冲突，撞库面更大，除非另定策略）。

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

### 3.2 方案 A 建议

| 接口 | Turnstile | 限流 |
|------|-----------|------|
| 登录预检 | 否 | 至少等同 `CriticalRateLimit`；若担心撞库可专用更严桶（如 10 次 / 10 分钟 / IP） |
| 用户名预检 | 否 | 对标 `check-email`（Critical + 瘦响应） |
| 邮箱预检 | 否（现状） | 现状 Critical |
| 正式 login / register / 发信 | 是（现状） | 现状 Critical 或 EV |

可选后续：预检连续失败 N 次后再要求 Turnstile 才能继续预检（混合策略）。

风险：登录预检扩大撞库试探面 → 生产务必开启 Critical 限流；响应统一错误文案。

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

1. **登录** `user-auth-form.tsx`：Continue → 预检 → 成功且需 token 再 `setView('turnstile')` → 正式 login。
2. **注册** `sign-up-form.tsx`：在现有 `ensureEmailAvailable` 旁增加用户名预检；无邮箱验证路径在进 CF 前同样预检。
3. CF 通过后的 `pendingSubmit` / `pendingAction` 链路保持，仅把「进 CF」的门禁从「有无 token」改为「预检已通过 + 无 token」。
4. 预检与正式登录的错误提示：预检统一文案；正式登录保留现有拦截器 / toast 行为。

---

## 6. 后端改造要点（实现时）

1. 新增登录预检 handler + 路由：`CriticalRateLimit` + `anonymousRequestBodyLimit`，**不加** `TurnstileCheck`。
2. 复用现有密码校验逻辑，但不签发 session / 2FA flow。
3. 新增 `check-username`（或合并进通用 availability API），行为对齐 `CheckEmail`。
4. 单测：预检错误凭证 / 正确凭证；限流；正式 login 无 token 仍失败。

---

## 7. 验收标准

- [ ] 错密码 / 不存在用户：不进入 CF 页，表单直接报错。
- [ ] 正确密码 + 需 Turnstile：先预检成功，再进 CF，再登录成功（或进 2FA）。
- [ ] 注册：已占用邮箱仍不进 CF；已占用用户名在进 CF 前被拦下。
- [ ] 正式 login / register / 发信无有效 Turnstile token 时仍被拒绝。
- [ ] 预检接口在限流打开时可被 IP 限流触发。

---

## 8. 决策记录

| 项 | 结论 |
|----|------|
| 方案 | **A**（登录 + 注册轻量预检） |
| 防刷 | 预检无人机 + Critical（或更严专用）；正式接口继续 CF |
| 对标 | 邮箱 `check-email` 的限流分层 |
| 实现 | **待产品 / 负责人确认本文后改代码** |
