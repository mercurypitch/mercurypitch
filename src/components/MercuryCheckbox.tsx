// The branded checkbox. See MercuryCheckbox.module.css for why it uses fixed
// brand colours rather than the active theme's accent.
import type { JSX } from 'solid-js'
import styles from './MercuryCheckbox.module.css'

export function MercuryCheckbox(props: {
  checked: boolean
  onChange: (checked: boolean) => void
  children: JSX.Element
  id?: string
  disabled?: boolean
  /**
   * Where the box sits against a label of more than one line. Centred
   * reads best beside a short phrase and badly beside a sentence, which
   * is what consent copy tends to be.
   */
  align?: 'center' | 'start'
  testId?: string
}): JSX.Element {
  return (
    <label
      class={styles.wrap}
      classList={{ [styles.alignStart]: props.align === 'start' }}
    >
      <input
        type="checkbox"
        id={props.id}
        checked={props.checked}
        disabled={props.disabled}
        data-testid={props.testId}
        onChange={(event) => props.onChange(event.currentTarget.checked)}
      />
      <span class={styles.box} aria-hidden="true">
        <svg class={styles.tick} viewBox="0 0 20 20" fill="none">
          <path
            d="M5.4 10.3l3.1 3.1 6.1-6.6"
            stroke="#fff"
            stroke-width="2.2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </span>
      <span class={styles.label}>{props.children}</span>
    </label>
  )
}
