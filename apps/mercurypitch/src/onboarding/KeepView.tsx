// ============================================================
// KeepView: the stage under Keep (S7b beat 7)
// ============================================================
//
// Beat 7 is Keep, the account offer, and Keep is the shell's own sheet
// (AccountOffer.tsx), opened over this layer rather than drawn a second
// time in it. Behind the sheet the stage stays: Merc on his lit spot, at
// the top of the stage, so he stands over the sheet where there is room
// and only his feet go behind it where there is not (the probe measures
// it), with nothing to say (the sheet says it) and nothing in reach. The
// layer goes once Keep and whatever it handed over to have closed
// (NativeOnboarding.tsx).

import type { JSX } from 'solid-js'
import styles from './NativeOnboarding.module.css'

export interface KeepViewProps {
  /** Merc: the layer's own view of him. */
  merc: JSX.Element
}

export function KeepView(props: KeepViewProps): JSX.Element {
  return (
    <div class={styles.beat} inert={true} data-testid="onboarding-keep">
      <div class={`${styles.stage} ${styles.keepStage}`}>
        <div class={styles.merc}>{props.merc}</div>
      </div>
    </div>
  )
}
