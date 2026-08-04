// ============================================================
// Mic Troubleshooting — compact recovery guide for unreliable input
// ============================================================
//
// Browsers expose hard capture failures, but not reliable ownership data when
// another tab is allowed to share a microphone. This keeps that limitation and
// the practical recovery steps next to the place where a singer starts a run.

import { Show } from 'solid-js'
import { Mic } from '@/components/icons'
import { micActive } from '@/stores/mic-store'
import { MicLevelMeter } from './MicLevelMeter'
import styles from './MicTroubleshooting.module.css'

export function MicTroubleshooting() {
  return (
    <details class={styles.root}>
      <summary class={styles.summary}>
        <Mic />
        <span>Mic not behaving?</span>
      </summary>
      <div class={styles.body}>
        {/* The meter answers the first question the steps below can only guess
            at: is anything arriving at all. Armed, because opening this panel
            means something is already wrong. */}
        <Show
          when={micActive()}
          fallback={
            <p>Turn the mic on to see what is reaching MercuryPitch.</p>
          }
        >
          <MicLevelMeter label="What we're hearing" armed />
        </Show>
        <p>
          A browser can report a blocked mic, but it cannot always tell when
          another app is sharing it and degrading the input.
        </p>
        <ol>
          <li>
            Close any recording or meeting apps. Another MercuryPitch tab is
            handled for you — it will offer to move the mic here.
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
