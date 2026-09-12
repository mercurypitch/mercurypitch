// ============================================================
// The room sheet: the other rooms' picker, and one slider
// ============================================================
//
// The gallery inside it is `PremiumBackgroundPicker`'s and is proved in its
// own suite. What is here is the wiring R5 asked for: that this really is
// that component (rather than a second gallery grown beside it), that
// choosing goes through the surface controller, and that the veil slider
// carries the preference's own bounds.

import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import type { BackgroundSurfaceController, RuntimeBackgroundOption, } from '@/lib/backgrounds/background-surface'
import { SING_GLASS } from './sing-glass'
import { SingRoomPicker } from './SingRoomPicker'

afterEach(cleanup)

beforeAll(() => {
  window.requestAnimationFrame = ((callback: FrameRequestCallback) => {
    callback(0)
    return 1
  }) as typeof window.requestAnimationFrame
})

const COVERS: RuntimeBackgroundOption[] = [
  {
    id: 'sing-retro-analog-studio',
    surface: 'sing',
    label: 'Retro Analog Studio',
    description: 'A walnut control room',
    edition: 'core',
    focalPoint: { x: 0.5, y: 0.68 },
    treatment: 'dark',
    access: 'free',
    publicUrl: '/sing/retro-analog-studio.webp',
    premiumAsset: null,
  },
  {
    id: 'sing-retro-analog-studio-b',
    surface: 'sing',
    label: 'Retro Analog Studio B',
    description: 'The same control room, warmer',
    edition: 'core',
    focalPoint: { x: 0.5, y: 0.68 },
    treatment: 'dark',
    access: 'free',
    publicUrl: '/sing/retro-analog-studio-b.webp',
    premiumAsset: null,
  },
]

function controller(select = vi.fn(() => true)): BackgroundSurfaceController {
  return {
    surface: 'sing',
    requestedId: () => 'sing-retro-analog-studio',
    resolved: () => ({
      id: 'sing-retro-analog-studio',
      url: '/sing/retro-analog-studio.webp',
      focalPoint: { x: 0.5, y: 0.68 },
      treatment: 'dark',
      source: 'public',
      version: null,
      variant: null,
    }),
    resolvedStyle: () => ({
      '--mp-stage-image': 'url("/sing/retro-analog-studio.webp")',
      '--mp-stage-position-x': '50%',
      '--mp-stage-position-y': '68%',
      '--mp-stage-position': '50% 68%',
    }),
    options: () => COVERS,
    loading: () => false,
    error: () => null,
    select,
    refresh: async () => undefined,
    invalidateAccess: vi.fn(),
    retain: () => vi.fn(),
    dispose: vi.fn(),
  }
}

function mount(background = controller()) {
  const handlers = { close: vi.fn(), onGlassChange: vi.fn() }
  render(() => (
    <SingRoomPicker
      isOpen
      background={background}
      glass={() => SING_GLASS.defaultValue}
      {...handlers}
    />
  ))
  return { ...handlers, background }
}

describe('the sing room picker', () => {
  it('offers every cover the surface has', () => {
    mount()
    for (const label of ['Retro Analog Studio', 'Retro Analog Studio B']) {
      expect(screen.getByText(label)).not.toBeNull()
    }
  })

  it('chooses through the surface controller, so the choice persists', () => {
    const select = vi.fn(() => true)
    mount(controller(select))
    fireEvent.click(screen.getByText('Retro Analog Studio B').closest('button')!)
    expect(select).toHaveBeenCalledWith('sing-retro-analog-studio-b')
  })

  it('carries the veil slider, at the preference’s own bounds', () => {
    mount()
    const slider = screen.getByTestId('sing-room-glass') as HTMLInputElement
    expect(slider.min).toBe(String(SING_GLASS.min))
    expect(slider.max).toBe(String(SING_GLASS.max))
    expect(slider.step).toBe(String(SING_GLASS.step))
    expect(slider.value).toBe(String(SING_GLASS.defaultValue))
    expect(slider.getAttribute('aria-valuetext')).toBe(
      'Clear · 50% room visibility',
    )
  })

  it('reports a moved slider as a number', () => {
    const handlers = mount()
    const slider = screen.getByTestId('sing-room-glass') as HTMLInputElement
    slider.value = '0.9'
    fireEvent.input(slider)
    expect(handlers.onGlassChange).toHaveBeenCalledWith(0.9)
  })

  it('draws nothing while it is closed', () => {
    render(() => (
      <SingRoomPicker
        isOpen={false}
        background={controller()}
        glass={() => 0.5}
        close={vi.fn()}
        onGlassChange={vi.fn()}
      />
    ))
    expect(screen.queryByTestId('sing-room-picker')).toBeNull()
  })
})
