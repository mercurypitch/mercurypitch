// ============================================================
// Lesson 23 listening pair — ti and fa together, then do and mi, for the ear alone
// ============================================================
//
// Sing it's last part, Then just listen (WEB-SPEC, Toys 5, item 6; FACTS
// 57, 72): Play ti and fa plays C♯ and G together for 1.5 s, then D and F♯
// together for 1.5 s, 3.0 s in all, in the soft tone and the chosen voice's
// octave, C♯3 and G3 to D3 and F♯3 on the bass staff or C♯4 and G4 to D4
// and F♯4 on the treble, each pair's two notes in one timer task (kit/run.ts
// `playNotes`). The panel's own small staff writes each pair as it sounds,
// with its sharp, lit while it sounds and at rest once the next one starts,
// side by side, the house under D, do; it follows the voice choice at once,
// written afresh. It asks nothing of the voice, so Sing it shows it in every
// ending once a voice is chosen (sing.ts), and it is never a guide: no
// sweep, no count-in, no feeling question. The play is the page's one sound
// (kit/now-playing.ts): a press plays it from the start, stopping any sound
// before it, and a newer sound anywhere stops it, as Sing it scrolled away
// or a hidden page does (kit/leave.ts).

import { q } from '@/features/lessons/kit/dom'
import { onLeave } from '@/features/lessons/kit/leave'
import type { Spelled } from '@/features/lessons/kit/notes'
import { wordName } from '@/features/lessons/kit/notes'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import type { Run, RunNote } from '@/features/lessons/kit/run'
import { playNotes } from '@/features/lessons/kit/run'
import { Sound } from '@/features/lessons/kit/sound'
import type { Mark } from '@/features/lessons/kit/staff-draw'
import { drawScene, emptyScene } from '@/features/lessons/kit/staff-draw'
import { TOGETHER_SEC } from '@/features/lessons/kit/staff-interval'
import type { Clef } from '@/features/lessons/kit/staff-places'
import { midiOf, placeRange, staffName, } from '@/features/lessons/kit/staff-places'
import { VoiceChoice } from '@/features/lessons/kit/voice-choice'
import { LISTEN_PAIRS, SING_NOTES, voiced } from './sounds'
import { learnerClef } from './steps'

/** A note of the play: its pair, and the note the staff writes. */
export interface ListenNote extends RunNote {
  readonly pair: number
  readonly written: Spelled
}

/** The two pairs' notes on one clock in the octave of the staff `clef`: each pair together for 1.5 s, back to back. */
export function listenNotes(clef: Clef): ListenNote[] {
  return LISTEN_PAIRS.flatMap((p, i) =>
    [p.lo, p.hi].map((n) => {
      const written = voiced(n, clef)
      return {
        t: i * TOGETHER_SEC,
        midi: midiOf(written),
        dur: TOGETHER_SEC,
        pair: i,
        written,
      }
    }),
  )
}

/** What the staff's live region says as the play starts, in words, every note with its letter and octave. */
export function listenSaid(clef: Clef): string {
  const [ti, fa] = [LISTEN_PAIRS[0].lo, LISTEN_PAIRS[0].hi].map((n) =>
    wordName(voiced(n, clef)),
  )
  const [d, mi] = [LISTEN_PAIRS[1].lo, LISTEN_PAIRS[1].hi].map((n) =>
    wordName(voiced(n, clef)),
  )
  return `Ti and fa together, ${ti} and ${fa}, then do and mi, ${d} and ${mi}.`
}

/** Do's letter in D: the house goes under it. */
const DO = SING_NOTES[0].letter

export interface ListenPair {
  /** The staff it writes on: the learner's. */
  readonly clef: Clef
  stop(): void
}

export function initListenPair(): ListenPair {
  const root = q('#pairStaff')
  const el = q<SVGSVGElement>('[data-staff-svg]', root)
  const said = q('[data-staff-said]', root)
  const button = q<HTMLButtonElement>('[data-pair-play]')

  let clef: Clef = learnerClef()
  let marks: Mark[] = []
  let run: Run | null = null

  function draw(): void {
    // the staff toy's room, two ledger lines each way, so the clef always fits
    drawScene(el, {
      ...emptyScene(clef, placeRange(clef)),
      cols: LISTEN_PAIRS.length,
      marks,
    })
  }

  /** Stops the play where it stands: what it wrote stays, at rest. */
  function stop(): void {
    run?.stop()
    run = null
    button.classList.remove('is-on')
    NowPlaying.release(stop)
    if (marks.some((m) => m.tone !== 'rest')) {
      marks = marks.map((m) => ({ ...m, tone: 'rest' }))
      draw()
    }
  }

  /** A note sounds: it is written in its pair's column, lit, and the pair before it rests. */
  function write(n: ListenNote): void {
    marks = [
      ...marks.map((m) =>
        m.col === n.pair ? m : { ...m, tone: 'rest' as const },
      ),
      {
        note: n.written,
        col: n.pair,
        tone: 'lit',
        home: n.written.letter === DO,
      },
    ]
    draw()
  }

  async function play(): Promise<void> {
    stop()
    NowPlaying.claim(stop)
    marks = []
    draw()
    button.classList.add('is-on')
    // a live line written only when its words change, so it is heard once
    const line = listenSaid(clef)
    if (said.textContent !== line) said.textContent = line
    const notes = listenNotes(clef)
    const r = playNotes(notes, {
      audible: Sound.canPlay(),
      kind: 'soft',
      onNote: (_n, i) => write(notes[i]),
    })
    run = r
    // heard to its end, or ended by the Sound switch or a hidden page:
    // either way the staff rests, both pairs still written
    await r.done
    if (run === r) stop()
  }

  button.addEventListener('click', () => void play())
  onLeave(q('#sing'), stop)
  // the learner's staff follows the voice choice at once, written afresh
  VoiceChoice.subscribe(() => {
    if (learnerClef() === clef) return
    stop()
    clef = learnerClef()
    marks = []
    el.setAttribute('aria-label', staffName(clef))
    draw()
  })
  el.setAttribute('aria-label', staffName(clef))
  draw()
  // the panel opens with a voice chosen: the staff draws at its own size once laid out
  if (typeof ResizeObserver === 'function') new ResizeObserver(draw).observe(el)

  return {
    get clef(): Clef {
      return clef
    },
    stop,
  }
}
