// Standalone route boundary — the laboratory query selects a level only in development builds.
import type { LevelDefinition } from '@irchiinnuss/glass-game'
import { untrack } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mounted = vi.hoisted(() => ({
  levels: [] as (LevelDefinition | undefined)[],
}))

vi.mock('@irchiinnuss/pitch-engine', () => ({
  configurePitchEngineAssets: vi.fn(),
}))
vi.mock('./AdventureScreen', () => ({
  AdventureScreen: (props: { level?: LevelDefinition }) => {
    mounted.levels.push(untrack(() => props.level))
    return null
  },
}))

beforeEach(() => {
  vi.resetModules()
  mounted.levels.length = 0
  document.body.innerHTML = '<div id="root"></div>'
})

afterEach(() => {
  vi.unstubAllEnvs()
  window.history.replaceState({}, '', '/')
  document.body.innerHTML = ''
})

async function mountAt(development: boolean, layout: string) {
  vi.stubEnv('DEV', development)
  window.history.replaceState({}, '', `/glass-game/?layout=${layout}`)
  await import('./standalone')
  await vi.waitFor(() => expect(mounted.levels).toHaveLength(1))
  return mounted.levels[0]
}

describe('standalone development route', () => {
  it('opens the distinct Promenade save identity directly in development', async () => {
    const level = await mountAt(true, 'cloudway-laboratory')
    expect(level?.id).toBe('cloudway-crystal-promenade-laboratory')
    expect(level?.exit.requiresCompleted).toEqual([
      'voice-home',
      'voice-third',
      'voice-fifth',
    ])
  })

  it('ignores the laboratory query in a production host', async () => {
    expect(await mountAt(false, 'cloudway-laboratory')).toBeUndefined()
  })

  it('leaves unknown layout queries on the normal entry', async () => {
    expect(
      await mountAt(true, 'cloudway-laboratory-unapproved'),
    ).toBeUndefined()
  })
})
