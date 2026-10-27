// ============================================================
// Lesson 10 games — Major or minor?, on thirds in Step 1 and chords in Step 3
// ============================================================
//
// The kit's ear game (WEB-SPEC, Toys 5) in two modes, each on its card in
// its step's text, under the Notice: eight rounds on thirds in Step 1, each
// a root from C4 to G4, then the note 3 or 4 semitones above it; ten rounds
// on chords in Step 3, each the first five notes of a major or minor scale
// on such a root, then its triad together, as the Royal Conservatory's 2019
// voice syllabus sets its chord test (FACTS 21, 43, 78). game-rounds.ts
// deals them from the kit's fresh seed, half the rounds each answer. Each
// round plays as one of the kit's runs, in the soft tone, and a missed one
// plays again at 1.5 times its lengths (FACTS 78). The kit's rounds carry
// no level, so the notes of a round that start together, a chords round's
// triad, sound as a chord's voices, 0.075 each (FACTS 81); a note on its
// own takes the soft tone's. One sound at a time: a round, and a miss's
// replay, is the page's one sound (kit/now-playing.ts), so it stops
// whatever played before it, the other game's round included, and gives
// way to whatever plays next; steps.ts stops the games when the viewer
// leaves their step. A miss's replay starts on a timer, not a tap, so it
// only reads the sound switch: with sound off it plays silently and shows
// no sound-off note. The Play button's first words are the markup's.

import { q } from '@/features/lessons/kit/dom'
import type { EarGame, EarNote, EarPlaying, EarRound, } from '@/features/lessons/kit/ear-game'
import { mountEarGame } from '@/features/lessons/kit/ear-game'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import type { RunNote } from '@/features/lessons/kit/run'
import { playNotes } from '@/features/lessons/kit/run'
import { Sound } from '@/features/lessons/kit/sound'
import type { Quality } from './chords'
import { ANSWERS, dealChords, dealThirds, MISS_SLOWER } from './game-rounds'
import { CHORD_GAIN } from './sounds'

export interface Games {
  /** Stops every game: the round sounding, and a miss's replay still to come. */
  stop(): void
}

/**
 * A round's notes as the kit's run notes: notes that start together are a
 * chord's voices, each at 0.075 (FACTS 81); a note alone takes the run's
 * level.
 */
export function roundNotes(events: readonly EarNote[]): RunNote[] {
  return events.map((e) => {
    const note: RunNote = { t: e.at, midi: e.midi, dur: e.dur }
    const together = events.some((x) => x !== e && x.at === e.at)
    return together ? { ...note, gain: CHORD_GAIN } : note
  })
}

/**
 * Plays a round as one of the kit's runs, in the soft tone. A tap asks the
 * sound switch (`Sound.canPlay`); a miss's replay, which a timer starts,
 * only reads it.
 */
export function playRound(
  events: readonly EarNote[],
  replay: boolean,
): EarPlaying {
  const run = playNotes(roundNotes(events), {
    audible: replay ? Sound.state === 'on' && !Sound.hushed : Sound.canPlay(),
    kind: 'soft',
  })
  return {
    done: run.done.then(() => undefined),
    stop: () => {
      run.stop()
    },
  }
}

/** A game's Play button after its first round, as Lesson 6's games word it. */
const LABELS = { again: 'Play it again', next: 'Next round' } as const

/** The Play button's words in the markup, before the first round. */
const startLabel = (card: HTMLElement): string =>
  (q('[data-eg-play] span', card).textContent ?? '').trim()

/** Mounts the kit's ear game on `card`, dealt by `deal`. */
function mountGame(
  card: HTMLElement,
  deal: (random: () => number) => readonly EarRound<Quality>[],
  more: string,
): EarGame {
  return mountEarGame(card, {
    answers: ANSWERS,
    deal,
    play: playRound,
    owner: NowPlaying,
    slower: MISS_SLOWER,
    labels: { start: startLabel(card), ...LABELS, more },
  })
}

export function initGames(): Games {
  const games: readonly EarGame[] = [
    mountGame(q('#thirdsGame'), dealThirds, 'Play eight more'),
    mountGame(q('#chordsGame'), dealChords, 'Play ten more'),
  ]
  return {
    stop() {
      for (const game of games) game.stop()
    },
  }
}
