// ── /api/auth/apple — Sign in with Apple, and Apple's own notifications ──
//
// Two routes:
//
//   POST /api/auth/apple                — an identity token from the native
//                                         shell, answered exactly like
//                                         /api/auth/google (a session, or the
//                                         2FA challenge).
//   POST /api/auth/apple/notifications  — Apple telling us an account was
//                                         deleted, consent withdrawn, or the
//                                         relay address turned on or off.
//
// Dispatched from index.ts rather than from handleAuth, so the import runs one
// way: this file imports auth.ts, never the reverse (the same arrangement
// twofa-routes.ts and passkey-routes.ts use).
//
// The notifications route is the odd one in this codebase: it is called by
// Apple's servers, not by a browser, so it carries no Origin header and no
// CAPTCHA token. Both gates are therefore explicitly not applied to it — see
// the origin exemption in index.ts and the note on Turnstile below. What
// stands in front of it instead is the signature on the payload itself.

import type { Env } from './auth'
import { appleClientIds, appleSigninSecrets, exchangeAppleAuthorizationCode, parseAppleServerEvent, revokeAndForgetAppleGrant, storeAppleRefreshToken, verifyAppleIdentityToken, verifyAppleJwt, } from './apple-auth'
import { checkRateLimit, claimedDevice, issueSessionFor, resolveFederatedUser, sessionOrigin, twofaChallenge, } from './auth'

type Respond = (body: object | null, init?: ResponseInit) => Response

const SIGN_IN_PATH = '/api/auth/apple'

/**
 * Registered on the App ID as the server-to-server endpoint, so the value is
 * published outside this repo and cannot be renamed casually. Exported for
 * index.ts, which exempts exactly this path from the browser-origin gate.
 */
export const APPLE_NOTIFICATIONS_PATH = '/api/auth/apple/notifications'

/** Apple's own name for "we could not verify that token". */
const INVALID_TOKEN = { error: 'invalid_token' }

function tooMany(respond: Respond, rl: { retryAfter?: number }): Response {
  const after = rl.retryAfter ?? 60
  return respond(
    { error: `Too many requests. Retry after ${after} seconds.` },
    { status: 429, headers: { 'Retry-After': String(after) } },
  )
}

async function readBody(request: Request): Promise<Record<string, unknown>> {
  try {
    return (await request.json()) as Record<string, unknown>
  } catch {
    return {}
  }
}

function stringField(
  body: Record<string, unknown>,
  key: string,
): string | undefined {
  const value = body[key]
  return typeof value === 'string' && value !== '' ? value : undefined
}

/**
 * The display name Apple hands over exactly once — in the BODY, at the first
 * authorization, never in the identity token and never again. Missing it on
 * the first sign-in means the account keeps its Singer-xxxx default forever.
 */
function displayNameFromBody(body: Record<string, unknown>): string | null {
  const user = body.user
  if (typeof user !== 'object' || user === null) return null
  const name = (user as { name?: unknown }).name
  if (typeof name !== 'object' || name === null) return null
  const parts = ['firstName', 'lastName']
    .map((key) => (name as Record<string, unknown>)[key])
    .filter((part): part is string => typeof part === 'string')
    .map((part) => part.trim())
    .filter((part) => part !== '')
  return parts.length === 0 ? null : parts.join(' ')
}

/** Route the two Apple endpoints. Returns null when the path is not ours. */
export async function handleAppleRoute(
  request: Request,
  env: Env,
  pathname: string,
  respond: Respond,
): Promise<Response | null> {
  if (pathname !== SIGN_IN_PATH && pathname !== APPLE_NOTIFICATIONS_PATH) {
    return null
  }
  if (request.method !== 'POST') {
    return respond({ error: 'Method not allowed' }, { status: 405 })
  }
  if (!env.JWT_SECRET) {
    return respond({ error: 'JWT_SECRET not configured' }, { status: 500 })
  }

  const ip = request.headers.get('CF-Connecting-IP') ?? '127.0.0.1'
  const bucket = pathname === SIGN_IN_PATH ? 'apple' : 'apple/notifications'
  const rl = await checkRateLimit(env.DB, ip, bucket)
  if (!rl.allowed) return tooMany(respond, rl)

  // No verifyTurnstile call on either route, deliberately. A native shell
  // renders no widget, and Apple's notification service certainly does not —
  // the identity token's signature is the proof on one, and the payload's
  // signature on the other.
  return pathname === SIGN_IN_PATH
    ? handleAppleSignIn(request, env, respond)
    : handleAppleNotifications(request, env, respond)
}

async function handleAppleSignIn(
  request: Request,
  env: Env,
  respond: Respond,
): Promise<Response> {
  const clientIds = appleClientIds(env)
  if (clientIds.length === 0) {
    return respond({ error: 'Apple login not configured' }, { status: 501 })
  }

  const body = await readBody(request)
  const identityToken = stringField(body, 'identityToken')
  if (identityToken === undefined) {
    return respond({ error: 'identityToken required' }, { status: 400 })
  }
  const identity = await verifyAppleIdentityToken(
    identityToken,
    clientIds,
    stringField(body, 'nonce'),
  )
  if (identity === null) return respond(INVALID_TOKEN, { status: 401 })

  const deviceId = await claimedDevice(
    env,
    stringField(body, 'deviceId'),
    stringField(body, 'deviceSecret'),
  )
  const { row, isNew } = await resolveFederatedUser(
    {
      provider: 'apple',
      sub: identity.sub,
      // Only the signed token's address is used. `user.email` in the body is
      // whatever the caller typed there — trusting it would let a valid token
      // claim somebody else's address, and `users.email` is UNIQUE.
      email: identity.email,
      emailVerified: identity.emailVerified,
      // A private-relay address is minted per app and per Apple ID. It proves
      // nothing about who owns a mailbox somebody signed up with, so it must
      // never adopt an existing account.
      linkableByEmail: !identity.isPrivateEmail,
      name: displayNameFromBody(body),
    },
    deviceId,
    env,
  )

  // The authorization code is single-use and dies with the request, so the
  // exchange happens here or never. It is a courtesy to the deletion path,
  // not part of signing in: a failure is logged and dropped.
  const authorizationCode = stringField(body, 'authorizationCode')
  const secrets = appleSigninSecrets(env)
  if (authorizationCode !== undefined && secrets !== null) {
    const refreshToken = await exchangeAppleAuthorizationCode(
      secrets,
      identity.aud,
      authorizationCode,
    )
    if (refreshToken !== null) {
      try {
        await storeAppleRefreshToken(env, row.id, identity.aud, refreshToken)
      } catch (error) {
        console.warn('[apple] could not store the grant:', String(error))
      }
    }
  }

  // An Apple identity is one factor, exactly like a password or a Google one.
  const challenge = await twofaChallenge(env, row.id, 'apple')
  if (challenge !== null) return respond(challenge)
  return issueSessionFor(
    env,
    row.id,
    'apple',
    respond,
    sessionOrigin(request),
    isNew,
  )
}

interface AppleProviderRow {
  id: string
  email: string | null
}

/**
 * Apple's server-to-server notifications.
 *
 * Answered 200 for every event we can verify and parse, including types this
 * version has never heard of — a non-2xx makes Apple retry, and retrying a
 * notification nobody will ever act on helps neither side.
 */
async function handleAppleNotifications(
  request: Request,
  env: Env,
  respond: Respond,
): Promise<Response> {
  const clientIds = appleClientIds(env)
  if (clientIds.length === 0) {
    return respond({ error: 'Apple login not configured' }, { status: 501 })
  }

  const body = await readBody(request)
  const payload = stringField(body, 'payload')
  if (payload === undefined) {
    return respond({ error: 'payload required' }, { status: 400 })
  }
  const claims = await verifyAppleJwt(payload, clientIds)
  if (claims === null) return respond(INVALID_TOKEN, { status: 401 })
  const event = parseAppleServerEvent(claims)
  if (event === null) {
    return respond({ error: 'invalid_payload' }, { status: 400 })
  }

  // No `authProvider = 'apple'` filter here, and that is deliberate. An
  // account that adopted this Apple identity through the verified-email link
  // keeps its ORIGINAL authProvider — 'password', 'google' — with the Apple
  // `sub` in providerId, so the filtered lookup would walk straight past it
  // and a singer who withdrew consent would keep every live session.
  //
  // Widening is safe on THIS route and nowhere else: `event.sub` arrives
  // inside a payload Apple signed, checked against our own client id, so a
  // caller cannot name a subject at all — only Apple can, and only one it
  // issued to us. What a match buys is a sign-out and a dropped grant. The
  // sign-in path keeps the tightened (authProvider, providerId) pair, where
  // the same widening would hand over the account itself.
  const row = await env.DB.prepare(
    'SELECT id, email FROM users WHERE providerId = ?',
  )
    .bind(event.sub)
    .first<AppleProviderRow>()
  if (row === null) {
    // Nothing to act on: the identity was never linked here, or the account
    // has already been deleted. Still a success — Apple told us something
    // true and there is no work left.
    console.info(`[apple] notification ${event.type} named no local account`)
    return respond({ ok: true })
  }

  switch (event.type) {
    case 'consent-revoked':
    case 'account-delete': {
      // Drop the grant and sign every device out — and KEEP providerId.
      //
      // Apple's `sub` is stable across re-authorisation: the same person
      // coming back finds this same row, with their practice history on it.
      // Clearing it strands the account instead — an authProvider 'apple'
      // row with no password and no id to match leaves no sign-in method at
      // all, and the return visit (very likely under a private-relay
      // address, which never adopts an existing account) mints a brand-new
      // one beside the orphan.
      //
      // Erasing data is what in-app account deletion is for; this webhook
      // is not that request. Bumping tokenVersion ends every token the
      // account holds, which is the sign-out the event does imply.
      try {
        await revokeAndForgetAppleGrant(env, row.id)
      } catch (error) {
        console.warn('[apple] could not release the grant:', String(error))
      }
      await env.DB.prepare(
        `UPDATE users SET tokenVersion = tokenVersion + 1, updatedAt = ? WHERE id = ?`,
      )
        .bind(new Date().toISOString(), row.id)
        .run()
      console.info(
        `[apple] ${event.type}: dropped the grant and signed ${row.id} out`,
      )
      break
    }
    case 'email-disabled':
    case 'email-enabled': {
      // The relay address stops or starts forwarding. Nothing about the
      // account changes except whether mail sent to it will arrive, which is
      // exactly what emailVerified gates elsewhere in this worker.
      //
      // Only when Apple names the address this account actually uses. The
      // lookup above no longer filters by provider, so `row` can be an
      // account that adopted the identity under its OWN verified address —
      // and writing a relay over that would move its password reset to a
      // mailbox Apple can switch off.
      const named = event.email?.toLowerCase() ?? null
      const current = row.email?.toLowerCase() ?? null
      if (named !== null && current !== null && named !== current) {
        console.info(
          `[apple] ${event.type} named an address ${row.id} does not use`,
        )
        break
      }
      const verified = event.type === 'email-enabled' ? 1 : 0
      try {
        await env.DB.prepare(
          'UPDATE users SET email = ?, emailVerified = ?, updatedAt = ? WHERE id = ?',
        )
          .bind(named ?? row.email, verified, new Date().toISOString(), row.id)
          .run()
        console.info(`[apple] ${event.type} applied to ${row.id}`)
      } catch (error) {
        // `users.email` is UNIQUE, so a relay address already held by another
        // account rejects the write. Logged and dropped: answering non-2xx
        // would only make Apple redeliver a notification that can never land.
        console.warn(
          `[apple] ${event.type} could not be applied:`,
          String(error),
        )
      }
      break
    }
    default:
      console.info(`[apple] ignoring unknown notification type ${event.type}`)
  }

  return respond({ ok: true })
}
