// ============================================================
// Lesson 14 steps — the song line's five states and their controls
// ============================================================
//
// WEB-SPEC, Toys 1, on the page's own markup and deck, its runs recorded
// (kit/run-recorder.test-fixtures.ts): each step shows its own rows; Play
// the song sings the verse breath by breath and each phrase button its own
// phrase, the caption giving the phrase's words and the status its long
// note; Merc's two takes name their breaths as they light; the swell and
// the push each draw a line in so's band and its level in the strip, and
// keep both; the endings play their phrase over its chords and name the
// cadence once it ends; both takes play back to back, and the scrub names
// the moment it draws, "star" at its loudest at 5.1 s. Every play reads
// "Stop" while it sounds and a second press stops it; one sound plays at a
// time, and leaving a step stops its play, while the step shown again
// stops nothing. The Merc of the chosen voice sings Merc's notes.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import type * as MercDuo from '@/features/lessons/kit/merc-duo'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import type * as RunModule from '@/features/lessons/kit/run'
import { live, resetRuns, runs, } from '@/features/lessons/kit/run-recorder.test-fixtures'
import { Sound } from '@/features/lessons/kit/sound'
import { VoiceChoice } from '@/features/lessons/kit/voice-choice'
import { BREATH_LINE, CADENCE_LINE } from './lines'
import { el, mountSteps, nameOf, settle, shown, soundOn, } from './page-dom.test-fixtures'
import { PUSH_AT, SWELL_SEC } from './song'
import { FIG, joinLevels, songPhrase, stepThreeLevel, stepThreeLine, } from './steps'

vi.mock('@/features/lessons/kit/run', async (actual) => ({
  ...(await actual<typeof RunModule>()),
  ...(await import('@/features/lessons/kit/run-recorder.test-fixtures'))
    .recordedRuns,
}))

const duo = vi.hoisted(() => ({ sing: vi.fn() }))

vi.mock('@/features/lessons/kit/merc-duo', async (actual) => ({
  ...(await actual<typeof MercDuo>()),
  mercSing: duo.sing,
}))

beforeEach(() => {
  localStorage.clear()
  resetRuns()
  soundOn()
})

afterEach(async () => {
  // the last play stopped, and its ending heard, before the next test
  NowPlaying.claim(() => undefined)
  await settle()
  vi.useRealTimers()
  vi.restoreAllMocks()
  duo.sing.mockReset()
  VoiceChoice.set('lower')
  window.location.hash = ''
  document.body.textContent = ''
})

/** The stage's rows that show now, by their controls' words. */
const rowsShown = (): string[] =>
  Array.from(
    document.querySelectorAll<HTMLElement>(
      '#toySong .song-row, #toySong .phrase-grid',
    ),
  )
    .filter((r) => !r.hidden)
    .map((r) =>
      Array.from(r.querySelectorAll<HTMLElement>('button, input'), (b) =>
        b.hidden || b.closest('[hidden]') !== null ? '' : nameOf(b),
      )
        .filter((t) => t !== '')
        .join(' | '),
    )

const status = (): string => el('#toySong [data-song-status]').textContent ?? ''
const caption = (): string =>
  el('#toySong [data-song-caption]').textContent ?? ''

describe("the song's pieces", () => {
  it('takes a phrase of the song from its own start, each but the last breathing for its last 0.3 s', () => {
    // Act
    const first = songPhrase(0, 50)
    const last = songPhrase(5, 50)

    // Assert
    expect(first).toHaveLength(7)
    expect([first[0].from, first[6].from, first[6].to]).toEqual([0, 4.5, 5.7])
    expect(last[6].to).toBeCloseTo(6, 6)
    expect(first.map((n) => n.midi)).toEqual([50, 50, 57, 57, 59, 59, 57])
  })

  it("draws Step 3's swell in so's band and the push climbing out of it, each in its own window", () => {
    // Act
    const swell = stepThreeLine('swell', SWELL_SEC)
    const push = stepThreeLine('push', SWELL_SEC)

    // Assert: in from 40 low, then level on so (700 cents over do); the push 60 over by its end
    expect(swell[0]).toEqual({ t: 0, c: 660 })
    expect(swell.at(-1)).toEqual({ t: SWELL_SEC, c: 700 })
    expect(swell.filter((p) => p.t >= 0.5).every((p) => p.c === 700)).toBe(true)
    expect(push[0].t).toBe(PUSH_AT)
    expect(push.at(-1)).toEqual({ t: PUSH_AT + SWELL_SEC, c: 760 })
    expect(stepThreeLine('push', 1)).toHaveLength(21)
  })

  it("draws Step 3's level in the strip as height, the swell at its fullest at 2.5 s, pinched to nothing between the windows", () => {
    // Act
    const swell = stepThreeLevel('swell', SWELL_SEC)
    const push = stepThreeLevel('push', SWELL_SEC)
    const both = joinLevels(swell, push)

    // Assert
    expect(swell.map((p) => [p.t, p.level])).toEqual([
      [0, 0.5],
      [1, 0.5],
      [2.5, 1],
      [4, 0.5],
    ])
    expect(push.at(-1)?.level).toBeCloseTo(1, 2)
    expect(
      both.filter((p) => p.t > SWELL_SEC && p.t < PUSH_AT).map((p) => p.level),
    ).toEqual([0, 0])
    expect(stepThreeLevel('swell', 0)).toEqual([])
  })
})

describe("the steps' song line", () => {
  it("shows each step's own controls and its figure label, and nothing of another step's", async () => {
    // Arrange
    const deck = mountSteps()
    const seen: [string, string[]][] = []

    // Act
    for (const n of [1, 2, 3, 4, 5]) {
      deck.show(n)
      await settle()
      seen.push([el('#toySong [data-fig-label]').innerHTML, rowsShown()])
    }

    // Assert
    expect(seen).toEqual([
      [
        FIG[1],
        [
          'Play the song',
          'Play phrase 1: Twinkle, twinkle, little star | Play phrase 2: How I wonder what you are | Play phrase 3: Up above the world so high | Play phrase 4: Like a diamond in the sky | Play phrase 5: Twinkle, twinkle, little star | Play phrase 6: How I wonder what you are',
        ],
      ],
      [FIG[2], ["Play Merc's take 1 | Play Merc's take 2"]],
      [FIG[3], ["Play the swell | Play Lesson 5's push"]],
      [
        FIG[4],
        [
          'Play phrase 2, How I wonder what you are, with its chords | Play phrase 3, Up above the world so high, with its chords',
        ],
      ],
      [FIG[5], ['Play both takes', 'Scrub through take 2']],
    ])
  })

  it('sings the whole song breath by breath, its button a Stop while it plays, and stops it at a second press', async () => {
    // Arrange
    mountSteps()
    const play = shown('[data-song-play="song"]')

    // Act
    play.click()
    const playing = [nameOf(play), play.classList.contains('is-on')]
    play.click()
    await settle()

    // Assert: six voices, one a phrase, the verse's 36 s
    expect(runs).toHaveLength(1)
    expect(runs[0].kind).toBe('lines')
    expect(runs[0].lines).toHaveLength(6)
    expect(runs[0].o.length).toBeCloseTo(36, 6)
    expect(playing).toEqual(['Stop the song', true])
    expect(runs[0].stopped).toBe(true)
    expect([nameOf(play), play.classList.contains('is-on')]).toEqual([
      'Play the song',
      false,
    ])
    expect(play.hasAttribute('aria-label')).toBe(false)
  })

  it('plays a phrase alone, captions its words, marks its button and names its long note as it comes', () => {
    // Arrange
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    mountSteps()
    const two = shown('[data-phrase="2"]')

    // Act
    two.click()
    vi.advanceTimersByTime(0)
    const named = [nameOf(two), caption(), two.getAttribute('aria-current')]
    vi.advanceTimersByTime(4500)

    // Assert: one voice, its seven notes, the last cut 0.3 s short for the breath
    expect(runs[0].lines).toHaveLength(1)
    expect(runs[0].o.length).toBeCloseTo(5.7, 6)
    expect(named).toEqual([
      'Stop phrase 2: How I wonder what you are',
      'How I wonder what you are!',
      'true',
    ])
    expect(status()).toBe('Phrase 2 ends on its long note: “are”.')
  })

  it("names each of Merc's breaths as it lights, and lets one sound play at a time", async () => {
    // Arrange
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const deck = mountSteps()
    deck.show(2)
    await settle()

    // Act
    shown('[data-song-play="take1"]').click()
    vi.advanceTimersByTime(4200)
    const first = status()
    shown('[data-song-play="take2"]').click()
    vi.advanceTimersByTime(5700)

    // Assert
    expect(first).toBe(BREATH_LINE[1])
    expect(status()).toBe(BREATH_LINE[2])
    expect(runs.map((r) => r.stopped)).toEqual([true, false])
    expect(nameOf(shown('[data-song-play="take1"]'))).toBe("Play Merc's take 1")
    expect(nameOf(shown('[data-song-play="take2"]'))).toBe("Stop Merc's take 2")
  })

  it('has the Merc of the chosen voice sing each of his notes, and rest at a breath', () => {
    // Arrange: the higher voice, chosen
    VoiceChoice.set('higher')
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    mountSteps()

    // Act: phrase 1, heard through its breath
    shown('[data-phrase="1"]').click()
    vi.advanceTimersByTime(5800)

    // Assert
    const calls = duo.sing.mock.calls as [string, number, boolean][]
    expect(new Set(calls.map((c) => c[0]))).toEqual(new Set(['orange']))
    expect(calls.filter((c) => c[2]).length).toBe(7)
    expect(calls.at(-1)?.[2]).toBe(false)
  })

  it('plays the swell and the push without a Merc, and keeps both lines drawn', async () => {
    // Arrange
    const deck = mountSteps()
    deck.show(3)
    await settle()

    // Act: each heard to its end
    shown('[data-song-play="swell"]').click()
    runs[0].end(true)
    await settle()
    shown('[data-song-play="push"]').click()
    runs[1].end(true)
    await settle()

    // Assert
    expect(runs.map((r) => r.kind)).toEqual(['line', 'line'])
    expect(duo.sing).not.toHaveBeenCalled()
    const scene = deck.line.chart.scene
    expect(scene.line.some((p) => p.c === 660)).toBe(true)
    expect(scene.line.some((p) => p.c !== null && p.c > 750)).toBe(true)
  })

  it('plays phrase 2 over its chords and names its perfect cadence once it ends', async () => {
    // Arrange
    const deck = mountSteps()
    deck.show(4)
    await settle()

    // Act
    shown('[data-song-play="are"]').click()
    runs.forEach((r) => r.end(true))
    await settle()

    // Assert: Merc's line and the chords, soft, under his 0.2
    expect(runs.map((r) => r.kind)).toEqual(['lines', 'notes'])
    expect(runs[1].notes).toHaveLength(12)
    expect(new Set(runs[1].notes.map((n) => [n.kind, n.gain].join()))).toEqual(
      new Set(['soft,0.05']),
    )
    expect(status()).toBe(CADENCE_LINE[1])
  })

  it('plays both takes back to back, a second apart, and scrubs take 2 to "star" at its loudest, stopping what sounds', async () => {
    // Arrange
    const deck = mountSteps()
    deck.show(5)
    await settle()
    shown('[data-song-play="both"]').click()
    const scrub = shown<HTMLInputElement>('[data-song-scrub]')

    // Act
    scrub.value = '5.1'
    scrub.dispatchEvent(new Event('input'))
    await settle()

    // Assert: take 1's voices, then take 2's from 7 s
    expect(runs[0].lines.map((l) => l.t)).toEqual([0, 4.5, 7])
    expect(runs[0].stopped).toBe(true)
    expect(scrub.getAttribute('aria-valuetext')).toBe(
      '5.1 seconds of 6: “star”, at its loudest',
    )
    expect(deck.line.chart.scene.playhead).toBeCloseTo(5.1, 6)
  })

  it('stops a step’s play when the deck leaves the step, and nothing when the step is shown again', async () => {
    // Arrange
    const deck = mountSteps()
    shown('[data-song-play="song"]').click()

    // Act: the same step again, as a layout switch shows it, then the next
    deck.show(1)
    await settle()
    const after = live().length
    deck.show(2)
    await settle()

    // Assert
    expect(after).toBe(1)
    expect(live()).toEqual([])
  })

  it('draws a play with the sound off, silently', () => {
    // Arrange
    vi.spyOn(Sound, 'canPlay').mockReturnValue(false)
    mountSteps()

    // Act
    shown('[data-phrase="1"]').click()

    // Assert
    expect(runs[0].o.audible).toBe(false)
    expect(nameOf(shown('[data-phrase="1"]'))).toBe(
      'Stop phrase 1: Twinkle, twinkle, little star',
    )
  })
})
