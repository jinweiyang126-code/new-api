# 本地构建镜像并推送到阿里云 ACR 部署

本文档说明如何在**本地（Windows / macOS）**构建 New API 的 Docker 镜像，推送到**阿里云容器镜像服务 ACR**，再在**阿里云 ECS** 上拉取运行，避免在 ECS 上反复 `docker compose up -d --build` 导致 CPU、磁盘和长时间编译占用。

> 相关文档：
> - [阿里云 ECS 源码 Docker 部署](./aliyun-ecs.md)（ECS 上直接 build 的方式）
> - [Docker 磁盘清理命令说明](./docker-prune-commands.md)

---

## 架构概览

```text
本地 Docker Desktop
  → docker buildx（linux/amd64）
  → docker push → 阿里云 ACR
  → ECS：docker compose pull + up -d
```

ECS **不再执行源码编译**，只负责拉镜像、启动容器；`./data`、`./logs`、MySQL/Redis 数据卷保持不变。

---

## 前置要求

| 项目 | 说明 |
| ---- | ---- |
| 本地 | 已安装 [Docker Desktop](https://www.docker.com/products/docker-desktop/)（Windows 开发机无本地 Go 亦可） |
| 阿里云 | 已开通 **容器镜像服务 ACR**（个人版即可） |
| ECS | 已按 [aliyun-ecs.md](./aliyun-ecs.md) 部署 Docker / Compose；安全组可访问 ACR（公网拉取） |
| 源码 | 项目根目录含 `Dockerfile`、`docker-compose.yml` |

### 本项目 ACR 配置（新加坡个人版）

| 项 | 值 |
| ---- | ---- |
| **Registry（登录/推送用主机名）** | `crpi-4lxuxozna7pfuh5j.ap-southeast-1.personal.cr.aliyuncs.com` |
| **命名空间** | `new-api-acr` |
| **仓库名** | `new-api-acr` |
| **地域** | `ap-southeast-1`（新加坡，与 ECS 同区） |
| **代码源** | 本地仓库（命令行 push） |

完整镜像地址（带 tag）：

```text
crpi-4lxuxozna7pfuh5j.ap-southeast-1.personal.cr.aliyuncs.com/new-api-acr/new-api-acr:latest
```

发版时建议同时打日期 tag，例如：

```text
crpi-4lxuxozna7pfuh5j.ap-southeast-1.personal.cr.aliyuncs.com/new-api-acr/new-api-acr:2026-08-27
```

| 其它占位符 | 说明 |
| ---------- | ---- |
| `<ECS_APP_DIR>` | ECS 上 compose 目录，如 `/root/new-api` |

---

## 步骤一：在阿里云 ACR 创建仓库

1. 登录 [阿里云控制台](https://home.console.aliyun.com/) → **容器镜像服务 ACR**。
2. 选择与 ECS **相同地域**的实例（例如新加坡 ECS 选新加坡 ACR，拉取更快）。
3. **创建命名空间**（若尚无）：`new-api-acr`。
4. **创建镜像仓库**：
   - 仓库名称：`new-api-acr`
   - 类型：私有
   - 代码源：**本地仓库**
5. 在仓库页记下 **公网地址**（本项目）：

   ```text
   crpi-4lxuxozna7pfuh5j.ap-southeast-1.personal.cr.aliyuncs.com/new-api-acr/new-api-acr
   ```

6. 设置 **访问凭证**（固定密码）：ACR → 访问凭证 → 设置/重置 Docker 登录密码（用于 `docker login`）。

---

## 步骤二：本地构建镜像（linux/amd64）

在**项目根目录**（与 `Dockerfile` 同级）执行。

### 生产镜像（含前端构建，与线上一致）

**PowerShell（Windows）：**

```powershell
cd d:\workspace-cursor\new-api

$env:DOCKER_BUILDKIT = "1"
$REGISTRY = "crpi-4lxuxozna7pfuh5j.ap-southeast-1.personal.cr.aliyuncs.com"
$IMAGE = "$REGISTRY/new-api-acr/new-api-acr:2026-08-27"

docker buildx build --platform linux/amd64 -t $IMAGE -t "$REGISTRY/new-api-acr/new-api-acr:latest" --load .
```

**Bash（macOS / Linux）：**

```bash
cd /path/to/new-api

export DOCKER_BUILDKIT=1
REGISTRY=crpi-4lxuxozna7pfuh5j.ap-southeast-1.personal.cr.aliyuncs.com
IMAGE=$REGISTRY/new-api-acr/new-api-acr:2026-08-27

docker buildx build --platform linux/amd64 -t "$IMAGE" -t $REGISTRY/new-api-acr/new-api-acr:latest --load .
```

> **说明**
> - `--platform linux/amd64`：ECS 一般为 x86_64，Windows 本机构建时必须指定，否则会推错架构。
> - `--load`：构建结果加载到本地 Docker，便于随后 `docker push`。
> - 首次完整构建（Bun 前端 + Go）可能需要 **10–20 分钟**，属正常现象。

### 仅后端变更时（可选，更快）

若前端未改、仅调 Go，可用 `Dockerfile.dev`（跳过前端打包，内嵌占位 HTML）：

```powershell
docker buildx build --platform linux/amd64 -f Dockerfile.dev -t $IMAGE --load .
```

生产环境对外提供页面时，**仍应使用根目录 `Dockerfile` 全量构建**。

---

## 步骤三：登录 ACR 并推送镜像

**本地：**

```powershell
docker login crpi-4lxuxozna7pfuh5j.ap-southeast-1.personal.cr.aliyuncs.com
# 用户名：阿里云账号全名或 ACR 提示的用户名
# 密码：步骤一中设置的 ACR 固定密码

docker push crpi-4lxuxozna7pfuh5j.ap-southeast-1.personal.cr.aliyuncs.com/new-api-acr/new-api-acr:2026-08-27
docker push crpi-4lxuxozna7pfuh5j.ap-southeast-1.personal.cr.aliyuncs.com/new-api-acr/new-api-acr:latest
```

推送完成后，在 ACR 控制台 → 镜像仓库 → **镜像版本** 中应能看到新 tag。

---

## 步骤四：修改 ECS 上的 docker-compose.yml

SSH 登录 ECS，编辑 `<ECS_APP_DIR>/docker-compose.yml` 中 `new-api` 服务：

**改前（ECS 源码构建）：**

```yaml
services:
  new-api:
    build: .
    image: new-api:local
```

**改后（从 ACR 拉取）：**

```yaml
services:
  new-api:
    image: crpi-4lxuxozna7pfuh5j.ap-southeast-1.personal.cr.aliyuncs.com/new-api-acr/new-api-acr:latest
    pull_policy: always   # Compose v2；若无此字段可省略，改用手动 pull
    # build: .            # 注释或删除，避免在 ECS 上误触发 build
```

其余配置（`ports`、`volumes`、`environment`、`depends_on`）**保持不变**。

---

## 步骤五：ECS 上拉取并启动

```bash
cd /root/new-api   # 或你的 <ECS_APP_DIR>

docker login crpi-4lxuxozna7pfuh5j.ap-southeast-1.personal.cr.aliyuncs.com

docker compose pull new-api
docker compose up -d new-api

# 验证
docker compose ps
curl -s http://127.0.0.1:3001/api/status | head
docker compose logs -f --tail=50 new-api
```

浏览器访问你的域名（如 `https://unionmeta.ai`）或 `http://<ECS公网IP>:3001` 确认页面与 API 正常。

---

## 日常发版流程（推荐）

每次代码更新后，在**本地**重复：

```text
1. git pull / 合并你的改动
2. docker buildx build --platform linux/amd64 \
     -t crpi-4lxuxozna7pfuh5j.ap-southeast-1.personal.cr.aliyuncs.com/new-api-acr/new-api-acr:<新TAG> \
     -t crpi-4lxuxozna7pfuh5j.ap-southeast-1.personal.cr.aliyuncs.com/new-api-acr/new-api-acr:latest --load .
3. docker push crpi-4lxuxozna7pfuh5j.ap-southeast-1.personal.cr.aliyuncs.com/new-api-acr/new-api-acr:<新TAG>
4. docker push crpi-4lxuxozna7pfuh5j.ap-southeast-1.personal.cr.aliyuncs.com/new-api-acr/new-api-acr:latest
5. SSH 到 ECS：docker compose pull new-api && docker compose up -d new-api
```

**不要在 ECS 上执行** `docker compose up -d --build`（除非临时调试）。

### 一键脚本示例（本地 PowerShell，可按需保存为 `scripts/publish-acr.ps1`）

```powershell
param(
  [string]$Registry = "crpi-4lxuxozna7pfuh5j.ap-southeast-1.personal.cr.aliyuncs.com",
  [string]$Namespace = "new-api-acr",
  [string]$Repo = "new-api-acr",
  [string]$Tag = (Get-Date -Format "yyyy-MM-dd-HHmm")
)

$Image = "$Registry/$Namespace/${Repo}:$Tag"
$Latest = "$Registry/$Namespace/${Repo}:latest"

$env:DOCKER_BUILDKIT = "1"
docker buildx build --platform linux/amd64 -t $Image -t $Latest --load .
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

docker push $Image
docker push $Latest
Write-Host "Pushed: $Image and $Latest"
Write-Host "On ECS run: docker compose pull new-api && docker compose up -d new-api"
```

---

## ECS 侧磁盘与清理

改为 ACR 拉取后，ECS 上 **`docker builder prune` 压力会小很多**（不再本地 build）。仍可能因多次 pull 留下旧镜像层，可定期：

```bash
docker image prune -f
docker system df
```

详见 [docker-prune-commands.md](./docker-prune-commands.md)。

---

## 常见问题

### 1. ECS 拉取报 `no matching manifest for linux/amd64`

本地构建时未加 `--platform linux/amd64`。请重新构建并推送。

### 2. `docker login` 失败

- 确认使用的是 **ACR 公网地址**，不是 VPC 内网地址（本地推送需公网）。
- 确认访问凭证密码已在 ACR 控制台重置。

### 3. ECS `pull` 很慢

- ACR 与 ECS 选**同一地域**（如新加坡）。
- 在 ECS 的 `/etc/docker/daemon.json` 配置阿里云镜像加速器（见 [aliyun-ecs.md](./aliyun-ecs.md) 步骤一）。

### 4. 容器起来了但页面是旧的

- 确认已 `docker compose pull` 再 `up -d`。
- 浏览器强刷或清缓存；静态资源带 hash，API 可 curl `/api/status` 看版本字段。

### 5. 不想用 ACR，偶尔手动更新

本地 `docker save` → `scp` → ECS `docker load` 仍可行，但不利于版本管理与回滚，生产建议 ACR。

---

## 与 ECS 源码构建的对比

| 项目 | ECS `docker compose --build` | 本地 build + ACR |
| ---- | ---------------------------- | ---------------- |
| ECS CPU/内存 | 构建期占用高 | 仅运行期 |
| 构建耗时 | 常 7–10+ 分钟/次 | 本地一次，ECS pull 约 1–3 分钟 |
| 磁盘 | 易堆积 build 缓存 | ECS  mainly 镜像层 |
| 回滚 | 需保留旧镜像或重新 build | ACR 多 tag，改 compose tag 即可 |

---

## 相关文件

| 文件 | 说明 |
| ---- | ---- |
| `Dockerfile` | 生产全量构建（Bun 前端 + Go 后端） |
| `Dockerfile.dev` | 仅后端，开发/快速迭代 |
| `docker-compose.yml` | ECS 运行时 compose；改为 `image:` 指向 ACR |
| `.cursor/rules/go-docker-windows.mdc` | Windows 开发机通过 Docker 编译 Go 的约定 |

---

## 参考链接

- [阿里云 ACR 文档](https://help.aliyun.com/product/60716.html)
- [官方安装文档](https://docs.newapi.pro/zh/docs/installation)
- [环境变量说明](https://docs.newapi.pro/zh/docs/installation/config-maintenance/environment-variables)
