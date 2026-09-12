// ============================================================
// Review unlock — the code opens the tier, and only for this build
// ============================================================

import { createHash } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'
import { createReviewUnlock, normalizeReviewCode, readReviewGrant, REVIEW_CODE_ALPHABET, reviewUnlockDigestInput, serializeReviewGrant, } from './review-unlock.ts'

const APP_ID = 'beside-cue'
const CODE = 'REVIEW-7K4M-93XQ'

function sha256(input: string): Promise<string> {
  return Promise.resolve(createHash('sha256').update(input).digest('hex'))
}

function digestOf(appId: string, code: string): string {
  return createHash('sha256')
    .update(reviewUnlockDigestInput(appId, code))
    .digest('hex')
}

function memoryStorage(initial: string | null = null) {
  let value = initial
  return {
    read: () => value,
    write: (next: string) => {
      value = next
    },
    remove: () => {
      value = null
    },
    peek: () => value,
  }
}

function setup(
  overrides: {
    expectedDigest?: string | undefined
    initial?: string | null
    digest?: (input: string) => Promise<string>
  } = {},
) {
  const storage = memoryStorage(overrides.initial ?? null)
  const unlock = createReviewUnlock({
    appId: APP_ID,
    expectedDigest:
      'expectedDigest' in overrides
        ? overrides.expectedDigest
        : digestOf(APP_ID, CODE),
    storage,
    digest: overrides.digest ?? sha256,
    now: () => new Date('2026-09-12T19:30:00.000Z'),
  })
  return { storage, unlock }
}

describe('normalizeReviewCode', () => {
  it('ignores case, spacing and separators', () => {
    // The I of the printed prefix folds with everything else, which costs
    // nothing: both the issued digest and the typed code go through here.
    expect(normalizeReviewCode(' review-7k4m-93xq ')).toBe('REV1EW7K4M93XQ')
    expect(normalizeReviewCode('REVIEW 7K4M 93XQ')).toBe('REV1EW7K4M93XQ')
  })

  it('folds the glyphs a reviewer reads wrong onto their digits', () => {
    expect(normalizeReviewCode('O0-Il1')).toBe('00111')
  })

  it('leaves every character of the issuing alphabet alone', () => {
    for (const character of REVIEW_CODE_ALPHABET) {
      expect(normalizeReviewCode(character)).toBe(character)
    }
  })

  it('is empty for a code with nothing in it', () => {
    expect(normalizeReviewCode('  --  ')).toBe('')
  })
})

describe('createReviewUnlock', () => {
  it('unlocks on the right code, however it was typed', async () => {
    const { unlock, storage } = setup()
    const result = await unlock.redeem('review 7k4m 93xq')
    expect(result.outcome).toBe('unlocked')
    expect(result.grant?.grantedAt.toISOString()).toBe(
      '2026-09-12T19:30:00.000Z',
    )
    expect(unlock.restore()?.digest).toBe(digestOf(APP_ID, CODE))
    expect(storage.peek()).not.toBeNull()
  })

  it('changes nothing on a wrong code', async () => {
    const { unlock, storage } = setup()
    expect((await unlock.redeem('REVIEW-0000-0000')).outcome).toBe('rejected')
    expect((await unlock.redeem('')).outcome).toBe('rejected')
    expect(storage.peek()).toBeNull()
    expect(unlock.restore()).toBeUndefined()
  })

  it('never unlocks a build that shipped without a digest', async () => {
    const { unlock, storage } = setup({ expectedDigest: undefined })
    expect(unlock.configured).toBe(false)
    expect((await unlock.redeem(CODE)).outcome).toBe('unavailable')
    expect(storage.peek()).toBeNull()
  })

  it('treats a malformed digest as no digest at all', async () => {
    const { unlock } = setup({ expectedDigest: 'NOT-A-DIGEST' })
    expect(unlock.configured).toBe(false)
    expect((await unlock.redeem(CODE)).outcome).toBe('unavailable')
  })

  it('reports hashing it cannot do, rather than unlocking', async () => {
    const { unlock, storage } = setup({
      digest: () => Promise.reject(new Error('no subtle crypto')),
    })
    expect((await unlock.redeem(CODE)).outcome).toBe('unavailable')
    expect(storage.peek()).toBeNull()
  })

  it('keeps a grant across launches', () => {
    const grant = {
      digest: digestOf(APP_ID, CODE),
      grantedAt: new Date('2026-09-12T19:30:00.000Z'),
    }
    const { unlock } = setup({ initial: serializeReviewGrant(grant) })
    expect(unlock.restore()?.grantedAt.toISOString()).toBe(
      '2026-09-12T19:30:00.000Z',
    )
  })

  it('drops a grant made against a code the next release revoked', () => {
    const old = serializeReviewGrant({
      digest: digestOf(APP_ID, 'REVIEW-OLD1-OLD1'),
      grantedAt: new Date('2026-09-01T10:00:00.000Z'),
    })
    const { unlock, storage } = setup({ initial: old })
    expect(unlock.restore()).toBeUndefined()
    expect(storage.peek()).toBeNull()
  })

  it('drops a grant another app issued', () => {
    const foreign = serializeReviewGrant({
      digest: digestOf('drum-jammer', CODE),
      grantedAt: new Date('2026-09-01T10:00:00.000Z'),
    })
    const { unlock } = setup({ initial: foreign })
    expect(unlock.restore()).toBeUndefined()
  })

  it('forgets the grant when it is turned off', async () => {
    const { unlock, storage } = setup()
    await unlock.redeem(CODE)
    unlock.revoke()
    expect(storage.peek()).toBeNull()
    expect(unlock.restore()).toBeUndefined()
  })

  it('still opens the tier when storage refuses to keep it', async () => {
    const unlock = createReviewUnlock({
      appId: APP_ID,
      expectedDigest: digestOf(APP_ID, CODE),
      storage: {
        read: () => {
          throw new Error('blocked')
        },
        write: () => {
          throw new Error('blocked')
        },
        remove: vi.fn(),
      },
      digest: sha256,
    })
    expect((await unlock.redeem(CODE)).outcome).toBe('unlocked')
    expect(unlock.restore()).toBeUndefined()
  })
})

describe('readReviewGrant', () => {
  const expected = digestOf(APP_ID, CODE)

  it('refuses anything that is not a grant', () => {
    expect(readReviewGrant(null, expected)).toBeUndefined()
    expect(readReviewGrant('not json', expected)).toBeUndefined()
    expect(readReviewGrant('"a string"', expected)).toBeUndefined()
    expect(
      readReviewGrant(
        JSON.stringify({
          v: 2,
          digest: expected,
          grantedAt: '2026-09-12T19:30:00.000Z',
        }),
        expected,
      ),
    ).toBeUndefined()
    expect(
      readReviewGrant(
        JSON.stringify({ v: 1, digest: expected, grantedAt: 'whenever' }),
        expected,
      ),
    ).toBeUndefined()
    expect(
      readReviewGrant(
        JSON.stringify({ v: 1, grantedAt: '2026-09-12T19:30:00.000Z' }),
        expected,
      ),
    ).toBeUndefined()
  })
})
