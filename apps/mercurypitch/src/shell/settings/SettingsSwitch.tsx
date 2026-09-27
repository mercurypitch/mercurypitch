// ============================================================
// SettingsSwitch — the kit's toggle, as a row's accessory
// ============================================================
//
// A real button with role="switch", so a screen reader says "on" and "off"
// and a tap anywhere on the pill flips it. It sits in a SettingsRow's
// accessory slot, which keeps the row itself from being a second button.

import type { JSX } from 'solid-js'

export interface SettingsSwitchProps {
  checked: boolean
  /** The row's label: a switch is named by what it switches. */
  label: string
  onChange: (next: boolean) => void
  disabled?: boolean
  testId?: string
}

export function SettingsSwitch(props: SettingsSwitchProps): JSX.Element {
  return (
    <button
      type="button"
      role="switch"
      class="mp-switch"
      aria-checked={props.checked ? 'true' : 'false'}
      aria-label={props.label}
      disabled={props.disabled}
      data-testid={props.testId}
      onClick={() => props.onChange(!props.checked)}
    >
      <span class="mp-switch__knob" />
    </button>
  )
}
