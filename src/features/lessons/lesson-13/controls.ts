// ============================================================
// Lesson 13 controls — the vowel figure's buttons, for the steps and free play
// ============================================================
//
// Every control of the vowel figure (WEB-SPEC, Toys 1 and 7), bound by its
// data attribute inside a stage, so the steps and free play share them:
// Add a harmonic (`data-act="add"`) adds the next harmonic and plays the
// 1st to it together, 1.5 s, starting again from the 1st after the last;
// All (`data-act="all"`) plays every harmonic, 2.0 s; Resonances
// (`data-act="res"`, `aria-pressed`) draws the resonance curves; a vowel
// button (`data-vowel`) plays its vowel, 2.0 s; Play the five vowels
// (`data-act="five"`) plays them in turn, 10.0 s, lighting the names row;
// and the voice switch (`data-voice-pick`, `aria-pressed`) plays ‘ah’ in
// the voice it picks, for the visit, storing nothing.
//
// Each play goes through the figure, so it claims the page's one sound and
// its button is lit while it plays (kit/play-lights.ts); the Merc of the
// figure's voice sings while it sounds, Merc for the lower voice and Tavi
// for the higher (kit/voice-choice.ts `mercOf`). A play pressed
// again while it runs stops it, but Add a harmonic, whose every press adds
// the next. The live region gets a play's line when the
// play ends, and only when the line is new, so a screen reader does not
// hear the same words twice.

import { q, qa } from '@/features/lessons/kit/dom'
import type { Which } from '@/features/lessons/kit/merc-duo'
import { mercSing } from '@/features/lessons/kit/merc-duo'
import { hz } from '@/features/lessons/kit/notes'
import type { PlayLight } from '@/features/lessons/kit/play-lights'
import { mercOf } from '@/features/lessons/kit/voice-choice'
import type { VowelFigure } from './figure'
import { addName, allLine, countReadout, fiveLine, harmonicsLine, harmonicsReadout, voiceLine, vowelLine, } from './lines'
import type { Line } from './plays'
import { ADD_SEC, ALL_SEC, oneVowel, sourceLine, vowelRun } from './plays'
import type { VoiceName, Vowel } from './vowels'
import { harmonicCount, HOME, VOWELS, vowelStrip } from './vowels'

/** What a set of controls holds for its figure: the voice, and the harmonics Step 1 shows. */
export interface FigureState {
  voice: VoiceName
  n: number
}

export interface Controls {
  readonly state: FigureState
  /** Back to a state's opening: the voice, the harmonics, the curves, and no play. */
  reset(voice: VoiceName, n: number, curves: boolean): void
  /** Writes a line to the live region, if it is new. */
  say(text: string): void
}

const isVowel = (v: string | undefined): v is Vowel =>
  VOWELS.some((x) => x === v)

/** The names row: the vowel of the moment bold and underlined, `aria-current="step"`; null for none. */
export function lightName(row: HTMLElement | null, v: Vowel | null): void {
  if (row === null) return
  for (const li of qa('[data-name]', row)) {
    const on = li.dataset.name === v
    li.classList.toggle('is-now', on)
    if (on) li.setAttribute('aria-current', 'step')
    else li.removeAttribute('aria-current')
  }
}

export function bindControls(
  root: HTMLElement,
  figure: VowelFigure,
  light: PlayLight,
): Controls {
  const state: FigureState = { voice: 'lower', n: 1 }
  const said = q('[data-said]', root)
  const names = root.querySelector<HTMLElement>('[data-names]')
  const midi = (): number => HOME[state.voice]
  const f0 = (): number => hz(midi())
  const count = (): number => harmonicCount(f0())
  let current: HTMLButtonElement | null = null
  let sung: { readonly which: Which; readonly midi: number } | null = null
  const quiet = (): void => {
    if (sung !== null) mercSing(sung.which, sung.midi, false)
    sung = null
  }

  function say(text: string): void {
    if (said.textContent !== text) said.textContent = text
  }

  /** Step 1's readout and Add's name, for the harmonics shown. */
  function syncHarmonics(): void {
    const label = midi() === HOME.lower ? 'A3' : 'A4'
    const top = root.querySelector('[data-readout-top]')
    const sub = root.querySelector('[data-readout-sub]')
    if (top !== null) top.textContent = harmonicsReadout(label, f0())
    if (sub !== null) sub.textContent = countReadout(state.n, count())
    const next = state.n >= count() ? 1 : state.n + 1
    for (const b of qa('[data-act="add"]', root))
      b.setAttribute('aria-label', addName(next, f0()))
  }

  function syncVoice(): void {
    for (const b of qa('[data-voice-pick]', root))
      b.setAttribute(
        'aria-pressed',
        String(b.dataset.voicePick === state.voice),
      )
  }

  /** Plays `line` from `btn`; a second press of a play still running stops it, unless it plays `again` (Add a harmonic). */
  function play(
    btn: HTMLButtonElement,
    line: Line,
    after: () => string,
    again = false,
  ): void {
    if (!again && current === btn && figure.playing) {
      figure.stop()
      return
    }
    current = btn
    quiet()
    const mine = { which: mercOf(state.voice), midi: midi() }
    const done = figure.play(line, {
      onVowel: (v) => lightName(names, v),
    })
    sung = mine
    mercSing(mine.which, mine.midi, true)
    light(btn, done)
    void done.then(() => {
      if (sung === mine) quiet()
      if (current === btn) current = null
      say(after())
    })
  }

  for (const b of qa<HTMLButtonElement>('[data-act="add"]', root))
    b.addEventListener('click', () => {
      state.n = state.n >= count() ? 1 : state.n + 1
      const n = state.n
      syncHarmonics()
      play(
        b,
        sourceLine(state.voice, midi(), n, ADD_SEC),
        () => harmonicsLine(n, midi(), f0()),
        true,
      )
    })
  for (const b of qa<HTMLButtonElement>('[data-act="all"]', root))
    b.addEventListener('click', () => {
      state.n = count()
      syncHarmonics()
      play(b, sourceLine(state.voice, midi(), count(), ALL_SEC), () =>
        allLine(count(), midi(), f0()),
      )
    })
  for (const b of qa<HTMLButtonElement>('[data-act="res"]', root))
    b.addEventListener('click', () => {
      figure.curves = !figure.curves
      b.setAttribute('aria-pressed', String(figure.curves))
    })
  for (const b of qa<HTMLButtonElement>('[data-vowel]', root))
    b.addEventListener('click', () => {
      const v = b.dataset.vowel
      if (!isVowel(v)) return
      const curves = figure.curves
      play(b, oneVowel(state.voice, midi(), v), () =>
        vowelLine(v, midi(), vowelStrip(state.voice, midi(), v).peaks, curves),
      )
    })
  for (const b of qa<HTMLButtonElement>('[data-act="five"]', root))
    b.addEventListener('click', () => {
      play(b, vowelRun(state.voice, midi(), VOWELS), () =>
        fiveLine(
          midi(),
          VOWELS.map((v) => vowelStrip(state.voice, midi(), v).peaks[0]),
        ),
      )
    })
  for (const b of qa<HTMLButtonElement>('[data-voice-pick]', root))
    b.addEventListener('click', () => {
      const voice = b.dataset.voicePick === 'higher' ? 'higher' : 'lower'
      state.voice = voice
      state.n = Math.min(state.n, count())
      syncVoice()
      syncHarmonics()
      play(b, oneVowel(voice, HOME[voice], 'ah'), () =>
        voiceLine(
          voice,
          HOME[voice],
          harmonicCount(hz(HOME[voice])),
          hz(HOME[voice]),
          vowelStrip(voice, HOME[voice], 'ah').peaks[0],
        ),
      )
    })

  syncHarmonics()
  syncVoice()
  return {
    state,
    say,
    reset(voice, n, curves) {
      current = null
      quiet()
      state.voice = voice
      state.n = n
      figure.curves = curves
      for (const b of qa('[data-act="res"]', root))
        b.setAttribute('aria-pressed', String(curves))
      lightName(names, null)
      syncVoice()
      syncHarmonics()
    },
  }
}
