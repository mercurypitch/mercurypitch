// ============================================================
// Lesson 8 wrap — the practise card Sing it picks, and free play
// ============================================================
//
// The practise card comes in two versions (WEB-SPEC, Sections 11; Toys 6):
// Drum Night's, or, after "Effortful", "Uncomfortable" or "Just listen
// today", the rest card, which puts off only this page's sung line and
// keeps both drills, since neither asks for the voice. Sing it's ending is
// held in memory for the visit (kit/comfort.ts `VisitEnding`), never
// stored, so a new visit opens on the Drum Night card.
//
// Free play unlocks after the lesson (playbook rule 17): every control of
// the beat machine on one card, nothing locked.

import { mountBeatMachine } from '@/features/lessons/kit/beat-machine'
import { VisitEnding } from '@/features/lessons/kit/comfort'
import { q } from '@/features/lessons/kit/dom'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import { BPM, LANES, PATTERNS } from './patterns'

export function initWrap(): void {
  const rest = q('#practiseCard [data-ending="rest"]')
  VisitEnding.subscribe((ending) => {
    rest.hidden = ending !== 'rest'
  })
  mountBeatMachine({
    root: q('#freePlay'),
    lanes: LANES,
    patterns: PATTERNS,
    grid: 'rock',
    shown: 'rock',
    bpm: BPM,
    id: 'mt-free',
    owner: NowPlaying,
    state: 'free',
  })
}
