// ============================================================
// Note preview throttle — a spin is a glissando, not a flutter
// ============================================================
//
// The NoteDial retriggers the preview on every seat the pointer crosses —
// ~30 calls/s on a fast spin. Even with correct release envelopes (fixed
// alongside this), thirty 75 ms releases layered under new attacks read as
// mush. The throttle spaces retriggers by RETRIGGER_MS and always plays
// the LAST pick via a trailing timer, so the note the finger settles on is
// never swallowed — that trailing guarantee is the part a naive throttle
// gets wrong.

import { createRoot } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useNotePreview } from '@/lib/use-note-preview'

const previewNote = vi.fn(async (_freq: number, _ms: number) => 1)
const stopNote = vi.fn()

vi.mock('@/stores/app-store', () => ({
  initAudioEngine: async () => ({
    previewNote: (freq: number, ms: number) => previewNote(freq, ms),
    stopNote: (id: number) => stopNote(id),
  }),
}))

const flush = async (): Promise<void> => {
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
}

describe('useNotePreview throttle', () => {
  let nowMs = 0
  let dispose: () => void
  let preview: (note: string) => void

  beforeEach(() => {
    vi.useFakeTimers()
    nowMs = 10_000
    vi.spyOn(performance, 'now').mockImplementation(() => nowMs)
    previewNote.mockClear()
    stopNote.mockClear()
    createRoot((d) => {
      dispose = d
      preview = useNotePreview()
    })
  })

  afterEach(() => {
    dispose()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('plays the first pick immediately', async () => {
    preview('A3')
    await flush()
    expect(previewNote).toHaveBeenCalledOnce()
  })

  it('coalesces a burst and always sounds the last pick', async () => {
    preview('A3') // t=0: plays
    await flush()
    nowMs += 20
    preview('B3') // t=20: inside the window — held
    nowMs += 20
    preview('C4') // t=40: replaces the held note
    await flush()
    expect(previewNote).toHaveBeenCalledOnce()

    // The window opened 80ms after the first trigger: the trailing timer
    // fires with the LAST pick, C4 (~261.6 Hz), not the discarded B3.
    nowMs += 40
    await vi.advanceTimersByTimeAsync(60)
    await flush()
    expect(previewNote).toHaveBeenCalledTimes(2)
    expect(previewNote.mock.calls[1]![0]).toBeCloseTo(261.63, 1)
  })

  it('plays picks spaced past the window without delay', async () => {
    preview('A3')
    await flush()
    nowMs += 100
    preview('B3')
    await flush()
    expect(previewNote).toHaveBeenCalledTimes(2)
  })

  it('stops the previous voice when the next one plays', async () => {
    previewNote.mockResolvedValueOnce(7).mockResolvedValueOnce(8)
    preview('A3')
    await flush()
    nowMs += 100
    preview('B3')
    await flush()
    expect(stopNote).toHaveBeenCalledWith(7)
  })

  it('does nothing while disabled, and skips unparseable notes', async () => {
    let gate = false
    let gated!: (note: string) => void
    const d = createRoot((innerDispose) => {
      gated = useNotePreview(() => gate)
      return innerDispose
    })
    gated('A3')
    await flush()
    expect(previewNote).not.toHaveBeenCalled()
    gate = true
    gated('not-a-note')
    await flush()
    expect(previewNote).not.toHaveBeenCalled()
    d()
  })

  it('reports onPlay only when a tone actually sounds', async () => {
    const played: string[] = []
    let p!: (note: string) => void
    const d = createRoot((innerDispose) => {
      p = useNotePreview(
        () => true,
        (n) => played.push(n),
      )
      return innerDispose
    })
    p('A3') // plays now
    nowMs += 20
    p('B3') // held by the throttle — a pulse here would claim a silent tone
    expect(played).toEqual(['A3'])
    nowMs += 60
    await vi.advanceTimersByTimeAsync(60)
    expect(played).toEqual(['A3', 'B3'])
    d()
  })

  it('cleanup cancels the trailing pick and silences the sounding one', async () => {
    preview('A3')
    await flush()
    nowMs += 20
    preview('B3') // held in the trailing timer
    dispose()
    await vi.advanceTimersByTimeAsync(200)
    await flush()
    // The held pick never fires after disposal…
    expect(previewNote).toHaveBeenCalledOnce()
    // …and the note that WAS sounding is stopped.
    expect(stopNote).toHaveBeenCalledWith(1)
    // Guard against double-dispose noise in afterEach.
    dispose = () => {}
  })
})
