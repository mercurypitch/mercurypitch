// The karaoke key controller: which key a song opens in, where a change is
// remembered, and "find my key".
import type { Setter } from 'solid-js'
import { createRoot, createSignal } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { VoiceprintRecord } from '@/db/services/voiceprint-service'
import type { TimedNote } from '@/lib/key-shift/key-suggest'
import type { QueueEntry } from '@/stores/karaoke-playlist-store'
import type { VocalRangePreset } from '@/stores/settings-store'
import type { FindMyKeyResult } from './useStemMixerKeyController'

const fakes = vi.hoisted(() => ({
  takes: [] as VoiceprintRecord[],
  entryWrites: [] as Array<[string, string, number | undefined]>,
  onEntryWrite: null as
    | ((itemId: string, keyShift: number | undefined) => void)
    | null,
}))

vi.mock('@/db/services/voiceprint-service', () => ({
  listVoiceprints: () => Promise.resolve(fakes.takes),
}))

// A stateful stand-in for the playlist store: it records the write and moves
// the running queue entry, which is what the real one does first.
vi.mock('@/stores/karaoke-playlist-store', () => ({
  setItemKeyShift: (
    playlistId: string,
    itemId: string,
    keyShift: number | undefined,
  ) => {
    fakes.entryWrites.push([playlistId, itemId, keyShift])
    fakes.onEntryWrite?.(itemId, keyShift)
    return Promise.resolve()
  },
}))

const { songMelody, useStemMixerKeyController, useStemMixerKeyView } =
  await import('./useStemMixerKeyController')
const { setSongKeyShift, songKeyShift } =
  await import('@/stores/karaoke-key-store')

const MELODY: TimedNote[] = [55, 57, 59, 60, 62, 64, 65, 67].map(
  (midi, index) => ({ midi, startTime: index, endTime: index + 1 }),
)

let songCounter = 0
const freshSong = () => `song-${++songCounter}`

function entry(partial: Partial<QueueEntry> & Pick<QueueEntry, 'sessionId'>) {
  return {
    songTitle: 'Song',
    itemId: 'item-1',
    itemKind: 'session',
    ...partial,
  } satisfies QueueEntry
}

interface Harness {
  controller: ReturnType<typeof useStemMixerKeyController>
  setSessionId: Setter<string>
  setMelody: Setter<readonly TimedNote[]>
  dispose: () => void
}

interface MountOptions {
  melody?: readonly TimedNote[]
  /** Runs as Pitch Studio's analysis would; null when it cannot run here. */
  detectMelody?: (
    setMelody: Setter<readonly TimedNote[]>,
  ) => Promise<void> | null
  notify?: (message: string, type: 'info' | 'success' | 'warning') => void
}

function mount(
  sessionId: string,
  queueEntry: QueueEntry | null = null,
  playlistId: string | null = queueEntry === null ? null : 'pl-1',
  options: MountOptions = {},
): Harness {
  return createRoot((dispose) => {
    const [session, setSessionId] = createSignal(sessionId)
    const [current, setCurrent] = createSignal<QueueEntry | null>(queueEntry)
    const [melody, setMelody] = createSignal<readonly TimedNote[]>(
      options.melody ?? MELODY,
    )
    const detect = options.detectMelody
    fakes.onEntryWrite = (itemId, keyShift) =>
      setCurrent((e) =>
        e !== null && e.itemId === itemId ? { ...e, keyShift } : e,
      )
    const controller = useStemMixerKeyController({
      sessionId: session,
      queueEntry: current,
      playlistId: () => playlistId,
      melody,
      detectMelody: detect === undefined ? undefined : () => detect(setMelody),
      notify: options.notify,
    })
    return { controller, setSessionId, setMelody, dispose }
  })
}

let harness: Harness | null = null
const start = (...args: Parameters<typeof mount>) => {
  harness = mount(...args)
  return harness.controller
}

beforeEach(() => {
  localStorage.clear()
  fakes.takes = []
  fakes.entryWrites = []
})

afterEach(() => {
  harness?.dispose()
  harness = null
})

describe('which key a song opens in', () => {
  it('takes the playlist entry’s key over the song’s own', () => {
    const song = freshSong()
    setSongKeyShift(song, -2)

    const controller = start(song, entry({ sessionId: song, keyShift: 3 }))

    expect(controller.keyShift()).toBe(3)
  })

  it('takes the song’s own key when the entry has none', () => {
    const song = freshSong()
    setSongKeyShift(song, -2)

    const controller = start(
      song,
      entry({ sessionId: song, itemKind: 'group' }),
    )

    expect(controller.keyShift()).toBe(-2)
  })

  it('opens in the original key when nothing was remembered', () => {
    expect(start(freshSong()).keyShift()).toBe(0)
  })

  it('follows the next song to its own key', () => {
    const first = freshSong()
    const second = freshSong()
    setSongKeyShift(second, 4)
    const controller = start(first)

    harness?.setSessionId(second)

    expect(controller.keyShift()).toBe(4)
  })
})

describe('where a change is remembered', () => {
  it('writes a single-song entry’s key back to that entry', () => {
    const song = freshSong()
    const controller = start(song, entry({ sessionId: song, itemId: 'turn-7' }))

    controller.setKeyShift(2)

    expect(fakes.entryWrites).toEqual([['pl-1', 'turn-7', 2]])
    expect(controller.keyShift()).toBe(2)
    expect(songKeyShift(song)).toBeUndefined()
  })

  it('writes to the song itself during a group entry with no key of its own', () => {
    const song = freshSong()
    const controller = start(
      song,
      entry({ sessionId: song, itemKind: 'group' }),
    )

    controller.setKeyShift(-3)

    expect(fakes.entryWrites).toEqual([])
    expect(songKeyShift(song)).toBe(-3)
    expect(controller.keyShift()).toBe(-3)
  })

  it('writes to a group entry that already carries a key', () => {
    const song = freshSong()
    const controller = start(
      song,
      entry({ sessionId: song, itemKind: 'group', keyShift: 1 }),
    )

    controller.setKeyShift(2)

    expect(fakes.entryWrites).toEqual([['pl-1', 'item-1', 2]])
    expect(controller.keyShift()).toBe(2)
  })

  it('writes to the song outside a playlist, clamped to ±6', () => {
    const song = freshSong()
    const controller = start(song)

    controller.setKeyShift(9)

    expect(songKeyShift(song)).toBe(6)
    expect(controller.keyShift()).toBe(6)
  })
})

describe('find my key', () => {
  it('asks for a voice type when no range is known, then applies the fit', async () => {
    const controller = start(freshSong())
    await Promise.resolve()

    expect(controller.rangeKnown()).toBe(false)
    expect(controller.findMyKey()).toBe('needs-range')
    expect(controller.keyShift()).toBe(0)

    controller.applyVoiceType('bass')

    expect(controller.rangeKnown()).toBe(true)
    const suggested = controller.suggestion()?.keyShift
    expect(suggested).toBeLessThan(0)
    expect(controller.keyShift()).toBe(suggested)
  })

  it('applies the fit for a measured range straight away', async () => {
    fakes.takes = [
      {
        id: 'take',
        takenAt: '2026-09-20',
        twin: null,
        source: 'mirror',
        summary: {
          lowMidi: 45,
          highMidi: 67,
          semitones: 22,
          accuracy: null,
          steadiness: null,
        },
      },
    ]
    const controller = start(freshSong())

    await vi.waitFor(() => expect(controller.rangeKnown()).toBe(true))

    expect(controller.findMyKey()).toBe('applied')
    expect(controller.keyShift()).toBe(controller.suggestion()?.keyShift)
    expect(controller.keyShift()).not.toBe(0)
  })

  it('reads a range measured in another tab once this one is shown again', async () => {
    const controller = start(freshSong())
    await Promise.resolve()
    expect(controller.findMyKey()).toBe('needs-range')

    fakes.takes = [
      {
        id: 'measured-meanwhile',
        takenAt: '2026-09-23',
        twin: null,
        source: 'mirror',
        summary: {
          lowMidi: 45,
          highMidi: 67,
          semitones: 22,
          accuracy: null,
          steadiness: null,
        },
      },
    ]
    const visibility = vi
      .spyOn(document, 'visibilityState', 'get')
      .mockReturnValue('visible')
    document.dispatchEvent(new Event('visibilitychange'))

    await vi.waitFor(() => expect(controller.rangeKnown()).toBe(true))
    expect(controller.findMyKey()).toBe('applied')
    visibility.mockRestore()
  })

  it('opens the voice-type picker for a singer with no range, and closes it on a pick', async () => {
    const controller = start(freshSong())
    await Promise.resolve()

    expect(controller.findMyKey()).toBe('needs-range')
    expect(controller.voiceTypePickerOpen()).toBe(true)

    expect(controller.applyVoiceType('bass')).toBe('applied')
    expect(controller.voiceTypePickerOpen()).toBe(false)
  })

  it('detects the melody first when there is none, then applies the fit and says so', async () => {
    const notify = vi.fn<(message: string, type: string) => void>()
    // The analysis lands its notes later, as the real one does.
    const detectMelody = vi.fn((setMelody: Setter<readonly TimedNote[]>) =>
      Promise.resolve().then(() => {
        setMelody(MELODY)
      }),
    )
    harness = mount(freshSong(), null, null, {
      melody: [],
      detectMelody,
      notify,
    })
    const controller = harness.controller

    expect(controller.applyVoiceType('bass')).toBe('detecting')
    expect(controller.findMyKey()).toBe('detecting')
    expect(detectMelody).toHaveBeenCalledTimes(1)

    await vi.waitFor(() => expect(controller.keyShift()).not.toBe(0))
    expect(controller.keyShift()).toBe(controller.suggestion()?.keyShift)
    expect(notify).toHaveBeenCalledWith(
      `Key ${String(controller.keyShift()).replace('-', '\u2212')} fits your voice.`,
      'success',
    )
  })

  it('keeps the key when no melody turns up, and says so', async () => {
    const notify = vi.fn<(message: string, type: string) => void>()
    harness = mount(freshSong(), null, null, {
      melody: [],
      detectMelody: () => Promise.resolve(),
      notify,
    })
    const controller = harness.controller
    controller.setKeyShift(2)

    expect(controller.applyVoiceType('tenor')).toBe('detecting')

    await vi.waitFor(() => expect(notify).toHaveBeenCalledTimes(1))
    expect(notify.mock.calls[0][1]).toBe('warning')
    expect(controller.keyShift()).toBe(2)
  })

  it('cannot fit where the melody cannot be detected', () => {
    harness = mount(freshSong(), null, null, {
      melody: [],
      detectMelody: () => null,
    })

    expect(harness.controller.applyVoiceType('alto')).toBe('no-melody')
    expect(harness.controller.keyShift()).toBe(0)
  })

  it('says so when there is no melody to fit yet', () => {
    const controller = start(freshSong())
    controller.applyVoiceType('tenor')
    harness?.setMelody([])
    controller.setKeyShift(1)

    expect(controller.findMyKey()).toBe('no-melody')
    expect(controller.keyShift()).toBe(1)
  })
})

describe('what the mixer shows', () => {
  const NOTES = [{ midi: 60 }, { midi: 64 }]
  const READINGS = [{ frequency: 440, noteName: 'A', octave: 4 }]
  const WORDS = [
    { midi: 64, noteName: 'E4' },
    { midi: null, noteName: null },
  ]

  function mountView() {
    return createRoot((dispose) => {
      const [keyShift, setKey] = createSignal(0)
      const [heard, setHeard] = createSignal(0)
      const [available, setAvailable] = createSignal(true)
      const [editMode, setEditMode] = createSignal(false)
      const [detected, setDetected] = createSignal<{
        keyName: string
        scaleType: string
      } | null>(null)
      const fit = {
        next: 'applied' as FindMyKeyResult,
        picked: [] as VocalRangePreset[],
      }
      const notices: Array<[string, string]> = []
      const view = useStemMixerKeyView({
        key: {
          keyShift,
          setKeyShift: (value) => setKey(value),
          suggestion: () => null,
          findMyKey: () => fit.next,
          applyVoiceType: (preset) => {
            fit.picked.push(preset)
            return fit.next
          },
        },
        heardShift: heard,
        engineAvailable: available,
        editMode,
        detectedKey: detected,
        notify: (message, type) => notices.push([message, type]),
      })
      return {
        view,
        notes: view.createShownNotes(() => NOTES),
        readings: view.createShownReadings(() => READINGS),
        words: view.createShownWords(() => WORDS),
        setHeard,
        setAvailable,
        setEditMode,
        setDetected,
        fit,
        notices,
        dispose,
      }
    })
  }

  let mounted: ReturnType<typeof mountView> | null = null
  const startView = () => (mounted = mountView())
  afterEach(() => {
    mounted?.dispose()
    mounted = null
  })

  it('moves the notes into the key being heard, and back', () => {
    const shown = startView()
    expect(shown.notes()).toBe(NOTES)

    shown.setHeard(2)
    expect(shown.notes().map((note) => note.midi)).toEqual([62, 66])

    shown.setHeard(0)
    expect(shown.notes()).toBe(NOTES)
  })

  it('moves the offline contour and the word glyphs with them', () => {
    const shown = startView()

    shown.setHeard(2)

    const [reading] = shown.readings()
    expect(reading.frequency).toBeCloseTo(493.88, 1)
    expect([reading.noteName, reading.octave]).toEqual(['B', 4])
    expect(shown.words()).toEqual([
      { midi: 66, noteName: 'F#4' },
      { midi: null, noteName: null },
    ])
  })

  it('names the key the stepper lands on, even while Pitch Studio plays the original', () => {
    const shown = startView()
    const { binding } = shown.view
    expect(binding.keyLabel()).toBeUndefined()

    shown.setDetected({ keyName: 'G', scaleType: 'major' })
    binding.onChange(2)
    expect(binding.value()).toBe(2)
    expect(binding.keyLabel()).toBe('A major')

    shown.setDetected({ keyName: 'A', scaleType: 'natural-minor' })
    binding.onChange(-2)
    expect(binding.keyLabel()).toBe('G minor')
  })

  it('says why the key cannot change right now', () => {
    const shown = startView()
    const { binding } = shown.view
    expect(binding.disabledReason()).toBeUndefined()

    shown.setEditMode(true)
    expect(binding.disabledReason()).toBe(
      'Pitch Studio plays the song in its own key',
    )

    shown.setAvailable(false)
    expect(binding.disabledReason()).toBe(
      'Changing the key is not available right now',
    )
  })

  it('says so when find my key has to find the melody first, or cannot', () => {
    const shown = startView()
    const results: FindMyKeyResult[] = [
      'detecting',
      'no-melody',
      'applied',
      'needs-range',
    ]

    for (const result of results) {
      shown.fit.next = result
      shown.view.binding.onFindKey()
    }

    expect(shown.notices).toEqual([
      ['Finding the melody first. This takes a moment.', 'info'],
      [
        "Find my key needs the song's melody, and it cannot be found on this device. Set the key with − and + instead.",
        'info',
      ],
    ])
  })

  it('fits a picked voice type the way find my key does', () => {
    const shown = startView()
    shown.fit.next = 'detecting'

    shown.view.pickVoiceType('tenor')

    expect(shown.fit.picked).toEqual(['tenor'])
    expect(shown.notices).toEqual([
      ['Finding the melody first. This takes a moment.', 'info'],
    ])
  })
})

describe('songMelody', () => {
  const GUIDE = [{ midi: 40, tickOn: 0, tickOff: 480 }]

  it('fits the sung notes when Pitch Studio has them', () => {
    expect(
      songMelody([{ midi: 60, startBeat: 1, endBeat: 1.5 }], GUIDE),
    ).toEqual([{ midi: 60, startTime: 1, endTime: 1.5 }])
  })

  it('falls back to the MIDI guide', () => {
    expect(songMelody([], GUIDE)).toEqual([
      { midi: 40, startTime: 0, endTime: 480 },
    ])
  })
})
