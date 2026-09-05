// ── /api/auth/2fa/* — enrollment, and the sign-in challenge ──────────
//
// The flow: /api/auth/login (or a Google sign-in, or a mailed code) proves the
// first factor and — for an account with a confirmed TOTP credential — answers
// with a short-lived ceremony token INSTEAD of a session. /2fa/verify trades a
// valid code for the real session. Sign-in therefore stays one request for the
// overwhelming majority who have no second factor, and becomes two for the
// rest.
//
// Dispatched from index.ts rather than from handleAuth, so the import runs one
// way — this file imports auth.ts, never the reverse.

import type { Env } from './auth'
import { checkRateLimit, clearRateLimit, getAuth, issueSessionFor, reissueLegacySession, sessionOrigin } from './auth'
import { readCeremony } from './auth-ceremony'
import { endOtherSessions } from './auth-sessions'
import { generateTotpSecret, otpauthUri, verifyTotp } from './totp'
import { confirmTotp, consumeRecoveryCode, disableTotp, enrollTotp, generateRecoveryCodes, getPendingTotpSecret, getTotpForLogin, markTotpStepUsed, storeRecoveryCodes, totpStatus, twofaConfigured, } from './twofa'

type Respond = (body: object | null, init?: ResponseInit) => Response

const TOTP_ISSUER = 'MercuryPitch'

/**
 * One shared attempt budget for /2fa/verify AND /2fa/disable.
 *
 * Both accept the same proof, so an attacker must not be handed a fresh
 * guessing budget simply by attacking the disable path instead of the
 * challenge. Ten is generous for fat fingers and useless against 10^6 codes.
 */
function twofaBucket(userId: string): string {
  return `2fa:${userId}`
}

function tooMany(respond: Respond, rl: { retryAfter?: number }): Response {
  const after = rl.retryAfter ?? 60
  return respond(
    { error: `Too many attempts. Try again in ${after} seconds.` },
    { status: 429, headers: { 'Retry-After': String(after) } },
  )
}

function notConfigured(respond: Respond): Response {
  // 503, not 500: nothing is broken and nothing the caller did is wrong. The
  // environment simply has no TOTP_KEK, so 2FA cannot operate here.
  return respond(
    { error: 'Two-factor authentication is unavailable in this environment' },
    { status: 503 },
  )
}

async function readBody(request: Request): Promise<Record<string, unknown>> {
  try {
    return (await request.json()) as Record<string, unknown>
  } catch {
    return {}
  }
}

function stringField(body: Record<string, unknown>, key: string): string {
  const value = body[key]
  return typeof value === 'string' ? value.trim() : ''
}

/**
 * Either proof a signed-in account can present: the current TOTP code, or one
 * recovery code. The shape decides which — six digits is a TOTP code, anything
 * else is tried as a recovery code.
 *
 * A recovery code is spent even when it is used HERE, on a disable attempt. A
 * code someone read over a shoulder during that attempt must not still work
 * for a sign-in afterwards.
 *
 * Exported for the passkey routes: adding a passkey from a stale session
 * demands exactly this proof.
 */
export async function verifySecondFactor(
  env: Env,
  userId: string,
  code: string,
): Promise<boolean> {
  const credential = await getTotpForLogin(env, userId)
  if (credential === null) return false
  if (/^\d{6}$/.test(code)) {
    // A credential whose secret will not decrypt (a rotated TOTP_KEK) can
    // still be satisfied by a recovery code, which is hashed rather than
    // encrypted — but never by a TOTP code, because there is nothing to
    // compare against.
    if (credential.secret === null) return false
    const minStep =
      credential.lastUsedStep === null ? undefined : credential.lastUsedStep + 1
    const matched = await verifyTotp(credential.secret, code, { minStep })
    if (matched === null) return false
    await markTotpStepUsed(env, userId, matched)
    return true
  }
  return consumeRecoveryCode(env, userId, code)
}

/** Route /api/auth/2fa/*. Returns null when the path is not ours. */
export async function handleTwofaRoute(
  request: Request,
  env: Env,
  pathname: string,
  respond: Respond,
): Promise<Response | null> {
  if (!pathname.startsWith('/api/auth/2fa/')) return null
  const route = pathname.slice('/api/auth/2fa/'.length)

  if (route === 'status' && request.method === 'GET') {
    const auth = await getAuth(request, env)
    if (auth === null)
      return respond({ error: 'Unauthorized' }, { status: 401 })
    if (!twofaConfigured(env)) {
      // Not an error: an environment without the key simply has the feature
      // off, and the settings pane needs to be able to say so rather than
      // render a broken switch.
      return respond({ enabled: false, recoveryCodesLeft: 0, available: false })
    }
    return respond({ ...(await totpStatus(env, auth.userId)), available: true })
  }

  if (request.method !== 'POST') {
    return respond({ error: 'Method not allowed' }, { status: 405 })
  }
  if (!twofaConfigured(env)) return notConfigured(respond)
  if (env.JWT_SECRET === undefined || env.JWT_SECRET === '') {
    return respond({ error: 'JWT_SECRET not configured' }, { status: 500 })
  }

  switch (route) {
    case 'setup':
      return handleSetup(request, env, respond)
    case 'enable':
      return handleEnable(request, env, respond)
    case 'disable':
      return handleDisable(request, env, respond)
    case 'verify':
      return handleVerify(request, env, respond)
    default:
      return respond({ error: 'Not found' }, { status: 404 })
  }
}

/** POST /api/auth/2fa/setup — mint a pending secret and its QR payload. */
async function handleSetup(
  request: Request,
  env: Env,
  respond: Respond,
): Promise<Response> {
  const auth = await getAuth(request, env)
  if (auth === null) return respond({ error: 'Unauthorized' }, { status: 401 })
  const rl = await checkRateLimit(env.DB, auth.userId, '2fa-setup')
  if (!rl.allowed) return tooMany(respond, rl)
  if ((await totpStatus(env, auth.userId)).enabled) {
    // Silently replacing a confirmed credential would let anyone holding a
    // live session swap the second factor for one of their own.
    return respond(
      { error: 'Two-factor authentication is already on' },
      { status: 409 },
    )
  }
  const user = await env.DB.prepare('SELECT email FROM users WHERE id = ?')
    .bind(auth.userId)
    .first<{ email: string | null }>()
  const secret = generateTotpSecret()
  await enrollTotp(env, auth.userId, secret)
  return respond({
    secret,
    otpauthUri: otpauthUri(
      secret,
      user?.email ?? `singer-${auth.userId.slice(0, 8)}`,
      TOTP_ISSUER,
    ),
  })
}

/** POST /api/auth/2fa/enable — confirm a code, hand back the recovery sheet. */
async function handleEnable(
  request: Request,
  env: Env,
  respond: Respond,
): Promise<Response> {
  const auth = await getAuth(request, env)
  if (auth === null) return respond({ error: 'Unauthorized' }, { status: 401 })
  const bucket = twofaBucket(auth.userId)
  const rl = await checkRateLimit(env.DB, bucket, '2fa')
  if (!rl.allowed) return tooMany(respond, rl)

  const secret = await getPendingTotpSecret(env, auth.userId)
  if (secret === null) {
    return respond({ error: 'No 2FA setup in progress' }, { status: 400 })
  }
  const code = stringField(await readBody(request), 'code')
  const matched = await verifyTotp(secret, code)
  if (matched === null) {
    return respond(
      { error: 'That code did not match — check the app and try again' },
      { status: 401 },
    )
  }
  await clearRateLimit(env.DB, bucket, '2fa')
  await confirmTotp(env, auth.userId)
  await markTotpStepUsed(env, auth.userId, matched)
  const recoveryCodes = generateRecoveryCodes()
  await storeRecoveryCodes(env, auth.userId, recoveryCodes)
  // Every session that predates enrollment got in on one factor — including,
  // in the case this feature exists for, an intruder's. Only the session doing
  // the enrolling survives.
  if (auth.sessionId === undefined) {
    // The enroller's token predates per-device sessions, and so may an
    // intruder's: those name no session row, so deleting rows revokes
    // nothing. Bumping the token version revokes every one of them, the
    // enroller's included, who gets a fresh session back with the codes.
    await endOtherSessions(env.DB, auth.userId, null)
    const session = await reissueLegacySession(
      env,
      auth.userId,
      sessionOrigin(request),
    )
    return respond(session === null ? { recoveryCodes } : { recoveryCodes, session })
  }
  await endOtherSessions(env.DB, auth.userId, auth.sessionId)
  // The only moment the raw codes exist outside the singer's own copy: the
  // table holds nothing but their hashes.
  return respond({ recoveryCodes })
}

/** POST /api/auth/2fa/disable — turn it off, on proof of a current factor. */
async function handleDisable(
  request: Request,
  env: Env,
  respond: Respond,
): Promise<Response> {
  const auth = await getAuth(request, env)
  if (auth === null) return respond({ error: 'Unauthorized' }, { status: 401 })
  if (!(await totpStatus(env, auth.userId)).enabled) {
    return respond(
      { error: 'Two-factor authentication is not on' },
      { status: 400 },
    )
  }
  const bucket = twofaBucket(auth.userId)
  const rl = await checkRateLimit(env.DB, bucket, '2fa')
  if (!rl.allowed) return tooMany(respond, rl)

  const code = stringField(await readBody(request), 'code')
  if (!(await verifySecondFactor(env, auth.userId, code))) {
    return respond({ error: 'That code did not match' }, { status: 401 })
  }
  await clearRateLimit(env.DB, bucket, '2fa')
  await disableTotp(env, auth.userId)
  return respond({ ok: true })
}

/**
 * POST /api/auth/2fa/verify — trade a code for the session.
 *
 * Pre-session on purpose: the caller holds a ceremony token, not a Bearer
 * token. That token is the only thing naming whose sign-in this is, so a
 * missing or expired one is refused before any code is looked at.
 */
async function handleVerify(
  request: Request,
  env: Env,
  respond: Respond,
): Promise<Response> {
  const body = await readBody(request)
  const claims = await readCeremony(
    env.JWT_SECRET,
    stringField(body, 'ceremony'),
    '2fa',
  )
  if (claims?.userId === undefined || claims.provider === undefined) {
    return respond(
      { error: 'That sign-in expired — enter your password again' },
      { status: 401 },
    )
  }
  const { userId, provider } = claims
  const bucket = twofaBucket(userId)
  const rl = await checkRateLimit(env.DB, bucket, '2fa')
  if (!rl.allowed) return tooMany(respond, rl)

  if (!(await verifySecondFactor(env, userId, stringField(body, 'code')))) {
    return respond(
      { error: 'That code did not match — check the app and try again' },
      { status: 401 },
    )
  }
  await clearRateLimit(env.DB, bucket, '2fa')
  return issueSessionFor(env, userId, provider, respond, sessionOrigin(request))
}
