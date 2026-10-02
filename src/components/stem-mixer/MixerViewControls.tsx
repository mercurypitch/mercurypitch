// MixerViewControls is the mixer header's layout switch and sidebar toggle.
// ============================================================
//
// How the workspace is laid out is a view setting, chosen once and left,
// so it sits in the header beside Zen and Focus rather than in the playback
// rail, where the timeline needs the room.
//
// The sidebar toggle only exists in the fixed two-column layout, the one
// layout with a sidebar to hide.
//
// Focus mode hides the header. The rail's More menu offers the same layouts
// and the same sidebar switch there (StemMixerTransport), named from
// MIXER_LAYOUTS and driven by the same props object.

import type { Component, JSX } from 'solid-js'
import { For, Show } from 'solid-js'
import { SlidersHorizontal } from '@/components/icons'
import styles from './MixerViewControls.module.css'

/** The mixer's workspace layouts (useStemMixerLayoutController). */
export type MixerLayout =
  | 'auto-1col'
  | 'auto-2col'
  | 'fixed-2col'
  | 'performance'

export interface MixerViewControlsProps {
  layout: MixerLayout
  onLayoutChange: (layout: MixerLayout) => void
  sidebarHidden: boolean
  onToggleSidebar: () => void
}

const SingleColumnIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <rect x="4" y="4" width="16" height="16" rx="1" fill="currentColor" />
  </svg>
)

const TwoColumnsIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <rect x="3" y="4" width="8" height="16" rx="1" fill="currentColor" />
    <rect x="13" y="4" width="8" height="16" rx="1" fill="currentColor" />
  </svg>
)

const FixedColumnsIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <rect x="2" y="3" width="8" height="18" rx="1" fill="currentColor" />
    <rect
      x="12"
      y="3"
      width="10"
      height="18"
      rx="1"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
    />
  </svg>
)

const PerformanceIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <rect x="2" y="3" width="14" height="18" rx="1" fill="currentColor" />
    <rect
      x="18"
      y="3"
      width="4"
      height="18"
      rx="1"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
    />
  </svg>
)

/** The four layouts, in the order and the words both places offer them. */
export const MIXER_LAYOUTS: readonly {
  layout: MixerLayout
  label: string
  icon: () => JSX.Element
  tour?: string
}[] = [
  { layout: 'auto-1col', label: 'Single column', icon: SingleColumnIcon },
  { layout: 'auto-2col', label: 'Two columns auto', icon: TwoColumnsIcon },
  {
    layout: 'fixed-2col',
    label: 'Two columns fixed',
    icon: FixedColumnsIcon,
    // The tour switches to this layout first: several of its targets only
    // exist there.
    tour: 'mixer.layout-fixed',
  },
  {
    layout: 'performance',
    label: 'Performance: big centered lyrics',
    icon: PerformanceIcon,
  },
]

export const MixerViewControls: Component<MixerViewControlsProps> = (props) => {
  const sidebarLabel = () =>
    props.sidebarHidden ? 'Show mixer sidebar' : 'Hide mixer sidebar'

  return (
    <div class={styles.viewControls}>
      <div class={styles.layouts} role="group" aria-label="Mixer layout">
        <For each={MIXER_LAYOUTS}>
          {(option) => (
            <button
              type="button"
              class={styles.layoutBtn}
              data-tour={option.tour}
              aria-pressed={props.layout === option.layout}
              aria-label={option.label}
              title={option.label}
              onClick={() => props.onLayoutChange(option.layout)}
            >
              {option.icon()}
            </button>
          )}
        </For>
      </div>
      <Show when={props.layout === 'fixed-2col'}>
        <button
          type="button"
          class={styles.sidebarBtn}
          classList={{ [styles.sidebarBtnOn!]: !props.sidebarHidden }}
          aria-label={sidebarLabel()}
          title={sidebarLabel()}
          onClick={() => props.onToggleSidebar()}
        >
          <SlidersHorizontal />
        </button>
      </Show>
    </div>
  )
}
