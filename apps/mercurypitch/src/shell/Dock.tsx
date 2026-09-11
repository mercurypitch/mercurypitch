// ============================================================
// Dock — the one fixed thing at the bottom
// ============================================================
//
// The frame: an accessory slot for the session pill, and below it one band
// the rail and the transport swap inside. The band's height is fixed and
// both layers live in the same grid cell, which is what makes the swap a
// transform and an opacity rather than an animated height — the canvas above
// does not move when a run starts.
//
// The dock is portalled to <body> by the shell. `.main-content` keeps
// reserving `--tabbar-total` for it, exactly as it does for the web bar.

import type { Component, JSX } from 'solid-js'
import { Show } from 'solid-js'

export interface DockProps {
  railIn: () => boolean
  transportIn: () => boolean
  rail: JSX.Element
  transport: JSX.Element
  accessory?: JSX.Element
}

export const Dock: Component<DockProps> = (props) => (
  <div class="mp-dock" data-testid="shell-dock">
    <Show when={props.accessory}>
      <div class="mp-dock__accessory">{props.accessory}</div>
    </Show>
    <div class="mp-band">
      <div
        class="mp-layer mp-layer--transport"
        classList={{ 'is-in': props.transportIn() }}
        data-testid="shell-transport-layer"
      >
        {props.transport}
      </div>
      <div
        class="mp-layer mp-layer--rail"
        classList={{ 'is-in': props.railIn() }}
        data-testid="shell-rail-layer"
      >
        {props.rail}
      </div>
    </div>
  </div>
)
