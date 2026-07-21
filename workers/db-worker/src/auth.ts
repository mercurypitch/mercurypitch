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
//   GET  /api/auth/verify-email?token=&returnTo=      (email confirm link)
//   POST /api/auth/resend-verification                (Bearer token)
//   GET  /api/auth/me        (Bearer token)
//
// `deviceId` is the client's persisted anonymous UUID. Passing it to
// register/google UPGRADES that anonymous user in place, so all rows
// (sessions, badges, progress) stay attached to the same userId.

import { sendEmailVerification, sendSignupWelcome } from './email'
import { shouldTouchLastActive } from './last-active'

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
  /**
   * Comma-separated browser origins allowed to call this worker. Requests
   * WITHOUT an Origin header (curl/scripts, service-to-service calls,
   * Stripe webhooks, top-level navigations like the Google OAuth callback)
   * always pass. The literal entry `localhost` allows any localhost /
   * 127.0.0.1 origin on any port and scheme. Unset = no gate (bare local
   * wrangler). Purpose: locally served builds must never write to deployed
   * DBs — prod user pollution from tour walks/previews proved this has to
   * be enforced server-side, not by client-side discipline.
   */
  ALLOWED_ORIGINS?: string
  /** Stripe secret key (sk_...). `wrangler secret put STRIPE_SECRET_KEY`.
   *  When unset, checkout/portal return "not configured" and billing is inert. */
  STRIPE_SECRET_KEY?: string
  /** Stripe webhook signing secret (whsec_...) for /api/billing/webhook. */
  STRIPE_WEBHOOK_SECRET?: string
  /** Shared secret authorizing service-to-service billing calls (the main
   *  worker's job refunds via X-Service-Key). Set the SAME value on both
   *  workers; refunds return 503 while unset. */
  BILLING_SERVICE_KEY?: string
  /** Resend API key (re_...) for the purchase "thank you" email. When unset,
   *  the email is skipped (credits are still granted). `wrangler secret put
   *  RESEND_API_KEY`. Requires a verified sender domain in Resend. */
  RESEND_API_KEY?: string
  /** From address for the thank-you email, e.g.
   *  "MercuryPitch <hello@mercurypitch.com>". Must be on a Resend-verified
   *  domain — the root mercurypitch.com is verified; send.mercurypitch.com is
   *  only its return-path. Defaults to hello@mercurypitch.com when unset. */
  EMAIL_FROM?: string
  /** Operator address for billing-reconciliation alerts (a recovery email
   *  means Stripe webhook delivery is broken). Optional — unset logs only.
   *  `wrangler secret put BILLING_ALERT_EMAIL` (kept out of the public repo). */
  BILLING_ALERT_EMAIL?: string
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
  lastActiveAt: string | null
  tokenVersion: number
}

const TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60 // 30 days
const PBKDF2_ITERATIONS = 100_000
// Syntactically-valid PBKDF2 hash that never matches a real password. Used to
// keep login timing constant when the email is unknown, defeating user
// enumeration via response timing.
const DUMMY_PASSWORD_HASH = `pbkdf2$${PBKDF2_ITERATIONS}$${'A'.repeat(22)}$${'A'.repeat(43)}`
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PASSWORD_MIN_LENGTH = 8

// Length + letter + number only — no uppercase/special-char composition
// rules. Browser password generators must always pass (Firefox generates
// letters+digits with no specials), and NIST 800-63B favours length over
// composition anyway. Mirrored client-side in src/lib/password-policy.ts —
// keep the two in sync.
function isStrongPassword(password: string): { ok: boolean; reason?: string } {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return { ok: false, reason: `Password must be at least ${PASSWORD_MIN_LENGTH} characters` }
  }
  if (!/[A-Za-z]/.test(password)) {
    return { ok: false, reason: 'Password must contain at least one letter' }
  }
  if (!/[0-9]/.test(password)) {
    return { ok: false, reason: 'Password must contain at least one number' }
  }
  return { ok: true }
}

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
  v: number
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

  // Fail closed: the user must still exist, and a token whose version is below
  // the stored tokenVersion was revoked (logout, etc.). A missing `v` claim is
  // treated as version 0 so a single tokenVersion bump also revokes legacy
  // tokens.
  const user = await env.DB.prepare('SELECT tokenVersion, lastActiveAt FROM users WHERE id = ?')
    .bind(payload.sub)
    .first<{ tokenVersion: number; lastActiveAt: string | null }>()
  if (!user) return null
  if (user.tokenVersion > (payload.v ?? 0)) return null

  // Throttled last-active touch: at most one write per user per window (see
  // shouldTouchLastActive), so ongoing visits are tracked without multiplying
  // D1 writes. Awaited inside try/catch on purpose: a best-effort tracking
  // write must never fail auth, and — since getAuth has no ExecutionContext to
  // waitUntil() — must not be a dangling promise the runtime can cancel once
  // the response is returned.
  if (shouldTouchLastActive(user.lastActiveAt, Date.now())) {
    try {
      await env.DB.prepare('UPDATE users SET lastActiveAt = ? WHERE id = ?')
        .bind(new Date().toISOString(), payload.sub)
        .run()
    } catch {
      // Ignore: last-active tracking is best-effort.
    }
  }

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

/**
 * Constant-time string comparison for secrets (admin keys, tokens). Unlike
 * `===`, it never short-circuits on the first differing byte, so the time
 * taken does not leak how many leading bytes a guess got right. A length
 * mismatch is folded into the result rather than returned early.
 */
export function timingSafeEqual(a: string, b: string): boolean {
  const ab = encoder.encode(a)
  const bb = encoder.encode(b)
  let diff = ab.length ^ bb.length
  for (let i = 0; i < ab.length; i++) diff |= ab[i] ^ (bb[i] ?? 0)
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
  // Use the v3 tokeninfo endpoint (POST body, not query param — avoids
  // token leakage in intermediate proxy/server logs).
  const res = await fetch('https://www.googleapis.com/oauth2/v3/tokeninfo', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ id_token: idToken }),
  })
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
      `INSERT INTO users (id, createdAt, updatedAt, authProvider, providerId, email, emailVerified, passwordHash, lastLoginAt, tokenVersion)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
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

// ── Rate limiting ────────────────────────────────────────────────────
//
// Per-IP counters in D1 (auth_ratelimit table). Each auth endpoint has
// its own bucket. Counters auto-expire after the window passes.

interface RateLimitBucket {
  ip: string
  endpoint: string
  count: number
  windowStart: number
}

const RATE_LIMITS: Record<string, { max: number; windowMs: number }> = {
  anonymous: { max: 30, windowMs: 60_000 },   // 30/min
  register: { max: 5, windowMs: 300_000 },     // 5/5min
  login: { max: 10, windowMs: 300_000 },       // 10/5min
  google: { max: 30, windowMs: 60_000 },       // 30/min
  logout: { max: 30, windowMs: 60_000 },       // 30/min
  // Email-verification: the confirm link is a cheap GET; resend actually
  // sends mail, so it gets the tightest budget.
  'verify-email': { max: 30, windowMs: 60_000 },        // 30/min
  'resend-verification': { max: 3, windowMs: 600_000 }, // 3/10min
  // Generic per-IP cap for CRUD mutations (POST/PATCH/DELETE), enforced by
  // index.ts. Generous for normal use (session saves, settings, follows) but
  // bounds scripted spam / unbounded row creation. Tunable.
  'crud-write': { max: 120, windowMs: 60_000 }, // 120/min
  // Anonymous Voice Mirror funnel beacons: a full run emits ~10 events, so
  // 60/min per IP is roomy for humans and cheap to spam-bound.
  'mirror-event': { max: 60, windowMs: 60_000 },
}

export async function checkRateLimit(
  db: D1Database,
  ip: string,
  endpoint: string,
): Promise<{ allowed: boolean; retryAfter?: number }> {
  const limit = RATE_LIMITS[endpoint]
  if (!limit) return { allowed: true }

  const now = Date.now()
  // Atomic upsert: start a fresh window when the previous one has elapsed,
  // otherwise increment. Doing it in a single statement avoids the
  // read-then-write race where concurrent requests both pass the check.
  const row = await db
    .prepare(
      `INSERT INTO auth_ratelimit (ip, endpoint, count, windowStart) VALUES (?, ?, 1, ?)
       ON CONFLICT(ip, endpoint) DO UPDATE SET
         count = CASE WHEN ? - windowStart >= ? THEN 1 ELSE count + 1 END,
         windowStart = CASE WHEN ? - windowStart >= ? THEN ? ELSE windowStart END
       RETURNING count, windowStart`,
    )
    .bind(ip, endpoint, now, now, limit.windowMs, now, limit.windowMs, now)
    .first<{ count: number; windowStart: number }>()

  if (row && row.count > limit.max) {
    const retryAfter = Math.ceil((limit.windowMs - (now - row.windowStart)) / 1000)
    return { allowed: false, retryAfter }
  }
  return { allowed: true }
}

// ── Route handlers ───────────────────────────────────────────────────

type Respond = (body: object | null, init?: ResponseInit) => Response

async function createSession(env: Env, row: UserRow): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const token = await signJwt(
    {
      sub: row.id,
      provider: row.authProvider,
      iat: now,
      exp: now + TOKEN_TTL_SECONDS,
      v: row.tokenVersion ?? 1,
    },
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

// Fire the account welcome email — best-effort, never blocks or fails signup.
// Skipped when Resend is unconfigured or the account has no email (anonymous).
async function sendWelcomeEmail(
  env: Env,
  to: string | null | undefined,
  displayName: string | null | undefined,
): Promise<void> {
  if (!env.RESEND_API_KEY || !to) return
  try {
    await sendSignupWelcome(
      { apiKey: env.RESEND_API_KEY, from: env.EMAIL_FROM },
      to,
      { displayName },
    )
  } catch (err) {
    console.error(`[auth] welcome email failed (non-fatal): ${String(err)}`)
  }
}

// ── Email verification (password signups) ────────────────────────────
//
// Password accounts start with emailVerified = 0; the confirm link flips it.
// Soft gate by design: the account works immediately, the app just shows a
// "confirm your email" banner until the link is clicked. (Google accounts
// arrive with Google's own email_verified claim instead.)

const VERIFY_TOKEN_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours

async function sha256b64url(s: string): Promise<string> {
  return b64urlEncode(await crypto.subtle.digest('SHA-256', encoder.encode(s)))
}

/** Mint a single-use verification token (superseding any older ones for the
 *  user) and store only its SHA-256. Returns the raw token for the link. */
async function createEmailVerification(
  db: D1Database,
  userId: string,
  email: string,
): Promise<string> {
  const token = b64urlEncode(crypto.getRandomValues(new Uint8Array(32)))
  const tokenHash = await sha256b64url(token)
  await db.prepare('DELETE FROM emailVerifications WHERE userId = ?').bind(userId).run()
  await db
    .prepare(
      'INSERT INTO emailVerifications (tokenHash, userId, email, createdAt, expiresAt) VALUES (?, ?, ?, ?, ?)',
    )
    .bind(
      tokenHash,
      userId,
      email,
      nowIso(),
      new Date(Date.now() + VERIFY_TOKEN_TTL_MS).toISOString(),
    )
    .run()
  return token
}

// Fire the confirm-your-email message (doubles as the welcome for password
// signups) — best-effort, never blocks or fails signup. The link routes
// through this worker and bounces back to the app origin the signup came
// from (validated against the allowed origins; prod app as fallback).
async function sendVerificationEmail(
  request: Request,
  env: Env,
  userId: string,
  email: string,
  displayName: string | null | undefined,
): Promise<void> {
  if (!env.RESEND_API_KEY) return
  try {
    const token = await createEmailVerification(env.DB, userId, email)
    const requestOrigin = request.headers.get('Origin') ?? ''
    const returnTo = isAllowedReturnTo(requestOrigin, env)
      ? requestOrigin
      : 'https://mercurypitch.com'
    const verifyUrl =
      `${new URL(request.url).origin}/api/auth/verify-email` +
      `?token=${encodeURIComponent(token)}&returnTo=${encodeURIComponent(returnTo)}`
    await sendEmailVerification(
      { apiKey: env.RESEND_API_KEY, from: env.EMAIL_FROM },
      email,
      { displayName, verifyUrl },
    )
  } catch (err) {
    console.error(`[auth] verification email failed (non-fatal): ${String(err)}`)
  }
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

async function handleRegister(
  request: Request,
  body: AuthBody,
  env: Env,
  respond: Respond,
): Promise<Response> {
  const email = body.email?.trim().toLowerCase()
  if (!email || !EMAIL_RE.test(email)) {
    return respond({ error: 'Valid email required' }, { status: 400 })
  }
  if (!body.password) {
    return respond({ error: 'Password required' }, { status: 400 })
  }
  const pwdCheck = isStrongPassword(body.password)
  if (!pwdCheck.ok) {
    return respond({ error: pwdCheck.reason }, { status: 400 })
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
      // The anonymous user's profile already exists with a default
      // "Singer-XXXX" name, so ensureProfile's INSERT OR IGNORE won't apply the
      // chosen name — update it explicitly when one was provided.
      const chosenName = body.displayName?.trim()
      if (chosenName) {
        await env.DB.prepare(
          `UPDATE userProfiles SET displayName = ?, updatedAt = ? WHERE id = ?`,
        )
          .bind(chosenName, nowIso(), anon.id)
          .run()
      }
      const row = (await findUserById(env.DB, anon.id)) as UserRow
      await sendVerificationEmail(request, env, anon.id, email, body.displayName?.trim())
      return issueSession(env, row, respond)
    }
  }

  const id = crypto.randomUUID()
  await createUser(env.DB, { id, authProvider: 'password', email, passwordHash })
  await ensureProfile(env.DB, id, body.displayName?.trim() || defaultDisplayName(id))
  const row = (await findUserById(env.DB, id)) as UserRow
  await sendVerificationEmail(request, env, id, email, body.displayName?.trim())
  return issueSession(env, row, respond, true)
}

async function handleLogin(body: AuthBody, env: Env, respond: Respond): Promise<Response> {
  const email = body.email?.trim().toLowerCase()
  if (!email || !body.password) {
    return respond({ error: 'Email and password required' }, { status: 400 })
  }
  const row = await findUserByEmail(env.DB, email)
  // Always run a PBKDF2 verification — even when the user/hash is absent — so
  // the response time doesn't reveal whether the email is registered.
  const ok = await verifyPassword(
    body.password,
    row?.passwordHash ?? DUMMY_PASSWORD_HASH,
  )
  if (!row?.passwordHash || !ok) {
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
      await sendWelcomeEmail(env, email, claims.name)
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
  await sendWelcomeEmail(env, email, claims.name)
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

  const { row, isNew } = await resolveGoogleUser(claims, state.deviceId, env)
  const token = await createSession(env, row)
  // gauth_new lets the client count first-time signups (funnel) — the token
  // alone can't distinguish a signup from a returning login.
  return redirect(
    `${state.returnTo}#gauth=${encodeURIComponent(token)}${isNew ? '&gauth_new=1' : ''}`,
  )
}

/** GET /api/auth/verify-email?token=&returnTo= — the emailed confirm link.
 *  A top-level navigation, so success/failure land back in the app as a
 *  fragment (#everified=1 / #everified_error=…), mirroring the Google flow. */
async function handleVerifyEmail(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url)
  const returnToRaw = url.searchParams.get('returnTo') ?? ''
  const returnTo = isAllowedReturnTo(returnToRaw, env)
    ? returnToRaw
    : 'https://mercurypitch.com'
  const fail = (reason: string): Response =>
    redirect(`${returnTo}/#everified_error=${encodeURIComponent(reason)}`)

  const token = url.searchParams.get('token') ?? ''
  if (token === '') return fail('missing_token')
  const tokenHash = await sha256b64url(token)
  const row = await env.DB.prepare(
    'SELECT userId, email, expiresAt FROM emailVerifications WHERE tokenHash = ?',
  )
    .bind(tokenHash)
    .first<{ userId: string; email: string; expiresAt: string }>()
  if (!row) return fail('invalid_or_used')
  // Single-use: consume the token whatever the outcome below.
  await env.DB.prepare('DELETE FROM emailVerifications WHERE tokenHash = ?')
    .bind(tokenHash)
    .run()
  if (Date.parse(row.expiresAt) < Date.now()) return fail('expired')
  const user = await findUserById(env.DB, row.userId)
  // The address must still be the one the token was minted for.
  if (!user || user.email?.toLowerCase() !== row.email.toLowerCase()) {
    return fail('invalid_or_used')
  }
  await env.DB.prepare('UPDATE users SET emailVerified = 1, updatedAt = ? WHERE id = ?')
    .bind(nowIso(), row.userId)
    .run()
  return redirect(`${returnTo}/#everified=1`)
}

/** POST /api/auth/resend-verification (Bearer) — re-send the confirm link. */
async function handleResendVerification(
  request: Request,
  env: Env,
  respond: Respond,
): Promise<Response> {
  const auth = await getAuth(request, env)
  if (!auth) return respond({ error: 'Unauthorized' }, { status: 401 })
  const row = await findUserById(env.DB, auth.userId)
  if (!row) return respond({ error: 'User not found' }, { status: 404 })
  if (!row.email) {
    return respond({ error: 'No email on this account' }, { status: 400 })
  }
  if (row.emailVerified) {
    return respond({ ok: true, alreadyVerified: true })
  }
  if (!env.RESEND_API_KEY) {
    return respond({ error: 'Email sending is not configured' }, { status: 501 })
  }
  const profile = await env.DB.prepare('SELECT displayName FROM userProfiles WHERE id = ?')
    .bind(row.id)
    .first<{ displayName: string | null }>()
  await sendVerificationEmail(request, env, row.id, row.email, profile?.displayName)
  return respond({ ok: true })
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

async function handleLogout(request: Request, env: Env, respond: Respond): Promise<Response> {
  const auth = await getAuth(request, env)
  if (!auth) return respond({ error: 'Unauthorized' }, { status: 401 })
  // Increment token version — all previously issued JWTs become invalid
  await env.DB.prepare(
    'UPDATE users SET tokenVersion = tokenVersion + 1, updatedAt = ? WHERE id = ?',
  )
    .bind(nowIso(), auth.userId)
    .run()
  return respond({ ok: true })
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
  if (route === 'logout' && request.method === 'POST') {
    return handleLogout(request, env, respond)
  }
  if (route === 'google/start' && request.method === 'GET') {
    return handleGoogleStart(request, env, respond)
  }
  if (route === 'google/callback' && request.method === 'GET') {
    return handleGoogleCallback(request, env, respond)
  }
  if (route === 'verify-email' && request.method === 'GET') {
    const ip = request.headers.get('CF-Connecting-IP') ?? '127.0.0.1'
    const rl = await checkRateLimit(env.DB, ip, 'verify-email')
    if (!rl.allowed) {
      return respond(
        { error: `Too many requests. Retry after ${rl.retryAfter ?? 60} seconds.` },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfter ?? 60) } },
      )
    }
    return handleVerifyEmail(request, env)
  }
  if (request.method !== 'POST') {
    return respond({ error: 'Method not allowed' }, { status: 405 })
  }

  // Rate limiting on auth POST endpoints
  const ip = request.headers.get('CF-Connecting-IP') ?? '127.0.0.1'
  const rl = await checkRateLimit(env.DB, ip, route)
  if (!rl.allowed) {
    return respond(
      { error: `Too many requests. Retry after ${rl.retryAfter ?? 60} seconds.` },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfter ?? 60) } },
    )
  }

  // These don't need a body
  if (route === 'logout') {
    return handleLogout(request, env, respond)
  }
  if (route === 'resend-verification') {
    return handleResendVerification(request, env, respond)
  }

  const body = await parseBody(request)
  if (!body) return respond({ error: 'Invalid JSON body' }, { status: 400 })

  switch (route) {
    case 'anonymous':
      return handleAnonymous(body, env, respond)
    case 'register':
      return handleRegister(request, body, env, respond)
    case 'login':
      return handleLogin(body, env, respond)
    case 'google':
      return handleGoogle(body, env, respond)
    default:
      return respond({ error: 'Not found' }, { status: 404 })
  }
}
