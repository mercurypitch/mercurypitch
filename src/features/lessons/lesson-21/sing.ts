// ============================================================
// Lesson 21 Sing it — so, la, ti, do in C and then in G, with nothing listening
// ============================================================
//
// Sing it on the kit's flow (kit/sing-flow.ts), Lesson 15's with two runs
// in place of one, and this page's line after Easy and Workable (WEB-SPEC,
// Toys 7): the comfort check, every visit and never stored; the voice
// choice, which picks the Merc who sings and the learner's staff, the bass
// clef for the lower voice and the treble for the higher, and follows a
// change at once; Your turn, with Play Merc's notes and Start the guide;
// and "How did that feel?" after every sweep run to its end.
//
// The staff is the kit's staff toy in its sing-along state (kit/staff.ts):
// so, la, ti and do in C as plain noteheads, G3 to C4 for the lower voice,
// C4 on middle C's ledger line, or G4 to C5 on the treble staff, the house
// on do, C. Until a voice is chosen it waits in the treble with no notes.
// Play Merc's notes plays Merc's two runs (lower) or Tavi's (higher), each
// one voice along a contour, so, la and ti held 1.15 s and glided 0.05 s
// and do held 1.8 s, 5.4 s a run, each note lit amber as it sounds; in the
// 2.0 s between them the staff turns to G, D3 to G3 or D4 to G4, its
// signature gaining F sharp, which fades in and is said, and the house
// moving to G: 12.8 s in all (FACTS 56, 64). Start the guide waits until
// those notes have been heard with sound on; then it counts in on so
// (kit/move-do.ts `countIn`), a chrome line sweeps along the four notes in
// C with no voice, the staff turns to G as in Merc's, a second count-in on
// the new so fills the gap's last second, since the second run starts ten
// semitones below the first's do, and the line sweeps along the four in G:
// 13.8 s in all. No Move do and no readout. Once a run ends, heard or cut
// short, the staff rests in C again, where the next one starts.
//
// Merc's notes and a sweep are the page's one sound (kit/now-playing.ts):
// a press of any of Sing it's controls while one runs stops it and then
// acts, and a sound anywhere else on the page stops it too. Notes cut short
// have not been heard, and a sweep cut short asks nothing. Lesson 3's rule
// for leaving holds (kit/leave.ts). Focus moves only to text, never to a
// button, so Space never starts the guide by itself (REQ-GVC-080). The page
// has no microphone and scores nothing; only the voice is stored, by the
// kit's voice choice. The visit's ending (kit/comfort.ts `VisitEnding`)
// picks the Wrap's practice card's rest line (wrap.ts).

import type { Feeling } from '@/features/lessons/kit/comfort'
import { mountComfort, mountFeelings, VisitEnding, } from '@/features/lessons/kit/comfort'
import { q, qa } from '@/features/lessons/kit/dom'
import { onLeave } from '@/features/lessons/kit/leave'
import { COUNT_IN_SEC, countIn } from '@/features/lessons/kit/move-do'
import type { Spelled } from '@/features/lessons/kit/notes'
import { hz } from '@/features/lessons/kit/notes'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import type { Run, RunLine } from '@/features/lessons/kit/run'
import { playLine, playLines } from '@/features/lessons/kit/run'
import type { Comfort, Panel, SingEvent, } from '@/features/lessons/kit/sing-flow'
import { HINT, nextState, openState, singFlow, } from '@/features/lessons/kit/sing-flow'
import type { ContourPoint } from '@/features/lessons/kit/sound'
import { contourOf, Sound } from '@/features/lessons/kit/sound'
import type { StaffState, StaffToy } from '@/features/lessons/kit/staff'
import { mountStaff } from '@/features/lessons/kit/staff'
import type { KeySig } from '@/features/lessons/kit/staff-key'
import { clefForVoice, midiOf } from '@/features/lessons/kit/staff-places'
import type { Voice } from '@/features/lessons/kit/voice-choice'
import { bindVoiceButtons, VoiceChoice, } from '@/features/lessons/kit/voice-choice'
import mercBlue from '@/features/lessons/lesson-01/assets/merc-blue.png'
import mercOrange from '@/features/lessons/lesson-01/assets/merc-orange.png'
import { note } from './sounds'

/** The kit's flow, with this page's line after Easy and Workable (LESSON.md, Sing it). */
export const FLOW = singFlow({
  sung: 'keys',
  line: 'So, la, ti, do, in two keys: the same syllables on a new do.',
})

/** Each run: so, la, ti and do in C, then in G, for each voice (FACTS 64). */
export const SING_RUNS: Readonly<
  Record<Voice, readonly [readonly string[], readonly string[]]>
> = {
  lower: [
    ['G3', 'A3', 'B3', 'C4'],
    ['D3', 'E3', 'F♯3', 'G3'],
  ],
  higher: [
    ['G4', 'A4', 'B4', 'C5'],
    ['D4', 'E4', 'F♯4', 'G4'],
  ],
}

/** So, la and ti each held 1.15 s, then a 0.05 s glide; do held 1.8 s (FACTS 56). */
export const SING_HOLD = 1.15
export const SING_GLIDE = 0.05
export const SING_TOP = 1.8

const round = (s: number): number => Math.round(s * 1000) / 1000

/** A run: three notes of 1.2 s and do, 5.4 s. */
export const RUN_SEC = round(3 * (SING_HOLD + SING_GLIDE) + SING_TOP)

/** The quiet between the runs, while the staff turns to G (FACTS 56). */
export const SING_GAP = 2

/** The second run's start: 7.4 s. */
export const RUN2_AT = round(RUN_SEC + SING_GAP)

/** Merc's notes, and the guide after its count-in: 12.8 s. */
export const SING_SEC = round(RUN2_AT + RUN_SEC)

/** Each note's start, both runs on one clock: 0, 1.2, 2.4 and 3.6, then 7.4, 8.6, 9.8 and 11. */
export const SING_ONSETS: readonly number[] = [0, RUN2_AT].flatMap((at) =>
  [0, 1, 2, 3].map((i) => round(at + i * (SING_HOLD + SING_GLIDE))),
)

/** G major's one sharp, which the staff gains between the runs. */
const G_MAJOR: KeySig = { sign: 'sharp', count: 1 }

/** A voice's run, in C (0) or in G (1), written. */
export const runOf = (v: Voice, run: 0 | 1): Spelled[] =>
  SING_RUNS[v][run].map(note)

/**
 * The learner's staff for `v`, run `run`'s four notes with the house on do
 * and the run's signature, room kept for its sharp so the notes stay put
 * as it joins; or the treble staff waiting with no notes.
 */
export function singStaff(v: Voice | null, run: 0 | 1 = 0): StaffState {
  if (v === null) return { staff: 'single', clef: 'treble', tap: 'none' }
  return {
    staff: 'single',
    clef: clefForVoice(v),
    tap: 'none',
    score: runOf(v, run).map((n, i) => ({ note: n, home: i === 3 })),
    key: run === 1 ? G_MAJOR : null,
    keyRoom: 1,
  }
}

/** One run as one voice: so, la and ti held and glided, do held. */
function runLine(notes: readonly Spelled[]): ContourPoint[] {
  const midis = notes.map(midiOf)
  return contourOf(
    hz(midis[0]),
    midis.flatMap((_m, i) =>
      i < midis.length - 1
        ? [{ hold: SING_HOLD }, { glide: SING_GLIDE, to: hz(midis[i + 1]) }]
        : [{ hold: SING_TOP }],
    ),
  )
}

/** Merc's two runs (lower) or Tavi's (higher), the second 7.4 s in. */
export function singLines(v: Voice): RunLine[] {
  return [
    { t: 0, points: runLine(runOf(v, 0)) },
    { t: RUN2_AT, points: runLine(runOf(v, 1)) },
  ]
}

/** The guide's line `t` s past its first count-in: along the run in C, none between the runs, then along the run in G. */
export function sweepAt(t: number): number | null {
  if (t < 0) return null
  if (t <= RUN_SEC) return t / RUN_SEC
  if (t < RUN2_AT) return null
  return Math.min(1, (t - RUN2_AT) / RUN_SEC)
}

/** The still beside the staff: the Merc who sings, for each voice. */
const STILL: Readonly<Record<Voice, { src: string; alt: string }>> = {
  lower: { src: mercBlue, alt: 'Merc, who sings the lower line' },
  higher: { src: mercOrange, alt: 'Tavi, who sings the higher line' },
}

/** Writes a live line only when its words change, so a screen reader hears it once. */
function say(el: HTMLElement, text: string): void {
  if (el.textContent !== text) el.textContent = text
}

/** Keeps the keyboard's place on text, never on a button. */
function focusText(el: HTMLElement | null): void {
  if (el === null) return
  el.tabIndex = -1
  el.focus({ preventScroll: true })
}

/** The shown panel's first shown line. */
function shownLine(card: HTMLElement): HTMLElement | null {
  const lines = card.querySelectorAll<HTMLElement>(
    '[data-panel]:not([hidden]) p',
  )
  return Array.from(lines).find((p) => p.closest('[hidden]') === null) ?? null
}

export interface Sing {
  readonly staff: StaffToy
  stop(): void
}

export function initSing(): Sing {
  const card = q('#singCard')
  const statusEl = q('#singStatus')
  const panels = qa('[data-panel]', card)
  const notesBtn = q<HTMLButtonElement>('[data-notes-play]', card)
  const startBtn = q<HTMLButtonElement>('[data-guide-start]', card)
  const hint = q('[data-guide-hint]', card)
  const feelPanel = q('[data-panel="feel"]', card)
  const staffRoot = q('#singStaff', card)
  const still = q<HTMLImageElement>('.sing-merc', staffRoot)

  let state = openState(VoiceChoice.voice)
  // the stops so far: a run that finds them changed was cut short
  let stops = 0
  let playing: Run | null = null
  let counting: ReturnType<typeof countIn> = null
  let timers: number[] = []
  let frame = 0

  const staff = mountStaff(staffRoot, {
    state: singStaff(state.voice),
    owner: NowPlaying,
  })

  function render(): void {
    const v = FLOW.singView(state)
    for (const p of panels)
      p.hidden = !v.panels.includes(p.dataset.panel as Panel)
    for (const el of qa('[data-voice-line]', card))
      el.hidden = el.dataset.voiceLine !== v.voiceLine
    for (const el of qa('[data-sing-part]', card)) el.hidden = !v.singParts
    startBtn.setAttribute('aria-disabled', String(!v.startEnabled))
    hint.hidden = v.hint === null
    if (v.hint !== null) say(hint, HINT[v.hint])
    for (const el of qa('[data-after]', feelPanel))
      el.hidden = el.dataset.after !== v.after
    q('[data-after-doctor]', feelPanel).hidden = !v.doctor
    say(statusEl, v.status)
    if (VisitEnding.ending !== v.card) VisitEnding.set(v.card)
  }

  function clearTimers(): void {
    timers.forEach((id) => window.clearTimeout(id))
    timers = []
  }

  function dispatch(e: SingEvent): void {
    state = nextState(state, e)
    render()
  }

  /** The staff rests in C, where every run starts, and the still follows the voice. */
  function relabel(): void {
    staff.setState(singStaff(state.voice))
    const s = STILL[state.voice ?? 'higher']
    still.src = s.src
    still.alt = s.alt
  }

  /** Between the runs: the four notes in G, the house on G, and the signature's sharp joining, faded in and said. */
  function turnToG(v: Voice): void {
    staff.setState({ ...singStaff(v, 1), key: null })
    staff.setKey(G_MAJOR)
  }

  /**
   * Stops Merc's notes or the sweep where they stand: the staff rests in C,
   * a sweep cut short asks nothing, and the card goes back to what the
   * flow showed before.
   */
  function stopRun(): void {
    if (playing === null && !state.sweeping) return
    stops += 1
    playing?.stop()
    playing = null
    counting?.stop()
    counting = null
    clearTimers()
    cancelAnimationFrame(frame)
    staff.setState(singStaff(state.voice))
    for (const b of [notesBtn, startBtn]) b.classList.remove('is-on')
    NowPlaying.release(stopRun)
    if (state.sweeping) state = nextState(state, { type: 'sweepCut' })
    render()
  }

  /** Merc's notes: the run in C, the staff turning to G, then the run in G, each note lit amber as it sounds. */
  async function playMerc(): Promise<void> {
    // the voice picks the Merc who sings: nothing plays before it is chosen
    if (state.voice === null) return
    const v = state.voice
    stopRun()
    NowPlaying.claim(stopRun)
    const mine = stops
    const audible = Sound.canPlay()
    const run = playLines(singLines(v), { audible, kind: 'merc' })
    playing = run
    notesBtn.classList.add('is-on')
    timers = [
      ...SING_ONSETS.map((t, i) =>
        window.setTimeout(() => staff.light(i % 4, 'amber'), t * 1000),
      ),
      window.setTimeout(() => turnToG(v), RUN_SEC * 1000),
    ]
    const ended = await run.done
    if (mine !== stops) return
    // every sound stopped under it (the Sound switch, a hidden page): not heard
    if (!ended) {
      stopRun()
      return
    }
    playing = null
    clearTimers()
    staff.setState(singStaff(v))
    notesBtn.classList.remove('is-on')
    NowPlaying.release(stopRun)
    dispatch({ type: 'played', heard: audible })
  }

  /** The viewer's turn: a count-in on so, the sweep in C, the turn to G with a count-in on its so, the sweep in G; "How did that feel?" once it ends. */
  async function startGuide(): Promise<void> {
    const view = FLOW.singView(state)
    if (!view.singParts || !view.startEnabled || state.voice === null) return
    const v = state.voice
    stopRun()
    NowPlaying.claim(stopRun)
    const mine = stops
    const audible = Sound.canPlay()
    dispatch({ type: 'sweepStart' })
    startBtn.classList.add('is-on')
    counting = countIn(midiOf(runOf(v, 0)[0]), audible)
    timers = [
      window.setTimeout(() => turnToG(v), (COUNT_IN_SEC + RUN_SEC) * 1000),
      // the gap's last second: a count-in on the new so
      window.setTimeout(() => {
        counting = countIn(midiOf(runOf(v, 1)[0]), audible)
      }, RUN2_AT * 1000),
    ]
    // the sweep's clock: silent, the count-in and then the two runs' 12.8 s
    const clock = playLine(
      [
        { t: 0, hz: 1, level: 0 },
        { t: COUNT_IN_SEC + SING_SEC, hz: 1, level: 0 },
      ],
      { audible: false },
    )
    playing = clock
    const t0 = performance.now()
    const step = (now: number): void => {
      if (mine !== stops) return
      const t = (now - t0) / 1000 - COUNT_IN_SEC
      staff.sweep(sweepAt(t))
      if (t < SING_SEC) frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
    const ended = await clock.done
    if (mine !== stops) return
    if (!ended) {
      stopRun()
      return
    }
    playing = null
    counting = null
    clearTimers()
    cancelAnimationFrame(frame)
    staff.setState(singStaff(v))
    startBtn.classList.remove('is-on')
    NowPlaying.release(stopRun)
    // asked afresh, with no answer pressed
    feelings.reset()
    dispatch({ type: 'sweepEnd' })
    focusText(q<HTMLElement>('.feel-q', feelPanel))
  }

  function answer(comfort: Comfort): void {
    dispatch({ type: 'comfort', comfort })
    focusText(shownLine(card))
  }

  mountComfort(card, {
    onSing: () => answer('sing'),
    onListen: () => answer('listen'),
  })
  bindVoiceButtons(card, (v) => {
    stopRun()
    dispatch({ type: 'voice', voice: v })
    relabel()
  })
  // the kit's lock: an answer stands until the next sweep asks afresh
  const feelings = mountFeelings(feelPanel, (f: Feeling) => {
    dispatch({ type: 'feel', feeling: f })
    focusText(
      feelPanel.querySelector<HTMLElement>('[data-after]:not([hidden])'),
    )
  })
  notesBtn.addEventListener('click', () => void playMerc())
  startBtn.addEventListener('click', () => void startGuide())
  onLeave(q('#sing'), stopRun)

  relabel()
  render()
  return { staff, stop: stopRun }
}
