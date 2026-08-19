# 客户自助注册开户

> 状态：**已实现**  
> 依据：[customer-workspace-design.md](./customer-workspace-design.md)  
> UI 参考：OpenRouter 注册（Individual / Organization；组织名 + 邀请成员）  
> 约束：不改现有**个人注册步骤**；组织只在选中后多一页  
> 开关：`CustomerSelfRegisterEnabled`（默认开；系统设置 → 认证）  

---

## 1. 背景

现网客户只能由**平台超管**创建（`POST /api/customers`，指定 owner）。个人仍走 `/sign-up` 现有流程。

本期增加：**用户在注册时选择「组织」，自助开户**，成为该客户 owner。超管开户路径保留。

---

## 2. 已确认交互

`/sign-up` 顶部增加两个选项：**个人**（默认）| **组织**。

### 2.1 个人（默认）

现有注册表单与提交逻辑**完全不变**：用户名 / 邮箱 / 密码 / 验证码 / 协议 / Turnstile，按钮仍为「创建账户」。OAuth、微信等入口与现在相同。

### 2.2 组织

第 1 页仍是**同一套**现有注册表单（OAuth / 微信 / 验证码 / 协议全部复用），按钮改为「下一步」（不立刻建号）。

第 2 页：组织名称 + 邀请成员邮箱（可增删）。按钮：「返回」回第 1 页；「创建账户」一次提交：建用户 + 创建客户（当前用户为 owner）+ 写邀请。

### 2.3 OAuth / 微信（组织）

第 1 页点 OAuth / 微信：按现网先完成账号创建或登录，再进入第 2 页。第 2 页「创建账户」只补创建客户和邀请（用户已存在）。

第 1 页若走账号密码「下一步」，第 2 页「创建账户」才真正注册 + 开户。

### 2.4 邀请链接

`/sign-up?invite=...`（或现有邀请参数）只走**个人现有流程**，不进入第 2 页；注册后接受邀请加入已有客户，不新建客户。

---

## 3. 后端行为

### 3.1 个人

现有 `Register`，行为不变。

### 3.2 组织（密码注册）

扩展 `Register`（或等价一次事务接口），在建 `User` 成功后：

1. 调用现有 `CreateCustomerWithOwner`：客户 + `slug=default` 工作区 + owner + `users.customer_id`  
2. `upstream_mode=shared`；**不**自动开通 BYOK  
3. 客户池额度 **0**  
4. 有邀请邮箱则写现有邀请记录（未注册者后续注册并接受；已有客户则邀请侧按现规拒绝）

### 3.3 组织（OAuth 已有用户）

用户已登录且 `customer_id` 为空：第 2 页提交只创建客户 + 邀请。已有 `customer_id` 则拒绝（一人一家客户）。

### 3.4 超管路径

`POST /api/customers`（RootAuth）不变。充值仍仅超管。

### 3.5 开关

建议 `CustomerSelfRegisterEnabled`（**默认开**）。关闭时注册页不显示「组织」。

---

## 4. 不变的规则

- 用户 ↔ 客户仍为一对一  
- 客户令牌只扣工作区池，不扣 `User.Quota`  
- 个人令牌仍走个人额度  
- 自助客户额度 0，需超管充值后再划拨工作区，工作区令牌才能调用  
- 不做：在线支付直充客户池、开户审批流、一人多家客户、把组织信息塞进个人单页表单、登录后再做独立引导向导  

---

## 5. 实现说明

- 开关 `CustomerSelfRegisterEnabled`（默认开）；关闭时注册页不显示「组织」
- 密码组织路径：扩展 `POST /api/user/register`（`account_type=organization`）
- OAuth / 微信组织路径：登录后 `POST /api/customers/self`
- 超管 `POST /api/customers` 不变
- 自助客户：额度 0、`shared`、BYOK 关；邀请失败不回滚用户/客户
- 未做：超管客户列表区分来源（自助 / 超管）  
