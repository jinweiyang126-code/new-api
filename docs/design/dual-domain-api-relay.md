# 双域名方案：仅模型中转走 api.unionmeta.ai

状态：**代码已落地（待运维配置 DNS/证书/Nginx + 后台填写 Public API Address）**  
日期：2026-09-07 · 实现：2026-09-07  
相关域名：`www.unionmeta.ai`、`api.unionmeta.ai`

---

## 1. 目标

| 域名 | 职责 | CDN |
|------|------|-----|
| `https://www.unionmeta.ai` | **其它全部不变**：网页、登录/OAuth、控制台 `/api`、体验中心 `/pg` 等 | 可按现状保留或以后再调 |
| `https://api.unionmeta.ai` | **仅模型中转**：OpenAI 兼容等 `/v1/*`（Bearer API Key） | **不挂 CDN**，DNS 直连源站/SLB |

```text
Browser (控制台) ──► www.unionmeta.ai ──► new-api（页面 + /api + 登录）
SDK / curl     ──► api.unionmeta.ai ──► new-api（仅 /v1，无 CDN）
```

---

## 2. 为什么这样做

- AI 中转的 `/v1` 是长耗时、流式、不可缓存请求；整站走阿里云 CDN 易导致超时、断流，且 PATCH 等方法可能 400。
- 模型调用使用 **API Key + `/v1`**，不依赖浏览器 Cookie，**不要求与 www 同源**。
- 控制台继续同源，可避免改 axios 基址、CORS、Cookie、OAuth。

---

## 3. 明确不做

- 不把控制台 `/api`、登录迁到 `api` 域名。
- 不改前端全局 axios `baseURL`。
- 不为拆域改 CORS / Cookie / Passkey。
- `api.unionmeta.ai` **不接入** 阿里云 CDN / 全站加速。

---

## 4. 代码改动（已完成）

| 项 | 说明 |
|----|------|
| `PublicApiAddress` 系统选项 | 后台「站点 → 系统信息」可配置；空则回退 `ServerAddress` |
| `/api/status` → `public_api_address` | 已解析后的对外 Base（无尾斜杠） |
| 模型广场 / Key 连接信息 / Chat 预设 / 概览示例 | 优先使用 `public_api_address` |

运营上线时请在后台填写：

`Public API Address` = `https://api.unionmeta.ai`

`Server Address` 保持 `https://www.unionmeta.ai`（OAuth/邮件等）。

---

## 5. 运维（上线必做）

1. DNS：`api.unionmeta.ai` → 源站 IP / SLB（**不要** CNAME 到 CDN）。
2. 证书：`api` 单独证书或 `*.unionmeta.ai`。
3. Nginx（示意）：

```nginx
server {
    listen 443 ssl http2;
    server_name api.unionmeta.ai;
    # ssl_certificate …;

    location /v1/ {
        proxy_pass http://127.0.0.1:3001;  # 按实际 upstream 调整
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
        proxy_connect_timeout 60s;
    }

    # 可选：其它路径返回 404，避免误把控制台接到 api 域名
    location / {
        return 404;
    }
}
```

4. `www` 的现有配置本方案**不强制修改**。
5. **兼容**：默认保留 `https://www.unionmeta.ai/v1`；文档与控制台示例引导新客户用 api 域名。

---

## 6. 验收标准

- [ ] 后台已填 `Public API Address=https://api.unionmeta.ai`
- [ ] DNS/证书/Nginx 已配置，`api` 未进 CDN
- [ ] `POST https://api.unionmeta.ai/v1/chat/completions` 流式长请求不断开
- [ ] `www` 登录、控制台 `/api`、OAuth 与现网一致
- [ ] 模型广场 / 文档示例 Base URL 为 `https://api.unionmeta.ai`

---

## 7. 决策记录

| 项 | 结论 |
|----|------|
| api 域名范围 | **仅模型中转 `/v1`** |
| 控制台 / 登录 | **仍在 www，不变** |
| api 是否走 CDN | **否** |
| www/v1 兼容 | **默认保留**；文档引导切 api |
| Public API Address 默认（代码） | **空**（回退 Server Address）；UnionMeta 生产填 `https://api.unionmeta.ai` |
| 实现状态 | **代码已落地，待运维上线** |
