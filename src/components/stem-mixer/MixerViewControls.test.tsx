// The header's view controls: which layout is on, switching it, and the
// sidebar toggle that only the fixed layout has.

import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { MixerLayout } from './MixerViewControls'
import { MixerViewControls } from './MixerViewControls'

afterEach(cleanup)

describe('MixerViewControls', () => {
  it('marks the layout in use and switches on a press', () => {
    const [layout, setLayout] = createSignal<MixerLayout>('auto-1col')
    const onLayoutChange = vi.fn(setLayout)
    render(() => (
      <MixerViewControls
        layout={layout()}
        onLayoutChange={onLayoutChange}
        sidebarHidden={false}
        onToggleSidebar={() => {}}
      />
    ))
    const single = screen.getByRole('button', { name: 'Single column' })
    const fixed = screen.getByRole('button', { name: 'Two columns fixed' })
    expect(single).toHaveAttribute('aria-pressed', 'true')
    expect(fixed).toHaveAttribute('aria-pressed', 'false')

    fireEvent.click(fixed)

    expect(onLayoutChange).toHaveBeenCalledWith('fixed-2col')
    expect(fixed).toHaveAttribute('aria-pressed', 'true')
    expect(single).toHaveAttribute('aria-pressed', 'false')
    // The tour switches to the fixed layout through this hook.
    expect(fixed).toHaveAttribute('data-tour', 'mixer.layout-fixed')
  })

  it('offers the sidebar toggle in the fixed layout only, named for what it does', () => {
    const [layout, setLayout] = createSignal<MixerLayout>('fixed-2col')
    const [hidden, setHidden] = createSignal(false)
    const onToggle = vi.fn(() => setHidden((was) => !was))
    render(() => (
      <MixerViewControls
        layout={layout()}
        onLayoutChange={setLayout}
        sidebarHidden={hidden()}
        onToggleSidebar={onToggle}
      />
    ))

    fireEvent.click(screen.getByRole('button', { name: 'Hide mixer sidebar' }))
    expect(onToggle).toHaveBeenCalledTimes(1)
    expect(
      screen.getByRole('button', { name: 'Show mixer sidebar' }),
    ).toHaveAttribute('title', 'Show mixer sidebar')

    setLayout('performance')
    expect(screen.queryByRole('button', { name: /mixer sidebar/ })).toBeNull()
  })
})
