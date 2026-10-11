// ============================================================
// First Light — the Map's rooms (data, not code)
// ============================================================
//
// What a new singer can actually do here, in the order we want them
// to meet it. Deliberately a flat list: the Map grid is auto-fit, so
// adding the two Home cards from PR #359 (Jam Rooms, Hear Yourself)
// is a data change here plus a cover in public/onboarding/rooms/.
//
// The line is the whole point, and it has one job: say what the room IS
// before saying what you do in it. A title alone ("Analysis") names a
// noun the visitor has no picture of; "A plain-language read of your
// voice — where your pitch went, how steady you held it" gives them the
// picture first and the activity second. Write every line that way round,
// and in words a first-timer already owns: no "harmonics", no "orbs".

import type { ActiveTab } from '@/features/tabs/constants'
import { TAB_ANALYSIS, TAB_EXERCISES, TAB_JAM, TAB_PATH, TAB_SINGING, } from '@/features/tabs/constants'

export type RoomId =
  | 'practice'
  | 'exercises'
  | 'ascent'
  | 'karaoke'
  | 'jam'
  | 'analysis'

export type RoomTarget =
  | { kind: 'tab'; tab: ActiveTab }
  | { kind: 'page'; href: string }

/**
 * A room's cover: Merc in that room, painted for the Map with Codex
 * imagegen on 11 Oct 2026 (owner decision V5). `src` is the full
 * 1672x941 master as webp, `medium` the 800x450 cut a desktop card needs
 * at twice the density (the widest card is under 400 px), `small` the
 * 560x315 cut for small boxes, and `focus` is where Merc stands, as an
 * object-position, so the phone's square thumbnail and the desktop's wide
 * band both keep him in frame.
 */
export interface RoomCover {
  src: string
  medium: string
  small: string
  focus: string
}

export interface Room {
  id: RoomId
  title: string
  /** One line: what the room is, then what you do there. */
  line: string
  target: RoomTarget
  /**
   * The tab whose spotlight tour this room can offer, when one exists
   * (PAGE_TOURS in src/stores/app-store.ts). Absent for rooms that are
   * a separate page rather than a tab — a tour cannot spotlight
   * something the app isn't rendering.
   */
  tourTab?: ActiveTab
  /**
   * Cover art at the top of the card. Required, not optional: two rooms
   * once shipped without a picture, and a card with no picture beside
   * five that have one reads as a rendering fault rather than as a
   * different kind of room. Making it required means the next room added
   * here cannot quietly repeat that.
   */
  cover: RoomCover
}

function cover(id: RoomId, focus: string): RoomCover {
  return {
    src: `/onboarding/rooms/${id}.webp`,
    medium: `/onboarding/rooms/${id}-800.webp`,
    small: `/onboarding/rooms/${id}-560.webp`,
    focus,
  }
}

export const ROOMS: readonly Room[] = [
  {
    id: 'practice',
    title: 'Practice',
    line: 'The live singing stage — every note you sing, drawn and scored as it happens.',
    target: { kind: 'tab', tab: TAB_SINGING },
    tourTab: TAB_SINGING,
    cover: cover('practice', '26% 55%'),
  },
  {
    id: 'exercises',
    title: 'Exercises',
    // The count is real and pinned by a test — EXERCISE_HELP in
    // src/features/exercises/exercise-help.ts is keyed by every
    // ExerciseType, so adding a drill without updating this line fails.
    // It said "fourteen" through four additions before that.
    line: 'A library of eighteen short drills for range, agility, intervals and control.',
    target: { kind: 'tab', tab: TAB_EXERCISES },
    tourTab: TAB_EXERCISES,
    cover: cover('exercises', '50% 35%'),
  },
  {
    id: 'ascent',
    title: 'The Ascent',
    line: 'A seven-week guided course — one themed week at a time.',
    target: { kind: 'tab', tab: TAB_PATH },
    tourTab: TAB_PATH,
    cover: cover('ascent', '54% 45%'),
  },
  {
    id: 'karaoke',
    title: 'Karaoke',
    line: 'Your own songs turned into karaoke — the vocal split out, with lyrics and scoring.',
    target: { kind: 'page', href: '/karaoke' },
    cover: cover('karaoke', '52% 50%'),
  },
  {
    id: 'jam',
    title: 'Jam',
    line: 'A shared room for singing together in real time — send someone the code.',
    target: { kind: 'tab', tab: TAB_JAM },
    tourTab: TAB_JAM,
    cover: cover('jam', '46% 52%'),
  },
  {
    id: 'analysis',
    title: 'Analysis',
    line: 'A plain-language read of your voice — where your pitch went, how steady you held it, and what your tone is made of.',
    target: { kind: 'tab', tab: TAB_ANALYSIS },
    tourTab: TAB_ANALYSIS,
    cover: cover('analysis', '50% 45%'),
  },
]

/** Everything else, as one quiet strip under the grid. */
export interface SideDoor {
  label: string
  target: RoomTarget
}

export const SIDE_DOORS: readonly SideDoor[] = [
  { label: 'Challenges', target: { kind: 'tab', tab: 'challenges' } },
  { label: 'Leaderboard', target: { kind: 'tab', tab: 'leaderboard' } },
  { label: 'Community', target: { kind: 'tab', tab: 'community' } },
  { label: 'Compose', target: { kind: 'tab', tab: 'compose' } },
  { label: 'Guitar', target: { kind: 'tab', tab: 'guitar' } },
  { label: 'Piano', target: { kind: 'tab', tab: 'piano' } },
  { label: 'Voice Mirror', target: { kind: 'page', href: '/mirror' } },
  { label: 'Glass', target: { kind: 'page', href: '/glass' } },
]

export function roomById(id: RoomId): Room {
  const room = ROOMS.find((r) => r.id === id)
  // Every RoomId in the union has an entry above; the fallback exists
  // so a future id added to the type without a row can't throw at the
  // visitor — they just land on Practice.
  return room ?? ROOMS[0]
}
