// Games selection — shared entry and control discriminants for the list and its stage routers.

import type { LevelDef } from '@/games/glass/levels/types'
import type { CreatorPreviewPick } from './CreatorPreviewCards'

export type LevelControl = 'flow' | 'platformer' | 'rhythm' | 'listen'

export type PlayPick =
  | CreatorPreviewPick
  | 'adventure'
  | 'promenade'
  | 'thawing-song'
  | 'journey'
  | 'trials'
  | 'cabinet3d'
  | 'hallway3d'
  /** The Standing Wave: one path through every chamber. */
  | 'chambers'
  /** The Sorting Line: the voice shapes Merc, and the room is inert. */
  | 'line'
  /** The Top Shelf: the gap between two notes is how high Merc leaps. */
  | 'shelf'
  | { level: LevelDef; control: LevelControl }
  | null
