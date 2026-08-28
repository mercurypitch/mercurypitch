// ============================================================
// use-sung-answer — the open window of a sung answer, shared by
// Echo, Span and Echo in the Wild. While the window is open it reads
// the frames every POLL, cuts them into notes for the live strip and
// the lamp, and closes the window itself after a moment's silence
// once a note is in — or at a generous ceiling, twice the phrase's
// length plus three seconds. Done (the pad, or Space) closes it now.
// Home keeps its own ring.
// ============================================================

import { createEffect, createSignal, on, onCleanup } from 'solid-js'
import type { SungNote } from '@/lib/ear/sung-notes'
import { SEGMENT_DEFAULTS, segmentSungNotes, sungDegrees, } from '@/lib/ear/sung-notes'
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

  function stopPolling(): void {
    clearInterval(timer)
    timer = undefined
  }

  function judgeNow(): void {
    if (judged) return
    judged = true
    stopPolling()
    setLevel(0)
    const notes = segmentSungNotes(options.capture.takeFrames())
    setLive(notes)
    options.onJudge(notes)
  }

  function poll(): void {
    elapsedMs += SUNG_ANSWER.pollMs
    const frames = options.capture.peekFrames()
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
    const silentMs =
      latest && lastVoiced !== null ? (latest.t - lastVoiced) * 1000 : 0
    if (notes.length > 0 && silentMs >= SUNG_ANSWER.silenceMs) judgeNow()
    else if (elapsedMs >= sungAnswerCeilingMs(options.phraseMs())) judgeNow()
  }

  createEffect(
    on(options.open, (isOpen) => {
      stopPolling()
      if (!isOpen) return
      options.capture.startWindow()
      elapsedMs = 0
      judged = false
      setLive([])
      setLevel(0)
      timer = setInterval(poll, SUNG_ANSWER.pollMs)
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
