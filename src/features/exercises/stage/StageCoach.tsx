// ============================================================
// StageCoach: Merc beside the drill's sheet, and what he says
// ============================================================
//
// One Merc for the whole visit to a drill. The shell mounts this once, above
// the sheet on a phone and beside it in a wide window, and changes only his
// pose and the words in his bubble: the drill's brief before a run, the
// instruction during one. A Merc inside each state would be unmounted and
// drawn again at every Start and every Stop.
//
// His bubble can carry a notice (StageNotice.tsx): the voice take's question
// after a run, and in the web build the app's own notices. It lies over the
// bubble while it lasts, and the bubble keeps its place under it, so nothing
// on the stage moves when it comes or goes.

import type { JSX } from 'solid-js'
import { Show } from 'solid-js'
import { MercPresence } from '@/components/room-kit/MercPresence'
import type { MercState } from '@/lib/merc/constants'
import { stillFor } from '@/lib/merc/stills'
import styles from './ExerciseStage.module.css'
import type { StageNoticeModel } from './stage-notice'
import { StageNotice } from './StageNotice'

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
  /** The notice over the bubble, or null when the bubble says its own
   *  words (stage-notice.ts `bubbleNotice` says which). */
  notice?: () => StageNoticeModel | null
  /** "Hear it first": the example's line while it is up, else null. It
   *  lies over the brief inside the bubble, which keeps the brief's size. */
  example?: () => string | null
}

export function StageCoach(props: StageCoachProps): JSX.Element {
  const size = mercSize()
  // The bubble under a notice is out of sight, and out of a screen
  // reader's way, so its words are not read twice.
  const notice = (): StageNoticeModel | null => props.notice?.() ?? null
  const covered = (): boolean => notice() !== null
  // The example's line takes the brief's place inside the bubble, and the
  // brief keeps its box under it: a line shorter than the brief used to
  // shrink the bubble and pull the sheet up for as long as it played.
  const exampleLine = (): string | null => props.example?.() ?? null
  return (
    <div class={styles.coach} data-testid="exercise-stage-coach">
      <MercPresence
        state={props.pose}
        stillSrc={stillFor(props.pose())}
        size={size}
        class={styles.merc}
        testId="exercise-stage-merc"
      />
      <div class={styles.say} data-notice-place="">
        <div class={styles.bubble} classList={{ [styles.covered]: covered() }}>
          <div class={styles.layers}>
            <div
              class={styles.layer}
              classList={{ [styles.under]: exampleLine() !== null }}
              aria-hidden={
                covered() || exampleLine() !== null ? 'true' : undefined
              }
            >
              {props.children}
            </div>
            <Show when={exampleLine()}>
              {(line) => (
                <div class={`${styles.layer} ${styles.example}`}>
                  <div class="exercise-stage-demo-line" role="status">
                    {line()}
                  </div>
                </div>
              )}
            </Show>
          </div>
        </div>
        <StageNotice notice={notice} />
      </div>
    </div>
  )
}
