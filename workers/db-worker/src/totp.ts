// ── TOTP (RFC 6238) over WebCrypto, plus the base32 codec ────────────
//
// SHA-1 / 6 digits / 30 seconds is not a preference — it is what Google
// Authenticator, Aegis, 1Password and the rest assume when they scan an
// otpauth:// URI, and an authenticator that guesses differently produces codes
// that never match. RFC 6238's HMAC construction is not affected by the SHA-1
// collision attacks, so this is the right default rather than a legacy one.
//
// Pure: no database, no env, no clock beyond what the caller passes in. That
// is what lets the published RFC test vectors be run against it directly.

const B32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

export function base32Encode(bytes: Uint8Array): string {
  let out = ''
  let bits = 0
  let value = 0
  for (const byte of bytes) {
    value = (value << 8) | byte
    bits += 8
    while (bits >= 5) {
      out += B32_ALPHABET[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }
  if (bits > 0) out += B32_ALPHABET[(value << (5 - bits)) & 31]
  return out
}

/** Tolerates what people paste: lowercase, spaces, trailing `=` padding. */
export function base32Decode(s: string): Uint8Array {
  const clean = s.toUpperCase().replace(/[\s=]/g, '')
  let bits = 0
  let value = 0
  const out: number[] = []
  for (const ch of clean) {
    const idx = B32_ALPHABET.indexOf(ch)
    if (idx === -1) throw new Error(`Invalid base32 character: ${ch}`)
    value = (value << 5) | idx
    bits += 5
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff)
      bits -= 8
    }
  }
  return new Uint8Array(out)
}

export const TOTP_PERIOD_SECONDS = 30
export const TOTP_DIGITS = 6

/** 20 random bytes (RFC 4226 asks for at least 16) as 32 base32 characters. */
export function generateTotpSecret(): string {
  const bytes = new Uint8Array(20)
  crypto.getRandomValues(bytes)
  return base32Encode(bytes)
}

export function currentStep(
  nowMs = Date.now(),
  periodSeconds = TOTP_PERIOD_SECONDS,
): number {
  return Math.floor(nowMs / 1000 / periodSeconds)
}

/** HOTP (RFC 4226) at a counter — TOTP is HOTP whose counter is the time step. */
export async function totpCode(
  secretB32: string,
  step: number,
  digits = TOTP_DIGITS,
): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    base32Decode(secretB32) as unknown as BufferSource,
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign'],
  )
  // Eight-byte big-endian counter. Steps stay far below 2^53, so two 32-bit
  // writes are enough and avoid dragging BigInt in.
  const counter = new ArrayBuffer(8)
  const view = new DataView(counter)
  view.setUint32(0, Math.floor(step / 2 ** 32))
  view.setUint32(4, step >>> 0)
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, counter))
  const offset = (mac[mac.length - 1] as number) & 0x0f
  const bin =
    (((mac[offset] as number) & 0x7f) << 24) |
    ((mac[offset + 1] as number) << 16) |
    ((mac[offset + 2] as number) << 8) |
    (mac[offset + 3] as number)
  return String(bin % 10 ** digits).padStart(digits, '0')
}

/** No early exit: a leaked mismatch position must not narrow the guess space. */
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

export interface VerifyTotpOptions {
  nowMs?: number
  /** Accepted clock drift in steps either side. 1 is the RFC's suggestion. */
  drift?: number
  /**
   * Lowest step still accepted. Pass `lastUsedStep + 1` to make each code
   * single-use: shoulder-surfing a code that was just typed then buys nothing,
   * even inside the thirty seconds it is otherwise valid for.
   */
  minStep?: number
}

/**
 * Returns the step that matched — so the caller can store it for anti-replay —
 * or null. Every candidate in the window is evaluated with no early exit, to
 * keep the time taken independent of which one matched.
 */
export async function verifyTotp(
  secretB32: string,
  code: string,
  opts: VerifyTotpOptions = {},
): Promise<number | null> {
  if (!/^\d{6}$/.test(code)) return null
  const drift = opts.drift ?? 1
  const now = currentStep(opts.nowMs ?? Date.now())
  let matched: number | null = null
  for (let step = now - drift; step <= now + drift; step++) {
    if (step < 0) continue
    if (opts.minStep !== undefined && step < opts.minStep) continue
    const candidate = await totpCode(secretB32, step)
    if (constantTimeEqual(candidate, code) && matched === null) matched = step
  }
  return matched
}

/** The QR payload authenticator apps scan. Label convention: `issuer:account`. */
export function otpauthUri(
  secretB32: string,
  account: string,
  issuer: string,
): string {
  const label = `${encodeURIComponent(issuer)}:${encodeURIComponent(account)}`
  return (
    `otpauth://totp/${label}?secret=${secretB32}` +
    `&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=${TOTP_DIGITS}` +
    `&period=${TOTP_PERIOD_SECONDS}`
  )
}
