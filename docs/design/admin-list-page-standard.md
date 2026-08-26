# 管理端列表页标准（对齐 Users）

**适用范围**：后台管理 / 组织侧的**资源列表页**（如用户、组织、工作区、上游凭证等）  
**对标实现**：`web/src/features/users/`（金标准）  
**已对齐示例**：`customers/`、`customer-org/workspaces-*`、`customer-org/upstream-*`、`customer-org/members-*`（Tab 切列表，对齐 Models）  

后续新建或改版同类页面，**默认对齐本标准**，不得退回为页面内嵌表单 + 卡片列表。

**多列表 Tab 页**（如「成员与邀请」，对齐 `features/models/`）：`/resource/$section` 路径切换；同一 `SectionPageLayout` 内 `Tabs` + 单一 `DataTablePage`（占满剩余高度）；各 section 独立 URL 搜索前缀（如 `mFilter` / `iFilter`）；顶栏 Primary 对应创建/邀请抽屉。某一资源无更新接口时，可不展示编辑笔，但须保留 Actions 菜单与危险操作确认。

---

## 1. 页面壳（Layout）

使用 `SectionPageLayout`：

| 区域 | 要求 |
| --- | --- |
| `fixedContent` | 列表页开启，保证表格区可滚动 |
| `Title` | 页面标题（i18n） |
| `Actions` | 右侧主操作按钮（如「添加 / 创建」），独立 `*-primary-buttons.tsx` |
| `Content` | 表格主体；组织页可在表格上方放上下文横幅（如当前工作区） |

参考：`features/users/index.tsx`。

---

## 2. 功能与交互清单（必须）

下列能力与用户页对齐，**缺一不可**（无业务动作时批量区可为空壳）：

1. **列排序**：表头可点；`manualSorting`；有服务端分页则传 `sort_by` / `sort_order`，否则对当前过滤结果客户端排序  
2. **多选**：首列 Checkbox；`enableRowSelection: true`  
3. **批量操作栏**：`DataTableBulkActions`（暂无动作时 `children` 可为 `null`）  
4. **搜索**：工具栏全局搜索（`useTableUrlState` 的 `filter`）  
5. **筛选**：至少状态等常用维度（`columnFilters` + URL）  
6. **分页**：`manualPagination` + URL `page` / `pageSize`  
7. **操作栏标题**：`header: () => t('Actions')`  
8. **编辑笔**：操作列左侧 ghost `Pencil`，Tooltip「Edit」，打开 **编辑抽屉**（不是详情）  
9. **行菜单**：`DataTableRowActionMenu`（测试 / 启停 / 删除等）  
10. **新建**：顶栏 Primary Button → 创建抽屉  
11. **确认框**：删除、启停等危险操作用 `ConfirmDialog`  
12. **停用行样式**：禁用行使用 `DISABLED_ROW_DESKTOP` / `DISABLED_ROW_MOBILE`

---

## 3. 详情 vs 编辑（语义）

| 入口 | 职责 |
| --- | --- |
| **详情**（若有） | **只读**查看：概览、只读状态与关联信息，**无**保存类控件 |
| **编辑笔 / 编辑抽屉** | **可写**：改字段、上游设置、绑定、轮换 Key 等所有变更 |

禁止把「编辑」接到详情抽屉；禁止在详情里放可写表单。

---

## 4. 推荐文件结构

每个 feature（或子域）按用户页拆分：

```text
features/<name>/
  index.tsx | <name>-page.tsx     # SectionPageLayout + Provider + Dialogs
  api.ts
  types.ts
  constants.ts
  components/
    <name>-provider.tsx           # open / currentRow / refreshTrigger
    <name>-primary-buttons.tsx
    <name>-table.tsx              # DataTablePage + useDataTable + URL state
    <name>-columns.tsx            # select + 业务列 + Actions
    <name>-row-actions.tsx        # Pencil + 菜单
    <name>-bulk-actions.tsx
    <name>-mutate-drawer.tsx      # create | update
    <name>-delete-dialog.tsx      # 可选
    <name>-status-dialog.tsx      # enable | disable，可选
```

路由：`validateSearch` 至少包含 `page`、`pageSize`、`filter`、常用筛选（如 `status`）。

---

## 5. 技术约定

- 表格：`DataTablePage` + `useDataTable`（`@/components/data-table`）  
- URL 状态：`useTableUrlState`  
- 弹层状态：`useDialogState` + Provider（`open: create | update | delete | enable | disable | …`）  
- 表单：React Hook Form + Zod；抽屉布局用 `sideDrawer*` class helpers  
- 文案：遵守 [frontend-i18n-standard.md](./frontend-i18n-standard.md)；`en.json` / `zh.json` 同步；操作栏用 `t('Actions')`、`t('Edit')`  
- Select 选项注释：选项内「标题 + `text-muted-foreground` 说明」，必要时选中项下方再显示当前说明（参考上游模式、API Key 组选择）  
- 选择资源（用户、渠道等）：用可搜索 Picker/Combobox，列表展示**名称**，不要只填裸 ID  

---

## 6. 完成前自检

- [ ] 与用户页对照：排序、多选、Actions 标题、编辑笔均存在  
- [ ] 创建 / 编辑走抽屉；删除 / 启停走确认框  
- [ ] 详情（如有）只读；编辑可写  
- [ ] `pnpm typecheck` 通过；改动文件 oxlint error 清零  
- [ ] i18n 按 [frontend-i18n-standard.md](./frontend-i18n-standard.md) 自检通过（中英词条、toast、Zod、API 错误）  

---

## 7. 非目标

- 仪表盘、向导、纯设置表单页：不必强行套 DataTable，但仍优先复用 `SectionPageLayout`、抽屉与确认框模式；**国际化仍须遵守** [frontend-i18n-standard.md](./frontend-i18n-standard.md)  
- 移动端：沿用 DataTable 的 mobile meta（`mobileOrder` / `mobileHidden` / `mobileBadge`），不另造一套列表
