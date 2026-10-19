// ============================================================
// A Warm-up walked end to end on the shell's stack
// ============================================================
//
// DESIGN-warm-up.md §12, 13c's walk with fixture rooms: the path pushed
// over the Sing room, Start, four stops (each room pushed over the path
// and popped back to it as its stop ends), the countdown taking the singer
// on once, the end, and Sing a song back to the Sing room for its song
// list. The path is the real one (WarmUpScreen, WarmUpPath, the store);
// each room is a stand-in that is handed its stop the way the real ones
// are (warm-up-stop.ts) and finishes it with the frames' results. The
// path's haptics are the device's (the platform package's), not the web's:
// installed behind `@/lib/haptics` as main.tsx installs them at boot.

import { hapticSuccess, hapticTap } from '@irchiinnuss/mobile-runtime/platform'
import { fireEvent, screen } from '@solidjs/testing-library'
import type { JSX } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { HOP_MS } from '@/components/room-kit/merc-moves'
import { lastExercise, resetLastExerciseForTests, } from '@/features/premium-exercises/last-exercise'
import { TAB_SINGING } from '@/features/tabs/constants'
import { ACTIONS_MS, END_SONG_MS, END_STEP_MS, } from '@/features/warm-up/path-motion'
import type { WarmUpRoomId } from '@/features/warm-up/warm-up-plan'
import { resetWarmUpForTests, warmUpDay, } from '@/features/warm-up/warm-up-store'
import { PULSE_MS } from '@/features/warm-up/WarmUpPath'
import { AUTO_CONTINUE_SECONDS } from '@/lib/auto-continue'
import { EXERCISE_ECHO_STARS, EXERCISE_LIP_ROLL_BAY, EXERCISE_LONG_NOTE_LANTERN, EXERCISE_NG_SLIDES_BRIDGE, } from '@/lib/domain/exercise-contracts'
import { songListRequested, takeSongListRequest, } from '@/stores/native-shell-store'
import { setActiveTab } from '@/stores/ui-store'
import { installNativeHaptics } from '../infrastructure/native-haptics'
import type { RenderedShell } from './render-for-test'
import { renderShell } from './render-for-test'
import { popScreen, pushed, pushScreen, resetRunShell } from './run-shell-store'
import { ShellScreens } from './ShellScreens'
import { warmUpStop } from './warm-up-stop'
import { WarmUpScreen } from './WarmUpScreen'

vi.mock('@irchiinnuss/mobile-runtime/platform', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  hapticTap: vi.fn(async () => true),
  hapticSuccess: vi.fn(async () => true),
}))

vi.mock('@/components/room-kit/MercView', () => ({
  MERC_FEET: 0.81,
  MercView: () => document.createElement('div'),
}))

// The rooms' art is theirs: the path's tap only asks for it.
vi.mock('@/features/long-note/long-note-art', () => ({
  preloadLongNoteArt: () => undefined,
}))
vi.mock('@/features/echo/echo-art', () => ({ preloadEchoArt: () => undefined }))
vi.mock('@/features/lip-roll/bay-art', () => ({
  preloadLipArt: () => undefined,
}))
vi.mock('@/features/ng-slides/bridge-art', () => ({
  preloadNgArt: () => undefined,
}))

const LINES: Record<WarmUpRoomId, string> = {
  [EXERCISE_LIP_ROLL_BAY]: '86% lit',
  [EXERCISE_NG_SLIDES_BRIDGE]: '92% lit',
  [EXERCISE_LONG_NOTE_LANTERN]: '12.6 s',
  [EXERCISE_ECHO_STARS]: '8 of 9 on pitch',
}

/** A room that is a stop, and sings it with the frames' result. */
function standIn(id: WarmUpRoomId): () => JSX.Element {
  return () => {
    const stop = warmUpStop(id, popScreen)
    return (
      <button
        type="button"
        data-testid="stand-in"
        data-room={id}
        data-stop={
          stop === undefined ? 'none' : `${stop.index + 1} of ${stop.count}`
        }
        onClick={() => stop?.finish({ id, line: LINES[id], settledNote: null })}
      >
        finish
      </button>
    )
  }
}

let view: RenderedShell | undefined
let releaseHaptics: (() => void) | undefined
/** The web's haptics, which the device's replace in the app. */
const vibrate = vi.fn()

/** The room on top: its id and its place in the Warm-up. */
function room(): string {
  const node = screen.getByTestId('stand-in')
  return `${node.dataset.room} ${node.dataset.stop}`
}

/** The room on top sings its stop, and the path comes back. */
function finishRoom(): void {
  fireEvent.click(screen.getByTestId('stand-in'))
  expect(pushed()).toBe('warm-up')
}

/** Next, 2.5 s after the card, then the ring's pulse. */
function next(): void {
  vi.advanceTimersByTime(ACTIONS_MS)
  fireEvent.click(screen.getByTestId('warm-up-next'))
  vi.advanceTimersByTime(PULSE_MS)
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2026, 9, 19, 9, 0))
  vi.clearAllMocks()
  localStorage.clear()
  resetLastExerciseForTests()
  resetWarmUpForTests()
  setActiveTab(TAB_SINGING)
  resetRunShell()
  takeSongListRequest()
  Object.defineProperty(navigator, 'vibrate', {
    value: vibrate,
    configurable: true,
    writable: true,
  })
  releaseHaptics = installNativeHaptics()
  view = renderShell(() => (
    <ShellScreens
      warmUp={WarmUpScreen}
      lipRoll={standIn(EXERCISE_LIP_ROLL_BAY)}
      ngSlides={standIn(EXERCISE_NG_SLIDES_BRIDGE)}
      longNote={standIn(EXERCISE_LONG_NOTE_LANTERN)}
      echo={standIn(EXERCISE_ECHO_STARS)}
    />
  ))
})

afterEach(async () => {
  // Start and Next set the next room's art loading (premium-exercise-
  // wiring.ts) and nothing waits for it. It lands here, while this file's
  // mocks still stand: after the teardown it would load the real art.
  await vi.dynamicImportSettled()
  view?.unmount()
  view = undefined
  resetWarmUpForTests()
  resetRunShell()
  takeSongListRequest()
  releaseHaptics?.()
  releaseHaptics = undefined
  Reflect.deleteProperty(navigator, 'vibrate')
  vi.useRealTimers()
})

describe('a Warm-up, start to song', () => {
  it('walks four stops to the end, then Sing a song opens the song list', () => {
    pushScreen('warm-up')
    expect(lastExercise()).toBe('warm-up-path')

    // Start: Lip roll, stop 1 of 4.
    fireEvent.click(screen.getByTestId('warm-up-start'))
    vi.advanceTimersByTime(PULSE_MS)
    expect(pushed()).toBe('lip-roll')
    expect(room()).toBe('lip-roll-bay 1 of 4')
    finishRoom()

    // The countdown takes the singer on to Ng slides by itself.
    vi.advanceTimersByTime(ACTIONS_MS + AUTO_CONTINUE_SECONDS * 1000 + PULSE_MS)
    expect(room()).toBe('ng-slides-bridge 2 of 4')
    finishRoom()

    next()
    expect(room()).toBe('long-note-lantern 3 of 4')
    finishRoom()

    next()
    expect(room()).toBe('echo-stars 4 of 4')
    finishRoom()

    // The end: every result under its stop, the day warmed up.
    expect(screen.getByTestId('warm-up-title').textContent).toBe('Warmed up')
    expect(screen.getByText('4 of 4 today')).not.toBeNull()
    expect(warmUpDay().warmedUp).toBe(true)
    expect(lastExercise()).toBe('warm-up-path')

    fireEvent.click(screen.getByTestId('warm-up-sing'))
    expect(pushed()).toBeNull()
    expect(songListRequested()).toBe(true)
  })

  it("the path's tick and success are the device's", () => {
    pushScreen('warm-up')
    fireEvent.click(screen.getByTestId('warm-up-start'))
    expect(hapticTap).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(PULSE_MS)
    finishRoom()
    for (let stop = 2; stop <= 4; stop += 1) {
      next()
      finishRoom()
    }
    expect(hapticSuccess).not.toHaveBeenCalled()

    // The end: four stops brighten, the song lights, and Merc lands on it.
    vi.advanceTimersByTime(4 * END_STEP_MS + END_SONG_MS + HOP_MS)
    expect(hapticSuccess).toHaveBeenCalledTimes(1)
    expect(vibrate).not.toHaveBeenCalled()
  })

  it('Back from a room returns to the path with that stop still next', () => {
    pushScreen('warm-up')
    fireEvent.click(screen.getByTestId('warm-up-start'))
    vi.advanceTimersByTime(PULSE_MS)
    expect(pushed()).toBe('lip-roll')

    popScreen()

    expect(pushed()).toBe('warm-up')
    expect(screen.getByTestId('warm-up-start').textContent).toBe(
      'Start warm-up',
    )
    // The room on its own again, from the picker: not a stop.
    pushScreen('lip-roll')
    expect(room()).toBe('lip-roll-bay none')
  })
})
