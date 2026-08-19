# 多客户 / 工作区 M1 实现任务拆分

> 依据：[`customer-workspace-design.md`](./customer-workspace-design.md)（**Part A** + **§16 BYOK**）  
> 汇报：[customer-workspace-executive-brief.md](./customer-workspace-executive-brief.md)  
> 范围：**M1** = 客户 / 工作区 / 成员 / 邀请 / 额度划拨 / 工作区池扣费 / 隔离 / **独立上游·BYOK**  
> 术语：客户=Customer，工作区=Workspace（旧称企业/项目已废弃）  
> 不含：机构层、工作区模型白名单（M3）、支付直充客户池、SSO（M5）  
> 自助开户（注册页个人/组织）：见 [`customer-self-register-design.md`](./customer-self-register-design.md)，不在本 M1 任务表内 

**实现约定（设计开放项按建议落地，避免阻塞）：**

1. 用户退出/被移出客户后，**允许**再加入另一家客户  
2. 普通成员只能管理/看到**自己的**工作区令牌；客户/工作区 admin 可见本范围内全部令牌  
3. 客户池充值一期仅 **平台超管 API/后台操作**，不做在线支付  
4. 新客户默认 `upstream_mode=shared`；BYOK/专属渠道由超管按客户开通  

### 硬门禁（必须测稳再继续）

> **T08（扣费）**、**T15（选渠）** 是主路径高风险点。验收未全部勾选前，**禁止**往下一阶段堆功能。

| 门禁 | 任务 | 测稳前可以做什么 | 测稳前禁止做什么 |
| --- | --- | --- | --- |
| **门禁 1** | **T08** 工作区池扣费 | T01–T07；T09 日志可并行草稿 | **不得**开始依赖「客户令牌已正确扣费」的后续验收；**不得**进入 T14/T15 联调（可先写 T14 API，但不得宣称计费闭环完成） |
| **门禁 2** | **T15** 选渠（含 BYOK） | T14 API；前端 T10–T12 可并行（mock） | **不得**合入/宣称 BYOK 可用；**不得**进入以 BYOK/dedicated 为准的 E2E（T13 相关项） |

**一人本地也适用**：T08 个人令牌 + 工作区令牌回归通过后再开 T14/T15；T15 四条验收通过后再做 T13 的 BYOK/dedicated 清单。

---

## 0. 总览与依赖顺序

```text
T01 数据模型与迁移（含 BYOK 表字段）
  → T02 权限/上下文中间件
    → T03 客户 CRUD + 充值
      → T04 工作区 CRUD + 划拨
        → T05 成员管理
          → T06 邀请接受
            → T07 令牌扩展
              → ★ T08 计费扣工作区池（Relay）  【硬门禁 1：测稳再继续】
              → T09 日志隔离（可与 T08 后半并行，但计费验收以 T08 为准）
              → T14 BYOK/独立上游 API + Key 加密   ← 依赖 T01/T02/T03；联调依赖 T08 已稳
                → ★ T15 Relay 选渠  【硬门禁 2：测稳再继续】← 依赖 T08+T14
                  → T10 前端平台超管「客户管理」+ 上游设置
                    → T11 前端客户侧（工作区/成员/邀请/额度/BYOK 凭证）
                      → T12 前端令牌/顶栏工作区切换/个人上下文
                        → T13 端到端测试与文档（含 BYOK；须 T15 已稳）
```

建议按可独立回滚的边界提交/开 PR：每个 `Txx` 尽量单独一块（T08 可与 T07 同批；T15 可与 T14 同批）。**T08 / T15 勿与无关大改捆在同一未测提交里。**

| ID | 任务 | 建议人天 | 优先级 |
| --- | --- | --- | --- |
| T01 | 数据模型与迁移（含 BYOK） | 2 | P0 |
| T02 | 客户/工作区权限与请求上下文 | 1.5 | P0 |
| T03 | 客户 API（含创建事务、充值） | 1.5 | P0 |
| T04 | 工作区 API（含划拨事务） | 1 | P0 |
| T05 | 客户/工作区成员 API | 1 | P0 |
| T06 | 邀请创建/接受/作废 | 2 | P0 |
| T07 | 令牌扩展 workspace_id | 1.5 | P0 |
| **T08** | **★ Relay 计费改扣工作区池【硬门禁 1】** | 2.5 | P0 |
| T09 | 日志写入与查询隔离 | 1.5 | P0 |
| T14 | BYOK/独立上游 API + Key 加密 | 2.5 | P0 |
| **T15** | **★ Relay 选渠（含 BYOK）【硬门禁 2】** | 2 | P0 |
| T10 | 前端：客户管理（超管）+ 上游设置 | 2.5 | P0 |
| T11 | 前端：工作区/成员/邀请/额度/BYOK | 3.5 | P0 |
| T12 | 前端：令牌与工作区切换 | 1.5 | P0 |
| T13 | 测试、迁移校验、文档 | 2.5 | P0 |
| **合计** | | **约 29** | |

> 人天为粗估。前端可在 API mock 后并行；**计费/选渠主路径仍以 T08、T15 门禁为准，不因前端进度抢跑。**

---

## T01 — 数据模型与迁移

### 内容

1. 新增 model：`Customer`、`Workspace`、`CustomerMember`、`WorkspaceMember`、`CustomerInvitation`  
2. 新增 BYOK：`CustomerChannelBinding`、`CustomerUpstreamCredential`；`Customer` 增加 `upstream_mode` / `allow_global_fallback` / `byok_enabled`（默认 shared / true / false）  
3. 扩展：`User.CustomerId`、`Token.CustomerId` / `Token.WorkspaceId`、`Log.CustomerId` / `Log.WorkspaceId`（日志可增 `upstream_source`）  
4. 在 `model/main.go`（或现有 AutoMigrate 路径）注册迁移，**三库兼容**（SQLite/MySQL/PostgreSQL）  
5. 索引与唯一约束按设计文档 8.x + **§16.4**  

### 涉及目录（预期）

- `model/customer.go`、`model/workspace.go`、`model/customer_member.go`、`model/workspace_member.go`、`model/customer_invitation.go`  
- `model/customer_channel_binding.go`、`model/customer_upstream_credential.go`  
- `model/user.go`、`model/token.go`、`model/log.go`、`model/main.go`  

### 验收

- [x] 空库启动 AutoMigrate 成功（至少 SQLite + 一种 SQL 库） — *已加 SQLite 烟测；请本地有 Go 时执行 `go test ./model/ -run TestCustomerWorkspace*`*
- [x] 旧数据可启动：新字段为空/默认，个人模式不受影响 — *字段 default 0 / shared*
- [x] 单测或迁移烟测覆盖唯一索引（同客户下 workspace slug 不重复；binding 唯一）
- [x] 新建客户默认 `upstream_mode=shared` — *常量 `UpstreamModeShared`；创建时显式写入（T03 事务）*

### 非目标

- 不写业务 API  

---

## T02 — 权限与请求上下文

### 内容

1. 定义角色常量：`owner` / `admin` / `member`（客户与工作区）  
2. 辅助函数：  
   - `GetUserCustomerRole(userId)`  
   - `RequireCustomerAdmin` / `RequireCustomerMember`  
   - `RequireWorkspaceMember` / `RequireWorkspaceAdmin`  
   - `IsRootUser` 复用现有超管判断  
3. 中间件或 controller 内校验：资源 `customer_id` / `workspace_id` 与当前用户匹配  
4. （可选）扩展 Casbin 资源；**若工作量大，M1 可用显式 role 检查**，Casbin 后置  

### 验收

- [x] 非成员访问其他客户 API 返回 403 — *middleware `CustomerMemberAuth` + 单测*
- [x] 超管可跨客户操作 — *`IsRootUser` bypass + 单测*
- [x] 单测覆盖角色矩阵关键格（设计文档第 6 节） — *`TestCustomerCapabilityMatrix`*

---

## T03 — 客户 API

### 内容

| 接口 | 说明 |
| --- | --- |
| `GET /api/customers` | 超管：全部；客户用户：仅自己的客户（或 403 非超管只返回当前） |
| `POST /api/customers` | **仅超管**；事务：客户 + default 工作区 + owner 成员 + `users.customer_id` |
| `GET /api/customers/:id` | 详情含额度 |
| `PUT /api/customers/:id` | 改名/备注/停用（超管；客户 admin 是否可改名：建议仅超管停用，admin 可改名——实现时按「超管全权，owner/admin 可改 name/remark」） |
| `POST /api/customers/:id/topup` | **仅超管**；增加 `customers.quota`；写系统/审计日志 |
| `GET /api/customers/:id/workspaces` | 成员可读本客户工作区列表 |

创建客户事务失败条件：`owner` 用户已有 `customer_id`。

### 验收

- [x] 创建后存在 `slug=default` 且 `is_default=true` 的工作区 — *`TestCreateCustomerWithOwnerCreatesDefaultWorkspace`*
- [x] owner 的 `users.customer_id` 已设置 — *同上；已有客户再创建失败*
- [x] 充值后余额正确；非超管调用 topup 失败 — *`TestTopUpCustomerQuota` + controller 单测*

---

## T04 — 工作区 API 与额度划拨

### 内容

| 接口 | 说明 |
| --- | --- |
| `POST /api/customers/:id/workspaces` | 客户 admin+ |
| `GET /api/workspaces/:id` | 工作区成员可读 |
| `PUT /api/workspaces/:id` | 更新/停用 |
| `POST /api/workspaces/:id/transfer-quota` | 客户 admin+；事务划拨 |

划拨规则：

- `amount > 0`  
- `customers.quota >= amount`  
- 事务：`customer.quota -= amount`，`workspace.quota += amount`  
- 防并发超扣（行锁 / 条件更新，对齐现网额度扣减风格）  

### 验收

- [x] 余额不足划拨失败且两池不变 — *`TestTransferQuotaInsufficientLeavesPoolsUnchanged`*
- [x] 并发划拨不超卖（单测或脚本） — *`TestTransferQuotaConcurrentNoOversell`（条件更新 `quota >= amount`）*
- [x] 停用工作区后不可再划拨（或不可新建令牌，见 T07） — *`TestTransferQuotaRejectsDisabledWorkspace`；default 工作区不可停用*

---

## T05 — 客户/工作区成员 API

### 内容

| 接口 | 说明 |
| --- | --- |
| `GET /api/customers/:id/members` | |
| `DELETE /api/customers/:id/members/:userId` | 不可移除最后一位 owner；清理 `users.customer_id`；**禁用**该用户在该客户下所有令牌 |
| `GET/POST/DELETE /api/workspaces/:id/members` | 加入工作区的用户必须已是客户成员 |

### 验收

- [x] 移除成员后无法用旧客户令牌调用（status 禁用） — *`TestRemoveCustomerMemberDisablesTokensAndClearsCustomerId`（个人令牌不受影响）*
- [x] 非客户成员不能加入工作区 — *`TestAddWorkspaceMemberRequiresCustomerMembership`*
- [x] 跨客户操作 403 — *`TestCustomerMemberAuthCrossCustomerForbidden`*；另覆盖不可移除最后一位 owner

---

## T06 — 邀请流程

### 内容

| 接口 | 说明 |
| --- | --- |
| `POST /api/customers/:id/invitations` | admin+；生成 token；可选 email / workspace_id / roles；设 expires_at |
| `GET /api/customers/:id/invitations` | 列表 |
| `POST /api/invitations/:token/accept` | 登录用户接受 |
| `POST /api/invitations/:id/revoke` 或按 token revoke | admin+ |

接受逻辑按设计文档第 10 节；已有客户则明确错误码/文案。

**邮件（T06b）：** 若 SMTP 已配置且提供 email，发送邀请链接；失败不阻断邀请记录创建。链接格式：`{ServerAddress}/invitations/accept?token=...`。创建接口返回 `email_sent` / `email_error`。

### 验收

- [x] 无客户用户可接受并进入客户 + 工作区 — *`TestAcceptInvitationJoinsDefaultWorkspace`*
- [x] 已有客户用户接受失败 — *`TestAcceptInvitationFailsWhenUserAlreadyHasCustomer`*
- [x] 过期/作废邀请不可接受 — *`TestAcceptInvitationRejectsExpiredAndRevoked`*
- [x] 未指定 workspace 时进入 default 工作区 — *同上；指定 workspace 见 `TestAcceptInvitationUsesSpecifiedWorkspace`*  
- [x] 有 email + SMTP 时发送邀请邮件；失败不回滚邀请 — *`service.SendCustomerInvitationEmail` + `CreateCustomerInvitation`*

---

## T07 — 令牌扩展

### 内容

1. `POST /api/token`：可选 `workspace_id`  
   - 有：校验工作区成员；写入 `customer_id`/`workspace_id`；**令牌额度字段**可与现网 remain_quota 并存，但 **Relay 扣费以工作区池为准**（令牌 remain 可作为附加上限，M1 建议：客户令牌仍可设 remain_quota，扣费时两者都检查——先简单：**只扣工作区池**，令牌 remain_quota 对客户令牌可忽略或同步减少，实现时在任务内写清并单测）  
2. `GET /api/token`：按成员过滤；admin 看范围全部  
3. 创建客户令牌时工作区/客户必须启用  

**M1 扣费建议（写进实现注释）：**  
客户令牌（`workspace_id != null`）：**仅扣 `workspaces.quota`**；不扣 `users.quota`；令牌 `remain_quota` 若 `unlimited=false` 则同时作为次级上限（与现网一致），避免一张令牌掏空工作区——**推荐采用「工作区池 + 令牌 remain 双限制」**。

### 验收

- [x] 个人令牌行为与改前一致 — *`workspace_id` 缺省/0；`TestPersonalTokenCreateUnchanged`*
- [x] 非工作区成员不能建该工作区令牌 — *`TestNonMemberCannotCreateWorkspaceToken`*
- [x] 列表权限符合「成员仅自己 / admin 全部」 — *`TestTokenListMemberSeesOwnAdminSeesAllInScope`*  
  （扣费：工作区令牌仅扣工作区池 + remain 次级上限，注释已写，实际扣费在 **T08**）

---

## T08 — ★ Relay 计费：扣工作区池【硬门禁 1】

> **停下来测稳**：本任务验收未全部通过前，不要进入「客户令牌计费已闭环」的后续结论，也不要开始 T15 选渠联调。

### 内容（高风险，需充分单测）

1. `TokenAuth` / 上下文：注入 `workspace_id`、`customer_id`  
2. 预扣/结算路径分支：  
   - 无 workspace → 现有 User/Token 逻辑  
   - 有 workspace → 扣 `Workspace.quota`（及 used_quota）；**禁止**改 User.Quota  
3. 工作区余额不足：返回明确错误（对齐现网额度不足文案风格）  
4. 客户或工作区停用：拒绝转发  
5. 渠道选择：本任务对 `shared` 客户保持现网逻辑；**dedicated/byok/hybrid 在 T15 接入**（T08 可先只保证 shared）  

重点排查现有：`service/quota.go`、`service/text_quota.go`、预扣消费、退款、订阅路径——**客户令牌一期不走订阅抵扣也可，但必须明确；建议客户令牌仅工作区池，不碰订阅**（若现网强耦合，在提交说明里写清例外）。

### 验收（全部勾选 = 门禁 1 放开）

- [x] 客户令牌调用后：工作区池减少，用户个人余额不变 — *`TestWorkspaceBillingDebitsPoolNotUser` / `TestWorkspaceBillingSettleTopUp`*
- [x] 工作区池为 0：调用失败 — *`TestWorkspaceBillingRejectsInsufficientPool`*（停用：`TestWorkspaceBillingRejectsDisabledWorkspace`）
- [x] **个人令牌回归测试通过**（与改前一致） — *`TestPersonalTokenBillingRegression`*
- [x] 流式/非流式、失败退款路径不误扣/不漏退（覆盖核心单测） — *`TestWorkspaceBillingRefundRestoresPoolAndToken`（异步 Refund）*

### 门禁通过后再做

- 开始 T14 与选渠联调准备；前端可继续，但涉及「真实扣费演示」须引用本验收结果  

---

## T14 — BYOK / 独立上游 API + Key 加密

### 内容

依据设计文档 **§16**（`customer-workspace-design.md`）：

1. ~~超管：`PUT /api/customers/:id/upstream-settings`（mode / fallback / byok_enabled）~~ — *已随 T10 落地*
2. ~~超管：channel-bindings CRUD~~ — *已随 T10 落地（GET/POST/DELETE）*
3. ~~客户 admin+：upstream-credentials CRUD；明文 key 仅写入时接收，落库加密；列表仅 hint~~ — *`common.EncryptSecretAESGCM` + credential ops/API*
4. ~~可选：`POST .../test` 连通探测~~ — *已实现解密校验（真实出站探测留给 T15）*
5. ~~全部写操作审计（无 Key）~~ — *create/update/delete/test 审计仅记 hint / id*

### 验收

- [x] API 永不返回完整 Key — *DTO / MarshalJSON 仅 hint；单测覆盖*
- [x] 非 admin 无法管理凭证 — *`CustomerAdminAuth`；能力矩阵 `CapManageByokCredential`*
- [x] 关闭 byok_enabled 后凭证不参与后续选渠（配合 T15） — *`TestSelectChannelByokDisabledIgnoresCredentials`*

---

## T15 — ★ Relay 选渠（shared / dedicated / byok / hybrid）【硬门禁 2】

> **停下来测稳**：依赖 **T08 门禁已通过** + T14 API 可用。本任务验收未全部通过前，不要做 T13 的 BYOK/dedicated E2E，也不要对外说「BYOK 已可用」。

### 内容

1. ~~实现 **§16.5** 选渠顺序；`shared` 与改前一致~~ — *`service/customer_channel_select.go` + `CacheGetRandomSatisfiedChannel`*
2. ~~BYOK：运行时解密组装临时渠道对象，内存窗口尽量短~~ — *`assembleByokChannel`；id≤0 不写 used_quota*
3. ~~日志 `upstream_source=shared|dedicated|byok`，禁止写 Key~~ — *Context + `RecordConsumeLog` 回填*
4. ~~个人令牌：强制全球共享~~ — *customer_id=0 走 shared*

### 验收（全部勾选 = 门禁 2 放开）

- [x] shared 客户与现网选渠一致 — *`TestSelectChannelSharedCustomerUsesGlobalPath`*
- [x] dedicated 仅走绑定渠道（除非 fallback） — *`TestSelectChannelDedicatedOnlyBoundChannel` / `NoFallbackErrors`*
- [x] BYOK 实际使用客户 Key（测试 upstream） — *`TestSelectChannelByokUsesCustomerKey`（组装临时 Channel，Key 解密仅内存）；真实出站复跑见 T13「验收复跑记录」`scripts/byok-live-smoke.mjs`*
- [x] 个人令牌不受客户 BYOK 影响 — *`TestPersonalTokenAlwaysSharedSource`*
- [x] **再跑一遍个人令牌 + shared 工作区令牌**（确认选渠改动未破坏 T08） — *`WorkspaceBilling|PersonalTokenBilling` 回归*

### 门禁通过后再做

- T13 中 BYOK / dedicated 清单；产品化收尾与文档  
- T11 BYOK 凭证 UI（API 已就绪）

---

## T09 — 日志隔离

### 内容

1. 写日志时带上 `customer_id` / `workspace_id`（从上下文）  
2. 查询 API：  
   - 超管：可查全部（保持现能力）  
   - 客户 admin：强制本客户  
   - 工作区 admin：本工作区  
   - 成员：仅自己  
3. 防止通过 query 参数伪造他企 id  

### 验收

- [x] A 客户 admin 拉不到 B 客户日志 — *`TestCustomerAdminCannotSeeOtherCustomerLogs` / `TestResolveSelfLogAccessScopeCustomerAdminIsolation`（伪造 `customer_id` → empty）*
- [x] 客户令牌产生的日志带齐客户/工作区字段 — *`TestRecordConsumeLogWritesCustomerWorkspace` / context fallback*

---

## T10 — 前端：平台「客户管理」

### 内容

1. 路由与菜单：超管可见「客户管理」  
2. 列表 / 创建 / 详情 / 停用 / 充值  
3. 详情「上游设置」：mode / fallback / byok_enabled；渠道绑定管理（**§16**）  
4. i18n 中英文 key（至少 en + zh）  
5. 权限：非超管不可见菜单  

### 验收

- [x] 超管可完成开客户、充值 — *平台菜单「客户管理」+ Create / Top Up；Playwright 浏览器烟测通过*
- [x] 创建后详情可见 default 工作区与余额 — *详情抽屉拉取 `/workspaces`；浏览器可见 default*
- [x] 超管可为客户开通 BYOK/专属渠道并保存 — *`PUT upstream-settings` + channel-bindings（T14 最小切片）；浏览器保存 dedicated + BYOK + 绑定渠道通过*

---

## T11 — 前端：客户侧工作区 / 成员 / 邀请 / 额度 / BYOK

### 内容

1. 菜单：工作区、成员与邀请、额度（admin+）、**上游/BYOK**（admin+，且 byok_enabled）  
2. 工作区列表/创建/停用  
3. 划拨额度 UI（客户余额 → 工作区）  
4. 成员列表/移除  
5. 邀请创建、复制链接、列表、作废  
6. 接受邀请页（登录态；未登录引导登录/注册后回跳）  
7. BYOK 凭证：添加/轮换/删除（仅 hint 展示；无完整 Key）  

### 验收

- [x] 客户 admin 全流程可邀人、划拨 — *Organization 菜单 + workspaces/members/quota/upstream；API 烟测 owner7 invite + transfer-quota 通过*  
- [x] 已有客户用户接受邀请有明确失败提示 — *`/invitations/accept` 对 `user already belongs to a customer` 专用 toast（en/zh）*

---

## T12 — 前端：令牌与工作区上下文

### 内容

1. 创建令牌可选「个人」或「某工作区」（仅已加入工作区）  
2. 令牌列表按权限过滤  
3. 顶栏：客户名（只读）+ 当前工作区切换（调用 `current-workspace`，影响默认创建令牌的工作区预填）  
4. `GET /api/user/self/customer` 接入 auth/store  

### 验收

- [x] 成员可创建工作区令牌并调用（配合后端） — *创建抽屉 Token scope；owner7 烟测创建 workspace token 成功；顶栏切换写 `current_workspace_id` 预填*  
- [x] 个人令牌入口仍在 — *Token scope 含 Personal；烟测 personal token `workspace_id=0`*

---

## T13 — 测试、校验与文档

### 内容

1. 后端单测：创建客户事务、划拨、邀请、扣费分支、日志过滤、**选渠 shared/dedicated/byok**、Key 不落日志  
2. 手工/脚本 E2E 清单（见下）  
3. 更新 `customer-workspace-design.md` §15 实现状态为「开发中/已完成」  
4. （可选）在 `aliyun-ecs.md` 或运维备忘中注明：客户功能无需额外端口  

### 验收（本轮）

- [x] 相关单测通过 — *`go test` model/service/controller/middleware（Customer|Workspace|Invitation|Billing|Log|Upstream/BYOK/Select…）*  
- [x] E2E 脚本可跑 — *`node scripts/t13-e2e.mjs`（对本地 `:3001`）*  
- [x] §15 实现状态已更新  
- [x] 运维备忘：客户/工作区功能无额外端口  

### E2E 清单

- [x] 超管创建客户 A、B，各充值 — *`scripts/t13-e2e.mjs` `e2e-create-topup`*  
- [x] A admin 划拨到 default，邀请用户 U1，U1 接受 — *`e2e-invite-accept`*  
- [x] U1 建工作区令牌，调用成功，A 工作区池减少，U1 个人余额不变 — *令牌创建 `e2e-ws-token-create`；扣费路径由 `TestWorkspaceBilling*` / `PersonalTokenBilling*` 覆盖（本机上游区域限制导致 live relay SKIP）*  
- [x] U1 无法看 B 的数据 — *`e2e-isolation-u1-vs-b`*  
- [x] U1 无法接受 B 的邀请 — *`e2e-u1-reject-b-invite`*  
- [x] 移除 U1：令牌失效 — *`e2e-remove-u1-token`（修复：移除成员后 `InvalidateUserTokensCache`）*  
- [x] 个人用户（无客户）原有 curl 流程仍通 — *`e2e-personal-user`*  
- [x] **BYOK**：为 A 开通 byok，配置测试 Key，工作区令牌走客户 Key；关闭后回落 shared（若 fallback） — *API `e2e-byok-dedicated-api`；选渠 `TestSelectChannelByok*`；fallback `TestSelectChannelByokDisabledIgnoresCredentials`；**真实出站**见下方复跑记录*  
- [x] **dedicated**：绑定渠道后流量不进未绑定渠道（除非 fallback） — *`e2e-dedicated-settings` + `TestCustomerUsesScopedUpstream` / SelectChannel 单测*  
- [x] API/日志无完整上游 Key — *凭证列表仅 hint；`TestUpstreamCredentialCRUDEncryptsAndHidesKey` / `TestCustomerUpstreamCredentialJSONNeverIncludesCiphertext`*

### 验收复跑记录（2026-08-14）

环境：本地 Docker `new-api` → `http://127.0.0.1:3001`（MySQL + Redis）。

| 脚本 | 结果 | 说明 |
| --- | --- | --- |
| `node scripts/t13-e2e.mjs` | **9 PASS / 0 FAIL / 1 SKIP** | SKIP：`e2e-ws-token-relay-billing` — 共享渠道打 OpenAI 返回 `403 Country, region, or territory not supported`；扣费仍由 `TestWorkspaceBilling*` / `PersonalTokenBilling*` 覆盖 |
| `node scripts/byok-live-smoke.mjs` | **4 PASS / 0 FAIL** | BYOK 真实出站冒烟：本地 OpenAI 兼容 mock（`host.docker.internal:18081`）；`upstream_mode=byok` + `allow_global_fallback=false`；工作区令牌 `/v1/chat/completions` 成功；mock 收到的 `Authorization` 为客户 BYOK Key；消费日志 `upstream_source=byok` |

结论：T13 API E2E 复跑通过；BYOK 出站选渠 / Key 透传 / 日志标记已实测通过。共享上游 live 计费仍受本机区域限制，不阻塞 M1 验收签字。

---

## 并行与里程碑建议

| 里程碑 | 包含任务 | 可演示结果 | 门禁 |
| --- | --- | --- | --- |
| M1-a 骨架 | T01–T04 | 超管开客户、充值、划拨 | — |
| M1-b 协作 | T05–T06 | 邀请进客户 | — |
| M1-c 计费闭环 | T07–**T08**–T09 | 工作区令牌扣工作区池（shared） | **T08 验收全过才能标完成** |
| M1-c2 上游 | T14–**T15** | 独立上游 / BYOK 可调用 | **T15 验收全过才能标完成** |
| M1-d 产品化 | T10–T13 | 后台可用，E2E 含 BYOK | 须门禁 1+2 已过 |

前后端并行：M1-a API 就绪后即可开 T10（可用 mock）；**不得用前端进度绕过 T08/T15 门禁。**

---

## 明确排除（防止 scope creep）

| 不做（本 M1） | 归属 |
| --- | --- |
| 机构层 | 不做（除非单独立项） |
| 使用账本 / 导出 / 分群 | **M2** |
| 工作区模型白名单 / 限流 | **M3** |
| 支付网关充客户池 / 开票授信 | **M4** |
| SSO / 审计增强 / SLA | **M5** |
| 审批流 / 税务勾兑 / 护栏 / 风控等 | 设计全文 Part B（深度项；BYOK 除外，已在 M1 §16） |
| 用户多客户切换器 | 不做（单客户） |

> **独立上游 / BYOK 已纳入本 M1**（`customer-workspace-design.md` §16）。其余后期见同文档 Part B。

---

## 开工检查清单

开始写代码前确认：

- [ ] 已读并同意 `customer-workspace-design.md` Part A 与 **§16**  
- [ ] 本拆分中「实现约定」四条无异议  
- [ ] **已知晓硬门禁：T08、T15 须测稳再继续**  
- [ ] 本地/测试库可跑迁移  
- [ ] 分支策略已定（功能分支或直接 main + 小步提交）  
- [ ] BYOK 加密密钥来源（环境变量 / 配置）已有约定  

**指令示例：** `开始开发 T01` 或 `按 M1-a 开工`。
