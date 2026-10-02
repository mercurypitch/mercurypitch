// Runner host tests — typed progress separation and durable current-visit fallback.
import { describe, expect, it, vi } from 'vitest'
import type { GlassGameHost } from '../host'
import type { SavedRunnerProgress } from '../runner/contracts'
import { clampRunnerAudioPreferences, RUNNER_AUDIO_DEFAULTS, } from '../runner/session-contracts'
import { runnerCourseFixture } from './__fixtures__/runner-course'
import { createBrowserRunnerHost, readRunnerAudioPreferences, resolveRunnerComfortableMidi, RUNNER_AUDIO_PREFERENCE, runnerComfortableMidiRange, } from './runner-host'

function gallery() {
  const values = new Map<string, string>()
  const host = {
    readPreference: vi.fn((key: string) => values.get(key) ?? null),
    writePreference: vi.fn((key: string, value: string) => {
      values.set(key, value)
    }),
    saveProgress: vi.fn(),
  } as unknown as GlassGameHost
  return { host, values }
}
describe('runner host', () => {
  it('migrates the old music mute while keeping a separate audible example level', () => {
    const { host, values } = gallery()
    values.set('runner-music-muted:v1', 'true')
    const runner = createBrowserRunnerHost(host)

    expect(readRunnerAudioPreferences(runner)).toEqual({
      musicMuted: true,
      musicVolume: 0.35,
      guideVolume: 0.65,
      effectsVolume: 0.65,
    })
    expect(JSON.parse(values.get(RUNNER_AUDIO_PREFERENCE)!)).toEqual({
      musicMuted: true,
      musicVolume: 0.35,
      guideVolume: 0.65,
      effectsVolume: 0.65,
    })
  })
  it('clamps stored volumes and prefers the saved mix over legacy mute', () => {
    const { host, values } = gallery()
    values.set('runner-music-muted:v1', 'true')
    values.set(
      RUNNER_AUDIO_PREFERENCE,
      JSON.stringify({ musicMuted: false, musicVolume: -5, guideVolume: 8 }),
    )

    expect(readRunnerAudioPreferences(createBrowserRunnerHost(host))).toEqual({
      musicMuted: false,
      musicVolume: 0,
      guideVolume: 1,
      effectsVolume: 0.65,
    })
  })
  it.each(['null', '[]', '{broken', '42'])(
    'falls back safely from malformed saved mix %s',
    (stored) => {
      const { host, values } = gallery()
      values.set(RUNNER_AUDIO_PREFERENCE, stored)

      expect(readRunnerAudioPreferences(createBrowserRunnerHost(host))).toEqual(
        RUNNER_AUDIO_DEFAULTS,
      )
    },
  )
  it('retains the last valid level for non-finite live writes and preserves explicit zero', () => {
    const previous = {
      musicMuted: true,
      musicVolume: 0.2,
      guideVolume: 0.8,
      effectsVolume: 0.65,
    }

    expect(
      clampRunnerAudioPreferences(
        { musicVolume: Infinity, guideVolume: NaN },
        previous,
      ),
    ).toEqual(previous)
    expect(clampRunnerAudioPreferences({ musicVolume: 0 }, previous)).toEqual({
      ...previous,
      musicVolume: 0,
    })
  })
  it('keeps failed writes across adapter recreation even when stale storage is readable', () => {
    const { host, values } = gallery()
    values.set('runner-music-muted:v1', 'false')
    vi.mocked(host.writePreference).mockImplementation(() => undefined)
    createBrowserRunnerHost(host).writePreference(
      'runner-music-muted:v1',
      'true',
    )
    expect(
      createBrowserRunnerHost(host).readPreference('runner-music-muted:v1'),
    ).toBe('true')
  })
  it('round trips runner progress without invoking gallery progress storage', () => {
    const { host } = gallery()
    const runner = createBrowserRunnerHost(host)
    const progress: SavedRunnerProgress = {
      version: 1,
      courseId: 'test',
      courseRevision: 1,
      rewardsRevision: 1,
      completed: true,
      bestTargetQualities: [],
      collectedRewardIds: ['finish'],
    }
    runner.saveRunnerProgress(progress)
    expect(runner.loadRunnerProgress('test')).toEqual(progress)
    expect(host.saveProgress).not.toHaveBeenCalled()
  })
  it('uses memory when storage is blocked, and treats corrupt stored JSON as no progress', () => {
    const { host, values } = gallery()
    values.set('runner-progress:v1:bad', '{broken')
    const runner = createBrowserRunnerHost(host)
    expect(runner.loadRunnerProgress('bad')).toBeNull()
    vi.mocked(host.readPreference).mockImplementation(() => {
      throw new Error('Blocked')
    })
    vi.mocked(host.writePreference).mockImplementation(() => {
      throw new Error('Blocked')
    })
    runner.writePreference('test', 'yes')
    expect(createBrowserRunnerHost(host).readPreference('test')).toBe('yes')
  })
  it('resolves a legal adjustable root for every phrase endpoint', () => {
    const original = runnerCourseFixture()
    const course = {
      ...original,
      targets: [
        {
          ...original.targets[0]!,
          notes: [
            {
              ...original.targets[0]!.notes[0]!,
              startOffsetSemitones: -5,
              endOffsetSemitones: 12,
            },
          ],
        },
      ],
    }
    expect(runnerComfortableMidiRange(course)).toEqual({
      minimumMidi: 50,
      maximumMidi: 69,
    })
    expect(resolveRunnerComfortableMidi(course, '50')).toBe(50)
    for (const stored of [null, '', 'NaN', '100', '60.5'])
      expect(resolveRunnerComfortableMidi(course, stored)).toBe(60)
  })
})
