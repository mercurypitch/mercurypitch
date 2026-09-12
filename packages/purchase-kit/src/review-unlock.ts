// ============================================================
// Review unlock — one fixed code that opens the paid tier for a store reviewer
// ============================================================
//
// App review is the one audience that cannot buy. Apple's reviewers can, in the
// sandbox, but Google's cannot: they may not create accounts, use their own, or
// take a trial, and they cannot ask us for anything. An app with no login has
// nothing to hand them, so the paid tier would go unreviewed.
//
// The answer is a code typed into settings that turns the tier on for that
// install. Google's constraints decide the design: it must be reusable, never
// expire, need no network and work in any country, so the check is a digest
// comparison against a value compiled into the build.
//
// What this is not: a way to buy anything. No code can be purchased, nothing is
// sold outside the store, and a grant made here is never written back to the
// purchase provider -- it cannot be mistaken for a sale, and it never reaches
// revenue figures. Revocation is a release: ship a different digest and every
// grant made against the old one stops validating.

/** Where a grant is kept between launches. Injected so tests stay in memory. */
export interface ReviewUnlockStorage {
  readonly read: () => string | null
  readonly write: (value: string) => void
  readonly remove: () => void
}

export interface ReviewUnlockGrant {
  /** Digest the code produced, so a build with a new digest invalidates it. */
  readonly digest: string
  readonly grantedAt: Date
}

export type ReviewUnlockOutcome =
  /** The code matched. The grant is stored and returned. */
  | 'unlocked'
  /** A code was typed and did not match. Nothing changed. */
  | 'rejected'
  /** This build cannot check codes: no digest compiled in, or no hashing. */
  | 'unavailable'

export interface ReviewUnlockResult {
  readonly outcome: ReviewUnlockOutcome
  readonly grant?: ReviewUnlockGrant
}

export interface ReviewUnlockOptions {
  /** Namespaces the digest, so one app's code cannot open another's tier. */
  readonly appId: string
  /** Lower-case hex SHA-256 of `<appId>:<normalised code>`, or undefined. */
  readonly expectedDigest?: string | undefined
  readonly storage: ReviewUnlockStorage
  /** Returns lower-case hex SHA-256 of the given text. */
  readonly digest: (input: string) => Promise<string>
  readonly now?: () => Date
}

export interface ReviewUnlock {
  /** False when this build shipped without a digest; then nothing unlocks. */
  readonly configured: boolean
  /** The stored grant, or undefined. Clears storage when it no longer validates. */
  readonly restore: () => ReviewUnlockGrant | undefined
  readonly redeem: (input: string) => Promise<ReviewUnlockResult>
  readonly revoke: () => void
}

const DIGEST_PATTERN = /^[0-9a-f]{64}$/u

/**
 * The alphabet codes are issued from: Crockford base32, which has no I, L, O
 * or U. Every character in it survives `normalizeReviewCode` unchanged, so a
 * printed code and its normalised form differ only by the dashes.
 */
export const REVIEW_CODE_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
const AMBIGUOUS = new Map([
  ['O', '0'],
  ['I', '1'],
  ['L', '1'],
])

/**
 * Makes typing forgiving without making two different codes collide: case and
 * separators are dropped, and the three glyph pairs a person reads wrong on a
 * phone screen fold onto the digit. Codes are therefore issued from an alphabet
 * that has no O, I or L.
 */
export function normalizeReviewCode(input: string): string {
  const bare = input.toUpperCase().replace(/[^A-Z0-9]/gu, '')
  let out = ''
  for (const character of bare) out += AMBIGUOUS.get(character) ?? character
  return out.slice(0, 64)
}

/** The exact text hashed on both sides: when issuing a code, and when checking one. */
export function reviewUnlockDigestInput(appId: string, code: string): string {
  return `${appId}:${normalizeReviewCode(code)}`
}

/** A digest value is usable only as 64 lower-case hex characters. */
export function isReviewUnlockDigest(value: string | undefined): boolean {
  return value !== undefined && DIGEST_PATTERN.test(value)
}

interface StoredGrant {
  readonly v: 1
  readonly digest: string
  readonly grantedAt: string
}

export function serializeReviewGrant(grant: ReviewUnlockGrant): string {
  const stored: StoredGrant = {
    v: 1,
    digest: grant.digest,
    grantedAt: grant.grantedAt.toISOString(),
  }
  return JSON.stringify(stored)
}

/**
 * Reads a stored grant, and returns one only when it still belongs to this
 * build. A grant whose digest is not the digest this binary expects is a grant
 * from a revoked code, which is how revocation works without a server.
 */
export function readReviewGrant(
  raw: string | null,
  expectedDigest: string | undefined,
): ReviewUnlockGrant | undefined {
  if (raw === null || !isReviewUnlockDigest(expectedDigest)) return undefined
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return undefined
  }
  if (typeof parsed !== 'object' || parsed === null) return undefined
  const record = parsed as Partial<StoredGrant>
  if (record.v !== 1) return undefined
  if (typeof record.digest !== 'string' || record.digest !== expectedDigest) {
    return undefined
  }
  if (typeof record.grantedAt !== 'string') return undefined
  const grantedAt = new Date(record.grantedAt)
  if (Number.isNaN(grantedAt.getTime())) return undefined
  return { digest: record.digest, grantedAt }
}

export function createReviewUnlock(options: ReviewUnlockOptions): ReviewUnlock {
  const expected = isReviewUnlockDigest(options.expectedDigest)
    ? options.expectedDigest
    : undefined
  const clock = options.now ?? (() => new Date())

  function restore(): ReviewUnlockGrant | undefined {
    if (expected === undefined) return undefined
    let raw: string | null = null
    try {
      raw = options.storage.read()
    } catch {
      return undefined
    }
    if (raw === null) return undefined
    const grant = readReviewGrant(raw, expected)
    if (grant === undefined) {
      // A grant that no longer validates is rubbish, not a lock to keep.
      try {
        options.storage.remove()
      } catch {
        // Storage that refuses to forget is not worth failing the launch over.
      }
      return undefined
    }
    return grant
  }

  async function redeem(input: string): Promise<ReviewUnlockResult> {
    if (expected === undefined) return { outcome: 'unavailable' }
    const code = normalizeReviewCode(input)
    if (code === '') return { outcome: 'rejected' }
    let digest: string
    try {
      digest = await options.digest(
        reviewUnlockDigestInput(options.appId, code),
      )
    } catch {
      return { outcome: 'unavailable' }
    }
    if (digest.toLowerCase() !== expected) return { outcome: 'rejected' }
    const grant: ReviewUnlockGrant = { digest: expected, grantedAt: clock() }
    try {
      options.storage.write(serializeReviewGrant(grant))
    } catch {
      // The tier still opens for this session; only the memory of it is lost.
    }
    return { outcome: 'unlocked', grant }
  }

  function revoke(): void {
    try {
      options.storage.remove()
    } catch {
      // Nothing else to do; the caller drops the grant either way.
    }
  }

  return { configured: expected !== undefined, restore, redeem, revoke }
}
