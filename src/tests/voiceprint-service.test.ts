// ============================================================
// Voiceprint service — device/cloud tagging and adoption (decision D2)
// ============================================================
//
// The shared-PC rules under test (docs/specs/voiceprints.ears.md §3–4):
// takes tag who made them; sign-in auto-syncs only own takes; unclaimed
// takes are offered once and adopted only on explicit accept; device
// data is never deleted and shows fully when signed out.

import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  authed: false,
  anonymousIdentity: false,
  userId: 'device-local-id',
  deviceId: 'device-local-id',
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
  // Anonymous identities hold valid tokens too — the distinction the
  // tagging bug turned on.
  hasUpgradedAccount: () => state.authed && !state.anonymousIdentity,
}))
vi.mock('@/db/services/user-service', () => ({
  getUserId: () => state.userId,
  getDeviceId: () => state.deviceId,
}))
vi.mock('@/db', () => ({
  getDb: async () => ({
    getRepository: () => ({
      create: async (row: (typeof state.cloudRows)[number]) => {
        state.cloudRows.push({ ...row, id: `srv-${state.cloudRows.length}` })
        return row
      },
      findAll: async (opts?: { where?: { userId?: string } }) =>
        state.cloudRows.filter(
          (row) =>
            opts?.where?.userId === undefined ||
            row.userId === opts.where.userId,
        ),
    }),
  }),
}))

import { adoptDeviceVoiceprints, adoptionNoticeDue, declineAdoption, listAdoptableVoiceprints, listVoiceprints, loadLocalVoiceprints, MADE_ANONYMOUSLY, recordMadeBy, saveVoiceprint, syncLocalVoiceprints, } from '@/db/services/voiceprint-service'

const summary = {
  lowMidi: 48,
  highMidi: 72,
  semitones: 24,
  accuracy: 80,
  steadiness: 85,
}

function signIn(id: string): void {
  state.authed = true
  state.userId = id
}

function signOut(): void {
  state.authed = false
  state.anonymousIdentity = false
  state.userId = 'device-local-id'
}

/** A lazily provisioned anonymous identity: a real token, no real account.
 *  Its user id IS the device id — the worker keys it on that. */
function signInAnonymously(): void {
  state.authed = true
  state.anonymousIdentity = true
  state.userId = state.deviceId
}

beforeEach(() => {
  localStorage.clear()
  state.cloudRows = []
  signOut()
})

describe('tagging at capture', () => {
  it('signed-out saves tag anonymous and stay off the cloud', async () => {
    const record = await saveVoiceprint({
      summary,
      twin: 'Freddie Mercury',
      source: 'onboarding',
    })
    expect(recordMadeBy(record)).toBe(MADE_ANONYMOUSLY)
    expect(state.cloudRows).toHaveLength(0)
  })

  it('signed-in saves tag the user and reach the cloud', async () => {
    signIn('user-a')
    const record = await saveVoiceprint({
      summary,
      twin: 'Frank Sinatra',
      source: 'mirror',
    })
    expect(recordMadeBy(record)).toBe('user-a')
    expect(state.cloudRows).toHaveLength(1)
    expect(state.cloudRows[0].userId).toBe('user-a')
  })
})

describe('listing', () => {
  it('signed out shows every device take, whoever made it', async () => {
    await saveVoiceprint({ summary, twin: null, source: 'onboarding' })
    signIn('user-a')
    await saveVoiceprint({ summary, twin: null, source: 'mirror' })
    signOut()
    expect(await listVoiceprints()).toHaveLength(2)
  })

  it('signed in hides anonymous and foreign takes until adopted', async () => {
    await saveVoiceprint({
      summary,
      twin: null,
      source: 'onboarding',
      takenAt: '2026-08-01T10:00:00Z',
    })
    signIn('user-b')
    await saveVoiceprint({
      summary,
      twin: null,
      source: 'mirror',
      takenAt: '2026-08-01T11:00:00Z',
    })
    signIn('user-a')
    const listed = await listVoiceprints()
    // user-b's take and the anonymous take both stay invisible to user-a.
    expect(listed).toHaveLength(0)
  })
})

describe('auto-sync scope', () => {
  it('uploads only own-tagged takes, never unclaimed ones', async () => {
    await saveVoiceprint({
      summary,
      twin: null,
      source: 'onboarding',
      takenAt: '2026-08-01T10:00:00Z',
    })
    signIn('user-a')
    // Own take that missed its upload: forge one locally under user-a.
    localStorage.setItem(
      'mercurypitch.voiceprints.v1',
      JSON.stringify([
        ...loadLocalVoiceprints(),
        {
          id: 'own-1',
          summary,
          twin: null,
          source: 'mirror',
          takenAt: '2026-08-01T12:00:00Z',
          madeBy: 'user-a',
        },
      ]),
    )
    const uploaded = await syncLocalVoiceprints()
    expect(uploaded).toBe(1)
    expect(state.cloudRows.map((r) => r.takenAt)).toEqual([
      '2026-08-01T12:00:00Z',
    ])
  })
})

describe('adoption', () => {
  it('offers unclaimed takes, adopts on accept, and is idempotent', async () => {
    await saveVoiceprint({
      summary,
      twin: null,
      source: 'onboarding',
      takenAt: '2026-08-01T10:00:00Z',
    })
    signIn('user-a')
    expect(listAdoptableVoiceprints()).toHaveLength(1)
    expect(adoptionNoticeDue()).toBe(true)

    expect(await adoptDeviceVoiceprints()).toBe(1)
    expect(state.cloudRows).toHaveLength(1)
    expect((await listVoiceprints()).length).toBe(1)
    // Nothing left to offer, and a second accept uploads nothing.
    expect(listAdoptableVoiceprints()).toHaveLength(0)
    expect(await adoptDeviceVoiceprints()).toBe(0)
    expect(state.cloudRows).toHaveLength(1)
  })

  it('legacy untagged records count as anonymous', async () => {
    localStorage.setItem(
      'mercurypitch.voiceprints.v1',
      JSON.stringify([
        {
          id: 'legacy-1',
          summary,
          twin: null,
          source: 'mirror',
          takenAt: '2026-07-01T10:00:00Z',
        },
      ]),
    )
    signIn('user-a')
    expect(listAdoptableVoiceprints()).toHaveLength(1)
  })

  it('"Not now" stays quiet until a newer unclaimed take appears', async () => {
    await saveVoiceprint({
      summary,
      twin: null,
      source: 'onboarding',
      takenAt: '2026-08-01T10:00:00Z',
    })
    signIn('user-a')
    declineAdoption()
    expect(adoptionNoticeDue()).toBe(false)

    signOut()
    await saveVoiceprint({
      summary,
      twin: null,
      source: 'onboarding',
      takenAt: '2026-08-01T11:00:00Z',
    })
    signIn('user-a')
    expect(adoptionNoticeDue()).toBe(true)

    // The quiet period is per account: a different account is asked fresh.
    declineAdoption()
    signIn('user-b')
    expect(adoptionNoticeDue()).toBe(true)
  })
})

// ── The anonymous-identity trap ──────────────────────────────────
// A take made while an anonymous identity held a token used to be tagged
// with that identity's id. It then matched neither MADE_ANONYMOUSLY (so
// it was never offered for adoption) nor any real account's id (so it
// never reappeared after signing in): stranded on the device, invisible.

describe('takes made under an anonymous identity', () => {
  it('are tagged anonymous, not with the throwaway identity', async () => {
    signInAnonymously()
    const record = await saveVoiceprint({
      summary,
      twin: 'David Bowie',
      source: 'mirror',
    })
    expect(recordMadeBy(record)).toBe(MADE_ANONYMOUSLY)
  })

  it('are offered to a real account that signs in afterwards', async () => {
    signInAnonymously()
    await saveVoiceprint({ summary, twin: 'David Bowie', source: 'mirror' })

    // A real account created elsewhere signs in on this device.
    signIn('account-made-on-another-device')

    expect(listAdoptableVoiceprints()).toHaveLength(1)
    expect(adoptionNoticeDue()).toBe(true)
  })

  it('recovers takes already stranded by the old tagging', () => {
    // Exactly what is sitting in a browser today: tagged with the device
    // id, because that is what the anonymous identity's id is.
    localStorage.setItem(
      'mercurypitch.voiceprints.v1',
      JSON.stringify([
        {
          id: 'stranded',
          summary,
          twin: 'David Bowie',
          source: 'mirror',
          takenAt: '2026-08-01T14:54:48.060Z',
          madeBy: 'device-local-id',
        },
      ]),
    )
    signIn('account-made-on-another-device')

    expect(listAdoptableVoiceprints().map((r) => r.id)).toEqual(['stranded'])
  })

  it('does not offer an upgraded account its own takes back', () => {
    // Registering with the deviceId upgrades the anonymous user IN PLACE,
    // so the account id is the device id. Those takes are already theirs.
    localStorage.setItem(
      'mercurypitch.voiceprints.v1',
      JSON.stringify([
        {
          id: 'mine',
          summary,
          twin: 'David Bowie',
          source: 'mirror',
          takenAt: '2026-08-01T14:54:48.060Z',
          madeBy: 'device-local-id',
        },
      ]),
    )
    signIn('device-local-id') // in-place upgrade: account id === device id

    expect(listAdoptableVoiceprints()).toEqual([])
  })
})
