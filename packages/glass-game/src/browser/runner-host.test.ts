// Runner host tests — typed progress separation and durable current-visit fallback.
import { describe, expect, it, vi } from 'vitest'
import type { GlassGameHost } from '../host'
import type { SavedRunnerProgress } from '../runner/contracts'
import { runnerCourseFixture } from './__fixtures__/runner-course'
import { createBrowserRunnerHost, resolveRunnerComfortableMidi, runnerComfortableMidiRange, } from './runner-host'

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
