// ============================================================
// Lesson 14 song line — its states at rest, a play as it sounds, the still
// ============================================================
//
// WEB-SPEC, Toys 1: the windows, do − 1 to la + 1 and fa to la for the
// swell; each state's bands, words, breaths, chords and labels at rest; a
// take lit as far as it has sounded, its syllable in ink and its breath
// mark lit once reached, or under reduced motion each band lit whole as its
// note starts; the still's swell in light on both "star"s; and the mounted
// line, which names what it shows, keeps a take's light once it ends or is
// cut short, and follows the voice.

import { afterEach, describe, expect, it } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import { VoiceChoice } from '@/features/lessons/kit/voice-choice'
import { phraseSummary, SONG_SUMMARY, STILL_ALT } from './lines'
import { mountSongLine, playedScene, restingScene, secondsOf, summaryFor, takePlay, windowOf, } from './song-line'

afterEach(() => {
  VoiceChoice.set('lower')
  document.body.textContent = ''
})

/** A figure with its canvas, as the page's markup has one. */
function figure(): HTMLElement {
  document.body.innerHTML =
    '<figure class="band-chart" id="f"><canvas></canvas></figure>'
  const f = document.getElementById('f')
  if (f === null) throw new Error('no figure')
  return f
}

describe("Lesson 14's song line", () => {
  it('shows do − 1 to la + 1 in every phrase view, fa to la for the swell, over a phrase, the song or the two windows', () => {
    expect(windowOf('compact', 50)).toEqual([49, 60])
    expect(windowOf('live', 62)).toEqual([61, 72])
    expect(windowOf('swell', 50)).toEqual([55, 59])
    expect(
      ['compact', 'song', 'still', 'swell'].map((s) => secondsOf(s as 'song')),
    ).toEqual([6, 36, 36, 8.6])
  })

  it('rests each state as the spec draws it: phrase 1 unlit with its words, the song with its numbers and five unlit ticks, an ending over its numerals', () => {
    // Act
    const compact = restingScene('compact', 50)
    const song = restingScene('song', 50)
    const ending = restingScene('endings', 50, 2)
    const swell = restingScene('swell', 50)

    // Assert
    expect(compact.bands).toHaveLength(7)
    expect(compact.bands.every((b) => b.light === undefined)).toBe(true)
    expect(compact.breaths).toEqual([])
    expect(compact.words.map((w) => w.text)[0]).toBe('Twin-')
    expect(song.bands).toHaveLength(42)
    expect(song.words.map((w) => w.text)).toEqual([
      '1',
      '2',
      '3',
      '4',
      '5',
      '6',
    ])
    expect(song.breaths.map((b) => [b.t, b.lit, b.word])).toEqual(
      [5.7, 11.7, 17.7, 23.7, 29.7].map((t) => [t, false, false]),
    )
    expect(ending.chords.map((c) => c.text)).toEqual(['I', 'IV', 'I', 'V'])
    expect(swell.labels.map((l) => l.text)).toEqual([
      'the swell',
      "Lesson 5's push",
    ])
    expect(swell.bands.map((b) => b.c)).toEqual([700, 700])
  })

  it('holds the swell in light on both “star”s of the still, and lights its five ticks', () => {
    // Act
    const still = restingScene('still', 50)

    // Assert: phrases 1 and 5's long notes, at 4.5 s and 28.5 s
    const lit = still.bands.filter((b) => b.light !== undefined)
    expect(lit.map((b) => b.from)).toEqual([4.5, 28.5])
    expect(lit[1].light?.map((p) => [p.t, p.level])).toEqual([
      [28.5, 0.5],
      [29.1, 1],
      [29.7, 0.5],
    ])
    expect(still.breaths.every((b) => b.lit && !b.word)).toBe(true)
    expect(summaryFor('still', 50)).toBe(STILL_ALT)
    expect(summaryFor('song', 50)).toBe(SONG_SUMMARY)
  })

  it('lights take 2 as far as it has sounded: "star" on in ink at 5.1 s, its breath mark dark until 5.7 s', () => {
    // Arrange
    const rest = restingScene('compact', 50)
    const p = takePlay(2, 50)

    // Act
    const at = playedScene(rest, 50, p, 5.1, { reduced: false, whole: false })
    const whole = playedScene(rest, 50, p, 6, { reduced: false, whole: true })

    // Assert
    expect([at.bands[6].glow, at.bands[6].upTo]).toEqual([1, 5.1])
    expect(at.words[6]).toMatchObject({ text: 'star,', on: true })
    expect(at.breaths).toEqual([{ t: 5.7, lit: false, word: true }])
    expect(at.name).toBe('take 2')
    expect(whole.breaths[0].lit).toBe(true)
    expect(whole.bands.every((b) => b.glow === 0)).toBe(true)
    expect(whole.bands[6].upTo).toBe(5.7)
  })

  it('lights a band whole as its note starts under reduced motion, never part of it', () => {
    // Act
    const s = playedScene(
      restingScene('compact', 50),
      50,
      takePlay(1, 50),
      1.2,
      {
        reduced: true,
        whole: false,
      },
    )

    // Assert
    expect(s.bands.map((b) => b.upTo)).toEqual([0.75, 1.5, -1, -1, -1, -1, -1])
  })

  it('names what it shows, keeps a take cut short lit as far as it got, and follows the voice', () => {
    // Arrange
    const line = mountSongLine(figure(), {
      state: 'compact',
      active: () => true,
    })
    const first = line.summary

    // Act
    const d = line.play(takePlay(1, line.doMidi))
    d.cancel()
    const kept = line.chart.scene.song?.bands[0].upTo
    VoiceChoice.set('higher')

    // Assert
    expect(first).toBe(phraseSummary(0, 50))
    expect(kept).toBeGreaterThanOrEqual(0)
    expect(line.chart.scene.playhead).toBeNull()
    expect(line.doMidi).toBe(62)
    expect(line.summary).toBe(phraseSummary(0, 62))
  })
})
