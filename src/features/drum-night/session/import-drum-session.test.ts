// Drum Night import tests — canonical MIDI/GP routing and honest terminal states.

import { describe, expect, it, vi } from 'vitest'
import type { MidiSong } from '@/lib/midi-song'
import { parseMidiSong } from '@/lib/midi-song'
import { drumSongFixture, percussionTrackFixture, } from './drum-session.test-fixtures'
import { DrumSessionImportError } from './drum-session-import-client'
import type { DrumSessionParserOutcome } from './import-drum-session'
import { createDrumSessionImportController, importDrumSession, MAX_DRUM_SESSION_FILE_BYTES, } from './import-drum-session'

function midiHeader(trackCount: number): number[] {
  return [0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 1, 0, trackCount, 1, 0xe0]
}

function midiTrack(events: readonly number[]): number[] {
  const body = [...events, 0, 0xff, 0x2f, 0]
  return [0x4d, 0x54, 0x72, 0x6b, 0, 0, 0, body.length, ...body]
}

function note(channel: number, midi: number, velocity: number): number[] {
  return [
    0,
    0x90 | channel,
    midi,
    velocity,
    0x83,
    0x60,
    0x80 | channel,
    midi,
    0,
  ]
}

function midiFile(bytes: Uint8Array, name: string): File {
  const buffer = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(buffer).set(bytes)
  const file = new File([buffer], name, { type: 'audio/midi' })
  Object.defineProperty(file, 'arrayBuffer', {
    configurable: true,
    value: async () => buffer.slice(0),
  })
  return file
}

function mixedMidiFile(): File {
  return midiFile(
    new Uint8Array([
      ...midiHeader(2),
      ...midiTrack(note(0, 48, 90)),
      ...midiTrack(note(9, 38, 83)),
    ]),
    'mixed.mid',
  )
}

describe('importDrumSession', () => {
  it('opens mixed Standard MIDI through the canonical percussion projector', async () => {
    const state = await importDrumSession(mixedMidiFile(), {
      parseMidi: (bytes) => {
        const song = parseMidiSong(bytes)
        return song === null
          ? { status: 'unreadable' }
          : { status: 'parsed', song }
      },
    })

    expect(state.status).toBe('ready')
    if (state.status !== 'ready') return
    expect(state.document.sourceFormat).toBe('midi')
    expect(state.document.pitchedTrackCount).toBe(1)
    expect(state.document.percussionTracks).toHaveLength(1)
    expect(state.document.percussionTracks[0]?.percussionHits[0]).toEqual(
      expect.objectContaining({
        gmKey: 38,
        velocity: 83,
        source: expect.objectContaining({ channel: 9, midiKey: 38 }),
      }),
    )
    expect(state.document.canonicalSong.tracks).toHaveLength(2)
  })

  it('opens a percussion-only GPX result without requiring a pitched part', async () => {
    const parseGuitarPro = vi.fn(async () => ({
      status: 'parsed' as const,
      song: drumSongFixture(),
      name: 'Studio Pocket',
    }))
    const file = new File(['GPX'], 'studio-pocket.gpx')

    const state = await importDrumSession(file, { parseGuitarPro })

    expect(parseGuitarPro).toHaveBeenCalledWith(file, {})
    expect(state).toEqual(
      expect.objectContaining({
        status: 'ready',
        document: expect.objectContaining({
          title: 'Studio Pocket',
          sourceFormat: 'guitar-pro',
          pitchedTrackCount: 0,
          hitCount: 4,
        }),
      }),
    )
  })

  it('keeps a pitched-only file out of a false drum session', async () => {
    const song: MidiSong = drumSongFixture({
      includePitched: true,
      percussionTracks: [],
    })

    const state = await importDrumSession(
      midiFile(new Uint8Array([1]), 'lead.mid'),
      { parseMidi: () => ({ status: 'parsed', song }) },
    )

    expect(state).toEqual({
      status: 'no-drums',
      fileName: 'lead.mid',
      pitchedTrackCount: 1,
    })
  })

  it('retains a pitched-only file when the play-along boundary opts in', async () => {
    const song: MidiSong = drumSongFixture({
      includePitched: true,
      percussionTracks: [],
    })

    const state = await importDrumSession(
      midiFile(new Uint8Array([1]), 'backing.mid'),
      { parseMidi: () => ({ status: 'parsed', song }) },
      { allowPitchedOnly: true },
    )

    expect(state).toEqual(
      expect.objectContaining({
        status: 'ready',
        document: expect.objectContaining({
          title: 'backing',
          pitchedTrackCount: 1,
          hitCount: 0,
          percussionTracks: [],
        }),
      }),
    )
  })

  it('reports a dropped-only drum track instead of substituting a sound', async () => {
    const song = drumSongFixture({
      percussionTracks: [
        percussionTrackFixture({ hits: [], droppedHitCount: 3 }),
      ],
    })

    const state = await importDrumSession(
      midiFile(new Uint8Array([1]), 'vendor-drums.mid'),
      { parseMidi: () => ({ status: 'parsed', song }) },
    )

    expect(state).toEqual({
      status: 'unsupported',
      fileName: 'vendor-drums.mid',
      reason: 'drum-mapping',
      droppedHitCount: 3,
    })
  })

  it('identifies an empty supported file before parsing', async () => {
    const state = await importDrumSession(new File([], 'empty.mid'))

    expect(state).toEqual({ status: 'empty', fileName: 'empty.mid' })
  })

  it.each(['oversized.mid', 'oversized.gpx'])(
    'rejects %s before reading or invoking either parser',
    async (fileName) => {
      const file = new File(['x'], fileName)
      const arrayBuffer = vi.fn(async () => new ArrayBuffer(1))
      Object.defineProperties(file, {
        size: { configurable: true, value: MAX_DRUM_SESSION_FILE_BYTES + 1 },
        arrayBuffer: { configurable: true, value: arrayBuffer },
      })
      const parseMidi = vi.fn<() => DrumSessionParserOutcome>()
      const parseGuitarPro = vi.fn<() => DrumSessionParserOutcome>()

      const state = await importDrumSession(file, {
        parseMidi,
        parseGuitarPro,
      })

      expect(state).toEqual({
        status: 'too-large',
        fileName,
        actualBytes: MAX_DRUM_SESSION_FILE_BYTES + 1,
        maximumBytes: MAX_DRUM_SESSION_FILE_BYTES,
      })
      expect(arrayBuffer).not.toHaveBeenCalled()
      expect(parseMidi).not.toHaveBeenCalled()
      expect(parseGuitarPro).not.toHaveBeenCalled()
    },
  )

  it('keeps parser-proven musical emptiness distinct from malformed input', async () => {
    const empty = await importDrumSession(
      midiFile(new Uint8Array([1]), 'eventless.mid'),
      { parseMidi: () => ({ status: 'empty' }) },
    )
    const malformed = await importDrumSession(
      midiFile(new Uint8Array([1]), 'damaged.mid'),
      {
        parseMidi: () => ({
          status: 'malformed',
          message: 'The MIDI track chunk is incomplete.',
        }),
      },
    )

    expect(empty).toEqual({ status: 'empty', fileName: 'eventless.mid' })
    expect(malformed).toEqual({
      status: 'error',
      fileName: 'damaged.mid',
      message: 'The MIDI track chunk is incomplete.',
    })
  })

  it('rejects an unrelated file type before reading its bytes', async () => {
    const state = await importDrumSession(new File(['audio'], 'part.wav'))

    expect(state).toEqual({
      status: 'unsupported',
      fileName: 'part.wav',
      reason: 'file-type',
      droppedHitCount: 0,
    })
  })

  it('turns parser failure into recoverable source-format guidance', async () => {
    const state = await importDrumSession(new File(['GP5'], 'broken.gp5'), {
      parseGuitarPro: () => {
        throw new Error('parser detail')
      },
    })

    expect(state).toEqual({
      status: 'error',
      fileName: 'broken.gp5',
      message:
        'No readable musical events were found in this Guitar Pro file. It may be empty, damaged, or unsupported by the parser. Export it again and retry.',
    })
  })

  it('uses conservative copy when a parser cannot prove empty versus malformed', async () => {
    const state = await importDrumSession(
      midiFile(new Uint8Array([1]), 'ambiguous.mid'),
      { parseMidi: () => ({ status: 'unreadable' }) },
    )

    expect(state).toEqual({
      status: 'error',
      fileName: 'ambiguous.mid',
      message:
        'No readable musical events were found in this MIDI file. It may be empty, damaged, or unsupported by the parser. Export it again and retry.',
    })
  })

  it('recognises uppercase supported extensions without locale-sensitive rules', async () => {
    const state = await importDrumSession(
      midiFile(new Uint8Array([1]), 'POCKET.MIDI'),
      { parseMidi: () => ({ status: 'parsed', song: drumSongFixture() }) },
    )

    expect(state.status).toBe('ready')
  })

  it('passes the File to the Worker boundary without reading it on the UI thread', async () => {
    const file = midiFile(new Uint8Array([1]), 'worker.mid')
    const arrayBuffer = vi.spyOn(file, 'arrayBuffer')
    const importInWorker = vi.fn(async () => ({
      status: 'parsed' as const,
      song: drumSongFixture(),
    }))

    const state = await importDrumSession(file, { importInWorker })

    expect(state.status).toBe('ready')
    expect(importInWorker).toHaveBeenCalledWith(file, 'midi', {})
    expect(arrayBuffer).not.toHaveBeenCalled()
  })

  it('keeps complexity and timeout failures recoverable without partial state', async () => {
    const tooComplex = await importDrumSession(
      midiFile(new Uint8Array([1]), 'dense.mid'),
      {
        importInWorker: () =>
          Promise.reject(
            new DrumSessionImportError(
              'TOO_COMPLEX',
              'This part exceeds 32,768 events. Nothing was partially loaded.',
            ),
          ),
      },
    )
    const timedOut = await importDrumSession(
      midiFile(new Uint8Array([1]), 'slow.mid'),
      {
        importInWorker: () =>
          Promise.reject(
            new DrumSessionImportError(
              'TIMED_OUT',
              'This part took too long. Nothing was partially loaded.',
            ),
          ),
      },
    )

    expect(tooComplex).toEqual({
      status: 'error',
      fileName: 'dense.mid',
      message: 'This part exceeds 32,768 events. Nothing was partially loaded.',
    })
    expect(timedOut).toEqual({
      status: 'error',
      fileName: 'slow.mid',
      message: 'This part took too long. Nothing was partially loaded.',
    })
  })
})

describe('createDrumSessionImportController', () => {
  it('never lets a stale slow import replace a newer selection', async () => {
    let resolveSlow: ((outcome: DrumSessionParserOutcome) => void) | undefined
    let resolveFast: ((outcome: DrumSessionParserOutcome) => void) | undefined
    const slow = new Promise<DrumSessionParserOutcome>((resolve) => {
      resolveSlow = resolve
    })
    const fast = new Promise<DrumSessionParserOutcome>((resolve) => {
      resolveFast = resolve
    })
    const importSignals: AbortSignal[] = []
    const parseMidi = vi
      .fn<
        (
          bytes: Uint8Array,
          options?: { signal?: AbortSignal },
        ) => Promise<DrumSessionParserOutcome>
      >()
      .mockImplementation((bytes, options) => {
        if (options?.signal !== undefined) importSignals.push(options.signal)
        return bytes[0] === 1 ? slow : fast
      })
    const controller = createDrumSessionImportController({ parseMidi })
    const stateChanges = vi.fn()
    controller.subscribe(stateChanges)

    const olderAttempt = controller.importFile(
      midiFile(new Uint8Array([1]), 'older.mid'),
    )
    await Promise.resolve()
    const newerAttempt = controller.importFile(
      midiFile(new Uint8Array([2]), 'newer.mid'),
    )
    await Promise.resolve()
    expect(importSignals[0]?.aborted).toBe(true)
    expect(importSignals[1]?.aborted).toBe(false)
    resolveFast?.({ status: 'parsed', song: drumSongFixture() })
    const newer = await newerAttempt

    expect(newer.status).toBe('applied')
    expect(controller.state()).toEqual(
      expect.objectContaining({
        status: 'ready',
        document: expect.objectContaining({ fileName: 'newer.mid' }),
      }),
    )

    resolveSlow?.({ status: 'empty' })
    const older = await olderAttempt

    expect(older).toEqual(
      expect.objectContaining({ status: 'stale', generation: 1 }),
    )
    expect(controller.state()).toEqual(
      expect.objectContaining({
        status: 'ready',
        document: expect.objectContaining({ fileName: 'newer.mid' }),
      }),
    )
    expect(stateChanges).toHaveBeenCalledTimes(3)
  })

  it('invalidates a slow import when the owner cancels', async () => {
    let resolveParse: ((outcome: DrumSessionParserOutcome) => void) | undefined
    const parse = new Promise<DrumSessionParserOutcome>((resolve) => {
      resolveParse = resolve
    })
    let importSignal: AbortSignal | undefined
    const controller = createDrumSessionImportController({
      parseMidi: (_bytes, options) => {
        importSignal = options?.signal
        return parse
      },
    })
    const attempt = controller.importFile(
      midiFile(new Uint8Array([1]), 'slow.mid'),
    )
    await Promise.resolve()

    expect(controller.state()).toEqual({
      status: 'loading',
      fileName: 'slow.mid',
    })
    expect(controller.generation()).toBe(1)
    controller.cancel()
    expect(importSignal?.aborted).toBe(true)
    expect(controller.state()).toEqual({ status: 'idle' })
    expect(controller.generation()).toBe(2)

    resolveParse?.({ status: 'parsed', song: drumSongFixture() })
    await expect(attempt).resolves.toEqual(
      expect.objectContaining({ status: 'stale', generation: 1 }),
    )
    expect(controller.state()).toEqual({ status: 'idle' })
  })

  it('invalidates a slow import and silences subscribers after disposal', async () => {
    let resolveParse: ((outcome: DrumSessionParserOutcome) => void) | undefined
    const parse = new Promise<DrumSessionParserOutcome>((resolve) => {
      resolveParse = resolve
    })
    let importSignal: AbortSignal | undefined
    const controller = createDrumSessionImportController({
      parseMidi: (_bytes, options) => {
        importSignal = options?.signal
        return parse
      },
    })
    const listener = vi.fn()
    controller.subscribe(listener)
    const attempt = controller.importFile(
      midiFile(new Uint8Array([1]), 'disposed.mid'),
    )
    await Promise.resolve()

    expect(listener).toHaveBeenCalledTimes(1)
    controller.dispose()
    expect(importSignal?.aborted).toBe(true)
    expect(controller.generation()).toBe(2)
    resolveParse?.({ status: 'parsed', song: drumSongFixture() })

    await expect(attempt).resolves.toEqual(
      expect.objectContaining({ status: 'stale', generation: 1 }),
    )
    expect(listener).toHaveBeenCalledTimes(1)
  })
})
