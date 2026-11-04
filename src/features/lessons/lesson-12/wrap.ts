// ============================================================
// Lesson 12 wrap — free play: every control of the ring of rooms in one place
// ============================================================
//
// The Wrap's practise card is Sing it's to mount (sing.ts), in the version
// the visit's ending picks (kit/comfort.ts `VisitEnding`), and the next
// lesson's card is the kit's, drawn by main.ts before the explorer, keeping
// the page's tease still in its slot (learn/12.html). This module is free
// play, after the card (playbook rule 17): its own copy of the ring of
// rooms (WEB-SPEC, Toys 1, Free play), with every control the steps show
// one at a time, and nothing locked, since the guided steps come first on
// the page.
//
// It opens on C major's seven rooms, faint, the chips giving numerals: the
// seven chips, the key switch C · G, the names switch, Play I, then vi,
// Play the loop, Play the roots, Tune 1, Tune 2, Even notes and Slow, each
// the steps' own (steps.ts `bindControls`). In G the loop, the roots and
// the tunes play a fourth lower than in C, all by the same five semitones,
// and Play I, then vi slides D to E (FACTS 69a; music.ts). The names
// switch writes the page's one names store (main.ts), so a switch here and
// in Step 3 agree. Every play is the page's one sound (kit/now-playing.
// ts): a play here stops any other on the page, another sound stops it,
// and so does leaving free play, by Sing it's rule (kit/leave.ts): off
// screen for 600 ms, the page hidden, or the page gone.

import { q } from '@/features/lessons/kit/dom'
import { watch } from '@/features/lessons/kit/frame-loop'
import { onLeave } from '@/features/lessons/kit/leave'
import type { ModeStore } from '@/features/lessons/kit/names'
import type { LettersSolfegeMode } from '@/features/lessons/kit/names-modes'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import type { Rooms } from './rooms'
import { mountRooms } from './rooms'
import { bindControls } from './steps'

/** Mounts free play's ring of rooms on the page's names store. */
export function initWrap(names: ModeStore<LettersSolfegeMode>): Rooms {
  const root = q('#freePlay')
  const rooms = mountRooms(root, {
    mode: 'numerals',
    active: watch(root),
    owner: NowPlaying,
  })
  bindControls(root, rooms, names)
  onLeave(root, rooms.stop)
  return rooms
}
