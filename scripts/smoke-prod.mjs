// Read-only production smoke test. Hits public routes over HTTP and asserts
// status codes / headers / shape. Does NOT mutate data (no server actions).
//
// Usage:
//   node scripts/smoke-prod.mjs <base-url> <admin-key>
//   node scripts/smoke-prod.mjs https://poker-site-kappa.vercel.app 0bff...
// or via env: PROD_URL=... ADMIN_KEY=... node scripts/smoke-prod.mjs

const BASE = (process.argv[2] || process.env.PROD_URL || '').replace(/\/$/, '')
const KEY = process.argv[3] || process.env.ADMIN_KEY || ''

if (!BASE) {
  console.error('Usage: node scripts/smoke-prod.mjs <base-url> [admin-key]')
  process.exit(1)
}

let pass = 0
let fail = 0
const log = (ok, name, detail) => {
  console.log(`${ok ? 'OK  ✅' : 'ERR ❌'}  ${name}${detail ? `  — ${detail}` : ''}`)
  ok ? pass++ : fail++
}

// fetch without following redirects so we can assert on 3xx + Location
const raw = (path, opts = {}) =>
  fetch(`${BASE}${path}`, { redirect: 'manual', headers: { 'user-agent': 'smoke-prod' }, ...opts })

console.log(`\nSmoke testing: ${BASE}\n`)

// 1. /api/poll — public read endpoint, must be 200 + JSON shape
try {
  const r = await raw('/api/poll')
  const ok = r.status === 200
  let shape = ''
  if (ok) {
    const j = await r.json()
    const hasShape = Array.isArray(j.players) && 'activeSession' in j
    log(hasShape, '/api/poll shape', `players=${Array.isArray(j.players) ? j.players.length : '??'}, activeSession=${j.activeSession ? 'yes' : 'null'}`)
  }
  log(ok, '/api/poll status', `${r.status}`)
} catch (e) {
  log(false, '/api/poll', e.message)
}

// 2. /identity — must NOT be a baked static redirect (the bug we fixed).
//    With an active season it should render 200; with none it 3xx → /season/new.
try {
  const r = await raw('/identity')
  const loc = r.headers.get('location') || ''
  const ok = r.status === 200 || (r.status >= 300 && r.status < 400)
  log(ok, '/identity reachable', `${r.status}${loc ? ` → ${loc}` : ''}`)
} catch (e) {
  log(false, '/identity', e.message)
}

// 3. / (dashboard) — unauthenticated should redirect (to /identity or /season/new)
try {
  const r = await raw('/')
  const loc = r.headers.get('location') || ''
  log(r.status >= 300 && r.status < 400, '/ redirects (unauthed)', `${r.status}${loc ? ` → ${loc}` : ''}`)
} catch (e) {
  log(false, '/', e.message)
}

// 4. /admin?key=WRONG — must be a real 404 (no hint the endpoint exists)
try {
  const r = await raw('/admin?key=definitely-wrong-key')
  log(r.status === 404, '/admin wrong key → 404', `${r.status}`)
} catch (e) {
  log(false, '/admin wrong key', e.message)
}

// 5. /admin?key=CORRECT — should redirect (proxy sets cookie, drops key param)
if (KEY) {
  try {
    const r = await raw(`/admin?key=${encodeURIComponent(KEY)}`)
    const setCookie = r.headers.get('set-cookie') || ''
    const ok = r.status >= 300 && r.status < 400 && /admin_key/.test(setCookie)
    log(ok, '/admin correct key → redirect+cookie', `${r.status}, cookie=${/admin_key/.test(setCookie) ? 'set' : 'none'}`)
  } catch (e) {
    log(false, '/admin correct key', e.message)
  }
} else {
  console.log('--  skip /admin correct-key check (no admin key passed)')
}

// 6. Security headers on a normal response
try {
  const r = await raw('/identity')
  const xfo = r.headers.get('x-frame-options')
  const xcto = r.headers.get('x-content-type-options')
  log(xfo === 'DENY', 'header X-Frame-Options', xfo || 'missing')
  log(xcto === 'nosniff', 'header X-Content-Type-Options', xcto || 'missing')
} catch (e) {
  log(false, 'security headers', e.message)
}

console.log(`\n${pass} passed, ${fail} failed\n`)
process.exit(fail ? 1 : 0)
