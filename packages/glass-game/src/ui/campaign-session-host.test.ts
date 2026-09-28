// Campaign session persistence regressions — actual completion survives storage failure, never successful-store deletion.

import { describe, expect, it, vi } from 'vitest'
import { MUSEUM_CAMPAIGN } from '../content/campaign'
import { replayProfilesForLevel } from '../content/replay-profiles'
import type { LevelDefinition, SavedProgress } from '../contracts'
import { campaignChapterAccess } from '../core/campaign-access'
import { readProgress } from '../core/progress'
import { resolveReplayProfile } from '../core/replay-profile'
import { canEnterReplay, highestReplayTier } from '../core/replay-progress'
import type { GlassGameHost } from '../host'
import { createCampaignSessionHost } from './campaign-session-host'
import { nextReplayDifficulty } from './completion-progression'
import { createReplayVisitHost, loadReplayProgress } from './replay-visit-host'

type WriteMode = 'persist' | 'noop' | 'throw'

function storageFixture() {
  const progress = new Map<string, SavedProgress>()
  const preferences = new Map<string, string>()
  const mode = { write: 'persist' as WriteMode, readsThrow: false }
  const host: GlassGameHost = {
    assetUrl: (id) => id,
    prepareVoiceGesture: vi.fn(),
    createVoice: vi.fn(),
    createSound: vi.fn(),
    loadProgress: (id) => {
      if (mode.readsThrow) throw new Error('Storage access denied')
      return progress.get(id) ?? null
    },
    saveProgress: (value) => {
      if (mode.write === 'throw') throw new Error('Storage quota exceeded')
      if (mode.write === 'persist')
        progress.set(value.levelId, JSON.parse(JSON.stringify(value)))
    },
    readPreference: (key) => {
      if (mode.readsThrow) throw new Error('Storage access denied')
      return preferences.get(key) ?? null
    },
    writePreference: (key, value) => {
      if (mode.write === 'throw') throw new Error('Storage quota exceeded')
      if (mode.write === 'persist') preferences.set(key, value)
    },
    subscribeForeground: () => () => {},
    onExit: vi.fn(),
  }
  return { host, progress, preferences, mode }
}

function completed(level: LevelDefinition): SavedProgress {
  return readProgress(level, {
    ...readProgress(level, null),
    completedBreakableIds: level.breakables.map((item) => item.id),
    finished: true,
  })
}

const prologue = MUSEUM_CAMPAIGN[0]!
const gallery = MUSEUM_CAMPAIGN[1]!
const profiles = replayProfilesForLevel(gallery.level).map((profile) =>
  resolveReplayProfile(gallery.level, profile),
)

describe('campaign session host', () => {
  it.each([
    { write: 'noop', readsThrow: false },
    { write: 'throw', readsThrow: false },
    { write: 'noop', readsThrow: true },
    { write: 'throw', readsThrow: true },
  ] as const)(
    'keeps completed progression when writes $write and readsThrow=$readsThrow',
    (failure) => {
      const fixture = storageFixture()
      Object.assign(fixture.mode, failure)
      const host = createCampaignSessionHost(fixture.host)
      expect(host.loadProgress(prologue.level.id)).toBeNull()
      expect(host.readPreference('replay')).toBeNull()
      expect(
        campaignChapterAccess(gallery.id, MUSEUM_CAMPAIGN, host.loadProgress)
          .unlocked,
      ).toBe(false)

      const saved = completed(prologue.level)
      host.saveProgress(saved)
      expect(host.loadProgress(prologue.level.id)).toEqual(saved)
      expect(
        campaignChapterAccess(gallery.id, MUSEUM_CAMPAIGN, host.loadProgress)
          .unlocked,
      ).toBe(true)
      expect(
        campaignChapterAccess(
          MUSEUM_CAMPAIGN[2]!.id,
          MUSEUM_CAMPAIGN,
          host.loadProgress,
        ).unlocked,
      ).toBe(false)
      expect(fixture.progress.size).toBe(0)
      expect(
        createCampaignSessionHost(fixture.host).loadProgress(prologue.level.id),
      ).toBeNull()
    },
  )

  it('preserves an actual save without manufacturing completion from an incomplete flag', () => {
    const fixture = storageFixture()
    fixture.mode.write = 'noop'
    const host = createCampaignSessionHost(fixture.host)
    const incomplete = { ...readProgress(prologue.level, null), finished: true }
    host.saveProgress(incomplete)
    incomplete.completedBreakableIds.push(
      ...prologue.level.breakables.map((item) => item.id),
    )

    expect(
      campaignChapterAccess(gallery.id, MUSEUM_CAMPAIGN, host.loadProgress)
        .unlocked,
    ).toBe(false)
    expect(
      (host.loadProgress(prologue.level.id) as SavedProgress)
        .completedBreakableIds,
    ).toEqual([])
  })

  it('detects a stale readback and clears fallbacks when storage recovers', () => {
    const fixture = storageFixture()
    const host = createCampaignSessionHost(fixture.host)
    const started = readProgress(prologue.level, null)
    fixture.progress.set(prologue.level.id, started)
    fixture.preferences.set('replay', 'old')
    fixture.mode.write = 'noop'
    host.saveProgress(completed(prologue.level))
    host.writePreference('replay', 'new')
    expect(
      (host.loadProgress(prologue.level.id) as SavedProgress).finished,
    ).toBe(true)
    expect(host.readPreference('replay')).toBe('new')

    fixture.mode.write = 'persist'
    host.saveProgress(completed(prologue.level))
    host.writePreference('replay', 'new')
    fixture.progress.clear()
    fixture.preferences.clear()
    expect(host.loadProgress(prologue.level.id)).toBeNull()
    expect(host.readPreference('replay')).toBeNull()
  })

  it('does not cache successful writes over external removals or replacements', () => {
    const fixture = storageFixture()
    const host = createCampaignSessionHost(fixture.host)
    host.saveProgress(completed(prologue.level))
    host.writePreference('replay', 'earned')
    fixture.progress.set(prologue.level.id, readProgress(prologue.level, null))
    fixture.preferences.set('replay', 'replaced')
    expect(
      campaignChapterAccess(gallery.id, MUSEUM_CAMPAIGN, host.loadProgress)
        .unlocked,
    ).toBe(false)
    expect(host.readPreference('replay')).toBe('replaced')
    fixture.progress.clear()
    fixture.preferences.clear()
    expect(host.loadProgress(prologue.level.id)).toBeNull()
    expect(host.readPreference('replay')).toBeNull()
  })

  it.each(['noop', 'throw'] as const)(
    'retains only earned replay tiers and retires prior leases when writes %s',
    (write) => {
      const fixture = storageFixture()
      fixture.mode.write = write
      fixture.mode.readsThrow = write === 'throw'
      const host = createCampaignSessionHost(fixture.host)
      const first = createReplayVisitHost(
        host,
        gallery.level,
        profiles[0]!,
        profiles,
        {
          fresh: true,
          leaseId: 'first',
          now: () => 100,
        },
      )
      expect(
        highestReplayTier(loadReplayProgress(host, gallery.level, profiles)),
      ).toBe(0)
      expect(
        canEnterReplay(
          loadReplayProgress(host, gallery.level, profiles),
          profiles[1]!,
        ),
      ).toBe(false)
      first.host.saveProgress(completed(profiles[0]!.level))
      const earned = loadReplayProgress(host, gallery.level, profiles)
      expect(highestReplayTier(earned)).toBe(1)
      const next = nextReplayDifficulty(profiles, 1, highestReplayTier(earned))!
      expect(next.profile.tier).toBe(2)
      expect(canEnterReplay(earned, next)).toBe(true)

      const second = createReplayVisitHost(
        { ...host },
        gallery.level,
        next,
        profiles,
        {
          fresh: true,
          leaseId: 'second',
          now: () => 200,
        },
      )
      expect(second.host.readPreference).toBe(host.readPreference)
      expect(
        readProgress(next.level, second.host.loadProgress(gallery.level.id))
          .completedBreakableIds,
      ).toEqual([])
      const beforeRetiredSave = loadReplayProgress(
        host,
        gallery.level,
        profiles,
      )
      first.host.saveProgress(readProgress(profiles[0]!.level, null))
      expect(loadReplayProgress(host, gallery.level, profiles)).toEqual(
        beforeRetiredSave,
      )
      expect(
        highestReplayTier(loadReplayProgress(host, gallery.level, profiles)),
      ).toBe(1)
      second.host.saveProgress(completed(next.level))
      expect(
        highestReplayTier(loadReplayProgress(host, gallery.level, profiles)),
      ).toBe(2)
      expect(fixture.preferences.size).toBe(0)
      expect(fixture.progress.size).toBe(0)
    },
  )
})
