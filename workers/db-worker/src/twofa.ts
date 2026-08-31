// ── 2FA storage: TOTP secrets encrypted at rest, single-use recovery codes ──
//
// The at-rest key is HKDF-derived from the TOTP_KEK secret, not from
// JWT_SECRET. Deriving it from JWT_SECRET needs no ops work, and costs this:
// rotating JWT_SECRET would silently orphan every TOTP secret in the table.
// See migration 0039, and the same instruction already written on
// BACKGROUND_CAPABILITY_SECRET in wrangler.jsonc.
//
// With TOTP_KEK unset, nothing here throws — `twofaConfigured` is false, the
// routes answer 503 and say why, and the rest of the worker does not notice.

import { base32Encode } from './totp'

export interface TwofaEnv {
  DB: D1Database
  /**
   * AES-256-GCM key-encryption key for TOTP secrets. Per environment:
   * `wrangler secret put TOTP_KEK --env dev|prod`. Values live in the Proton
   * Pass `dev` vault as MP_TOTP_KEK_DEV / MP_TOTP_KEK_PROD.
   */
  TOTP_KEK?: string
}

const HKDF_INFO = 'mercurypitch totp-secret v1'

/** Whether 2FA can operate in this environment at all. */
export function twofaConfigured(env: TwofaEnv): boolean {
  return env.TOTP_KEK !== undefined && env.TOTP_KEK !== ''
}

async function totpKek(kek: string): Promise<CryptoKey> {
  const ikm = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(kek),
    'HKDF',
    false,
    ['deriveKey'],
  )
  return crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: new Uint8Array(0),
      info: new TextEncoder().encode(HKDF_INFO),
    },
    ikm,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

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

/** `b64url(iv).b64url(ciphertext)` — a fresh IV every call, mandatory for GCM. */
export async function encryptTotpSecret(
  secretB32: string,
  kek: string,
): Promise<string> {
  const key = await totpKek(kek)
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as unknown as BufferSource },
    key,
    new TextEncoder().encode(secretB32),
  )
  return `${b64urlEncode(iv)}.${b64urlEncode(ct)}`
}

/** Null on any failure — a wrong key must read the same as a corrupt row. */
export async function decryptTotpSecret(
  stored: string,
  kek: string,
): Promise<string | null> {
  try {
    const [ivPart, ctPart] = stored.split('.')
    if (ivPart === undefined || ctPart === undefined) return null
    const key = await totpKek(kek)
    const pt = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: b64urlDecode(ivPart) as unknown as BufferSource },
      key,
      b64urlDecode(ctPart) as unknown as BufferSource,
    )
    return new TextDecoder().decode(pt)
  } catch {
    return null
  }
}

// ── Recovery codes ───────────────────────────────────────────────────

/** Ten codes shaped XXXXX-XXXXX from the base32 alphabet, ~50 bits each. */
export function generateRecoveryCodes(): string[] {
  const codes: string[] = []
  for (let i = 0; i < 10; i++) {
    const raw = base32Encode(crypto.getRandomValues(new Uint8Array(10))).slice(
      0,
      10,
    )
    codes.push(`${raw.slice(0, 5)}-${raw.slice(5)}`)
  }
  return codes
}

/** People retype these off paper: case and separators must not matter. */
function normalizeRecoveryCode(code: string): string {
  return code.toUpperCase().replace(/[\s-]/g, '')
}

async function sha256Hex(s: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(s),
  )
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/** Replaces any previous batch — an old sheet stops working the moment new
 *  codes exist, which is the only behaviour someone regenerating them expects. */
export async function storeRecoveryCodes(
  env: TwofaEnv,
  userId: string,
  codes: string[],
): Promise<void> {
  const hashes = await Promise.all(
    codes.map(async (c) => sha256Hex(normalizeRecoveryCode(c))),
  )
  await env.DB.batch([
    env.DB.prepare('DELETE FROM recoveryCodes WHERE userId = ?').bind(userId),
    ...hashes.map((h) =>
      env.DB.prepare(
        'INSERT INTO recoveryCodes (userId, codeHash) VALUES (?, ?)',
      ).bind(userId, h),
    ),
  ])
}

/** True exactly once per code: the UPDATE claims it atomically. */
export async function consumeRecoveryCode(
  env: TwofaEnv,
  userId: string,
  code: string,
): Promise<boolean> {
  const hash = await sha256Hex(normalizeRecoveryCode(code))
  const res = await env.DB.prepare(
    `UPDATE recoveryCodes SET usedAt = datetime('now')
      WHERE userId = ? AND codeHash = ? AND usedAt IS NULL`,
  )
    .bind(userId, hash)
    .run()
  return (res.meta.changes ?? 0) > 0
}

// ── Enrollment ───────────────────────────────────────────────────────

export async function enrollTotp(
  env: TwofaEnv,
  userId: string,
  secretB32: string,
): Promise<void> {
  if (!twofaConfigured(env)) throw new Error('TOTP_KEK not configured')
  const secretEnc = await encryptTotpSecret(secretB32, env.TOTP_KEK as string)
  // Replaces only a PENDING enrollment. A confirmed credential is never
  // silently overwritten — the route refuses setup while 2FA is on, and this
  // WHERE is what backs that refusal up at the data layer, where a second
  // request racing the first cannot get around it.
  await env.DB.prepare(
    `INSERT INTO totpCredentials (userId, secretEnc) VALUES (?, ?)
     ON CONFLICT(userId) DO UPDATE SET
       secretEnc = excluded.secretEnc,
       lastUsedStep = NULL,
       createdAt = datetime('now')
     WHERE totpCredentials.confirmedAt IS NULL`,
  )
    .bind(userId, secretEnc)
    .run()
}

export async function confirmTotp(
  env: TwofaEnv,
  userId: string,
): Promise<void> {
  await env.DB.prepare(
    `UPDATE totpCredentials SET confirmedAt = datetime('now') WHERE userId = ?`,
  )
    .bind(userId)
    .run()
}

export async function disableTotp(
  env: TwofaEnv,
  userId: string,
): Promise<void> {
  await env.DB.batch([
    env.DB.prepare('DELETE FROM totpCredentials WHERE userId = ?').bind(userId),
    env.DB.prepare('DELETE FROM recoveryCodes WHERE userId = ?').bind(userId),
  ])
}

export interface TotpStatus {
  enabled: boolean
  recoveryCodesLeft: number
}

export async function totpStatus(
  env: TwofaEnv,
  userId: string,
): Promise<TotpStatus> {
  const row = await env.DB.prepare(
    `SELECT (SELECT confirmedAt FROM totpCredentials WHERE userId = ?1)
              AS confirmedAt,
            (SELECT COUNT(*) FROM recoveryCodes
              WHERE userId = ?1 AND usedAt IS NULL) AS codesLeft`,
  )
    .bind(userId)
    .first<{ confirmedAt: string | null; codesLeft: number }>()
  return {
    enabled: row?.confirmedAt != null,
    recoveryCodesLeft: row?.codesLeft ?? 0,
  }
}

/** The pending (unconfirmed) secret — what /2fa/enable checks a code against. */
export async function getPendingTotpSecret(
  env: TwofaEnv,
  userId: string,
): Promise<string | null> {
  if (!twofaConfigured(env)) return null
  const row = await env.DB.prepare(
    'SELECT secretEnc FROM totpCredentials WHERE userId = ? AND confirmedAt IS NULL',
  )
    .bind(userId)
    .first<{ secretEnc: string }>()
  if (row === null) return null
  return decryptTotpSecret(row.secretEnc, env.TOTP_KEK as string)
}

export interface TotpLoginCredential {
  /** Decrypted base32 secret, or null when it could not be decrypted. */
  secret: string | null
  lastUsedStep: number | null
}

/**
 * The confirmed credential, for sign-in. Null only when there isn't one — a
 * pending enrollment never challenges anybody.
 *
 * Fails CLOSED when the secret cannot be decrypted (a rotated TOTP_KEK): the
 * account still demands a second factor, and the recovery codes — hashed, not
 * encrypted — still verify. Returning null there would quietly turn 2FA off
 * for everyone the moment a key changed.
 */
export async function getTotpForLogin(
  env: TwofaEnv,
  userId: string,
): Promise<TotpLoginCredential | null> {
  const row = await env.DB.prepare(
    `SELECT secretEnc, lastUsedStep FROM totpCredentials
      WHERE userId = ? AND confirmedAt IS NOT NULL`,
  )
    .bind(userId)
    .first<{ secretEnc: string; lastUsedStep: number | null }>()
  if (row === null) return null
  const secret = twofaConfigured(env)
    ? await decryptTotpSecret(row.secretEnc, env.TOTP_KEK as string)
    : null
  return { secret, lastUsedStep: row.lastUsedStep }
}

/** Move the anti-replay high-water mark. MAX so an out-of-order write cannot
 *  lower it and re-admit a spent code. */
export async function markTotpStepUsed(
  env: TwofaEnv,
  userId: string,
  step: number,
): Promise<void> {
  await env.DB.prepare(
    `UPDATE totpCredentials
        SET lastUsedStep = MAX(COALESCE(lastUsedStep, -1), ?)
      WHERE userId = ?`,
  )
    .bind(step, userId)
    .run()
}
