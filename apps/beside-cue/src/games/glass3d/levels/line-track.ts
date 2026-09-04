// The Sorting Line's path: the same rules as the chambers', own key.
// ============================================================

import { LINES } from './lines'
import { createTrack } from './track'

export const LINE_TRACK_KEY = 'beside-cue:games:line-track'

export const lineTrack = createTrack(LINES, LINE_TRACK_KEY)
