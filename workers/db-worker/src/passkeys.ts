// ── Passkeys: the rows, and the rules about them ─────────────────────
//
// Storage and policy for WebAuthn credentials. The ceremony itself lives in
// passkey-routes.ts; this file is what that one reads and writes, plus the two
// decisions that are easy to get wrong in a route handler and hard to notice
// afterwards: the relying-party identity, and what a backwards counter means.
//
// Only the PUBLIC key is ever here. There is nothing in this table that lets
// anyone sign in as anyone — which is the difference between a leaked passkey
// database and a leaked password database.

import type { AuthenticatorTransportFuture } from '@simplewebauthn/server'

/**
 * How many passkeys one account may hold.
 *
 * Not an arbitrary tidiness rule. Every stored credential goes into
 * `excludeCredentials` on the next registration, and authenticators have their
 * own limits on how long that list may be — so an unbounded table eventually
 * breaks the legitimate owner's own "add a passkey" button, in a way that
 * looks like a bug in the browser.
 */
export const MAX_PASSKEYS_PER_USER = 10

/**
 * How fresh a session must be to add a passkey without re-proving something.
 *
 * A passkey skips the TOTP challenge and survives a password reset, so adding
 * one is a stronger act than the session token alone attests to. Ten minutes
 * is GitHub's sudo-mode window: long enough that the post-sign-in nudge
 * ("add a passkey?") works without friction, short enough that a session left
 * open on a shared laptop is not a standing offer.
 */
export const SUDO_WINDOW_MS = 10 * 60 * 1000

export interface PasskeyRow {
  id: string
  userId: string
  publicKey: string
  counter: number
  transports: string | null
  deviceName: string | null
  backedUp: number
  createdAt: string
  lastUsedAt: string | null
}

/** What the settings pane shows. No key material, by construction. */
export interface PasskeySummary {
  id: string
  name: string
  backedUp: boolean
  createdAt: string
  lastUsedAt: string | null
}

export interface PasskeyEnv {
  DB: D1Database
  /** The domain a passkey is minted FOR. See rpIdFor. */
  PASSKEY_RP_ID?: string
  ALLOWED_ORIGINS?: string
}

/**
 * The relying-party id, or null when this environment cannot do passkeys.
 *
 * Deliberately NOT derived from the request URL. A passkey is bound to the
 * domain the person sees in their address bar; deriving it from the API host
 * would mint credentials for `api.mercurypitch.com` that every sign-in from
 * the app origin then fails against — silently, and only after somebody has
 * already replaced their password with one.
 *
 * So an unconfigured environment answers 503 rather than guessing. On
 * `*.workers.dev` PR previews there is no correct answer to guess: workers.dev
 * is on the Public Suffix List, so no RP id can be minted for it at all. That
 * is a property of WebAuthn, not a gap in this code.
 */
export function rpIdFor(env: PasskeyEnv): string | null {
  const configured = env.PASSKEY_RP_ID?.trim()
  return configured !== undefined && configured !== '' ? configured : null
}

/** Every origin the app is served from in this environment. */
export function allowedOrigins(env: PasskeyEnv): string[] {
  return (env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter((o) => o !== '')
}

export function passkeysConfigured(env: PasskeyEnv): boolean {
  return rpIdFor(env) !== null && allowedOrigins(env).length > 0
}

export async function listPasskeys(
  db: D1Database,
  userId: string,
): Promise<PasskeyRow[]> {
  const { results } = await db
    .prepare(
      'SELECT * FROM webauthnCredentials WHERE userId = ? ORDER BY createdAt DESC',
    )
    .bind(userId)
    .all<PasskeyRow>()
  return results
}

export function passkeySummary(row: PasskeyRow): PasskeySummary {
  return {
    id: row.id,
    name: row.deviceName ?? 'Passkey',
    backedUp: row.backedUp === 1,
    createdAt: row.createdAt,
    lastUsedAt: row.lastUsedAt,
  }
}

export async function findPasskey(
  db: D1Database,
  id: string,
): Promise<PasskeyRow | null> {
  return db
    .prepare('SELECT * FROM webauthnCredentials WHERE id = ?')
    .bind(id)
    .first<PasskeyRow>()
}

/**
 * Store a freshly registered credential.
 *
 * Returns false when the id is already known. Browsers double-submit, and the
 * ceremony lives five minutes: answering 409 is the honest reading of "you
 * already have this one", where letting D1's UNIQUE error escape would answer
 * 500 with a SQL string in it.
 */
export async function savePasskey(
  db: D1Database,
  row: {
    id: string
    userId: string
    publicKey: string
    counter: number
    transports: AuthenticatorTransportFuture[] | undefined
    deviceName: string | null
    backedUp: boolean
  },
): Promise<boolean> {
  if ((await findPasskey(db, row.id)) !== null) return false
  await db
    .prepare(
      `INSERT INTO webauthnCredentials
         (id, userId, publicKey, counter, transports, deviceName, backedUp, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
    )
    .bind(
      row.id,
      row.userId,
      row.publicKey,
      row.counter,
      row.transports === undefined ? null : JSON.stringify(row.transports),
      row.deviceName,
      row.backedUp ? 1 : 0,
    )
    .run()
  return true
}

/**
 * Record a use.
 *
 * A counter that did not advance is normal — plenty of authenticators, Apple's
 * included, report zero forever. A counter that went BACKWARDS is not: it means
 * two authenticators are answering for one credential, which is what a cloned
 * key looks like. It is logged distinctly because it is the only signal of that
 * there will ever be, and it must not read like an ordinary bad signature.
 */
export async function touchPasskey(
  db: D1Database,
  row: PasskeyRow,
  newCounter: number,
): Promise<void> {
  if (newCounter > 0 && newCounter < row.counter) {
    console.warn(
      `[passkeys] counter regression on credential ${row.id} for user ${row.userId}: stored ${row.counter}, presented ${newCounter} — possible cloned authenticator`,
    )
  }
  await db
    .prepare(
      `UPDATE webauthnCredentials
          SET counter = ?, lastUsedAt = datetime('now')
        WHERE id = ?`,
    )
    .bind(Math.max(newCounter, row.counter), row.id)
    .run()
}

export async function deletePasskey(
  db: D1Database,
  userId: string,
  id: string,
): Promise<boolean> {
  const result = await db
    .prepare('DELETE FROM webauthnCredentials WHERE id = ? AND userId = ?')
    .bind(id, userId)
    .run()
  return (result.meta.changes ?? 0) > 0
}

/** Stored transports, or undefined — the column holds JSON or nothing. */
export function transportsOf(
  row: PasskeyRow,
): AuthenticatorTransportFuture[] | undefined {
  if (row.transports === null) return undefined
  try {
    const parsed = JSON.parse(row.transports) as unknown
    return Array.isArray(parsed)
      ? (parsed as AuthenticatorTransportFuture[])
      : undefined
  } catch {
    return undefined
  }
}

/**
 * A name for the credential, from the User-Agent that registered it.
 *
 * The browser does not tell us what the authenticator is, and the person is
 * mid-ceremony, so asking them would be a second dialog on top of the system
 * one. "iPhone" beside a date is enough to answer the only question the list
 * has to answer: which of these do I not recognise?
 */
export function passkeyName(userAgent: string | null): string {
  if (userAgent === null || userAgent === '') return 'Passkey'
  const PLATFORMS: [RegExp, string][] = [
    [/iPhone/i, 'iPhone'],
    [/iPad/i, 'iPad'],
    [/Android/i, 'Android'],
    [/Mac OS X|Macintosh/i, 'Mac'],
    [/Windows/i, 'Windows'],
    [/CrOS/i, 'ChromeOS'],
    [/Linux/i, 'Linux'],
  ]
  for (const [pattern, label] of PLATFORMS) {
    if (pattern.test(userAgent)) return `Passkey on ${label}`
  }
  return 'Passkey'
}
