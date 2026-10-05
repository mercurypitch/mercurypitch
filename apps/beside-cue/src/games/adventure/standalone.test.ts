// Standalone route boundary — the laboratory query selects a level only in development builds.
import type { LevelDefinition } from '@irchiinnuss/glass-game'
import { untrack } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { BuildInfo } from '@/build-info'

const mounted = vi.hoisted(() => ({
  levels: [] as (LevelDefinition | undefined)[],
  runners: [] as boolean[],
  steering: [] as ('continuous' | undefined)[],
  cameras: [] as ('close' | 'angled' | undefined)[],
  obstacles: [] as ('crystal-study' | undefined)[],
  runnerPaces: [] as ('current' | 'learning' | 'responsive' | undefined)[],
}))
const build = vi.hoisted(() => ({ channel: 'dev' as BuildInfo['channel'] }))

vi.mock('@irchiinnuss/pitch-engine', () => ({
  configurePitchEngineAssets: vi.fn(),
}))
vi.mock('@/build-info', () => ({ BUILD: build }))
vi.mock('./AdventureScreen', () => ({
  AdventureScreen: (props: {
    level?: LevelDefinition
    runner?: boolean
    runnerSteering?: 'continuous'
    runnerCamera?: 'close' | 'angled'
    runnerObstacles?: 'crystal-study'
    runnerPace?: 'current' | 'learning' | 'responsive'
  }) => {
    mounted.levels.push(untrack(() => props.level))
    mounted.runners.push(untrack(() => props.runner === true))
    mounted.runnerPaces.push(untrack(() => props.runnerPace))
    mounted.steering.push(untrack(() => props.runnerSteering))
    mounted.cameras.push(untrack(() => props.runnerCamera))
    mounted.obstacles.push(untrack(() => props.runnerObstacles))
    return null
  },
}))

beforeEach(() => {
  vi.resetModules()
  mounted.levels.length = 0
  mounted.runners.length = 0
  mounted.steering.length = 0
  mounted.cameras.length = 0
  mounted.obstacles.length = 0
  mounted.runnerPaces.length = 0
  build.channel = 'dev'
  document.body.innerHTML = '<div id="root"></div>'
})

afterEach(() => {
  vi.unstubAllEnvs()
  window.history.replaceState({}, '', '/')
  document.body.innerHTML = ''
})

async function mountAt(development: boolean, layout: string, pace?: string) {
  vi.stubEnv('DEV', development)
  const paceQuery = pace === undefined ? '' : `&pace=${pace}`
  window.history.replaceState(
    {},
    '',
    `/glass-game/?layout=${layout}${paceQuery}`,
  )
  await import('./standalone')
  // The first development-level import compiles the content catalog; wait for
  // that mount to finish before resetting globals for the next route case.
  await vi.waitFor(() => expect(mounted.levels).toHaveLength(1), {
    timeout: 5000,
  })
  return mounted.levels[0]
}

describe('standalone development route', () => {
  it.each(['dev', 'ci', 'release'] as const)(
    'gates crystal study in %s builds',
    async (channel) => {
      build.channel = channel
      vi.stubEnv('DEV', channel === 'dev')
      window.history.replaceState(
        {},
        '',
        '/glass-game/?layout=singing-current&obstacles=crystal-study',
      )
      await import('./standalone')
      await vi.waitFor(() => expect(mounted.levels).toHaveLength(1), {
        timeout: 5000,
      })
      expect(mounted.obstacles).toEqual([
        channel === 'release' ? undefined : 'crystal-study',
      ])
    },
  )
  it.each([
    ['dev', 'singing-current', 'continuous', 'close', 'continuous', 'close'],
    ['dev', 'singing-current', 'continuous', 'angled', 'continuous', 'angled'],
    [
      'release',
      'singing-current',
      'continuous',
      'angled',
      undefined,
      undefined,
    ],
    ['ci', 'singing-current', 'continuous', 'default', 'continuous', undefined],
    ['ci', 'singing-current', 'lanes', 'close', undefined, 'close'],
    ['dev', 'singing-current', 'other', 'other', undefined, undefined],
    ['release', 'singing-current', 'continuous', 'close', undefined, undefined],
    ['dev', 'journey', 'continuous', 'close', undefined, undefined],
  ] as const)(
    'gates %s/%s steering=%s camera=%s independently',
    async (
      channel,
      layout,
      steering,
      camera,
      expectedSteering,
      expectedCamera,
    ) => {
      build.channel = channel
      vi.stubEnv('DEV', channel === 'dev')
      window.history.replaceState(
        {},
        '',
        `/glass-game/?layout=${layout}&steering=${steering}&camera=${camera}`,
      )
      await import('./standalone')
      // The first development-level import compiles the content catalog; wait for
      // that mount to finish before resetting globals for the next route case.
      await vi.waitFor(() => expect(mounted.levels).toHaveLength(1), {
        timeout: 5000,
      })
      expect(mounted.steering).toEqual([expectedSteering])
      expect(mounted.cameras).toEqual([expectedCamera])
    },
  )

  it.each([
    ['dev', 'current', true],
    ['ci', 'learning', false],
    ['dev', 'responsive', true],
  ] as const)(
    'routes the %s Singing Current %s trial through the gated host',
    async (channel, pace, development) => {
      build.channel = channel
      await mountAt(development, 'singing-current', pace)
      expect(mounted.runners).toEqual([true])
      expect(mounted.runnerPaces).toEqual([pace])
    },
  )

  it('drops the Singing Current override from a release host', async () => {
    build.channel = 'release'
    await mountAt(false, 'singing-current', 'current')
    expect(mounted.runners).toEqual([false])
    expect(mounted.runnerPaces).toEqual([undefined])
  })

  it('uses the canonical runner course for an unknown pace', async () => {
    await mountAt(true, 'singing-current', 'rush')
    expect(mounted.runners).toEqual([true])
    expect(mounted.runnerPaces).toEqual([undefined])
  })

  it('opens the contained singing Rosebud trial only in development', async () => {
    const level = await mountAt(true, 'living-glass')
    expect(level?.id).toBe('living-glass')
    expect(level?.breakables.map((exhibit) => exhibit.id)).toEqual([
      'living-glass/rosebud',
    ])
    expect(level?.presentation?.livingCrystalInteriors).toEqual([
      expect.objectContaining({
        effect: 'pearl-current',
        responseExhibitId: 'living-glass/rosebud',
      }),
    ])
  })

  it('ignores the contained trial query in a production host', async () => {
    expect(await mountAt(false, 'living-glass')).toBeUndefined()
  })

  it('opens the separately saved Thawing Song only in development', async () => {
    const level = await mountAt(true, 'thawing-song')
    expect(level?.id).toBe('cloudway-thawing-song-audition')
    expect(level?.melodyLesson?.stations).toHaveLength(5)
  })

  it('does not enable the melody preview through a production query', async () => {
    expect(await mountAt(false, 'thawing-song')).toBeUndefined()
  })

  it('opens the distinct Promenade save identity directly in development', async () => {
    const level = await mountAt(true, 'cloudway-laboratory')
    expect(level?.id).toBe('cloudway-crystal-promenade-first-slice')
    expect(level?.exit.requiresCompleted).toEqual([
      'voice-home',
      'voice-third',
      'voice-fifth',
    ])
  })

  it('opens the separate cardinal mechanics route only by its development query', async () => {
    const level = await mountAt(true, 'cloudway-mechanics-preview')
    expect(level?.id).toBe('cloudway-crystal-promenade-mechanics-preview')
    expect(level?.authored).toMatchObject({
      layoutId: 'crystal-promenade-mechanics-preview',
      contentRevision: 2,
    })
  })

  it('opens the isolated quarter-turn art and footing study in development', async () => {
    const level = await mountAt(true, 'quarter-turn-art')
    expect(level?.id).toBe('cloudway-quarter-turn-art-study-v1')
    expect(level?.authored).toMatchObject({
      layoutId: 'quarter-turn-art-study-v1',
      contentRevision: 1,
    })
    expect(
      level?.platforms.filter(
        (platform) =>
          platform.renderId === 'cloudway-pearl-teal-quarter-turn-a',
      ),
    ).toHaveLength(2)
  })

  it('opens both living-crystal v2 palettes without changing the study support', async () => {
    const pearl = await mountAt(true, 'living-crystal')
    expect(pearl?.id).toBe('living-crystal-pearl-roots-art-study-v2')
    expect(pearl?.presentation?.livingCrystalInteriors).toEqual([
      expect.objectContaining({ variant: 'pearl-roots' }),
    ])

    vi.resetModules()
    mounted.levels.length = 0
    document.body.innerHTML = '<div id="root"></div>'
    vi.stubEnv('DEV', true)
    window.history.replaceState(
      {},
      '',
      '/glass-game/?layout=living-crystal&interior=living-amber',
    )
    await import('./standalone')
    // The first development-level import compiles the content catalog; wait for
    // that mount to finish before resetting globals for the next route case.
    await vi.waitFor(() => expect(mounted.levels).toHaveLength(1), {
      timeout: 5000,
    })
    expect(mounted.levels[0]?.id).toBe(
      'living-crystal-living-amber-art-study-v2',
    )
  })

  it('ignores the laboratory query in a production host', async () => {
    expect(await mountAt(false, 'cloudway-laboratory')).toBeUndefined()
  })

  it('ignores the mechanics preview query in a production host', async () => {
    expect(await mountAt(false, 'cloudway-mechanics-preview')).toBeUndefined()
  })

  it('leaves unknown layout queries on the normal entry', async () => {
    expect(
      await mountAt(true, 'cloudway-laboratory-unapproved'),
    ).toBeUndefined()
  })
})
