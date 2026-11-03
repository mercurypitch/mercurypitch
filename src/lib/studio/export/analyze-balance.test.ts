// Studio balance analysis tests — every lane plays the renders held for it, and the hold always ends.
import { describe, expect, it, vi } from 'vitest'
import { createStudioTrack } from '../model/defaults'
import { studioFixture } from '../model/model.test-fixtures'
import { analyzeStudioBalance } from './analyze-balance'
import { testAdapters } from './render-adapters.fixture'
import { renderStudioWav } from './render-wav'

/** The fixture song with a second lane playing the same take. */
function twoLanes() {
  const { project, asset, clip } = studioFixture()
  return {
    asset,
    project: {
      ...project,
      tracks: [
        ...project.tracks,
        createStudioTrack({
          id: 'track-2',
          name: 'Bass',
          order: 1,
          role: 'bass',
        }),
      ],
      clips: [...project.clips, { ...clip, id: 'clip-2', trackId: 'track-2' }],
    },
  }
}

describe('Studio balance analysis', () => {
  it('plays the held lane renders for every lane and lets them go only once each lane is measured', async () => {
    // Arrange
    const { project, asset } = twoLanes()
    const adapters = testAdapters()
    const lanes = new Map()
    const release = vi.fn()
    const releasedAtMeasure: number[] = []
    const measurePcm = vi.fn<typeof adapters.measurePcm>((...args) => {
      releasedAtMeasure.push(release.mock.calls.length)
      return adapters.measurePcm(...args)
    })

    // Act
    const proposal = await analyzeStudioBalance(project, [asset], vi.fn(), {
      dependencies: { ...adapters, measurePcm },
      frozen: { lanes, release },
    })

    // Assert
    expect(Object.keys(proposal.balanceGainDbByTrack)).toEqual([
      'track-1',
      'track-2',
    ])
    expect(
      adapters.arrangement.mock.calls.map((call) => call[3]?.frozen),
    ).toEqual([lanes, lanes])
    expect(releasedAtMeasure).toEqual([0, 0])
    expect(release).toHaveBeenCalledOnce()
  })

  it('lets the held lane renders go when another render holds the admission', async () => {
    // Arrange
    const { project, asset } = twoLanes()
    let finish!: () => void
    const adapters = testAdapters()
    adapters.arrangement.mockImplementationOnce(async () => {
      await new Promise<void>((resolve) => {
        finish = resolve
      })
      throw new Error('The export was cancelled.')
    })
    const exporting = renderStudioWav(project, [asset], vi.fn(), {
      dependencies: adapters,
    })
    const release = vi.fn()

    // Act
    const analysis = analyzeStudioBalance(project, [asset], vi.fn(), {
      dependencies: adapters,
      frozen: { lanes: new Map(), release },
    })

    // Assert
    await expect(analysis).rejects.toThrow('still rendering')
    expect(release).toHaveBeenCalledOnce()
    finish()
    await expect(exporting).rejects.toThrow('cancelled')
  })

  it('lets the held lane renders go when a lane fails to render', async () => {
    // Arrange
    const { project, asset } = twoLanes()
    const adapters = testAdapters()
    adapters.arrangement.mockRejectedValueOnce(new Error('No room to render.'))
    const release = vi.fn()

    // Act
    const analysis = analyzeStudioBalance(project, [asset], vi.fn(), {
      dependencies: adapters,
      frozen: { lanes: new Map(), release },
    })

    // Assert
    await expect(analysis).rejects.toThrow('No room to render.')
    expect(release).toHaveBeenCalledOnce()
  })
})
