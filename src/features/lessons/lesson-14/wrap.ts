// ============================================================
// Lesson 14 wrap — the practise card, and the season's close with its still
// ============================================================
//
// The practise card comes in two versions (WEB-SPEC, Wrap): the Karaoke
// Night card, one link to /karaoke-night?lesson=14, with "Ten minutes,
// gently, most days", or, after "Just listen today", "Effortful" or
// "Uncomfortable", the rest card, which links nowhere and names Karaoke
// Night for another day (kit/comfort.ts `mountPractiseCard`).
//
// Lesson 14 is the season's last, so where other pages name the next
// lesson the kit draws the season's close (kit/next-card.ts, `SEASON_END`
// in kit/lesson-copy.ts): "End of Season 1", "You've seen every note you
// sing. Now sing a whole song.", Karaoke Night in a tab of its own, and See
// the season map. It follows the visit's ending (kit/comfort.ts
// `VisitEnding`, held in memory, never stored): after a rest it keeps "You've
// seen every note you sing." and the map alone, inviting no singing. The
// card keeps the page's figure after its words: the song line's still, the
// whole song with its five breath marks and the swell on each "star" in
// light, an image with its text alternative. It is mounted once the kit
// has moved it into the card, and draws only while it is on screen.

import { mountPractiseCard, VisitEnding } from '@/features/lessons/kit/comfort'
import { q } from '@/features/lessons/kit/dom'
import { createNextCard } from '@/features/lessons/kit/next-card'
import type { SongLine } from './song-line'
import { mountSongLine } from './song-line'

/** Draws the practise card and the season's close, and mounts the close's still. */
export function initWrap(): SongLine | null {
  mountPractiseCard(q('#practiseCard'))
  createNextCard(14, VisitEnding)
  const still = document.querySelector<HTMLElement>('#wrap [data-end-still]')
  return still === null ? null : mountSongLine(still, { state: 'still' })
}
