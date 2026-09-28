// Native adventure asset profile tests — every host entry stays on packaged mobile GLBs.

import type { LevelDefinition } from '@irchiinnuss/glass-game'
import { GLASSWORKS } from '@irchiinnuss/glass-game'
import { render, screen } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const runtimePlatform = vi.hoisted(() => ({ value: 'web' }))

vi.mock('@/build-info', () => ({ BUILD: { channel: 'dev' } }))
vi.mock('@/infrastructure/mobile-runtime', () => ({
  getBesideCuePlatform: () => runtimePlatform.value,
}))
vi.mock('@irchiinnuss/glass-game/browser', () => ({
  createBrowserGlassHost: () => ({}),
}))
vi.mock('@irchiinnuss/glass-game/campaign', () => ({
  GlassCampaign: (props: { assetProfile?: string }) => (
    <div data-testid="campaign" data-asset-profile={props.assetProfile} />
  ),
}))
vi.mock('@irchiinnuss/glass-game/solid', () => ({
  GlassAdventure: (props: {
    assetProfile?: string
    level?: LevelDefinition
  }) => (
    <div
      data-testid="direct"
      data-asset-profile={props.assetProfile}
      data-level={props.level?.id}
    />
  ),
}))

import { AdventureScreen } from './AdventureScreen'

describe('native adventure asset tier', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/')
    runtimePlatform.value = 'web'
  })

  afterEach(() => vi.unstubAllEnvs())

  it('fixes the campaign and direct audition entries to mobile package bytes', () => {
    vi.stubEnv('VITE_BESIDE_CUE_NATIVE_PLATFORM', 'android')
    const campaign = render(() => (
      <AdventureScreen campaign onExit={() => undefined} />
    ))
    expect(screen.getByTestId('campaign')).toHaveAttribute(
      'data-asset-profile',
      'mobile',
    )
    campaign.unmount()

    const level = { ...GLASSWORKS, id: 'native-direct-audition' }
    render(() => <AdventureScreen level={level} onExit={() => undefined} />)
    expect(screen.getByTestId('direct')).toHaveAttribute(
      'data-asset-profile',
      'mobile',
    )
  })

  it.each(['android', 'ios'])(
    'uses packaged mobile assets when a prebuilt web bundle runs on %s',
    (platform) => {
      vi.stubEnv('VITE_BESIDE_CUE_NATIVE_PLATFORM', '')
      runtimePlatform.value = platform
      render(() => <AdventureScreen campaign onExit={() => undefined} />)
      expect(screen.getByTestId('campaign')).toHaveAttribute(
        'data-asset-profile',
        'mobile',
      )
    },
  )

  it('leaves the standalone web host adaptive', () => {
    vi.stubEnv('VITE_BESIDE_CUE_NATIVE_PLATFORM', '')
    render(() => <AdventureScreen campaign onExit={() => undefined} />)
    expect(screen.getByTestId('campaign')).not.toHaveAttribute(
      'data-asset-profile',
    )
  })
})
