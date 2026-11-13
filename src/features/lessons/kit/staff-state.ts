// ============================================================
// Staff toy's states and plays — what a page hands the toy, and what it plays on it
// ============================================================
//
// The types a page writes for the kit's staff toy (staff.ts): a step's
// state, and a play's notes. They live apart from the toy so a page's
// table of states and plays (Lesson 15's sounds.ts, Lesson 21's, Lesson
// 16's) reads them without the toy, and so the toy stays one file a reader
// can hold.

import type { Spelled } from './notes'
import type { Tone } from './staff-draw'
import type { KeySig } from './staff-key'
import type { Clef } from './staff-places'

/** A step's state of the toy: the page's, handed in as an option. */
export interface StaffState {
  /** One staff, in `clef`, or the grand staff. */
  readonly staff: 'single' | 'grand'
  readonly clef?: Clef
  /** What a tap, a step or an arrow does: play the place, move the one note there, or nothing. */
  readonly tap: 'place' | 'mover' | 'none'
  /** The note the state opens on, drawn: the mover's start. */
  readonly start?: Spelled
  /** Each place's letter stays beside the staff once it has played. */
  readonly keep?: boolean
  /** How long a tapped note sounds, s. */
  readonly tapSec?: number
  /** The key strip under the grand staff, its lowest and highest white keys. */
  readonly keys?: { readonly lo: number; readonly hi: number }
  /** Notes written before anything plays, in a run (Sing it's five). */
  readonly score?: readonly {
    readonly note: Spelled
    readonly home?: boolean
  }[]
  /** The places a tap or a step reaches; the toy's range by default (staff-places.ts `placeRange`). */
  readonly reach?: readonly [number, number]
  /** The places the figure keeps room for, its ledger lines with them; the toy's range by default: Lesson 27's G3 under the treble staff and G4 over the bass. */
  readonly room?: readonly [number, number]
  /** Said when a step or a tap meets the reach's end. */
  readonly endLine?: string
  /** No pitch line beside it, whatever the switch says. */
  readonly noLanes?: boolean
  /** The key signature past the clef, on one staff; none when unset (staff-key.ts). */
  readonly key?: KeySig | null
  /** The signs the staff keeps room for past the clef, so its notes stay put as the signature grows. */
  readonly keyRoom?: number
  /** The staff spaces a run's figure holds across (staff-draw.ts `across`): a page whose runs are long asks for more. */
  readonly across?: number
  /** The picked note carries the house: a tap places do (Lesson 21's Find do). */
  readonly house?: boolean
  /** Do, for the syllables under the notes: each note's counts its letters up from do (Lesson 16). */
  readonly solfa?: Spelled
  /** Whether the syllables show as the state opens; the toy keeps its own choice when unset. */
  readonly names?: boolean
  /** Played before each tapped place, unless the place is its own: do, then the note (Lesson 16's Step 1). */
  readonly lead?: Spelled
}

/** A note of a play: when it starts and how long it sounds, s, and how it lights. */
export interface PlayNote {
  readonly t: number
  readonly dur: number
  readonly note: Spelled
  /** Its tone: the soft tone unless the play's or the note's says Merc's "ooh". */
  readonly kind?: 'soft' | 'merc'
  /** How it lights while it sounds: ink by default, blue for Merc's own note. */
  readonly tone?: Tone
  /** On the grand staff, the staff middle C is written on. */
  readonly on?: Clef
  /** The clef whose line goes gold as it sounds. */
  readonly gold?: Clef
  /** The staff of the grand staff it names, lit as it sounds. */
  readonly staffLit?: Clef
  /** Ringed in ink, with its sign, while it shows: a note a step has just changed. */
  readonly outline?: boolean
  /** The house under it: do. */
  readonly home?: boolean
  /** Lit this long before it sounds, s, silent until then: Hear it inside (Lesson 16's Step 3). */
  readonly ahead?: number
  /** A run's column for it, its place in the play unless given: a chord's notes share one (Lesson 25). */
  readonly col?: number
  /** The note it climbs from as it shows, up the staff to its own place: a chord's bottom note turned over (Lesson 27). */
  readonly from?: Spelled
  /** Its own level, for a play whose chords differ in size: three notes at 0.075 a voice, four at 0.056 (Lesson 27); the play's otherwise. */
  readonly gain?: number
}

/** A page's play on the toy. */
export interface StaffPlay {
  readonly notes: readonly PlayNote[]
  /**
   * 'run': each note in its own column, staying; 'cursor': the one note
   * moves to each; 'score': each note lights the score's note it sounds.
   */
  readonly show: 'run' | 'cursor' | 'score'
  /** The clef it opens on a single staff. */
  readonly clef?: Clef
  /** Each note's letter stays beside the staff as it sounds. */
  readonly keep?: boolean
  readonly kind?: 'soft' | 'merc'
  readonly gain?: number
  /** Said as it starts. */
  readonly say?: string
  /**
   * Written and lit on time, sounding nothing and claiming no owner:
   * another voice sings the notes (Lesson 20's run toy, Merc's run as one line).
   */
  readonly silent?: boolean
}
