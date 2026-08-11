// Nonfatal input-route changes stay visible without hiding health or calibration.
// ============================================================

import type { Accessor } from 'solid-js'
import { Show } from 'solid-js'
import styles from './GuitarNightApp.module.css'

interface GuitarNightInputNoticeProps {
  message: Accessor<string | null>
  floating?: boolean
}

export function GuitarNightInputNotice(props: GuitarNightInputNoticeProps) {
  return (
    <Show when={props.message()}>
      {(message) => (
        <p
          classList={{
            [styles.inputNotice]: true,
            [styles.inputNoticeFloating]: props.floating === true,
          }}
          role="status"
          aria-atomic="true"
        >
          {message()}
        </p>
      )}
    </Show>
  )
}
