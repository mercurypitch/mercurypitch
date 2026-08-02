// ============================================================
// Mic Troubleshooting — compact recovery guide for unreliable input
// ============================================================
//
// Browsers expose hard capture failures, but not reliable ownership data when
// another tab is allowed to share a microphone. This keeps that limitation and
// the practical recovery steps next to the place where a singer starts a run.

import { Mic } from '@/components/icons'
import styles from './MicTroubleshooting.module.css'

export function MicTroubleshooting() {
  return (
    <details class={styles.root}>
      <summary class={styles.summary}>
        <Mic />
        <span>Mic not behaving?</span>
      </summary>
      <div class={styles.body}>
        <p>
          A browser can report a blocked mic, but it cannot always tell when
          another tab is sharing it and degrading the input.
        </p>
        <ol>
          <li>
            Close other MercuryPitch tabs and any recording or meeting apps.
          </li>
          <li>
            Turn the mic off and on again so MercuryPitch opens a fresh input.
          </li>
          <li>
            Confirm the intended input in browser or system sound settings, then
            adjust hardware gain if the signal is weak or distorted.
          </li>
        </ol>
      </div>
    </details>
  )
}
