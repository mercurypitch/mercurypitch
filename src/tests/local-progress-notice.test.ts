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

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

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
  accountFirstSeenAt,
  localProgressAtSignIn,
  progressHandoffMailto,
  summarizeLocalProgress,
} = await import('@/features/account/local-progress-notice')
const { clearExerciseHistory, recordExerciseResult } =
  await import('@/stores/exercise-history-store')
const { recordPathPracticeDay, resetAscent, startAscent } =
  await import('@/features/path/path-progress')
const { setSessionResults } = await import('@/stores/practice-session-store')

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

// ── The cutoff ───────────────────────────────────────────────────
//
// The local stores are one device-wide list each and keep growing while the
// singer practises, signed in or not. So the notice counted runs finished
// AFTER the sign-in, became due mid-session, and — at 390x844 — opened over
// the auto-continue row, covering the "Stay here" button its own sentence
// tells you to press. "Earlier practice" has to mean earlier.
describe('the cutoff — what "earlier" means', () => {
  const HOUR = 60 * 60 * 1000
  const SIGN_IN = new Date('2026-08-16T12:00:00.000Z').getTime()

  const aRun = (completedAt: number) => ({
    type: 'long-note' as const,
    score: 80,
    metrics: {},
    completedAt,
  })

  beforeEach(() => {
    localStorage.clear()
    clearExerciseHistory()
    setSessionResults([])
    resetAscent()
    ids.device = 'device-a'
    ids.account = 'account-b'
    vi.useFakeTimers()
    vi.setSystemTime(SIGN_IN)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('counts the practice that was here before the account arrived', () => {
    recordExerciseResult(aRun(SIGN_IN - HOUR))
    expect(localProgressAtSignIn('account-b').exercises).toBe(1)
    expect(localProgressNoticeDue()).toBe(true)
  })

  // The regression itself: finish a drill while signed in and nothing is
  // owed an explanation, so no modal opens over the result screen.
  it('does not count a run finished after signing in', () => {
    expect(localProgressNoticeDue()).toBe(false)

    vi.setSystemTime(SIGN_IN + HOUR)
    recordExerciseResult(aRun(SIGN_IN + HOUR))

    expect(localProgressAtSignIn('account-b').exercises).toBe(0)
    expect(localProgressNoticeDue()).toBe(false)
  })

  it('holds the line where the first sign-in put it', () => {
    expect(accountFirstSeenAt('account-b')).toBe(SIGN_IN)
    vi.setSystemTime(SIGN_IN + 5 * HOUR)
    expect(accountFirstSeenAt('account-b')).toBe(SIGN_IN)
  })

  // Signing out and into a second account made elsewhere is its own arrival,
  // and the practice done under the first one WAS left behind.
  it('gives a second account its own line', () => {
    expect(localProgressNoticeDue()).toBe(false)

    vi.setSystemTime(SIGN_IN + HOUR)
    recordExerciseResult(aRun(SIGN_IN + HOUR))

    vi.setSystemTime(SIGN_IN + 2 * HOUR)
    ids.account = 'account-c'
    expect(localProgressAtSignIn('account-c').exercises).toBe(1)
    expect(localProgressNoticeDue()).toBe(true)
  })

  // Merely opening The Ascent seeds a granted day that nobody practised.
  // Counting it would raise the notice for a device with no practice on it.
  it('does not count the Ascent day the app grants for free', () => {
    startAscent()
    expect(localProgressAtSignIn('account-b').ascentDays).toBe(0)
    expect(localProgressNoticeDue()).toBe(false)
  })

  it('counts an Ascent day practised before the account arrived', () => {
    startAscent()
    recordPathPracticeDay('2026-08-15')
    expect(localProgressAtSignIn('account-b').ascentDays).toBe(1)
  })

  // Sessions are the other list the notice counts, and they are stamped the
  // same way — a session sung after signing in is not practice left behind.
  it('divides practice sessions at the same line', () => {
    const session = (completedAt: number) => ({
      name: 'Warm-up',
      sessionName: 'Warm-up',
      score: 80,
      practiceItemResult: [],
      itemsCompleted: 1,
      completedAt,
    })

    setSessionResults([session(SIGN_IN - HOUR)])
    expect(localProgressAtSignIn('account-b').sessions).toBe(1)

    setSessionResults([session(SIGN_IN + HOUR)])
    expect(localProgressAtSignIn('account-b').sessions).toBe(0)
  })

  it('survives junk in the first-seen store', () => {
    localStorage.setItem(
      'mercurypitch.localProgressNotice.firstSeen.v1',
      'not json',
    )
    expect(accountFirstSeenAt('account-b', 4242)).toBe(4242)
    expect(accountFirstSeenAt('account-b', 9999)).toBe(4242)
  })

  // Signed out, the two ids are the same and nothing was left anywhere. The
  // stamp is what divides one account's practice from another's, so writing
  // one for a device that has not signed in would date the division wrong.
  it('stamps nothing while signed out', () => {
    ids.account = ids.device
    expect(localProgressNoticeDue()).toBe(false)
    expect(
      localStorage.getItem('mercurypitch.localProgressNotice.firstSeen.v1'),
    ).toBeNull()
  })
})
