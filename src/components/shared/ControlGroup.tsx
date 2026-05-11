// ============================================================
// ControlGroup - Shared control wrapper for toolbar components
// ============================================================

import type { Component } from 'solid-js'
import type { JSX } from 'solid-js/jsx-runtime'

interface ControlGroupProps {
  label?: string
  children: JSX.Element
  className?: string
}

function hasLabel(val: unknown): val is string {
  if (val == null) return false
  if (typeof val !== 'string') return false
  return true
}

export const ControlGroup: Component<ControlGroupProps> = (props) => (
  <div class={`control-group ${props.className ?? ''}`}>
    {hasLabel(props.label) && <span class="control-label">{props.label}</span>}
    {props.children}
  </div>
)
