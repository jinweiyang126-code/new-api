# 前端国际化（i18n）标准

**适用范围**：`web/` 下所有用户可见文案（管理端、组织侧、公共页）  
**对标实现**：`web/src/features/customer-org/`（toast / 表单 / 枚举 / API 错误已对齐）  
**词条文件**：`web/src/i18n/locales/en.json`、`zh.json`（至少中英同步；其他语种可后续补）  

后续**新建或改版页面**，默认按本标准完成国际化；不得只写英文硬编码，也不得只改界面文案却漏掉 toast / 校验 / 后端错误。

相关文档：列表页结构见 [admin-list-page-standard.md](./admin-list-page-standard.md)。

---

## 1. 基本原则

1. **用户可见字符串一律走 `t('…')`**  
   标题、按钮、空态、Placeholder、Tooltip、`aria-label`、Confirm 文案、Toast、表单校验、筛选项标签、表格枚举徽章等。
2. **英文原文即 i18n key**（与现网一致）  
   `t('Create Workspace')` → `en.json` / `zh.json` 中同名 key。
3. **中英必须同时落词条**  
   新增或修改 `t('…')` 时，同步更新 `en.json` 与 `zh.json`。
4. **禁止**在 JSX / toast / zod 里留下裸英文业务文案（专有名词、代码、用户数据除外）。
5. **后端 `message` 不是最终展示文案**  
   必须经翻译后再 toast / 展示；不能 `toast.error(res.message)` 直接弹出英文。

---

## 2. 必须覆盖的文案面

| 类别 | 要求 | 反例 |
| --- | --- | --- |
| 页面壳 | `SectionPageLayout` Title / 空态说明 | 写死 `"Workspaces"` |
| 表格 | 列头、空标题/描述、搜索 placeholder、筛选项 **label** | 筛选项 `{ label: 'pending' }` |
| 枚举徽章 | `owner` / `pending` 等用映射后的 `t('Owner')` / `t('Pending')` | `label={row.status}` 原文 |
| 抽屉 / 对话框 | 标题、描述、按钮、字段 Label、Placeholder | `placeholder='optional'` |
| Zod / RHF | `min(1, t('…'))`、`email(t('…'))` 等；schema 用 `useMemo(..., [t])` | `z.string().min(1)` 默认英文 |
| Toast 成功 | `toast.success(t('…'))` | 硬编码英文 |
| Toast 失败 | `apiErrorMessage(t, res.message, 'Failed to …')` | `res.message \|\| t('…')`（优先英文） |
| aria-label | `t('Select all')` / `t('Select row')` 等 | `aria-label='Select all'` |

---

## 3. API 错误与 Toast

### 3.1 展示规则

```ts
import { apiErrorMessage } from '../lib/api-message' // 或等价 helper

toast.error(apiErrorMessage(t, res.message, 'Failed to create workspace'))
```

- 有 `res.message`：按 **英文原文作为 key** 调 `t(message)`（词条在 locale 中）  
- 无 message：用 fallback key（如 `Failed to create workspace`）  
- 成功态：只用 `t('…')`，不要依赖后端英文成功句（如检测通过应固定 `Credential test passed`）

### 3.2 避免双 Toast

业务侧自己 `toast.error` 时，对应写操作请求加：

```ts
api.post(url, data, { skipBusinessError: true })
```

否则 HTTP 拦截器会先弹一次**未翻译**的 `response.data.message`，抽屉再弹一次。

适用：create / update / delete / enable / disable / invite / accept / transfer / test / fetch-models / reorder 等**变更类**接口。  
只读列表加载失败若也自行 toast，同样建议 `skipBusinessError` 或统一走翻译 helper。

### 3.3 后端错误词条

控制器返回的稳定英文 `message`（如 `workspace slug already exists in this customer`）必须在 `en.json` / `zh.json` 各有一条。

新增后端错误码/文案时：

1. 后端保持**稳定、可复用的英文 message**（勿随意改措辞）  
2. 前端立刻补中英词条  
3. UI 用 `apiErrorMessage`，不要再写一套平行文案

参考实现：`web/src/features/customer-org/lib/api-message.ts`。  
其他 feature 可复用该 helper，或抽到 `web/src/lib/` 共用（保持签名一致）。

---

## 4. 表单与校验

```ts
const schema = useMemo(
  () =>
    z.object({
      name: z.string().min(1, t('Name is required')),
      email: z.string().email(t('Invalid email')),
      type: z.string().min(1, t('Please select a type')),
    }),
  [t]
)
```

- Schema 依赖 `t` 时必须 `useMemo`，避免语言切换后仍显示旧文案  
- Placeholder 用已有通用 key（如 `optional`、`optional, auto-generated from name`），或新增中英词条  
- 提交前手写 `toast.error` 的校验，同样走 `t('…')`

---

## 5. 枚举与状态

后端/存储值保持英文小写（`owner`、`pending`、`shared`）；**展示层**映射到 Title Case 的 i18n key：

| 存储值 | 展示 key 示例 |
| --- | --- |
| `owner` / `admin` / `member` | `Owner` / `Admin` / `Member` |
| `pending` / `accepted` / `revoked` / `expired` | `Pending` / `Accepted` / `Revoked` / `Expired` |
| `shared` / `dedicated` / `byok` | `Shared` / `Dedicated` / `BYOK` |

筛选器 `options` 的 `label` 也必须是 `t('…')`，`value` 仍用原始存储值。

---

## 6. 词条维护约定

1. Key 使用完整英文句子或短语，与界面语气一致（`Customer created`、`Failed to load workspaces`）  
2. 同一语义复用已有 key，禁止同义重复（如已有 `optional` 不要再造 `Optional field`）  
3. 插值用 i18next：`t('Enable credential {{name}}?', { name })`  
4. 不要把用户输入、ID、token、模型名放进 key  
5. 改英文 key 等于改契约：须全局替换 `t('…')` 与两份 locale  

---

## 7. 推荐落地清单（新页面）

```text
features/<name>/
  …组件内全部可见文案 t()
  lib/api-message.ts          # 可选；或 import 共用 helper
  api.ts                      # 变更接口 skipBusinessError: true
```

词条：

- [ ] `en.json` 已加  
- [ ] `zh.json` 已加  
- [ ] 后端新 `message` 已登记为词条  

---

## 8. 完成前自检

- [ ] 切到中文：页面、抽屉、空态、筛选、列头无裸英文业务文案  
- [ ] 故意触发失败（重名、无权限、校验失败）：Toast 为中文（或当前语言）  
- [ ] 无「拦截器英文 + 业务 toast」双弹  
- [ ] Zod 校验失败信息已翻译  
- [ ] `aria-label` / Placeholder 已翻译  
- [ ] 枚举徽章与筛选项已翻译  
- [ ] `pnpm typecheck`（或项目等价检查）通过  

---

## 9. 非目标

- 不要求后端按 `Accept-Language` 返回本地化 message（当前约定：**后端英文稳定句 + 前端词条映射**）  
- 日志、审计写入、开发者控制台输出：可不翻译  
- 第三方/上游原样错误细节：可附在已翻译主句之后，但主句必须可 i18n  

---

## 10. 反例 → 正例

```ts
// ❌
toast.error(res.message || 'Failed')
placeholder='optional'
z.string().min(1)
<label>{row.original.role}</label>
aria-label='Select all'

// ✅
toast.error(apiErrorMessage(t, res.message, 'Failed to create workspace'))
placeholder={t('optional')}
z.string().min(1, t('Name is required'))
<label>{roleLabel(t, row.original.role)}</label>
aria-label={t('Select all')}
```
