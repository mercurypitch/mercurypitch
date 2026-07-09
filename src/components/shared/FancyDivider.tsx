import type { Component } from 'solid-js'
import styles from './FancyDivider.module.css'

interface FancyDividerProps {
  class?: string
}

export const FancyDivider: Component<FancyDividerProps> = (props) => {
  return <div class={`${styles.divider} ${props.class ?? ''}`.trim()} />
}
