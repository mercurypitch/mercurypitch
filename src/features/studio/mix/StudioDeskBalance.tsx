// ============================================================
// Studio desk balance — Auto-balance beside Reset sound in the master heading
// ============================================================
//
// The Sound panel's Auto-balance, run from the desk: the same controller, so
// the same measurement, command and undo step. While it runs, the two
// buttons give way to its progress and a Cancel. How it ended shows for a few
// seconds in the pill beside "Master", where "Adjusted" otherwise sits; the
// Sound panel keeps the longer explanation.
import { createEffect, createSignal, on, onCleanup, Show } from 'solid-js'
import type { StudioCommand } from '@/lib/studio/model/commands'
import type { StudioProject } from '@/lib/studio/model/types'
import { runStudioPanelAction } from '../export/action-focus'
import { studioSoundAdjusted } from '../sound/StudioFlavourChoices'
import type { StudioBalanceOutcome } from '../sound/useStudioSound'
import common from '../StudioPage.module.css'
import styles from './StudioMixDesk.module.css'

/** What the desk reads from the Sound panel's Auto-balance controller. */
export interface StudioDeskBalanceSource {
  busy(): boolean
  cancelling(): boolean
  progress(): { completed: number; total: number } | null
  outcome(): { kind: StudioBalanceOutcome } | null
  autoBalance(): Promise<boolean>
  cancel(): void
}

interface StudioDeskBalanceProps {
  project: StudioProject
  writable: boolean
  /** Without one, the heading offers Reset sound alone. */
  balance?: StudioDeskBalanceSource
  onCommand(command: StudioCommand): boolean
}

const OUTCOME_WORDS: Record<StudioBalanceOutcome, string> = {
  applied: 'Balanced',
  nothing: 'Nothing to balance',
  cancelled: 'Balance cancelled',
}
/** How long the outcome pill stays before "Adjusted" returns. */
export const STUDIO_DESK_OUTCOME_MS = 5000

export function StudioDeskBalance(props: StudioDeskBalanceProps) {
  const [said, setSaid] = createSignal<StudioBalanceOutcome | null>(null)
  let timer: ReturnType<typeof setTimeout> | undefined
  createEffect(
    on(
      () => props.balance?.outcome(),
      (outcome) => {
        clearTimeout(timer)
        setSaid(outcome?.kind ?? null)
        if (outcome)
          timer = setTimeout(() => setSaid(null), STUDIO_DESK_OUTCOME_MS)
      },
      { defer: true },
    ),
  )
  onCleanup(() => clearTimeout(timer))
  const busy = () => props.balance?.busy() === true
  const progress = () => {
    const balance = props.balance
    if (balance?.cancelling() === true) return 'Stopping…'
    const done = balance?.progress()
    return done ? `Balancing ${done.completed} of ${done.total}` : 'Preparing…'
  }

  return (
    <>
      <Show
        when={said()}
        fallback={
          <Show when={studioSoundAdjusted(props.project)}>
            <span class={styles.adjusted}>Adjusted</span>
          </Show>
        }
      >
        {(kind) => (
          <span class={styles.outcome} role="status">
            {OUTCOME_WORDS[kind()]}
          </span>
        )}
      </Show>
      <div class={styles.masterActions} data-studio-finishing-actions>
        <Show
          when={busy()}
          fallback={
            <>
              <Show when={props.balance}>
                {(balance) => (
                  <button
                    type="button"
                    class={common.textButton}
                    data-studio-finishing-action
                    disabled={
                      !props.writable || props.project.clips.length === 0
                    }
                    title="Even out the audible lanes. Volume and pan stay as they are."
                    onClick={(event) =>
                      void runStudioPanelAction(
                        event.currentTarget,
                        balance().autoBalance,
                      )
                    }
                  >
                    Auto-balance
                  </button>
                )}
              </Show>
              <button
                type="button"
                class={common.textButton}
                disabled={!props.writable}
                onClick={() =>
                  props.onCommand({
                    type: 'set-sound-flavour',
                    flavourId: 'natural',
                  })
                }
              >
                Reset sound
              </button>
            </>
          }
        >
          <span class={styles.balanceStatus} role="status">
            {progress()}
          </span>
          <button
            type="button"
            class={common.textButton}
            data-studio-finishing-action
            aria-label="Cancel Auto-balance"
            disabled={props.balance?.cancelling() === true}
            onClick={() => props.balance?.cancel()}
          >
            Cancel
          </button>
        </Show>
      </div>
    </>
  )
}
