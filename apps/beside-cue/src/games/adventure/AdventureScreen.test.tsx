// Adventure route boundary tests — release builds cannot enter a preview level around campaign locks.
import type { LevelDefinition } from '@irchiinnuss/glass-game'
import { GLASSWORKS } from '@irchiinnuss/glass-game'
import { render, screen } from '@solidjs/testing-library'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { BuildInfo } from '@/build-info'

const build = vi.hoisted(() => ({ channel: 'dev' as BuildInfo['channel'] }))
const runnerTrials = vi.hoisted(() => ({
  current: { id: 'the-singing-current-trial-current-v1' },
  learning: { id: 'the-singing-current-trial-learning-v1' },
}))
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
  GlassAdventure: (props: { level?: LevelDefinition }) => (
    <div data-testid="direct-preview" data-level={props.level?.id} />
  ),
}))
vi.mock('@irchiinnuss/glass-game/runner', () => ({
  SINGING_CURRENT_TRIALS: runnerTrials,
  SINGING_CURRENT_CONTINUOUS_TRIAL: {
    id: 'the-singing-current-trial-continuous-v1',
    presentation: { cameraProfile: 'responsive-close' },
  },
  SongRunnerScreen: (props: {
    course?: { id: string; presentation?: { cameraProfile: string } }
    allowCameraTuning?: boolean
  }) => (
    <div
      data-testid="runner"
      data-course={props.course?.id ?? 'canonical'}
      data-camera={props.course?.presentation?.cameraProfile}
      data-camera-tuning={String(props.allowCameraTuning === true)}
    />
  ),
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

  it('opens the requested development audition without the campaign wrapper', () => {
    const level = { ...GLASSWORKS, id: 'test-audition' }
    render(() => <AdventureScreen level={level} onExit={() => undefined} />)
    expect(screen.getByTestId('direct-preview')).toHaveAttribute(
      'data-level',
      'test-audition',
    )
    expect(screen.queryByTestId('campaign')).toBeNull()
  })

  it.each([
    ['dev', 'current', 'the-singing-current-trial-current-v1'],
    ['ci', 'learning', 'the-singing-current-trial-learning-v1'],
  ] as const)(
    'opens the isolated %s %s pace trial',
    (channel, pace, courseId) => {
      build.channel = channel
      render(() => (
        <AdventureScreen runner runnerPace={pace} onExit={() => undefined} />
      ))
      expect(screen.getByTestId('runner')).toHaveAttribute(
        'data-course',
        courseId,
      )
      expect(screen.queryByTestId('campaign')).toBeNull()
    },
  )

  it('keeps the canonical course when no trial pace is selected', () => {
    render(() => <AdventureScreen runner onExit={() => undefined} />)
    expect(screen.getByTestId('runner')).toHaveAttribute(
      'data-course',
      'canonical',
    )
  })

  it.each([undefined, 'close', 'angled'] as const)(
    'opens isolated steering with independent %s camera',
    (camera) => {
      render(() => (
        <AdventureScreen
          runner
          runnerSteering="continuous"
          runnerCamera={camera}
          onExit={() => undefined}
        />
      ))
      expect(screen.getByTestId('runner')).toHaveAttribute(
        'data-course',
        'the-singing-current-trial-continuous-v1',
      )
      expect(screen.getByTestId('runner')).toHaveAttribute(
        'data-camera',
        camera === 'angled'
          ? 'steering-angled'
          : camera === 'close'
            ? 'steering-close'
            : 'responsive-close',
      )
      expect(screen.getByTestId('runner')).toHaveAttribute(
        'data-camera-tuning',
        'true',
      )
    },
  )

  it('cannot use the steering preview to bypass release progression', () => {
    build.channel = 'release'
    render(() => (
      <AdventureScreen
        runner
        runnerSteering="continuous"
        runnerCamera="close"
        onExit={() => undefined}
      />
    ))
    expect(screen.queryByTestId('runner')).toBeNull()
    expect(screen.getByTestId('campaign')).toHaveAttribute(
      'data-unlocked',
      'false',
    )
  })

  it('can exercise normal campaign locks in a development preview', () => {
    window.history.replaceState({}, '', '/glass-game/?progression=earned')
    render(() => (
      <AdventureScreen
        campaign
        runner
        runnerPace="current"
        onExit={() => undefined}
      />
    ))
    expect(screen.getByTestId('campaign')).toHaveAttribute(
      'data-unlocked',
      'false',
    )
    expect(screen.queryByTestId('runner')).toBeNull()
  })

  it('routes a release direct entry through the locked campaign', () => {
    build.channel = 'release'
    window.history.replaceState(
      {},
      '',
      '/glass-game/?layout=singing-current&pace=current',
    )
    render(() => (
      <AdventureScreen runner runnerPace="current" onExit={() => undefined} />
    ))
    expect(screen.getByTestId('campaign')).toHaveAttribute(
      'data-unlocked',
      'false',
    )
    expect(screen.queryByTestId('direct-preview')).not.toBeInTheDocument()
    expect(screen.queryByTestId('runner')).not.toBeInTheDocument()
  })
})
