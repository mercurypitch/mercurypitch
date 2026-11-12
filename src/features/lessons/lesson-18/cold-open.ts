// ============================================================
// Lesson 18 cold open — Merc's two bars between Merc and Tavi, read two ways
// ============================================================
//
// The hero is the cold open, in Lesson 2's order: Tavi's and Merc's bubbles
// over them, the reading staff's drawing between them in a fixed state,
// the bass staff with its clef, 4/4 and Merc's two bars, G3 A3 B3 A3, then
// G3 B3 and a long D4, the house on G3 and the beat grid under the bars,
// taking no taps; the play under the stage; then the predict (WEB-SPEC,
// Toys 1). It is the bass clef for everyone, since the tune is Merc's.
//
// Watch Merc read opens with the choice: do in the soft tone for 1.0 s,
// 0.4 s of quiet, the count-in, then the bars over the click, Merc naming
// each note on one beat, its syllable written over it, and singing it on
// "ooh" on the next, so the bars end before do, mi and so (by-name.ts,
// 13.4 s). The reveal waits for that read heard to its end with sound on
// (the kit's predict), and holds Read Merc's way: the count-in, then the
// tune on the beat, a gold bracket fading in over each pattern as the
// cursor reaches it, 12.0 s; it answers nothing. A polite region says what
// each read played. Leaving the hero, by a step change of the deck or the
// hero off screen for 600 ms, ends its play, and a read cut short is not
// heard. Merc sings as each note sounds and Tavi listens; neither
// celebrates at the reveal. On a first visit the welcome tour waits for
// the choice (kit/tour-gate.ts `holdTour`): Step 1's text answers it, and
// the choice unlocks Step 1's toy and free play (choice.ts).

import type { Run } from '@/features/lessons/kit/beat-clock'
import { q } from '@/features/lessons/kit/dom'
import { onLeave } from '@/features/lessons/kit/leave'
import { mercListen, mercSing, mercsReady, } from '@/features/lessons/kit/merc-duo'
import { Motion } from '@/features/lessons/kit/motion-switch'
import { hz } from '@/features/lessons/kit/notes'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import type { Predict } from '@/features/lessons/kit/predict'
import { mountPredict } from '@/features/lessons/kit/predict'
import { createReadMarks } from '@/features/lessons/kit/read-marks'
import type { RhythmBar, RhythmView } from '@/features/lessons/kit/rhythm-bar'
import { mountRhythmBar } from '@/features/lessons/kit/rhythm-bar'
import { figureSize } from '@/features/lessons/kit/rhythm-draw'
import { midiOf } from '@/features/lessons/kit/staff-places'
import type { StepDeck } from '@/features/lessons/kit/step-deck'
import { stillSky } from '@/features/lessons/kit/still-sky'
import { holdTour } from '@/features/lessons/kit/tour-gate'
import { startByName } from './by-name'
import { Choice } from './choice'
import { bracketsAt, COUNT_IN, cursorAt, READ_LINES } from './reads'
import { beatsOf, BPM, COLD, DO, notesOf, spaceFor, tuneLabel, tuneScene, } from './tunes'

/** The predict's words (WEB-SPEC, Toys 1). */
export const COLD_PREDICT = {
  hints: {
    chosen: 'Locked in. Watch Merc read.',
    silent: 'Sound is off: nothing played. Turn sound on, then play it again.',
    again: 'Play it again.',
  },
  guess: {
    seven: 'You said: all seven',
    four: 'You said: only four',
  },
} as const

const isChoice = (c: string): c is keyof typeof COLD_PREDICT.guess =>
  Object.hasOwn(COLD_PREDICT.guess, c)

/** Merc's tune, on the bass staff for everyone. */
const NOTES = notesOf(COLD, 'bass')

export interface ColdOpen {
  readonly predict: Predict
  readonly bar: RhythmBar
  stop(): void
}

export function initColdOpen(deck: StepDeck): ColdOpen {
  const stage = q('#heroStage')
  stillSky(stage)
  // the stills wait while a live Merc may still mount, then step in
  void mercsReady.then(() => q('#duo').classList.remove('pending'))
  const figure = q('#heroStaff')
  const marks = createReadMarks()
  // the frame handler of Merc's way while it plays
  let frame: ((beats: number) => void) | null = null
  const bar = mountRhythmBar({
    figure,
    pads: null,
    said: q('[data-hero-said]', figure),
    freq: () => hz(midiOf(DO.bass)),
    voice: () => 'merc',
    owner: NowPlaying,
    onFrame: (beats) => {
      if (beats !== null) frame?.(beats - COUNT_IN)
    },
    onDraw: (fig, svg) => {
      const v = bar.view
      if (v !== null) marks.draw(fig, svg, v.scene)
    },
  })
  const view = (): RhythmView => ({
    scene: tuneScene(COLD, 'bass', { space: spaceFor(figureSize(figure).w) }),
    label: tuneLabel(COLD, 'bass'),
    pads: null,
  })
  bar.show(view(), () => true)
  marks.set({ home: DO.bass })

  let run: Run | null = null

  /** Merc and Tavi back to rest. */
  function rest(): void {
    mercSing('blue', midiOf(DO.bass), false)
    mercListen('orange', false)
  }

  /** Ends what the hero plays, its lights out; what a read wrote stays. */
  function stop(): void {
    const r = run
    run = null
    r?.stop()
    if (bar.playing) bar.stop()
    frame = null
    bar.light({ pad: null, sounding: null })
    marks.set({ countIn: null })
    rest()
    NowPlaying.release(stop)
  }

  /** Clears what the last read wrote. */
  function fresh(): void {
    marks.set({ names: [], tags: [], brackets: [], cursor: null })
  }

  /** Watch Merc read: the note-by-note read, resolving false when cut short. */
  function read(): Promise<boolean> {
    stop()
    fresh()
    NowPlaying.claim(stop)
    mercListen('orange', true)
    const r = startByName({
      bar,
      marks,
      notes: NOTES,
      withDo: true,
      kind: 'merc',
      tags: false,
      onSing: (i) => {
        if (i !== null) mercSing('blue', midiOf(NOTES[i]), true)
      },
    })
    run = r
    return r.done.then((heard) => {
      if (run === r) {
        run = null
        rest()
        NowPlaying.release(stop)
      }
      if (heard) bar.say(READ_LINES.heroByName)
      return heard
    })
  }

  /** Read Merc's way, in the reveal: the tune on the beat, its brackets as the cursor reaches them. */
  function way(): void {
    stop()
    fresh()
    const sounds = beatsOf(COLD)
    let shown = 0
    let singing = -1
    const jumps = Motion.paused || Motion.locked
    frame = (beats) => {
      const reached = bracketsAt(COLD, beats)
      if (reached.length !== shown) {
        shown = reached.length
        marks.set({ brackets: reached })
      }
      marks.set({
        cursor: cursorAt(beats, 8, jumps),
        countIn:
          beats < 0
            ? { dots: COUNT_IN, lit: Math.floor(beats + COUNT_IN) }
            : null,
      })
      // Merc sings each note as it sounds
      const now = sounds.findIndex(
        (s) => beats >= s.beat && beats < s.beat + s.beats,
      )
      if (now !== singing) {
        singing = now
        if (now !== -1) mercSing('blue', midiOf(NOTES[now]), true)
      }
    }
    mercListen('orange', true)
    const done = bar.play(
      [{ view: bar.view ?? view(), bpm: () => BPM, countIn: COUNT_IN }],
      { kind: 'merc', line: READ_LINES.heroWay },
    )
    void done.then((heard) => {
      frame = null
      rest()
      marks.set({ countIn: null, cursor: heard ? 8 : null })
    })
  }

  // a first visit's tour waits for the choice: Step 1's text answers it
  let chose: (c: string) => void = () => undefined
  const chosen = new Promise<string>((resolve) => {
    chose = resolve
  })
  holdTour(chosen, () => undefined)

  const predict = mountPredict(q('#predict'), {
    play: (what) => (what === 'read' ? read() : Promise.resolve(true)),
    // the read sits under the stage, outside the predict card
    plays: [q<HTMLButtonElement>('#heroPlay')],
    revealOn: ['read'],
    hints: COLD_PREDICT.hints,
    guess: (c) => (isChoice(c) ? COLD_PREDICT.guess[c] : 'You said'),
    onChoice: (c) => {
      chose(c)
      Choice.make()
    },
  })
  q<HTMLButtonElement>('#predict [data-play="way"]').addEventListener(
    'click',
    way,
  )

  // leaving the hero ends its play: a step change of the deck, by any
  // route, or the hero off screen for 600 ms, a hidden page or a page gone
  deck.subscribe(stop)
  onLeave(stage, stop)
  return { predict, bar, stop }
}
