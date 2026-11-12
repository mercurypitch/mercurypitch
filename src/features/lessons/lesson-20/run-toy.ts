// ============================================================
// Lesson 20 run toy — Merc's run as beads on a string, at five tempos
// ============================================================
//
// Steps 3 and 4's toy (WEB-SPEC, Toys 5): the run chart (run-chart.ts), its
// rows named "do · D3" to "la · B3", the time axis fixed at 6.75 s across,
// so a faster tempo draws the same nine beads closer together at the same
// heights (FACTS 39). It sings in the learner's voice,
// Merc from D3 or Tavi from D4: the run as one line in his "ooh", held on
// each note and gliding into the next, each bead glowing and showing its
// name while its note sounds; Staccato's nine short notes, each its own
// voice, drawn 0.15 s wide with no string; or Play it smudged's
// illustrated singer, in the soft tone at 0.2 s a note, drawn live as a
// violet line labelled "An illustration", the four notes that land
// lighting their edges, the five that slip out of their bands not
// (FACTS 82a). Nothing of Merc's plays then, nothing scores it, and the
// line stays until the next play. Nothing here listens.
//
// See it on the staff (a switch, off at first) shows Lesson 15's staff toy
// under the beads in the learner's clef, bass for the lower voice and treble
// for the higher. The next play writes each note as it sounds, silently on
// the run's own clock (kit/staff.ts `silent`), nine stemless noteheads, F
// sharp with its own sharp; the run stays written, and each notehead lights
// as its note sounds on any later play. Switched on before any play, the
// staff shows its clef and nothing more, so the sound comes first; Play it
// smudged leaves it as it was (FACTS 47).
//
// Each bead is a button over the drawing that plays its note and says its
// name ("Bead 3, mi, F sharp 3"), where the beads stand at least a
// fingertip's 44 px apart; closer, they are drawn and not buttons, and the
// figure's own label names the run. Every sound is the page's one
// (`NowPlaying`).

import { q, qa } from '@/features/lessons/kit/dom'
import type { Spelled } from '@/features/lessons/kit/notes'
import { wordName } from '@/features/lessons/kit/notes'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import type { PlayLight } from '@/features/lessons/kit/play-lights'
import { playLights } from '@/features/lessons/kit/play-lights'
import type { Run, RunNote } from '@/features/lessons/kit/run'
import { allOf, playLine, playNote, playNotes, } from '@/features/lessons/kit/run'
import { Sound } from '@/features/lessons/kit/sound'
import type { PlayNote, StaffState, StaffToy, } from '@/features/lessons/kit/staff'
import { mountStaff, scoreAcross } from '@/features/lessons/kit/staff'
import type { Clef } from '@/features/lessons/kit/staff-places'
import { clefForVoice } from '@/features/lessons/kit/staff-places'
import type { Voice } from '@/features/lessons/kit/voice-choice'
import type { LiveLine } from './run-chart'
import { mountRunChart, spelledRun } from './run-chart'
import { BETWEEN_SEC, FIRST_TEMPO, RUN_DEGREES, RUN_NAMES, runDo, runLine, runNotes, runSec, SMUDGE, smudgeCentsAt, smudgeLands, smudgeLine, TOUCH, } from './sounds'

/** What the run toy offers in one place on the page. */
export interface RunState {
  /** Tempo's notches; without them the run keeps Step 4's 0.45 s. */
  readonly tempo: boolean
  /** Staccato · Legato. */
  readonly touch: boolean
  /** Play it smudged. */
  readonly smudged: boolean
}

/** Step 3's, Step 4's and free play's. */
export const RUN_STATES = {
  3: { tempo: true, touch: false, smudged: true },
  4: { tempo: false, touch: true, smudged: false },
  free: { tempo: true, touch: true, smudged: true },
} as const satisfies Readonly<Record<string | number, RunState>>

/** A tapped bead's note, s. */
const TAP_SEC = 0.6
/** A fingertip, px: closer beads are not buttons. */
const TARGET = 44
/** The smudged line's points, s apart. */
const TRACE_STEP = 0.01

/** The polite line for each play. */
export const RUN_SAID = {
  smudged:
    'An illustration: a smudged run, five of its nine notes outside their bands.',
  staccato: 'The run, staccato.',
} as const

/** "The run at 0.45 seconds a note." */
export const runSaid = (every: number): string =>
  `The run at ${every} seconds a note.`

/** A bead's button: "Bead 3, mi, F sharp 3". */
export const beadLabel = (i: number, doMidi: number): string =>
  `Bead ${i + 1}, ${RUN_NAMES[i]}, ${wordName(spelledRun(doMidi)[i])}`

/** The figure's label: "Merc's run: do, re, mi, so, la, so, mi, re and do, a note every 0.6 seconds". */
export function runDescribed(
  voice: Voice | null,
  every: number,
  staccato: boolean,
): string {
  const who = voice === 'higher' ? "Tavi's" : "Merc's"
  const names = `${RUN_NAMES.slice(0, -1).join(', ')} and ${RUN_NAMES[RUN_NAMES.length - 1]}`
  return `${who} run: ${names}, ${staccato ? 'staccato, ' : ''}a note every ${every} seconds`
}

/** The staff's state: the learner's clef, nine notes across, written once the run has played on it. */
export function runStaff(clef: Clef, written: Spelled[] | null): StaffState {
  return {
    staff: 'single',
    clef,
    tap: 'none',
    across: scoreAcross(RUN_DEGREES.length),
    noLanes: true,
    ...(written === null ? {} : { score: written.map((note) => ({ note })) }),
  }
}

/** The smudged singer's line as it goes, from `since` (ms); `until` freezes it where a stop left it. */
export function smudgeLive(since: number): LiveLine & { until: number } {
  return {
    until: Infinity,
    at(now) {
      const end = runSec(SMUDGE.every)
      const t = Math.max(
        0,
        Math.min(end, (Math.min(now, this.until) - since) / 1000),
      )
      const line: { t: number; c: number }[] = []
      for (let s = 0; s < t; s += TRACE_STEP)
        line.push({ t: s, c: smudgeCentsAt(s) })
      line.push({ t, c: smudgeCentsAt(t) })
      // a landing in its band lights its edge once the singer is there
      const lit = RUN_DEGREES.map(
        (_d, i) => smudgeLands(i) && t >= i * SMUDGE.every + SMUDGE.glide,
      )
      return { line, lit, done: t >= end || now >= this.until }
    },
  }
}

export interface RunToy {
  /** Tempo's notch, s a note. */
  readonly tempo: number
  readonly staccato: boolean
  /** Opens one place's controls: Step 4 holds the tempo at 0.45 s, and each place opens on Legato. */
  setState(state: RunState): void
  setTempo(every: number): void
  setStaccato(on: boolean): void
  /** The learner's voice: Merc or Tavi, the beads and the staff an octave apart. */
  setVoice(v: Voice | null): void
  /** Play the run, at the notch's tempo, legato or staccato. */
  play(): Promise<boolean>
  /** Play it smudged. */
  smudged(): Promise<boolean>
  /** Step 4's inline play: staccato, 0.5 s, then legato. */
  touchBoth(): Promise<boolean>
  stop(): void
}

/** A press: whether it may still go on, and whether it sounds. */
interface Press {
  readonly mine: number
  readonly audible: boolean
}

export function mountRunToy(
  root: HTMLElement,
  o: {
    /** When it draws: its stage on screen, on its step (the deck's `toyActive`). */
    readonly active: () => boolean
    readonly voice: Voice | null
    readonly state: RunState
    readonly light?: PlayLight
  },
): RunToy {
  const light = o.light ?? playLights()
  const viz = q('[data-run-viz]', root)
  const hits = q('[data-bead-hits]', root)
  const tag = q('[data-run-illustration]', root)
  const said = q('[data-run-said]', root)
  const tempoSeg = q('[data-run-tempo]', root)
  const tempoBtns = qa<HTMLButtonElement>('[data-tempo]', tempoSeg)
  const touchSeg = q('[data-run-touch]', root)
  const touchBtns = qa<HTMLButtonElement>('[data-touch]', touchSeg)
  const playBtn = q<HTMLButtonElement>('[data-run-play="run"]', root)
  const smudgeBtn = q<HTMLButtonElement>('[data-run-play="smudged"]', root)
  const staffBtn = q<HTMLButtonElement>('[data-run-staff]', root)
  const staffViz = q('[data-staff-viz]', root)

  let state: RunState = o.state
  let voice = o.voice
  let tempo = o.state.tempo ? FIRST_TEMPO : TOUCH.every
  /** Step 3's notch, kept while Step 4 holds the tempo. */
  let kept = FIRST_TEMPO
  let staccato = false
  let token = 0
  let run: Run | null = null
  /** A pause's wake-up, which a stop runs. */
  let pending: (() => void) | null = null
  /** The smudged singer's line while it draws. */
  let smudge: ReturnType<typeof smudgeLive> | null = null
  /** The staff has written the run: later plays light its noteheads. */
  let written = false

  const chart = mountRunChart(viz, {
    active: o.active,
    doMidi: runDo(voice),
    names: true,
  })
  const doMidi = (): number => chart.doMidi
  const clefNow = (): Clef => (voice === null ? 'bass' : clefForVoice(voice))
  const holdSec = (): number => (staccato ? TOUCH.staccato : tempo)

  const staff: StaffToy = mountStaff(root, {
    state: runStaff(clefNow(), null),
    owner: NowPlaying,
  })

  // ---------------------------------------------------------------- beads as buttons

  const beadBtns = RUN_DEGREES.map((_d, i) => {
    const b = document.createElement('button')
    b.type = 'button'
    b.className = 'bead-hit'
    b.dataset.bead = String(i)
    b.addEventListener('click', () => {
      void tapBead(i)
    })
    hits.appendChild(b)
    return b
  })

  /** Each bead's button over its bead, where the beads stand a fingertip apart; none closer. */
  function layOut(): void {
    const room = chart.spacing() >= TARGET
    hits.hidden = !room
    beadBtns.forEach((btn, i) => {
      btn.hidden = !room
      btn.setAttribute('aria-label', beadLabel(i, doMidi()))
      if (!room) return
      const at = chart.beadAt(i)
      btn.style.left = `${at.x - TARGET / 2}px`
      btn.style.top = `${at.y - TARGET / 2}px`
      btn.style.width = `${TARGET}px`
      btn.style.height = `${TARGET}px`
    })
  }
  new ResizeObserver(layOut).observe(q('canvas', viz))

  // ---------------------------------------------------------------- plays

  /** Stops what plays here: its sound, its staff, a pause, every glow; a smudged line stays where it was. */
  function halt(): void {
    token += 1
    run?.stop()
    run = null
    staff.stop()
    const wake = pending
    pending = null
    wake?.()
    if (smudge !== null)
      smudge.until = Math.min(smudge.until, performance.now())
    chart.rest()
  }

  function begin(): Press {
    halt()
    NowPlaying.claim(halt)
    return { mine: ++token, audible: Sound.canPlay() }
  }

  function end(press: Press, heard: boolean): boolean {
    if (press.mine !== token) return false
    NowPlaying.release(halt)
    run = null
    return heard
  }

  /** A play of Merc's: no illustrated line any more. */
  function clearSmudge(): void {
    smudge = null
    tag.hidden = true
    chart.follow(null)
  }

  /** The run's notes as the staff writes them, on the run's clock. */
  function staffNotes(): PlayNote[] {
    const spelled = spelledRun(doMidi())
    return runNotes(doMidi(), tempo, holdSec()).map((n, i) => ({
      t: n.t,
      dur: n.dur,
      note: spelled[i],
    }))
  }

  /** Writes the run on the staff as it plays, or lights what is written; nothing while the staff is off. */
  function onStaff(press: Press): void {
    if (staffViz.hidden) return
    const first = !written
    void staff
      .play({
        show: first ? 'run' : 'score',
        notes: staffNotes(),
        silent: true,
      })
      .then((heard) => {
        if (!first || !heard || press.mine !== token) return
        written = true
        staff.setState(runStaff(clefNow(), spelledRun(doMidi())))
      })
  }

  /** The run sung once, in the touch the toy has now. */
  function singRun(press: Press): Promise<boolean> {
    clearSmudge()
    const notes: RunNote[] = runNotes(doMidi(), tempo, holdSec())
    const onNote = (n: RunNote, i: number): void => {
      if (press.mine === token) chart.glow(i, n.dur)
    }
    run = staccato
      ? playNotes(notes, {
          audible: press.audible,
          kind: 'merc',
          attack: TOUCH.attack,
          release: TOUCH.release,
          onNote,
        })
      : allOf([
          playLine(runLine(doMidi(), tempo), {
            audible: press.audible,
            kind: 'merc',
          }),
          // the beads light on the line's own clock, silently
          playNotes(notes, { audible: false, onNote }),
        ])
    onStaff(press)
    said.textContent = staccato ? RUN_SAID.staccato : runSaid(tempo)
    return run.done
  }

  async function play(): Promise<boolean> {
    const press = begin()
    return end(press, await singRun(press))
  }

  async function playSmudged(): Promise<boolean> {
    setTempo(SMUDGE.every)
    setStaccato(false)
    const press = begin()
    smudge = smudgeLive(performance.now())
    chart.follow(smudge)
    tag.hidden = false
    said.textContent = RUN_SAID.smudged
    run = playLine(smudgeLine(doMidi()), {
      audible: press.audible,
      kind: 'soft',
    })
    // the line stays, whole or where a stop left it, until the next play
    return end(press, await run.done)
  }

  const pause = (press: Press): Promise<boolean> =>
    new Promise((resolve) => {
      const id = window.setTimeout(() => {
        pending = null
        resolve(press.mine === token)
      }, BETWEEN_SEC * 1000)
      pending = () => {
        window.clearTimeout(id)
        resolve(false)
      }
    })

  async function touchBoth(): Promise<boolean> {
    const press = begin()
    showTouch(true)
    if (!(await singRun(press)) || !(await pause(press)))
      return end(press, false)
    showTouch(false)
    return end(press, await singRun(press))
  }

  async function tapBead(i: number): Promise<boolean> {
    const press = begin()
    clearSmudge()
    chart.glow(i, TAP_SEC)
    run = playNote(doMidi() + RUN_DEGREES[i], TAP_SEC, {
      audible: press.audible,
      kind: 'merc',
    })
    return end(press, await run.done)
  }

  // ---------------------------------------------------------------- controls

  /** Tempo or touch changed: the slots redrawn, the buttons laid over them, the label anew. */
  function reslot(): void {
    chart.setTempo(tempo, holdSec())
    chart.describe(runDescribed(voice, tempo, staccato))
    layOut()
  }

  /** Staccato or legato drawn and pressed, without stopping what plays (the inline play's own moves). */
  function showTouch(on: boolean): void {
    staccato = on
    touchBtns.forEach((b) =>
      b.setAttribute(
        'aria-pressed',
        String((b.dataset.touch === 'staccato') === on),
      ),
    )
    reslot()
  }

  function setTempo(every: number): void {
    if (every === tempo) return
    halt()
    tempo = every
    tempoBtns.forEach((b) =>
      b.setAttribute('aria-pressed', String(Number(b.dataset.tempo) === every)),
    )
    reslot()
  }

  function setStaccato(on: boolean): void {
    if (on === staccato) return
    halt()
    showTouch(on)
  }

  function setState(next: RunState): void {
    halt()
    if (state.tempo && !next.tempo) kept = tempo
    const to = next.tempo ? (state.tempo ? tempo : kept) : TOUCH.every
    state = next
    tempoSeg.hidden = !next.tempo
    touchSeg.hidden = !next.touch
    smudgeBtn.hidden = !next.smudged
    tempo = -1
    setTempo(to)
    showTouch(false)
  }

  function setVoice(v: Voice | null): void {
    if (v === voice) return
    halt()
    voice = v
    if (runDo(v) !== doMidi()) {
      clearSmudge()
      chart.setDo(runDo(v))
      staff.setState(runStaff(clefNow(), written ? spelledRun(doMidi()) : null))
    }
    reslot()
  }

  tempoBtns.forEach((b) =>
    b.addEventListener('click', () => setTempo(Number(b.dataset.tempo))),
  )
  touchBtns.forEach((b) =>
    b.addEventListener('click', () =>
      setStaccato(b.dataset.touch === 'staccato'),
    ),
  )
  playBtn.addEventListener('click', () => light(playBtn, play()))
  smudgeBtn.addEventListener('click', () => light(smudgeBtn, playSmudged()))
  staffBtn.addEventListener('click', () => {
    const on = staffViz.hidden
    staffViz.hidden = !on
    staffBtn.setAttribute('aria-pressed', String(on))
    if (!on) staff.stop()
  })

  setState(o.state)

  return {
    get tempo() {
      return tempo
    },
    get staccato() {
      return staccato
    },
    setState,
    setTempo,
    setStaccato,
    setVoice,
    play,
    smudged: playSmudged,
    touchBoth,
    stop: halt,
  }
}
