// ============================================================
// Melody audition controller — toggle, playhead following, autoplay policy
// ============================================================
//
// The invariant worth pinning is the autoplay one: the synth is resumed from
// the toggle, which is the user gesture, and never on the way back down.
// Verified by mutation — calling resume() on every toggle turns that test red.
//
// The rest is straightforward playhead behaviour. Noted because the opposite
// was assumed while writing this: reordering the effect's `elapsed` read does
// NOT turn anything here red, because `enabled` is tracked and a toggle
// re-runs the effect by itself. No test below pins that ordering, and none
// claims to.

import type { Accessor } from 'solid-js'
import { createRoot, createSignal } from 'solid-js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MergedNote } from '@/lib/midi-generator'
import { useStemMixerMelodyAuditionController } from './useStemMixerMelodyAuditionController'

const synth = vi.hoisted(() => ({
  resume: vi.fn(),
  setNote: vi.fn(),
  dispose: vi.fn(),
}))

vi.mock('./melody-synth', () => ({
  createMelodySynth: () => synth,
}))

const note = (midi: number, startSec: number, endSec: number): MergedNote => ({
  midi,
  noteName: `n${midi}`,
  startSec,
  endSec,
})

function harness(notes: MergedNote[] = []) {
  const [playing, setPlaying] = createSignal(false)
  const [elapsed, setElapsed] = createSignal(0)
  const [segmentedNotes, setSegmentedNotes] = createSignal<MergedNote[]>(notes)
  return {
    setPlaying,
    setElapsed,
    setSegmentedNotes,
    deps: {
      audio: { playing, elapsed } as {
        playing: Accessor<boolean>
        elapsed: Accessor<number>
      },
      pitchAnalysis: { offlineSegmentedNotes: segmentedNotes },
    },
  }
}

/** Solid queues effects; let the queue drain before asserting on them. */
const flush = (): Promise<void> => new Promise((r) => setTimeout(r, 0))

beforeEach(() => {
  synth.resume.mockClear()
  synth.setNote.mockClear()
  synth.dispose.mockClear()
})

describe('useStemMixerMelodyAuditionController', () => {
  it('starts disabled and silent', async () => {
    await createRoot(async (dispose) => {
      const h = harness([note(60, 0, 1)])
      const controller = useStemMixerMelodyAuditionController(h.deps)
      await flush()

      expect(controller.enabled()).toBe(false)
      expect(synth.setNote).toHaveBeenCalledWith(null)
      expect(synth.resume).not.toHaveBeenCalled()
      dispose()
    })
  })

  it('resumes the context from the toggle, and only when switching on', async () => {
    await createRoot(async (dispose) => {
      const h = harness()
      const controller = useStemMixerMelodyAuditionController(h.deps)
      await flush()

      controller.toggle()
      expect(controller.enabled()).toBe(true)
      expect(synth.resume).toHaveBeenCalledTimes(1)

      controller.toggle()
      expect(controller.enabled()).toBe(false)
      // Switching off must not resume: that would create an AudioContext
      // outside a user gesture on the next enable.
      expect(synth.resume).toHaveBeenCalledTimes(1)
      dispose()
    })
  })

  it('sounds the note under the playhead while enabled and playing', async () => {
    await createRoot(async (dispose) => {
      const h = harness([note(60, 0, 1), note(67, 1, 2)])
      const controller = useStemMixerMelodyAuditionController(h.deps)
      controller.toggle()
      h.setPlaying(true)

      h.setElapsed(0.5)
      await flush()
      expect(synth.setNote).toHaveBeenLastCalledWith(60)

      h.setElapsed(1.5)
      await flush()
      expect(synth.setNote).toHaveBeenLastCalledWith(67)
      dispose()
    })
  })

  it('falls silent in a gap between notes', async () => {
    await createRoot(async (dispose) => {
      const h = harness([note(60, 0, 1), note(67, 2, 3)])
      const controller = useStemMixerMelodyAuditionController(h.deps)
      controller.toggle()
      h.setPlaying(true)

      h.setElapsed(1.5)
      await flush()
      expect(synth.setNote).toHaveBeenLastCalledWith(null)
      dispose()
    })
  })

  it('falls silent when playback pauses, without disabling the toggle', async () => {
    await createRoot(async (dispose) => {
      const h = harness([note(60, 0, 1)])
      const controller = useStemMixerMelodyAuditionController(h.deps)
      controller.toggle()
      h.setPlaying(true)
      h.setElapsed(0.5)
      await flush()
      expect(synth.setNote).toHaveBeenLastCalledWith(60)

      h.setPlaying(false)
      await flush()
      expect(synth.setNote).toHaveBeenLastCalledWith(null)
      expect(controller.enabled()).toBe(true)
      dispose()
    })
  })

  it('sounds the note under the playhead when enabled mid-song', async () => {
    await createRoot(async (dispose) => {
      const h = harness([note(72, 4, 5)])
      const controller = useStemMixerMelodyAuditionController(h.deps)
      h.setPlaying(true)
      h.setElapsed(4.5)
      await flush()
      expect(synth.setNote).toHaveBeenLastCalledWith(null)

      controller.toggle()
      await flush()
      expect(synth.setNote).toHaveBeenLastCalledWith(72)
      dispose()
    })
  })

  it('disposes the synth when the owner is torn down', async () => {
    await createRoot(async (dispose) => {
      useStemMixerMelodyAuditionController(harness().deps)
      await flush()
      expect(synth.dispose).not.toHaveBeenCalled()
      dispose()
      expect(synth.dispose).toHaveBeenCalledTimes(1)
    })
  })
})
