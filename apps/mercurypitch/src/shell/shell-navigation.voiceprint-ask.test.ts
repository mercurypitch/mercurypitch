// ============================================================
// Back with the voiceprint ask up
// ============================================================
//
// After a sign-in to an account that already existed, the ask rises a beat
// later over whatever the sign-in landed on: the Account screen, the Sing
// room under Keep, a room under its Cloud offer, or the onboarding's Keep
// beat. Back is for the ask first, as its Not now: the takes stay off the
// account, and nothing under it moves. An ask that is not on screen (not
// risen yet, or signed out from under it) takes no press.
//
// The real voiceprint service runs, on a stood-in database, as in
// VoiceprintAsk.test.tsx, so a decline is what the service records.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as AuthService from '@/db/services/auth-service'
import type * as UserService from '@/db/services/user-service'
import { TAB_SINGING } from '@/features/tabs/constants'
import { registerRunControls } from '@/stores/native-shell-store'
import { setActiveTab } from '@/stores/ui-store'
import { pushed, pushSettingsScreen, resetRunShell } from './run-shell-store'
import { ASK_BEAT_MS, askAfterSignIn, keepVoiceprints, resetVoiceprintAsk, voiceprintAskOpen, voiceprintAskUp, } from './settings/voiceprint-ask'
import { performBack, registerOnboardingBack, resolveBack, } from './shell-navigation'

const state = vi.hoisted(() => ({
  authed: false,
  userId: 'device-1',
  deviceId: 'device-1',
  uploads: 0,
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
        create: async (row: unknown) => {
          state.uploads += 1
          return Promise.resolve(row)
        },
        findAll: async () => Promise.resolve([]),
        count: async () => Promise.resolve(0),
      }),
    }),
}))

import { adoptionNoticeDue, saveVoiceprint, } from '@/db/services/voiceprint-service'

const host = () => ({ canGoBack: true, back: vi.fn(), minimize: vi.fn() })

/** A take made here signed out, then a sign-in to an account that existed. */
async function signInWithATake(): Promise<void> {
  state.authed = false
  state.userId = state.deviceId
  await saveVoiceprint({
    summary: {
      lowMidi: 45,
      highMidi: 69,
      semitones: 24,
      accuracy: 80,
      steadiness: 85,
    },
    twin: 'Nina Simone',
    source: 'onboarding',
    takenAt: '2026-10-18T09:00:00.000Z',
  })
  state.authed = true
  state.userId = 'user-1'
  askAfterSignIn('user-1')
}

/** The ask, risen a beat after the sign-in. */
async function raiseAsk(): Promise<void> {
  await signInWithATake()
  vi.advanceTimersByTime(ASK_BEAT_MS)
  expect(voiceprintAskUp()).toBe(true)
}

/** A room under the ask, with an overlay of its own open. */
function roomWithOverlay(closeRoomOverlay: () => boolean): () => void {
  return registerRunControls({
    tab: TAB_SINGING,
    roomLabel: 'Sing',
    isPlaying: () => false,
    isPaused: () => false,
    pause: vi.fn(),
    resume: vi.fn(),
    stop: vi.fn(),
    park: vi.fn(),
    closeRoomOverlay,
  })
}

let unregister: Array<() => void> = []

beforeEach(() => {
  vi.useFakeTimers()
  localStorage.clear()
  state.authed = false
  state.userId = state.deviceId
  state.uploads = 0
  setActiveTab(TAB_SINGING)
  resetRunShell()
  resetVoiceprintAsk()
})

afterEach(() => {
  for (const off of unregister) off()
  unregister = []
  resetVoiceprintAsk()
  resetRunShell()
  localStorage.clear()
  vi.useRealTimers()
})

describe('Back with the voiceprint ask up', () => {
  it('is for the sheet', async () => {
    await raiseAsk()

    expect(resolveBack(true)).toBe('sheet')
  })

  it('answers Not now over the Account screen, which stays', async () => {
    pushSettingsScreen('account')
    await raiseAsk()
    const back = host()

    const outcome = performBack(back)

    expect(outcome).toBe('sheet')
    expect(voiceprintAskOpen()).toBe(false)
    // Declined, as Not now declines: quiet until a newer take.
    expect(adoptionNoticeDue()).toBe(false)
    expect(state.uploads).toBe(0)
    expect(pushed()).toBe('account')
    expect(back.back).not.toHaveBeenCalled()
  })

  it('comes before the onboarding under it, whose Back is its Not now', async () => {
    const leave = vi.fn(() => true)
    unregister.push(registerOnboardingBack(leave))
    await raiseAsk()

    const first = performBack(host())
    const leftOnFirst = leave.mock.calls.length
    const second = performBack(host())

    expect(first).toBe('sheet')
    expect(leftOnFirst).toBe(0)
    expect(voiceprintAskOpen()).toBe(false)
    expect(second).toBe('onboarding')
    expect(leave).toHaveBeenCalledTimes(1)
  })

  it('comes before the room under it and its overlay, and never leaves it', async () => {
    const closeRoomOverlay = vi.fn(() => true)
    unregister.push(roomWithOverlay(closeRoomOverlay))
    await raiseAsk()
    const back = host()

    expect(performBack(back)).toBe('sheet')
    expect(closeRoomOverlay).not.toHaveBeenCalled()
    expect(back.back).not.toHaveBeenCalled()
    expect(voiceprintAskOpen()).toBe(false)
  })

  it('stays the press of the ask while it saves, and closes as the save ends', async () => {
    await raiseAsk()
    const saving = keepVoiceprints()

    const outcome = performBack(host())
    const openWhileSaving = voiceprintAskOpen()
    await vi.advanceTimersByTimeAsync(0)
    await saving

    expect(outcome).toBe('sheet')
    expect(openWhileSaving).toBe(true)
    expect(voiceprintAskOpen()).toBe(false)
    expect(state.uploads).toBe(1)
  })
})

describe('Back with an ask that is not on screen', () => {
  it('goes to the screen under it before the ask has risen', async () => {
    pushSettingsScreen('account')
    await signInWithATake()

    expect(performBack(host())).toBe('pushed')
    expect(pushed()).toBe('settings')
  })

  it('goes to the screen under it once signed out from under the ask', async () => {
    pushSettingsScreen('account')
    await raiseAsk()
    state.authed = false

    expect(voiceprintAskUp()).toBe(false)
    expect(performBack(host())).toBe('pushed')
    expect(pushed()).toBe('settings')
  })
})
