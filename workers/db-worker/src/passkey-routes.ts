// ── /api/auth/passkey/* — registering one, and signing in with one ───
//
// Four endpoints, two ceremonies. Registration needs a session (and, past the
// sudo window, a second proof); sign-in needs nothing at all, which is the
// whole appeal — the button works before anybody has typed a username.
//
// Passkey sign-in deliberately does NOT go on to demand a TOTP code. A
// user-verified passkey is possession (this device) and inherence (the
// biometric or PIN) in one gesture: it already IS multi-factor, and asking for
// a third would be theatre. That is also why `userVerification: 'required'` is
// not negotiable here, on both ceremonies — a credential registered without it
// would register cleanly and then never be allowed to sign in.
//
// Dispatched from index.ts, like the 2FA routes and for the same reason: this
// file imports auth.ts, never the reverse.

import { generateAuthenticationOptions, generateRegistrationOptions, verifyAuthenticationResponse, verifyRegistrationResponse, } from '@simplewebauthn/server'
import type { AuthenticationResponseJSON, RegistrationResponseJSON, } from '@simplewebauthn/server'
import type { Env } from './auth'
import { checkRateLimit, getAuth, issueSessionFor, sessionOrigin, verifyAccountPassword, } from './auth'
import { issueCeremony, readCeremony } from './auth-ceremony'
import { deletePasskey, expectedOrigins, findPasskey, listPasskeys, MAX_PASSKEYS_PER_USER, passkeyName, passkeysConfigured, passkeySummary, rpIdFor, savePasskey, SUDO_WINDOW_MS, touchPasskey, transportsOf, } from './passkeys'
import { verifySecondFactor } from './twofa-routes'

type Respond = (body: object | null, init?: ResponseInit) => Response

const RP_NAME = 'MercuryPitch'

function tooMany(respond: Respond, rl: { retryAfter?: number }): Response {
  const after = rl.retryAfter ?? 60
  return respond(
    { error: `Too many attempts. Try again in ${after} seconds.` },
    { status: 429, headers: { 'Retry-After': String(after) } },
  )
}

function notConfigured(respond: Respond): Response {
  // 503 rather than 500: nothing is broken. This environment has no RP id, so
  // there is no domain a passkey could honestly be minted for. On workers.dev
  // previews there never will be — see rpIdFor.
  return respond(
    { error: 'Passkeys are unavailable in this environment' },
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
 * Bytes over a plain ArrayBuffer.
 *
 * The library's `Uint8Array_` is `Uint8Array<ArrayBuffer>`, while the Workers
 * lib types TextEncoder and Uint8Array.from as `ArrayBufferLike` — which
 * admits SharedArrayBuffer and so will not assign. Copying into a buffer we
 * allocated is the honest way to say "not shared".
 */
function bytes(source: Uint8Array | string): Uint8Array<ArrayBuffer> {
  const src =
    typeof source === 'string' ? new TextEncoder().encode(source) : source
  const out = new Uint8Array(new ArrayBuffer(src.length))
  out.set(src)
  return out
}

/** base64url, for the COSE public key bytes on their way into a TEXT column. */
function b64url(source: Uint8Array): string {
  let bin = ''
  for (const b of source) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromB64url(text: string): Uint8Array<ArrayBuffer> {
  const pad = text.length % 4 === 0 ? '' : '='.repeat(4 - (text.length % 4))
  const bin = atob(text.replace(/-/g, '+').replace(/_/g, '/') + pad)
  return bytes(Uint8Array.from(bin, (c) => c.charCodeAt(0)))
}

/**
 * What this account is able to prove itself with, right now.
 *
 * Asked BEFORE demanding anything, because the answer decides what the client
 * can put on screen. A Google identity has no password; an account with no
 * enrolled authenticator has no code. Demanding a proof that cannot exist is
 * how a feature becomes a dead end with a field nobody can fill.
 */
async function acceptedProofs(env: Env, userId: string): Promise<string[]> {
  const [user, totp] = await Promise.all([
    env.DB.prepare('SELECT passwordHash FROM users WHERE id = ?')
      .bind(userId)
      .first<{ passwordHash: string | null }>(),
    env.DB.prepare(
      'SELECT userId FROM totpCredentials WHERE userId = ? AND confirmedAt IS NOT NULL',
    )
      .bind(userId)
      .first<{ userId: string }>(),
  ])
  const accepts: string[] = []
  if (totp !== null) accepts.push('code')
  if (user?.passwordHash) accepts.push('password')
  return accepts
}

/**
 * Is this session fresh enough to add a passkey on its own say-so?
 *
 * A session that just signed in has proved something within the last few
 * minutes. An old one has proved nothing recently, and adding a passkey from
 * it would let anyone who found an unlocked laptop mint a credential that
 * survives the owner's next password change.
 */
async function withinSudoWindow(
  env: Env,
  sessionId: string | undefined,
): Promise<boolean> {
  if (sessionId === undefined) return false
  const row = await env.DB.prepare(
    'SELECT createdAt FROM authSessions WHERE id = ?',
  )
    .bind(sessionId)
    .first<{ createdAt: string }>()
  if (row === null) return false
  const started = Date.parse(`${row.createdAt.replace(' ', 'T')}Z`)
  if (Number.isNaN(started)) return false
  return Date.now() - started < SUDO_WINDOW_MS
}

// ── Registration ─────────────────────────────────────────────────────

async function handleRegisterOptions(
  request: Request,
  env: Env,
  respond: Respond,
): Promise<Response> {
  const auth = await getAuth(request, env)
  if (auth === null) return respond({ error: 'Unauthorized' }, { status: 401 })

  const rl = await checkRateLimit(env.DB, `passkey:${auth.userId}`, 'passkey')
  if (!rl.allowed) return tooMany(respond, rl)

  const existing = await listPasskeys(env.DB, auth.userId)
  if (existing.length >= MAX_PASSKEYS_PER_USER) {
    return respond(
      {
        error: `You already have ${MAX_PASSKEYS_PER_USER} passkeys. Remove one first.`,
      },
      { status: 409 },
    )
  }

  // Sudo mode. A stale session may still add a passkey — it just has to prove
  // something fresh first. A second-factor code OR the account's own password:
  // most accounts have no second factor, and demanding one of those would make
  // this button permanently unusable for them.
  const body = await readBody(request)
  const proof = stringField(body, 'proof')
  if (!(await withinSudoWindow(env, auth.sessionId))) {
    const accepts = await acceptedProofs(env, auth.userId)
    // The cheap check first: a TOTP comparison is a hash, a password is 100k
    // PBKDF2 rounds, and a six-digit code is never a password worth trying.
    const ok =
      proof !== '' &&
      ((accepts.includes('code') &&
        (await verifySecondFactor(env, auth.userId, proof))) ||
        (accepts.includes('password') &&
          (await verifyAccountPassword(env, auth.userId, proof))))
    if (!ok) {
      return respond(
        {
          // An account with neither — a Google identity that has not enrolled
          // a second factor — genuinely cannot prove anything here. Saying so,
          // with an empty `accepts`, lets the client offer the one thing that
          // does work (sign in again) instead of an unfillable box.
          error:
            accepts.length === 0
              ? 'Sign in again before adding a passkey'
              : 'Confirm it is you before adding a passkey',
          reauth: true,
          accepts,
        },
        { status: 403 },
      )
    }
  }

  const user = await env.DB.prepare('SELECT email FROM users WHERE id = ?')
    .bind(auth.userId)
    .first<{ email: string | null }>()

  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID: rpIdFor(env) as string,
    userName: user?.email ?? auth.userId,
    userID: bytes(auth.userId),
    // Every credential the account already holds, so an authenticator that
    // already has one says "you have this already" instead of quietly making
    // a duplicate the owner then has to tell apart in the list.
    excludeCredentials: existing.map((row) => ({
      id: row.id,
      transports: transportsOf(row),
    })),
    authenticatorSelection: {
      // Discoverable, so the sign-in button works with nothing typed first.
      residentKey: 'required',
      // Not 'preferred'. This is what makes a passkey two factors rather than
      // one, and it is why passkey sign-in skips the TOTP challenge.
      userVerification: 'required',
    },
    attestationType: 'none',
  })

  const ceremony = await issueCeremony(env.JWT_SECRET as string, {
    purpose: 'webauthn-reg',
    userId: auth.userId,
    challenge: options.challenge,
  })
  return respond({ options, ceremony })
}

async function handleRegisterVerify(
  request: Request,
  env: Env,
  respond: Respond,
): Promise<Response> {
  const auth = await getAuth(request, env)
  if (auth === null) return respond({ error: 'Unauthorized' }, { status: 401 })

  const rl = await checkRateLimit(env.DB, `passkey:${auth.userId}`, 'passkey')
  if (!rl.allowed) return tooMany(respond, rl)

  const body = await readBody(request)
  const claims = await readCeremony(
    env.JWT_SECRET as string,
    stringField(body, 'ceremony'),
    'webauthn-reg',
  )
  // The ceremony must belong to the account presenting it: a token minted for
  // one session must not register a credential against another.
  if (claims === null || claims.userId !== auth.userId) {
    return respond({ error: 'That request has expired' }, { status: 400 })
  }

  let verification
  try {
    verification = await verifyRegistrationResponse({
      response: body.response as RegistrationResponseJSON,
      expectedChallenge: claims.challenge as string,
      expectedOrigin: expectedOrigins(request, env),
      expectedRPID: rpIdFor(env) as string,
      requireUserVerification: true,
    })
  } catch (err) {
    // A malformed attestation is the caller's problem, not a server fault.
    return respond(
      {
        error:
          err instanceof Error ? err.message : 'Could not add that passkey',
      },
      { status: 400 },
    )
  }
  if (!verification.verified) {
    return respond({ error: 'Could not add that passkey' }, { status: 400 })
  }

  const { credential, credentialBackedUp } = verification.registrationInfo
  const stored = await savePasskey(env.DB, {
    id: credential.id,
    userId: auth.userId,
    publicKey: b64url(credential.publicKey),
    counter: credential.counter,
    transports: credential.transports,
    deviceName: passkeyName(request.headers.get('user-agent')),
    backedUp: credentialBackedUp,
  })
  if (!stored) {
    // Browsers double-submit and the ceremony lives five minutes. "You already
    // have this one" is the honest answer, not a 500 with a UNIQUE error in it.
    return respond(
      { error: 'That passkey is already registered' },
      { status: 409 },
    )
  }

  const rows = await listPasskeys(env.DB, auth.userId)
  return respond({ passkeys: rows.map(passkeySummary) })
}

// ── Signing in ───────────────────────────────────────────────────────

async function handleLoginOptions(
  request: Request,
  env: Env,
  respond: Respond,
): Promise<Response> {
  // A roomier bucket than verify, deliberately: conditional UI fires one of
  // these per sign-in screen load, so a school or an office behind one address
  // burns them without anybody having clicked anything.
  const ip = request.headers.get('CF-Connecting-IP') ?? '127.0.0.1'
  const rl = await checkRateLimit(env.DB, ip, 'passkey-options')
  if (!rl.allowed) return tooMany(respond, rl)

  const options = await generateAuthenticationOptions({
    rpID: rpIdFor(env) as string,
    // No allowCredentials: the credentials are discoverable, so the
    // authenticator offers what it has. Naming credentials here would require
    // knowing who is signing in, which is exactly what this avoids.
    userVerification: 'required',
  })
  const ceremony = await issueCeremony(env.JWT_SECRET as string, {
    purpose: 'webauthn-auth',
    challenge: options.challenge,
  })
  return respond({ options, ceremony })
}

async function handleLoginVerify(
  request: Request,
  env: Env,
  respond: Respond,
): Promise<Response> {
  const ip = request.headers.get('CF-Connecting-IP') ?? '127.0.0.1'
  const rl = await checkRateLimit(env.DB, ip, 'passkey-verify')
  if (!rl.allowed) return tooMany(respond, rl)

  const dead = { error: 'That passkey was not accepted' }
  const body = await readBody(request)
  const claims = await readCeremony(
    env.JWT_SECRET as string,
    stringField(body, 'ceremony'),
    'webauthn-auth',
  )
  if (claims === null) return respond(dead, { status: 401 })

  const response = body.response as AuthenticationResponseJSON | undefined
  if (response?.id === undefined) return respond(dead, { status: 401 })

  const row = await findPasskey(env.DB, response.id)
  if (row === null) return respond(dead, { status: 401 })

  let verification
  try {
    verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge: claims.challenge as string,
      expectedOrigin: expectedOrigins(request, env),
      expectedRPID: rpIdFor(env) as string,
      credential: {
        id: row.id,
        publicKey: fromB64url(row.publicKey),
        counter: row.counter,
        transports: transportsOf(row),
      },
      requireUserVerification: true,
    })
  } catch {
    return respond(dead, { status: 401 })
  }
  if (!verification.verified) return respond(dead, { status: 401 })

  await touchPasskey(env.DB, row, verification.authenticationInfo.newCounter)

  // No 2FA fork here, and that is the point: a user-verified passkey already
  // carries both factors. See the note at the top of this file.
  return issueSessionFor(
    env,
    row.userId,
    'passkey',
    respond,
    sessionOrigin(request),
  )
}

// ── Managing them ────────────────────────────────────────────────────

async function handleList(
  request: Request,
  env: Env,
  respond: Respond,
): Promise<Response> {
  const auth = await getAuth(request, env)
  if (auth === null) return respond({ error: 'Unauthorized' }, { status: 401 })
  const rows = await listPasskeys(env.DB, auth.userId)
  return respond({ passkeys: rows.map(passkeySummary) })
}

async function handleDelete(
  request: Request,
  env: Env,
  respond: Respond,
): Promise<Response> {
  const auth = await getAuth(request, env)
  if (auth === null) return respond({ error: 'Unauthorized' }, { status: 401 })

  const rl = await checkRateLimit(env.DB, `passkey:${auth.userId}`, 'passkey')
  if (!rl.allowed) return tooMany(respond, rl)

  const body = await readBody(request)
  const id = stringField(body, 'id')
  if (id === '')
    return respond({ error: 'Passkey id required' }, { status: 400 })
  // Scoped by userId in the DELETE itself, so knowing somebody else's
  // credential id buys nothing.
  if (!(await deletePasskey(env.DB, auth.userId, id))) {
    return respond({ error: 'No such passkey' }, { status: 404 })
  }
  const rows = await listPasskeys(env.DB, auth.userId)
  return respond({ passkeys: rows.map(passkeySummary) })
}

/**
 * Dispatch. Returns null for a path this file does not own, so index.ts can
 * fall through to the rest of the auth surface.
 */
export async function handlePasskeyRoute(
  request: Request,
  env: Env,
  pathname: string,
  respond: Respond,
): Promise<Response | null> {
  if (!pathname.startsWith('/api/auth/passkey/')) return null
  const route = pathname.slice('/api/auth/passkey/'.length)

  if (route === 'status') {
    // Answered even where passkeys are off, because "off" is exactly what the
    // client needs to know in order to hide the button.
    return respond({ available: passkeysConfigured(env) })
  }
  if (!passkeysConfigured(env)) return notConfigured(respond)
  if (request.method === 'GET' && route === 'list') {
    return handleList(request, env, respond)
  }
  if (request.method !== 'POST') {
    return respond({ error: 'Method not allowed' }, { status: 405 })
  }

  switch (route) {
    case 'register/options':
      return handleRegisterOptions(request, env, respond)
    case 'register/verify':
      return handleRegisterVerify(request, env, respond)
    case 'login/options':
      return handleLoginOptions(request, env, respond)
    case 'login/verify':
      return handleLoginVerify(request, env, respond)
    case 'delete':
      return handleDelete(request, env, respond)
    default:
      return respond({ error: 'Not found' }, { status: 404 })
  }
}
