/**
 * BYOK live outbound smoke (not decrypt-only).
 *
 * Spins a local OpenAI-compatible mock, registers it as customer BYOK
 * credential (no global fallback), calls /v1/chat/completions with a
 * workspace token, asserts:
 *   1) mock received Authorization: Bearer <byok-key>
 *   2) response ok
 *   3) consume log upstream_source === 'byok'
 *
 * Env:
 *   T13_BASE_URL   default http://127.0.0.1:3001
 *   BYOK_MOCK_PORT default 18081
 *   BYOK_BASE_URL  default http://host.docker.internal:<port>  (from container)
 */
import http from 'node:http'

const BASE = process.env.T13_BASE_URL || 'http://127.0.0.1:3001'
const ROOT_USER = process.env.T13_ROOT_USER || 'root'
const ROOT_PASS = process.env.T13_ROOT_PASS || 'TestRoot1'
const MOCK_PORT = Number(process.env.BYOK_MOCK_PORT || 18081)
const BYOK_BASE =
  process.env.BYOK_BASE_URL || `http://host.docker.internal:${MOCK_PORT}`
const suffix = `${Date.now().toString(36)}${Math.floor(Math.random() * 100)}`
const BYOK_KEY = `sk-byok-live-${suffix}`
const MODEL = 'gpt-4o-mini'

const hits = []

function log(msg) {
  console.log(msg)
}

async function api(method, path, { token, body, rawKey } = {}) {
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`
  if (rawKey) headers.Authorization = `Bearer ${rawKey}`
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body == null ? undefined : JSON.stringify(body),
  })
  const text = await res.text()
  let json
  try {
    json = text ? JSON.parse(text) : {}
  } catch {
    json = { raw: text }
  }
  return { status: res.status, json, text }
}

function startMock() {
  return new Promise((resolve) => {
    const server = http.createServer(async (req, res) => {
      const chunks = []
      for await (const c of req) chunks.push(c)
      const bodyText = Buffer.concat(chunks).toString('utf8')
      const auth = req.headers.authorization || ''
      hits.push({
        method: req.method,
        url: req.url,
        auth,
        bodyText: bodyText.slice(0, 500),
      })
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(
        JSON.stringify({
          id: 'chatcmpl-byok-smoke',
          object: 'chat.completion',
          created: Math.floor(Date.now() / 1000),
          model: MODEL,
          choices: [
            {
              index: 0,
              message: { role: 'assistant', content: 'byok-pong' },
              finish_reason: 'stop',
            },
          ],
          usage: { prompt_tokens: 3, completion_tokens: 2, total_tokens: 5 },
        })
      )
    })
    server.listen(MOCK_PORT, '0.0.0.0', () => resolve(server))
  })
}

async function login(username, password) {
  const { json } = await api('POST', '/api/user/login', {
    body: { username, password },
  })
  if (!json.success) throw new Error(`login ${username}: ${json.message}`)
  return json.data.access_token
}

async function createUser(rootToken, username, password) {
  const { json } = await api('POST', '/api/user/', {
    token: rootToken,
    body: {
      username,
      password,
      display_name: username,
      group: 'default',
      quota: 5_000_000,
    },
  })
  if (!json.success) throw new Error(`createUser: ${json.message}`)
  const list = await api('GET', '/api/user/?p=0&page_size=100', {
    token: rootToken,
  })
  const items = list.json.data?.items || list.json.data || []
  const row = items.find((u) => u.username === username)
  if (!row) throw new Error('user not found after create')
  return row.id
}

async function getTokenKey(userToken, tokenId) {
  const { json } = await api('POST', `/api/token/${tokenId}/key`, {
    token: userToken,
  })
  if (!json.success) throw new Error(`get token key: ${json.message}`)
  return json.data?.key || json.data
}

async function main() {
  log(`BYOK live smoke against ${BASE}`)
  log(`mock listen :${MOCK_PORT}; credential base_url=${BYOK_BASE}`)
  const server = await startMock()

  try {
    const rootTok = await login(ROOT_USER, ROOT_PASS)
    const owner = `byok_o_${suffix}`
    const member = `byok_m_${suffix}`
    const pass = 'TestPass1'
    const ownerId = await createUser(rootTok, owner, pass)
    const memberId = await createUser(rootTok, member, pass)

    const create = await api('POST', '/api/customers/', {
      token: rootTok,
      body: {
        name: `BYOK Live ${suffix}`,
        slug: `byok-live-${suffix}`,
        owner_user_id: ownerId,
        quota: 0,
      },
    })
    if (!create.json.success) throw new Error(create.json.message)
    const customer = create.json.data?.customer || create.json.data
    const customerId = customer.id

    const top = await api('POST', `/api/customers/${customerId}/topup`, {
      token: rootTok,
      body: { amount: 20_000_000 },
    })
    if (!top.json.success) throw new Error(`topup: ${top.json.message}`)

    const up = await api('PUT', `/api/customers/${customerId}/upstream-settings`, {
      token: rootTok,
      body: {
        upstream_mode: 'byok',
        allow_global_fallback: false,
        byok_enabled: true,
      },
    })
    if (!up.json.success) throw new Error(`upstream-settings: ${up.json.message}`)

    const ownerTok = await login(owner, pass)
    const cred = await api(
      'POST',
      `/api/customers/${customerId}/upstream-credentials`,
      {
        token: ownerTok,
        body: {
          name: `live-${suffix}`,
          type: 'openai',
          key: BYOK_KEY,
          base_url: BYOK_BASE,
          models: MODEL,
        },
      }
    )
    if (!cred.json.success) throw new Error(`credential: ${cred.json.message}`)
    log(`PASS  credential created id=${cred.json.data?.id} hint=${cred.json.data?.key_hint}`)

    const workspaces = await api('GET', `/api/customers/${customerId}/workspaces`, {
      token: ownerTok,
    })
    const ws =
      (workspaces.json.data || []).find((w) => w.slug === 'default') ||
      (workspaces.json.data || [])[0]
    if (!ws) throw new Error('no workspace')

    const xfer = await api('POST', `/api/workspaces/${ws.id}/transfer-quota`, {
      token: ownerTok,
      body: { amount: 10_000_000 },
    })
    if (!xfer.json.success) throw new Error(`transfer: ${xfer.json.message}`)

    const inv = await api('POST', `/api/customers/${customerId}/invitations`, {
      token: ownerTok,
      body: { role: 'member', workspace_id: ws.id, workspace_role: 'member' },
    })
    if (!inv.json.success) throw new Error(`invite: ${inv.json.message}`)
    const memberTok = await login(member, pass)
    const accept = await api(
      'POST',
      `/api/invitations/${inv.json.data.token}/accept`,
      { token: memberTok }
    )
    if (!accept.json.success) throw new Error(`accept: ${accept.json.message}`)

    const tokCreate = await api('POST', '/api/token/', {
      token: memberTok,
      body: {
        name: `byok-live-${suffix}`,
        unlimited_quota: true,
        expired_time: -1,
        remain_quota: 0,
        workspace_id: ws.id,
      },
    })
    if (!tokCreate.json.success) throw new Error(`token: ${tokCreate.json.message}`)
    const rawKey = await getTokenKey(memberTok, tokCreate.json.data.id)

    const beforeHits = hits.length
    const relay = await fetch(`${BASE}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${rawKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: 'user', content: 'ping-byok' }],
        max_tokens: 8,
      }),
    })
    const relayText = await relay.text()
    let relayJson
    try {
      relayJson = JSON.parse(relayText)
    } catch {
      relayJson = { raw: relayText }
    }

    if (!relay.ok || !relayJson.choices) {
      throw new Error(
        `relay failed ${relay.status}: ${relayJson.error?.message || relayJson.message || relayText.slice(0, 300)}`
      )
    }
    log(`PASS  relay ok content=${relayJson.choices?.[0]?.message?.content}`)

    const newHits = hits.slice(beforeHits)
    if (newHits.length === 0) {
      throw new Error('mock received 0 hits — BYOK did not outbound to mock')
    }
    const hit = newHits[0]
    const expectedAuth = `Bearer ${BYOK_KEY}`
    if (hit.auth !== expectedAuth) {
      throw new Error(
        `mock auth mismatch: got=${JSON.stringify(hit.auth)} expected=${JSON.stringify(expectedAuth)}`
      )
    }
    log(`PASS  mock auth uses BYOK key; url=${hit.method} ${hit.url}`)

    // Wait briefly for async log write
    await new Promise((r) => setTimeout(r, 800))
    const logs = await api(
      'GET',
      `/api/log/self?type=2&page_size=20&workspace_id=${ws.id}`,
      { token: memberTok }
    )
    const items = logs.json.data?.items || logs.json.data || []
    const recent = items.find(
      (l) =>
        l.model_name === MODEL ||
        (l.other && String(l.other).includes('byok')) ||
        l.upstream_source === 'byok'
    )
    let source =
      recent?.upstream_source ||
      (typeof recent?.other === 'object' ? recent.other?.upstream_source : null)
    if (!source && recent?.other && typeof recent.other === 'string') {
      try {
        source = JSON.parse(recent.other)?.upstream_source
      } catch {
        /* ignore */
      }
    }
    if (source !== 'byok') {
      // Fallback: scan all recent for byok
      const anyByok = items.find((l) => {
        if (l.upstream_source === 'byok') return true
        if (typeof l.other === 'object' && l.other?.upstream_source === 'byok')
          return true
        return false
      })
      if (anyByok) {
        source = 'byok'
      } else {
        log(
          `WARN  log upstream_source not found yet; sample=${JSON.stringify(items[0] || logs.json).slice(0, 400)}`
        )
        throw new Error(`expected upstream_source=byok, got ${source || '(none)'}`)
      }
    }
    log(`PASS  consume log upstream_source=${source}`)

    // Restore not needed — disposable customer
    void memberId
    log('\n=== BYOK LIVE SMOKE SUMMARY ===')
    log(JSON.stringify({ PASS: 4, FAIL: 0, SKIP: 0 }))
  } finally {
    server.close()
  }
}

main().catch((err) => {
  console.error('FAIL  byok-live-smoke —', err.message || err)
  process.exit(1)
})
