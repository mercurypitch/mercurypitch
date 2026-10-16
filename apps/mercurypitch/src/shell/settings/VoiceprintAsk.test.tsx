// ============================================================
// The voiceprint ask: this phone's takes, after a sign-in
// ============================================================
//
// The real voiceprint-service runs here, on a stood-in database, so what is
// pinned is what reaches the account: a sign-in to an account that already
// existed asks before a take goes anywhere (owner rule D2), Keep on this
// account adds them, Not now uploads nothing and stays quiet until a newer
// take, and an account made here adopts without asking (REQ-NAM-036, 037).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as AuthService from '@/db/services/auth-service'
import type * as UserService from '@/db/services/user-service'
import type { RenderedShell } from '../render-for-test'
import { renderShell } from '../render-for-test'
import { voiceprintsKept } from './account-copy'
import { afterSignIn } from './sign-in-landing'
import { ASK_BEAT_MS, resetVoiceprintAsk, voiceprintAskOpen, } from './voiceprint-ask'
import { VoiceprintAskNote, VoiceprintAskSheet } from './VoiceprintAsk'

const state = vi.hoisted(() => ({
  authed: false,
  userId: 'device-1',
  deviceId: 'device-1',
  uploads: [] as Array<{ userId: string; takenAt: string }>,
  notify: vi.fn(),
  fillDue: vi.fn(),
}))

vi.mock('@/lib/defaults', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  API_BASE_URL: 'https://api.test',
}))
vi.mock('@/db/services/auth-service', async (importOriginal) => ({
  ...(await importOriginal<typeof AuthService>()),
  hasValidToken: () => state.authed,
  hasUpgradedAccount: () => state.authed,
  accountHeld: () => state.authed,
}))
vi.mock('@/db/services/user-service', async (importOriginal) => ({
  ...(await importOriginal<typeof UserService>()),
  getUserId: () => state.userId,
  getDeviceId: () => state.deviceId,
}))
vi.mock('@/db', () => ({
  getDb: async () =>
    Promise.resolve({
      getRepository: () => ({
        create: async (row: { userId: string; takenAt: string }) => {
          state.uploads.push({ userId: row.userId, takenAt: row.takenAt })
          return Promise.resolve(row)
        },
        findAll: async () => Promise.resolve([]),
        count: async () => Promise.resolve(0),
      }),
    }),
}))
vi.mock('@/stores/notifications-store', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  showNotification: state.notify,
}))
vi.mock('./account-fill', () => ({ markAccountFillDue: state.fillDue }))
vi.mock('./account-state', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  refreshAccount: vi.fn(async () => undefined),
}))

import { adoptionNoticeDue, listAdoptableVoiceprints, loadLocalVoiceprints, saveVoiceprint, } from '@/db/services/voiceprint-service'

const summary = {
  lowMidi: 45,
  highMidi: 69,
  semitones: 24,
  accuracy: 80,
  steadiness: 85,
}

/** A session for an account, new or one that already existed. */
function session(userId: string, isNew: boolean) {
  return {
    token: 'header.body.signature',
    userId,
    isNew,
    user: {} as never,
  }
}

/** A take made on this phone with nobody signed in. */
async function takeSignedOut(takenAt: string): Promise<void> {
  state.authed = false
  state.userId = state.deviceId
  await saveVoiceprint({
    summary,
    twin: 'Nina Simone',
    source: 'mirror',
    takenAt,
  })
}

/** The session lands: the token is the account's, then the sheet's landing. */
function signInTo(userId: string, isNew: boolean): void {
  state.authed = true
  state.userId = userId
  afterSignIn(session(userId, isNew))
}

/** Let the stood-in database and Solid settle. */
async function settle(): Promise<void> {
  for (let i = 0; i < 4; i += 1) {
    await vi.advanceTimersByTimeAsync(0)
  }
}

function q(testId: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-testid="${testId}"]`)
}

let view: RenderedShell | null = null

beforeEach(() => {
  vi.useFakeTimers()
  localStorage.clear()
  state.authed = false
  state.userId = state.deviceId
  state.uploads = []
  state.notify.mockReset()
  state.fillDue.mockReset()
  resetVoiceprintAsk()
  view = renderShell(() => (
    <>
      <VoiceprintAskNote />
      <VoiceprintAskSheet />
    </>
  ))
})

afterEach(() => {
  view?.unmount()
  view = null
  resetVoiceprintAsk()
  vi.useRealTimers()
})

describe('a sign-in to an account that already existed', () => {
  it('asks a beat later, over a take made here signed out', async () => {
    await takeSignedOut('2026-10-16T09:00:00.000Z')

    signInTo('account-1', false)
    expect(voiceprintAskOpen()).toBe(false)
    expect(q('voiceprint-note')).toBeNull()

    await vi.advanceTimersByTimeAsync(ASK_BEAT_MS)

    const ask = q('voiceprint-ask')
    expect(ask).not.toBeNull()
    expect(ask?.textContent).toContain('Keep this voiceprint on your account?')
    expect(ask?.textContent).toContain(
      'A voiceprint made on this phone before signing in is not part of this account yet.',
    )
    // Keep's own card: the take the account would add, with its range.
    expect(q('keep-voiceprint')?.textContent).toContain('A2–A4')
    // Nothing went anywhere yet.
    expect(state.uploads).toEqual([])
    expect(state.fillDue).toHaveBeenCalledWith('account-1')
  })

  it('does not ask a phone with no takes to add', async () => {
    signInTo('account-1', false)
    await vi.advanceTimersByTimeAsync(ASK_BEAT_MS)

    expect(voiceprintAskOpen()).toBe(false)
    expect(q('voiceprint-ask')).toBeNull()
  })

  it('does not ask once the account that signed in has gone again', async () => {
    await takeSignedOut('2026-10-16T09:00:00.000Z')

    signInTo('account-1', false)
    state.authed = false
    state.userId = state.deviceId
    await vi.advanceTimersByTimeAsync(ASK_BEAT_MS)

    expect(voiceprintAskOpen()).toBe(false)
  })

  it('Keep on this account adds the takes to the account', async () => {
    await takeSignedOut('2026-10-16T09:00:00.000Z')
    await takeSignedOut('2026-10-16T10:00:00.000Z')
    signInTo('account-1', false)
    await vi.advanceTimersByTimeAsync(ASK_BEAT_MS)
    expect(q('voiceprint-ask')?.textContent).toContain(
      '2 voiceprints made on this phone before signing in are not part of this account yet.',
    )

    q('voiceprint-ask-keep')?.click()
    await settle()

    expect(state.uploads).toEqual([
      { userId: 'account-1', takenAt: '2026-10-16T10:00:00.000Z' },
      { userId: 'account-1', takenAt: '2026-10-16T09:00:00.000Z' },
    ])
    expect(loadLocalVoiceprints().map((take) => take.madeBy)).toEqual([
      'account-1',
      'account-1',
    ])
    expect(state.notify).toHaveBeenCalledWith(voiceprintsKept(2), 'success')
    expect(voiceprintAskOpen()).toBe(false)
    expect(q('voiceprint-note')).toBeNull()
  })

  it('Not now declines and uploads nothing, and asks again only for a newer take', async () => {
    await takeSignedOut('2026-10-16T09:00:00.000Z')
    signInTo('account-1', false)
    await vi.advanceTimersByTimeAsync(ASK_BEAT_MS)

    q('voiceprint-ask-not-now')?.click()
    await settle()

    expect(voiceprintAskOpen()).toBe(false)
    expect(state.uploads).toEqual([])
    expect(adoptionNoticeDue()).toBe(false)
    expect(loadLocalVoiceprints().map((take) => take.madeBy)).toEqual([
      'anonymous',
    ])

    // The same takes, the next sign-in: quiet.
    signInTo('account-1', false)
    await vi.advanceTimersByTimeAsync(ASK_BEAT_MS)
    expect(voiceprintAskOpen()).toBe(false)

    // A newer take made signed out: asked again.
    await takeSignedOut('2026-10-16T11:00:00.000Z')
    signInTo('account-1', false)
    await vi.advanceTimersByTimeAsync(ASK_BEAT_MS)
    expect(voiceprintAskOpen()).toBe(true)
    expect(state.uploads).toEqual([])
  })

  it("keeps the Account screen's note for anyone who said Not now, and it adds them", async () => {
    await takeSignedOut('2026-10-16T09:00:00.000Z')
    signInTo('account-1', false)
    await vi.advanceTimersByTimeAsync(ASK_BEAT_MS)
    q('voiceprint-ask-not-now')?.click()
    await settle()

    const note = q('voiceprint-note')
    expect(note?.textContent).toContain(
      'A voiceprint made on this phone before signing in is not part of this account yet.',
    )

    q('voiceprint-note-keep')?.click()
    await settle()

    expect(state.uploads).toEqual([
      { userId: 'account-1', takenAt: '2026-10-16T09:00:00.000Z' },
    ])
    expect(q('voiceprint-note')).toBeNull()
  })
})

describe('an account made here', () => {
  it('adopts the takes with no ask (REQ-NAM-036, 037)', async () => {
    await takeSignedOut('2026-10-16T09:00:00.000Z')

    signInTo('account-new', true)
    await settle()
    await vi.advanceTimersByTimeAsync(ASK_BEAT_MS)

    expect(voiceprintAskOpen()).toBe(false)
    expect(q('voiceprint-ask')).toBeNull()
    expect(state.uploads).toEqual([
      { userId: 'account-new', takenAt: '2026-10-16T09:00:00.000Z' },
    ])
    expect(listAdoptableVoiceprints()).toEqual([])
    expect(state.fillDue).not.toHaveBeenCalled()
  })
})
