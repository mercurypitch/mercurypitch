// The sung window: opens with the answer phase, fills the live strip
// as the mic hears notes, closes itself on silence or at the ceiling,
// and Done closes it now — judging exactly once. Held, it sets aside
// what the mic hears, neither closes nor runs toward its ceiling, and
// then carries on with the notes it had.

import { createRoot, createSignal } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as SungNotes from '@/lib/ear/sung-notes'
import { segmentSungNotes, sungDegrees } from '@/lib/ear/sung-notes'
import type { PitchFrame } from '@/lib/pitch-f0-stream'
import { SUNG_ANSWER, sungAnswerCeilingMs, useSungAnswer, } from './use-sung-answer'

// The segmenter as it is, watched: which frames each poll hands it.
vi.mock('@/lib/ear/sung-notes', async (importOriginal) => {
  const actual = await importOriginal<typeof SungNotes>()
  return { ...actual, segmentSungNotes: vi.fn(actual.segmentSungNotes) }
})

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
  const [held, setHeld] = createSignal(false)
  const onJudge = vi.fn()
  let answer!: ReturnType<typeof useSungAnswer>
  const dispose = createRoot((d) => {
    answer = useSungAnswer({
      capture: mic,
      open,
      held,
      rootMidi: () => 60,
      phraseMs: () => 1500,
      onJudge,
    })
    return d
  })
  return { mic, setOpen, setHeld, onJudge, answer, dispose }
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

  it('sets aside what it hears while held, then carries on with the notes it had', () => {
    const { mic, setOpen, setHeld, onJudge, answer, dispose } = setUp()
    setOpen(true)
    // Do, then a breath.
    mic.frames = frames([
      [60, 0, 0.35],
      [0, 0.35, 0.9],
    ])
    vi.advanceTimersByTime(SUNG_ANSWER.pollMs)
    expect(answer.degrees()).toEqual([1])

    // Held: the mic hears the phrase from the speaker, then silence long
    // past the window's own closing and its ceiling. Done waits too.
    setHeld(true)
    mic.frames = [
      ...mic.frames,
      ...frames([
        [67, 0.9, 1.25],
        [0, 1.25, 1.4],
        [72, 1.4, 1.75],
        [0, 1.75, 9],
      ]),
    ]
    answer.judgeNow()
    vi.advanceTimersByTime(sungAnswerCeilingMs(1500) * 2)
    expect(onJudge).not.toHaveBeenCalled()
    expect(answer.degrees()).toEqual([1])
    expect(answer.level()).toBe(0)

    // Carried on: heard afresh, and a breath after the hold is no
    // silence of the singer's, though Do was 1.5 s before it.
    setHeld(false)
    expect(mic.startWindow).toHaveBeenCalledTimes(2)
    mic.frames = frames([[0, 0, 0.9]])
    vi.advanceTimersByTime(SUNG_ANSWER.pollMs)
    expect(onJudge).not.toHaveBeenCalled()

    // Re and Mi, then silence: judged once, Do Re Mi.
    mic.frames = frames([
      [0, 0, 0.9],
      [62, 0.9, 1.25],
      [0, 1.25, 1.4],
      [64, 1.4, 1.75],
      [0, 1.75, 3.1],
    ])
    vi.advanceTimersByTime(SUNG_ANSWER.pollMs)
    expect(onJudge).toHaveBeenCalledTimes(1)
    expect(sungDegrees(onJudge.mock.calls[0][0], 60)).toEqual([1, 2, 3])
    dispose()
  })

  it('runs toward its ceiling only while it is not held', () => {
    const { mic, setOpen, setHeld, onJudge, dispose } = setUp()
    setOpen(true)
    mic.frames = frames([[0, 0, 0.5]])
    vi.advanceTimersByTime(1000)
    setHeld(true)
    vi.advanceTimersByTime(sungAnswerCeilingMs(1500) * 2)
    setHeld(false)

    vi.advanceTimersByTime(
      sungAnswerCeilingMs(1500) - 1000 - SUNG_ANSWER.pollMs,
    )
    expect(onJudge).not.toHaveBeenCalled()
    vi.advanceTimersByTime(SUNG_ANSWER.pollMs)
    expect(onJudge).toHaveBeenCalledTimes(1)
    dispose()
  })

  it('reads the frames as the capture hands them over, with nothing held', () => {
    const { mic, setOpen, dispose } = setUp()
    // A fresh array each read, as the capture's are.
    const handed: PitchFrame[][] = []
    mic.peekFrames = () => {
      const fresh = mic.frames.slice()
      handed.push(fresh)
      return fresh
    }
    setOpen(true)
    mic.frames = frames([[60, 0, 0.35]])
    vi.advanceTimersByTime(SUNG_ANSWER.pollMs * 3)
    const read = vi.mocked(segmentSungNotes).mock.calls.map((call) => call[0])
    expect(handed).toHaveLength(3)
    // Each poll cuts the very array it was handed: no copy every 100 ms.
    expect(read.slice(-3)).toEqual(handed)
    for (const [i, frames] of handed.entries()) {
      expect(read.at(i - 3)).toBe(frames)
    }
    dispose()
  })
})
