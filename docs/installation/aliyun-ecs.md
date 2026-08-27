# 阿里云 ECS 源码 Docker 部署

本文档说明如何在阿里云 ECS 上通过源码构建并部署 New API。

> 官方部署文档：[安装指南](https://docs.newapi.pro/zh/docs/installation)
> 官方镜像（可选）：`calciumion/new-api:latest`

---

## 可行性说明

| 问题                    | 结论                                                                             |
| ----------------------- | -------------------------------------------------------------------------------- |
| 能否在阿里云 ECS 部署？ | 可以。任意 64 位 Linux ECS（amd64 / arm64）均可。                                |
| 能否源码 Docker 构建？  | 可以。项目根目录自带生产用`Dockerfile`（多阶段：Bun 构建前端 + Go 编译后端）。 |
| 与官方镜像的区别        | 功能一致；源码构建是在 ECS 本地/本机构建镜像，而非直接拉取 Docker Hub 镜像。     |

---

## 前置要求

| 项目   | 建议                                                          |
| ------ | ------------------------------------------------------------- |
| 系统   | Ubuntu / CentOS / Alibaba Cloud Linux（64 位）                |
| 规格   | 构建建议**≥ 2 核 4G**；运行最低约 1 核 2G              |
| 磁盘   | 建议**≥ 40GB**（依赖镜像与构建缓存）                   |
| 软件   | Docker、Docker Compose                                        |
| 安全组 | 开放`3001`；若前面挂 Nginx / SLB，可只开放 `80` / `443` |

---

## 步骤一：安装 Docker

以 Ubuntu 为例：

```bash
sudo apt update
sudo apt install -y docker.io docker-compose-v2
sudo systemctl enable --now docker
sudo usermod -aG docker $USER
# 重新登录后生效，或执行：newgrp docker
```

### 配置镜像加速（推荐）

国内拉 `oven/bun`、`golang`、`debian` 等基础镜像可能较慢。可在阿里云「容器镜像服务」获取加速器地址，写入 `/etc/docker/daemon.json`，例如：

```json
{
  "registry-mirrors": ["https://你的加速器地址.mirror.aliyuncs.com"]
}
```

然后重启 Docker：

```bash
sudo systemctl daemon-reload
sudo systemctl restart docker
```

---

## 步骤二：获取源码

```bash
git clone https://github.com/QuantumNous/new-api.git
cd new-api
```

也可使用本仓库已有源码目录，无需重新 clone。

---

## 步骤三：源码构建部署

### 方式 A：Docker Compose（推荐）

1. 编辑 `docker-compose.yml`，将 `new-api` 服务中的：

```yaml
image: calciumion/new-api:latest
```

改为：

```yaml
build: .
image: new-api:local
```

2. 修改默认数据库 / Redis 密码等敏感配置（生产环境务必修改）。
3. 构建并启动：

```bash
docker compose up -d --build
```

### 方式 B：仅构建镜像后手动运行

```bash
docker build -t new-api:local .

# SQLite 简易示例
docker run -d --name new-api --restart always \
  -p 3001:3001 \
  -e PORT=3001 \
  -e TZ=Asia/Shanghai \
  -v "$(pwd)/data:/data" \
  new-api:local
```

生产环境建议仍使用 Compose，并配合 Postgres/MySQL + Redis。

---

## 步骤四：验证访问

浏览器访问：

```text
http://<ECS公网IP>:3001
```

健康检查接口示例：

```bash
curl -s http://127.0.0.1:3001/api/status
```

---

## 常用运维命令

```bash
# 查看容器状态
docker compose ps

# 查看日志
docker compose logs -f new-api

# 代码更新后重新构建并启动
git pull
docker compose up -d --build

# 停止
docker compose down
```

### 磁盘清理

反复 `git pull` + `docker compose up -d --build` 会导致悬空镜像与构建缓存累积。`git pull` 本身影响很小，主要增长来自 Docker build。

```bash
# 查看占用
docker system df
df -h

# 日常首选：清悬空镜像，不影响下次 build 速度
docker image prune -f

# 磁盘仍紧张：清构建缓存（下次 build 会更慢）
docker builder prune -f

# 或一条命令合并清理（勿加 --volumes）
docker system prune -f
```

各命令优缺点、风险参数（`--volumes`、`-a`）及本项目数据卷说明见：[Docker 磁盘清理命令说明](./docker-prune-commands.md)。

---

## 注意事项

1. **首次构建耗时**：完整构建（前端 + Go）可能需要十余分钟，属正常现象。
2. **内存不足**：构建 OOM 时可临时增加 Swap，或升级 ECS 规格后再构建。
3. **HTTPS**：生产建议使用 Nginx 或阿里云 SLB 配置证书，避免长期明文 HTTP。
4. **多机部署**：各节点 `SESSION_SECRET` 必须一致，并共用同一 Redis。
5. **数据持久化**：务必挂载 `./data`（或同等数据卷），避免容器重建丢数据。
6. **可选架构**：也可在本机/CI 构建镜像后推送到阿里云 ACR，再在 ECS 上拉取运行，减轻 ECS 构建压力。
7. **组织 / 工作区（M1）**：多组织、工作区、邀请、BYOK 等能力与现网共用同一服务端口（默认 `3001`），**无需额外开放端口**；BYOK 加密依赖环境/配置中的密钥（如 `CRYPTO_SECRET`），部署时一并配置即可。

---

## 相关文件

| 文件                       | 说明                                               |
| -------------------------- | -------------------------------------------------- |
| `Dockerfile`             | 生产源码构建（含前端）                             |
| `Dockerfile.dev`         | 开发用后端构建（前端走本地 dev server）            |
| `docker-compose.yml`     | 生产 Compose（默认拉官方镜像，可改为`build: .`） |
| `docker-compose.dev.yml` | 开发 Compose                                       |
| `docker-prune-commands.md` | Docker 磁盘清理命令（`prune`）说明                 |

---

## 参考链接

- [官方安装文档](https://docs.newapi.pro/zh/docs/installation)
- [环境变量说明](https://docs.newapi.pro/zh/docs/installation/config-maintenance/environment-variables)
- [API 文档](https://docs.newapi.pro/zh/docs/api)
