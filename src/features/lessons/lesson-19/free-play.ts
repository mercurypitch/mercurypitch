// ============================================================
// Lesson 19 free play — the six pads and the two tunes, in one place
// ============================================================
//
// The rhythm bar again, on a card of its own after the next-lesson card
// (WEB-SPEC, Toys 8), as two figures, with nothing locked, since the guided
// steps come first (playbook rule 17). The first is Step 1's bar of six
// eighths over six pads, on one line, with 6/8 · 3/4; the second is Step
// 2's staff, one tune at a time by 6/8 · 3/4, on one system where the
// figure is wide and on two of two bars on a phone, with Count and Clef,
// the clef the stored voice's and Bass when none is chosen. As in the
// steps, a switch redraws its figure and plays nothing until its Play: the
// notes it leaves stay written as they were heard, and each tune is
// written as it first sounds and kept for the visit (steps.ts).
//
// Both figures are the page's one sound, and the card off screen for
// 600 ms, or the page hidden, stops them (kit/leave.ts). Each says what a
// switch changed in its polite region, in the steps' words.

import { q, qa } from '@/features/lessons/kit/dom'
import { bookDrum } from '@/features/lessons/kit/drum-hits'
import { onLeave } from '@/features/lessons/kit/leave'
import { A3, A4, hz } from '@/features/lessons/kit/notes'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import { playLights } from '@/features/lessons/kit/play-lights'
import type { RhythmBar } from '@/features/lessons/kit/rhythm-bar'
import { mountRhythmBar } from '@/features/lessons/kit/rhythm-bar'
import { figureSize } from '@/features/lessons/kit/rhythm-draw'
import { placeRow } from '@/features/lessons/kit/rhythm-layout'
import type { Clef } from '@/features/lessons/kit/staff-places'
import { VoiceChoice } from '@/features/lessons/kit/voice-choice'
import type { MetreKey } from './rhythm-views'
import { keptWritten, sixPart, sixView, tuneParts, tuneView, } from './rhythm-views'
import { SWITCH_SAID, TUNE_WIDE } from './steps'

export interface FreePlay {
  readonly six: RhythmBar
  readonly staff: RhythmBar
}

/** The clef a voice sets: the treble for the higher, the bass otherwise. */
const clefOf = (): Clef => (VoiceChoice.voice === 'higher' ? 'treble' : 'bass')

const keyOf = (b: HTMLElement): MetreKey =>
  b.dataset.rbMetre === '3-4' ? '3-4' : '6-8'

export function initFreePlay(): FreePlay {
  const root = q('#freePlay')
  const [sixRow, staffRow] = qa('.controls.rb-row', root)
  const sixFig = q('[data-free-bar]', root)
  const staffFig = q('[data-free-staff]', root)
  const light = playLights()

  /** Marks the pressed one of a row's buttons. */
  const pressed = (row: HTMLElement, attr: string, value: string): void => {
    for (const b of qa<HTMLButtonElement>(`[${attr}]`, row))
      b.setAttribute('aria-pressed', String(b.getAttribute(attr) === value))
  }

  // ---------------------------------------------------------------- the six pads
  let metre: MetreKey = '6-8'
  const six = mountRhythmBar({
    figure: sixFig,
    pads: q<HTMLElement>('[data-rb-pads]', root),
    said: q<HTMLElement>('[data-rb-said]', sixFig),
    freq: () => hz(A3),
    voice: () => 'merc',
    owner: NowPlaying,
    drum: bookDrum,
  })
  for (const b of qa<HTMLButtonElement>('[data-rb-metre]', sixRow))
    b.addEventListener('click', () => {
      const key = keyOf(b)
      if (key === metre) return
      six.stop()
      const before = placeRow(sixView(metre).scene.rows[0])
      const was = six.written(0)
      metre = key
      const after = sixView(metre)
      const kept = keptWritten(before, was, placeRow(after.scene.rows[0]))
      six.show(after, (_r, i) => kept[i])
      pressed(sixRow, 'data-rb-metre', key)
      six.say(SWITCH_SAID[key])
    })
  const sixPlay = q<HTMLButtonElement>('[data-rb-play]', sixRow)
  sixPlay.addEventListener('click', () => {
    const view = six.view
    if (view === null) return
    light(sixPlay, six.play([sixPart(view, metre)]))
  })

  // ---------------------------------------------------------------- the two tunes on the staff
  let tune: MetreKey = '6-8'
  let clef = clefOf()
  let counts = false
  /** What was heard of each tune, for the visit. */
  const heard = new Map<MetreKey, readonly boolean[]>()
  const staff = mountRhythmBar({
    figure: staffFig,
    pads: null,
    said: q<HTMLElement>('[data-rb-said]', staffFig),
    freq: () => hz(clef === 'treble' ? A4 : A3),
    voice: () => (clef === 'treble' ? 'tavi' : 'merc'),
    owner: NowPlaying,
  })
  const systems = (): 1 | 2 => (figureSize(staffFig).w >= TUNE_WIDE ? 1 : 2)
  const writtenNow = (): boolean[] =>
    (staff.view?.scene.rows ?? []).flatMap((_, r) => staff.written(r))

  /** Draws the tune shown on the clef, `written` its symbols as heard, row after row. */
  function showTune(written: readonly boolean[] = heard.get(tune) ?? []): void {
    const view = tuneView(tune, clef, systems())
    const starts = view.scene.rows.map((_, r) =>
      view.scene.rows
        .slice(0, r)
        .reduce((k, row) => k + placeRow(row).length, 0),
    )
    staff.show(view, (r, i) => written[starts[r] + i] === true)
  }

  for (const b of qa<HTMLButtonElement>('[data-rb-metre]', staffRow))
    b.addEventListener('click', () => {
      const key = keyOf(b)
      if (key === tune) return
      staff.stop()
      heard.set(tune, writtenNow())
      tune = key
      showTune()
      pressed(staffRow, 'data-rb-metre', key)
      staff.say(SWITCH_SAID.tune[key])
    })
  const countBtn = q<HTMLButtonElement>('[data-rb-count]', staffRow)
  countBtn.addEventListener('click', () => {
    counts = !counts
    countBtn.setAttribute('aria-pressed', String(counts))
    staff.see({ counts })
  })

  /** The staff on the other clef: the staff and the sound move together; what was heard stays written. */
  function setClef(c: Clef): void {
    staff.stop()
    const was = writtenNow()
    clef = c
    pressed(staffRow, 'data-rb-clef', c)
    showTune(was)
  }
  for (const b of qa<HTMLButtonElement>('[data-rb-clef]', staffRow))
    b.addEventListener('click', () => {
      const c: Clef = b.dataset.rbClef === 'treble' ? 'treble' : 'bass'
      if (c === clef) return
      setClef(c)
      staff.say(SWITCH_SAID[c])
    })
  const staffPlay = q<HTMLButtonElement>('[data-rb-play]', staffRow)
  staffPlay.addEventListener('click', () => {
    const view = staff.view
    if (view === null) return
    light(staffPlay, staff.play(tuneParts(view)))
  })

  // a phone turned on its side may fit the tune on one system, or no longer
  if (typeof ResizeObserver !== 'undefined')
    new ResizeObserver(() => {
      if (staff.playing) return
      if ((staff.view?.scene.rows.length ?? 0) === systems()) return
      heard.set(tune, writtenNow())
      showTune()
    }).observe(staffFig)

  onLeave(root, () => {
    six.stop()
    staff.stop()
  })

  // written as each plays, never before (WEB-SPEC, Toys 1)
  six.show(sixView(metre))
  pressed(staffRow, 'data-rb-clef', clef)
  showTune()
  return { six, staff }
}
