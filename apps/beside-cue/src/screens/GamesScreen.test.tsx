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
  JourneyPrototype: () => null,
}))
vi.mock('./TapTuner', () => ({ TapTuner: () => null }))

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
