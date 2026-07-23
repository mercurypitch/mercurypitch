import { createRoot } from 'solid-js'
import { describe, expect, it } from 'vitest'
import { useStemMixerLyricsController } from '@/features/stem-mixer/useStemMixerLyricsController'

describe('lyric marker controller', () => {
  it('records onset, dwell, release, and the final word without a next click', () =>
    createRoot((dispose) => {
      const controller = useStemMixerLyricsController({
        sessionId: 'marker-controller-test',
        songTitle: 'Marker controller test',
        duration: () => 20,
        playing: () => true,
        elapsed: () => 0,
        seekToWithWindow: () => {},
      })

      controller.handleLyricsUpload({
        text: '[00:01.00] glow [00:04.50]now',
        format: 'lrc',
        filename: 'marker-test.lrc',
      })
      controller.setLrcTimingOffsetMs(0)
      controller.startLrcGen()

      controller.handleMarkerSample(0, 0, 0, 1, 'start')
      controller.handleMarkerSample(0, 0, 0.4, 2, 'move')
      controller.handleMarkerSample(0, 0, 0.4, 3, 'move')
      controller.handleMarkerSample(0, 0, 0.5, 4, 'end')
      expect(controller.lrcGenWordIdx()).toBe(1)

      controller.handleMarkerSample(0, 1, 0, 4.5, 'start')
      controller.handleMarkerSample(0, 1, 1, 5, 'end')

      expect(controller.lrcGenMode()).toBe(false)
      expect(controller.wordTimings()[0]).toEqual([1, 4.5])
      expect(controller.wordEndTimings()[0]).toEqual([4, 5])
      expect(controller.wordSweepTimings()[0]?.[0]).toEqual(
        expect.arrayContaining([
          { time: 2, progress: 0.4 },
          { time: 3, progress: 0.4 },
          { time: 4, progress: 1 },
        ]),
      )

      dispose()
    }))
})
