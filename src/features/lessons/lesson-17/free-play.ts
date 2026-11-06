// ============================================================
// Lesson 17 free play — every control of the rhythm bar in one place
// ============================================================
//
// The rhythm bar again, on a card of its own after the next-lesson card
// (WEB-SPEC, Toys 8), as two figures, with nothing locked, since the guided
// steps come first (playbook rule 17). The first is one bar of four pads
// on one line, so every pad keeps 44 px on a phone (FACTS 70): a pad
// chooses a beat, as in Step 1, and Halve, Join and Note · Rest act on it,
// Halve and Join each left `aria-disabled` with its hint where it cannot
// go; Count writes each note's count under it; Tempo sets the next play's,
// from the next beat while one plays; the pitch-line switch redraws it; and
// Reset puts back four quarters. Each change plays the bar at once,
// written as it sounds, and keeps what it leaves as heard (steps.ts
// `keptWritten`). Under it are Step 5's two bars on the staff, with Dot,
// Tie and Clef, each press playing them; the clef follows the voice, Bass
// when none is chosen, as every toy on the page does.
//
// Both figures are the page's one sound, and the card off screen for
// 600 ms, or the page hidden, stops them (kit/leave.ts). Each says what a
// press changed in its polite region, in Step 1's, Step 4's and Step 5's
// words.

import { q, qa } from '@/features/lessons/kit/dom'
import { onLeave } from '@/features/lessons/kit/leave'
import { A3, A4, hz } from '@/features/lessons/kit/notes'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import { playLights } from '@/features/lessons/kit/play-lights'
import type { RhythmBar } from '@/features/lessons/kit/rhythm-bar'
import { mountRhythmBar } from '@/features/lessons/kit/rhythm-bar'
import type { Bar, GridBar } from '@/features/lessons/kit/rhythm-model'
import { FOUR_QUARTERS, halve, join, toggleRest, writeGrid, } from '@/features/lessons/kit/rhythm-model'
import { lengthsWords } from '@/features/lessons/kit/rhythm-words'
import type { Clef } from '@/features/lessons/kit/staff-places'
import { VoiceChoice } from '@/features/lessons/kit/voice-choice'
import { rowView, staffBars, STEP_BPM } from './rhythm-views'
import { halvedLine, joinedLine, keptWritten, REFUSAL_HINT, restLine, showTempo, STAFF_SAID, } from './steps'

export interface FreePlay {
  readonly line: RhythmBar
  readonly staff: RhythmBar
}

/** The clef a voice sets: the treble for the higher, the bass otherwise. */
const clefOf = (): Clef => (VoiceChoice.voice === 'higher' ? 'treble' : 'bass')

export function initFreePlay(): FreePlay {
  const root = q('#freePlay')
  const [lineRow, staffRow] = qa('.controls.rb-row', root)
  const lineFig = q('[data-free-bar]', root)
  const staffFig = q('[data-free-staff]', root)
  const hint = q('[data-rb-hint]', root)
  const light = playLights()

  // ---------------------------------------------------------------- the bar on one line
  let grid: GridBar = FOUR_QUARTERS
  let chosen = 0
  let tempo = STEP_BPM

  const voiceA = (): number => (VoiceChoice.voice === 'higher' ? A4 : A3)
  const line = mountRhythmBar({
    figure: lineFig,
    pads: q<HTMLElement>('[data-rb-pads]', root),
    said: q<HTMLElement>('[data-rb-said]', lineFig),
    freq: () => hz(voiceA()),
    voice: () => (voiceA() === A4 ? 'tavi' : 'merc'),
    owner: NowPlaying,
    onPad,
  })
  const lineBars = (): readonly Bar[] => [writeGrid(grid)]
  const halveBtn = q<HTMLButtonElement>('[data-rb-halve]', lineRow)
  const joinBtn = q<HTMLButtonElement>('[data-rb-join]', lineRow)

  /** Halve's and Join's state for the chosen beat, with the hint for one that cannot go. */
  function gridButtons(): void {
    const h = halve(grid, chosen)
    const j = join(grid, chosen)
    halveBtn.setAttribute('aria-disabled', String('refused' in h))
    joinBtn.setAttribute('aria-disabled', String('refused' in j))
    const why = 'refused' in h ? h.refused : 'refused' in j ? j.refused : null
    hint.textContent = why === null ? '' : REFUSAL_HINT[why]
    hint.hidden = why === null
  }

  function onPad(b: number): void {
    chosen = b
    line.choose(b)
    gridButtons()
  }

  function playLine(btn: HTMLButtonElement | null): void {
    const view = line.view
    if (view === null) return
    const done = line.play([{ view, bpm: () => tempo }], {
      line: lengthsWords(lineBars(), tempo),
    })
    if (btn !== null) light(btn, done)
  }

  /** A change to the bar: drawn keeping what it leaves as heard, said, and played unless `play` is false. */
  function changeLine(next: GridBar, said: string, play = true): void {
    line.stop()
    const before = lineBars()
    const was = line.written(0)
    grid = next
    const kept = keptWritten(before, was, lineBars())
    line.show(rowView(lineBars(), tempo, 'line', 'choose'), (_r, i) => kept[i])
    gridButtons()
    line.say(said)
    if (play) playLine(null)
  }

  halveBtn.addEventListener('click', () => {
    const h = halve(grid, chosen)
    if ('refused' in h) return line.say(REFUSAL_HINT[h.refused])
    changeLine(h.bar, halvedLine(grid, h.bar, chosen))
  })
  joinBtn.addEventListener('click', () => {
    const j = join(grid, chosen)
    if ('refused' in j) return line.say(REFUSAL_HINT[j.refused])
    changeLine(j.bar, joinedLine(grid, j.bar, chosen))
  })
  q('[data-rb-rest-toggle]', lineRow).addEventListener('click', () => {
    const next = toggleRest(grid, chosen)
    changeLine(next, restLine(next, chosen))
  })
  const countBtn = q<HTMLButtonElement>('[data-rb-count]', lineRow)
  countBtn.addEventListener('click', () => {
    const on = !line.seen.counts
    countBtn.setAttribute('aria-pressed', String(on))
    line.see({ counts: on })
  })
  const lanesBtn = q<HTMLButtonElement>('[data-rb-lanes]', lineRow)
  lanesBtn.addEventListener('click', () => {
    const on = !line.seen.lanes
    lanesBtn.setAttribute('aria-pressed', String(on))
    line.see({ lanes: on })
  })
  const tempoIn = q<HTMLInputElement>('[data-rb-tempo]', root)
  showTempo(tempoIn, tempo)
  tempoIn.addEventListener('input', () => {
    tempo = Number(tempoIn.value)
    showTempo(tempoIn, tempo)
    // what sounds next takes the new tempo from the next beat; the readings go
    line.retempo(tempo)
  })
  q('[data-rb-reset]', lineRow).addEventListener('click', () =>
    changeLine(FOUR_QUARTERS, 'Back to four quarter notes', false),
  )
  const linePlay = q<HTMLButtonElement>('[data-rb-play]', lineRow)
  linePlay.addEventListener('click', () => playLine(linePlay))

  // ---------------------------------------------------------------- Step 5's two bars on the staff
  let dot = false
  let tie = false
  let clef = clefOf()

  const staff = mountRhythmBar({
    figure: staffFig,
    pads: null,
    said: q<HTMLElement>('[data-rb-said]', staffFig),
    freq: () => hz(clef === 'treble' ? A4 : A3),
    voice: () => (clef === 'treble' ? 'tavi' : 'merc'),
    owner: NowPlaying,
  })
  const staffView = () => rowView(staffBars(dot, tie), STEP_BPM, clef)
  const dotBtn = q<HTMLButtonElement>('[data-rb-dot]', staffRow)
  const tieBtn = q<HTMLButtonElement>('[data-rb-tie]', staffRow)
  const clefBtns = qa<HTMLButtonElement>('[data-rb-clef]', staffRow)

  function playStaff(btn: HTMLButtonElement | null): void {
    const view = staff.view
    if (view === null) return
    const done = staff.play([{ view, bpm: () => STEP_BPM }], {
      line: lengthsWords(staffBars(dot, tie), STEP_BPM),
    })
    if (btn !== null) light(btn, done)
  }

  /** Dot or Tie: the bars changed, said and played, keeping what they leave as heard. */
  function changeStaff(apply: () => void, said: string): void {
    const before = staffBars(dot, tie)
    const was = staff.written(0)
    apply()
    const kept = keptWritten(before, was, staffBars(dot, tie))
    staff.show(staffView(), (_r, i) => kept[i])
    staff.say(said)
    playStaff(null)
  }

  dotBtn.addEventListener('click', () => {
    const said = dot ? STAFF_SAID.dotOff : STAFF_SAID.dotOn
    changeStaff(() => {
      dot = !dot
    }, said)
    dotBtn.setAttribute('aria-pressed', String(dot))
  })
  tieBtn.addEventListener('click', () => {
    const said = tie ? STAFF_SAID.tieOff : STAFF_SAID.tieOn
    changeStaff(() => {
      tie = !tie
    }, said)
    tieBtn.setAttribute('aria-pressed', String(tie))
  })

  const pressClef = (): void => {
    for (const b of clefBtns)
      b.setAttribute('aria-pressed', String(b.dataset.rbClef === clef))
  }

  /** The staff on the other clef: the staff and the sound move together; what was heard stays written. */
  function setClef(c: Clef): void {
    clef = c
    pressClef()
    staff.stop()
    const written = staff.written(0)
    staff.show(staffView(), (_r, i) => written[i] === true)
  }
  for (const b of clefBtns)
    b.addEventListener('click', () => {
      const c: Clef = b.dataset.rbClef === 'treble' ? 'treble' : 'bass'
      if (c === clef) return
      setClef(c)
      staff.say(STAFF_SAID[c])
    })
  // a voice chosen in the sung part sets the clef for the rest of the visit
  VoiceChoice.subscribe((v) => {
    if (v !== null && clefOf() !== clef) setClef(clefOf())
  })
  const staffPlay = q<HTMLButtonElement>('[data-rb-play]', staffRow)
  staffPlay.addEventListener('click', () => playStaff(staffPlay))

  onLeave(root, () => {
    line.stop()
    staff.stop()
  })

  // written as each plays, never before (WEB-SPEC, Toys 1)
  line.show(rowView(lineBars(), tempo, 'line', 'choose'))
  line.choose(chosen)
  gridButtons()
  staff.show(staffView())
  pressClef()
  return { line, staff }
}
