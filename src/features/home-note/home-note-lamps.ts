// ============================================================
// Home note's lamps — the intro's chords as they play, the run's keys after
// ============================================================
//
// Two rows of small lights, from the Ear rooms canvas (27 Oct 2026). While
// the band plays, one lamp a chord under the chip, I, IV and V as the
// level's intro has them: each lit as its chord reaches the speaker, left
// glowing once it has passed. At the result, one lamp a key of the run: lit
// for a home found, an empty ring for one missed. A lamp of the result is a
// button: it plays that key's intro again, and Merc sings its home.
//
// What the lamps show, as pure functions: HomeNoteLamps.tsx draws them.

import { midiToNoteNameOctave } from '@/lib/note-utils'
import type { RoundOutcome } from './home-note-machine'
import type { Chord } from './home-note-rules'

/** A chord's lamp: still to come, sounding now, or passed. */
export type ChordLampState = 'toCome' | 'playing' | 'played'

/**
 * Lamp `index` of the intro, when `begun` of its chords have reached the
 * speaker and `over` says the band has stopped.
 */
export function chordLampState(
  index: number,
  begun: number,
  over: boolean,
): ChordLampState {
  if (index >= begun) return 'toCome'
  return index === begun - 1 && !over ? 'playing' : 'played'
}

/** Each chord as a musician says it. */
const SAID_CHORD: Readonly<Record<Chord, string>> = {
  I: 'the one',
  IV: 'the four',
  V: 'the five',
}

const SAID_STATE: Readonly<Record<ChordLampState, string>> = {
  toCome: 'to come',
  playing: 'playing',
  played: 'played',
}

/** The intro's lamps in words, for a screen reader. */
export function chordLampsLabel(
  chords: readonly Chord[],
  begun: number,
  over: boolean,
): string {
  const lamps = chords.map(
    (chord, i) =>
      `${SAID_CHORD[chord]} ${SAID_STATE[chordLampState(i, begun, over)]}`,
  )
  return `The band's chords: ${lamps.join(', ')}`
}

/** A note's name as it is said: "A#3" is "A sharp 3". */
export function saidNote(midi: number): string {
  return midiToNoteNameOctave(midi).replace('#', ' sharp ')
}

/** A key's lamp at the result, in words: what its button does. */
export function keyLampLabel(outcome: RoundOutcome): string {
  return `Key ${outcome.round.index + 1}, home ${saidNote(outcome.round.home)}, ${
    outcome.landed ? 'found' : 'missed'
  }. Hear it again`
}
