// MixerRail lays the playback rail out: one glass bar, three areas.
// ============================================================
//
//   [ left: the controls ] [ time: elapsed ---- track ---- total ] [ right ]
//
// The capsule draws the two ends (MixerCapsule's left and right parts, each
// naming its own grid area) and the timeline sits between them, so one row
// holds everything while the timeline keeps its room. Short of width the
// timeline takes a line of its own under the controls (CSS, by container
// query on the rail), and the speed chip folds into More (rail-fold.ts, by
// the width this reports through `onWidth`).
//
// The rail is the bar: inside the focus pill, which draws its own glass,
// `bare` drops it. Docked to a side edge, `vertical` stacks the parts and
// leaves the timeline out, as the side docks always have.

import type { Component, JSX } from 'solid-js'
import { onCleanup, onMount, Show } from 'solid-js'
import styles from './MixerRail.module.css'

export interface MixerRailProps {
  capsule: JSX.Element
  timeline: JSX.Element
  /** Stacked for a side dock, without the timeline. */
  vertical?: boolean
  /** No bar of its own, inside a host that draws one (the focus pill). */
  bare?: boolean
  /** Speed is in More: the rail says so for the tests and the styles. */
  speedFolded?: boolean
  /** The rail's own width, each time it changes. */
  onWidth?: (widthPx: number) => void
}

export const MixerRail: Component<MixerRailProps> = (props) => {
  let rail: HTMLDivElement | undefined

  onMount(() => {
    const report = props.onWidth
    if (rail === undefined || report === undefined) return
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver((entries) => {
      const entry = entries[entries.length - 1]
      if (entry !== undefined) report(entry.contentRect.width)
    })
    observer.observe(rail)
    onCleanup(() => observer.disconnect())
  })

  return (
    <div
      ref={rail}
      class={styles.rail}
      data-testid="mixer-rail"
      data-vertical={props.vertical === true ? 'true' : 'false'}
      data-bare={props.bare === true ? 'true' : 'false'}
      data-speed-folded={props.speedFolded === true ? 'true' : 'false'}
    >
      <div class={styles.grid}>
        {props.capsule}
        <Show when={props.vertical !== true}>
          <div class={styles.timeline}>{props.timeline}</div>
        </Show>
      </div>
    </div>
  )
}
