// ============================================================
// Lesson 8 Sing it — tap the backbeat, then a line on the beat
// ============================================================
//
// One card in two parts (WEB-SPEC, Toys 6): the tap take (take.ts), with
// no voice, then the sung line, nothing listening. The second part's
// comfort check, voice choice, Merc's line, the guide, Move do and "How
// did that feel?" follow the pure flow (sing-flow.ts); this plays and
// draws it. Play Merc's line counts a bar in on the click, do softly on
// its first beat, then Merc's "ooh" sings the first line over the groove
// at half its level, the guide's cells lighting in the singing Merc's
// colour. Start the guide, once Merc's line has been heard, is the
// viewer's turn: the same count-in and groove, the cells lighting in ink
// as each beat goes by, and nothing sung. Every run is on the beat clock
// and is the page's one sound (kit/now-playing.ts): a press of any of the
// card's controls while one runs stops it and then acts, and a sound
// anywhere else on the page stops it too. A line cut short has not been
// heard, and a guide cut short asks nothing: what it hid comes back, Again
// included. Again hides with the question while its guide runs, so the
// keyboard's place moves to the status line, never lost. The status line
// and the do line under Move do are live regions, so each is written only
// when its words change. Lesson 3's rule for leaving holds for both parts:
// off screen for 600 ms, or the page hidden, and whatever plays stops. The
// page has no microphone and scores nothing; only the voice is stored.

import type { Run, Spot } from '@/features/lessons/kit/beat-clock'
import { bars, BeatClock } from '@/features/lessons/kit/beat-clock'
import { bookHit } from '@/features/lessons/kit/beat-machine'
import type { BeatStrip } from '@/features/lessons/kit/beat-strip'
import { mountBeatStrip } from '@/features/lessons/kit/beat-strip'
import type { Feeling } from '@/features/lessons/kit/comfort'
import { mountComfort, mountFeelings, VisitEnding, } from '@/features/lessons/kit/comfort'
import { q, qa } from '@/features/lessons/kit/dom'
import { COLOR, hz } from '@/features/lessons/kit/notes'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import type { RingStills } from '@/features/lessons/kit/sing'
import { Sound } from '@/features/lessons/kit/sound'
import type { Bus } from '@/features/lessons/kit/sound-ahead'
import { bookNote } from '@/features/lessons/kit/sound-ahead'
import type { Voice } from '@/features/lessons/kit/voice-choice'
import { bindVoiceButtons, VoiceChoice, } from '@/features/lessons/kit/voice-choice'
import type { LineHit } from './patterns'
import { BEAT_SEC, BPM, COUNT_IN_DO_GAIN, lineBars, stripRow } from './patterns'
import type { Panel, SingEvent } from './sing-flow'
import { HINT, nextState, openState, singView } from './sing-flow'
import { clampMove, doReadout, lineDo, lineFrom, MOVE_MAX } from './sing-line'
import { initTake } from './take'

/** The status line while Merc sings; the guide's is the flow's (`STATUS.guiding`). */
export const RUNNING = {
  model: 'Merc sings the line.',
} as const

/** A sung syllable's length against its beats: room for a repeated note to be heard as two. */
const HELD = 0.85
/** How long a beat's lamp stays lit, seconds. */
const LAMP_SEC = 0.12

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
 * The shown panel's first line on show. The voice panel opens on a line a
 * first visit never sees ("Keep the voice you chose before"), hidden, and
 * focus sent there fell to the page (L8-04).
 */
function shownLine(card: HTMLElement): HTMLElement | null {
  const lines = card.querySelectorAll<HTMLElement>(
    '[data-panel]:not([hidden]) p',
  )
  return Array.from(lines).find((p) => p.closest('[hidden]') === null) ?? null
}

/** Books a hit of the sung line's runs: the click and the drums, do, or Merc's syllable. */
function bookLine(hit: LineHit, when: number, bus: Bus): void {
  if (hit.kind === 'do')
    bookNote(hz(hit.midi), {
      when,
      dur: BEAT_SEC,
      gain: COUNT_IN_DO_GAIN,
      to: bus.node,
    })
  else if (hit.kind === 'sing')
    bookNote(hz(hit.syllable.midi), {
      when,
      dur: hit.syllable.beats * BEAT_SEC * HELD,
      kind: 'merc',
      to: bus.node,
    })
  else bookHit(hit, when, bus)
}

interface Guide {
  readonly strip: BeatStrip
  readonly still: HTMLImageElement
}

/** The guide: the first line in one row of two bars, the claps on 2 and 4 in gold, the small metronome beside it. */
function mountLineGuide(card: HTMLElement): Guide {
  const strip = mountBeatStrip(q('#lineGuide', card), {
    rows: [stripRow(lineFrom(50))],
    beatsPerBar: 4,
    metronome: 'mt-guide',
  })
  strip.claps([1, 3])
  strip.marks({ accent: true, backbeat: true })
  return { strip, still: q<HTMLImageElement>('[data-guide-merc]', card) }
}

export function initSing(stills: RingStills): void {
  const card = q('#singCard')
  const statusEl = q('#singStatus')
  const panels = qa('[data-panel]', card)
  const linePlay = q<HTMLButtonElement>('[data-line-play]', card)
  const startBtn = q<HTMLButtonElement>('[data-guide-start]', card)
  const againBtn = q<HTMLButtonElement>('[data-guide-again]', card)
  const hint = q('[data-guide-hint]', card)
  const movePart = q('[data-move-part]', card)
  const moves = qa<HTMLButtonElement>('[data-move-do]', card)
  const readout = q('[data-do-readout]', card)
  const feelPanel = q('[data-panel="feel"]', card)
  const guide = mountLineGuide(card)
  const take = initTake(card)

  let state = openState(VoiceChoice.voice)
  let shift = 0
  // the stops so far: a run that finds them changed was cut short
  let stops = 0
  let run: Run | null = null

  const voice = (): Voice => state.voice ?? 'lower'

  function render(): void {
    const v = singView(state)
    for (const p of panels)
      p.hidden = !v.panels.includes(p.dataset.panel as Panel)
    for (const el of qa('[data-voice-line]', card))
      el.hidden = el.dataset.voiceLine !== v.voiceLine
    for (const el of qa('[data-sing-part]', card)) el.hidden = !v.singParts
    startBtn.hidden = !v.startShown
    startBtn.setAttribute('aria-disabled', String(!v.startEnabled))
    againBtn.hidden = !v.againShown
    movePart.hidden = !v.moveShown
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

  /** Stops Merc's line or the guide where it stands; the status goes back to the flow's. */
  function stopRun(): void {
    if (run === null) return
    stops += 1
    const r = run
    run = null
    r.stop()
    guide.strip.light(null)
    guide.strip.swing(null, false)
    for (const b of [linePlay, startBtn, againBtn]) b.classList.remove('is-on')
    NowPlaying.release(stopRun)
    // a guide cut short asks nothing, before whatever stopped it acts
    if (state.guiding) state = nextState(state, { type: 'guideCut' })
    render()
  }

  /** The do line and Move do's ends follow Move do; the guide's still follows the voice. */
  function relabel(): void {
    say(readout, doReadout(shift))
    for (const b of moves) {
      const d = Number(b.dataset.moveDo)
      b.disabled = (d < 0 && shift <= -MOVE_MAX) || (d > 0 && shift >= MOVE_MAX)
    }
    const src = voice() === 'lower' ? stills.blue : stills.orange
    if (guide.still.getAttribute('src') !== src) guide.still.src = src
  }

  /** A run of the line's bars, the cells lighting in `color` as each beat goes by. */
  function startRun(merc: boolean, color: string): Run {
    stopRun()
    NowPlaying.claim(stopRun)
    const audible = Sound.canPlay()
    const r = BeatClock.start<LineHit>({
      bar: bars(lineBars(lineDo(voice(), shift), merc)),
      bpm: () => BPM,
      audible,
      book: bookLine,
      onFrame: (spot: Spot) => {
        const lineBeat = spot.beats - 4
        guide.strip.light(lineBeat >= 0 ? Math.floor(lineBeat) : null, color)
        guide.strip.swing(spot.beats, (spot.beats % 1) * BEAT_SEC < LAMP_SEC)
      },
    })
    run = r
    return r
  }

  async function playLine(): Promise<void> {
    if (state.voice === null) return
    const merc = voice() === 'lower' ? COLOR.blue : COLOR.orange
    const r = startRun(true, merc)
    const mine = stops
    const audible = Sound.state === 'on' && !Sound.hushed
    linePlay.classList.add('is-on')
    say(statusEl, RUNNING.model)
    const finished = await r.done
    if (mine !== stops) return
    run = null
    linePlay.classList.remove('is-on')
    guide.strip.light(null)
    guide.strip.swing(null, false)
    NowPlaying.release(stopRun)
    if (finished) dispatch({ type: 'played', heard: audible })
    else render()
  }

  async function runGuide(btn: HTMLButtonElement): Promise<void> {
    const v = singView(state)
    const allowed =
      btn === startBtn ? v.startShown && v.startEnabled : v.againShown
    if (!allowed) return
    const r = startRun(false, COLOR.ink)
    const mine = stops
    dispatch({ type: 'guideStart' })
    btn.classList.add('is-on')
    // Again hides with the question it sits under: keep the keyboard's place
    if (btn.hidden) focusText(statusEl)
    const finished = await r.done
    if (mine !== stops) return
    run = null
    btn.classList.remove('is-on')
    guide.strip.light(null)
    guide.strip.swing(null, false)
    NowPlaying.release(stopRun)
    if (!finished) {
      dispatch({ type: 'guideCut' })
      return
    }
    // asked afresh, with no answer pressed
    feelings.reset()
    dispatch({ type: 'guideEnd' })
    focusText(q<HTMLElement>('.feel-q', feelPanel))
  }

  mountComfort(card, {
    onSing: () => {
      dispatch({ type: 'comfort', comfort: 'sing' })
      focusText(shownLine(card))
    },
    onListen: () => {
      dispatch({ type: 'comfort', comfort: 'listen' })
      focusText(shownLine(card))
    },
  })
  bindVoiceButtons(card, (v) => {
    stopRun()
    dispatch({ type: 'voice', voice: v })
    relabel()
  })
  const feelings = mountFeelings(
    feelPanel,
    (f: Feeling) => dispatch({ type: 'feel', feeling: f }),
    { changeable: true },
  )
  linePlay.addEventListener('click', () => void playLine())
  startBtn.addEventListener('click', () => void runGuide(startBtn))
  againBtn.addEventListener('click', () => void runGuide(againBtn))
  for (const b of moves)
    b.addEventListener('click', () => {
      stopRun()
      shift = clampMove(shift + Number(b.dataset.moveDo))
      relabel()
    })

  // leaving is staying away: a panel that grows or shrinks can take the
  // card off screen for a moment, and that must not stop a run
  const leave = (): void => {
    take.stop()
    stopRun()
  }
  let away = 0
  new IntersectionObserver((entries) => {
    window.clearTimeout(away)
    if (entries.some((e) => !e.isIntersecting))
      away = window.setTimeout(leave, 600)
  }).observe(card)
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) leave()
  })
  window.addEventListener('pagehide', leave)

  relabel()
  render()
}
