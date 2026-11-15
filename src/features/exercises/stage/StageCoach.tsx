// ============================================================
// StageCoach: Merc beside the drill's sheet, and what he says
// ============================================================
//
// One Merc for the whole visit to a drill. The shell mounts this once, above
// the sheet on a phone and beside it in a wide window, and changes only his
// pose and the words in his bubble: the drill's brief before a run, the
// instruction during one. A Merc inside each state would be unmounted and
// drawn again at every Start and every Stop.

import type { JSX } from 'solid-js'
import { MercPresence } from '@/components/room-kit/MercPresence'
import type { MercState } from '@/lib/merc/constants'
import { stillFor } from '@/lib/merc/stills'
import styles from './ExerciseStage.module.css'

/** Merc's box in px: above the sheet, and in the rail beside it. */
const MERC_STRIP_PX = 56
const MERC_RAIL_PX = 112

/** The window in which the stylesheet puts the coach in a rail. */
export const STAGE_RAIL_QUERY = '(min-width: 1440px)'

/**
 * His size is chosen once, when the drill opens, as MercPresence chooses
 * whether he is drawn live: a window dragged across the rail's width keeps
 * the Merc it opened with.
 */
function mercSize(): number {
  if (typeof window === 'undefined') return MERC_STRIP_PX
  // jsdom has no matchMedia, and neither does a browser old enough.
  if (typeof window.matchMedia !== 'function') return MERC_STRIP_PX
  return window.matchMedia(STAGE_RAIL_QUERY).matches
    ? MERC_RAIL_PX
    : MERC_STRIP_PX
}

export interface StageCoachProps {
  /** His pose, read as it changes. */
  pose: () => MercState
  /** What he says: the brief, or the run's instruction. */
  children: JSX.Element
}

export function StageCoach(props: StageCoachProps): JSX.Element {
  const size = mercSize()
  return (
    <div class={styles.coach} data-testid="exercise-stage-coach">
      <MercPresence
        state={props.pose}
        stillSrc={stillFor(props.pose())}
        size={size}
        class={styles.merc}
        testId="exercise-stage-merc"
      />
      <div class={styles.bubble}>{props.children}</div>
    </div>
  )
}
