// ============================================================
// The room's way in to the premium exercises
// ============================================================
//
// The room reads PREMIUM_EXERCISES once, at module level, so this file
// mocks the constant true before anything imports the room: a build with
// the exercises. SingRoomStage.test.tsx runs the same room without them.
//
// The row and the picker are lazy islands. Every case waits for the
// island it taps (findBy), and every case about something absent waits for
// the islands' code first, so it cannot pass on code that had not loaded.

import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PracticeFrameListener } from '@/features/practice/usePracticeController'
import { resetLastExerciseForTests } from '@/features/premium-exercises/last-exercise'
import type * as NativeBuild from '@/lib/native-build'
import type { MidiSongPicker } from '@/lib/use-midi-song-picker'
import type { NativeShellApi } from '@/stores/native-shell-store'
import { holdRoomArrival, nativeRunControls, registerShellApi, requestSongList, resetRoomArrivalHolds, songListRequested, takeSongListRequest, } from '@/stores/native-shell-store'
import { clearSingTakes, lastSingTake, singTakes, } from '@/stores/sing-takes-store'
import { dispatchSingRoom, resetSingRoom, singRoomContext, } from './sing-room-store'
import { SingRoomStage } from './SingRoomStage'
import { MIN_VOICED_MS } from './take-summary'

vi.mock('@/lib/native-build', async (importOriginal) => ({
  ...(await importOriginal<typeof NativeBuild>()),
  PREMIUM_EXERCISES: true,
}))

vi.mock('@/lib/haptics', () => ({
  haptics: { tapLight: vi.fn(), tapMedium: vi.fn(), success: vi.fn() },
}))

interface Room {
  /** What the room asked of the app and the shell, in order, with the
   *  room's state, the takes kept and the sheets open at each call. */
  log: string[]
  openExercise: ReturnType<typeof vi.fn>
  /** One detection frame into the room, as the app's controller sends it. */
  frame: (atMs: number, freq: number) => void
  /** Put the room into a melody run the way loading a melody does. */
  startMelodyRun: () => void
}

/** Nothing here opens the song picker; the room only asks if it is open. */
const picker = {
  isModalOpen: () => false,
  setIsModalOpen: () => {},
  trackModalSong: () => null,
  setTrackModalSong: () => {},
} as unknown as MidiSongPicker

let unregisterShell: (() => void) | undefined

function mountRoom(shell = true): Room {
  const log: string[] = []
  const takesBefore = singTakes().length
  const at = (): string =>
    `state ${singRoomContext().state}, takes +${singTakes().length - takesBefore}`
  const [micActive, setMicActive] = createSignal(false)
  // The log reads this copy, not the signal: it is written from the shell's
  // call, which is no tracked scope.
  let micOn = false
  const [isPlaying, setPlaying] = createSignal(false)
  const [isPaused, setPaused] = createSignal(false)
  const listeners = new Set<PracticeFrameListener>()
  const openExercise = vi.fn((id: string) => {
    const sheets = screen.queryAllByRole('dialog', { hidden: true }).length
    log.push(
      `open ${id}: ${at()}, mic ${micOn ? 'on' : 'off'}, sheets ${sheets}`,
    )
  })
  if (shell) {
    unregisterShell = registerShellApi({
      openExercise,
    } as unknown as NativeShellApi)
  }
  const openStubMic = async (): Promise<boolean> => {
    micOn = true
    setMicActive(true)
    return true
  }
  const stopTransport = (): void => {
    log.push(`transport stop: ${at()}`)
    setPlaying(false)
    setPaused(false)
  }
  render(() => (
    <SingRoomStage
      picker={picker}
      melody={() => []}
      currentBeat={() => 0}
      totalBeats={() => 2}
      pitchHistory={() => []}
      currentPitch={() => null}
      targetPitch={() => null}
      subscribeFrames={(listener) => {
        listeners.add(listener)
        return () => listeners.delete(listener)
      }}
      renderCanvas={() => <div data-testid="canvas" />}
      micActive={micActive}
      startMic={openStubMic}
      stopMic={() => {
        log.push(`mic off: ${at()}`)
        micOn = false
        setMicActive(false)
      }}
      primeAudio={() => {}}
      audioRunning={() => true}
      isPlaying={isPlaying}
      isPaused={isPaused}
      onPlay={() => setPlaying(true)}
      onPause={() => {
        setPlaying(false)
        setPaused(true)
      }}
      onResume={() => {
        setPlaying(true)
        setPaused(false)
      }}
      onStop={stopTransport}
      isCountingIn={() => false}
      countInBeat={() => 0}
      onSessionSkip={() => {}}
      onSessionEnd={() => {}}
      speed={() => 1}
      onSpeedChange={() => {}}
      volume={() => 1}
      onVolumeChange={() => {}}
      metronomeEnabled={() => false}
      onMetronomeToggle={() => {}}
      onOctaveShift={() => {}}
      onAutoCalibrate={() => {}}
    />
  ))
  return {
    log,
    openExercise,
    frame: (atMs, freq) => {
      for (const listener of listeners) {
        listener({
          atMs,
          beat: 0,
          micActive: true,
          pitch: {
            frequency: freq,
            clarity: 0.95,
          } as Parameters<PracticeFrameListener>[0]['pitch'],
        })
      }
    },
    startMelodyRun: () => {
      dispatchSingRoom({ type: 'melody-play' })
      setPlaying(true)
    },
  }
}

/** A free run, live, the way a first tap with the mic granted gets there. */
function startFreeRun(): void {
  dispatchSingRoom({ type: 'sing-a-note' })
  dispatchSingRoom({ type: 'priming-continue' })
  dispatchSingRoom({ type: 'mic-granted' })
}

/** The shell's own controls, which throw rather than skip a step. */
function controls() {
  const registered = nativeRunControls()
  if (registered === null) throw new Error('the room registered no controls')
  return registered
}

/** The islands' code, loaded, and the room arrived. */
async function settled(): Promise<void> {
  await vi.dynamicImportSettled()
  await Promise.resolve()
}

const exerciseIds = (): string[] =>
  [
    'sing-exercise-row',
    'sing-exercise-pill',
    'sing-exercise-browse',
    'sing-exercise-door',
    'sing-options-exercises',
  ].filter((id) => screen.queryByTestId(id) !== null)

const pickerOpen = (): boolean =>
  screen.queryByRole('dialog', { name: 'Exercises' }) !== null

beforeEach(() => {
  resetSingRoom()
  localStorage.removeItem('mp_last_exercise')
  resetLastExerciseForTests()
})

afterEach(() => {
  cleanup()
  unregisterShell?.()
  unregisterShell = undefined
  dispatchSingRoom({ type: 'leave' })
  clearSingTakes()
})

describe('a shell that cannot open an exercise', () => {
  it('draws no row and no options row', async () => {
    mountRoom(false)
    await settled()
    controls().openOptions?.()

    expect(
      screen.getAllByRole('dialog').map((d) => d.getAttribute('aria-label')),
    ).toEqual(['Practice options'])
    expect(exerciseIds()).toEqual([])
  })
})

describe('at rest', () => {
  it('opens the picker from the lone "Exercises" pill, and a pick opens the exercise once', async () => {
    const room = mountRoom()
    fireEvent.click(await screen.findByTestId('sing-exercise-browse'))
    const cards = await screen.findAllByTestId('sing-exercise-card')
    expect(cards.map((card) => card.getAttribute('data-exercise'))).toEqual([
      'long-note-lantern',
      'echo-stars',
      'warm-up-path',
      'lip-roll-bay',
      'ng-slides-bridge',
      'home-note-lighthouse',
      'first-note-stage',
    ])
    fireEvent.click(cards[0])

    expect(room.openExercise.mock.calls).toEqual([['long-note-lantern']])
    expect(pickerOpen()).toBe(false)
    expect(room.log).toEqual([
      'open long-note-lantern: state resting, takes +0, mic off, sheets 0',
    ])
  })

  it('opens the last exercise from its pill, without the picker', async () => {
    localStorage.setItem('mp_last_exercise', 'long-note-lantern')
    resetLastExerciseForTests()
    const room = mountRoom()
    fireEvent.click(await screen.findByTestId('sing-exercise-pill'))

    expect(room.openExercise.mock.calls).toEqual([['long-note-lantern']])
    expect(pickerOpen()).toBe(false)
  })

  it('closes every sheet before the exercise opens', async () => {
    // A tap cannot reach the pill through a sheet; this stands in for any
    // way in that could, so the exercise never opens under a dialog.
    localStorage.setItem('mp_last_exercise', 'long-note-lantern')
    resetLastExerciseForTests()
    const room = mountRoom()
    const pill = await screen.findByTestId('sing-exercise-pill')
    controls().openOptions?.()

    fireEvent.click(pill)

    expect(room.log).toEqual([
      'open long-note-lantern: state resting, takes +0, mic off, sheets 0',
    ])
  })

  it('opens the picker from the options, closing them first', async () => {
    mountRoom()
    await settled()
    controls().openOptions?.()
    fireEvent.click(await screen.findByTestId('sing-options-exercises'))

    expect(screen.queryByRole('dialog', { name: 'Practice options' })).toBe(
      null,
    )
    expect(pickerOpen()).toBe(true)
  })
})

describe('in a free run', () => {
  it('ends the run, keeps its take, lets the mic go, and only then opens', async () => {
    localStorage.setItem('mp_last_exercise', 'long-note-lantern')
    resetLastExerciseForTests()
    const room = mountRoom()
    await screen.findByTestId('sing-exercise-pill')
    startFreeRun()
    // Four seconds of A3: over the three of voice a take needs to be kept.
    for (let at = 0; at <= 4000; at += 16) room.frame(at, 220)
    expect(singRoomContext().state).toBe('live')

    fireEvent.click(await screen.findByTestId('sing-exercise-pill'))

    expect(room.log).toEqual([
      'mic off: state ended, takes +0',
      'open long-note-lantern: state resting, takes +1, mic off, sheets 0',
    ])
    expect(lastSingTake()?.durationMs).toBeGreaterThanOrEqual(MIN_VOICED_MS)
  })

  it('keeps the same row when rest turns into a run', async () => {
    // The second run of a visit: the mic is granted, so the capsule goes
    // straight to live with no priming door between (the first run's door
    // hides the row, as it hides the capsule).
    mountRoom()
    await screen.findByTestId('sing-exercise-row')
    startFreeRun()
    controls().stop()
    const resting = await screen.findByTestId('sing-exercise-row')

    dispatchSingRoom({ type: 'sing-a-note' })

    expect(singRoomContext().state).toBe('live')
    expect(screen.getByTestId('sing-exercise-row')).toBe(resting)
  })
})

describe('where the room offers no exercises', () => {
  it('draws no row and no options row over a melody run', async () => {
    const room = mountRoom()
    await screen.findByTestId('sing-exercise-row')
    room.startMelodyRun()
    controls().openOptions?.()
    await settled()

    expect(singRoomContext().state).toBe('live')
    expect(exerciseIds()).toEqual([])
  })

  it('draws no row on the priming door', async () => {
    mountRoom()
    await screen.findByTestId('sing-exercise-row')
    dispatchSingRoom({ type: 'sing-a-note' })

    expect(singRoomContext().state).toBe('priming')
    expect(exerciseIds()).toEqual([])
  })
})

describe('before the room has arrived', () => {
  afterEach(() => {
    resetRoomArrivalHolds()
  })

  it('draws the row and lets no tap through until it has', async () => {
    const release = holdRoomArrival()
    mountRoom()
    const browse = await screen.findByTestId('sing-exercise-browse')

    fireEvent.click(browse)
    expect(browse.getAttribute('aria-disabled')).toBe('true')
    expect(pickerOpen()).toBe(false)

    release()
    await Promise.resolve()
    fireEvent.click(browse)
    expect(browse.getAttribute('aria-disabled')).toBeNull()
    expect(pickerOpen()).toBe(true)
  })
})

describe('closing the picker', () => {
  async function openPicker(): Promise<void> {
    mountRoom()
    fireEvent.click(await screen.findByTestId('sing-exercise-browse'))
    await screen.findByRole('dialog', { name: 'Exercises' })
  }

  it('closes on Back', async () => {
    await openPicker()

    expect(controls().closeRoomOverlay?.()).toBe(true)
    expect(pickerOpen()).toBe(false)
  })

  it('closes on a park', async () => {
    await openPicker()

    controls().park()

    expect(pickerOpen()).toBe(false)
  })
})

// "Sing a song" at the end of the Warm-up pops back to this room and asks
// for its song list (DESIGN-warm-up.md N15, native-shell-store.ts).
describe('the song list, asked for by the Warm-up', () => {
  afterEach(() => {
    takeSongListRequest()
    vi.restoreAllMocks()
  })

  it('opens once, and the request is taken', () => {
    const open = vi.spyOn(picker, 'setIsModalOpen')
    mountRoom()
    expect(open).not.toHaveBeenCalled()

    requestSongList()

    expect(open.mock.calls).toEqual([[true]])
    expect(songListRequested()).toBe(false)
  })

  it('asked before the room is on screen, opens as it arrives', () => {
    const open = vi.spyOn(picker, 'setIsModalOpen')
    requestSongList()

    mountRoom()

    expect(open.mock.calls).toEqual([[true]])
    expect(songListRequested()).toBe(false)
  })
})
