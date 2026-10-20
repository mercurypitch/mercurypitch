// ============================================================
// Tour ids — one permanent number per guided tour
// ============================================================
//
// The numbers are append-only: a retired tour keeps its number and no number
// is reused, so history recorded under a number always means the same tour.
//
// This file has no imports on purpose, so Karaoke Night and the lessons can
// load it without pulling the rest of the app in.
// ============================================================

export type TourKey =
  | 'guide'
  | 'home'
  | 'path'
  | 'ear-lab'
  | 'guitar'
  | 'piano'
  | 'analysis'
  | 'exercises'
  | 'jam'
  | 'jam-room'
  | 'community'
  | 'leaderboard'
  | 'challenges'
  | 'voice'
  | 'mixer'
  | 'practice-modes'
  | 'sing'
  | 'karaoke-night'

/** One permanent number per tour. The table is append-only: see the banner. */
export const TOUR_IDS: Readonly<Record<TourKey, number>> = {
  guide: 1,
  home: 2,
  path: 3,
  'ear-lab': 4,
  guitar: 5,
  piano: 6,
  analysis: 7,
  exercises: 8,
  jam: 9,
  'jam-room': 10,
  community: 11,
  leaderboard: 12,
  challenges: 13,
  voice: 14,
  mixer: 15,
  'practice-modes': 16,
  // reserved for the Merc tours for Sing and Karaoke Night
  sing: 17,
  'karaoke-night': 18,
}
