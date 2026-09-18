// ============================================================
// An imported MIDI keeps its own tempo (issue #813)
// ============================================================
//
// The Compose toolbar's Import MIDI read the file's Set Tempo and applied it to
// the transport, but the melody record it wrote kept the store default. The
// transport looked right for a moment; the record is what persists and what
// every other load path reads back, so the song returned at the wrong speed
// from the library, the session sequencer, the Singing tab and a reload.
//
// The tempo now travels on the same callback as the notes, so a host cannot
// store one without the other.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PianoRollEditor } from '@/lib/piano-roll'
import { buildMultiOctaveScale } from '@/lib/scale-data'
import type { MelodyItem } from '@/types'

vi.mock('@/stores/notifications-store', () => ({
  showNotification: vi.fn(),
}))

const { melodyStore } = await import('@/stores/melody-store')
const { bpm, setBpm } = await import('@/stores/transport-store')
const { useEditorController } =
  await import('@/features/editor/useEditorController')
const { AudioEngine } = await import('@/lib/audio-engine')

/** The store's own default for a freshly created melody (melody-store.ts). */
const STORE_DEFAULT_BPM = 80

function mockCanvasContext(): void {
  const makeCtx = (): CanvasRenderingContext2D => {
    const store: Record<string | symbol, unknown> = {}
    return new Proxy(store, {
      get(target, prop) {
        if (prop === 'then') return undefined
        if (prop in target) return target[prop]
        if (prop === 'measureText') return () => ({ width: 10 })
        if (prop === 'createLinearGradient')
          return () => ({ addColorStop: () => {} })
        if (typeof prop === 'symbol') return undefined
        return () => {}
      },
      set(target, prop, value) {
        target[prop] = value
        return true
      },
    }) as unknown as CanvasRenderingContext2D
  }
  HTMLCanvasElement.prototype.getContext = vi.fn(() =>
    makeCtx(),
  ) as unknown as typeof HTMLCanvasElement.prototype.getContext
}

/** An SMF type 0 with two notes, optionally preceded by a Set Tempo meta. */
function midiFile(tempoBpm: number | null): Uint8Array {
  const track: number[] = []
  if (tempoBpm !== null) {
    const micros = Math.round(60000000 / tempoBpm)
    track.push(
      0x00,
      0xff,
      0x51,
      0x03,
      (micros >> 16) & 0xff,
      (micros >> 8) & 0xff,
      micros & 0xff,
    )
  }
  // C4 for one beat, then E4 for one beat (480 ticks per beat).
  track.push(0x00, 0x90, 60, 80)
  track.push(0x83, 0x60, 0x80, 60, 0x00)
  track.push(0x00, 0x90, 64, 80)
  track.push(0x83, 0x60, 0x80, 64, 0x00)
  track.push(0x00, 0xff, 0x2f, 0x00)

  return new Uint8Array([
    0x4d,
    0x54,
    0x68,
    0x64,
    0,
    0,
    0,
    6,
    0,
    0,
    0,
    1,
    0x01,
    0xe0,
    0x4d,
    0x54,
    0x72,
    0x6b,
    (track.length >> 24) & 0xff,
    (track.length >> 16) & 0xff,
    (track.length >> 8) & 0xff,
    track.length & 0xff,
    ...track,
  ])
}

/** jsdom's File carries no arrayBuffer(), which is all the handler reads. */
function fakeFile(data: Uint8Array, name: string): File {
  return {
    name,
    type: 'audio/midi',
    arrayBuffer: async () =>
      data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength),
  } as unknown as File
}

type ImportHandler = (
  melody: MelodyItem[],
  name: string,
  importedBpm?: number,
) => void

/** Mount an editor and push a file through its toolbar import input. */
async function importThroughToolbar(
  data: Uint8Array,
  fileName: string,
  onMelodyImport: ImportHandler,
): Promise<void> {
  const container = document.createElement('div')
  document.body.appendChild(container)
  new PianoRollEditor({
    container,
    scale: buildMultiOctaveScale('C', 3, 2, 'major'),
    bpm: bpm(),
    totalBeats: 16,
    onMelodyImport,
  })

  const input = container.querySelector('input[type=file]') as HTMLInputElement
  Object.defineProperty(input, 'files', {
    value: [fakeFile(data, fileName)],
    configurable: true,
  })
  input.dispatchEvent(new Event('change'))
  // The handler reads the file asynchronously.
  await new Promise((resolve) => setTimeout(resolve, 0))
}

/** The Compose tab's own wiring: the roll's import goes to the controller. */
function composeHost(): ImportHandler {
  const controller = useEditorController({ audioEngine: new AudioEngine() })
  return (melody, name, importedBpm) => {
    controller.applyImportedMelody(melody, name, importedBpm)
  }
}

describe('Compose toolbar MIDI import', () => {
  beforeEach(() => {
    localStorage.clear()
    melodyStore.resetMelodyLibrary()
    mockCanvasContext()
    setBpm(STORE_DEFAULT_BPM)
  })

  it("hands the host the file's tempo along with its notes", async () => {
    const onMelodyImport = vi.fn()
    await importThroughToolbar(
      midiFile(90),
      'mp-launch-melody.mid',
      onMelodyImport,
    )

    expect(onMelodyImport).toHaveBeenCalledTimes(1)
    const [melody, name, importedBpm] = onMelodyImport.mock.calls[0]
    expect(melody).toHaveLength(2)
    expect(name).toBe('mp-launch-melody')
    expect(importedBpm).toBe(90)
  })

  it("writes the file's tempo onto the melody record, not just the transport", async () => {
    await importThroughToolbar(
      midiFile(90),
      'mp-launch-melody.mid',
      composeHost(),
    )

    const imported = melodyStore.currentMelody()
    expect(imported?.bpm).toBe(90)
    expect(bpm()).toBe(90)
  })

  it('still lands the notes under the file name', async () => {
    await importThroughToolbar(
      midiFile(90),
      'mp-launch-melody.mid',
      composeHost(),
    )

    const imported = melodyStore.currentMelody()
    expect(imported?.name).toBe('mp-launch-melody')
    expect(imported?.items).toHaveLength(2)
  })

  it('leaves the transport alone when the file declares no tempo', async () => {
    setBpm(132)
    await importThroughToolbar(midiFile(null), 'no-tempo.mid', composeHost())

    expect(bpm()).toBe(132)
    expect(melodyStore.currentMelody()?.items).toHaveLength(2)
  })
})

describe('applyImportedMelody', () => {
  beforeEach(() => {
    localStorage.clear()
    melodyStore.resetMelodyLibrary()
    setBpm(STORE_DEFAULT_BPM)
  })

  function controller() {
    return useEditorController({ audioEngine: new AudioEngine() })
  }

  function notes(): MelodyItem[] {
    return [
      {
        id: 1,
        note: { midi: 60, name: 'C', octave: 4, freq: 261.63 },
        startBeat: 0,
        duration: 1,
      },
    ]
  }

  it('applies one parsed tempo to both the record and the transport', () => {
    controller().applyImportedMelody(notes(), 'imported', 90)

    expect(melodyStore.currentMelody()?.bpm).toBe(90)
    expect(bpm()).toBe(90)
  })

  it('does not invent a tempo for a file that declares none', () => {
    setBpm(132)
    controller().applyImportedMelody(notes(), 'imported', undefined)

    expect(bpm()).toBe(132)
    expect(melodyStore.currentMelody()?.bpm).toBe(STORE_DEFAULT_BPM)
  })
})
