// ============================================================
// The native Progress page over the real record
// ============================================================
//
// The record is the web route's own (useProgressRecord), read from a model
// built the way the app builds one; only the read is stood in for. So a
// filter here is the record's filter (buildHistory), a moment is the
// record's choice, and the league card pushes the shell's own screen.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  loadProgressModel: vi.fn(),
  trackEvent: vi.fn(),
}))

vi.mock('@/features/progress/progress-data', () => ({
  loadProgressModel: mocks.loadProgressModel,
}))
// A native test build, which draws Voice Constellation as its own screen.
vi.mock('@/lib/native-build', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  NATIVE_PROGRESS: true,
}))
vi.mock('@/lib/analytics', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  trackEvent: mocks.trackEvent,
}))
vi.mock('@/features/progress/share-card', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  renderProgressShareCard: vi.fn(
    () => new Promise<HTMLCanvasElement>(() => undefined),
  ),
}))

import type { SessionRecord } from '@/db/entities'
import type { VoiceprintRecord } from '@/db/services/voiceprint-service'
import type { ProgressModel } from '@/features/progress/model'
import { buildProgressModel } from '@/features/progress/model'
import type { RenderedShell } from '../render-for-test'
import { renderShell } from '../render-for-test'
import { pushed, resetRunShell } from '../run-shell-store'
import { ProgressScreen } from './ProgressScreen'

const NOW = new Date('2026-11-05T12:00:00.000Z')

function run(
  id: string,
  source: SessionRecord['source'],
  melodyName: string,
  endedAt: string,
): SessionRecord {
  return {
    id,
    createdAt: endedAt,
    updatedAt: endedAt,
    userId: 'device',
    melodyName,
    startedAt: endedAt,
    endedAt,
    score: 80,
    accuracy: 82,
    notesHit: 8,
    notesTotal: 10,
    streak: 2,
    source,
    instrument: 'voice',
    results: [],
  }
}

/** A saved Voice Mirror print with a legend twin, as the Mirror keeps one. */
const VOICEPRINT: VoiceprintRecord = {
  id: 'print',
  twin: 'Freddie Mercury',
  takenAt: '2026-11-02T18:00:00.000Z',
  source: 'mirror',
  summary: {
    lowMidi: 43,
    highMidi: 72,
    semitones: 29,
    accuracy: 82,
    steadiness: 76,
  },
}

function record(voiceprints: readonly VoiceprintRecord[] = []): ProgressModel {
  return buildProgressModel(
    {
      records: [
        run('drill', 'exercise', 'Long Note', '2026-11-04T18:00:00.000Z'),
        run('song', 'practice', 'C major scale', '2026-11-03T18:00:00.000Z'),
        run('task', 'challenge', 'Octave Leap', '2026-10-28T18:00:00.000Z'),
      ],
      voiceprints,
      badgeDefinitions: [],
      userBadges: [],
      achievementDefinitions: [],
      userAchievements: [],
      challengeDefinitions: [],
      activityRows: [],
      recentActivity: [],
      league: {
        eligible: true,
        weekStart: '2026-11-02',
        league: {
          id: 'l2',
          rank: 2,
          name: 'Sparkwing',
          trophyAsset: '/leagues/l2.webp',
          badgeAsset: null,
          isMystery: false,
          promoteCount: 10,
          relegateCount: 10,
        },
        points: 120,
        rank: 7,
        cohortSize: 23,
      },
    },
    { now: NOW },
  )
}

let view: RenderedShell | null = null

const settle = async (): Promise<void> => {
  for (let i = 0; i < 4; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0))
  }
}

async function open(): Promise<HTMLElement> {
  view = renderShell(() => <ProgressScreen />)
  await settle()
  return view.container
}

const titles = (root: ParentNode): string[] =>
  [...root.querySelectorAll('.mp-prog-item__title')].map(
    (title) => title.textContent ?? '',
  )

const chip = (root: ParentNode, id: string): HTMLButtonElement => {
  const found = root.querySelector<HTMLButtonElement>(
    `.mp-prog-filter[data-filter="${id}"]`,
  )
  if (found === null) throw new Error(`no ${id} filter`)
  return found
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
  mocks.loadProgressModel.mockResolvedValue(record())
})

afterEach(() => {
  view?.unmount()
  view = null
  document.body.innerHTML = ''
  resetRunShell()
  vi.useRealTimers()
  mocks.loadProgressModel.mockReset()
  mocks.trackEvent.mockReset()
})

describe('the native Progress page, over the record', () => {
  it('reads the record and draws it, counting the visit', async () => {
    const page = await open()
    expect(
      page
        .querySelector('[data-testid="shell-progress"]')
        ?.getAttribute('data-state'),
    ).toBe('ready')
    expect(titles(page)).toEqual(['Long Note', 'C major scale', 'Octave Leap'])
    expect(mocks.trackEvent).toHaveBeenCalledWith('progress_viewed')
  })

  it('filters the history as the record filters it', async () => {
    const page = await open()
    chip(page, 'exercise').click()
    await settle()
    expect(titles(page)).toEqual(['Long Note'])
    expect(chip(page, 'exercise').getAttribute('aria-pressed')).toBe('true')
    expect(chip(page, 'all').getAttribute('aria-pressed')).toBe('false')
    expect(mocks.trackEvent).toHaveBeenCalledWith('progress_history_filtered')

    chip(page, 'weekly').click()
    await settle()
    expect(titles(page)).toEqual([])
    expect(page.querySelector('.mp-prog-history__none')?.textContent).toBe(
      'No recorded practice matches this filter.',
    )

    chip(page, 'all').click()
    await settle()
    expect(titles(page)).toEqual(['Long Note', 'C major scale', 'Octave Leap'])
  })

  it('opens the Leagues screen from the league card', async () => {
    const page = await open()
    expect(page.querySelector('.mp-prog-league__name')?.textContent).toBe(
      'Sparkwing',
    )
    page
      .querySelector<HTMLButtonElement>('[data-testid="progress-league"]')
      ?.click()
    expect(pushed()).toBe('leagues')
  })

  it('opens Voice Constellation as its own screen, not the web route', async () => {
    mocks.loadProgressModel.mockResolvedValue(record([VOICEPRINT]))
    window.location.hash = '#/progress'
    const page = await open()
    const row = page.querySelector<HTMLElement>(
      '[data-testid="progress-voice"] [data-action="voice-constellation"]',
    )
    expect(row?.textContent).toContain('Explore constellation')
    expect(row?.textContent).toContain('Closest voice: Freddie Mercury')
    // A button: as a link it went to #/voice-constellation, whose web route
    // covered the shell, notch and all.
    expect(row?.tagName).toBe('BUTTON')
    expect(row?.getAttribute('href')).toBeNull()

    row?.click()
    expect(pushed()).toBe('voice-constellation')
    expect(window.location.hash).toBe('#/progress')
    expect(mocks.trackEvent).toHaveBeenCalledWith(
      'progress_next_action_clicked',
    )
  })

  it('opens the share studio in a sheet, in place, for the moment in view', async () => {
    const page = await open()
    page
      .querySelector<HTMLButtonElement>('[data-testid="progress-share"]')
      ?.click()
    await settle()
    const studio = document.querySelector(
      '[data-testid="progress-share-studio"]',
    )
    expect(studio?.getAttribute('role')).toBe('group')
    expect(studio?.closest('[role="dialog"]')?.getAttribute('aria-label')).toBe(
      'Share this moment',
    )
    expect(mocks.trackEvent).toHaveBeenCalledWith('progress_share_opened')
    document
      .querySelector<HTMLButtonElement>('[aria-label="Close share studio"]')
      ?.click()
    await settle()
    expect(
      document.querySelector('[data-testid="progress-share-studio"]'),
    ).toBeNull()
    expect(mocks.trackEvent).toHaveBeenCalledWith('progress_share_cancelled')
  })

  it('shows an empty record its way in, and a failed read its Try again', async () => {
    mocks.loadProgressModel.mockResolvedValueOnce(
      buildProgressModel(
        {
          records: [],
          voiceprints: [],
          badgeDefinitions: [],
          userBadges: [],
          achievementDefinitions: [],
          userAchievements: [],
          challengeDefinitions: [],
          activityRows: [],
          recentActivity: [],
          league: null,
        },
        { now: NOW },
      ),
    )
    const empty = await open()
    expect(
      empty
        .querySelector('[data-testid="progress-empty-action"]')
        ?.getAttribute('href'),
    ).toBe('#/exercises')
    view?.unmount()

    mocks.loadProgressModel.mockRejectedValueOnce(new Error('Offline.'))
    const failed = await open()
    expect(
      failed.querySelector('[data-testid="progress-failure"]')?.textContent,
    ).toContain('Offline.')
    failed
      .querySelector<HTMLButtonElement>('[data-testid="progress-retry"]')
      ?.click()
    await settle()
    expect(mocks.loadProgressModel).toHaveBeenCalledTimes(3)
    expect(
      failed
        .querySelector('[data-testid="shell-progress"]')
        ?.getAttribute('data-state'),
    ).toBe('ready')
  })
})
