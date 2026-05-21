import type { Component } from 'solid-js'

interface FancyDividerProps {
  class?: string
}

export const FancyDivider: Component<FancyDividerProps> = (props) => {
  return <div class={`fancy-divider ${props.class ?? ''}`.trim()} />
}
