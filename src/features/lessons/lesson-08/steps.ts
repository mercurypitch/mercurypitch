// ============================================================
// Lesson 8 steps — five steps, one beat machine, and Step 5's predict
// ============================================================
//
// Every step shows the one beat machine (`toyFor: () => 1`), each in its
// own state (WEB-SPEC, Toys 1): the metronome; the metronome with Tempo;
// the beat row with Bars; the beat grid with Kick, Clap and Hi-hat on the
// rock beat; the grid with March, Rock and Tempo. Count the bar sits in
// Step 3's text. Leaving a step by any route, Next or Previous, a swipe,
// the lesson menu, an address that names a step or a quiz's step link,
// comes through the deck's `onStep`, which stops the machine (and with it
// what its beat clock had booked ahead, so a Step 5 play resolves as not
// heard) and Count the bar, its miss's replay still to come included. The
// step showing, shown again as the phone deck and the wide page swap,
// changes nothing.
//
// Step 5's predict sits in the step text. Its choice unlocks its two plays
// and the stage's Play, March and Rock (`unlocks`), and the stage's Tempo
// (`onChoice`, since `unlocks` takes buttons): all four are `disabled` in
// the markup, so the stage cannot answer the question first. The reveal
// waits until both plays have been heard to their ends, since it compares
// them; Tavi's line, the mix-up card, the Try and the Notice answer it
// too, so they come with it.

import type { MachineState } from '@/features/lessons/kit/beat-layout'
import type { BeatMachine } from '@/features/lessons/kit/beat-machine'
import { mountBeatMachine } from '@/features/lessons/kit/beat-machine'
import { q, qa } from '@/features/lessons/kit/dom'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import { mountPredict } from '@/features/lessons/kit/predict'
import type { StepDeck } from '@/features/lessons/kit/step-deck'
import { registerToy } from '@/features/lessons/kit/step-deck'
import { initCountTheBar } from './count-the-bar'
import { BPM, LANES, PATTERNS } from './patterns'

/** Each step's state of the machine. */
export const STATE_OF: Readonly<Record<number, MachineState>> = {
  1: 'metronome',
  2: 'tempo',
  3: 'bars',
  4: 'grid',
  5: 'patterns',
}

/** Each step's figure label. */
export const FIG: Readonly<Record<number, string>> = {
  1: '<span class="fig">Fig. 1</span> The metronome',
  2: '<span class="fig">Fig. 2</span> The metronome, with Tempo',
  3: '<span class="fig">Fig. 3</span> The beat row',
  4: '<span class="fig">Fig. 4</span> The beat grid',
  5: '<span class="fig">Fig. 5</span> Two patterns, one grid',
}

/** Step 5's reveal line, by the choice: never "right" or "wrong". */
export const PATTERN_GUESS: Readonly<Record<string, string>> = {
  same: 'You said: yes, the same speed now',
  pattern: "You said: no, still the march's pattern",
}

/** Step 5's hints (Toys 2), the sound-off one LESSON.md's. */
export const PATTERN_HINTS = {
  chosen: 'Locked in. Play both, and watch the grid.',
  next: 'Now play the other one.',
  silent:
    'Sound is off, so nothing played. Turn sound on to hear them, then press Play the march at 90.',
  again: 'Play them again, or swap the tempos on the stage.',
} as const

/** Bars each of Step 5's plays runs for, at 90 BPM (FACTS 75). */
export const PATTERN_PLAY_BARS = 2

function initPatternPredict(deck: StepDeck, machine: BeatMachine): void {
  const step = q('#step-5')
  const predict = q('#predictPattern', step)
  const stage = q('#toyBeat')
  mountPredict(predict, {
    play: (what, audible) => {
      // the plays sound on the stage's grid, which shows what is playing
      if (deck.current !== 5) deck.show(5)
      return machine.playPattern(
        what === 'march' ? 'march' : 'rock',
        BPM,
        PATTERN_PLAY_BARS,
        audible,
      )
    },
    revealOn: ['march', 'rock'],
    revealAfter: 'all',
    unlocks: qa<HTMLButtonElement>('[data-step5]', stage),
    onChoice: () => {
      q<HTMLInputElement>('#tempoPattern', stage).disabled = false
    },
    // the predict's own reveal first: its "You said" line is written there
    reveal: [q('.reveal', predict), ...qa('[data-pattern-reveal]', step)],
    hints: PATTERN_HINTS,
    guess: (choice) => PATTERN_GUESS[choice] ?? 'You said',
  })
}

export function initSteps(deck: StepDeck): BeatMachine {
  const root = q('#toyBeat')
  const machine = mountBeatMachine({
    root,
    lanes: LANES,
    patterns: PATTERNS,
    grid: 'rock',
    shown: 'march',
    bpm: BPM,
    id: 'mt-stage',
    owner: NowPlaying,
    state: 'metronome',
  })
  const label = q('[data-fig-label]', root)
  const game = initCountTheBar()
  registerToy({
    onStep(n, previous) {
      // the step showing shown again, as the phone deck and the wide page
      // swap at a rotation or a resize: nothing changes, so a run plays on
      if (n === previous) return
      // a step left behind keeps nothing sounding or booked: the machine's
      // run, a Step 5 play, Count the bar's round and a miss's replay
      machine.setState(STATE_OF[n] ?? 'metronome')
      game.stop()
      label.innerHTML = FIG[n] ?? FIG[1]
    },
  })
  initPatternPredict(deck, machine)
  return machine
}
