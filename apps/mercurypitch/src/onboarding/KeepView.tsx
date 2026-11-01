// ============================================================
// KeepView: the stage under Keep (S7b beat 7), and under the Cloud offer
// ============================================================
//
// Beat 7 is Keep, the account offer, and Keep is the shell's own sheet
// (AccountOffer.tsx), opened over this layer rather than drawn a second
// time in it. Behind the sheet the stage stays, empty: nothing to say (the
// sheet says it) and nothing in reach. Merc steps out while the sheet is
// up, and is back on the next beat: standing over the sheet he showed
// through its backdrop as a large blurred smudge, and on a short phone he
// was behind it altogether. The layer goes on once Keep and whatever it
// handed over to have closed (NativeOnboarding.tsx). Beat 9, the Cloud
// offer, is the shell's own sheet as well, and stands over this same
// stage: Merc goes with the offer, small by its art (CloudOffer.tsx).

import type { JSX } from 'solid-js'
import styles from './NativeOnboarding.module.css'

export interface KeepViewProps {
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
      <div class={`${styles.stage} ${styles.keepStage}`} />
    </div>
  )
}
