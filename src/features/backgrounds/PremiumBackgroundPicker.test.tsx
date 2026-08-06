// ============================================================
// Premium background picker tests
// ============================================================

import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import type { PremiumBackgroundAsset } from '@/lib/backgrounds/background-runtime'
import { loadProtectedBackgroundObjectUrl } from '@/lib/backgrounds/background-runtime'
import type { BackgroundSurfaceController, RuntimeBackgroundOption, } from '@/lib/backgrounds/background-surface'
import { PremiumBackgroundPicker } from './PremiumBackgroundPicker'

vi.mock('@/lib/backgrounds/background-runtime', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return {
    ...actual,
    loadProtectedBackgroundObjectUrl: vi
      .fn()
      .mockResolvedValue('blob:unlocked-preview'),
  }
})

const SHA = 'c'.repeat(64)

function premiumAsset(
  id: 'golden-hour-stage' | 'aurora-stage',
): PremiumBackgroundAsset {
  return {
    id,
    title: id,
    description: 'Supporter stage',
    surface: 'karaoke',
    activeVersion: 1,
    variants: [
      {
        name: 'landscape-2k',
        width: 2048,
        height: 1152,
        byteSize: 100,
        sha256: SHA,
      },
    ],
  }
}

function pickerOptions(): RuntimeBackgroundOption[] {
  return [
    {
      id: 'karaoke-theatre',
      surface: 'karaoke',
      label: 'Mercury Theatre',
      description: 'Included stage',
      edition: 'core',
      focalPoint: { x: 0.5, y: 0.5 },
      access: 'free',
      publicUrl: '/karaoke-night-stage.webp',
      premiumAsset: null,
    },
    {
      id: 'golden-hour-stage',
      surface: 'karaoke',
      label: 'Golden Hour',
      description: 'Unlocked stage',
      edition: 'golden-hour',
      focalPoint: { x: 0.5, y: 0.45 },
      access: 'unlocked',
      publicUrl: null,
      premiumAsset: premiumAsset('golden-hour-stage'),
    },
    {
      id: 'aurora-stage',
      surface: 'karaoke',
      label: 'Aurora',
      description: 'Locked stage',
      edition: 'aurora',
      focalPoint: { x: 0.5, y: 0.5 },
      access: 'locked',
      publicUrl: null,
      premiumAsset: premiumAsset('aurora-stage'),
    },
  ]
}

function fakeController(): BackgroundSurfaceController {
  return {
    surface: 'karaoke',
    requestedId: () => 'karaoke-theatre',
    resolved: () => ({
      id: 'karaoke-theatre',
      url: '/karaoke-night-stage.webp',
      focalPoint: { x: 0.5, y: 0.5 },
      source: 'public',
      version: null,
    }),
    resolvedStyle: () => ({
      '--mp-stage-image': 'url("/karaoke-night-stage.webp")',
      '--mp-stage-position-x': '50%',
      '--mp-stage-position-y': '50%',
      '--mp-stage-position': '50% 50%',
    }),
    options: pickerOptions,
    loading: () => false,
    error: () => null,
    select: vi.fn(() => true),
    refresh: async () => undefined,
    retain: () => vi.fn(),
    dispose: vi.fn(),
  }
}

beforeAll(() => {
  window.requestAnimationFrame = ((callback: FrameRequestCallback) => {
    callback(0)
    return 1
  }) as typeof window.requestAnimationFrame
  URL.revokeObjectURL = vi.fn()
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('PremiumBackgroundPicker', () => {
  it('loads unlocked previews but never requests locked protected art', async () => {
    const controller = fakeController()
    render(() => <PremiumBackgroundPicker controller={controller} />)
    fireEvent.click(
      screen.getByRole('button', { name: 'Choose karaoke stage background' }),
    )

    await vi.waitFor(() =>
      expect(loadProtectedBackgroundObjectUrl).toHaveBeenCalledTimes(1),
    )
    expect(loadProtectedBackgroundObjectUrl).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'golden-hour-stage' }),
      expect.anything(),
    )
    expect(screen.getByRole('button', { name: /Aurora/ })).toHaveAttribute(
      'aria-disabled',
      'true',
    )

    fireEvent.click(screen.getByRole('button', { name: /Aurora/ }))
    expect(controller.select).not.toHaveBeenCalled()
  })

  it('awaits an authoritative selection and closes only when accepted', async () => {
    const controller = fakeController()
    const onSelect = vi
      .fn<(option: RuntimeBackgroundOption) => Promise<boolean>>()
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true)
    render(() => (
      <PremiumBackgroundPicker controller={controller} onSelect={onSelect} />
    ))
    const trigger = screen.getByRole('button', {
      name: 'Choose karaoke stage background',
    })
    fireEvent.click(trigger)
    fireEvent.click(screen.getByRole('button', { name: /Golden Hour/ }))
    await vi.waitFor(() => expect(onSelect).toHaveBeenCalledTimes(1))
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Golden Hour/ }))
    await vi.waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    )
    expect(onSelect).toHaveBeenCalledTimes(2)
  })

  it('keeps its gallery open while the panel scrolls and restores focus on Escape', async () => {
    const controller = fakeController()
    render(() => <PremiumBackgroundPicker controller={controller} />)
    const trigger = screen.getByRole('button', {
      name: 'Choose karaoke stage background',
    })
    fireEvent.click(trigger)
    const dialog = screen.getByRole('dialog')
    fireEvent.scroll(dialog)
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    fireEvent.keyDown(document, { key: 'Escape' })
    await vi.waitFor(() => expect(trigger).toHaveFocus())
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('opens the Credits section for supporter perks from a standalone gallery', () => {
    const controller = fakeController()
    render(() => <PremiumBackgroundPicker controller={controller} />)
    fireEvent.click(
      screen.getByRole('button', { name: 'Choose karaoke stage background' }),
    )

    expect(
      screen.getByRole('link', { name: 'Explore supporter perks' }),
    ).toHaveAttribute('href', '/#/settings/credits')
  })
})
