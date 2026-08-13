# New API 多客户 / 工作区 设计方案

> **合并文档**：原 enterprise-multi-tenant.md（M1）+ enterprise-gap-features-design.md（M2+）  
> 状态：设计已确认；代码 **未开工**  
> 术语：**客户 / 工作区**（Customer / Workspace）；旧称「企业 / 项目」已废弃  
> 参考：[DogRouter 企业方案](https://dogrouter.ai/zh-CN/business)  
> 实现任务：[`customer-workspace-m1-implementation-tasks.md`](./customer-workspace-m1-implementation-tasks.md)  
> 汇报简版：[`customer-workspace-executive-brief.md`](./customer-workspace-executive-brief.md)

## 阅读指南

| 部分 | 内容 | 何时读 |
| --- | --- | --- |
| **Part A** | M1 主设计（组织、额度、表、接口、BYOK） | 开工 M1 必读 |
| **Part B** | DogRouter 对照、M2–M5、深度项、机构草案 | 排后期 / 对齐竞品时读 |
| **§16** | 独立上游 / BYOK 全文 | M1 必读（属 Part A 附录位置，紧接 Part A 正文） |

---

# Part A — M1 主设计

## 1. 目标与非目标

### 1.1 目标

1. **多客户隔离**：不同客户的成员、令牌、日志、额度互不可见  
2. **工作区**：客户下的工作区承载成员与 API 令牌  
3. **额度编排**：平台给客户充值 → 客户划拨到工作区 → 调用只扣工作区池  
4. **邀请制加入**：用户先注册个人，再由客户管理员邀请进客户  
5. **上游灵活**：默认全球共享；M1 即支持 **独立上游绑定 + BYOK**（按客户开通，默认关）  
6. **兼容现网**：未加入客户的个人模式保持现有行为  

### 1.2 非目标（当前不做）

- **机构层**（集团 / 代理商再挂多家客户）— 明确后置，先不考虑  
- 用户同时属于多家客户  
- 客户流量扣减 `User.Quota`（个人余额）  
- 客户自助注册开户（由平台超管创建客户）  
- 在线支付直接充入客户池（一期可用超管充值；支付合规为产品外事项）  
- 复杂部门树、多级审批、完整报表导出（可后续迭代）  
- 模型白名单/限流（M3）、SSO（M5）等（见本文 Part B）  

---

## 2. 已确认决策基线

| 项 | 结论 |
| --- | --- |
| 命名 | **客户**、**工作区**（英文：Customer / Workspace） |
| 组织层级 | 平台 → 客户 → 工作区（**无机构层**） |
| 客户数量 | 不设上限 |
| 用户 ↔ 客户 | **一对一**：同一时刻不可属于多家客户 |
| 注册加入 | 先注册个人，再 **邀请进客户** |
| 邀请权限 | **客户管理员可邀请成员**（超管可代管） |
| 计费 | 客户令牌 **只扣工作区池**，**完全不碰** `User.Quota` |
| 渠道 / BYOK | **M1 正式范围**：默认 `shared`；可按客户开通独立上游 / BYOK（设计见 **§16**） |
| 默认工作区 | 创建客户时 **自动创建** `default` 工作区 |
| 个人模式 | `customer_id` 为空：个人令牌仍走个人余额；**永不走客户 BYOK** |

---

## 3. 领域模型

```text
平台超管
 └── 客户 Customer
      ├── 客户管理员（owner / admin，可邀请成员）
      ├── 客户额度池（平台充值）
      └── 工作区 Workspace（创建客户时自动建 default）
           ├── 成员
           ├── 工作区额度池（API 扣费账户）
           ├── API 令牌
           └── （后续）模型白名单等策略
```

### 3.1 概念对照

| 本方案 | DogRouter 类似概念 | 说明 |
| --- | --- | --- |
| 客户 | 客户 / 组织 | 对外租户主体 |
| 工作区 | 工作区 | 客户内工作区/环境 |
| 工作区额度 | 工作区配额 | 实际扣费账户 |
| 平台渠道 + BYOK | 网关上游 | 默认共享；M1 可按客户专属/自带 Key |

### 3.2 渠道与 BYOK（M1）

- **默认**：上游渠道由平台超管统一配置，客户未开通时全部走全球共享（与现网一致）。  
- **M1 已包含**：按客户开通 **独立上游绑定** 与/或 **BYOK**；完整数据/选渠/接口/安全见本文 **§16**。  
- 隔离的是：成员、令牌、日志、额度；以及（开通后）该客户可用的上游候选集。  
- 个人令牌始终只走全球共享。

---

## 4. 与现有 New API 的映射

| 现有能力 | 客户层用法 |
| --- | --- |
| `User` | 登录主体；通过客户成员关系加入客户 |
| `Token` | 增加 `customer_id` / `workspace_id`；为空则个人模式 |
| `User.Quota` | 仅个人模式使用；客户令牌禁止扣此字段 |
| `Group` | 仍可用于倍率；策略以工作区侧后续白名单为主 |
| `Channel` | 默认 **全局共享**；客户可开通独立绑定 / BYOK（§16） |
| 日志 `Log` | 写入 `customer_id` / `workspace_id`，查询强制范围过滤 |

兼容：历史数据上述客户字段为空，行为与现网一致。

---

## 5. 额度流

```text
平台超管给客户充值
    → customers.quota ↑

客户管理员划拨到工作区
    → customers.quota ↓
    → workspaces.quota ↑
（同一事务，不可超拨）

API 调用（令牌带 workspace_id）
    → 只扣 workspaces.quota
    → 不足则拒绝
    → 不碰 User.Quota
```

个人令牌（`workspace_id` 为空）仍走现有个人余额逻辑。

---

## 6. 角色与权限（一期）

| 能力 | 平台超管 | 客户 owner/admin | 工作区 admin | 成员 |
| --- | --- | --- | --- | --- |
| 创建/停用客户 | ✓ | | | |
| 给客户充值 | ✓ | | | |
| 创建工作区 | ✓ | ✓ | | |
| 邀请成员 | ✓ | ✓ | | |
| 划拨额度到工作区 | ✓ | ✓ | | |
| 管理工作区成员 | ✓ | ✓ | ✓ | |
| 创建工作区令牌 | ✓ | ✓ | ✓ | ✓（通常仅自己的） |
| 上游模式 / 渠道绑定 | ✓ | | | |
| BYOK 凭证管理 | ✓ | ✓（需 byok_enabled） | | |
| 查看日志 | 全部 | 本客户 | 本工作区 | 自己的 |
| 全局渠道/定价 | ✓ | | | |

---

## 7. 邀请规则

1. 客户管理员创建邀请（邮箱和/或链接 token；可指定默认工作区与角色）  
2. 被邀请人：  
   - 未注册 → 注册后接受邀请加入该客户  
   - 已注册且无客户 → 接受邀请加入  
   - 已注册且已有客户 → **拒绝**（提示已属于其他客户）  
3. 接受后加入客户成员，并加入指定工作区或 `default` 工作区  

---

## 8. M1 表结构

> 需兼容 SQLite / MySQL / PostgreSQL。额度单位与现网 `quota` / `QuotaPerUnit` 一致。

### 8.1 `customers`（客户）

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | int PK | |
| name | varchar(128) | 显示名 |
| slug | varchar(64) unique | 可选 |
| status | int | 1 启用 / 0 停用 |
| quota | bigint | 客户池余额 |
| used_quota | bigint | 累计已用（统计） |
| owner_user_id | int | 首个 owner |
| remark | varchar(255) | |
| upstream_mode | varchar(32) | 默认 `shared`；见 §16 |
| allow_global_fallback | bool | 默认 true |
| byok_enabled | bool | 默认 false |
| created_at / updated_at | | 与现网风格对齐 |

> BYOK 附表 `customer_channel_bindings` / `customer_upstream_credentials` 见**§16.4**（M1 必迁）。

### 8.2 `workspaces`（工作区）

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | int PK | |
| customer_id | int FK | |
| name | varchar(128) | 如 default |
| slug | varchar(64) | 客户内唯一 |
| status | int | |
| quota | bigint | **工作区池（扣费账户）** |
| used_quota | bigint | |
| is_default | bool/int | 是否默认工作区 |
| created_at / updated_at | | |

唯一索引：`(customer_id, slug)`。

### 8.3 `customer_members`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | int PK | |
| customer_id | int | |
| user_id | int | |
| role | varchar(32) | owner / admin / member |
| status | int | |
| created_at / updated_at | | |

唯一：`(customer_id, user_id)`。

### 8.4 `workspace_members`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | int PK | |
| workspace_id | int | |
| user_id | int | |
| role | varchar(32) | admin / member |
| status | int | |
| created_at / updated_at | | |

唯一：`(workspace_id, user_id)`。  
用户必须已是该工作区所属客户的成员。

### 8.5 `customer_invitations`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | int PK | |
| customer_id | int | |
| workspace_id | int 可空 | 空则接受后进 default |
| email | varchar(255) 可空 | |
| token | varchar(64) unique | 邀请链接 |
| role | varchar(32) | 客户角色 |
| workspace_role | varchar(32) | 工作区角色 |
| invited_by | int | |
| status | varchar(32) | pending / accepted / expired / revoked |
| expires_at | bigint | |
| created_at / updated_at | | |

### 8.6 改造现有表

**`users`**

- 增加可空 `customer_id`：空=个人模式；非空=已入该客户（一对一）

**`tokens`**

- 增加可空 `customer_id`、`workspace_id`  
- `workspace_id` 非空时客户令牌，扣工作区池；为空则个人令牌  

**`logs`**

- 增加可空 `customer_id`、`workspace_id`  
- 查询按角色强制范围过滤  

---

## 9. M1 接口清单

前缀：`/api`。均需登录；写操作按角色鉴权。

### B.9.1 平台 · 客户

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/customers` | 分页列表 |
| POST | `/api/customers` | 创建；**自动建 default 工作区** |
| GET | `/api/customers/:id` | 详情 |
| PUT | `/api/customers/:id` | 更新/停用 |
| POST | `/api/customers/:id/topup` | 客户充值 |
| GET | `/api/customers/:id/workspaces` | 工作区列表 |

### B.9.2 工作区

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/api/customers/:id/workspaces` | 创建工作区 |
| GET | `/api/workspaces/:id` | 详情 |
| PUT | `/api/workspaces/:id` | 更新/停用 |
| POST | `/api/workspaces/:id/transfer-quota` | 从客户池划拨到工作区 |

### B.9.3 成员与邀请

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/customers/:id/members` | 成员列表 |
| DELETE | `/api/customers/:id/members/:userId` | 移除成员 |
| POST | `/api/customers/:id/invitations` | 创建邀请 |
| GET | `/api/customers/:id/invitations` | 邀请列表 |
| POST | `/api/invitations/:token/accept` | 接受邀请 |
| POST | `/api/invitations/:token/revoke` | 作废邀请 |

### B.9.4 工作区成员

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/workspaces/:id/members` | |
| POST | `/api/workspaces/:id/members` | |
| DELETE | `/api/workspaces/:id/members/:userId` | |

### B.9.5 令牌 / 日志 / 上下文（扩展）

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/api/token` | body 可选 `workspace_id` |
| GET | `/api/token` | 按用户/工作区过滤 |
| GET | `/api/log/...` | 按客户/工作区/本人范围过滤 |
| GET | `/api/user/self/customer` | 当前客户、工作区、角色 |
| POST | `/api/user/self/current-workspace` | 切换当前工作区（仅 UX；扣费以 Token 上 workspace_id 为准） |

### B.9.6 Relay

`/v1/*` 路径不变。Token 含 `workspace_id` 时：

1. 校验客户/工作区启用  
2. 扣 `workspaces.quota`  
3. 写日志带上客户/工作区 ID；若走专属/BYOK 则标记 `upstream_source`（**不写 Key**）  
4. **选渠**：按客户 `upstream_mode` 执行 §16.5 顺序（默认 `shared` = 现网全球选渠）  

---

### B.9.7 独立上游 / BYOK（M1 必做）

完整设计见 **§16**（本文件后文）。M1 验收须覆盖：默认 shared 与现网一致；可开通 dedicated/byok/hybrid；凭证加密脱敏；个人令牌不受影响。


---

## 10. 关键客户 / 接受邀请（事务要点）

### 创建客户

```text
BeginTx
  insert customer
  insert workspace (slug=default, is_default=true)
  insert customer_members (owner)
  update users.customer_id   -- owner 若已有客户则失败
Commit
```

### 接受邀请

```text
校验 invitation pending 且未过期
若 users.customer_id 已有且不是本客户 → 错误
BeginTx
  users.customer_id = customer_id
  upsert customer_members
  upsert workspace_members
  invitation.status = accepted
Commit
```

### 移除成员（建议）

禁用该用户在该客户下所有工作区令牌，并清空 `users.customer_id`（若其仅属于该客户）。

---

## 11. 前端菜单（M1）

**平台超管**

- 客户管理（含充值、上游模式、渠道绑定、开通 BYOK）  
- （现有）渠道、模型、定价、系统设置等  

**已入客户用户**

- 工作区  
- 成员与邀请（admin+）  
- 额度（admin+）  
- 上游 / BYOK（admin+，且已开通）  
- 令牌  
- 用量日志  

顶栏：当前客户名（只读，因单客户）+ 工作区切换。

---

## 12. 分期建议

| 阶段 | 内容 |
| --- | --- |
| **M1** | 客户/工作区/成员/邀请；充值与划拨；工作区池扣费；隔离；**独立上游/BYOK** |
| **M2** | 使用账本、导出、客户分群、预算预警（对照 DogRouter「使用账本 / 供应商报表」） |
| **M3** | 已审批模型白名单、工作区/令牌限流（对照「策略 → 已审批流量」） |
| **M4** | 客户在线充值、流水/授信/开票（轻量）、成本对账（轻量） |
| **M5** | SSO、审计增强、策略包、SLA 配套指标（商务加购） |
| **主路线不做** | 机构层（见 **§B.9.7**） |

> BYOK 详细设计见 **§16**（**已纳入 M1**）。  
> M1 任务拆分见 [`customer-workspace-m1-implementation-tasks.md`](./customer-workspace-m1-implementation-tasks.md)。

---

## 13. 明确不做：机构层

曾讨论在客户之上增加「机构」，当前决定：

> **先不考虑机构。**

保持：

```text
平台 → 客户 → 工作区
```

若未来需要机构，见 **§B.9.7** 单独立项草案；M1 **不预埋**机构表。客户表若日后扩展，可再增加可空 `institution_id`。

---

## 14. 开放事项（实现前可再定）

### M1 相关（任务文档已给默认建议）

1. 用户退出客户后，是否允许加入另一家（建议：允许，因仍满足「同一时刻只属一家」）  
2. 客户令牌是否允许成员看到同工作区他人令牌（建议：默认仅自己的，admin 可见全部）  
3. 客户池充值：M1 先超管线下；在线支付见 M4  

### M2–M5 相关

已按行业默认确认，见 **§B.7**。

---

## 15. 文档与实现状态

| 项 | 状态 |
| --- | --- |
| 产品决策基线 | 已确认 |
| M1 表结构 / 接口 / BYOK（§16） | 已确认（本文 Part A + §16） |
| M2–M5 + 深度项 | 已确认（本文 Part B） |
| 机构层 | 不做（§B.9.7 仅草案） |
| M1 实现任务拆分 | [`customer-workspace-m1-implementation-tasks.md`](./customer-workspace-m1-implementation-tasks.md) |
| 管理层汇报 | [`customer-workspace-executive-brief.md`](./customer-workspace-executive-brief.md) |
| 代码实现 | **未开始**（需另行指令「开始开发」或「开始开发 T01」） |

---

## 16. 独立上游 / BYOK（M1 正式范围）

> **状态**：设计已确认，**纳入 M1 交付**。  
> **默认**：新客户 `upstream_mode=shared`（全球共享，与现网一致）。  
> **开通**：超管按客户打开 dedicated / byok / hybrid；商业上可作为加购开关，工程上属 M1。  
> **规范性全文**：下列小节；Part A §9.7 指向本节。

### 16.0 说明

M1 Relay 须实现 **§16.5** 选渠；`upstream_mode=shared` 时行为与现网全球选渠一致。

### 16.1 目标

支持两类能力（可同时存在）：

| 模式 | 含义 | 谁提供上游 Key |
| --- | --- | --- |
| **A. 独立上游（专属渠道绑定）** | 该客户令牌优先/仅走平台为其配置的渠道 | 平台（超管建渠道并绑定客户） |
| **B. BYOK** | 客户上传自有上游 Key，请求用该 Key 出站 | 客户 |

未开通时：行为与 M1 完全一致（只走全球共享渠道）。

### 16.2 非目标

- 客户在 UI 里随意创建任意类型上游（一期：超管开通 + 客户仅管理自己的 BYOK 凭证）  
- 把 BYOK Key 明文返回给前端或写入普通日志  
- 机构级共用 BYOK（机构层不做）

### 16.3 领域模型

```text
customers
  ├── upstream_mode: shared | dedicated | byok | hybrid
  ├── allow_global_fallback: bool   -- 无可用专属/BYOK 时是否回落共享渠道
  ├── byok_enabled: bool
  ├── customer_channel_bindings[]   -- 模式 A：绑定已有 channels.id
  └── customer_upstream_credentials[] -- 模式 B：加密后的上游 Key + base_url/类型
```

`upstream_mode` 建议：

| 值 | 行为 |
| --- | --- |
| `shared` | 默认；仅全球渠道（M1） |
| `dedicated` | 仅/优先绑定渠道 |
| `byok` | 仅/优先客户凭证 |
| `hybrid` | 先 BYOK/专属，失败或未配置再按 `allow_global_fallback` |

### 16.4 数据表草案

**`customers` 扩展**

| 字段 | 说明 |
| --- | --- |
| `upstream_mode` | `shared` / `dedicated` / `byok` / `hybrid` |
| `allow_global_fallback` | bool，默认 true（更安全的商业默认也可 false，开通时由超管定） |
| `byok_enabled` | bool，功能开关；false 时忽略凭证表 |

**`customer_channel_bindings`**

| 字段 | 说明 |
| --- | --- |
| id | PK |
| customer_id | FK |
| channel_id | 指向平台 `channels` |
| priority | 越小越优先 |
| model_mapping | 可选 JSON；覆盖该客户模型名映射 |
| status | 启用/停用 |
| created_at / updated_at | |

唯一：`(customer_id, channel_id)`。

**`customer_upstream_credentials`（BYOK）**

| 字段 | 说明 |
| --- | --- |
| id | PK |
| customer_id | FK |
| name | 显示名，如「公司 Azure OpenAI」 |
| type | 与现网渠道类型对齐（openai / azure / …） |
| base_url | 可空，空则用类型默认 |
| key_ciphertext | 加密存储（KMS 或应用级密钥，**禁止明文**） |
| key_hint | 末 4 位，仅展示 |
| models | JSON 允许模型列表；空=不额外限制（仍受工作区白名单约束） |
| priority | |
| status | |
| created_by | user_id |
| rotated_at | |
| created_at / updated_at | |

### 16.5 Relay 选渠顺序（客户令牌）

```text
1. 令牌校验、客户/工作区启用、白名单、工作区池、限流（既有）
2. 若 !byok_enabled && upstream_mode==shared → 现网全球选渠（M1）
3. 构建候选列表（按 priority）：
   - dedicated/hybrid：customer_channel_bindings → 解析为 Channel
   - byok/hybrid：customer_upstream_credentials → 运行时组装临时 Channel（Key 解密仅在内存）
4. 按模型名过滤候选；权重/优先级与现网渠道选择对齐
5. 候选空且 allow_global_fallback → 回落全球渠道
6. 仍空 → 明确错误 upstream_not_configured / channel_not_found
7. 出站成功后：日志标记 upstream_source=shared|dedicated|byok，**不写 Key**
```

个人令牌（无 customer_id）：**永远**走全球共享，不受 BYOK 影响。

### 16.6 计费语义（需实现时写死）

| 策略 | 说明 | 默认建议 |
| --- | --- | --- |
| **计量 + 平台费率** | 仍扣工作区池（可按模型倍率，含平台服务费） | **默认** |
| **仅计量（BYOK 优惠倍率）** | 工作区池按更低倍率扣，表示只收网关费 | 可配 `customers.byok_quota_ratio` |
| **上游成本** | BYOK 客户在 M4d 对账中供应商成本记 0 或 N/A | 与 M4d 联动 |

调用失败（上游 401 Key 无效）：**不扣或预扣全退**（与现网失败退款策略一致）。

### 16.7 接口草案

| 方法 | 路径 | 谁 | 说明 |
| --- | --- | --- | --- |
| PUT | `/api/customers/:id/upstream-settings` | 超管 | mode、fallback、byok_enabled |
| GET/POST/DELETE | `/api/customers/:id/channel-bindings` | 超管 | 模式 A |
| GET | `/api/customers/:id/upstream-credentials` | 客户 admin+ | 列表（仅 hint，无密文） |
| POST | `/api/customers/:id/upstream-credentials` | 客户 admin+ | 创建；body 含明文 key，服务端加密后丢弃明文 |
| PUT | `/api/customers/:id/upstream-credentials/:cid` | 客户 admin+ | 轮换 key / 改 models |
| DELETE | `/api/customers/:id/upstream-credentials/:cid` | 客户 admin+ | 删除 |
| POST | `/api/customers/:id/upstream-credentials/:cid/test` | 客户 admin+ | 探测连通（可选） |

所有写操作写审计日志（actor、customer_id、credential_id、动作；**无 Key**）。

### 16.8 UI

- 超管「客户详情」：上游模式、绑定渠道、是否允许回落、开通 BYOK  
- 客户后台「上游 / BYOK」：凭证列表、添加/轮换/删除、测试（若实现）  
- 文档提示：Key 泄露责任在客户；平台仅托管加密存储  

### 16.9 安全

1. 落库必须加密；进程内存解密窗口尽量短  
2. API 永不返回完整 Key；导出日志脱敏  
3. 权限：仅客户 admin/owner 与超管可管理；普通成员不可见 hint 以外信息（或连列表都不可见，可配置）  
4. 删除客户或关闭 byok_enabled：停用凭证，既有请求不再使用  

### 16.10 验收

- [ ] `upstream_mode=shared` 的客户与 M1 选渠结果一致  
- [ ] dedicated 绑定后，该客户流量不进入未绑定的共享渠道（除非 fallback）  
- [ ] BYOK 请求实际使用客户 Key（可用测试 upstream 验证）  
- [ ] 接口/日志/审计均无完整 Key  
- [ ] 个人令牌不受客户 BYOK 配置影响  
- [ ] 工作区池扣费仍生效（按计费策略）  

### 16.11 与其它阶段关系

| 阶段 | 关系 |
| --- | --- |
| M1 | **含 BYOK**；`shared` 客户选渠与现网一致 |
| M3 | 白名单仍在 BYOK 之前校验 |
| M4d | BYOK 客户成本侧标记为客户自付 |
| M5 | 可与 SSO 同属加购包对外售卖 |
| X3 私有化 | 私有化部署仍可用同一 BYOK 模型 |

---


---

# Part B — 路线图与后期设计（M2–M5 / 深度项）

> 原 enterprise-gap-features-design.md。M1 范围以 Part A 为准；BYOK 见 **§16**。

## B.0. 对照结论（缺口清单）

DogRouter 客户页公开能力可概括为四块：

| # | DogRouter 能力 | 我们现状 / M1 | 本文设计归属 |
| --- | --- | --- | --- |
| A | 客户 / 工作区 + 配额编排 | M1：客户 / 工作区 + 工作区池扣费 | ✅ M1 已覆盖 |
| B | 使用账本、导出、客户分群 | 仅有通用日志 | **M2** |
| C | 策略治理：已审批模型、限流、审批阈值 | 令牌模型限制较弱 | **M3** |
| D | 客户计费：预付进池、开票、信用、税务、对账 | 超管线下充值 | **M4** |
| E | 客户加固：审计增强、SSO、私有化策略、SLA | 基础审计/2FA | **M5** |
| F | 供应商合并计费 / 上游发票对账 | 无 | **M4 子项** |
| G | 机构层 | 明确不做 | 🚫 主路线不做；**§9.7 单独立项草案** |
| H | 深度缺口（审批流/税务自动化/上游勾兑/审查/护栏/风控等） | M1–M5 仍弱 | **§9 深度设计** |

页面架构五步与我们分期映射：

```text
01 验证客户     → M1 客户创建 + 邀请
02 分配策略     → M3
03 路由已审批流量 → M1 网关 + M3 白名单
04 监控风险     → M2 账本/告警 + M3 限流
05 结算与报告   → M2 导出 + M4 计费开票
```

---

## B.1. 总原则

1. **M1 先行**：组织与工作区池跑通后，再叠账本/策略/商业计费。  
2. **M1 含独立上游 / BYOK**（§16）：默认全球共享；按客户开通 dedicated/byok/hybrid。  
3. **计费主账户仍是工作区池**；客户池、信用额度只做分配与授信，不改变「调用扣工作区」主路径。  
4. **个人模式继续隔离**：下列能力默认仅对客户令牌 / 客户后台生效。  
5. 每阶段先定 **目标 / 非目标 / 数据 / 接口 / UI / 验收**，确认后再拆实现任务。

---

## B.2. M2 — 使用账本与运营报表

### 2.1 对标 DogRouter

- 「使用账本：跨客户、模型、团队与计费主体追踪支出与 Token」  
- 「供应商报表：使用导出、流量摘要与客户分群」  
- 「按工作区、环境、用户维度追踪消耗」

### 2.2 目标

1. 客户管理员可按 **时间 / 工作区 / 成员 / 模型** 查看用量与费用汇总  
2. 支持 **CSV 导出**（平台超管可跨客户导出）  
3. 基础「客户分群」：按客户标签或消耗层级筛选（轻量）  
4. 可选：工作区/客户预算 **预警**（达 80%/100% 通知，不替代硬限额）

### 2.3 非目标（M2 不做）

- 正式发票、税务单据  
- 与上游供应商发票自动勾兑  
- 复杂 BI / 实时大盘（可用现有看板扩展，不另建数仓）

### 2.4 领域与数据

在现有 `logs`（已含 customer_id / workspace_id，M1）之上：

| 对象 | 说明 |
| --- | --- |
| `customer_usage_daily`（建议） | 按日聚合：customer_id, workspace_id, user_id?, model_name, quota_sum, token_sum, request_count |
| 或 | 一期仅实时 `GROUP BY` 查 logs，量大后再上聚合表 |

客户标签（可选）：

| 字段 | 说明 |
| --- | --- |
| `customers.tags` JSON | 如 `["vip","region:cn"]`，用于分群筛选 |

预算预警：

| 对象 | 说明 |
| --- | --- |
| `budget_alerts` | customer/workspace 级阈值、通知方式（邮件/站内）、上次触发时间 |

### 2.5 接口草案

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/customers/:id/usage/summary` | 汇总；query: from,to, group_by=workspace\|user\|model |
| GET | `/api/customers/:id/usage/export` | CSV 导出 |
| GET | `/api/customers` + `tag=` | 超管分群筛选（可选） |
| PUT | `/api/workspaces/:id/budget-alert` | 配置预警阈值 |

### 2.6 UI

- 客户后台新增 **用量 / 账本**  
- 筛选器 + 汇总表 + 导出按钮  
- 超管客户管理列表支持按消耗/标签排序筛选  

### 2.7 验收

- [ ] 客户 A 看不到客户 B 汇总  
- [ ] 导出字段含客户、工作区、用户、模型、额度、时间范围  
- [ ] 个人模式用户无此菜单（或仅个人日志，不叫客户账本）  

---

## B.3. M3 — 策略治理（已审批流量）

### 3.1 对标 DogRouter

- 「在策略感知控制下路由 **已审批** 模型流量」  
- 「分配策略 → 路由已审批流量」  
- 「模型权限与工作区策略 / 客户级限流」  
- 「审批流程、预算、审计日志与多种已审批模型选项」

### 3.2 目标

1. **工作区级模型白名单**（空=不额外限制，沿用渠道能力 + 令牌限制）  
2. **客户级默认策略**可下发到新工作区（可选覆盖）  
3. **工作区/令牌级速率限制**（RPM/RPD 或沿用现网模型限流并挂到工作区维度）  
4. （可选增强）模型变更需客户 admin **审批** 才进白名单——M3 可先做「管理员直接编辑白名单」，审批流见 **§9.1 M3.1**  

### 3.3 非目标

- 逐请求人工审批（太重）  
- 区域合规策略引擎（数据驻留/出口管制）——可进 M5  
- 每客户独立上游渠道  

### 3.4 数据

| 字段/表 | 说明 |
| --- | --- |
| `workspaces.allowed_models` | JSON 数组；空=不启用白名单 |
| `customers.default_allowed_models` | 可选；创建工作区时复制 |
| `workspaces.rate_limit_rpm` / `rpd` | 可空=不限制 |
| `tokens` 现有模型限制 | 与工作区白名单取 **交集**（更严者优先） |

Relay 校验顺序（客户令牌）：

```text
客户/工作区启用
 → 工作区白名单（若配置）
 → 令牌模型限制（若配置）
 → 渠道是否提供该模型
 → 工作区池额度
 → 工作区/令牌限流
```

### 3.5 接口草案

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET/PUT | `/api/workspaces/:id/policies` | allowed_models、rate limits |
| GET/PUT | `/api/customers/:id/policies` | 默认策略 |
| （可选）POST | `/api/customers/:id/model-approval-requests` | 完整设计见 **§9.1** |

### 3.6 UI

- 工作区设置：**可用模型**、**速率限制**  
- 调用被拒时返回明确错误：`model_not_allowed` / `rate_limited`  

### 3.7 验收

- [ ] 白名单外模型调用失败，工作区池不扣（或预扣全退）  
- [ ] 白名单为空时行为与 M1 一致  
- [ ] 限流触发返回 429，且范围仅限该工作区令牌流量  

---

## B.4. M4 — 客户计费与结算闭环

### 4.1 对标 DogRouter

- 「客户计费：预付费余额、开票、信用额度、税务文档与对账」  
- 「合并计费、受控使用」  
- 「将供应商发票与客户使用账本、付款、积分与调整项匹配」

### 4.2 目标（可拆两刀）

**M4a 资金入客户池（在线）**

1. 支持支付成功后贷记 **客户池**（不是个人钱包）  
2. 客户 admin 发起充值订单；平台配置收款方式（复用现有支付网关能力）  
3. 完整订单状态机：创建 → 支付中 → 成功入账 / 失败  

**M4b 商务单据与授信（按需）**

1. **信用额度** `customers.credit_quota`：工作区可支用上限 = 现金池 + 信用（或仅允许客户池透支到信用线）  
2. **调账**（平台超管）：加减客户池并记原因  
3. **对账单 / 发票申请**：导出周期账单；发票信息由客户维护，开票流程可先半人工  
4. **上游成本对账（轻量）**：按日汇总「对客户收费额度」vs「渠道成本估算」（依赖渠道成本配置，允许误差）  

### 4.3 非目标

- 完整财务 ERP、自动报税  
- 多币种复杂结算（可先单一展示币种）  
- 机构/代理商分润（机构层不做）  

### 4.4 数据草案

| 表 | 说明 |
| --- | --- |
| `customer_topup_orders` | 客户充值订单：金额、支付渠道、状态、customer_id |
| `customer_ledger_entries` | 客户流水：topup / transfer_out / transfer_in / adjust / credit |
| `customers.credit_limit` | 授信上限（可选） |
| `customer_billing_profiles` | 开票抬头、税号、地址 |
| `customer_invoice_requests` | 发票申请状态（draft/submitted/issued） |

**扣费与授信关系（需确认，默认提案）：**

```text
工作区可用预算 = workspace.quota
客户可划拨余额 = customers.quota + 剩余可用信用
调用仍只扣 workspace.quota
信用仅影响「客户能划拨/预支多少到工作区」，不直接在 Relay 扣信用
```

### 4.5 合规注意（设计约束）

- 上线 M4a 前需完成产品外合规评估（经营主体、支付资质、合同）。  
- 技术侧：支付回调必须校验客户 ID，**禁止**写入个人 `User.Quota`。  
- 审计：所有入账/调账写 `customer_ledger_entries` + 管理审计日志。  

### 4.6 接口草案

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/api/customers/:id/topup-orders` | 客户 admin 创建支付订单 |
| GET | `/api/customers/:id/ledger` | 客户流水分页 |
| POST | `/api/customers/:id/adjustments` | 超管调账 |
| GET/PUT | `/api/customers/:id/billing-profile` | 开票资料 |
| POST | `/api/customers/:id/invoice-requests` | 申请发票 |
| GET | `/api/admin/cost-reconciliation` | 超管成本对账摘要（可选） |

### 4.7 UI

- 客户 **充值 / 流水 / 开票资料**  
- 超管 **调账 / 对账看板**  

### 4.8 验收

- [ ] 支付成功只增加对应客户池  
- [ ] 流水可追溯每笔 topup/划拨/调账  
- [ ] 个人钱包充值路径不被客户订单误用  

---

## B.5. M5 — 客户加固（治理与交付形态）

### 5.1 对标 DogRouter

- 产品层级「客户：私有化策略、审计、SSO 和定制 SLA」  
- 「安全审计日志，覆盖身份验证、API 请求、内容审核和管理员操作」  
- 客户验证、区域策略、用例审查  

### 5.2 目标（可选项打包，按商务套餐启用）

| 能力包 | 内容 |
| --- | --- |
| **M5-SSO** | 客户级 OIDC/SAML 登录；成员仅能通过客户 IdP 进入（可与现有 OIDC 配置按 customer 绑定） |
| **M5-Audit** | 管理操作审计增强：邀请、划拨、策略变更、导出走独立审计表，保留期可配 |
| **M5-Policy-Pack** | 区域/数据策略开关（如禁止某类模型、强制私有渠道标签）——依赖渠道标签，仍共享网关 |
| **M5-SLA** | 非纯软件：承诺可用性/支持响应；系统侧提供状态页、错误预算指标导出 |

### 5.3 非目标

- 完整私有化交付工程（独立部署可用现网 Docker，不单列「专属分叉」）  
- 定制 SLA 的法务文本（商务合同）  

### 5.4 数据 / 接口（概要）

- `customer_idp_configs`：OIDC issuer、client、强制 SSO 开关  
- `admin_audit_logs`：actor、customer_id、action、payload、ip、time  
- 策略包字段挂在 `customers.settings` JSON  

### 5.5 验收（按启用项）

- [ ] 强制 SSO 开启后，密码登录对客户成员关闭（超管豁免策略另定）  
- [ ] 关键策略/划拨/导出均有审计记录且客户隔离  

---

## B.6. 总路线图（主路线已冻结；深度项按需插队）

```text
【主路线 — 已确认】
M1   客户/工作区/邀请/工作区池扣费/隔离 + **独立上游/BYOK**（默认 shared）
M2   使用账本、导出、分群、预算预警
M3   已审批模型白名单、工作区限流
M4   客户在线充值 + 流水/授信/开票（轻）+ 成本对账（轻）
M5   SSO / 审计增强 / 策略包 / SLA 指标（加购，默认关）

【深度补齐 — 设计见 §B.9；默认排在主路线之后或旁路】
M3.1 模型变更审批流
M4c  税务文档 / 开票自动化增强
M4d  上游发票 ↔ 客户账本勾兑
M6a  区域与用例审查工作流
M6b  内容安全护栏（客户策略）
M6c  实时风控监控台
X1   机构层（单独立项，默认不做）
X3   专属私有化交付 SKU + SLA 产品化（商务+运维为主）
```

依赖关系：

```text
M1（含 BYOK）→ M2 / M3 / M4
M3 → M3.1
M4 → M4c / M4d
M2+M3 → M6c
M5 ↔ M6a
X1 / X3 合同驱动
```

**不因「商务催收款」默认插队 M4**。BYOK **已在 M1**：未开通客户行为等同全球共享。

---

## B.7. 已确认决策（行业默认）

| # | 决策 | 结论 |
| --- | --- | --- |
| 1 | 分期顺序 | **M1（含 BYOK）→ M2 → M3 → M4 → M5** |
| 2 | M3 范围 | 先做 **白名单 + 限流**；模型变更 **审批流 = M3.1** |
| 3 | M4 信用语义 | 信用只影响 **客户可划拨上限**；**调用仍只扣工作区池** |
| 4 | M5 SSO / 私有化策略等 | **商务加购**，默认关闭 |
| 5 | 机构层 | **主路线不做**；设计见 **§B.9.7** |
| 6 | 独立上游 / BYOK | **纳入 M1 正式范围**（§16）；默认 `shared`，按客户开通 |
| 7 | M1 充值 | 继续 **超管线下充客户池**；在线进池属 M4 |
| 8 | 深度缺口其余项 | 设计已补齐；优先级低于 M1–M5，可单批 |

下一步（仍先不动代码）：批准 M1 开工（含 BYOK）→ `开始开发 T01` / `按 M1-a 开工`。

---

## B.8. 文档关系

| 文档 | 角色 |
| --- | --- |
| **本文** `customer-workspace-design.md` | 唯一设计全文（Part A / §16 / Part B） |
| [`customer-workspace-m1-implementation-tasks.md`](./customer-workspace-m1-implementation-tasks.md) | M1 开发任务 |
| [`customer-workspace-executive-brief.md`](./customer-workspace-executive-brief.md) | 管理层汇报 |

---

## B.9. 深度缺口设计（仍弱于 DogRouter 的项）

> 对照结论：即使做完 M1–M5，相对 DogRouter 客户页仍偏弱的能力。  
> 本节给出可落地设计；其中 **BYOK（§16）已纳入 M1**；其余深度项仍按需立项。

### B.9.0 总览

| ID | 缺口 | 对标 DogRouter | 建议归属 | 态度 |
| --- | --- | --- | --- | --- |
| **BYOK** | **独立上游 / 自带 Key** | 专属渠道 / BYOK | **M1** | **设计已确认，M1 必做** |
| M3.1 | 模型变更审批流 | 审批阈值 / 已审批模型流程 | M3 之后 | 设计齐全，按需开工 |
| M4c | 税务 / 开票自动化 | 税务文档、开票 | M4 增强 | 设计齐全 |
| M4d | 上游发票勾兑 | 供应商发票与客户账本匹配 | M4 增强 | 设计齐全 |
| M6a | 区域与用例审查 | 区域策略、用例审查 | M6 | 设计齐全 |
| M6b | 内容安全护栏 | 安全护栏 / 内容审核 | M6 | 设计齐全 |
| M6c | 实时风控台 | 监控风险 | M6 | 设计齐全 |
| X1 | 机构层 | 多客户之上的集团/代理 | 单独立项 | 默认不做 |
| X3 | 私有化 SKU + SLA 产品 | 专属部署、定制 SLA | 商务+运维 | 软件只配套 |

---

### B.9.1 M3.1 — 模型变更审批流

#### 目标

成员或工作区管理员 **申请** 开放某模型 → 客户 admin（或平台指定审批人）**批准/驳回** → 通过后写入工作区白名单。  
**不做** 逐请求人工审批。

#### 状态机

```text
draft → pending → approved →（自动）写入 workspaces.allowed_models
                 ↘ rejected（可附原因；可再次申请）
                 ↘ cancelled（申请人撤回）
```

#### 数据

| 表/字段 | 说明 |
| --- | --- |
| `model_approval_requests` | id, customer_id, workspace_id, model_name, reason, status, requester_id, reviewer_id, review_note, created_at, reviewed_at |
| `customers.approval_required_for_models` | bool；false=仍允许 admin 直接改白名单（兼容 M3） |

#### 接口

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/api/workspaces/:id/model-approval-requests` | 发起申请 |
| GET | `/api/customers/:id/model-approval-requests` | 列表（按状态筛） |
| POST | `/api/model-approval-requests/:id/approve` | 批准并写入白名单 |
| POST | `/api/model-approval-requests/:id/reject` | 驳回 |

#### 规则

- 已在白名单中的模型禁止重复申请。  
- 批准事务：更新 request + `allowed_models` 追加，写审计日志。  
- 可选：高风险模型标签（如 `model_catalog.risk_level`）强制走审批，普通模型仍可直接加。

#### 验收

- [ ] `approval_required=true` 时，非审批路径无法扩大白名单  
- [ ] 批准后立即允许调用；驳回后仍不可调用  
- [ ] 全链路有审计记录  

---

### B.9.2 M4c — 税务文档与开票自动化增强

#### 相对 M4b 的升级点

| M4b（轻量） | M4c（增强） |
| --- | --- |
| 客户填抬头；提交发票申请；超管线下开 | 申请可绑定 **账期账单**；状态机更完整；可对接开票服务商 API |
| 无税务文档库 | 客户可上传/下载 **合同、一般纳税人证明、开票记录 PDF** |

#### 数据

| 表 | 说明 |
| --- | --- |
| `customer_billing_periods` | 账期：customer_id, from, to, quota_sum, amount_display, status |
| `customer_invoice_requests` 扩展 | period_id, invoice_type(普通/专票), amount, tax_no, status, issuer_ref, pdf_url |
| `customer_tax_documents` | 文档类型、存储路径、有效期、上传者 |

#### 流程

```text
账期关闭（自动或超管）→ 生成账单 → 客户申请开票
  → submitted → issuing（对接第三方或人工）→ issued（回填号码/PDF）
  → 失败可重试
```

#### 非目标

- 不自建税务申报系统；不替客户报税。  
- 专票资质与开票主体合规仍为 **产品外**。

#### 验收

- [ ] 一笔发票申请可追溯到账期与用量汇总  
- [ ] 已开具发票不可重复开同一账期（或仅允许差额红冲流程，二期）  

---

### B.9.3 M4d — 上游发票与客户账本勾兑

#### 目标

平台运营能把 **供应商账单/发票**（BasicRouter 等）与 **对客户收取的额度/金额**、付款、调账对齐，找出差额。

#### 数据

| 表 | 说明 |
| --- | --- |
| `vendor_invoices` | 供应商、账期、币种、金额、税额、发票号、附件、录入人 |
| `vendor_invoice_lines` | 可选：按模型/渠道拆行 |
| `reconciliation_runs` | 一次对账任务：period, status, notes |
| `reconciliation_items` | run_id；customer_side_amount；vendor_side_amount；delta；customer_id?；channel_id?；status(matched/unmatched/adjusted) |

#### 对账逻辑（建议）

```text
客户侧：Σ customer_ledger / usage 折算金额（展示币种）
供应商侧：vendor_invoices 同账期金额
差额 = 客户侧收入 − 供应商成本 − 调账
允许配置「毛利率告警阈值」
```

#### 接口 / UI

- 超管：录入供应商发票、发起对账 run、查看 unmatched 列表、手工标记已解释差额。  
- 客户侧 **不可见** 上游发票（商业机密）。

#### 与 M4「轻量成本对账」关系

- M4：渠道成本 **估算**（配置单价 × token）。  
- M4d：以 **真实发票** 为准做勾兑；估算仅作交叉参考。

#### 验收

- [ ] 同账期可产出 matched / unmatched 清单  
- [ ] 调账写入后可参与下一次 run 消除差额  

---

### B.9.4 M6a — 区域与用例审查工作流

#### 目标

新客户开通或启用高风险能力前，走 **审查清单**（区域、数据驻留诉求、业务用例、是否对外服务等），通过后才放开对应策略开关。

#### 数据

| 表 | 说明 |
| --- | --- |
| `customer_review_cases` | customer_id, type(onboarding/use_case/region), status, checklist JSON, reviewer_id |
| `customers.region_policy` | 如 allowed_regions、data_residency_note（声明型，非自动执法） |
| `customers.use_case_tags` | 如 internal_only / public_facing |

#### 流程

```text
创建审查案 → 客户/销售填问卷 → 平台合规/运营审批
  → approved：打开对应 M5 策略包或模型风险等级
  → rejected：客户保持受限模板
```

#### 非目标

- 不实现真实跨境数据驻留执法（需专属部署/专属渠道时走 BYOK §16 / X3）。  
- 审查结论以 **开关与白名单** 落地，不以法律意见书替代。

#### 验收

- [ ] 未通过 onboarding 审查的客户可限制为「仅 default 工作区 + 低风险模型」  
- [ ] 审查记录可审计、可导出  

---

### B.9.5 M6b — 内容安全护栏（客户策略）

#### 目标

在客户/工作区级配置 **输入/输出护栏**：敏感词、PII 脱敏开关、第三方审核回调；命中可阻断或仅记日志。

#### 架构

```text
Relay 请求前：input guard（本地规则 / HTTP 审核服务）
Relay 响应后：output guard（可选，流式需分段或仅非流）
命中 → block | redact | log_only（按策略）
写 guard_events 供审计与风控台
```

#### 数据

| 表/字段 | 说明 |
| --- | --- |
| `workspaces.guard_policy` / `customers.guard_policy` | JSON：mode, providers[], block_categories[] |
| `guard_events` | customer_id, workspace_id, request_id, stage(in/out), action, categories, created_at |

#### 接口

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET/PUT | `/api/workspaces/:id/guard-policy` | 配置护栏 |
| GET | `/api/customers/:id/guard-events` | 事件列表 |

#### 非目标

- 不自研大模型安全模型；默认对接可插拔 Provider（含「仅本地词表」）。  
- 流式输出的完整语义审核允许降级为采样/异步。

#### 验收

- [ ] block 模式命中不扣费或预扣全退（与计费策略一致，需在实现任务写死）  
- [ ] 客户只能看本客户 guard_events  

---

### B.9.6 M6c — 实时风控监控台

#### 目标

平台超管（客户 admin 看本客户子集）对异常用量、突发 RPM、护栏命中、余额耗尽、失败率进行 **近实时** 观察与告警。

#### 能力列表

| 能力 | 说明 |
| --- | --- |
| 实时/准实时指标 | 按分钟聚合：RPM、错误率、消耗额度、护栏命中 |
| 规则告警 | 阈值 + 通知（邮件/Webhook）；与 M2 预算预警互补 |
| 一键处置 | 暂停工作区、吊销令牌、临时收紧限流（写审计） |

#### 数据

| 表 | 说明 |
| --- | --- |
| `risk_metric_minute` | 维度：customer/workspace/model；指标 JSON |
| `risk_alert_rules` | 表达式/阈值、通知渠道、启用状态 |
| `risk_alert_events` | 触发记录、是否已 acknowledge |

#### 非目标

- 不做完整 SIEM；可导出事件到外部。  
- 不做自动模型降级路由（可作为后续「智能路由」另项）。

#### 验收

- [ ] 注入突发流量可在约定延迟内（如 ≤2min）看到指标与告警  
- [ ] 处置动作立即生效且可审计  

---

### B.9.7 X1 — 机构层（单独立项草案，默认不做）

#### 何时需要

集团总部管多家子公司、或代理商给下游客户分额度。

#### 模型

```text
平台 → 机构 Institution → 客户 Customer → 工作区 Workspace
额度：平台 → 机构池 → 客户池 → 工作区池 → 调用扣工作区
```

#### 要点

| 项 | 设计 |
| --- | --- |
| 用户归属 | 仍挂在 **客户**；机构管理员通过「可管理的客户列表」授权 |
| 表 | `institutions`；`customers.institution_id` 可空；`institution_members` |
| 报表 | 机构维度汇总（复用 M2 聚合） |
| 对 M1 | **不预埋**；立项时再加可空外键，避免过度设计 |

#### 明确

主路线与 DogRouter 公开页未强制要求机构；**无商务合同需求不开工**。

---

### B.9.8 BYOK

> **已纳入 M1**，完整设计见本文 **Part A §16**（勿在此重复实现任务）。


### B.9.9 X3 — 专属私有化交付与 SLA 产品化

#### 拆分

| 层 | 内容 | 归属 |
| --- | --- | --- |
| 法务 SLA | 可用性百分比、赔偿条款 | **商务合同**（非本仓库功能） |
| 运维交付 | 独立 VPC/ECS、备份、升级窗口 | **运维手册**（可复用 `docs/installation`） |
| 软件配套 | 状态页、错误预算导出、租户级功能开关（M5-SLA） | **M5 / 本项增强** |
| 白牌 | 自定义 Logo/域名 | 可选小项，不阻塞 |

#### 设计结论

- **不维护永久产品分叉**；私有化 = 同一发行版 + 配置/部署差异。  
- SLA「产品化」= 套餐里勾选 M5-SLA 指标包 + 合同附件，而不是在代码里写赔偿逻辑。

---

### B.9.10 深度项推荐落地顺序（若全部要做）

```text
M1（含 BYOK）→ M2 → M3 → M3.1
              ↘ M4 → M4c → M4d
M2+M3 → M6c（风控）
M5 → M6a（审查）→ M6b（护栏，可与审查并行）
X1 / X3 仅合同驱动
```

---

---

## 合并修订记录

| 版本 | 说明 |
| --- | --- |
| v1.0 | 合并原两份设计为本文；BYOK 位于 §16 |
| v1.1 | 与任务/汇报对齐：菜单与权限含 BYOK；文档集统一命名；修正 upstream_mode 表述 |
| — | 合并前摘要：A v0.1–v0.9；B v0.1–v0.6 |

---

## 相关文档

| 文档 | 说明 |
| --- | --- |
| [`customer-workspace-m1-implementation-tasks.md`](./customer-workspace-m1-implementation-tasks.md) | M1 开发任务 T01–T15 |
| [`customer-workspace-executive-brief.md`](./customer-workspace-executive-brief.md) | 管理层汇报简版 |
