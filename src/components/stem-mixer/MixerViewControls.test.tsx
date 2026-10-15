// The mixer's view rows: the layouts, the one in use ticked, a pick that
// switches, and the sidebar switch that only the fixed layout has. The header's Layout and View menus and focus
// mode's More all show these rows.

import { createSignal } from 'solid-js'
import { describe, expect, it, vi } from 'vitest'
import type { MixerLayout, MixerViewControlsProps } from './MixerViewControls'
import { currentLayout, MIXER_LAYOUTS, mixerViewRows, } from './MixerViewControls'

function view(initial: MixerLayout) {
  const [layout, setLayout] = createSignal<MixerLayout>(initial)
  const [hidden, setHidden] = createSignal(false)
  const onLayoutChange = vi.fn(setLayout)
  const onToggleSidebar = vi.fn(() => setHidden((was) => !was))
  const props: MixerViewControlsProps = {
    get layout() {
      return layout()
    },
    onLayoutChange,
    get sidebarHidden() {
      return hidden()
    },
    onToggleSidebar,
  }
  return { props, onLayoutChange, onToggleSidebar }
}

describe('mixerViewRows', () => {
  it('lists the layouts as radio rows, the one in use checked', () => {
    const { props, onLayoutChange } = view('auto-1col')
    const rows = mixerViewRows(props)

    expect(rows.map((row) => row.label)).toEqual(
      MIXER_LAYOUTS.map((option) => option.label),
    )
    expect(rows.every((row) => row.checkType === 'radio')).toBe(true)
    expect(rows.find((row) => row.checked === true)?.key).toBe(
      'layout-auto-1col',
    )

    rows.find((row) => row.key === 'layout-fixed-2col')?.onSelect()
    expect(onLayoutChange).toHaveBeenCalledWith('fixed-2col')
    expect(mixerViewRows(props).find((row) => row.checked === true)?.key).toBe(
      'layout-fixed-2col',
    )
  })

  it('offers the sidebar switch in the fixed layout only, checked while shown', () => {
    const { props, onToggleSidebar } = view('fixed-2col')
    const sidebar = () =>
      mixerViewRows(props).find((row) => row.key === 'sidebar')

    expect(sidebar()?.checked).toBe(true)
    sidebar()?.onSelect()
    expect(onToggleSidebar).toHaveBeenCalledTimes(1)
    expect(sidebar()?.checked).toBe(false)

    props.onLayoutChange('performance')
    expect(sidebar()).toBeUndefined()
  })
})

describe('currentLayout', () => {
  it('names and draws the layout in use', () => {
    expect(currentLayout('performance').label).toBe(
      'Performance: big centered lyrics',
    )
    expect(currentLayout('auto-2col').label).toBe('Two columns auto')
  })
})
