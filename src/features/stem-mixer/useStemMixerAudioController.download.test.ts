// ============================================================
// StemMixer — Download MIDI saves the panel's melody
// ============================================================
//
// The MIDI Melody panel holds one melody (vocal-notation.ts `panelMelody`),
// and its Download MIDI saves exactly that: the analysis with every edit,
// at the song's tempo. A host with no such panel passes no melody and keeps
// the raw detection at 120, as before.

import { createRoot, createSignal } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { MidiNoteEvent } from '@/lib/midi-generator'
import { buildMidiFile } from '@/lib/midi-generator'
import { isPitchedMidiSongTrack, parseMidiSong } from '@/lib/midi-song'
import type { EditableNote } from './pitch-edit-model'
import type { StemMixerAudioDeps } from './useStemMixerAudioController'
import { useStemMixerAudioController } from './useStemMixerAudioController'

const DETECTION: MidiNoteEvent[] = [{ midi: 57, tickOn: 0, tickOff: 960 }]

const EDITED: EditableNote[] = [
  { id: 'base-0', startBeat: 0.5, endBeat: 1.0, midi: 61 },
  { id: 'base-1', startBeat: 1.0, endBeat: 1.5, midi: 64 },
]

function track(label: string) {
  return {
    label,
    url: '',
    color: '#fff',
    buffer: null,
    gainNode: null,
    analyserNode: null,
    sourceNode: null,
    muted: false,
    soloed: false,
    volume: 1,
  }
}

function harness(shownMelody?: StemMixerAudioDeps['shownMelody']) {
  const [vocal, setVocal] = createSignal(track('Vocal'))
  const [instrumental, setInstrumental] = createSignal(track('Instrumental'))
  const [midi, setMidi] = createSignal(track('MIDI'))
  const [extras, setExtras] = createSignal<ReturnType<typeof track>[]>([])
  const [midiNotes, setMidiNotes] = createSignal<MidiNoteEvent[]>(DETECTION)
  const noop = (): void => undefined
  const deps = {
    vocal,
    setVocal,
    instrumental,
    setInstrumental,
    midi,
    setMidi,
    extras,
    setExtras,
    tracks: () => [vocal(), instrumental(), ...extras()],
    anySoloed: () => false,
    PITCH_WINDOW_FILL_RATIO: 0.8,
    midiNotes,
    setMidiNotes,
    shownMelody,
    canvas: {
      syncCanvasSizes: noop,
      drawWaveformOverview: noop,
      drawLiveWaveform: noop,
      drawPitchCanvas: noop,
      drawMidiCanvas: noop,
    },
    updateCurrentLine: noop,
    setCurrentLineIdx: noop,
    setUserScrolled: noop,
    micActive: () => false,
    getMicAnalyserNode: () => null,
    getMicPitchDetector: () => null,
    getMicPitchHistory: () => [],
    setMicPitch: noop,
    comparisonData: () => [],
    pushComparison: noop,
    markLoopIteration: noop,
    clearComparisonData: noop,
    resetMicPitchHistory: noop,
    computeScore: () => ({}),
    setScore: noop,
    setShowScore: noop,
    resetScore: noop,
    stems: {},
    songTitle: 'Goodbye to Spring.mp3',
    showNotification: noop,
  } as unknown as StemMixerAudioDeps

  let controller!: ReturnType<typeof useStemMixerAudioController>
  const dispose = createRoot((disposeRoot) => {
    controller = useStemMixerAudioController(deps)
    return disposeRoot
  })
  const download = () =>
    controller.handleDownload(
      midi() as unknown as Parameters<typeof controller.handleDownload>[0],
    )
  return { download, dispose }
}

let saved: { blob: Blob; name: string }[] = []

beforeEach(() => {
  saved = []
  let made: Blob | null = null
  vi.stubGlobal('URL', {
    ...URL,
    createObjectURL: (blob: Blob) => {
      made = blob
      return 'blob:midi'
    },
    revokeObjectURL: () => undefined,
  })
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    if (made !== null) saved.push({ blob: made, name: this.download })
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

/** jsdom's Blob has no arrayBuffer(); its FileReader reads one. */
const bytesOf = (blob: Blob): Promise<Uint8Array> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer))
    reader.onerror = () => reject(reader.error)
    reader.readAsArrayBuffer(blob)
  })

describe('Download MIDI', () => {
  it('saves the melody the panel shows, edits included, at the song tempo', async () => {
    const { download, dispose } = harness(() => ({ notes: EDITED, bpm: 92 }))

    await download()

    expect(saved.map((file) => file.name)).toEqual([
      'Goodbye_to_Spring_vocal_midi.mid',
    ])
    const song = parseMidiSong(await bytesOf(saved[0].blob))
    expect(song?.bpm).toBeCloseTo(92, 3)
    const notes = song?.tracks.find(isPitchedMidiSongTrack)?.notes ?? []
    expect(notes.map((note) => note.midi)).toEqual([61, 64])
    expect(notes.map((note) => (note.startBeat * 60) / 92)).toEqual([
      expect.closeTo(0.5, 2),
      expect.closeTo(1.0, 2),
    ])
    dispose()
  })

  it('writes an unknown tempo at 120', async () => {
    const { download, dispose } = harness(() => ({
      notes: EDITED,
      bpm: Number.NaN,
    }))

    await download()

    expect(parseMidiSong(await bytesOf(saved[0].blob))?.bpm).toBeCloseTo(120, 3)
    dispose()
  })

  it('saves nothing while the panel shows no notes', async () => {
    const { download, dispose } = harness(() => ({ notes: [], bpm: 92 }))

    await download()

    expect(saved).toEqual([])
    dispose()
  })

  it('keeps the raw detection at 120 for a host with no panel melody', async () => {
    const { download, dispose } = harness(() => null)

    await download()

    expect(await bytesOf(saved[0].blob)).toEqual(buildMidiFile(DETECTION, 120))
    dispose()
  })
})
