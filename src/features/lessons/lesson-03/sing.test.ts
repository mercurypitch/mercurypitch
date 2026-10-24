// ============================================================
// Lesson 3 Sing it tests — the notes, the chart's words, the card left
// ============================================================
//
// The card's own tests load learn/03.html's body into jsdom and drive
// initSing as the page does, and leave it as the microphone opens: the tab
// hidden, or the section scrolled away; and scroll the section away and back
// before Start. The listener is a double that counts the takes it opens and
// the times the microphone is let go.

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { scrollAwayAndBack, scrollIntoViewAgain, scrollOutOfView, } from '@/features/lessons/kit/browser-doubles.test-fixtures'
import type * as ListenModule from '@/features/lessons/kit/listen'
import type { TakeReading } from '@/features/lessons/kit/take'
import { notesFor } from './sing'
import { chartSummary } from './sing-take'

const PAGE = readFileSync(resolve(process.cwd(), 'learn/03.html'), 'utf8')

const mic = vi.hoisted(() => ({
  /** Runs as the page asks for the microphone, before the listener resolves. */
  opening: null as (() => void) | null,
  /** Takes opened, and the times the microphone was let go: after its linger, or at once. */
  opened: 0,
  released: 0,
  releasedNow: 0,
}))

vi.mock('@/features/lessons/kit/listen', async (importOriginal) => {
  const real = await importOriginal<typeof ListenModule>()
  return {
    ...real,
    listen: () => {
      mic.opening?.()
      return Promise.resolve({
        holding: true,
        latest: () => null,
        release: () => {
          mic.released += 1
        },
        releaseNow: () => {
          mic.releasedNow += 1
        },
      })
    },
    // every take hears nothing and ends as a stopped one does
    takeFrames: () => {
      mic.opened += 1
      return Promise.resolve(null)
    },
  }
})

/** The page's card on its own markup, the lower voice stored, past the comfort check. */
async function loadCard() {
  vi.resetModules()
  localStorage.setItem('fyp-voice', JSON.stringify('lower'))
  const sing = await import('./sing')
  const { Sound } = await import('@/features/lessons/kit/sound')
  // the listener's chunk, loaded now so a take's own import of it resolves at once
  await import('@/features/lessons/kit/listen')
  const body = /<body[^>]*>([\s\S]*)<\/body>/.exec(PAGE)
  if (body === null) throw new Error('learn/03.html has no body')
  document.body.innerHTML = body[1]
  sing.initSing({ blue: 'blue.png', orange: 'orange.png' })
  vi.spyOn(Sound, 'context').mockReturnValue({} as AudioContext)
  el('[data-comfort="sing"]').click()
}

function el(selector: string): HTMLElement {
  const found = document.querySelector<HTMLElement>(selector)
  if (found === null) throw new Error(`no ${selector}`)
  return found
}

/** A button pressed, its take run out on the fake clock: Merc's note, the gap, the wait. */
async function press(selector: string): Promise<void> {
  el(selector).click()
  await vi.dynamicImportSettled()
  await vi.advanceTimersByTimeAsync(3000)
}

/** The tab hidden, as switching to another tab hides it: `document.hidden`, then its event. */
function hideTab(): void {
  Object.defineProperty(document, 'hidden', {
    configurable: true,
    get: () => true,
  })
  document.dispatchEvent(new Event('visibilitychange'))
}

/** The section scrolled away as the microphone opens, and kept away past the page's 600 ms. */
function leaveSection(): void {
  scrollOutOfView(el('#sing'))
  vi.advanceTimersByTime(600)
}

const reading = (over: Partial<TakeReading>): TakeReading => ({
  steady: true,
  d: 12,
  octaves: 0,
  band: 'middle',
  landed: true,
  line: '',
  octaveLine: null,
  ...over,
})

describe('notesFor (FACTS 45)', () => {
  it('sings A, then G a tone below, then B a tone above, around the voice', () => {
    expect(notesFor('lower')).toEqual([57, 55, 59])
    expect(notesFor('higher')).toEqual([69, 67, 71])
  })
})

describe("the chart's words after a take (REQ-GVC-085)", () => {
  it("say Merc's note, the gap and the band, as WEB-SPEC's example reads", () => {
    expect(chartSummary(57, reading({ d: 20, band: 'band' }))).toBe(
      "Merc's note A3; your note 20 cents above it, in the band",
    )
    expect(chartSummary(57, reading({ d: 12, band: 'middle' }))).toBe(
      "Merc's note A3; your note 12 cents above it, right in the middle",
    )
    expect(chartSummary(57, reading({ d: -25, band: 'band' }))).toBe(
      "Merc's note A3; your note 25 cents below it, in the band",
    )
  })

  it('add the octave where the take said so, and say when nothing steady was heard', () => {
    expect(
      chartSummary(
        69,
        reading({
          d: 0,
          octaves: -1,
          octaveLine: 'You sang it an octave lower: same note.',
        }),
      ),
    ).toBe(
      "Merc's note A4; your note on it, right in the middle, an octave lower",
    )
    expect(
      chartSummary(58, reading({ steady: false, d: null, band: null })),
    ).toBe("Merc's note A sharp 3; no steady note heard")
  })
})

// each case loads the page's modules afresh (vi.resetModules) and parses
// learn/03.html into jsdom: up to 1.7 s measured on a loaded 4-core machine
describe(
  'Sing it left while the microphone opens, or away and back before Start',
  { timeout: 15_000 },
  () => {
    beforeEach(() => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
      mic.opening = null
      mic.opened = 0
      mic.released = 0
      mic.releasedNow = 0
    })

    afterEach(() => {
      vi.useRealTimers()
      vi.restoreAllMocks()
      Reflect.deleteProperty(document, 'hidden')
      document.body.textContent = ''
      localStorage.clear()
    })

    it('starts no take after Start in a hidden tab, lets the microphone go at once, and offers Start again', async () => {
      // Arrange
      await loadCard()
      mic.opening = hideTab

      // Act
      await press('[data-sing="start"]')

      // Assert
      expect(mic.opened).toBe(0)
      expect(mic.releasedNow).toBe(1)
      expect(el('#singStatus').textContent).toBe(
        'Stopped listening: the microphone is off.',
      )
      expect(el('#singLive').hidden).toBe(true)
      expect(el('[data-panel="prepare"]').hidden).toBe(false)
    })

    it('starts no take after Next note in a hidden tab, lets the microphone go at once, and offers the note again', async () => {
      // Arrange: the first note's take, heard as nothing
      await loadCard()
      await press('[data-sing="start"]')
      mic.opening = hideTab

      // Act
      await press('[data-sing="next"]')

      // Assert
      expect(mic.opened).toBe(1)
      expect(mic.releasedNow).toBe(1)
      expect(el('[data-note-head]').textContent).toBe('Note 2 of 3')
      expect(el('#singStatus').textContent).toBe(
        'Stopped listening: the microphone is off.',
      )
      expect(el('[data-sing="again"]').hidden).toBe(false)
    })

    it('starts no take after Start with the section scrolled away, keeps the page where it is, lets the microphone go, and offers Start again', async () => {
      // Arrange: the card off screen, where the viewer scrolled it
      await loadCard()
      const card = el('#singCard')
      const scrolled = vi.fn()
      card.scrollIntoView = scrolled
      vi.spyOn(card, 'getBoundingClientRect').mockReturnValue(
        DOMRect.fromRect({ x: 0, y: -2000, width: 360, height: 900 }),
      )
      mic.opening = leaveSection

      // Act
      await press('[data-sing="start"]')

      // Assert: let go as leaving the section lets go, after the linger
      expect(mic.opened).toBe(0)
      expect([mic.released, mic.releasedNow]).toEqual([1, 0])
      expect(el('#singStatus').textContent).toBe(
        'Stopped listening: the microphone is off.',
      )
      expect(scrolled).not.toHaveBeenCalled()
      expect(el('#singLive').hidden).toBe(true)
      expect(el('[data-panel="prepare"]').hidden).toBe(false)
    })

    it('keeps the rerun offered, and the feeling picked, when the section is left as its microphone opens', async () => {
      // Arrange: the three notes, then a feeling that offers the rerun
      await loadCard()
      await press('[data-sing="start"]')
      await press('[data-sing="next"]')
      await press('[data-sing="next"]')
      await press('[data-sing="done"]')
      el('[data-feel="easy"]').click()
      mic.released = 0
      mic.opening = leaveSection

      // Act
      await press('[data-sing="rerun"]')

      // Assert: nothing started, and nothing on the card changed
      expect(mic.opened).toBe(3)
      expect([mic.released, mic.releasedNow]).toEqual([1, 0])
      expect(el('#singStatus').textContent).toBe(
        'Stopped listening: the microphone is off.',
      )
      expect(el('[data-panel="after"]').hidden).toBe(false)
      expect(el('[data-sing="rerun"]').hidden).toBe(false)
      expect(el('[data-feel="easy"]').getAttribute('aria-pressed')).toBe('true')

      // Act: the rerun again, back in view
      mic.opening = null
      scrollIntoViewAgain(el('#sing'))
      await press('[data-sing="rerun"]')

      // Assert: note 1's take opened
      expect(mic.opened).toBe(4)
      expect(el('[data-note-head]').textContent).toBe('Note 1 of 3')
    })

    it('starts a take after Start once the section, away past its 600 ms, is back in view', async () => {
      // Arrange
      await loadCard()
      leaveSection()
      scrollIntoViewAgain(el('#sing'))

      // Act
      await press('[data-sing="start"]')

      // Assert: one take, and the microphone let go once, as it ended
      expect(mic.opened).toBe(1)
      expect([mic.released, mic.releasedNow]).toEqual([1, 0])
    })

    it('reads a report by its last entry: the section away and back in one report is in view', async () => {
      // Arrange
      await loadCard()
      scrollAwayAndBack(el('#sing'))
      vi.advanceTimersByTime(600)

      // Act
      await press('[data-sing="start"]')

      // Assert
      expect(mic.opened).toBe(1)
    })
  },
)
