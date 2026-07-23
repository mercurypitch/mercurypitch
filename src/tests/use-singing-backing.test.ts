// Tests for useSingingBacking — the karaoke backing scheduler. It rides the
// playback runtime's `beat` event, fires audioEngine.playNote as the playhead
// crosses each backing note, tracks ONLY its own voice ids, and silences them
// on pause / stop / seek without touching the reference tone (which it never
// plays). Seeks are detected as beat jumps.

import { createRoot, createSignal } from 'solid-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { BackingNote } from '@/features/playback/useSingingBacking'
import { useSingingBacking } from '@/features/playback/useSingingBacking'
import type { AudioEngine } from '@/lib/audio-engine'
import type { PlaybackRuntime } from '@/lib/playback-runtime'

// Let queued Solid effects + the playNote().then(track id) microtask settle.
const flush = () => new Promise((r) => setTimeout(r, 0))

describe('useSingingBacking', () => {
  let emitBeat: (beat: number) => void
  let playNoteWithGain: ReturnType<typeof vi.fn>
  let stopNote: ReturnType<typeof vi.fn>
  let setIsPlaying: (v: boolean) => void
  let dispose: () => void
  let api: ReturnType<typeof useSingingBacking>
  let nextVoiceId: number

  const setup = (opts?: { bpm?: number; playing?: boolean }) => {
    nextVoiceId = 100
    playNoteWithGain = vi.fn(() => Promise.resolve(nextVoiceId++))
    stopNote = vi.fn()

    let beatHandler: ((e: { beat: number }) => void) | undefined
    const runtime = {
      on: (event: string, h: (e: { beat: number }) => void) => {
        if (event === 'beat') beatHandler = h
      },
      off: (event: string) => {
        if (event === 'beat') beatHandler = undefined
      },
    } as unknown as PlaybackRuntime
    emitBeat = (beat) => beatHandler?.({ beat })

    const audioEngine = {
      playNoteWithGain,
      stopNote,
    } as unknown as AudioEngine

    createRoot((d) => {
      dispose = d
      const [isPlaying, _setIsPlaying] = createSignal(opts?.playing ?? true)
      const [bpm] = createSignal(opts?.bpm ?? 60)
      setIsPlaying = _setIsPlaying
      api = useSingingBacking({
        playbackRuntime: runtime,
        audioEngine,
        isPlaying,
        bpm,
      })
    })
  }

  afterEach(() => {
    dispose?.()
  })

  const notes: BackingNote[] = [
    { freq: 220, startBeat: 1, duration: 1 },
    { freq: 330, startBeat: 2, duration: 2 },
    { freq: 440, startBeat: 6, duration: 1 },
  ]

  it('fires a backing note as the playhead crosses its startBeat', async () => {
    setup({ bpm: 60 }) // 1 beat = 1000ms
    api.setBacking(notes)
    emitBeat(0.5) // before any note
    expect(playNoteWithGain).not.toHaveBeenCalled()
    emitBeat(1) // crosses note @ beat 1
    expect(playNoteWithGain).toHaveBeenCalledTimes(1)
    expect(playNoteWithGain).toHaveBeenCalledWith(220, 1000, 0.55) // duration 1 beat @ 60bpm
    await flush()
  })

  it('does not fire while paused', () => {
    setup({ playing: false })
    api.setBacking(notes)
    emitBeat(1)
    emitBeat(2)
    expect(playNoteWithGain).not.toHaveBeenCalled()
  })

  it('stops its own voices when playback pauses, leaving stopNote scoped', async () => {
    setup()
    api.setBacking(notes)
    emitBeat(1)
    emitBeat(2)
    await flush() // let the two playNote ids get tracked
    expect(playNoteWithGain).toHaveBeenCalledTimes(2)
    setIsPlaying(false)
    await flush() // let the isPlaying effect run
    expect(stopNote).toHaveBeenCalledTimes(2)
    expect(stopNote.mock.calls.map((c) => c[0]).sort()).toEqual([100, 101])
  })

  it('treats a forward jump as a seek: skips passed notes, no burst', async () => {
    setup()
    api.setBacking(notes)
    emitBeat(0)
    emitBeat(5) // jump > 1.5 beats → seek; notes @1 and @2 marked past silently
    expect(playNoteWithGain).not.toHaveBeenCalled()
    emitBeat(6) // now crosses note @ beat 6 normally
    expect(playNoteWithGain).toHaveBeenCalledTimes(1)
    expect(playNoteWithGain).toHaveBeenCalledWith(440, 1000, 0.55)
    await flush()
  })

  it('treats a backward jump as a seek and silences sounding voices', async () => {
    setup()
    api.setBacking(notes)
    emitBeat(1)
    emitBeat(2)
    await flush()
    expect(playNoteWithGain).toHaveBeenCalledTimes(2)
    emitBeat(0.5) // backward → seek: stop voices, re-mark
    expect(stopNote).toHaveBeenCalledTimes(2)
  })

  it('setBacking flushes outstanding voices and resets scheduling', async () => {
    setup()
    api.setBacking(notes)
    emitBeat(1)
    await flush()
    expect(playNoteWithGain).toHaveBeenCalledTimes(1)
    api.setBacking([{ freq: 550, startBeat: 0.5, duration: 1 }])
    expect(stopNote).toHaveBeenCalledTimes(1) // silenced the first voice
    playNoteWithGain.mockClear()
    emitBeat(0.6) // fresh baseline crosses the new note → it fires
    expect(playNoteWithGain).toHaveBeenCalledWith(550, 1000, 0.55)
    await flush()
  })

  it('scales note duration by tempo (higher bpm → shorter ms)', async () => {
    setup({ bpm: 120 }) // 1 beat = 500ms
    api.setBacking([{ freq: 220, startBeat: 1, duration: 2 }])
    emitBeat(1)
    expect(playNoteWithGain).toHaveBeenCalledWith(220, 1000, 0.55) // 2 beats @120bpm = 1000ms
    await flush()
  })

  it('stops a voice whose async creation resolves after pause', async () => {
    let resolveVoice: (id: number) => void = () => {}
    setup()
    const pendingVoice = new Promise<number>((resolve) => {
      resolveVoice = resolve
    })
    playNoteWithGain.mockReturnValueOnce(pendingVoice)
    api.setBacking(notes)
    emitBeat(1)

    setIsPlaying(false)
    await flush()
    expect(stopNote).not.toHaveBeenCalled()

    resolveVoice(777)
    await flush()
    expect(stopNote).toHaveBeenCalledOnce()
    expect(stopNote).toHaveBeenCalledWith(777)
  })
})
