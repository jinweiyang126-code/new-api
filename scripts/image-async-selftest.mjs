/**
 * Smoke: BasicRouter image async submit + poll.
 *
 *   node scripts/image-async-selftest.mjs
 *
 * Env:
 *   BASE_URL     default http://127.0.0.1:3001
 *   ROOT_USER    default root
 *   ROOT_PASS    default TestRoot1
 *   MOCK_PORT    default 18091
 */
import http from 'node:http'

const BASE = process.env.BASE_URL || 'http://127.0.0.1:3001'
const ROOT_USER = process.env.ROOT_USER || 'root'
const ROOT_PASS = process.env.ROOT_PASS || 'TestRoot1'
const MOCK_PORT = Number(process.env.MOCK_PORT || 18091)
const CHANNEL_ID = 2
const MODEL = 'seedream-4.5'

const results = []
function pass(id, detail = '') {
  results.push({ id, status: 'PASS', detail })
  console.log(`PASS  ${id}${detail ? ` — ${detail}` : ''}`)
}
function fail(id, detail) {
  results.push({ id, status: 'FAIL', detail })
  console.error(`FAIL  ${id} — ${detail}`)
}

function startMock() {
  let polls = 0
  const server = http.createServer((req, res) => {
    const url = req.url || ''
    const send = (code, body) => {
      res.writeHead(code, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(body))
    }
    if (req.method === 'POST' && url === '/v1/image-generations') {
      let buf = ''
      req.on('data', (c) => (buf += c))
      req.on('end', () => {
        send(200, { code: 0, message: 'ok', data: { taskId: 'mock-up-1' } })
      })
      return
    }
    if (req.method === 'GET' && url.startsWith('/v1/image-generations/')) {
      polls += 1
      if (polls < 2) {
        send(200, { code: 0, data: { taskId: 'mock-up-1', status: 'processing' } })
        return
      }
      send(200, {
        code: 0,
        data: {
          taskId: 'mock-up-1',
          status: 'success',
          images: JSON.stringify(['https://example.com/mock-a.png']),
          text: 'selftest',
        },
      })
      return
    }
    send(404, { message: 'not found', url })
  })
  return new Promise((resolve) => {
    server.listen(MOCK_PORT, '0.0.0.0', () => resolve(server))
  })
}

async function api(method, path, { token, cookie, body } = {}) {
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`
  if (cookie) headers.Cookie = cookie
  const started = Date.now()
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
  const setCookie =
    typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : []
  return { status: res.status, json, ms: Date.now() - started, setCookie }
}

function cookieHeader(setCookie) {
  return setCookie.map((c) => c.split(';')[0]).join('; ')
}

async function loginSession() {
  const { status, json, setCookie } = await api('POST', '/api/user/login', {
    body: { username: ROOT_USER, password: ROOT_PASS },
  })
  if (status !== 200 || json.success === false) {
    throw new Error(`login failed: ${status} ${json.message || JSON.stringify(json)}`)
  }
  const token = json.data?.access_token
  if (!token) throw new Error('login returned no access_token')
  return { token, cookie: cookieHeader(setCookie) }
}

async function pollUntilDone(token, cookie, taskId, maxMs = 25000) {
  const deadline = Date.now() + maxMs
  let last
  while (Date.now() < deadline) {
    last = await api('GET', `/pg/images/generations/${encodeURIComponent(taskId)}`, {
      token,
      cookie,
    })
    const st = last.json?.status
    if (st === 'completed' || st === 'failed') return last
    await new Promise((r) => setTimeout(r, 800))
  }
  return last
}

function stripChannelWrite(channel) {
  const next = { ...channel }
  delete next.status
  delete next.key
  return next
}

async function main() {
  const unauth = await api('POST', '/pg/images/generations', {
    body: { model: MODEL, prompt: 'a cat' },
  })
  if (unauth.status === 401 || unauth.json?.success === false) {
    pass('unauth-submit', `status=${unauth.status}`)
  } else {
    fail(
      'unauth-submit',
      `expected 401, got ${unauth.status} ${JSON.stringify(unauth.json).slice(0, 200)}`
    )
  }

  let token
  let cookie
  try {
    const session = await loginSession()
    token = session.token
    cookie = session.cookie
    pass('login')
  } catch (err) {
    fail('login', String(err))
    return
  }

  const origin = await api('GET', `/api/channel/${CHANNEL_ID}`, { token, cookie })
  if (origin.status !== 200 || origin.json?.success === false) {
    fail('get-channel', JSON.stringify(origin.json).slice(0, 300))
    return
  }
  const originChannel = origin.json.data
  const originStatus = originChannel.status
  const originBase = originChannel.base_url || ''

  const options = await api('GET', '/api/option/', { token, cookie })
  const originPriceRow = (options.json?.data || []).find((row) => row.key === 'ModelPrice')
  const originPrice = originPriceRow?.value || '{}'
  let priceMap = {}
  try {
    priceMap = JSON.parse(originPrice)
  } catch {
    priceMap = {}
  }
  const patchedPrice = { ...priceMap, [MODEL]: priceMap[MODEL] ?? 0.01 }

  const server = await startMock()
  try {
    const pricePut = await api('PUT', '/api/option/', {
      token,
      cookie,
      body: { key: 'ModelPrice', value: JSON.stringify(patchedPrice) },
    })
    if (pricePut.json?.success === false) {
      fail('patch-price', JSON.stringify(pricePut.json).slice(0, 300))
      return
    }
    const updated = await api('PUT', '/api/channel/', {
      token,
      cookie,
      body: { ...stripChannelWrite(originChannel), base_url: `http://host.docker.internal:${MOCK_PORT}` },
    })
    if (updated.json?.success === false) {
      fail('patch-channel', JSON.stringify(updated.json).slice(0, 300))
      return
    }
    const enabled = await api('POST', `/api/channel/${CHANNEL_ID}/status`, {
      token,
      cookie,
      body: { status: 1 },
    })
    if (enabled.json?.success === false) {
      fail('enable-channel', JSON.stringify(enabled.json).slice(0, 300))
      return
    }

    const submit = await api('POST', '/pg/images/generations', {
      token,
      cookie,
      body: { model: MODEL, prompt: 'selftest a red cube', n: 1, size: '1024x1024' },
    })
    const taskId = submit.json?.id || submit.json?.task_id
    if (submit.status === 200 && taskId && submit.json?.status && !Array.isArray(submit.json?.data)) {
      pass('async-submit', `id=${taskId} status=${submit.json.status} ${submit.ms}ms`)
    } else {
      fail('async-submit', `${submit.status} ${submit.ms}ms ${JSON.stringify(submit.json).slice(0, 500)}`)
      return
    }
    if (submit.ms < 8000) {
      pass('submit-fast', `${submit.ms}ms`)
    } else {
      fail('submit-fast', `too slow ${submit.ms}ms`)
    }

    const done = await pollUntilDone(token, cookie, taskId, 20000)
    const images = done?.json?.metadata?.images
    if (done?.json?.status === 'completed' && Array.isArray(images) && images[0]) {
      pass('async-poll', `images=${images.join(',')}`)
    } else {
      fail('async-poll', JSON.stringify(done?.json).slice(0, 500))
    }
  } finally {
    await api('PUT', '/api/option/', {
      token,
      cookie,
      body: { key: 'ModelPrice', value: originPrice },
    })
    await api('PUT', '/api/channel/', {
      token,
      cookie,
      body: { ...stripChannelWrite(originChannel), base_url: originBase },
    })
    await api('POST', `/api/channel/${CHANNEL_ID}/status`, {
      token,
      cookie,
      body: { status: originStatus },
    })
    await new Promise((resolve) => server.close(resolve))
  }
}

main()
  .then(() => {
    const failed = results.filter((r) => r.status === 'FAIL').length
    console.log(`\n${results.filter((r) => r.status === 'PASS').length} passed, ${failed} failed`)
    process.exit(failed ? 1 : 0)
  })
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
