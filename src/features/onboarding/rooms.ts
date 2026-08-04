// ============================================================
// First Light — the Map's rooms (data, not code)
// ============================================================
//
// What a new singer can actually do here, in the order we want them
// to meet it. Deliberately a flat list: the Map grid is auto-fit, so
// adding the two Home cards from PR #359 (Jam Rooms, Hear Yourself)
// is a data change here and nothing else.
//
// The verb-led line is the whole point — "See every note as you sing
// it" tells someone what happens; "Practice Engine" does not.

import type { DestinationVisual } from '@/features/home/DestinationGallery'
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

export interface Room {
  id: RoomId
  title: string
  /** One verb-led line: what happens when you go there. */
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
   * Cover artwork revealed behind the card. Required, not optional: two
   * rooms shipped without it (Jam, which had art on Home all along, and
   * the Ascent, which had none anywhere), and a card with no picture
   * beside five that have one reads as a rendering fault rather than as
   * a different kind of room. Making it required means the next room
   * added here cannot quietly repeat that.
   */
  visual: DestinationVisual
}

export const ROOMS: readonly Room[] = [
  {
    id: 'practice',
    title: 'Practice',
    line: 'See every note as you sing it, with per-note accuracy.',
    target: { kind: 'tab', tab: TAB_SINGING },
    tourTab: TAB_SINGING,
    visual: 'practice',
  },
  {
    id: 'exercises',
    title: 'Exercises',
    line: 'Fourteen drills for range, agility, intervals and control.',
    target: { kind: 'tab', tab: TAB_EXERCISES },
    tourTab: TAB_EXERCISES,
    visual: 'exercises',
  },
  {
    id: 'ascent',
    title: 'The Ascent',
    line: 'A seven-week guided path — one orb at a time.',
    target: { kind: 'tab', tab: TAB_PATH },
    tourTab: TAB_PATH,
    visual: 'ascent',
  },
  {
    id: 'karaoke',
    title: 'Karaoke',
    line: 'Load any song, split the vocal out, and sing it with lyrics and scoring.',
    target: { kind: 'page', href: '/karaoke' },
    visual: 'karaoke',
  },
  {
    id: 'jam',
    title: 'Jam',
    line: 'Sing together in real time — share a room code.',
    target: { kind: 'tab', tab: TAB_JAM },
    tourTab: TAB_JAM,
    visual: 'jam',
  },
  {
    id: 'analysis',
    title: 'Analysis',
    line: 'Pitch traces, harmonics and consistency, in plain language.',
    target: { kind: 'tab', tab: TAB_ANALYSIS },
    tourTab: TAB_ANALYSIS,
    visual: 'analysis',
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
