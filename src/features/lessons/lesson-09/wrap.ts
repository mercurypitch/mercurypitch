// ============================================================
// Lesson 9 wrap — free play: every rung of the ladder chart in one place
// ============================================================
//
// The Wrap's practice card is Sing it's to mount (sing.ts), in the version
// the visit's ending picks (kit/comfort.ts `VisitEnding`), and the next
// lesson's card is the kit's, keeping the page's tease figure in its mark
// (learn/09.html). This module is free play, which unlocks after the lesson
// (playbook rule 17): the ladder chart in rung mode (WEB-SPEC, Toys 1), with
// four buttons, do, mi, so and the top do, each named with its note in
// spoken words, "so, A3", in the voice the chart shows. A tap plays its rung
// in the soft tone; a tap after another plays the leap between them, up or
// down, its arc drawing as the landing note starts, and the polite status
// line names it (`freeLine`). Hear it first (`aria-pressed`) sounds the
// landing note alone before each leap; Slow (`aria-pressed`) doubles every
// length and onset, never a pitch. No fact times free play, so its notes
// borrow Step 1's 1.0 s and Step 4's 0.6 s gap (sounds.ts `freeNotes`).
//
// The voice switch, "Lower voice" and "Higher voice" (`aria-pressed`),
// changes this chart's voice for the visit and stores nothing: it never
// sets `fyp-voice`, nor the voice Sing it and the steps sing in. Free play
// opens on the steps' voice, and a voice chosen in Sing it moves it again
// (`VoiceChoice.subscribe`, through the chart). Each play is the page's one
// sound (kit/now-playing.ts): it stops the sound before it, anywhere on the
// page, and a newer one stops it. With the sound off a play still draws.
// Under reduced motion an arc draws whole at once, and with nothing moving
// the chart asks the frame loop for nothing (ladder-chart.ts).

import { q, qa } from '@/features/lessons/kit/dom'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import type { Run } from '@/features/lessons/kit/run'
import { playNotes } from '@/features/lessons/kit/run'
import { Sound } from '@/features/lessons/kit/sound'
import type { Voice } from '@/features/lessons/kit/voice-choice'
import { VoiceChoice } from '@/features/lessons/kit/voice-choice'
import type { LadderChart, Phrase, PhraseDrawing } from './ladder-chart'
import { mountLadderChart } from './ladder-chart'
import type { RungId } from './ladder-data'
import { RUNG_ORDER, rungName } from './ladder-data'
import { freeLine } from './lines'
import type { FreeOptions } from './sounds'
import { freeNotes, SLOW } from './sounds'

const isRung = (id: string | undefined): id is RungId =>
  (RUNG_ORDER as readonly (string | undefined)[]).includes(id)

/**
 * Free play's tap on `to` after a tap on `from`, on do `d`: its notes
 * (`freeNotes`), and the leap between its last two, whose arc draws as the
 * landing note starts; the rung alone has none.
 */
export function freePhrase(
  d: number,
  from: RungId | null,
  to: RungId,
  o: FreeOptions = {},
): Phrase {
  const notes = freeNotes(d, from, to, o)
  const n = notes.length
  return n < 2 ? { notes } : { notes, leaps: [[n - 2, n - 1]] }
}

/** What free play hands back: its chart, for the page's tests. */
export interface FreePlay {
  readonly ladder: LadderChart
}

export function initWrap(): FreePlay {
  const root = q('#freePlay')
  const status = q('[data-free-status]', root)
  const hearBtn = q<HTMLButtonElement>('[data-free-hear]', root)
  const slowBtn = q<HTMLButtonElement>('[data-free-slow]', root)
  const rungBtns = qa<HTMLButtonElement>('[data-free-rung]', root)
  const voiceBtns = qa<HTMLButtonElement>('[data-free-voice]', root)
  const ladder = mountLadderChart(q('[data-free-viz]', root), {
    state: 'free',
  })

  // the rung tapped last, which the next tap leaps from
  let last: RungId | null = null
  let run: Run | null = null
  let drawing: PhraseDrawing | null = null
  let pressed: HTMLButtonElement | null = null

  const on = (b: HTMLButtonElement): boolean =>
    b.getAttribute('aria-pressed') === 'true'

  /** The status line, written only when it changes, so a polite region says each line once. */
  function say(line: string): void {
    if (status.textContent !== line) status.textContent = line
  }

  function rest(): void {
    pressed?.classList.remove('is-on')
    pressed = null
  }

  /** Stops the play where it stands: its sound, its drawing, its button. */
  function stop(): void {
    run?.stop()
    run = null
    drawing?.cancel()
    drawing = null
    rest()
    NowPlaying.release(stop)
  }

  async function tap(btn: HTMLButtonElement, to: RungId): Promise<void> {
    stop()
    NowPlaying.claim(stop)
    const from = last
    last = to
    const d = ladder.doMidi
    const phrase = freePhrase(d, from, to, {
      hearFirst: on(hearBtn),
      slow: on(slowBtn) ? SLOW : 1,
    })
    say(freeLine(d, from, to))
    const drawn = ladder.play(phrase)
    const r = playNotes(phrase.notes, {
      audible: Sound.canPlay(),
      kind: 'soft',
      onNote: (_, i) => drawn.note(i),
    })
    run = r
    drawing = drawn
    pressed = btn
    btn.classList.add('is-on')
    const heard = await r.done
    // a newer play, or a stop, has taken over
    if (run !== r) return
    run = null
    drawing = null
    // heard to its end, the leap stays drawn; cut short as every sound
    // stopped (the Sound switch, a hidden page), the chart rests
    if (heard) drawn.end()
    else drawn.cancel()
    rest()
    NowPlaying.release(stop)
  }

  for (const b of rungBtns) {
    const id = b.dataset.freeRung
    if (isRung(id)) b.addEventListener('click', () => void tap(b, id))
  }
  for (const b of [hearBtn, slowBtn])
    b.addEventListener('click', () => {
      b.setAttribute('aria-pressed', String(!on(b)))
    })

  /** The rungs' names and the voice switch, in the voice the chart shows. */
  function showVoice(): void {
    for (const b of rungBtns) {
      const id = b.dataset.freeRung
      if (isRung(id))
        b.setAttribute('aria-label', rungName(ladder.doMidi, id).spoken)
    }
    for (const b of voiceBtns)
      b.setAttribute(
        'aria-pressed',
        String(b.dataset.freeVoice === ladder.voice),
      )
  }

  // the voice the names and the switch show: a play on another stops, and
  // the line that named its notes goes
  let shown: Voice = ladder.voice

  function voiceMoved(): void {
    if (ladder.voice === shown) return
    shown = ladder.voice
    stop()
    say('')
    showVoice()
  }

  for (const b of voiceBtns)
    b.addEventListener('click', () => {
      const v = b.dataset.freeVoice
      if (v !== 'lower' && v !== 'higher') return
      ladder.setVoice(v)
      voiceMoved()
    })
  // a voice chosen in Sing it: the chart follows it itself, and the names
  // and the switch follow the chart
  VoiceChoice.subscribe(voiceMoved)
  showVoice()

  return { ladder }
}
