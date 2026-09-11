// The Top Shelf's path: the same rules as the chambers' and the Line's,
// its own key.
// ============================================================

import { SHELVES } from './shelf'
import { createTrack } from './track'

export const SHELF_TRACK_KEY = 'beside-cue:games:shelf-track'

export const shelfTrack = createTrack(SHELVES, SHELF_TRACK_KEY)
