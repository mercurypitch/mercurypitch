// ============================================================
// Google sign-up adopts the takes made before the account existed
// ============================================================
//
// The Google half of REQ-VPR-014. The password path adopts inline in
// AuthModal, because `registerWithPassword` resolving IS proof an account
// was made; Google cannot do that — one button both registers and signs
// in, and only the worker knows which happened. It says so with
// `gauth_new=1` on the return fragment, and `adoptAfterGoogleSignup`
// is what reads it.
//
// What these pin is the rule, not the plumbing: creation adopts, sign-in
// does not, and no take ever crosses from one person to another. The
// shared-PC cases (§4 decision D2) are the ones worth breaking the build
// over — a wrong adopt here hands one singer's voice to the next.

import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  authed: false,
  anonymousIdentity: false,
  userId: 'device-local-id',
  deviceId: 'device-local-id',
  accountCreated: false,
  dbGate: null as Promise<void> | null,
  cloudReadFails: false,
  cloudRows: [] as Array<{
    id: string
    userId: string
    summary: object
    twin?: string
    source: string
    takenAt: string
  }>,
}))

vi.mock('@/lib/defaults', () => ({ API_BASE_URL: 'https://api.test' }))
vi.mock('@/db/services/auth-service', () => ({
  hasValidToken: () => state.authed,
  hasUpgradedAccount: () => state.authed && !state.anonymousIdentity,
  // One-shot in production; one-shot here too, so a test that forgets to
  // arm it cannot pass on the previous test's signal.
  takeGoogleAccountCreated: () => {
    const created = state.accountCreated
    state.accountCreated = false
    return created
  },
}))
vi.mock('@/db/services/user-service', () => ({
  getUserId: () => state.userId,
  getDeviceId: () => state.deviceId,
}))
vi.mock('@/db', () => ({
  getDb: async () => {
    if (state.dbGate !== null) await state.dbGate
    return {
      getRepository: () => ({
        create: async (row: (typeof state.cloudRows)[number]) => {
          state.cloudRows.push({ ...row, id: `srv-${state.cloudRows.length}` })
          return row
        },
        findAll: async (opts?: { where?: { userId?: string } }) => {
          if (state.cloudReadFails) throw new Error('offline')
          return state.cloudRows.filter(
            (row) =>
              opts?.where?.userId === undefined ||
              row.userId === opts.where.userId,
          )
        },
        count: async () => state.cloudRows.length,
      }),
    }
  },
}))

import { adoptAfterGoogleSignup, loadLocalVoiceprints, MADE_ANONYMOUSLY, recordMadeBy, saveVoiceprint, syncLocalVoiceprints, } from '@/db/services/voiceprint-service'

const summary = {
  lowMidi: 48,
  highMidi: 72,
  semitones: 24,
  accuracy: 80,
  steadiness: 85,
}

const DEVICE = 'device-local-id'

function signOut(): void {
  state.authed = false
  state.anonymousIdentity = false
  state.userId = DEVICE
}

/**
 * The two shapes a Google sign-up comes back in.
 *
 * `brandNewAccount` is worker case 4: a fresh uuid, unrelated to this
 * device. `inPlaceUpgrade` is case 3: the anonymous row is promoted, so
 * the account id IS the device id — which is why device-tagged takes are
 * already its own and must not be re-adopted.
 */
function brandNewAccount(id = 'google-user-1'): void {
  state.authed = true
  state.anonymousIdentity = false
  state.userId = id
  state.accountCreated = true
}

function inPlaceUpgrade(): void {
  state.authed = true
  state.anonymousIdentity = false
  state.userId = DEVICE
  state.accountCreated = true
}

/** Signed in to an account that already existed — no creation signal. */
function returningUser(id = 'google-user-1'): void {
  state.authed = true
  state.anonymousIdentity = false
  state.userId = id
  state.accountCreated = false
}

/** A take made with nobody signed in, as the Voice Mirror leaves it. */
async function anonymousTake(takenAt: string): Promise<void> {
  signOut()
  await saveVoiceprint({
    summary,
    twin: 'Freddie Mercury',
    source: 'onboarding',
    takenAt,
  })
}

/**
 * A take tagged with the DEVICE id, seeded rather than captured.
 *
 * `saveVoiceprint` cannot produce this tag any more — since the
 * 2026-08-02 amendment to REQ-VPR-011 a real account decides the tag, so
 * capturing under a lazily provisioned anonymous identity writes
 * `anonymous`. Only records from before that amendment carry the device
 * id, and they are exactly what the repair clause in
 * `listAdoptableVoiceprints` exists for. Writing the row directly is the
 * only way to have one.
 */
function seedLegacyDeviceTaggedTake(takenAt: string): void {
  const existing = loadLocalVoiceprints()
  localStorage.setItem(
    'mercurypitch.voiceprints.v1',
    JSON.stringify([
      ...existing,
      {
        id: `legacy-${takenAt}`,
        summary,
        twin: null,
        source: 'mirror',
        takenAt,
        madeBy: DEVICE,
      },
    ]),
  )
}

beforeEach(() => {
  localStorage.clear()
  state.cloudRows = []
  state.dbGate = null
  state.cloudReadFails = false
  state.accountCreated = false
  signOut()
})

describe('a Google sign-up keeps the voiceprint that led to it', () => {
  it('adopts the anonymous take a brand-new Google account was made for', async () => {
    await anonymousTake('2026-08-20T10:00:00.000Z')
    brandNewAccount()

    expect(await adoptAfterGoogleSignup()).toBe(1)

    expect(recordMadeBy(loadLocalVoiceprints()[0])).toBe('google-user-1')
    expect(state.cloudRows).toHaveLength(1)
    expect(state.cloudRows[0].userId).toBe('google-user-1')
    expect(state.cloudRows[0].takenAt).toBe('2026-08-20T10:00:00.000Z')
  })

  it('adopts every unclaimed take, not just the newest', async () => {
    await anonymousTake('2026-08-18T10:00:00.000Z')
    await anonymousTake('2026-08-19T10:00:00.000Z')
    await anonymousTake('2026-08-20T10:00:00.000Z')
    brandNewAccount()

    expect(await adoptAfterGoogleSignup()).toBe(3)
    expect(state.cloudRows).toHaveLength(3)
  })

  // Worker case 3, and the reason REQ-VPR-011 was amended on 2026-08-02:
  // a held token is not a real account, so a take captured under the
  // lazily provisioned anonymous identity is tagged `anonymous` like any
  // other signed-out one. Both belong to the visitor who just upgraded.
  it('adopts every pre-account take on an in-place upgrade', async () => {
    await anonymousTake('2026-08-20T10:00:00.000Z')
    state.authed = true
    state.anonymousIdentity = true
    state.userId = DEVICE
    await saveVoiceprint({
      summary,
      twin: null,
      source: 'mirror',
      takenAt: '2026-08-21T10:00:00.000Z',
    })
    expect(loadLocalVoiceprints().map(recordMadeBy)).toEqual([
      MADE_ANONYMOUSLY,
      MADE_ANONYMOUSLY,
    ])

    inPlaceUpgrade()

    expect(await adoptAfterGoogleSignup()).toBe(2)
    const tags = loadLocalVoiceprints().map(recordMadeBy)
    expect(tags.every((tag) => tag === DEVICE)).toBe(true)
    expect(state.cloudRows).toHaveLength(2)
  })

  // The other half of case 3: a LEGACY device-tagged take, when the
  // account id is the device id, is already the account's own. Adoption
  // must leave it to ordinary sync rather than counting it again.
  it('leaves a legacy device-tagged take alone when the account IS the device', async () => {
    seedLegacyDeviceTaggedTake('2026-08-20T10:00:00.000Z')

    inPlaceUpgrade()

    expect(await adoptAfterGoogleSignup()).toBe(0)
    expect(recordMadeBy(loadLocalVoiceprints()[0])).toBe(DEVICE)
  })
})

describe('a Google sign-IN adopts nothing', () => {
  it('leaves an anonymous take alone for a returning Google user', async () => {
    await anonymousTake('2026-08-20T10:00:00.000Z')
    returningUser()

    expect(await adoptAfterGoogleSignup()).toBe(0)

    expect(recordMadeBy(loadLocalVoiceprints()[0])).toBe(MADE_ANONYMOUSLY)
    expect(state.cloudRows).toHaveLength(0)
  })

  // The verified-email auto-link (worker case 2) is a sign-in to an
  // account that already existed, and returns isNew=false. Same rule.
  it('leaves an anonymous take alone when Google auto-links an existing account', async () => {
    await anonymousTake('2026-08-20T10:00:00.000Z')
    returningUser('password-account-1')

    expect(await adoptAfterGoogleSignup()).toBe(0)
    expect(recordMadeBy(loadLocalVoiceprints()[0])).toBe(MADE_ANONYMOUSLY)
  })

  it('is one-shot: a second call after the same sign-up adopts nothing more', async () => {
    await anonymousTake('2026-08-20T10:00:00.000Z')
    brandNewAccount()

    expect(await adoptAfterGoogleSignup()).toBe(1)
    expect(await adoptAfterGoogleSignup()).toBe(0)
    expect(state.cloudRows).toHaveLength(1)
  })
})

describe('the shared-PC rules still hold (decision D2)', () => {
  it('never adopts a take tagged to a different account', async () => {
    returningUser('user-a')
    await saveVoiceprint({
      summary,
      twin: null,
      source: 'mirror',
      takenAt: '2026-08-20T10:00:00.000Z',
    })
    state.cloudRows = []

    brandNewAccount('google-user-2')

    expect(await adoptAfterGoogleSignup()).toBe(0)
    expect(recordMadeBy(loadLocalVoiceprints()[0])).toBe('user-a')
    expect(state.cloudRows).toHaveLength(0)
  })

  it('adopts only the unclaimed take when a foreign one sits beside it', async () => {
    returningUser('user-a')
    await saveVoiceprint({
      summary,
      twin: null,
      source: 'mirror',
      takenAt: '2026-08-19T10:00:00.000Z',
    })
    state.cloudRows = []
    await anonymousTake('2026-08-20T10:00:00.000Z')

    brandNewAccount('google-user-2')

    expect(await adoptAfterGoogleSignup()).toBe(1)
    const byTag = Object.fromEntries(
      loadLocalVoiceprints().map((r) => [r.takenAt, recordMadeBy(r)]),
    )
    expect(byTag['2026-08-19T10:00:00.000Z']).toBe('user-a')
    expect(byTag['2026-08-20T10:00:00.000Z']).toBe('google-user-2')
    expect(state.cloudRows).toHaveLength(1)
  })

  // The pre-2026-08-02 tagging repair: a take tagged with this device's
  // own id was made here before the device belonged to anyone, and was
  // invisible to everyone until the repair clause offered it back.
  it('adopts a legacy take stranded under this device own id', async () => {
    seedLegacyDeviceTaggedTake('2026-08-20T10:00:00.000Z')

    brandNewAccount('google-user-1')

    expect(await adoptAfterGoogleSignup()).toBe(1)
    expect(recordMadeBy(loadLocalVoiceprints()[0])).toBe('google-user-1')
    expect(state.cloudRows).toHaveLength(1)
  })
})

describe('it degrades without losing the take', () => {
  it('does nothing when there is no cloud to adopt into', async () => {
    await anonymousTake('2026-08-20T10:00:00.000Z')
    state.authed = false
    state.accountCreated = true

    expect(await adoptAfterGoogleSignup()).toBe(0)
    expect(recordMadeBy(loadLocalVoiceprints()[0])).toBe(MADE_ANONYMOUSLY)
  })

  it('does nothing when there is nothing unclaimed', async () => {
    brandNewAccount()

    expect(await adoptAfterGoogleSignup()).toBe(0)
    expect(state.cloudRows).toHaveLength(0)
  })

  // Retag-first: the upload can fail and the take is still the account's,
  // so the next ordinary sync carries it up.
  it('retags locally even when the cloud read fails, and the next sync uploads', async () => {
    await anonymousTake('2026-08-20T10:00:00.000Z')
    brandNewAccount()
    state.cloudReadFails = true

    await adoptAfterGoogleSignup()

    expect(recordMadeBy(loadLocalVoiceprints()[0])).toBe('google-user-1')
    expect(state.cloudRows).toHaveLength(0)

    state.cloudReadFails = false
    expect(await syncLocalVoiceprints()).toBe(1)
    expect(state.cloudRows[0].userId).toBe('google-user-1')
  })

  it('never uploads a take twice when the account already has that takenAt', async () => {
    await anonymousTake('2026-08-20T10:00:00.000Z')
    brandNewAccount()
    state.cloudRows = [
      {
        id: 'srv-existing',
        userId: 'google-user-1',
        summary,
        source: 'onboarding',
        takenAt: '2026-08-20T10:00:00.000Z',
      },
    ]

    await adoptAfterGoogleSignup()

    expect(state.cloudRows).toHaveLength(1)
  })

  // App.tsx fires sync and adoption together on the same auth transition.
  // Adoption awaits the in-flight sync before reading the cloud list, so
  // the take must not land twice.
  it('does not double-upload when an ordinary sync is already in flight', async () => {
    await anonymousTake('2026-08-20T10:00:00.000Z')
    brandNewAccount()
    let releaseDb = (): void => undefined
    state.dbGate = new Promise<void>((resolve) => {
      releaseDb = resolve
    })

    const syncing = syncLocalVoiceprints()
    const adopting = adoptAfterGoogleSignup()
    releaseDb()
    state.dbGate = null
    await Promise.all([syncing, adopting])

    expect(state.cloudRows).toHaveLength(1)
  })

  // Signing out mid-flight must not park somebody else's take in the
  // account that happens to be signed in when the await resolves.
  it('abandons the upload when the account changes mid-adoption', async () => {
    await anonymousTake('2026-08-20T10:00:00.000Z')
    brandNewAccount()
    let releaseDb = (): void => undefined
    state.dbGate = new Promise<void>((resolve) => {
      releaseDb = resolve
    })

    const adopting = adoptAfterGoogleSignup()
    returningUser('someone-else')
    releaseDb()
    await adopting

    expect(
      state.cloudRows.filter((row) => row.userId === 'someone-else'),
    ).toHaveLength(0)
  })
})
