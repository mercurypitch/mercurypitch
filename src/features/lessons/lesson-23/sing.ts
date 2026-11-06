// ============================================================
// Lesson 23 Sing it — do up to so, then so up to do, on your own staff, with nothing listening
// ============================================================
//
// Lesson 15's Sing it on the kit's flow (kit/sing-flow.ts), with this
// page's line after Easy and Workable (WEB-SPEC, Toys 5): the comfort
// check, every visit and never stored; the voice choice, which picks the
// Merc who sings and the learner's staff, the bass clef for the lower voice
// and the treble for the higher, which follows a change at once, as the
// steps' staff and the four words do; Your turn, with Play Merc's notes and
// Start the guide; "How did that feel?" after every sweep run to its end;
// and Then just listen (listen-pair.ts), shown in every ending once a voice
// is chosen, since it asks nothing of the voice.
//
// The staff is the kit's staff toy in its sing-along state (kit/staff.ts):
// do, so, then so, do as plain noteheads, D3, A3, A3 and D4 for the lower
// voice, D4 just above middle C's ledger line, or D4, A4, A4 and D5 on the
// treble staff, D4 hanging below its bottom line, the house under each do
// (FACTS 52, 55). Until a voice is chosen it waits in the treble with no
// notes. Play Merc's notes plays Merc's line (lower) or Tavi's (higher) as
// two contours a breath apart, each one voice (kit/run.ts `playLines`): do
// held 1.15 s, a 0.05 s glide to so, so held 1.8 s; 1.0 s of quiet; then so
// up to do the same way, 7.0 s in all (FACTS 55, 72), each note lit amber
// as it sounds and none through the breath. Start the guide waits until
// those notes have been heard with sound on; then it counts in on do, 0.8 s
// at 0.065 and 0.2 s of quiet (kit/move-do.ts `countIn`), and a chrome line
// sweeps along the four notes for 7.0 s with no voice and nothing on the
// notes themselves. No Move do, no octave below and no readout (FACTS 53).
//
// Merc's notes and a sweep are the page's one sound (kit/now-playing.ts):
// a press of any of Sing it's controls while one runs stops it and then
// acts, and a sound anywhere else on the page stops it too. Notes cut short
// have not been heard, and a sweep cut short asks nothing. Lesson 3's rule
// for leaving holds (kit/leave.ts). Focus moves only to text, never to a
// button, so Space never starts the guide by itself (REQ-GVC-080). The page
// has no microphone and scores nothing; only the voice is stored, by the
// kit's voice choice. The visit's ending (kit/comfort.ts `VisitEnding`)
// picks the Wrap's practice card's rest line.

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
import { openState, singFlow } from '@/features/lessons/kit/sing-flow'
import { contourOf, Sound } from '@/features/lessons/kit/sound'
import type { StaffState, StaffToy } from '@/features/lessons/kit/staff'
import { mountStaff } from '@/features/lessons/kit/staff'
import { clefForVoice, midiOf } from '@/features/lessons/kit/staff-places'
import type { Voice } from '@/features/lessons/kit/voice-choice'
import { bindVoiceButtons, VoiceChoice, } from '@/features/lessons/kit/voice-choice'
import mercBlue from '@/features/lessons/lesson-01/assets/merc-blue.png'
import mercOrange from '@/features/lessons/lesson-01/assets/merc-orange.png'
import type { ListenPair } from './listen-pair'
import { initListenPair } from './listen-pair'
import { SING_GLIDE, SING_HALF, SING_HOLD, SING_NOTES, SING_ONSETS, SING_SEC, SING_TOP, voiced, } from './sounds'

/** The kit's flow, with this page's line after Easy and Workable (LESSON.md, Sing it). */
export const FLOW = singFlow({
  sung: 'interval',
  line: 'A fifth, then a fourth: one interval and its upside down.',
})

/** A voice's four notes, written: the higher voice's, or the lower's an octave down. */
const notesOf = (v: Voice): Spelled[] =>
  SING_NOTES.map((n) => voiced(n, clefForVoice(v)))

/** Do's letter in D: the house goes under each do. */
const DO = SING_NOTES[0].letter

/** The learner's staff for `v`, or the treble staff waiting with no notes. */
export function singStaff(v: Voice | null): StaffState {
  if (v === null) return { staff: 'single', clef: 'treble', tap: 'none' }
  return {
    staff: 'single',
    clef: clefForVoice(v),
    tap: 'none',
    score: notesOf(v).map((n) => ({ note: n, home: n.letter === DO })),
  }
}

/** Merc's line (lower) or Tavi's (higher): do up to so, a breath, then so up to do, each half one voice, 7.0 s. */
export function singLines(v: Voice): RunLine[] {
  const m = notesOf(v).map(midiOf)
  const half = (from: number, to: number) =>
    contourOf(hz(from), [
      { hold: SING_HOLD },
      { glide: SING_GLIDE, to: hz(to) },
      { hold: SING_TOP },
    ])
  return [
    { t: SING_ONSETS[0], points: half(m[0], m[1]) },
    { t: SING_ONSETS[2], points: half(m[2], m[3]) },
  ]
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
  readonly pair: ListenPair
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
  const listenPanel = q('[data-listen-pair]', card)
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
  const pair = initListenPair()

  function render(): void {
    const v = FLOW.singView(state)
    for (const p of panels)
      p.hidden = !v.panels.includes(p.dataset.panel as Panel)
    for (const el of qa('[data-voice-line]', card))
      el.hidden = el.dataset.voiceLine !== v.voiceLine
    for (const el of qa('[data-sing-part]', card)) el.hidden = !v.singParts
    startBtn.setAttribute('aria-disabled', String(!v.startEnabled))
    hint.hidden = v.hint === null
    if (v.hint !== null) say(hint, FLOW.HINT[v.hint])
    for (const el of qa('[data-after]', feelPanel))
      el.hidden = el.dataset.after !== v.after
    q('[data-after-doctor]', feelPanel).hidden = !v.doctor
    // then just listen, in every ending: it plays in the chosen voice's octave
    listenPanel.hidden = !v.panels.includes('notes')
    say(statusEl, v.status)
    if (VisitEnding.ending !== v.card) VisitEnding.set(v.card)
  }

  function dispatch(e: SingEvent): void {
    state = FLOW.nextState(state, e)
    render()
  }

  /** The staff and the still follow the voice. */
  function relabel(): void {
    staff.setState(singStaff(state.voice))
    const s = STILL[state.voice ?? 'higher']
    still.src = s.src
    still.alt = s.alt
  }

  /**
   * Stops Merc's notes or the sweep where they stand: the staff rests, a
   * sweep cut short asks nothing, and the card goes back to what the flow
   * showed before.
   */
  function stopRun(): void {
    if (playing === null && !state.sweeping) return
    stops += 1
    playing?.stop()
    playing = null
    counting?.stop()
    counting = null
    timers.forEach((id) => window.clearTimeout(id))
    timers = []
    cancelAnimationFrame(frame)
    staff.light(null)
    staff.sweep(null)
    for (const b of [notesBtn, startBtn]) b.classList.remove('is-on')
    NowPlaying.release(stopRun)
    if (state.sweeping) state = FLOW.nextState(state, { type: 'sweepCut' })
    render()
  }

  /** Merc's notes: two halves a breath apart, each note lit amber as it sounds and none through the breath. */
  async function playMerc(): Promise<void> {
    // the voice picks the Merc who sings: nothing plays before it is chosen
    if (state.voice === null) return
    stopRun()
    NowPlaying.claim(stopRun)
    const mine = stops
    const audible = Sound.canPlay()
    const run = playLines(singLines(state.voice), { audible, kind: 'merc' })
    playing = run
    notesBtn.classList.add('is-on')
    timers = [
      ...SING_ONSETS.map((t, i) =>
        window.setTimeout(() => staff.light(i, 'amber'), t * 1000),
      ),
      // the breath: nothing sounds, so nothing is lit
      window.setTimeout(() => staff.light(null), SING_HALF * 1000),
    ]
    const ended = await run.done
    if (mine !== stops) return
    // every sound stopped under it (the Sound switch, a hidden page): not heard
    if (!ended) {
      stopRun()
      return
    }
    playing = null
    timers = []
    staff.light(null)
    notesBtn.classList.remove('is-on')
    NowPlaying.release(stopRun)
    dispatch({ type: 'played', heard: audible })
  }

  /** The viewer's turn: the count-in on do, then the sweep; "How did that feel?" once it ends. */
  async function startGuide(): Promise<void> {
    const v = FLOW.singView(state)
    if (!v.singParts || !v.startEnabled || state.voice === null) return
    stopRun()
    NowPlaying.claim(stopRun)
    const mine = stops
    const audible = Sound.canPlay()
    dispatch({ type: 'sweepStart' })
    startBtn.classList.add('is-on')
    counting = countIn(midiOf(notesOf(state.voice)[0]), audible)
    // the sweep's clock: silent, the count-in and then the four notes' 7.0 s
    const total = COUNT_IN_SEC + SING_SEC
    const clock = playLine(
      [
        { t: 0, hz: 1, level: 0 },
        { t: total, hz: 1, level: 0 },
      ],
      { audible: false },
    )
    playing = clock
    const t0 = performance.now()
    const step = (now: number): void => {
      if (mine !== stops) return
      const u = ((now - t0) / 1000 - COUNT_IN_SEC) / SING_SEC
      staff.sweep(u < 0 ? null : Math.min(1, u))
      if (u < 1) frame = requestAnimationFrame(step)
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
    cancelAnimationFrame(frame)
    staff.sweep(null)
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
  return { staff, pair, stop: stopRun }
}
