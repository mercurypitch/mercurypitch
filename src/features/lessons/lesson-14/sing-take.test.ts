// ============================================================
// Lesson 14 the take — the guide and the live line on the song line
// ============================================================
//
// WEB-SPEC, Toys 4, state 6: take 1 follows the phrase at 80 beats a
// minute and take 2 its plan, with the breath after "star"; before the
// voice do's band glows; from the first voiced frame a playhead runs along
// the phrase and each band lights as it passes; the violet line is folded
// around the band under the playhead, with the octave tag within 50 cents
// of a band an octave away, and a gap where no voice was heard; and the
// line comes back in absolute cents for the card to keep.

import { afterEach, describe, expect, it } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import type { PitchFrame } from '@/features/lessons/kit/listen'
import type { ListenModule } from '@/features/lessons/kit/mic-hold'
import { hz } from '@/features/lessons/kit/notes'
import { foldCents, hzToCents } from '@/lib/mirror/metrics'
import { guideOf, liveDrawer, noteAt } from './sing-take'
import { mountSongLine } from './song-line'

afterEach(() => {
  document.body.textContent = ''
})

const mod = { hzToCents, foldCents } as unknown as ListenModule

/** The live chart and its octave tag, as Sing it's markup has them. */
function liveChart() {
  document.body.innerHTML =
    '<figure class="band-chart" id="c"><canvas></canvas></figure><span id="tag" hidden></span>'
  const line = mountSongLine(document.getElementById('c') as HTMLElement, {
    state: 'live',
    followVoice: false,
    active: () => true,
  })
  return { line, tag: document.getElementById('tag') as HTMLElement }
}

const frame = (t: number, midi: number | null): PitchFrame =>
  ({
    t,
    f0: midi === null ? 0 : hz(midi),
    conf: midi === null ? 0 : 0.9,
    rms: 0.1,
  }) as PitchFrame

describe("Lesson 14's take", () => {
  it('guides take 1 by the phrase alone and take 2 by its plan, the breath after “star”', () => {
    // Act
    const one = guideOf(1, 50)
    const two = guideOf(2, 50)

    // Assert
    expect([one.breaths, one.name]).toEqual([undefined, 'take 1'])
    expect(two.breaths).toEqual([{ t: 5.7, word: true }])
    expect(noteAt(one.notes, 3.1).midi).toBe(59)
    expect(noteAt(one.notes, 9).midi).toBe(57)
  })

  it('glows do’s band before the voice, then lights each band whole as its note starts under reduced motion, the line folded to the band under it', () => {
    // Arrange
    const { line, tag } = liveChart()
    const live = liveDrawer({ mod, line, id: 1, tag })

    // Act: before the voice; then an octave low on "twin-" at 0.3 s, a gap, and so at 1.6 s
    live.draw(null, null)
    const before = line.chart.scene.song?.bands[0].glow
    live.draw(frame(1.3, 38), 1)
    const octave = [tag.hidden, tag.textContent]
    live.draw(frame(1.5, null), 1)
    live.draw(frame(2.6, 57), 1)

    // Assert
    expect(before).toBe(1)
    expect(octave).toEqual([false, 'octave lower'])
    expect(line.chart.scene.line).toEqual([
      { t: expect.closeTo(0.3, 9) as number, c: 0 },
      { t: expect.closeTo(0.5, 9) as number, c: null },
      { t: expect.closeTo(1.6, 9) as number, c: 700 },
    ])
    // reduced motion, as the doubles report it: no playhead, each band lit whole
    expect(line.chart.scene.playhead).toBeNull()
    expect(line.chart.scene.song?.bands.map((b) => b.upTo)).toEqual([
      0.75, 1.5, 2.25, -1, -1, -1, -1,
    ])
    expect(live.trace().map((p) => p.c)).toEqual([5000, null, 5700])
  })
})
