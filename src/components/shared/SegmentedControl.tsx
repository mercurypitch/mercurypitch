import type { JSX } from 'solid-js'
import { For } from 'solid-js'
import styles from './SegmentedControl.module.css'

export interface SegmentedControlOption<T extends string> {
  value: T
  label: JSX.Element
  icon?: JSX.Element
  title?: string
  dataTestId?: string
  dataTour?: string
  disabled?: boolean
}

interface SegmentedControlProps<T extends string> {
  options: SegmentedControlOption<T>[]
  value: T
  onChange: (value: T) => void
  disabled?: boolean
  class?: string
  grow?: boolean
  ariaLabel?: string
  dataTestId?: string
}

export function SegmentedControl<T extends string>(
  props: SegmentedControlProps<T>,
) {
  return (
    <div
      class={`${styles.segmentedControl} ${props.class !== undefined ? props.class : ''}`}
      role="group"
      aria-label={props.ariaLabel}
      data-testid={props.dataTestId}
    >
      <For each={props.options}>
        {(option) => (
          <button
            class={styles.segmentBtn}
            classList={{ [styles.active]: props.value === option.value }}
            onClick={() => props.onChange(option.value)}
            disabled={props.disabled}
            type="button"
            title={option.title}
            data-testid={option.dataTestId}
          >
            {option.icon}
            {option.label}
          </button>
        )}
      </For>
    </div>
  )
}
