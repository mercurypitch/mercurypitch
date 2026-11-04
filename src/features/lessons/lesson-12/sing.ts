// ============================================================
// Lesson 12 Sing it — the loop's roots over its chords, with nothing listening
// ============================================================
//
// The comfort check, the voice choice, Merc's notes, Move do, the guide and
// "How did that feel?" after every sweep (WEB-SPEC, Toys 6). What shows
// when is the pure flow's (sing-flow.ts): this plays and draws it, every
// control shown exactly when the flow offers it, and its status line, a
// polite live region, written only when its words change, so a screen
// reader hears each once. The comfort check comes first on every visit and
// is never stored (REQ-GVC-020, 021); with no voice stored the voice choice
// comes before either path and nothing plays until one is chosen, since
// the voice picks the Merc who sings. "Just listen today" shows its line
// and the doctor lines, and Play Merc's notes alone: nothing asks the
// viewer to sing, and the Wrap rests.
//
// Play Merc's notes sings the loop's roots, do, so, la, fa and do, from
// do = C4, or C5 for the higher voice, in Merc's "ooh" over the chords I,
// V, vi, IV and I at 0.05 a voice, as one run: 10.0 s, the guide's path
// lighting in the app's target amber in step while the ring shows the
// still of the Merc singing (FACTS 59, 61, 73; sing-guide.ts). Move do
// moves do a semitone at a time, four lower and three higher (FACTS 60),
// and Merc's notes, the chords, the guide, its count-in, the readout and
// the ring's do move with it; at either end its button is aria-disabled,
// and a press there does nothing. Start the guide waits, aria-disabled
// under its hint, until Merc's notes have been heard to their end with
// sound on (hear it first: playbook rule 16). Then it is the viewer's
// turn: do once, softly, at half a tapped note's level for 0.8 s and 0.2 s
// of quiet (kit/move-do.ts `countIn`), then the kit's chrome line sweeps
// the path for 10.0 s past each gap and its breath mark, 5.6 s in, while
// the chords play under it and the ring breathes with the still of the
// Merc last heard; Merc does not sing (FACTS 62, 73). Under reduced motion
// the path's notes light one after another instead of the line, and the
// ring holds still (kit/slide-guide.ts, kit/sing.ts `calm`).
//
// Each sweep that ends asks "How did that feel?" afresh, under the kit's
// lock, so an answer stands until the next sweep (FACTS 63). Easy and
// Workable leave the guide as it was; Effortful and Uncomfortable put the
// guide and Move do away for the visit, and Play Merc's notes still plays
// at the do Move do last set. The visit's ending picks the Wrap's card
// (kit/comfort.ts `VisitEnding`, `mountPractiseCard`), in memory only:
// the rest card after "Just listen today", "Effortful" or "Uncomfortable".
//
// Merc's notes and a sweep are the page's one sound (kit/now-playing.ts):
// a press of any of Sing it's controls while one runs stops it and then
// acts, and a sound anywhere else on the page stops it too. Notes cut
// short, by a press, another sound, or every sound stopping (the Sound
// switch, a hidden page), have not been heard, and a sweep cut short asks
// nothing: the card goes back to what it showed before it ran. Lesson 3's
// rule for leaving holds (kit/leave.ts): off screen for 600 ms, or the
// page hidden or gone, and whatever plays stops, the guide and the ring
// with it. Focus moves only to text, never to a button, so Space never
// starts the guide by itself (REQ-GVC-080). The page has no microphone and
// scores nothing; only the voice is stored, by the kit's voice choice.

import type { Feeling } from '@/features/lessons/kit/comfort'
import { mountComfort, mountFeelings, mountPractiseCard, VisitEnding, } from '@/features/lessons/kit/comfort'
import { q, qa } from '@/features/lessons/kit/dom'
import { onLeave } from '@/features/lessons/kit/leave'
import type { Which } from '@/features/lessons/kit/merc-duo'
import { COUNT_IN_SEC, countIn, nextShift, setMoveEnds, } from '@/features/lessons/kit/move-do'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import type { Run } from '@/features/lessons/kit/run'
import { playNotes } from '@/features/lessons/kit/run'
import type { RingStills } from '@/features/lessons/kit/sing'
import { mountRing } from '@/features/lessons/kit/sing'
import { mountGuide } from '@/features/lessons/kit/slide-guide'
import { Sound } from '@/features/lessons/kit/sound'
import type { Voice } from '@/features/lessons/kit/voice-choice'
import { bindVoiceButtons, mercOf, VoiceChoice, } from '@/features/lessons/kit/voice-choice'
import { ringLabel } from './lines'
import type { Comfort, Panel, SingEvent } from './sing-flow'
import { HINT, nextState, openState, singView } from './sing-flow'
import { BREATH_SEC, guideChordsAt, guidePath, guideRows, REACH, readoutAt, singAlongAt, singDo, } from './sing-guide'
import { GUIDE, lengthOf } from './sounds'

/** Merc's notes and the guide's sweep: 10.0 s (FACTS 61). */
export const SING_SEC = lengthOf(GUIDE)

/**
 * The ring's state lines, Lesson 6's for the same guide: "Listen" while
 * Merc sings, "Get ready" through the count-in, the countdown through the
 * sweep, and "Rest" after, never "Again whenever you like", which after
 * "Effortful" would ask for a repeat (REQ-GVC-021).
 */
const RING_WORDS = {
  listen: 'Listen',
  turn: (n: number) => `Sing with the line · ${n}`,
  done: 'Rest',
} as const
const COUNT_IN_WORD = 'Get ready'

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

/**
 * The shown panel's first shown line. The voice panel opens on a line a
 * first visit never sees ("Keep the voice you chose before"), hidden, and
 * focus sent there would fall to the page.
 */
function shownLine(card: HTMLElement): HTMLElement | null {
  const lines = card.querySelectorAll<HTMLElement>(
    '[data-panel]:not([hidden]) p',
  )
  return Array.from(lines).find((p) => p.closest('[hidden]') === null) ?? null
}

export function initSing(stills: RingStills): void {
  const card = q('#singCard')
  const statusEl = q('#singStatus')
  const panels = qa('[data-panel]', card)
  const notesBtn = q<HTMLButtonElement>('[data-notes-play]', card)
  const startBtn = q<HTMLButtonElement>('[data-guide-start]', card)
  const hint = q('[data-guide-hint]', card)
  const moves = qa<HTMLButtonElement>('[data-move-do]', card)
  const readout = q('[data-do-readout]', card)
  const feelPanel = q('[data-panel="feel"]', card)
  const ringEl = q('.ring', card)
  // under reduced motion the ring holds its breathing circle still, and
  // has no ripples; its words are Lesson 6's, whose guide this is
  const ring = mountRing(ringEl, { stills, calm: true, words: RING_WORDS })

  let state = openState(VoiceChoice.voice)
  let shift = 0
  // the stops so far: a run that finds them changed was cut short
  let stops = 0
  // what plays: Merc's notes over the chords, or the chords under a sweep,
  // and the count-in's note before it
  let playing: Run | null = null
  let counting: ReturnType<typeof countIn> = null
  // the do line's markup as last written, so a press that changes nothing writes nothing
  let doLine = readout.innerHTML.trim()

  const voice = (): Voice => state.voice ?? 'lower'
  const doMidi = (): number => singDo(voice(), shift)
  // the Merc last heard singing Merc's notes, whose still the ring shows through a sweep
  let heardMerc: Which = mercOf(voice())
  const guide = mountGuide(q('#rootsGuide', card), {
    rows: guideRows(voice(), shift),
    path: guidePath(voice(), shift),
    rest: 'amber',
    breaths: [BREATH_SEC],
  })

  function render(): void {
    const v = singView(state)
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

  function dispatch(e: SingEvent): void {
    state = nextState(state, e)
    render()
  }

  /**
   * Stops Merc's notes or the sweep where they stand: the guide and the
   * ring rest, a sweep cut short asks nothing, and the card goes back to
   * what the flow showed before.
   */
  function stopRun(): void {
    if (playing === null && !state.sweeping) return
    stops += 1
    playing?.stop()
    playing = null
    counting?.stop()
    counting = null
    guide.stop()
    ring.stop()
    for (const b of [notesBtn, startBtn]) b.classList.remove('is-on')
    NowPlaying.release(stopRun)
    if (state.sweeping) state = nextState(state, { type: 'sweepCut' })
    render()
  }

  /** The guide, the readout, the ring's do and Move do's ends follow the voice and Move do. */
  function relabel(): void {
    guide.set(guideRows(voice(), shift), guidePath(voice(), shift))
    const line = readoutAt(voice(), shift).html
    if (line !== doLine) {
      readout.innerHTML = line
      doLine = line
    }
    q('.ring-note', ringEl).innerHTML = ringLabel(doMidi())
    setMoveEnds(moves, shift, REACH)
  }

  async function playMerc(): Promise<void> {
    // the voice picks the Merc who sings: nothing plays before it is chosen
    if (state.voice === null) return
    stopRun()
    NowPlaying.claim(stopRun)
    const mine = stops
    const which = mercOf(voice())
    const audible = Sound.canPlay()
    // the chords' soft voices and Merc's "ooh" in one run, each note its own tone
    const run = playNotes(singAlongAt(voice(), shift), {
      audible,
      kind: 'soft',
    })
    playing = run
    notesBtn.classList.add('is-on')
    void guide.model()
    void ring.run({
      which,
      label: ringLabel(doMidi()),
      listen: SING_SEC,
      turn: 0,
    })
    const ended = await run.done
    if (mine !== stops) return
    // every sound stopped under it (the Sound switch, a hidden page): not heard
    if (!ended) {
      stopRun()
      return
    }
    playing = null
    notesBtn.classList.remove('is-on')
    NowPlaying.release(stopRun)
    heardMerc = which
    dispatch({ type: 'played', heard: audible })
  }

  /** The viewer's turn: the count-in on do, then the sweep over the chords; "How did that feel?" once it ends. */
  async function startGuide(): Promise<void> {
    const v = singView(state)
    if (!v.singParts || !v.startEnabled) return
    stopRun()
    NowPlaying.claim(stopRun)
    const mine = stops
    const audible = Sound.canPlay()
    dispatch({ type: 'sweepStart' })
    startBtn.classList.add('is-on')
    counting = countIn(doMidi(), audible)
    // the chords start with the sweep, once the count-in is over
    playing = playNotes(
      guideChordsAt(shift).map((n) => ({ ...n, t: n.t + COUNT_IN_SEC })),
      { audible, kind: 'soft' },
    )
    // ready through the count-in, then breathing through the sweep
    void ring.run({
      which: heardMerc,
      label: ringLabel(doMidi()),
      listen: COUNT_IN_SEC,
      turn: SING_SEC,
      ripples: false,
      words: { listen: COUNT_IN_WORD },
    })
    await guide.sweep(COUNT_IN_SEC)
    if (mine !== stops) return
    playing = null
    counting = null
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
  for (const b of moves)
    b.addEventListener('click', () => {
      // at its end the button is aria-disabled, so it keeps the keyboard's
      // place; a press there neither moves do nor stops what plays
      if (b.getAttribute('aria-disabled') === 'true') return
      if (!singView(state).singParts) return
      stopRun()
      shift = nextShift(shift, b, REACH)
      relabel()
    })

  onLeave(q('#sing'), stopRun)
  // the Wrap's card, in the version the visit's ending picks
  mountPractiseCard(q('#practiseCard'))

  relabel()
  render()
}
