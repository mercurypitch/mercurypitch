// Studio comparison tests — After plays the lane renders held for it, the dry Before never does, and the hold always ends.
import { describe, expect, it, vi } from 'vitest'
import { studioReservedMemoryBytes } from '../memory-budget'
import { studioFixture } from '../model/model.test-fixtures'
import type { renderStudioArrangement } from '../playback/offline-render'
import { prepareStudioComparison } from './prepare-comparison'
import { testAdapters } from './render-adapters.fixture'

describe('Studio comparison', () => {
  it('plays the held lane renders for After only, and lets them go before Before renders', async () => {
    // Arrange
    const { project, asset } = studioFixture()
    const adapters = testAdapters()
    const lanes = new Map()
    const release = vi.fn()
    const releasedAtRender: number[] = []
    const arrangement = vi.fn<typeof renderStudioArrangement>((...args) => {
      releasedAtRender.push(release.mock.calls.length)
      return adapters.arrangement(...args)
    })

    // Act
    const result = await prepareStudioComparison(project, [asset], vi.fn(), {
      dependencies: { ...adapters, arrangement },
      frozen: { lanes, release },
    })
    result.release()

    // Assert
    expect(arrangement.mock.calls.map((call) => call[3]?.frozen)).toEqual([
      lanes,
      undefined,
    ])
    expect(releasedAtRender).toEqual([0, 1])
    expect(studioReservedMemoryBytes()).toBe(0)
  })

  it('lets the held lane renders go when the song is refused before anything renders', async () => {
    // Arrange
    const { project } = studioFixture()
    const adapters = testAdapters()
    const release = vi.fn()

    // Act
    const comparing = prepareStudioComparison(project, [], vi.fn(), {
      dependencies: adapters,
      frozen: { lanes: new Map(), release },
    })

    // Assert
    await expect(comparing).rejects.toThrow()
    expect(adapters.arrangement).not.toHaveBeenCalled()
    expect(release).toHaveBeenCalled()
  })
})
