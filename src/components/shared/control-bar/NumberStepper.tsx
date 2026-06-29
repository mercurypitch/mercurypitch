// ============================================================
// NumberStepper — neutral, theme-coloured up/down stepper that replaces the
// native (blue) number spinner. Pair it with a bare <input type=number>
// (which keeps keyboard stepping) inside a flex `.numWrap` on the host bar.
// ============================================================

import { Caret } from './icons'
import styles from './NumberStepper.module.css'

export const NumberStepper = (p: {
  value: () => number
  min: number
  max: number
  onChange: (v: number) => void
}) => (
  <div class={styles.stepper}>
    <button
      type="button"
      class={styles.stepBtn}
      tabindex="-1"
      aria-label="Increase"
      onClick={() => p.onChange(Math.min(p.max, p.value() + 1))}
    >
      <Caret up />
    </button>
    <button
      type="button"
      class={styles.stepBtn}
      tabindex="-1"
      aria-label="Decrease"
      onClick={() => p.onChange(Math.max(p.min, p.value() - 1))}
    >
      <Caret />
    </button>
  </div>
)
