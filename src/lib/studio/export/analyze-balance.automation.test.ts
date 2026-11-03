// Studio balance tests for lane lines — auto-balance measures a lane before its lines, as it measures it before its fader.
import { describe, expect, it, vi } from 'vitest'
import { reserveStudioMemory, studioReservedMemoryBytes, } from '../memory-budget'
import { measureStudioPcm } from '../metering/measure-async'
import { meterTone } from '../metering/meter.test-fixtures'
import { withStudioAutomation } from '../model/automation'
import { studioFixture } from '../model/model.test-fixtures'
import type { renderStudioArrangement } from '../playback/offline-render'
import { analyzeStudioBalance } from './analyze-balance'

describe('Studio balance with lane lines', () => {
  it("measures a lane without its volume and pan lines, and leaves the song's lines as they were", async () => {
    // Arrange
    const { project, asset } = studioFixture()
    const lined = withStudioAutomation(
      withStudioAutomation(project.tracks[0], 'volume', [
        { frame: 0, value: -30 },
      ]),
      'pan',
      [{ frame: 0, value: 1 }],
    )
    const song = { ...project, tracks: [lined] }
    const data = meterTone(48000, 0.5, 997, 0.1)
    const arrangement = vi.fn<typeof renderStudioArrangement>(async () => ({
      buffer: {
        numberOfChannels: 2,
        sampleRate: 48000,
        length: data.length,
        getChannelData: () => data,
      } as unknown as AudioBuffer,
      release: reserveStudioMemory(data.length * 8),
      projectId: song.id,
      revision: song.revision,
    }))

    // Act
    await analyzeStudioBalance(song, [asset], vi.fn(), {
      dependencies: {
        arrangement,
        measurePcm: ((reader, options) =>
          measureStudioPcm(reader, {
            ...options,
            createWorker: null,
          })) as typeof measureStudioPcm,
      },
    })

    // Assert
    const measured = arrangement.mock.calls[0][0].tracks[0]
    expect(measured.automation).toBeUndefined()
    expect(measured).toMatchObject({ gainDb: 0, pan: 0 })
    expect(song.tracks[0].automation).toEqual(lined.automation)
    expect(studioReservedMemoryBytes()).toBe(0)
  })
})
