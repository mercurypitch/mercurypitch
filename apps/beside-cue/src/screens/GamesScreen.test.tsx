// ============================================================
// The games list keeps a pitch detector warm for the next world (P7).
// The Range Finder on the same list listens through that detector: its
// stream takes the spare the list started and ends it when the finder
// closes. Unless the list warms again then, the next world spawns its
// detector cold, and a phone run without ?cold reports a cold f0 as warm.
// ============================================================

import type * as PitchEngine from '@irchiinnuss/pitch-engine'
import { fireEvent, render, screen } from '@solidjs/testing-library'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type * as Warm from '@/games/glass3d/runtime/warm'

/** The pitch engine's one spare, kept the way it keeps it: a warm while
 * one waits keeps it rather than doubling it, a stream takes it, and
 * leaving the list lets it go. */
const detector = vi.hoisted(() => ({
  spare: null as { id: number } | null,
  spawned: 0,
}))
/** Work the list queued for after its paint, run when the test says the
 * page is idle. */
const page = vi.hoisted(() => ({ queued: new Set<() => void>() }))

vi.mock('@irchiinnuss/pitch-engine', async (importOriginal) => ({
  ...(await importOriginal<typeof PitchEngine>()),
  preloadF0Detector: () => {
    detector.spare ??= { id: ++detector.spawned }
    return true
  },
  releasePreloadedDetector: () => {
    detector.spare = null
  },
}))
vi.mock('@/games/glass3d/runtime/warm', async (importOriginal) => ({
  ...(await importOriginal<typeof Warm>()),
  whenIdleAfterPaint: (work: () => void) => {
    page.queued.add(work)
    return () => page.queued.delete(work)
  },
}))
vi.mock('@/games/glass3d/render/merc', () => ({
  warmMerc: () => {},
  dropWarmMerc: () => {},
}))
// The finder listens the moment it opens, and its stream adopts the spare
// (createF0Stream takes it), then ends it when the finder closes.
vi.mock('./RangeFinder', () => ({
  RangeFinder: (props: { onClose: () => void }) => {
    detector.spare = null
    const close = document.createElement('button')
    close.type = 'button'
    close.textContent = 'Close the finder'
    close.addEventListener('click', () => props.onClose())
    return close
  },
}))
// The worlds and the tuner are not what this is about, and stay unloaded.
vi.mock('@/games/glass3d/render/Stage3D', () => ({ Stage3D: () => null }))
vi.mock('@/games/glass3d/render/HallwayStage', () => ({
  HallwayStage: () => null,
}))
vi.mock('@/games/glass3d/render/ChamberStage', () => ({
  ChamberStage: () => null,
}))
vi.mock('@/games/glass3d/render/LineStage', () => ({ LineStage: () => null }))
vi.mock('@/games/glass/JourneyPrototype', () => ({
  JourneyPrototype: () => <div data-testid="legacy-journey" />,
}))
vi.mock('./TapTuner', () => ({ TapTuner: () => null }))
vi.mock('@/games/adventure/CreatorGallery', () => ({
  CreatorGallery: (props: { onExit(): void }) => (
    <button data-testid="creator-gallery-host" onClick={() => props.onExit()}>
      Leave studies
    </button>
  ),
}))
vi.mock('@/games/adventure/CreatorSongbook', () => ({
  CreatorSongbook: (props: { onExit(): void }) => (
    <button data-testid="songbook-host" onClick={() => props.onExit()}>
      Leave songbook
    </button>
  ),
}))
vi.mock('@/games/adventure/CreatorAudition', () => ({
  CreatorAudition: (props: { onExit(): void }) => (
    <button data-testid="curator-host" onClick={() => props.onExit()}>
      Leave curator
    </button>
  ),
}))
vi.mock('@/games/adventure/AdventureScreen', () => ({
  AdventureScreen: (props: {
    campaign?: boolean
    level?: { id: string }
    onExit(): void
  }) => (
    <button
      data-testid="adventure-host"
      data-level={props.level?.id}
      data-campaign={String(props.campaign === true)}
      onClick={() => props.onExit()}
    >
      Leave adventure
    </button>
  ),
}))

import { GamesScreen } from './GamesScreen'

/** The list's frame reaches the screen and the page goes idle. */
const idle = (): void => {
  const due = [...page.queued]
  page.queued.clear()
  for (const work of due) work()
}

beforeEach(() => {
  detector.spare = null
  detector.spawned = 0
  page.queued.clear()
})

describe('the games list warming the detector (P7)', () => {
  it('warms one once the list is painted and the page is idle', () => {
    render(() => <GamesScreen onBack={() => {}} />)
    expect(detector.spare).toBeNull()
    idle()
    expect(detector.spare).not.toBeNull()
  })

  it('warms another when the Range Finder closes, for the next world', () => {
    render(() => <GamesScreen onBack={() => {}} />)
    idle()
    fireEvent.click(screen.getByRole('button', { name: 'Find it by singing' }))
    expect(detector.spare).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Close the finder' }))
    idle()
    // The Hallway tapped now adopts a warm detector, not a cold one.
    expect(detector.spare).not.toBeNull()
    expect(detector.spawned).toBe(2)
  })
})

describe('owner-build adventure entries', () => {
  it('opens the Pearl Turn as an isolated study without altering the campaign', () => {
    render(() => <GamesScreen onBack={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /The Pearl Turn/u }))
    const host = screen.getByTestId('adventure-host')
    expect(host).toHaveAttribute(
      'data-level',
      'cloudway-quarter-turn-art-study-v1',
    )
    expect(host).toHaveAttribute('data-campaign', 'false')
    expect(screen.queryByTestId('legacy-journey')).toBeNull()
    fireEvent.click(host)
    expect(
      screen.getByRole('button', { name: /The Pearl Turn/u }),
    ).toBeEnabled()
  })
  it('opens the songbook without mounting a movement game and returns to the list', () => {
    render(() => <GamesScreen onBack={() => {}} />)
    fireEvent.click(
      screen.getByRole('button', { name: /Merc’s little songbook/u }),
    )
    const host = screen.getByTestId('songbook-host')
    expect(screen.queryByTestId('legacy-journey')).toBeNull()
    expect(screen.queryByTestId('adventure-host')).toBeNull()
    fireEvent.click(host)
    expect(screen.queryByTestId('songbook-host')).toBeNull()
    expect(
      screen.getByRole('button', { name: /Merc’s little songbook/u }),
    ).toBeEnabled()
  })

  it('opens art studies without mounting another game', () => {
    render(() => <GamesScreen onBack={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /Little discoveries/u }))
    const host = screen.getByTestId('creator-gallery-host')
    expect(screen.queryByTestId('legacy-journey')).toBeNull()
    expect(screen.queryByTestId('adventure-host')).toBeNull()
    fireEvent.click(host)
    expect(screen.queryByTestId('creator-gallery-host')).toBeNull()
    expect(
      screen.getByRole('button', { name: /Little discoveries/u }),
    ).toBeEnabled()
  })
  it('opens the optional curator without mounting a movement game and returns cleanly', () => {
    render(() => <GamesScreen onBack={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /Echo Curator/u }))
    const host = screen.getByTestId('curator-host')
    expect(screen.queryByTestId('legacy-journey')).toBeNull()
    expect(screen.queryByTestId('adventure-host')).toBeNull()
    fireEvent.click(host)
    expect(screen.queryByTestId('curator-host')).toBeNull()
    expect(screen.getByRole('button', { name: /Echo Curator/u })).toBeEnabled()
  })
  it('opens the Thawing Song preview without changing the museum campaign', () => {
    render(() => <GamesScreen onBack={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /The Thawing Song/u }))
    const host = screen.getByTestId('adventure-host')
    expect(host).toHaveAttribute('data-level', 'cloudway-thawing-song-audition')
    expect(host).toHaveAttribute('data-campaign', 'false')
    expect(screen.queryByTestId('legacy-journey')).not.toBeInTheDocument()
    fireEvent.click(host)
    expect(
      screen.getByRole('button', { name: /The Thawing Song/u }),
    ).toBeVisible()
  })

  it('opens the bounded Promenade directly and returns to the list', () => {
    render(() => <GamesScreen onBack={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /Crystal Promenade/u }))
    const host = screen.getByTestId('adventure-host')
    expect(host).toHaveAttribute(
      'data-level',
      'cloudway-crystal-promenade-first-slice',
    )
    expect(host).toHaveAttribute('data-campaign', 'false')
    expect(screen.queryByTestId('legacy-journey')).not.toBeInTheDocument()
    fireEvent.click(host)
    expect(
      screen.getByRole('button', { name: /Crystal Promenade/u }),
    ).toBeVisible()
    expect(screen.queryByTestId('adventure-host')).not.toBeInTheDocument()
  })

  it('keeps Glassworks opening the museum campaign', () => {
    render(() => <GamesScreen onBack={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /Glassworks/u }))
    expect(screen.getByTestId('adventure-host')).toHaveAttribute(
      'data-campaign',
      'true',
    )
    expect(screen.getByTestId('adventure-host')).not.toHaveAttribute(
      'data-level',
    )
    expect(screen.queryByTestId('legacy-journey')).not.toBeInTheDocument()
  })
})
