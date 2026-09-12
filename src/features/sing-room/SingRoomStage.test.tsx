// ============================================================
// The room as a whole — the four things only a render can answer
// ============================================================
//
// Almost everything in this room is a headless module with its own suite.
// These are the cases that are not: they live in the wiring, and the reviewer
// found four mutations in that wiring that the whole suite stayed green
// against (review F8). Two of them are answered by `run-out-watch.test.ts`;
// the other two are here, with the F4 and F5 fixes beside them.
//
// The canvas is a prop (`renderCanvas`), so what the room decides to draw is
// readable without a canvas: the stub keeps the last options object it was
// handed, and that object IS the decision.

import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import type { Mock } from 'vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { MidiSongPicker } from '@/lib/use-midi-song-picker'
import { setCurrentMelody } from '@/stores/melody-store'
import type { MelodyItem, NoteName } from '@/types'
import { dispatchSingRoom, singRoomContext } from './sing-room-store'
import type { SingRoomCanvasOptions } from './SingRoomStage'
import { SingRoomStage } from './SingRoomStage'

vi.mock('@/lib/haptics', () => ({
  haptics: { tapLight: vi.fn(), tapMedium: vi.fn(), success: vi.fn() },
}))

/**
 * The room's song chip reads the app's melody store, not the prop, because
 * the app always has a melody loaded and the chip is about the one chosen
 * HERE. A test that wants the chip has to give the store one.
 */
const LOADED = {
  id: 'test-scale',
  name: 'Test Scale',
  items: [] as MelodyItem[],
  bpm: 90,
}

const note = (name: NoteName, midi: number, freq: number) => ({
  midi,
  name,
  octave: 4,
  freq,
})

const MELODY: MelodyItem[] = [
  { id: 1, note: note('C', 60, 261.63), duration: 1, startBeat: 0 },
  { id: 2, note: note('D', 62, 293.66), duration: 1, startBeat: 1 },
]

function stubPicker(): MidiSongPicker {
  const [isModalOpen, setIsModalOpen] = createSignal(false)
  const [trackModalSong, setTrackModalSong] = createSignal(null)
  const nothing = (): void => {}
  return {
    selectedId: () => null,
    setSelectedId: nothing,
    importStatus: () => '',
    isModalOpen,
    setIsModalOpen,
    trackModalSong: trackModalSong as MidiSongPicker['trackModalSong'],
    setTrackModalSong:
      setTrackModalSong as unknown as MidiSongPicker['setTrackModalSong'],
    pendingScoreId: () => '',
    setPendingScoreId: nothing,
    pendingBackingIds: () => new Set<string>(),
    setPendingBackingIds: nothing,
    melodies: () => [],
    currentMelodyName: () => 'Scale',
    loadMelody: nothing,
    loadSavedSong: nothing,
    deleteSong: nothing,
    openTrackModal: nothing,
    applyTrackSelection: nothing,
    selectScoreTrack: nothing,
    importMidi: nothing,
    importMidiFile: async () => {},
  }
}

/** A transport call the room made, countable and inspectable. */
type Call = Mock<() => void>

interface Room {
  transport: {
    onPlay: Call
    onPause: Call
    onResume: Call
    onStop: Call
  }
  setPlaying: (value: boolean) => void
  setPaused: (value: boolean) => void
  /** Every options object `renderCanvas` has been handed. */
  canvas: () => SingRoomCanvasOptions[]
  picker: MidiSongPicker
  /**
   * What the room looked like at each transport call. Order is the whole
   * point in one case, and a call count cannot see it.
   */
  log: string[]
}

function mountRoom(): Room {
  const [isPlaying, setPlaying] = createSignal(false)
  const [isPaused, setPaused] = createSignal(false)
  // A mic that never turns on is a mic the room gives up on: it dispatches
  // `mic-unavailable`, which ends the run out from under the case being made.
  const [micActive, setMicActive] = createSignal(false)
  // Named rather than inline: the room awaits this inside the gesture that
  // asked for it, and an async arrow in a JSX attribute reads to the linter
  // as a tracked scope that cannot be tracked.
  const openStubMic = async (): Promise<boolean> => {
    setMicActive(true)
    return true
  }
  const seen: SingRoomCanvasOptions[] = []
  const log: string[] = []
  const transport: Room['transport'] = {
    onPlay: vi.fn(() => {
      setPlaying(true)
      setPaused(false)
    }),
    onPause: vi.fn(() => {
      setPlaying(false)
      setPaused(true)
    }),
    onResume: vi.fn(() => {
      setPlaying(true)
      setPaused(false)
    }),
    onStop: vi.fn(() => {
      log.push(`stop melodyLoaded=${String(singRoomContext().melodyLoaded)}`)
      setPlaying(false)
      setPaused(false)
    }),
  }
  const picker = stubPicker()
  render(() => (
    <SingRoomStage
      picker={picker}
      melody={() => MELODY}
      currentBeat={() => 0}
      totalBeats={() => 2}
      pitchHistory={() => []}
      currentPitch={() => null}
      targetPitch={() => null}
      subscribeFrames={() => () => {}}
      renderCanvas={(options) => {
        seen.push(options)
        return <div data-testid="canvas" />
      }}
      micActive={micActive}
      startMic={openStubMic}
      stopMic={() => setMicActive(false)}
      primeAudio={() => {}}
      audioRunning={() => true}
      isPlaying={isPlaying}
      isPaused={isPaused}
      onPlay={transport.onPlay}
      onPause={transport.onPause}
      onResume={transport.onResume}
      onStop={transport.onStop}
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
  return { transport, setPlaying, setPaused, canvas: () => seen, picker, log }
}

/** Put the room into a melody run the way loading a melody does. */
function startMelodyRun(room: Room): void {
  dispatchSingRoom({ type: 'melody-play' })
  room.transport.onPlay()
}

const dialogs = (): HTMLElement[] =>
  screen.queryAllByRole('dialog', { hidden: true })

beforeEach(() => {
  dispatchSingRoom({ type: 'leave' })
  setCurrentMelody(LOADED as Parameters<typeof setCurrentMelody>[0])
})

afterEach(() => {
  cleanup()
  dispatchSingRoom({ type: 'leave' })
})

describe('the room when the melody runs out', () => {
  it('leaves exactly one dialog when a sheet was open', async () => {
    // Review F4: the pill is a button during a run (R4), so "Your takes" can
    // be open when the transport ends. The card opened on top of it — two
    // `aria-modal` panels, two focus traps — and Back then closed the sheet
    // underneath while the card stayed.
    const room = mountRoom()
    startMelodyRun(room)
    fireEvent.click(screen.getByTestId('sing-note-chip'))
    expect(dialogs().length).toBe(1)

    // Not `handleStop`: the transport stopping ON ITS OWN is the whole of
    // the R1 path, and the only one that can produce two dialogs.
    room.transport.onStop()
    await Promise.resolve()
    await Promise.resolve()

    expect(singRoomContext().state).not.toBe('live')
    // The take here is too short to keep, so the card does not open and the
    // count is zero — the sheet is what this is about, and without the fix it
    // is still on screen with the run behind it over.
    expect(screen.queryByRole('dialog', { name: /your takes/iu })).toBeNull()
    expect(dialogs().length).toBe(0)
  })

  it('closes a picker that is two deep', async () => {
    // The song picker with the track modal on top of it — the one pair that
    // really can be open at the same time, which is why the run-out shuts
    // them in a loop rather than one step.
    const room = mountRoom()
    startMelodyRun(room)
    room.picker.setIsModalOpen(true)
    room.picker.setTrackModalSong({
      id: 'song',
      name: 'Song',
    } as Parameters<MidiSongPicker['setTrackModalSong']>[0])

    room.transport.onStop()
    await Promise.resolve()
    await Promise.resolve()

    expect(room.picker.trackModalSong()).toBeNull()
    expect(room.picker.isModalOpen()).toBe(false)
  })
})

describe('the resting preview', () => {
  it('is frozen, always', () => {
    // Review F8's third mutation: `frozen: () => false` on the preview was
    // green against the whole suite. Nothing on a resting canvas moves, and
    // an unfrozen one cleared and repainted a still picture 56 times a second
    // on a phone.
    const room = mountRoom()
    dispatchSingRoom({ type: 'melody-play' })
    dispatchSingRoom({ type: 'stop', hasTake: false })
    const preview = room
      .canvas()
      .filter((options) => options.melody().length > 0 && !options.isPlaying())
    expect(preview.length).toBeGreaterThan(0)
    for (const options of preview) expect(options.frozen()).toBe(true)
  })
})

describe('"Play again"', () => {
  const openSongSheet = (): void => {
    fireEvent.click(screen.getByTestId('sing-song-chip'))
  }

  it('starts a run from rest', () => {
    const room = mountRoom()
    dispatchSingRoom({ type: 'melody-play' })
    dispatchSingRoom({ type: 'stop', hasTake: false })
    room.transport.onPlay.mockClear()
    openSongSheet()
    fireEvent.click(screen.getByRole('button', { name: /play again/iu }))
    expect(room.transport.onPlay).toHaveBeenCalledTimes(1)
    expect(singRoomContext().state).toBe('live')
  })

  it('restarts a run that is already live', () => {
    // Review F5: `melody-play` into a room already `live` is ignored by the
    // machine, so the button did nothing at all.
    const room = mountRoom()
    startMelodyRun(room)
    room.transport.onPlay.mockClear()
    openSongSheet()
    fireEvent.click(screen.getByRole('button', { name: /play again/iu }))
    expect(room.transport.onStop).toHaveBeenCalledTimes(1)
    expect(room.transport.onPlay).toHaveBeenCalledTimes(1)
    expect(singRoomContext().state).toBe('live')
  })

  it('restarts a paused run rather than resuming it', () => {
    // The other half: `melody-play` in `paused` read as a resume, so the
    // melody carried on from where the pause left it.
    const room = mountRoom()
    startMelodyRun(room)
    dispatchSingRoom({ type: 'pause' })
    room.transport.onPause()
    room.transport.onPlay.mockClear()
    openSongSheet()
    fireEvent.click(screen.getByRole('button', { name: /play again/iu }))
    expect(room.transport.onStop).toHaveBeenCalledTimes(1)
    expect(room.transport.onPlay).toHaveBeenCalledTimes(1)
    expect(singRoomContext().state).toBe('live')
  })
})

describe('"Remove" on the song sheet', () => {
  it('ends the run before it puts the melody down', () => {
    // Review F8's fourth mutation: with the two statements swapped the unload
    // lands first, `melodyRun()` and `ctx().melody` are both false by the
    // time the stop is asked for, and the transport is left running against a
    // melody the room has taken off the screen.
    const room = mountRoom()
    startMelodyRun(room)
    fireEvent.click(screen.getByTestId('sing-song-chip'))
    fireEvent.click(screen.getByRole('button', { name: /remove/iu }))
    expect(room.transport.onStop).toHaveBeenCalledTimes(1)
    // The ordering IS the assertion: the stop has to land while the melody
    // is still the thing the run was measured against. Swap the two and the
    // transport is stopped against a target the room has already put down.
    expect(room.log).toEqual(['stop melodyLoaded=true'])
    expect(singRoomContext().melody).toBe(false)
    expect(singRoomContext().melodyLoaded).toBe(false)
    expect(singRoomContext().state).not.toBe('live')
  })
})
