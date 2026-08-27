# Docker 磁盘清理命令说明

本文档说明 `docker image prune`、`docker builder prune`、`docker system prune` 三个常用清理命令的作用、优缺点及在本项目（源码 `docker compose up -d --build` 部署）下的使用建议。

适用场景：阿里云 ECS 或其他 Linux 服务器上，因反复 `git pull` + `docker compose up -d --build` 导致磁盘占用持续增长。

> 相关文档：[阿里云 ECS 源码 Docker 部署](./aliyun-ecs.md)

---

## 为什么磁盘会涨

| 来源 | 说明 |
| ---- | ---- |
| `git pull` | 通常影响很小，`.git` 历史略增，一般可忽略 |
| `docker compose up -d --build` | **主要风险**：每次 rebuild 可能留下悬空镜像、构建缓存 |
| MySQL 数据卷 `mysql_data` | 业务数据正常增长，不应随意清理 |
| 绑定目录 `./data`、`./logs` | 应用数据与日志；`prune` 命令不会删除 bind mount |

本项目 `docker-compose.yml` 使用 `build: .` + `image: new-api:local`。每次重新构建后，旧镜像层常变为 `<none>:<none>` 悬空镜像，若长期不清理会累积占用。

---

## 命令总览

| 命令 | 主要删除对象 | 对运行中服务 | 下次 build 速度 | 默认是否删数据卷 |
| ---- | ------------ | ------------ | --------------- | ---------------- |
| `docker image prune -f` | 悬空镜像（`<none>`） | 无影响 | 无影响 | 否 |
| `docker builder prune -f` | 构建缓存（BuildKit cache） | 无影响 | **变慢** | 否 |
| `docker system prune -f` | 悬空镜像 + 构建缓存 + 已停止容器 + 未使用网络 | 无影响（运行中容器保留） | **变慢** | 否 |

---

## `docker image prune -f`

### 做什么

删除**悬空镜像**（dangling images）：没有 tag、也没有被任何容器引用的镜像层。典型来源是每次 `docker compose up -d --build` 后，旧版 `new-api:local` 留下的 `<none>:<none>` 层。

**不会删除：**

- 正在运行的容器所使用的镜像
- 仍被容器（含已停止但未删除的容器）引用的带 tag 镜像
- 数据卷、bind mount 目录（`./data`、`./logs`）

### 优点

- 风险很低，几乎不影响业务
- 直接释放 rebuild 累积的镜像层，通常能收回数 GB
- 不影响下次构建速度（不删构建缓存）
- 适合频繁执行（如每周或磁盘占用 >70% 时）

### 缺点

- 只清悬空镜像，**不会**清构建缓存，磁盘释放有限
- 带 tag 但已无容器使用的旧镜像默认**不会**删（需 `docker image prune -a` 才会，更激进）

### 适用场景

- 日常维护首选
- 部署后磁盘明显上涨，但希望下次 build 仍尽量快

---

## `docker builder prune -f`

### 做什么

删除 **Docker 构建缓存**（builder / BuildKit cache）：即 Dockerfile 各步骤算过的中间结果。

有缓存时，未变更的步骤会显示 `CACHED` 并跳过，例如：

```text
bun install          → 依赖未变则跳过
bun run build        → 前端未变则跳过
go mod download      → go.mod 未变则跳过
go build             → 仅重编变更部分
```

执行本命令后，上述缓存全部清空。

**不会删除：** 最终镜像、运行中的容器、数据卷。

### 优点

- 对正在运行的 `new-api`、`mysql`、`redis` 无影响
- 常能释放大量磁盘（构建缓存可达数 GB 至十余 GB）
- 不删数据库与应用数据

### 缺点

- **下次 `docker compose up -d --build` 会明显变慢**
- 需重新执行 `bun install`、`bun run build`、`go mod download`、`go build` 等步骤
- 全量构建可能回到十余分钟量级（见项目 Dockerfile 多阶段构建）
- 若磁盘不紧，频繁清理会降低部署效率

### 为什么会导致下次 build 更慢

构建缓存相当于「备好的半成品」。清掉后 Docker 无法复用中间层，必须从 Dockerfile 第一步重新执行，即使只改了一行代码也可能触发多阶段全量重跑。

### 适用场景

- 磁盘紧张，且可以接受下次部署更慢
- 长期未清理、构建缓存已很大
- 可选折中：`docker builder prune -f --filter until=168h`（仅清 7 天前的缓存，需较新 Docker）

---

## `docker system prune -f`

### 做什么

在**默认参数**下一次性清理：

1. 所有悬空镜像（同 `docker image prune`）
2. 构建缓存（同 `docker builder prune`）
3. **已停止的容器**（`docker ps -a` 中 Exited 状态）
4. **未被任何容器使用的自定义网络**

**默认不会删除：**

- 运行中的容器及其镜像
- 数据卷（如 `mysql_data`）
- bind mount 目录（`./data`、`./logs`）

### 优点

- 一条命令完成多种清理，操作简单
- 默认不带 `--volumes`，对本项目 MySQL 数据卷相对安全
- 适合定期「大扫除」

### 缺点

- 会删除已停止容器——若依赖旧容器做对比或调试，信息会丢失
- 包含 `builder prune` 的效果，**下次 build 会变慢**
- 比单独 `image prune` 更激进
- 误加危险参数后果严重（见下文）

### 适用场景

- 希望一条命令做常规清理
- 确认没有需要保留的已停止容器

---

## 危险用法（勿默认执行）

```bash
# ❌ 可能删除未使用的数据卷；若 MySQL 容器已停止，可能误删 mysql_data
docker system prune -f --volumes

# ❌ 删除所有当前无容器使用的镜像（不仅是悬空镜像）
docker system prune -af
docker image prune -af
```

| 参数 | 风险 |
| ---- | ---- |
| `--volumes` | 删除未被容器引用的卷，可能含 MySQL 数据 |
| `-a` / `--all` | 删除所有未使用镜像，释放更多但下次需重新拉基础镜像 |

---

## 本项目数据与 prune 的关系

| 数据位置 | 类型 | `prune` 默认是否影响 |
| -------- | ---- | -------------------- |
| `mysql_data` | Docker 卷 | 否（除非 `--volumes` 且卷未被引用） |
| `./data` | bind mount | 否 |
| `./logs` | bind mount | 否 |
| `new-api:local` 镜像 | 镜像 | 否（正在使用的当前镜像保留） |
| 旧 build 悬空层 | 镜像层 | `image prune` / `system prune` 会删 |

---

## 推荐运维流程

### 查看占用

```bash
docker system df
df -h
docker ps -a
```

### 日常清理（优先）

```bash
docker image prune -f
```

释放悬空镜像，不影响下次 build 速度。

### 磁盘仍紧张

```bash
docker builder prune -f
```

或合并执行：

```bash
docker system prune -f
```

接受下次部署更慢。

### 清理后验证

```bash
docker compose ps
curl -s http://127.0.0.1:3001/api/status
```

### 部署更新（与清理独立）

```bash
git pull
docker compose up -d --build
```

`git pull` 对磁盘影响通常可忽略；磁盘增长主要来自 `--build` 与业务数据、日志。

---

## 减少磁盘压力的其他方式

1. **仅代码变更时** `--build`；仅配置变更时用 `docker compose up -d`
2. **CI / 本机构建** 镜像推送到阿里云 ACR，ECS 上 `pull` 运行，避免在 ECS 上反复全量 build
3. **定期轮转或清理** `./logs`，日志 bind mount 不受 `prune` 管理，可能比镜像更占空间
4. **监控 MySQL 卷** `mysql_data` 业务增长，属正常数据而非垃圾

---

## 一句话对照

| 命令 | 业务风险 | 主要代价 |
| ---- | -------- | -------- |
| `docker image prune -f` | 很低 | 几乎无 |
| `docker builder prune -f` | 很低 | 下次 build 更慢 |
| `docker system prune -f` | 低 | 删已停止容器；下次 build 更慢；勿加 `--volumes` |

**结论：** 对正在运行的 new-api + MySQL + Redis，上述三个命令在默认参数下可放心使用；**唯一要记住：不要加 `--volumes`，除非你明确知道哪些卷可以删除。**
