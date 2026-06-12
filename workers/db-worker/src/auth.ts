// ── Auth: JWT (HS256), PBKDF2 passwords, Google Sign-In ──────────────
// Zero-dependency auth built on WebCrypto.
//
// Endpoints (handled by handleAuth):
//   POST /api/auth/anonymous { deviceId? }
//   POST /api/auth/register  { email, password, displayName?, deviceId? }
//   POST /api/auth/login     { email, password }
//   POST /api/auth/google    { idToken, deviceId? }
//   GET  /api/auth/google/start?deviceId=&returnTo=   (redirect flow)
//   GET  /api/auth/google/callback?code=&state=       (Google redirect URI)
//   GET  /api/auth/me        (Bearer token)
//
// `deviceId` is the client's persisted anonymous UUID. Passing it to
// register/google UPGRADES that anonymous user in place, so all rows
// (sessions, badges, progress) stay attached to the same userId.

export interface Env {
  DB: D1Database
  /** HMAC secret for JWTs. `wrangler secret put JWT_SECRET` (prod) or .dev.vars (local). */
  JWT_SECRET?: string
  /** OAuth client id from Google Cloud Console (Web application type). */
  GOOGLE_CLIENT_ID?: string
  /** OAuth client secret — required for the redirect code flow. */
  GOOGLE_CLIENT_SECRET?: string
  /** Shared secret for seed/admin writes via X-Admin-Key header. */
  ADMIN_KEY?: string
  /** Comma-separated extra app origins allowed as Google returnTo targets. */
  APP_ORIGINS?: string
}

export interface AuthUser {
  userId: string
  provider: string
}

interface UserRow {
  id: string
  createdAt: string
  updatedAt: string
  authProvider: string
  providerId: string | null
  email: string | null
  emailVerified: number
  passwordHash: string | null
  lastLoginAt: string | null
}

const TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60 // 30 days
const PBKDF2_ITERATIONS = 100_000
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const encoder = new TextEncoder()

// ── base64url helpers ────────────────────────────────────────────────

function b64urlEncode(data: ArrayBuffer | Uint8Array): string {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data)
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function b64urlDecode(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4))
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + pad)
  return Uint8Array.from(bin, (c) => c.charCodeAt(0))
}

// ── JWT (HS256) ──────────────────────────────────────────────────────

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  )
}

interface JwtPayload {
  sub: string
  provider: string
  iat: number
  exp: number
}

async function signJwt(payload: JwtPayload, secret: string): Promise<string> {
  const header = b64urlEncode(encoder.encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })))
  const body = b64urlEncode(encoder.encode(JSON.stringify(payload)))
  const data = `${header}.${body}`
  const sig = await crypto.subtle.sign('HMAC', await hmacKey(secret), encoder.encode(data))
  return `${data}.${b64urlEncode(sig)}`
}

async function verifyJwt(token: string, secret: string): Promise<JwtPayload | null> {
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [header, body, sig] = parts
  const valid = await crypto.subtle.verify(
    'HMAC',
    await hmacKey(secret),
    b64urlDecode(sig),
    encoder.encode(`${header}.${body}`),
  )
  if (!valid) return null
  try {
    const payload = JSON.parse(
      new TextDecoder().decode(b64urlDecode(body)),
    ) as JwtPayload
    if (typeof payload.sub !== 'string' || typeof payload.exp !== 'number') return null
    if (payload.exp < Math.floor(Date.now() / 1000)) return null
    return payload
  } catch {
    return null
  }
}

/** Extract and verify the Bearer token. Returns null when absent/invalid. */
export async function getAuth(request: Request, env: Env): Promise<AuthUser | null> {
  if (!env.JWT_SECRET) return null
  const header = request.headers.get('Authorization')
  if (!header?.startsWith('Bearer ')) return null
  const payload = await verifyJwt(header.slice(7), env.JWT_SECRET)
  if (!payload) return null
  return { userId: payload.sub, provider: payload.provider }
}

// ── Password hashing (PBKDF2-SHA256) ─────────────────────────────────

async function pbkdf2(password: string, salt: Uint8Array, iterations: number): Promise<ArrayBuffer> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  )
  return crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations },
    key,
    256,
  )
}

async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const bits = await pbkdf2(password, salt, PBKDF2_ITERATIONS)
  return `pbkdf2$${PBKDF2_ITERATIONS}$${b64urlEncode(salt)}$${b64urlEncode(bits)}`
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, iters, saltB64, hashB64] = stored.split('$')
  if (scheme !== 'pbkdf2') return false
  const bits = new Uint8Array(await pbkdf2(password, b64urlDecode(saltB64), Number(iters)))
  const expected = b64urlDecode(hashB64)
  if (bits.length !== expected.length) return false
  let diff = 0
  for (let i = 0; i < bits.length; i++) diff |= bits[i] ^ expected[i]
  return diff === 0
}

// ── Google ID-token verification ─────────────────────────────────────

interface GoogleClaims {
  aud: string
  sub: string
  email?: string
  email_verified?: string
  name?: string
  picture?: string
}

async function verifyGoogleIdToken(idToken: string, clientId: string): Promise<GoogleClaims | null> {
  // tokeninfo validates signature and expiry server-side at Google.
  const res = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`,
  )
  if (!res.ok) return null
  const claims = await res.json<GoogleClaims>()
  if (claims.aud !== clientId) return null
  return claims
}

// ── User row helpers ─────────────────────────────────────────────────

function nowIso(): string {
  return new Date().toISOString()
}

async function findUserById(db: D1Database, id: string): Promise<UserRow | null> {
  return db.prepare('SELECT * FROM users WHERE id = ?').bind(id).first<UserRow>()
}

async function findUserByEmail(db: D1Database, email: string): Promise<UserRow | null> {
  return db.prepare('SELECT * FROM users WHERE email = ?').bind(email).first<UserRow>()
}

async function createUser(
  db: D1Database,
  fields: {
    id: string
    authProvider: string
    providerId?: string
    email?: string
    emailVerified?: boolean
    passwordHash?: string
  },
): Promise<void> {
  const now = nowIso()
  await db
    .prepare(
      `INSERT INTO users (id, createdAt, updatedAt, authProvider, providerId, email, emailVerified, passwordHash, lastLoginAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      fields.id,
      now,
      now,
      fields.authProvider,
      fields.providerId ?? null,
      fields.email ?? null,
      fields.emailVerified ? 1 : 0,
      fields.passwordHash ?? null,
      now,
    )
    .run()
}

/** Create the default profile row (id == userId) if it doesn't exist. */
async function ensureProfile(
  db: D1Database,
  userId: string,
  displayName: string,
  avatarUrl?: string,
): Promise<void> {
  const now = nowIso()
  await db
    .prepare(
      `INSERT OR IGNORE INTO userProfiles (id, createdAt, updatedAt, displayName, avatarUrl, joinDate, lastPracticeDate, currentStreak)
       VALUES (?, ?, ?, ?, ?, ?, NULL, 0)`,
    )
    .bind(userId, now, now, displayName, avatarUrl ?? null, now)
    .run()
}

async function touchLogin(db: D1Database, userId: string): Promise<void> {
  await db
    .prepare('UPDATE users SET lastLoginAt = ?, updatedAt = ? WHERE id = ?')
    .bind(nowIso(), nowIso(), userId)
    .run()
}

function publicUser(row: UserRow): object {
  return {
    id: row.id,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    authProvider: row.authProvider,
    email: row.email,
    emailVerified: !!row.emailVerified,
    lastLoginAt: row.lastLoginAt,
  }
}

// ── Route handlers ───────────────────────────────────────────────────

type Respond = (body: object | null, init?: ResponseInit) => Response

async function createSession(env: Env, row: UserRow): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const token = await signJwt(
    { sub: row.id, provider: row.authProvider, iat: now, exp: now + TOKEN_TTL_SECONDS },
    env.JWT_SECRET as string,
  )
  await touchLogin(env.DB, row.id)
  return token
}

async function issueSession(env: Env, row: UserRow, respond: Respond, isNew = false): Promise<Response> {
  const token = await createSession(env, row)
  return respond({ token, userId: row.id, isNew, user: publicUser(row) })
}

interface AuthBody {
  deviceId?: string
  email?: string
  password?: string
  displayName?: string
  idToken?: string
}

async function parseBody(request: Request): Promise<AuthBody | null> {
  try {
    return await request.json<AuthBody>()
  } catch {
    return null
  }
}

function defaultDisplayName(userId: string): string {
  return `Singer-${userId.slice(0, 4)}`
}

async function handleAnonymous(body: AuthBody, env: Env, respond: Respond): Promise<Response> {
  const id = body.deviceId && UUID_RE.test(body.deviceId) ? body.deviceId : crypto.randomUUID()
  const existing = await findUserById(env.DB, id)
  if (existing) {
    // Knowing the random UUID is the anonymous credential. Upgraded
    // accounts must log in with their real method instead.
    if (existing.authProvider !== 'anonymous') {
      return respond({ error: 'Account requires login' }, { status: 403 })
    }
    return issueSession(env, existing, respond)
  }
  await createUser(env.DB, { id, authProvider: 'anonymous' })
  await ensureProfile(env.DB, id, defaultDisplayName(id))
  const row = (await findUserById(env.DB, id)) as UserRow
  return issueSession(env, row, respond, true)
}

async function handleRegister(body: AuthBody, env: Env, respond: Respond): Promise<Response> {
  const email = body.email?.trim().toLowerCase()
  if (!email || !EMAIL_RE.test(email)) {
    return respond({ error: 'Valid email required' }, { status: 400 })
  }
  if (!body.password || body.password.length < 8) {
    return respond({ error: 'Password must be at least 8 characters' }, { status: 400 })
  }
  if (await findUserByEmail(env.DB, email)) {
    return respond({ error: 'Email already registered' }, { status: 409 })
  }

  const passwordHash = await hashPassword(body.password)

  // Upgrade the existing anonymous user in place when a deviceId is given,
  // so all existing rows stay attached to the same userId.
  if (body.deviceId && UUID_RE.test(body.deviceId)) {
    const anon = await findUserById(env.DB, body.deviceId)
    if (anon && anon.authProvider === 'anonymous') {
      await env.DB.prepare(
        `UPDATE users SET authProvider = 'password', email = ?, passwordHash = ?, updatedAt = ? WHERE id = ?`,
      )
        .bind(email, passwordHash, nowIso(), anon.id)
        .run()
      const row = (await findUserById(env.DB, anon.id)) as UserRow
      return issueSession(env, row, respond)
    }
  }

  const id = crypto.randomUUID()
  await createUser(env.DB, { id, authProvider: 'password', email, passwordHash })
  await ensureProfile(env.DB, id, body.displayName?.trim() || defaultDisplayName(id))
  const row = (await findUserById(env.DB, id)) as UserRow
  return issueSession(env, row, respond, true)
}

async function handleLogin(body: AuthBody, env: Env, respond: Respond): Promise<Response> {
  const email = body.email?.trim().toLowerCase()
  if (!email || !body.password) {
    return respond({ error: 'Email and password required' }, { status: 400 })
  }
  const row = await findUserByEmail(env.DB, email)
  if (!row?.passwordHash || !(await verifyPassword(body.password, row.passwordHash))) {
    return respond({ error: 'Invalid email or password' }, { status: 401 })
  }
  return issueSession(env, row, respond)
}

/** Find-or-create the user for verified Google claims (shared by the
 * POST endpoint and the redirect code flow). */
async function resolveGoogleUser(
  claims: GoogleClaims,
  deviceId: string | undefined,
  env: Env,
): Promise<{ row: UserRow; isNew: boolean }> {
  // 1. Returning Google user
  const linked = await env.DB.prepare('SELECT * FROM users WHERE providerId = ?')
    .bind(claims.sub)
    .first<UserRow>()
  if (linked) return { row: linked, isNew: false }

  const email = claims.email?.toLowerCase()
  const emailVerified = claims.email_verified === 'true'

  // 2. Auto-link to an existing password account with the same verified email
  if (email && emailVerified) {
    const byEmail = await findUserByEmail(env.DB, email)
    if (byEmail) {
      await env.DB.prepare(
        'UPDATE users SET providerId = ?, emailVerified = 1, updatedAt = ? WHERE id = ?',
      )
        .bind(claims.sub, nowIso(), byEmail.id)
        .run()
      return { row: (await findUserById(env.DB, byEmail.id)) as UserRow, isNew: false }
    }
  }

  // 3. Upgrade the anonymous user in place when a deviceId is given
  if (deviceId && UUID_RE.test(deviceId)) {
    const anon = await findUserById(env.DB, deviceId)
    if (anon && anon.authProvider === 'anonymous') {
      await env.DB.prepare(
        `UPDATE users SET authProvider = 'google', providerId = ?, email = ?, emailVerified = ?, updatedAt = ? WHERE id = ?`,
      )
        .bind(claims.sub, email ?? null, emailVerified ? 1 : 0, nowIso(), anon.id)
        .run()
      return { row: (await findUserById(env.DB, anon.id)) as UserRow, isNew: false }
    }
  }

  // 4. Brand-new Google user
  const id = crypto.randomUUID()
  await createUser(env.DB, {
    id,
    authProvider: 'google',
    providerId: claims.sub,
    email,
    emailVerified,
  })
  await ensureProfile(env.DB, id, claims.name || defaultDisplayName(id), claims.picture)
  return { row: (await findUserById(env.DB, id)) as UserRow, isNew: true }
}

async function handleGoogle(body: AuthBody, env: Env, respond: Respond): Promise<Response> {
  if (!env.GOOGLE_CLIENT_ID) {
    return respond({ error: 'Google login not configured' }, { status: 501 })
  }
  if (!body.idToken) {
    return respond({ error: 'idToken required' }, { status: 400 })
  }
  const claims = await verifyGoogleIdToken(body.idToken, env.GOOGLE_CLIENT_ID)
  if (!claims) {
    return respond({ error: 'Invalid Google token' }, { status: 401 })
  }
  const { row, isNew } = await resolveGoogleUser(claims, body.deviceId, env)
  return issueSession(env, row, respond, isNew)
}

// ── Google OAuth redirect (code) flow ───────────────────────────
//
// The app sets Cross-Origin-Opener-Policy: same-origin (required for
// SharedArrayBuffer / multithreaded ONNX), which severs window.opener
// for ALL popups — Google's popup flow throws "Cannot read properties
// of null (reading 'postMessage')". So Google sign-in is a full-page
// redirect through this worker instead:
//
//   app → GET /api/auth/google/start?deviceId=&returnTo=
//       → 302 accounts.google.com (state = HMAC-signed {deviceId,returnTo})
//       → 302 GET /api/auth/google/callback?code=&state=
//       → code exchange (GOOGLE_CLIENT_SECRET) → id_token → user
//       → 302 {returnTo}#gauth=<our JWT>   (app stores it on load)

const STATE_TTL_MS = 10 * 60 * 1000

const DEFAULT_APP_ORIGINS = [
  'https://mercurypitch.com',
  'https://dev.mercurypitch.com',
  'https://localhost:3000',
  'http://localhost:3000',
]

function isAllowedReturnTo(returnTo: string, env: Env): boolean {
  let origin: string
  try {
    origin = new URL(returnTo).origin
  } catch {
    return false
  }
  const extra = (env.APP_ORIGINS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s !== '')
  return [...DEFAULT_APP_ORIGINS, ...extra].includes(origin)
}

interface OAuthState {
  deviceId?: string
  returnTo: string
  ts: number
}

async function signState(state: OAuthState, secret: string): Promise<string> {
  const body = b64urlEncode(encoder.encode(JSON.stringify(state)))
  const sig = await crypto.subtle.sign('HMAC', await hmacKey(secret), encoder.encode(body))
  return `${body}.${b64urlEncode(sig)}`
}

async function verifyState(raw: string, secret: string): Promise<OAuthState | null> {
  const [body, sig] = raw.split('.')
  if (!body || !sig) return null
  const valid = await crypto.subtle.verify(
    'HMAC',
    await hmacKey(secret),
    b64urlDecode(sig),
    encoder.encode(body),
  )
  if (!valid) return null
  try {
    const state = JSON.parse(new TextDecoder().decode(b64urlDecode(body))) as OAuthState
    if (typeof state.returnTo !== 'string' || typeof state.ts !== 'number') return null
    if (Date.now() - state.ts > STATE_TTL_MS) return null
    return state
  } catch {
    return null
  }
}

function redirect(location: string): Response {
  return new Response(null, { status: 302, headers: { Location: location } })
}

function redirectWithError(returnTo: string, message: string): Response {
  return redirect(`${returnTo}#gauth_error=${encodeURIComponent(message)}`)
}

async function handleGoogleStart(request: Request, env: Env, respond: Respond): Promise<Response> {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    return respond({ error: 'Google login not configured (client id/secret missing)' }, { status: 501 })
  }
  const url = new URL(request.url)
  const returnTo = url.searchParams.get('returnTo') ?? ''
  if (!isAllowedReturnTo(returnTo, env)) {
    return respond({ error: 'returnTo origin not allowed' }, { status: 400 })
  }
  const deviceIdRaw = url.searchParams.get('deviceId') ?? undefined
  const deviceId = deviceIdRaw && UUID_RE.test(deviceIdRaw) ? deviceIdRaw : undefined

  const state = await signState(
    { deviceId, returnTo, ts: Date.now() },
    env.JWT_SECRET as string,
  )

  const auth = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  auth.searchParams.set('client_id', env.GOOGLE_CLIENT_ID)
  auth.searchParams.set('redirect_uri', `${url.origin}/api/auth/google/callback`)
  auth.searchParams.set('response_type', 'code')
  auth.searchParams.set('scope', 'openid email profile')
  auth.searchParams.set('state', state)
  auth.searchParams.set('prompt', 'select_account')
  return redirect(auth.toString())
}

async function handleGoogleCallback(request: Request, env: Env, respond: Respond): Promise<Response> {
  const url = new URL(request.url)
  const state = await verifyState(
    url.searchParams.get('state') ?? '',
    env.JWT_SECRET as string,
  )
  if (!state || !isAllowedReturnTo(state.returnTo, env)) {
    return respond({ error: 'Invalid or expired state' }, { status: 400 })
  }

  const oauthError = url.searchParams.get('error')
  if (oauthError) {
    return redirectWithError(state.returnTo, oauthError)
  }
  const code = url.searchParams.get('code')
  if (!code) {
    return redirectWithError(state.returnTo, 'Missing authorization code')
  }

  // Exchange the code for an id_token
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID as string,
      client_secret: env.GOOGLE_CLIENT_SECRET as string,
      redirect_uri: `${url.origin}/api/auth/google/callback`,
      grant_type: 'authorization_code',
    }),
  })
  if (!tokenRes.ok) {
    // Google's error body ({"error":"invalid_client", …}) names the
    // misconfiguration (bad secret, redirect_uri mismatch, …) — log it
    // and surface the code so the failure is diagnosable from the UI.
    const detail = await tokenRes.text().catch(() => '')
    console.error('[google-callback] code exchange failed:', tokenRes.status, detail)
    let code = ''
    try {
      code = (JSON.parse(detail) as { error?: string }).error ?? ''
    } catch {
      /* not JSON */
    }
    return redirectWithError(
      state.returnTo,
      `Google code exchange failed${code !== '' ? ` (${code})` : ` (${tokenRes.status})`}`,
    )
  }
  const tokenData = await tokenRes.json<{ id_token?: string }>()
  if (!tokenData.id_token) {
    return redirectWithError(state.returnTo, 'No id_token from Google')
  }

  const claims = await verifyGoogleIdToken(tokenData.id_token, env.GOOGLE_CLIENT_ID as string)
  if (!claims) {
    return redirectWithError(state.returnTo, 'Invalid Google token')
  }

  const { row } = await resolveGoogleUser(claims, state.deviceId, env)
  const token = await createSession(env, row)
  return redirect(`${state.returnTo}#gauth=${encodeURIComponent(token)}`)
}

async function handleMe(request: Request, env: Env, respond: Respond): Promise<Response> {
  const auth = await getAuth(request, env)
  if (!auth) return respond({ error: 'Unauthorized' }, { status: 401 })
  const row = await findUserById(env.DB, auth.userId)
  if (!row) return respond({ error: 'User not found' }, { status: 404 })
  const profile = await env.DB.prepare('SELECT * FROM userProfiles WHERE id = ?')
    .bind(auth.userId)
    .first()
  return respond({ user: publicUser(row), profile })
}

/** Route /api/auth/* requests. Returns null when the path doesn't match. */
export async function handleAuth(
  request: Request,
  env: Env,
  pathname: string,
  respond: Respond,
): Promise<Response | null> {
  if (!pathname.startsWith('/api/auth/')) return null
  if (!env.JWT_SECRET) {
    return respond({ error: 'JWT_SECRET not configured' }, { status: 500 })
  }

  const route = pathname.slice('/api/auth/'.length)

  if (route === 'me' && request.method === 'GET') {
    return handleMe(request, env, respond)
  }
  if (route === 'google/start' && request.method === 'GET') {
    return handleGoogleStart(request, env, respond)
  }
  if (route === 'google/callback' && request.method === 'GET') {
    return handleGoogleCallback(request, env, respond)
  }
  if (request.method !== 'POST') {
    return respond({ error: 'Method not allowed' }, { status: 405 })
  }

  const body = await parseBody(request)
  if (!body) return respond({ error: 'Invalid JSON body' }, { status: 400 })

  switch (route) {
    case 'anonymous':
      return handleAnonymous(body, env, respond)
    case 'register':
      return handleRegister(body, env, respond)
    case 'login':
      return handleLogin(body, env, respond)
    case 'google':
      return handleGoogle(body, env, respond)
    default:
      return respond({ error: 'Not found' }, { status: 404 })
  }
}
