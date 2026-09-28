// Adventure route boundary tests — release builds cannot enter a preview level around campaign locks.
import { render, screen } from '@solidjs/testing-library'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { BuildInfo } from '@/build-info'

const build = vi.hoisted(() => ({ channel: 'dev' as BuildInfo['channel'] }))
vi.mock('@/build-info', () => ({ BUILD: build }))
vi.mock('@irchiinnuss/glass-game/browser', () => ({
  createBrowserGlassHost: () => ({}),
}))
vi.mock('@irchiinnuss/glass-game/campaign', () => ({
  GlassCampaign: (props: { developmentUnlock: boolean }) => (
    <div
      data-testid="campaign"
      data-unlocked={String(props.developmentUnlock)}
    />
  ),
}))
vi.mock('@irchiinnuss/glass-game/solid', () => ({
  GlassAdventure: () => <div data-testid="direct-preview" />,
}))

import { AdventureScreen } from './AdventureScreen'

describe('Glassworks build access', () => {
  beforeEach(() => {
    build.channel = 'dev'
    window.history.replaceState({}, '', '/')
  })

  it.each(['dev', 'ci'] as const)(
    'unlocks the %s museum without spoofing saves',
    (channel) => {
      build.channel = channel
      render(() => <AdventureScreen campaign onExit={() => undefined} />)
      expect(screen.getByTestId('campaign')).toHaveAttribute(
        'data-unlocked',
        'true',
      )
    },
  )

  it('keeps a development direct audition available', () => {
    render(() => <AdventureScreen onExit={() => undefined} />)
    expect(screen.getByTestId('direct-preview')).toBeInTheDocument()
  })

  it('can exercise normal campaign locks in a development preview', () => {
    window.history.replaceState({}, '', '/glass-game/?progression=earned')
    render(() => <AdventureScreen campaign onExit={() => undefined} />)
    expect(screen.getByTestId('campaign')).toHaveAttribute(
      'data-unlocked',
      'false',
    )
  })

  it('routes a release direct entry through the locked campaign', () => {
    build.channel = 'release'
    render(() => <AdventureScreen onExit={() => undefined} />)
    expect(screen.getByTestId('campaign')).toHaveAttribute(
      'data-unlocked',
      'false',
    )
    expect(screen.queryByTestId('direct-preview')).not.toBeInTheDocument()
  })
})
