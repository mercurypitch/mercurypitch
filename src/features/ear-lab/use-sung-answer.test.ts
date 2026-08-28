// The sung window: opens with the answer phase, fills the live strip
// as the mic hears notes, closes itself on silence or at the ceiling,
// and Done closes it now — judging exactly once.

import { createRoot, createSignal } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PitchFrame } from '@/lib/pitch-f0-stream'
import { SUNG_ANSWER, sungAnswerCeilingMs, useSungAnswer, } from './use-sung-answer'

const midiToFreq = (midi: number) => 440 * 2 ** ((midi - 69) / 12)

function frames(
  spec: Array<[midi: number, fromS: number, toS: number]>,
): PitchFrame[] {
  const out: PitchFrame[] = []
  for (const [midi, fromS, toS] of spec) {
    for (let t = fromS; t < toS; t += 0.016) {
      out.push({
        t: Math.round(t * 1000) / 1000,
        f0: midi > 0 ? midiToFreq(midi) : 0,
        conf: midi > 0 ? 0.9 : 0,
        rms: midi > 0 ? 0.2 : 0.01,
      })
    }
  }
  return out
}

function setUp() {
  const mic = {
    frames: [] as PitchFrame[],
    startWindow: vi.fn(),
    peekFrames: () => mic.frames,
    takeFrames: () => mic.frames,
    level: () => 0.2,
  }
  const [open, setOpen] = createSignal(false)
  const onJudge = vi.fn()
  let answer!: ReturnType<typeof useSungAnswer>
  const dispose = createRoot((d) => {
    answer = useSungAnswer({
      capture: mic,
      open,
      rootMidi: () => 60,
      phraseMs: () => 1500,
      onJudge,
    })
    return d
  })
  return { mic, setOpen, onJudge, answer, dispose }
}

describe('useSungAnswer', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('opens the window with the phase, fills the strip live, closes on silence', () => {
    const { mic, setOpen, onJudge, answer, dispose } = setUp()
    setOpen(true)
    expect(mic.startWindow).toHaveBeenCalledTimes(1)

    // Do Re sung, the mic still hearing the second note.
    mic.frames = frames([
      [60, 0, 0.35],
      [0, 0.35, 0.5],
      [62, 0.5, 0.85],
    ])
    vi.advanceTimersByTime(SUNG_ANSWER.pollMs)
    expect(answer.degrees()).toEqual([1, 2])
    expect(answer.level()).toBeCloseTo(0.2)
    expect(onJudge).not.toHaveBeenCalled()

    // Then a breath's silence: judged once, with all three notes.
    mic.frames = frames([
      [60, 0, 0.35],
      [0, 0.35, 0.5],
      [62, 0.5, 0.85],
      [0, 0.85, 1.0],
      [64, 1.0, 1.35],
      [0, 1.35, 2.7],
    ])
    vi.advanceTimersByTime(SUNG_ANSWER.pollMs)
    expect(onJudge).toHaveBeenCalledTimes(1)
    expect(onJudge.mock.calls[0][0]).toHaveLength(3)
    expect(answer.level()).toBe(0)
    vi.advanceTimersByTime(SUNG_ANSWER.pollMs * 20)
    expect(onJudge).toHaveBeenCalledTimes(1)
    dispose()
  })

  it('closes at the ceiling when nothing was heard, and Done closes it now', () => {
    const { mic, setOpen, onJudge, answer, dispose } = setUp()
    setOpen(true)
    mic.frames = frames([[0, 0, 0.5]])
    vi.advanceTimersByTime(sungAnswerCeilingMs(1500) - SUNG_ANSWER.pollMs)
    expect(onJudge).not.toHaveBeenCalled()
    vi.advanceTimersByTime(SUNG_ANSWER.pollMs)
    expect(onJudge).toHaveBeenCalledTimes(1)
    expect(onJudge.mock.calls[0][0]).toEqual([])

    setOpen(false)
    setOpen(true)
    expect(mic.startWindow).toHaveBeenCalledTimes(2)
    mic.frames = frames([[67, 0, 0.4]])
    answer.judgeNow()
    expect(onJudge).toHaveBeenCalledTimes(2)
    expect(onJudge.mock.calls[1][0]).toHaveLength(1)
    answer.judgeNow()
    vi.advanceTimersByTime(sungAnswerCeilingMs(1500) * 2)
    expect(onJudge).toHaveBeenCalledTimes(2)
    dispose()
  })

  it('a closed window stops polling', () => {
    const { mic, setOpen, onJudge, answer, dispose } = setUp()
    setOpen(true)
    setOpen(false)
    mic.frames = frames([
      [60, 0, 0.35],
      [0, 0.35, 2.0],
    ])
    vi.advanceTimersByTime(SUNG_ANSWER.pollMs * 5)
    expect(answer.degrees()).toEqual([])
    expect(onJudge).not.toHaveBeenCalled()
    dispose()
  })
})
