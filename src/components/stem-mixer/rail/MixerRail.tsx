// MixerRail lays the capsule and the timeline out as one wrapping row.
// ============================================================
//
// The Jam song room's rule: the capsule never wraps or squeezes, and the
// timeline beside it keeps at least 380 px or drops to a line of its own,
// where it takes the full width. The old rail let the controls take what
// they wanted and gave the timeline the rest, which at 1024 px was nothing.
//
// The rail is the container the capsule's size queries read, so the
// capsule tightens when the rail is short of width, wherever the rail is
// drawn. A rail sized by its content (the focus pill, which is as wide as
// what is in it) passes `fit`: a size container cannot take its width from
// its content. Docked to a side edge, `vertical` stacks the capsule and
// leaves the timeline out, as the side docks always have.

import type { Component, JSX } from 'solid-js'
import { Show } from 'solid-js'
import styles from './MixerRail.module.css'

export interface MixerRailProps {
  capsule: JSX.Element
  timeline: JSX.Element
  /** Stacked for a side dock, without the timeline. */
  vertical?: boolean
  /** As wide as its content, rather than as wide as its host. */
  fit?: boolean
}

export const MixerRail: Component<MixerRailProps> = (props) => (
  <div
    class={styles.rail}
    data-testid="mixer-rail"
    data-vertical={props.vertical === true ? 'true' : 'false'}
    data-fit={props.fit === true ? 'true' : 'false'}
  >
    {props.capsule}
    <Show when={props.vertical !== true}>
      <div class={styles.timeline}>{props.timeline}</div>
    </Show>
  </div>
)
