// The mixer's workspace layouts and its sidebar switch, as data and rows.
// ============================================================
//
// How the workspace is laid out is a view setting, chosen once and left, so
// the header holds it in one Layout menu (MixerHeader) rather than four
// buttons, beside a sidebar toggle that only the fixed two-column layout has.
//
// Focus mode hides the header. The rail's More menu offers the same rows
// there (StemMixerTransport), built here from MIXER_LAYOUTS and driven by
// the same props object.

import type { JSX } from 'solid-js'
import { CheckSmall } from '@/components/icons'
import type { OverflowMenuItem } from '@/components/OverflowMenu'

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

const tick = (on: boolean) => (on ? <CheckSmall size={16} /> : null)

/** The four layouts, in the order and the words both places offer them. */
export const MIXER_LAYOUTS: readonly {
  layout: MixerLayout
  label: string
  icon: () => JSX.Element
}[] = [
  { layout: 'auto-1col', label: 'Single column', icon: SingleColumnIcon },
  { layout: 'auto-2col', label: 'Two columns auto', icon: TwoColumnsIcon },
  { layout: 'fixed-2col', label: 'Two columns fixed', icon: FixedColumnsIcon },
  {
    layout: 'performance',
    label: 'Performance: big centered lyrics',
    icon: PerformanceIcon,
  },
]

/**
 * The layouts as menu rows, and the sidebar switch in the one layout that
 * has a sidebar: the header's Layout menu, its View menu when the header is
 * folded, and More in focus mode, where the header is hidden.
 */
export function mixerViewRows(
  view: MixerViewControlsProps,
): OverflowMenuItem[] {
  const rows: OverflowMenuItem[] = MIXER_LAYOUTS.map((option, index) => ({
    key: `layout-${option.layout}`,
    label: option.label,
    checked: view.layout === option.layout,
    checkType: 'radio',
    separatorBefore: index === 0,
    icon: () => tick(view.layout === option.layout),
    onSelect: () => view.onLayoutChange(option.layout),
  }))
  if (view.layout === 'fixed-2col') {
    rows.push({
      key: 'sidebar',
      label: 'Mixer sidebar',
      checked: !view.sidebarHidden,
      checkType: 'checkbox',
      separatorBefore: true,
      icon: () => tick(!view.sidebarHidden),
      onSelect: () => view.onToggleSidebar(),
    })
  }
  return rows
}

/** The layout in use, as MIXER_LAYOUTS names and draws it. */
export function currentLayout(layout: MixerLayout) {
  return (
    MIXER_LAYOUTS.find((option) => option.layout === layout) ??
    MIXER_LAYOUTS[0]!
  )
}
