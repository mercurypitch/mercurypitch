// ============================================================
// KeepView: the stage under Keep (S7b beat 7), and under the Cloud offer
// ============================================================
//
// Beat 7 is Keep, the account offer, and Keep is the shell's own sheet
// (AccountOffer.tsx), opened over this layer rather than drawn a second
// time in it. Behind the sheet the stage stays: Merc on his lit spot, at
// the top of the stage, so he stands over the sheet where there is room
// and only his feet go behind it where there is not (the probe measures
// it), with nothing to say (the sheet says it) and nothing in reach. The
// layer goes on once Keep and whatever it handed over to have closed
// (NativeOnboarding.tsx). Beat 9, the Cloud offer, is the shell's own sheet
// as well, and stands over this same stage, empty: Merc goes with the
// offer, small by its art (CloudOffer.tsx).

import type { JSX } from 'solid-js'
import { Show } from 'solid-js'
import styles from './NativeOnboarding.module.css'

export interface KeepViewProps {
  /** Merc: the layer's own view of him. None under the Cloud offer. */
  merc?: JSX.Element
  /**
   * The beat's test id: Keep's, or the Cloud offer's (beat 9), which
   * stands under its sheet the same way.
   */
  testId?: string
}

export function KeepView(props: KeepViewProps): JSX.Element {
  return (
    <div
      class={styles.beat}
      inert={true}
      data-testid={props.testId ?? 'onboarding-keep'}
    >
      <div class={`${styles.stage} ${styles.keepStage}`}>
        <Show when={props.merc}>
          <div class={styles.merc}>{props.merc}</div>
        </Show>
      </div>
    </div>
  )
}
