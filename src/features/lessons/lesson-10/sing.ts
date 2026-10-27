// ============================================================
// Lesson 10 Sing it — do-mi-so, then do-me-so, with nothing listening
// ============================================================
//
// The comfort check, the voice choice, Merc's notes and Move do (WEB-SPEC,
// Toys 6). What shows when is the pure flow's (sing-flow.ts): this plays
// and draws it, every control shown exactly when the flow offers it, and
// its status line, a polite live region, written only when its words
// change, so a screen reader hears each once. The comfort check comes
// first on every visit and is never stored (REQ-GVC-020, 021); with no
// voice stored the voice choice comes before either path and nothing plays
// until one is chosen, since the voice picks the Merc who sings. "Just
// listen today" shows its line and the doctor lines, and Play Merc's notes
// alone: nothing asks the viewer to sing, and the Wrap rests.
//
// Play Merc's notes sings do-mi-so, then do-me-so, from do = E3, or E4 for
// the higher voice, in Merc's "ooh", the kit run's default: 10.0 s, the
// guide's path lighting in the app's target amber in step while the ring
// shows the still of the Merc singing (FACTS 63, 65, 80; sing-guide.ts).
// Move do moves do a semitone each way, up to four, and Merc's notes, the
// guide, the readout and the ring's do move with it; at either end its
// button is aria-disabled, and a press there does nothing. Start the guide
// waits, aria-disabled under its hint, until Merc's notes have been heard
// to their end with sound on (hear it first: playbook rule 16).
//
// Merc's notes are the page's one sound (kit/now-playing.ts): a press of
// any of Sing it's controls while they play stops them and then acts, and a
// sound anywhere else on the page stops them too. Notes cut short, by a
// press, another sound, or every sound stopping (the Sound switch, a hidden
// page), have not been heard, and the guide and the ring rest with them.
// Focus moves only to text, never to a button (REQ-GVC-080). The page has
// no microphone and scores nothing; only the voice is stored, by the kit's
// voice choice.

import { mountComfort, VisitEnding } from '@/features/lessons/kit/comfort'
import { q, qa } from '@/features/lessons/kit/dom'
import { majorScale } from '@/features/lessons/kit/major-scale'
import { nextShift, setMoveEnds } from '@/features/lessons/kit/move-do'
import { hz, nameHtml } from '@/features/lessons/kit/notes'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import type { Run } from '@/features/lessons/kit/run'
import { playNotes } from '@/features/lessons/kit/run'
import type { RingStills } from '@/features/lessons/kit/sing'
import { mountRing } from '@/features/lessons/kit/sing'
import { mountGuide } from '@/features/lessons/kit/slide-guide'
import { Sound } from '@/features/lessons/kit/sound'
import type { Voice } from '@/features/lessons/kit/voice-choice'
import { bindVoiceButtons, mercOf, VoiceChoice, } from '@/features/lessons/kit/voice-choice'
import type { Comfort, Panel, SingEvent } from './sing-flow'
import { HINT, nextState, openState, singView } from './sing-flow'
import { guidePath, guideRows, readoutHtml, SING_SEC, singDo, singNotes, } from './sing-guide'

/** The ring's label, in the markup's form: do's name, as the readout names it, and its frequency, "Do: E3 · 165 Hz". */
export const ringLabel = (doMidi: number): string =>
  `Do: ${nameHtml(majorScale(doMidi)[0])} · ${Math.round(hz(doMidi))} Hz`

/**
 * The ring's state lines, Lesson 6's for the same guide: "Listen" while
 * Merc sings, "Rest" after, never "Again whenever you like", which after
 * "Effortful" would ask for a repeat (REQ-GVC-021).
 */
const RING_WORDS = {
  listen: 'Listen',
  turn: (n: number) => `Sing with the line · ${n}`,
  done: 'Rest',
} as const

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
  const ringEl = q('.ring', card)
  // under reduced motion the ring holds its breathing circle still, and
  // has no ripples; its words are Lesson 6's, whose guide this is
  const ring = mountRing(ringEl, { stills, calm: true, words: RING_WORDS })

  let state = openState(VoiceChoice.voice)
  let shift = 0
  // the stops so far: a play that finds them changed was cut short
  let stops = 0
  let playing: Run | null = null
  // the do line's markup as last written, so a press that changes nothing writes nothing
  let doLine = readout.innerHTML.trim()

  const voice = (): Voice => state.voice ?? 'lower'
  const doMidi = (): number => singDo(voice(), shift)
  const guide = mountGuide(q('#chordGuide', card), {
    rows: guideRows(doMidi()),
    path: guidePath(doMidi()),
    rest: 'amber',
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
    say(statusEl, v.status)
    if (VisitEnding.ending !== v.card) VisitEnding.set(v.card)
  }

  function dispatch(e: SingEvent): void {
    state = nextState(state, e)
    render()
  }

  /** Stops Merc's notes where they stand: the guide and the ring rest, and the card goes back to the flow's. */
  function stopRun(): void {
    if (playing === null) return
    stops += 1
    const r = playing
    playing = null
    r.stop()
    guide.stop()
    ring.stop()
    notesBtn.classList.remove('is-on')
    NowPlaying.release(stopRun)
    render()
  }

  /** The guide, the readout, the ring's do and Move do's ends follow the voice and Move do. */
  function relabel(): void {
    guide.set(guideRows(doMidi()), guidePath(doMidi()))
    const line = readoutHtml(voice(), shift)
    if (line !== doLine) {
      readout.innerHTML = line
      doLine = line
    }
    q('.ring-note', ringEl).innerHTML = ringLabel(doMidi())
    setMoveEnds(moves, shift)
  }

  async function playMerc(): Promise<void> {
    // the voice picks the Merc who sings: nothing plays before it is chosen
    if (state.voice === null) return
    stopRun()
    NowPlaying.claim(stopRun)
    const mine = stops
    const d = doMidi()
    const which = mercOf(voice())
    const audible = Sound.canPlay()
    const run = playNotes(singNotes(d), { audible })
    playing = run
    notesBtn.classList.add('is-on')
    void guide.model()
    void ring.run({ which, label: ringLabel(d), listen: SING_SEC, turn: 0 })
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
    dispatch({ type: 'played', heard: audible })
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
  notesBtn.addEventListener('click', () => void playMerc())
  for (const b of moves)
    b.addEventListener('click', () => {
      // at its end the button is aria-disabled, so it keeps the keyboard's
      // place; a press there neither moves do nor stops what plays
      if (b.getAttribute('aria-disabled') === 'true') return
      if (!singView(state).singParts) return
      stopRun()
      shift = nextShift(shift, b)
      relabel()
    })

  relabel()
  render()
}
