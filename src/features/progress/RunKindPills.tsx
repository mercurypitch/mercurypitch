// ============================================================
// Run-kind pills — the same four colours on every screen that counts
// ============================================================
//
// A colour teaches nothing unless it means the same thing everywhere, so
// this component is the only thing that draws a run count. The Progress
// card, the profile and the community runs list all render it, and the Learn
// guide names the same four colours in the same order.

import type { Component } from 'solid-js'
import { For, Show } from 'solid-js'
import { Info } from '@/components/icons'
import type { ProgressRun, RunKind } from './run-kinds'
import { countRunsByKind, runKindMeta } from './run-kinds'
import styles from './RunKindPills.module.css'

const TONE_CLASS: Record<string, string> = {
  practice: styles.tonePractice,
  exercise: styles.toneExercise,
  challenge: styles.toneChallenge,
  weekly: styles.toneWeekly,
}

/**
 * Where a set of numbers came from, said out loud.
 *
 * "0 on this device" and "0 on your account" are different claims, and
 * showing the number without saying which one it was is what let somebody
 * with forty recorded runs believe the app had lost them.
 */
export const SCOPE_NOTE: Record<'account' | 'device', string> = {
  account: 'Counted across your account, on every device you sign in on.',
  device: 'Counted on this device only. Sign in to count them everywhere.',
}

export const RunKindPills: Component<{
  runs: readonly ProgressRun[]
  scope?: 'account' | 'device'
  /** Omitted where the surface has no room to open a modal. */
  onExplain?: () => void
}> = (props) => {
  const counts = () => countRunsByKind(props.runs)

  return (
    <div>
      <ul class={styles.row}>
        <For each={counts()}>
          {(entry) => (
            <li
              class={`${styles.pill} ${TONE_CLASS[entry.meta.tone]}`}
              classList={{ [styles.empty]: entry.count === 0 }}
            >
              <span class={styles.count}>{entry.count}</span>
              <span class={styles.label}>{entry.meta.label}</span>
            </li>
          )}
        </For>
        <Show when={props.onExplain}>
          {(explain) => (
            <li>
              <button
                type="button"
                class={styles.explainButton}
                onClick={() => explain()()}
              >
                <span class={styles.explainIcon} aria-hidden="true">
                  <Info size={14} />
                </span>
                What counts here?
              </button>
            </li>
          )}
        </Show>
      </ul>
      <Show when={props.scope}>
        {(scope) => <p class={styles.scope}>{SCOPE_NOTE[scope()]}</p>}
      </Show>
    </div>
  )
}

/**
 * A single run's kind, named and coloured — for lists that show one run per
 * row and so have no count to put in a pill.
 *
 * Same tones as `RunKindPills` because they are the same idea: what a colour
 * means has to survive the walk from the Progress card to the share picker.
 */
export const RunKindChip: Component<{ kind: RunKind }> = (props) => {
  const meta = () => runKindMeta(props.kind)

  return (
    <span class={`${styles.chip} ${TONE_CLASS[meta().tone]}`}>
      <span class={styles.chipDot} aria-hidden="true" />
      {meta().label}
    </span>
  )
}
