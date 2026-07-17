// ============================================================
// PasswordRequirements — subtle live checklist under a new-password
// field. Each requirement ticks green as it's met; unmet ones only turn
// red once the field has been touched (showInvalid), so the empty form
// never opens with a wall of red. Styled with theme-var fallbacks so it
// works in the settings shell and on the standalone Karaoke Night page.
// ============================================================

import type { Component } from 'solid-js'
import { For } from 'solid-js'
import { PASSWORD_REQUIREMENTS } from '@/lib/password-policy'
import styles from './PasswordRequirements.module.css'

interface PasswordRequirementsProps {
  password: string
  /** Highlight unmet requirements in red (field touched / submit tried). */
  showInvalid: boolean
}

export const PasswordRequirements: Component<PasswordRequirementsProps> = (
  props,
) => {
  return (
    <ul class={styles.list} aria-live="polite">
      <For each={PASSWORD_REQUIREMENTS}>
        {(req) => (
          <li
            classList={{
              [styles.item]: true,
              [styles.met]: req.test(props.password),
              [styles.unmet]: !req.test(props.password) && props.showInvalid,
            }}
          >
            <svg
              viewBox="0 0 24 24"
              width="11"
              height="11"
              aria-hidden="true"
              fill="none"
              stroke="currentColor"
              stroke-width="3"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M20 6L9 17l-5-5" />
            </svg>
            {req.label}
          </li>
        )}
      </For>
    </ul>
  )
}
