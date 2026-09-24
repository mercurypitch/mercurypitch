// Replay host integration — switching visits cannot resurrect easy progress or stale cleanup writes.

import { describe, expect, it, vi } from 'vitest'
import { GLASSWORKS_JOURNEY } from '../content/glassworks-journey'
import { replayProfilesForLevel } from '../content/replay-profiles'
import type { SavedProgress } from '../contracts'
import { readProgress } from '../core/progress'
import { resolveReplayProfile } from '../core/replay-profile'
import { highestReplayTier } from '../core/replay-progress'
import type { GlassGameHost } from '../host'
import { createReplayVisitHost, loadReplayProgress } from './replay-visit-host'

const level = GLASSWORKS_JOURNEY
const profiles = replayProfilesForLevel(level).map((profile) =>
  resolveReplayProfile(level, profile),
)
const easy = profiles[0]!
const hard = profiles[2]!
const complete = (): SavedProgress => ({
  ...readProgress(level, undefined),
  finished: true,
  completedBreakableIds: level.breakables
    .filter((item) => !item.optional)
    .map((item) => item.id),
})

function fixture(legacy?: SavedProgress) {
  const preferences = new Map<string, string>()
  let saved: unknown = legacy ?? null
  const host: GlassGameHost = {
    assetUrl: (id) => id,
    createVoice: vi.fn(),
    createSound: vi.fn(),
    loadProgress: () => saved,
    saveProgress: (value) => {
      saved = value
    },
    readPreference: (key) => preferences.get(key) ?? null,
    writePreference: (key, value) => {
      preferences.set(key, value)
    },
    subscribeForeground: () => () => {},
    onExit: vi.fn(),
  }
  return { host, preferences }
}

describe('replay visit host', () => {
  it('keeps old progress intact while starting hard from unbroken exhibits', () => {
    const legacy = complete()
    const { host, preferences } = fixture(legacy)
    const visit = createReplayVisitHost(host, level, hard, profiles, {
      fresh: false,
      leaseId: 'hard-1',
    })
    expect(
      readProgress(hard.level, visit.host.loadProgress(level.id))
        .completedBreakableIds,
    ).toEqual([])
    expect(host.loadProgress(level.id)).toBe(legacy)
    expect(preferences.get(`replays:v1:${level.id}:legacy-backup`)).toBe(
      JSON.stringify(legacy),
    )
    expect(highestReplayTier(visit.progress())).toBe(0)
  })

  it('resumes exactly the selected profile and suppresses retired visit writes', () => {
    const { host } = fixture(complete())
    const first = createReplayVisitHost(host, level, hard, profiles, {
      fresh: false,
      leaseId: 'first',
    })
    const entrance = level.breakables.find(
      (item) => !item.optional && (item.requiresCompleted?.length ?? 0) === 0,
    )!.id
    first.host.saveProgress({
      ...readProgress(level, undefined),
      completedBreakableIds: [entrance],
    })
    const resumed = createReplayVisitHost(host, level, hard, profiles, {
      fresh: false,
      leaseId: 'resumed',
    })
    expect(
      readProgress(level, resumed.host.loadProgress(level.id))
        .completedBreakableIds,
    ).toEqual([entrance])
    first.host.saveProgress(complete())
    expect(highestReplayTier(loadReplayProgress(host, level, profiles))).toBe(0)
    resumed.host.saveProgress(complete())
    expect(highestReplayTier(loadReplayProgress(host, level, profiles))).toBe(3)
    const restarted = createReplayVisitHost(host, level, easy, profiles, {
      fresh: true,
      leaseId: 'easy',
    })
    expect(
      readProgress(level, restarted.host.loadProgress(level.id))
        .completedBreakableIds,
    ).toEqual([])
    expect(highestReplayTier(restarted.progress())).toBe(3)
  })

  it('keeps a working in-memory visit if preference storage is unavailable', () => {
    const { host } = fixture()
    host.readPreference = () => null
    host.writePreference = () => {}
    const visit = createReplayVisitHost(host, level, easy, profiles, {
      fresh: true,
      leaseId: 'memory',
      now: () => 100,
    })
    visit.host.saveProgress(complete())
    expect(highestReplayTier(visit.progress())).toBe(1)
  })

  it('rejects retired writes when preference storage never persisted either lease', () => {
    const { host } = fixture()
    host.readPreference = () => null
    host.writePreference = () => {}
    const old = createReplayVisitHost(host, level, easy, profiles, {
      fresh: true,
      leaseId: 'old',
    })
    const current = createReplayVisitHost({ ...host }, level, easy, profiles, {
      fresh: true,
      leaseId: 'current',
    })
    old.host.saveProgress(complete())
    expect(host.loadProgress(level.id)).toBeNull()
    expect(highestReplayTier(old.progress())).toBe(0)
    current.host.saveProgress(complete())
    expect(highestReplayTier(current.progress())).toBe(1)
  })

  it('does not resurrect an attempt after the owner clears a persisted lease', () => {
    const { host, preferences } = fixture()
    const visit = createReplayVisitHost(host, level, easy, profiles, {
      fresh: true,
      leaseId: 'cleared',
    })
    preferences.clear()
    visit.host.saveProgress(complete())
    expect(host.loadProgress(level.id)).toBeNull()
    expect(preferences.size).toBe(0)
  })
})
