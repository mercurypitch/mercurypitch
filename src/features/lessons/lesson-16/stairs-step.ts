// ============================================================
// Lesson 16 Step 1 — the staircase that turns into the staff
// ============================================================
//
// Lesson 4's staircase, the kit's (stairs-core.ts), five stairs from do to
// so on G in the learner's octave, G3 for the lower voice and G4 for the
// higher, with no slider, the third stair short: mi to fa, B to C, a
// semitone (WEB-SPEC, Toys 3; FACTS 15, 16). It stands over a bare staff.
// Play the stairs plays do to so, 2.9 s, each stair lighting as it sounds.
// Turn into the staff turns each stair a quarter turn onto its line or
// space in 0.8 s (kit/stairs-turn.ts), the short stair too, the staircase
// dimmed while its stairs travel; as they land the staff shows its five
// notes, the house on do and the syllables under them, and plays them,
// each lighting its place and its stair, 3.7 s in all. With motion paused
// the turn is a cross-fade. Once turned, the staff stays a staff for the
// visit: a tap on the house plays do, and a tap on a note plays do and then
// that note (LESSON.md's Try), and a later turn plays the turn again.
//
// Every sound is the staff's, the page's one (`NowPlaying`): the staircase
// lights its stairs on the same clock, silently, and a sound anywhere stops
// a turn in flight. A stair's button plays its note and keeps its name
// ("Stair 3, mi, B 3"). The clef is the page's (steps.ts): the staircase
// moves to the other G and the staff opens afresh in that clef.

import { q, qa } from '@/features/lessons/kit/dom'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import type { PlayLight } from '@/features/lessons/kit/play-lights'
import { playLights } from '@/features/lessons/kit/play-lights'
import type { PlayNote, StaffToy } from '@/features/lessons/kit/staff'
import { mountStaff } from '@/features/lessons/kit/staff'
import type { Clef } from '@/features/lessons/kit/staff-places'
import { midiOf } from '@/features/lessons/kit/staff-places'
import type { StairsCore } from '@/features/lessons/kit/stairs-core'
import { mountStairs } from '@/features/lessons/kit/stairs-core'
import { place } from '@/features/lessons/kit/stairs-parts'
import type { NoteEvent } from '@/features/lessons/kit/stairs-plays'
import type { Box, Turn } from '@/features/lessons/kit/stairs-turn'
import { boxOf, turnStairs } from '@/features/lessons/kit/stairs-turn'
import { stairLabel } from '@/features/lessons/kit/stairs-words'
import { DO, doToSo, stairsStaff, stepNotes, TAP_SEC } from './sounds'

/** Five stairs, do to so. */
export const STAIRS = 5

export interface StairsStep {
  readonly core: StairsCore
  readonly staff: StaffToy
  /** Whether the staircase has turned into the staff this visit. */
  readonly turned: boolean
  /** Plays do to so; resolves true when heard to its end. */
  play(): Promise<boolean>
  /** Turns the staircase into the staff, then plays its five notes; resolves true when heard to their end. */
  turn(): Promise<boolean>
  /** The page's clef: the staircase on its G, the staff afresh. */
  setClef(clef: Clef): void
  stop(): void
}

/** A run's notes as the staircase lights them. */
const eventsOf = (notes: readonly PlayNote[]): NoteEvent[] =>
  notes.map((n) => ({ midi: midiOf(n.note), at: n.t, dur: n.dur }))

export function mountStairsStep(
  root: HTMLElement,
  o: {
    /** When it draws: its stage on screen, on Step 1 (the deck's `toyActive`). */
    readonly active: () => boolean
    readonly clef: Clef
    /** The staff's Clef switch, handed to the page, which sets every staff. */
    readonly onClef: (clef: Clef) => void
    readonly light?: PlayLight
  },
): StairsStep {
  const viz = q('[data-stairs-viz]', root)
  const hits = q('[data-stairs-hits]', viz)
  const light = o.light ?? playLights()
  const playBtn = q<HTMLButtonElement>('[data-stairs-play]', root)
  const turnBtn = q<HTMLButtonElement>('[data-stairs-turn]', root)
  let clef: Clef = o.clef
  let turned = false
  let turning: Turn | null = null
  // the latest play, tap or turn: an older one cut short leaves the staircase to it
  let plays = 0

  const stairBtns = Array.from({ length: STAIRS }, (_, i) => {
    const b = document.createElement('button')
    b.type = 'button'
    b.className = 'stair-hit'
    b.dataset.stair = String(i)
    hits.append(b)
    return b
  })

  const tonic = (): number => midiOf(DO[clef])
  const core = mountStairs({
    canvas: q<HTMLCanvasElement>('canvas', viz),
    compact: false,
    active: o.active,
    range: { lo: tonic(), hi: tonic() },
    names: () => 'solfege',
    count: STAIRS,
    onLayout: (L) =>
      L.stairs.forEach((st, i) => {
        if (i < stairBtns.length) place(stairBtns[i], st.zone)
      }),
  })
  core.set({ steps: true })

  const staff = mountStaff(root, {
    state: stairsStaff(clef, false),
    owner: NowPlaying,
    onClef: o.onClef,
  })
  const staffSvg = q<SVGSVGElement>('[data-staff-svg]', root)

  function relabel(): void {
    const t = core.tonic
    stairBtns.forEach((b, i) => b.setAttribute('aria-label', stairLabel(i, t)))
  }

  /** Sounds `run` on the staff, the staircase lighting it on the same clock; resolves as the staff's play does. */
  function sound(run: readonly PlayNote[]): Promise<boolean> {
    const mine = ++plays
    // the staff claims the page's sound first, so a turn in flight stops
    // before the staircase lights this run
    const heard = staff.play({ show: 'score', notes: run })
    void core.play(eventsOf(run), false)
    return heard.then((done) => {
      if (!done && mine === plays) core.stop()
      return done
    })
  }

  /** Each stair's block, in page pixels. */
  function stairBoxes(): Box[] {
    const L = core.layout
    if (L === null) return []
    const r = hits.getBoundingClientRect()
    return L.stairs.map((st) => ({
      x: r.left + st.x,
      y: r.top + st.top,
      w: st.w,
      h: st.bottom - st.top,
    }))
  }

  /** A sound anywhere stops a turn in flight. */
  function cancelTurn(): void {
    turning?.cancel()
  }

  function stop(): void {
    cancelTurn()
    staff.stop()
    core.stop()
  }

  function turn(): Promise<boolean> {
    stop()
    const mine = ++plays
    turned = true
    staff.setState(stairsStaff(clef, true))
    // the notes wait, hidden, while the stairs travel onto their heads
    root.classList.add('is-turning')
    const t = turnStairs({
      from: stairBoxes(),
      to: qa('.st-head', staffSvg).map(boxOf),
      layer: root,
    })
    turning = t
    NowPlaying.claim(cancelTurn)
    return t.done.then((ran) => {
      // a turn started since leaves its own claim and its hidden notes be
      if (turning !== t) return false
      turning = null
      NowPlaying.release(cancelTurn)
      root.classList.remove('is-turning')
      if (!ran || mine !== plays) return false
      return sound(stepNotes('do-so', clef))
    })
  }

  function setClef(c: Clef): void {
    clef = c
    stop()
    core.setRange({ lo: tonic(), hi: tonic() })
    relabel()
    staff.setState(stairsStaff(c, turned))
    staff.say(c === 'treble' ? 'Treble clef.' : 'Bass clef.')
  }

  playBtn.addEventListener('click', () =>
    light(playBtn, sound(stepNotes('do-so', clef))),
  )
  turnBtn.addEventListener('click', () => light(turnBtn, turn()))
  stairBtns.forEach((b, i) =>
    b.addEventListener('click', () => {
      void sound([{ t: 0, dur: TAP_SEC, note: doToSo(clef)[i] }])
    }),
  )
  relabel()

  return {
    core,
    staff,
    get turned() {
      return turned
    },
    play: () => sound(stepNotes('do-so', clef)),
    turn,
    setClef,
    stop,
  }
}
