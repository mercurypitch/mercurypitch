// ============================================================
// Lesson 10 wrap — free play: every control of the chord beads in one place
// ============================================================
//
// The Wrap's practice card is Sing it's to mount (sing.ts), in the version
// the visit's ending picks (kit/comfort.ts `VisitEnding`), and the next
// lesson's card is the kit's, drawn by main.ts before the explorer, keeping
// the page's tease still in its mark (learn/10.html). This module is free
// play, after the card (playbook rule 17): its own copy of the chord beads
// in their free state (WEB-SPEC, Toys 1, Free play), with every control the
// steps show one at a time, and nothing locked, since the guided steps come
// first on the page.
//
// Root lower and Root higher slide the chord a white key at a time, C4 to
// B4, each `aria-disabled` at its end, where a press does nothing. Major ·
// Minor moves the third; Chord · Scale spreads the chord into its scale and
// folds it back; a slide while the scale shows renames its stairs in place,
// so a scale on B4 climbs to B5, 987.77 Hz, in the scale's own window
// (FACTS 70a, 82). Play plays whichever shows: the chord, note by note and
// then together (FACTS 75), or its scale (FACTS 77). Play the pattern plays
// Step 4's pattern on the chord (pattern.ts). Slow doubles every length of
// Play's and the gap buttons' plays, and plays the pattern at Step 4's slow
// tempo, 70 crotchets a minute, where free play's own is the fast one, 160
// (FACTS 76). Slow and Major · Minor, pressed while the pattern plays, act
// from its next quaver, as Step 4's switches do, and it plays on; Major ·
// Minor stops a play of the chord or the scale, as the steps' does. The
// names switch, Letters · Do-re-mi,
// writes the page's one names store (main.ts), so a switch here and in Step
// 5 agree, and the beads' and the stairs' names follow it.
//
// Every play is the page's one sound (kit/now-playing.ts): a play here
// stops any other on the page, another sound stops it, and so does leaving
// free play, by Sing it's rule (sing.ts `onLeave`): off screen for 600 ms,
// the page hidden, or the page gone. Each control and each line is the
// steps' own (steps.ts, lines.ts), so free play says each change once in
// its polite line in the steps' words, and asks the frame loop for nothing
// once its motions have landed (chord-beads.ts).

import { q } from '@/features/lessons/kit/dom'
import { watch } from '@/features/lessons/kit/frame-loop'
import type { ModeStore } from '@/features/lessons/kit/names'
import type { LettersSolfegeMode } from '@/features/lessons/kit/names-modes'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import { playLights } from '@/features/lessons/kit/play-lights'
import type { RunNote } from '@/features/lessons/kit/run'
import { Sound } from '@/features/lessons/kit/sound'
import type { BeadsSettings, ChordBeads } from './chord-beads'
import { mountChordBeads } from './chord-beads'
import { playPattern } from './pattern'
import { onLeave } from './sing'
import type { Tempo } from './sounds'
import { bindNames, bindQuality, bindRoots, bindSwitch, scaleNotes, stageNotes, } from './steps'

/** Free play's pattern tempo: Step 4's slow one under Slow, its fast one otherwise (WEB-SPEC, Toys 1). */
export const freeTempo = (slowOn: boolean): Tempo => (slowOn ? 'slow' : 'fast')

/** What Play sounds on what free play shows: the scale when spread, else the chord, at twice its lengths under Slow. */
export const freeNotes = (s: BeadsSettings): RunNote[] =>
  s.spread ? scaleNotes(s.quality, s) : stageNotes('triad', s)

/** Chord · Scale: the chord, or the chord spread into its scale. */
const VIEWS = ['chord', 'scale'] as const

/** Play and Play the pattern, each lit while it sounds; a newer play puts out the one before. */
function bindPlays(root: HTMLElement, beads: ChordBeads): void {
  const light = playLights()
  const play = q<HTMLButtonElement>('[data-free-play]', root)
  play.addEventListener('click', () => {
    light(play, beads.play(freeNotes(beads.settings), Sound.canPlay()))
  })
  // each quaver reads what is set as it starts (pattern.ts)
  const pattern = q<HTMLButtonElement>('[data-chord-play="pattern"]', root)
  pattern.addEventListener('click', () => {
    const audible = Sound.canPlay()
    light(
      pattern,
      beads.playRun((onNote) =>
        playPattern({ audible, set: () => beads.settings, onNote }),
      ),
    )
  })
}

/** Slow: Play's lengths doubled, and the pattern at Step 4's slow tempo. */
function bindSlow(root: HTMLElement, beads: ChordBeads): void {
  const slowBtn = q<HTMLButtonElement>('[data-chord-slow]', root)
  slowBtn.addEventListener('click', () => {
    const on = slowBtn.getAttribute('aria-pressed') !== 'true'
    slowBtn.setAttribute('aria-pressed', String(on))
    beads.setSlow(on)
    beads.setTempo(freeTempo(on))
  })
  beads.setTempo(freeTempo(false))
}

/**
 * Mounts free play in `#freePlay`, on the page's names store, and returns
 * its chord beads, for the page's tests.
 */
export function initWrap(names: ModeStore<LettersSolfegeMode>): ChordBeads {
  const root = q('#freePlay')
  const beads = mountChordBeads(root, {
    state: 'free',
    active: watch(root),
    owner: NowPlaying,
  })
  bindPlays(root, beads)
  bindSlow(root, beads)
  bindQuality(q('[data-chord-quality]', root), beads)
  bindSwitch(q('[data-chord-view]', root), 'data-view', VIEWS, (v) => {
    beads.setSpread(v === 'scale')
  })
  // free play is no step: its root's ends as it opens, on C4
  bindRoots(root, beads).opened(0)
  bindNames(root, beads, names)
  onLeave(root, beads.stop)
  return beads
}
