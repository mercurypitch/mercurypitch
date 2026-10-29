// ============================================================
// use-sung-answer — the open window of a sung answer, shared by
// Echo, Span and Echo in the Wild. While the window is open it reads
// the frames every POLL, cuts them into notes for the live strip and
// the lamp, and closes the window itself after a moment's silence
// once a note is in — or at a generous ceiling, twice the phrase's
// length plus three seconds. Done (the pad, or Space) closes it now.
// Home keeps its own ring.
//
// A window can be held (Span's Hear it again before the answer): the
// microphone then hears the speaker, so what it hears is set aside,
// and the window neither closes on silence nor runs toward its
// ceiling. Once the hold ends the window carries on with the notes it
// had, as tapped answers keep their taps: the mic records afresh, so
// neither the replay nor the detector's memory of it reaches the
// take, and silence counts again from the end of the hold.
// ============================================================

import { createEffect, createMemo, createSignal, on, onCleanup } from 'solid-js'
import type { SungNote } from '@/lib/ear/sung-notes'
import { SEGMENT_DEFAULTS, segmentSungNotes, sungDegrees, } from '@/lib/ear/sung-notes'
import type { PitchFrame } from '@/lib/pitch-f0-stream'
import type { SingCaptureHandle } from './use-sing-capture'

export const SUNG_ANSWER = {
  pollMs: 100,
  /** Silence after the last note before the window closes itself. */
  silenceMs: 1200,
  ceilingFactor: 2,
  ceilingBaseMs: 3000,
} as const

/** The longest a window stays open: twice the phrase plus a breath. */
export function sungAnswerCeilingMs(phraseMs: number): number {
  return SUNG_ANSWER.ceilingFactor * phraseMs + SUNG_ANSWER.ceilingBaseMs
}

export interface SungAnswerOptions {
  capture: Pick<
    SingCaptureHandle,
    'startWindow' | 'peekFrames' | 'takeFrames' | 'level'
  >
  /** True while the window should be open: a sung run's answer phase. */
  open: () => boolean
  /** True while the open window waits on a sound the microphone must not
   *  take for the answer: what it hears meanwhile is set aside, and the
   *  window carries on with what it had once this turns false. */
  held?: () => boolean
  rootMidi: () => number
  /** The phrase's own length in ms, for the ceiling. */
  phraseMs: () => number
  /** The notes the mic heard, once, when the window closes. */
  onJudge: (notes: SungNote[]) => void
}

export function useSungAnswer(options: SungAnswerOptions) {
  const [live, setLive] = createSignal<SungNote[]>([])
  const [level, setLevel] = createSignal(0)
  let timer: ReturnType<typeof setInterval> | undefined
  let elapsedMs = 0
  let judged = true
  /** A hold is on: the mic hears something that is not the answer. */
  let holding = false
  /** The take as it stood when the last hold began. */
  let kept: PitchFrame[] = []
  /** Where the mic's frames since the last hold go on the take's clock:
   *  just after the last kept frame. */
  let offsetS = 0
  /** When the take carried on after its last hold: silence before it is
   *  the replay's, not the singer's. */
  let resumedS = 0

  // The window and the hold change only when their answers do: the phase
  // moving inside an open window is no new window.
  const isOpen = createMemo(() => options.open())
  const isHeld = createMemo(() => options.held?.() ?? false)

  /** The take so far: what was kept, then what the mic heard since. The
   *  capture hands over a fresh array each read, so with nothing kept it
   *  is the take as it comes, uncopied, every poll. */
  function heard(frames: PitchFrame[]): PitchFrame[] {
    if (kept.length === 0 && offsetS === 0) return frames
    return [
      ...kept,
      ...frames.map((frame) => ({ ...frame, t: frame.t + offsetS })),
    ]
  }

  function stopPolling(): void {
    clearInterval(timer)
    timer = undefined
  }

  function judgeNow(): void {
    // Never in a hold: the take would close on the notes before it.
    if (judged || holding) return
    judged = true
    stopPolling()
    setLevel(0)
    const notes = segmentSungNotes(heard(options.capture.takeFrames()))
    setLive(notes)
    options.onJudge(notes)
  }

  function poll(): void {
    if (holding) return
    elapsedMs += SUNG_ANSWER.pollMs
    const frames = heard(options.capture.peekFrames())
    const notes = segmentSungNotes(frames)
    setLive(notes)
    setLevel(options.capture.level())

    const latest = frames.at(-1)
    let lastVoiced: number | null = null
    for (let i = frames.length - 1; i >= 0; i--) {
      const frame = frames[i]
      if (frame.f0 > 0 && frame.conf >= SEGMENT_DEFAULTS.minConf) {
        lastVoiced = frame.t
        break
      }
    }
    const since = lastVoiced === null ? null : Math.max(lastVoiced, resumedS)
    const silentMs = latest && since !== null ? (latest.t - since) * 1000 : 0
    if (notes.length > 0 && silentMs >= SUNG_ANSWER.silenceMs) judgeNow()
    else if (elapsedMs >= sungAnswerCeilingMs(options.phraseMs())) judgeNow()
  }

  createEffect(
    on(isOpen, (isOpen) => {
      stopPolling()
      holding = false
      if (!isOpen) return
      options.capture.startWindow()
      elapsedMs = 0
      judged = false
      kept = []
      offsetS = 0
      resumedS = 0
      setLive([])
      setLevel(0)
      timer = setInterval(poll, SUNG_ANSWER.pollMs)
    }),
  )

  createEffect(
    on(isHeld, (isHeld) => {
      const waiting = timer !== undefined && !judged
      if (isHeld) {
        if (!waiting || holding) return
        holding = true
        kept = heard(options.capture.peekFrames())
        setLevel(0)
        return
      }
      if (!holding) return
      holding = false
      if (!waiting) return
      // A fresh recording, its frames placed after the kept ones: a poll's
      // length on, more than the segmenter bridges, so a note the hold
      // cut off stays apart from one sung after it.
      options.capture.startWindow()
      const last = kept.at(-1)
      offsetS = last === undefined ? 0 : last.t + SUNG_ANSWER.pollMs / 1000
      resumedS = offsetS
    }),
  )
  onCleanup(stopPolling)

  return {
    /** The notes heard so far, as the strip shows them. */
    live,
    degrees: () => sungDegrees(live(), options.rootMidi()),
    /** Input level 0..1 (RMS), for the lamp. */
    level,
    judgeNow,
  }
}
