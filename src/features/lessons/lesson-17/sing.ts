// ============================================================
// Lesson 17 sung bars — the same two bars on one note, with nothing listening
// ============================================================
//
// The checkpoint's second part (WEB-SPEC, Toys 7, part 2; FACTS 50 to 63),
// on the kit's flow (kit/sing-flow.ts) in this page's words, with Lesson
// 8's cap of two guides a visit: the comfort check, every visit and never
// stored; the voice choice, which picks the Merc who sings; Your turn, with
// Play Merc's bars, Start the guide and Move the note; and "How did that
// feel?" after every guide run to its end, with Again once after Easy or
// Workable.
//
// The guide is the two written bars on one line (rhythm-views.ts
// TAKE_BARS), drawn from the start beside the still of the Merc who sings,
// Merc for the lower voice and Tavi for the higher. Play Merc's bars plays
// them on the rhythm bar after a bar counted in on the click: the nine
// notes on A3, or A4 for the higher voice, in Merc's "ooh" over the click,
// 12 s, each note lit in the singer's colour as it sounds and its cell read
// as it ends (FACTS 58, 63). Start the guide, once Merc's bars have been
// heard with sound on, counts the bar in on the click with the note once
// and softly on beat 1, then lights each beat's pad and, in ink, each note
// as its start passes, for 8 s, the click under it; Merc does not sing.
// Move the note moves both a semitone a press, up to four either way
// (kit/move-do.ts), and its readout names semitones, never letters (FACTS
// 57).
//
// Merc's bars and the guide are the page's one sound (kit/now-playing.ts),
// as the take is: a press of any of the part's controls while one runs
// stops it and then acts, and a sound anywhere else stops it too. Bars cut
// short have not been heard, and a guide cut short asks nothing. With sound
// off Merc's bars light in silence and say so, and the guide does not
// start: the kit's toast says why. Lesson 3's rule for leaving holds
// (kit/leave.ts). Focus moves only to text, never to a button, so Space
// never starts the guide (REQ-GVC-080). Nothing listens or scores; only the
// voice is stored, by the kit's voice choice, and the visit's ending picks
// the Wrap's card (kit/comfort.ts `VisitEnding`).

import type { Bar, Run, Spot } from '@/features/lessons/kit/beat-clock'
import { bars, BeatClock } from '@/features/lessons/kit/beat-clock'
import type { Feeling } from '@/features/lessons/kit/comfort'
import { mountComfort, mountFeelings, VisitEnding, } from '@/features/lessons/kit/comfort'
import { q, qa } from '@/features/lessons/kit/dom'
import { onLeave } from '@/features/lessons/kit/leave'
import { COUNT_IN, MOVE_MAX, nextShift, setMoveEnds, } from '@/features/lessons/kit/move-do'
import { hz } from '@/features/lessons/kit/notes'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import type { RhythmBar } from '@/features/lessons/kit/rhythm-bar'
import { mountRhythmBar, WOOD_LEVEL } from '@/features/lessons/kit/rhythm-bar'
import type { Comfort, Panel, SingEvent, } from '@/features/lessons/kit/sing-flow'
import { openState, singFlow } from '@/features/lessons/kit/sing-flow'
import { Sound } from '@/features/lessons/kit/sound'
import { bookNote } from '@/features/lessons/kit/sound-ahead'
import { bindVoiceButtons, homeOf, VoiceChoice, } from '@/features/lessons/kit/voice-choice'
import { bookWood } from '@/features/lessons/kit/woodblock'
import mercBlue from '@/features/lessons/lesson-01/assets/merc-blue.png'
import mercOrange from '@/features/lessons/lesson-01/assets/merc-orange.png'
import type { TakeHit } from './take'
import { clickBars, takeView } from './take'
import { TAKE_BPM } from './take-judge'

/** The kit's flow in this page's words, with Lesson 8's cap of two guides a visit (FACTS 56, 58). */
export const FLOW = singFlow({
  sung: 'done',
  line: "That's it: two bars on one note, done.",
  notes: "Merc's bars",
  guides: 2,
})

/** The status line while Merc sings; every other is the flow's. */
export const MERC_SINGS = 'Merc sings the bars.'

/** Move the note's readout: semitones from the written note, never a letter (FACTS 57). */
export function noteReadout(shift: number): string {
  if (shift === 0) return 'note: as written'
  const n = Math.abs(shift)
  const way = shift < 0 ? 'lower' : 'higher'
  const end = n >= MOVE_MAX ? `, the ${shift < 0 ? 'lowest' : 'highest'}` : ''
  return `note: ${n} semitone${n === 1 ? '' : 's'} ${way}${end}`
}

/** The guide's hit: the take's, or the note once and softly on the bar counted in's beat 1. */
export type GuideHit = TakeHit | { readonly k: 'tone' }

/** The guide's three bars: one counted in, the note on its beat 1, then the two written bars, each note lighting as its start passes (FACTS 58). */
export function guideBars(): Bar<GuideHit>[] {
  const [countIn, ...written]: Bar<GuideHit>[] = clickBars(3, 4)
  return [
    { ...countIn, hits: [...countIn.hits, { beat: 0, data: { k: 'tone' } }] },
    ...written,
  ]
}

/** The pad a guide's beat lights: none in the bar counted in. */
export const guidePad = (spot: Spot): number | null =>
  spot.bar === 0 ? null : (spot.bar - 1) * 4 + spot.beat

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
function shownLine(part: HTMLElement): HTMLElement | null {
  const lines = part.querySelectorAll<HTMLElement>(
    '[data-panel]:not([hidden]) p',
  )
  return Array.from(lines).find((p) => p.closest('[hidden]') === null) ?? null
}

export interface Sing {
  readonly bar: RhythmBar
  /** Ends Merc's bars or the guide where they stand. */
  stop(): void
}

export function initSing(card: HTMLElement): Sing {
  const part = q('#linePart', card)
  const statusEl = q('#singStatus', part)
  const panels = qa('[data-panel]', part)
  const playBtn = q<HTMLButtonElement>('[data-line-play]', part)
  const startBtn = q<HTMLButtonElement>('[data-guide-start]', part)
  const againBtn = q<HTMLButtonElement>('[data-guide-again]', part)
  const hint = q('[data-guide-hint]', part)
  const readout = q('[data-do-readout]', part)
  const movePart = q('[data-move-part]', part)
  const moveBtns = qa<HTMLButtonElement>('[data-move-do]', part)
  const feelPanel = q('[data-panel="feel"]', part)
  const figure = q('#lineGuide', part)
  const still = q<HTMLImageElement>('[data-guide-merc]', part)

  let state = openState(VoiceChoice.voice)
  let shift = 0
  // the guide's run, and Merc's bars while they play
  let run: Run | null = null
  let merc: Promise<boolean> | null = null

  // the chosen voice's A, moved by Move the note
  const midi = (): number => homeOf(state.voice ?? 'lower') + shift
  const bar = mountRhythmBar({
    figure,
    pads: null,
    said: statusEl,
    freq: () => hz(midi()),
    voice: () => (state.voice === 'higher' ? 'tavi' : 'merc'),
    owner: NowPlaying,
  })
  const view = takeView()
  bar.show(view, () => true, { readings: false })

  function render(): void {
    const v = FLOW.singView(state)
    for (const p of panels)
      p.hidden = !v.panels.includes(p.dataset.panel as Panel)
    for (const el of qa('[data-voice-line]', part))
      el.hidden = el.dataset.voiceLine !== v.voiceLine
    for (const el of qa('[data-sing-part]', part)) el.hidden = !v.singParts
    movePart.hidden = !v.singParts
    readout.hidden = !v.singParts
    startBtn.hidden = !v.startShown
    startBtn.setAttribute('aria-disabled', String(!v.startEnabled))
    againBtn.hidden = !v.againShown
    hint.hidden = v.hint === null
    if (v.hint !== null) say(hint, FLOW.HINT[v.hint])
    for (const el of qa('[data-after]', feelPanel))
      el.hidden = el.dataset.after !== v.after
    q('[data-after-doctor]', feelPanel).hidden = !v.doctor
    say(statusEl, merc !== null ? MERC_SINGS : v.status)
    if (VisitEnding.ending !== v.card) VisitEnding.set(v.card)
  }

  function dispatch(e: SingEvent): void {
    state = FLOW.nextState(state, e)
    render()
  }

  /** The still and the guide's colour follow the voice. */
  function relabel(): void {
    still.src = state.voice === 'higher' ? mercOrange : mercBlue
    bar.see({})
  }

  /**
   * Stops Merc's bars or the guide where they stand: the lights go out, a
   * guide cut short asks nothing, and the card goes back to what the flow
   * showed before.
   */
  function stopRun(): void {
    const r = run
    run = null
    const p = merc
    merc = null
    r?.stop()
    if (p !== null) bar.stop()
    bar.light({ pad: null, sounding: null })
    figure.classList.remove('is-guide')
    for (const b of [playBtn, startBtn, againBtn]) b.classList.remove('is-on')
    NowPlaying.release(stopRun)
    if (state.sweeping) state = FLOW.nextState(state, { type: 'sweepCut' })
    render()
  }

  /** Merc's bars: a bar counted in, then the nine notes over the click, each lit as it sounds. */
  function playMerc(): void {
    // the voice picks the Merc who sings: nothing plays before it is chosen
    if (state.voice === null) return
    stopRun()
    const audible = Sound.canPlay()
    playBtn.classList.add('is-on')
    // the bar claims the page's owner, so a take running stops
    const p = bar.play(
      [{ view: bar.view ?? view, bpm: () => TAKE_BPM, countIn: 4 }],
      { kind: 'merc', audible },
    )
    merc = p
    render()
    void p.then((heard) => {
      if (merc !== p) return
      merc = null
      playBtn.classList.remove('is-on')
      // bars cut short by another sound have not been heard
      if (heard) dispatch({ type: 'played', heard: audible })
      else render()
    })
  }

  /** The learner's turn: a bar counted in with the note on beat 1, then each note lit over the click; "How did that feel?" once it ends. */
  function startGuide(from: HTMLButtonElement): void {
    const v = FLOW.singView(state)
    if (!(v.startShown || v.againShown) || !v.startEnabled) return
    if (!Sound.canPlay({ needsSound: true })) return
    stopRun()
    NowPlaying.claim(stopRun)
    state = FLOW.nextState(state, { type: 'sweepStart' })
    render()
    // Again hides with the question, so the keyboard's place moves to the status line
    if (from === againBtn) focusText(statusEl)
    from.classList.add('is-on')
    figure.classList.add('is-guide')
    const freq = hz(midi())
    let sounding: number | null = null
    const r = BeatClock.start<GuideHit>({
      bar: bars(guideBars()),
      bpm: () => TAKE_BPM,
      audible: true,
      book: (h, when, bus) => {
        if (h.k === 'click') bookWood(bus, when, h.high, WOOD_LEVEL)
        else if (h.k === 'tone')
          bookNote(freq, {
            when,
            dur: 60 / TAKE_BPM,
            gain: COUNT_IN.gain,
            to: bus.node,
          })
      },
      onBeat: (spot: Spot) => bar.light({ pad: guidePad(spot), sounding }),
      // each written note lights as its start passes, until the next
      onHit: (h, spot) => {
        if (h.k !== 'note') return
        sounding = h.i
        bar.light({ pad: guidePad(spot), sounding })
      },
    })
    run = r
    void r.done.then((finished) => {
      if (run !== r) return
      if (!finished) {
        stopRun()
        return
      }
      run = null
      bar.light({ pad: null, sounding: null })
      figure.classList.remove('is-guide')
      from.classList.remove('is-on')
      NowPlaying.release(stopRun)
      // asked afresh, with no answer pressed
      feelings.reset()
      dispatch({ type: 'sweepEnd' })
      focusText(q<HTMLElement>('.feel-q', feelPanel))
    })
  }

  function answer(comfort: Comfort): void {
    dispatch({ type: 'comfort', comfort })
    focusText(shownLine(part))
  }

  mountComfort(part, {
    onSing: () => answer('sing'),
    onListen: () => answer('listen'),
  })
  bindVoiceButtons(part, (v) => {
    stopRun()
    dispatch({ type: 'voice', voice: v })
    relabel()
  })
  // the kit's lock: an answer stands until the next guide asks afresh
  const feelings = mountFeelings(feelPanel, (f: Feeling) => {
    dispatch({ type: 'feel', feeling: f })
    focusText(
      feelPanel.querySelector<HTMLElement>('[data-after]:not([hidden])'),
    )
  })
  for (const b of moveBtns)
    b.addEventListener('click', () => {
      if (b.getAttribute('aria-disabled') === 'true') return
      stopRun()
      shift = nextShift(shift, b)
      setMoveEnds(moveBtns, shift)
      say(readout, noteReadout(shift))
    })
  playBtn.addEventListener('click', playMerc)
  startBtn.addEventListener('click', () => startGuide(startBtn))
  againBtn.addEventListener('click', () => startGuide(againBtn))
  onLeave(card, stopRun)

  setMoveEnds(moveBtns, shift)
  relabel()
  render()
  return { bar, stop: stopRun }
}
