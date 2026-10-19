// ============================================================
// WithoutMic: the one way on from a mic that will not open
// ============================================================
//
// Under the mic's notice and its Try again, on any beat that listens: a
// refused mic, or one that would not open, goes on in one tap to the
// onboarding's landing (REQ-NFL-043), with no offer of either kind (S7b
// E5). The web's words for the same way on (BeatFirstLight.tsx). Nothing
// for the range on its own, whose Not now goes back to Keep.

import type { JSX } from 'solid-js'
import { Show } from 'solid-js'
import styles from './NativeOnboarding.module.css'
import { ONBOARDING_COPY } from './onboarding-copy'

export function WithoutMic(props: { onWithoutMic?: () => void }): JSX.Element {
  return (
    <Show when={props.onWithoutMic}>
      {(onward) => (
        <button
          type="button"
          class={styles.secondary}
          onClick={() => onward()()}
          data-testid="onboarding-without-mic"
        >
          {ONBOARDING_COPY.withoutMic}
        </button>
      )}
    </Show>
  )
}
