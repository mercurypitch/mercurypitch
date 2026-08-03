// ============================================================
// "Your earlier practice stayed here"
// ============================================================
//
// Creating an account upgrades this device's row in place, so afterwards
// the account id IS the device id and nothing was left behind. Signing
// in to an account made elsewhere is the case that needs saying out
// loud: the id flips to a foreign one and the local practice belongs to
// an identity nobody is signed in as.
//
// The predicate is pure, so every branch is testable without a session.

import { beforeEach, describe, expect, it, vi } from 'vitest'

// The two ids are the whole signal, so the wiring block below drives them
// directly rather than standing up a token and a session.
const ids = { device: '', account: '' }
vi.mock('@/db/services/user-service', () => ({
  getDeviceId: () => ids.device,
  getUserId: () => ids.account,
  authVersion: () => 0,
}))

const {
  describeLocalProgress,
  EMPTY_PROGRESS,
  isNoticeDue,
  localProgressNoticeDue,
  localProgressTotal,
  markNoticeSeen,
  noticeSeen,
  progressHandoffMailto,
  summarizeLocalProgress,
} = await import('@/features/account/local-progress-notice')
const { recordExerciseResult } = await import('@/stores/exercise-history-store')

const SOME_PROGRESS = { exercises: 12, sessions: 3, ascentDays: 4 }

describe('isNoticeDue', () => {
  it('fires when a foreign account signs in over local practice', () => {
    expect(
      isNoticeDue({
        deviceId: 'device-a',
        accountId: 'account-b',
        seen: false,
        progress: SOME_PROGRESS,
      }),
    ).toBe(true)
  })

  it('stays silent when the account IS this device (register / first Google)', () => {
    // Registering upgrades the anonymous row in place, so the ids match
    // and the local practice already belongs to the account.
    expect(
      isNoticeDue({
        deviceId: 'device-a',
        accountId: 'device-a',
        seen: false,
        progress: SOME_PROGRESS,
      }),
    ).toBe(false)
  })

  it('stays silent when there is nothing to strand', () => {
    expect(
      isNoticeDue({
        deviceId: 'device-a',
        accountId: 'account-b',
        seen: false,
        progress: EMPTY_PROGRESS,
      }),
    ).toBe(false)
  })

  it('is told once per account, not once per sign-in', () => {
    expect(
      isNoticeDue({
        deviceId: 'device-a',
        accountId: 'account-b',
        seen: true,
        progress: SOME_PROGRESS,
      }),
    ).toBe(false)
  })

  it('stays silent when storage gave up the device id', () => {
    // getDeviceId() returns '' rather than minting one, so an empty id
    // means "cannot tell", not "brand new device".
    expect(
      isNoticeDue({
        deviceId: '',
        accountId: 'account-b',
        seen: false,
        progress: SOME_PROGRESS,
      }),
    ).toBe(false)
  })

  it('fires on any one kind of progress alone', () => {
    for (const p of [
      { exercises: 1, sessions: 0, ascentDays: 0 },
      { exercises: 0, sessions: 1, ascentDays: 0 },
      { exercises: 0, sessions: 0, ascentDays: 1 },
    ]) {
      expect(
        isNoticeDue({
          deviceId: 'a',
          accountId: 'b',
          seen: false,
          progress: p,
        }),
      ).toBe(true)
    }
  })
})

describe('localProgressTotal', () => {
  it('is zero for an untouched device', () => {
    expect(localProgressTotal(EMPTY_PROGRESS)).toBe(0)
  })

  it('counts every kind', () => {
    expect(localProgressTotal(SOME_PROGRESS)).toBe(19)
  })
})

describe('describeLocalProgress', () => {
  it('reads as a sentence, not a data dump', () => {
    expect(describeLocalProgress(SOME_PROGRESS)).toBe(
      '12 exercises, 3 practice sessions and 4 days of The Ascent',
    )
  })

  it('gets singulars right', () => {
    expect(
      describeLocalProgress({ exercises: 1, sessions: 1, ascentDays: 1 }),
    ).toBe('1 exercise, 1 practice session and 1 day of The Ascent')
  })

  it('names only what is there', () => {
    expect(
      describeLocalProgress({ exercises: 5, sessions: 0, ascentDays: 0 }),
    ).toBe('5 exercises')
  })

  it('never says "0 exercises"', () => {
    const text = describeLocalProgress({
      exercises: 0,
      sessions: 2,
      ascentDays: 0,
    })
    expect(text).not.toContain('0 ')
    expect(text).toBe('2 practice sessions')
  })

  it('falls back to plain words rather than an empty phrase', () => {
    // The notice sentence reads "the ___ you did on this device", so an
    // empty string would ship a broken sentence.
    expect(describeLocalProgress(EMPTY_PROGRESS)).toBe('your practice so far')
  })
})

describe('progressHandoffMailto', () => {
  it('carries both ids, which are the whole job', () => {
    const href = progressHandoffMailto('device-a', 'account-b', SOME_PROGRESS)
    const decoded = decodeURIComponent(href)
    expect(decoded).toContain('device: device-a')
    expect(decoded).toContain('account: account-b')
  })

  it('is a mailto to the published address with a subject', () => {
    const href = progressHandoffMailto('a', 'b', SOME_PROGRESS)
    expect(href.startsWith('mailto:')).toBe(true)
    expect(href).toContain('@')
    expect(decodeURIComponent(href)).toContain(
      'Move my practice history to my account',
    )
  })

  it('escapes the newlines rather than truncating the body', () => {
    // An unescaped newline ends the URL at the first line in some clients.
    const href = progressHandoffMailto('a', 'b', SOME_PROGRESS)
    expect(href).not.toContain('\n')
    expect(decodeURIComponent(href)).toContain('\n')
  })
})

describe('seen state', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('remembers per account', () => {
    expect(noticeSeen('account-b')).toBe(false)
    markNoticeSeen('account-b')
    expect(noticeSeen('account-b')).toBe(true)
    // A different account made elsewhere earns its own telling.
    expect(noticeSeen('account-c')).toBe(false)
  })

  it('survives junk in storage', () => {
    localStorage.setItem('mercurypitch.localProgressNotice.v1', 'not json')
    expect(noticeSeen('account-b')).toBe(false)
    markNoticeSeen('account-b')
    expect(noticeSeen('account-b')).toBe(true)
  })
})

describe('localProgressNoticeDue — the wiring', () => {
  beforeEach(() => {
    localStorage.clear()
    ids.device = 'device-a'
    ids.account = 'account-b'
  })

  it('reads real practice out of the local stores', () => {
    // A predicate wired to the wrong store is exactly the bug the pure
    // tests above cannot see.
    expect(summarizeLocalProgress().exercises).toBe(0)
    expect(localProgressNoticeDue()).toBe(false)

    recordExerciseResult({
      type: 'long-note',
      score: 80,
      metrics: {},
      completedAt: 1,
    })

    expect(summarizeLocalProgress().exercises).toBe(1)
    expect(localProgressNoticeDue()).toBe(true)
  })

  it('goes quiet once told, and stays quiet on the next sign-in', () => {
    recordExerciseResult({
      type: 'long-note',
      score: 80,
      metrics: {},
      completedAt: 1,
    })
    expect(localProgressNoticeDue()).toBe(true)
    markNoticeSeen('account-b')
    expect(localProgressNoticeDue()).toBe(false)
  })

  it('says nothing to someone who registered on this device', () => {
    recordExerciseResult({
      type: 'long-note',
      score: 80,
      metrics: {},
      completedAt: 1,
    })
    ids.account = ids.device // register upgrades the row in place
    expect(localProgressNoticeDue()).toBe(false)
  })
})
