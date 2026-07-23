import { createRoot } from 'solid-js'
import { describe, expect, it } from 'vitest'
import { useStemMixerLyricsController } from '@/features/stem-mixer/useStemMixerLyricsController'

describe('lyric marker controller', () => {
  it('clears stale recovery data when replacement lyrics are imported', () =>
    createRoot((dispose) => {
      const sessionId = 'marker-replacement-test'
      const key = `lyrics_gen_v1_${sessionId}`
      localStorage.setItem(key, '{"lineTimes":[99],"lineIdx":1}')
      const controller = useStemMixerLyricsController({
        sessionId,
        songTitle: 'Replacement test',
        duration: () => 20,
        playing: () => false,
        elapsed: () => 0,
        seekToWithWindow: () => {},
      })

      controller.handleLyricsUpload({
        text: '[00:01.00]Replacement',
        format: 'lrc',
        filename: 'replacement.lrc',
      })

      expect(localStorage.getItem(key)).toBeNull()
      dispose()
    }))

  it('preserves earlier work after resuming and partially finishing', () =>
    createRoot((dispose) => {
      const sessionId = 'marker-resume-test'
      const original = `[00:01.00]Alpha
[00:05.00]Beta
[00:09.00]Gamma`
      const controller = useStemMixerLyricsController({
        sessionId,
        songTitle: 'Marker resume test',
        duration: () => 20,
        playing: () => true,
        elapsed: () => 0,
        seekToWithWindow: () => {},
      })
      controller.handleLyricsUpload({
        text: original,
        format: 'lrc',
        filename: 'resume-test.lrc',
      })
      localStorage.setItem(
        `lyrics_gen_v1_${sessionId}`,
        JSON.stringify({
          lineTimes: [2],
          wordTimings: { 0: [2] },
          wordEndTimings: { 0: [3] },
          wordSweepTimings: {},
          lineIdx: 1,
          wordIdx: 0,
          inputMode: 'marker',
          touchedLines: [0],
          timestamp: Date.now(),
        }),
      )
      controller.setLrcTimingOffsetMs(0)
      controller.startLrcGen()

      expect(controller.lrcGenLineIdx()).toBe(1)
      controller.handleMarkerSample(1, 0, 0, 6, 'start')
      controller.handleMarkerSample(1, 0, 1, 7, 'end')
      controller.handleLrcGenFinish()

      expect(controller.lrcGenMode()).toBe(false)
      expect(controller.canonicalLrcLines().map((line) => line.time)).toEqual([
        2, 6, 9,
      ])
      expect(controller.wordTimings()[0]).toEqual([2])
      expect(controller.wordTimings()[1]).toEqual([6])

      localStorage.removeItem(`lyrics_gen_v1_${sessionId}`)
      dispose()
    }))

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

  it('keeps crossed words positive when reaction correction clamps at zero', () =>
    createRoot((dispose) => {
      const controller = useStemMixerLyricsController({
        sessionId: 'marker-zero-boundary-test',
        songTitle: 'Marker zero boundary test',
        duration: () => 10,
        playing: () => true,
        elapsed: () => 0,
        seekToWithWindow: () => {},
      })
      controller.handleLyricsUpload({
        text: '[00:01.00]one [00:02.00]two',
        format: 'lrc',
        filename: 'zero-boundary.lrc',
      })
      controller.setLrcTimingOffsetMs(180)
      controller.startLrcGen()

      controller.handleMarkerSample(0, 0, 0, 0.05, 'start')
      controller.handleMarkerSample(0, 1, 0.5, 0.05, 'move')

      expect(controller.lrcGenWordTimings()[0]).toEqual([0, 0.001])
      expect(controller.lrcGenWordEndTimings()[0]?.[0]).toBe(0.001)
      controller.handleLrcGenReset()
      dispose()
    }))

  it('restores the complete pre-mapping snapshot when changes are discarded', () =>
    createRoot((dispose) => {
      const original =
        '[00:01.00] first [00:02.00]line\n[00:05.00] second [00:06.00]line'
      const controller = useStemMixerLyricsController({
        sessionId: 'marker-discard-test',
        songTitle: 'Marker discard test',
        duration: () => 20,
        playing: () => true,
        elapsed: () => 0,
        seekToWithWindow: () => {},
      })

      controller.handleLyricsUpload({
        text: original,
        format: 'lrc',
        filename: 'discard-test.lrc',
      })
      controller.setLrcTimingOffsetMs(0)
      controller.startLrcGen()
      controller.handleMarkerSample(0, 0, 0, 3, 'start')
      controller.handleMarkerSample(0, 0, 1, 4, 'end')

      expect(controller.lrcGenMode()).toBe(true)
      expect(controller.lrcGenWordTimings()[0]).toBeDefined()

      controller.handleLrcGenReset()

      expect(controller.lrcGenMode()).toBe(false)
      expect(controller.rawLyricsText()).toBe(original)
      expect(controller.canonicalLrcLines()[0].wordTimes).toEqual([1, 2])
      expect(controller.wordEndTimings()).toEqual({})
      expect(controller.wordSweepTimings()).toEqual({})
      dispose()
    }))

  it('keeps zero-length rest sentinels out of visible lyric rows', () =>
    createRoot((dispose) => {
      const controller = useStemMixerLyricsController({
        sessionId: 'marker-zero-rest-test',
        songTitle: 'Zero rest test',
        duration: () => 30,
        playing: () => false,
        elapsed: () => 0,
        seekToWithWindow: () => {},
      })

      controller.handleLyricsUpload({
        text: `[00:01.00]Before
[00:10.00]~Rest~
[00:10.00]After`,
        format: 'lrc',
        filename: 'zero-rest-test.lrc',
      })

      expect(
        controller.canonicalLrcLines().some((line) => line.type === 'rest'),
      ).toBe(true)
      expect(controller.displayLines().map((line) => line.text)).toEqual([
        'Before',
        'After',
      ])
      dispose()
    }))
})
