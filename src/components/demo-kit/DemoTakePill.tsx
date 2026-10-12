// ============================================================
// DemoTakePill: "Not like this" and "Like this", under the demo's takes
// ============================================================
//
// While a demo sings, its pill says which take this is: take 1 the way not
// to sing it, take 2 the way to. The slot keeps its height between the
// takes, so nothing under it moves when the pill turns. The room places it
// and gives it its words.

import type { JSX } from 'solid-js'
import { Show } from 'solid-js'
import { CheckSmall, X } from '@/components/icons'
import type { DemoTakeId } from './demo-plan'
import styles from './DemoTakePill.module.css'

export interface DemoTakePillProps {
  /** The take being sung; null shows the empty slot. */
  take: DemoTakeId | null
  copy: { readonly off: string; readonly on: string }
  testId: string
}

export function DemoTakePill(props: DemoTakePillProps): JSX.Element {
  return (
    <div class={styles.takeSlot}>
      <Show when={props.take}>
        {(take) => (
          <span
            class={styles.take}
            data-take={take()}
            data-testid={props.testId}
          >
            {take() === 'off' ? <X /> : <CheckSmall size={16} />}
            {take() === 'off' ? props.copy.off : props.copy.on}
          </span>
        )}
      </Show>
    </div>
  )
}
