// ============================================================
// Lesson 15 Sing it tests — the flow on the page, the staff for each voice, one sound
// ============================================================
//
// On the page's own markup (WEB-SPEC, Toys 5 and Tests 3, 4 and 8): the
// comfort check first, the voice choice before anything plays, the
// learner's staff in the bass clef for the lower voice and the treble for
// the higher, Merc's notes lit amber as they sound, the guide only after
// they have been heard with sound on, its count-in on do and its 6.6 s
// sweep, "How did that feel?" after it, this page's line after Easy, and
// the rest line in the Wrap after Effortful or Just listen today. Merc's
// notes are the page's one sound.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import { VisitEnding } from '@/features/lessons/kit/comfort'
import { COUNT_IN_SEC } from '@/features/lessons/kit/move-do'
import { hz } from '@/features/lessons/kit/notes'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import type * as RunModule from '@/features/lessons/kit/run'
import { resetRuns, runs, } from '@/features/lessons/kit/run-recorder.test-fixtures'
import { STATUS } from '@/features/lessons/kit/sing-flow'
import { Sound } from '@/features/lessons/kit/sound'
import { contourLength } from '@/features/lessons/kit/sound'
import { ledgerCount, placeOf } from '@/features/lessons/kit/staff-places'
import { VoiceChoice } from '@/features/lessons/kit/voice-choice'
import { el, loadPage, settle, soundOn, words } from './page-dom.test-fixtures'
import { FLOW, initSing, singLine, singStaff } from './sing'
import { note, SING_NOTES, SING_ONSETS, SING_SEC } from './sounds'
import { initWrap } from './wrap'

vi.mock('@/features/lessons/kit/run', async (actual) => ({
  ...(await actual<typeof RunModule>()),
  ...(await import('@/features/lessons/kit/run-recorder.test-fixtures'))
    .recordedRuns,
}))

beforeEach(() => {
  localStorage.clear()
  loadPage()
  resetRuns()
  soundOn()
  vi.spyOn(Sound, 'voice').mockReturnValue(null)
  VisitEnding.set('practise')
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  document.body.textContent = ''
})

const shown = (sel: string): boolean => {
  for (
    let at: HTMLElement | null = el<HTMLElement>(sel);
    at !== null;
    at = at.parentElement
  )
    if (at.hidden) return false
  return true
}
const click = (sel: string): void => el<HTMLButtonElement>(sel).click()
const status = (): string => words(el('#singStatus'))
const staffSvg = (): SVGSVGElement =>
  el<SVGSVGElement>('#singStaff [data-staff-svg]')

/** Sing it on the page with the Wrap's card, as main.ts boots them. */
function boot() {
  const sing = initSing()
  initWrap()
  return sing
}

/** Through the comfort check and the voice choice: singing, in `voice`. */
function choose(voice: 'lower' | 'higher'): void {
  click('[data-comfort="sing"]')
  click(`[data-voice="${voice}"]`)
}

/** Plays Merc's notes and lets them end heard. */
async function hearMerc(): Promise<void> {
  click('[data-notes-play]')
  runs[runs.length - 1].end(true)
  await settle()
}

describe('the sing-along', () => {
  it('keeps every note at least 2 semitones inside its voice, on the staff its clef gives', () => {
    // Assert: WEB-SPEC, Tests 3; FACTS 44, 55
    expect(singStaff('lower').clef).toBe('bass')
    expect(singStaff('higher').clef).toBe('treble')
    const lower = SING_NOTES.lower.map(note)
    expect(lower.map((n) => placeOf(n, 'bass'))).toEqual([7, 8, 9, 10, 11])
    expect(ledgerCount(placeOf(lower[3], 'bass'), 'bass')).toBe(1)
    expect(
      SING_NOTES.higher
        .map(note)
        .map((n) => ledgerCount(placeOf(n, 'treble'), 'treble')),
    ).toEqual([0, 0, 0, 0, 0])
  })

  it('sings each line as one voice, four 1.2 s notes and a 1.8 s top note, 6.6 s', () => {
    // Assert: FACTS 57, 69
    expect(SING_ONSETS).toEqual([0, 1.2, 2.4, 3.6, 4.8])
    expect(SING_SEC).toBe(6.6)
    const line = singLine('lower')
    expect(contourLength(line)).toBeCloseTo(6.6, 5)
    expect(line[0].hz).toBeCloseTo(hz(55), 5)
    expect(line[line.length - 1].hz).toBeCloseTo(hz(62), 5)
  })
})

describe('Sing it on the page', () => {
  it('opens on the comfort check, with nothing else shown and the staff waiting in the treble', () => {
    // Act
    boot()

    // Assert
    expect(status()).toBe(STATUS.comfort)
    expect(shown('[data-panel="comfort"]')).toBe(true)
    expect(shown('[data-panel="notes"]')).toBe(false)
    expect(staffSvg().getAttribute('aria-label')).toBe(
      'Treble staff, five lines and four spaces',
    )
    expect(staffSvg().querySelectorAll('.st-head')).toHaveLength(0)
  })

  it('asks for the voice before anything plays, and draws the lower voice’s five notes on the bass staff', () => {
    // Arrange
    boot()
    click('[data-comfort="sing"]')
    const before = shown('[data-panel="notes"]')

    // Act
    click('[data-voice="lower"]')

    // Assert
    expect(before).toBe(false)
    expect(shown('[data-panel="notes"]')).toBe(true)
    expect(staffSvg().getAttribute('aria-label')).toBe(
      'Bass staff, five lines and four spaces',
    )
    expect(staffSvg().querySelectorAll('.st-head')).toHaveLength(5)
    expect(staffSvg().querySelectorAll('.st-home')).toHaveLength(1)
    // C4 on middle C's ledger line, above the bass staff
    expect(staffSvg().querySelectorAll('.st-ledger')).toHaveLength(2)
    expect(el<HTMLImageElement>('#singStaff .sing-merc').alt).toMatch(/^Merc/)
    expect(VoiceChoice.voice).toBe('lower')
  })

  it('follows a change of voice at once: the treble staff for the higher voice, Tavi beside it', () => {
    // Arrange
    boot()
    choose('lower')

    // Act
    click('[data-voice="higher"]')

    // Assert
    expect(staffSvg().getAttribute('aria-label')).toBe(
      'Treble staff, five lines and four spaces',
    )
    expect(staffSvg().querySelectorAll('.st-ledger')).toHaveLength(0)
    expect(el<HTMLImageElement>('#singStaff .sing-merc').alt).toMatch(/^Tavi/)
  })

  it("plays Merc's notes as one line in Merc's voice, each note lit amber as it sounds", async () => {
    // Arrange
    vi.useFakeTimers()
    boot()
    choose('lower')

    // Act
    click('[data-notes-play]')
    vi.advanceTimersByTime(1300)
    const amber = staffSvg().querySelectorAll('.st-head.is-amber').length
    runs[0].end(true)
    await settle()

    // Assert
    expect(runs[0].kind).toBe('line')
    expect(runs[0].o.kind).toBe('merc')
    expect(amber).toBe(1)
    expect(staffSvg().querySelectorAll('.st-head.is-amber')).toHaveLength(0)
    expect(status()).toBe(STATUS.ready)
    expect(el('[data-guide-start]').getAttribute('aria-disabled')).toBe('false')
  })

  it("waits to start the guide until Merc's notes have been heard, and says why", () => {
    // Arrange
    boot()
    choose('higher')

    // Act
    click('[data-guide-start]')

    // Assert
    expect(runs).toHaveLength(0)
    expect(words(el('[data-guide-hint]'))).toBe("Play Merc's notes first")
    expect(el('[data-guide-start]').getAttribute('aria-disabled')).toBe('true')
  })

  it("counts in on do, sweeps 6.6 s with no voice, then asks how it felt, and gives this page's line after Easy", async () => {
    // Arrange
    boot()
    choose('higher')
    await hearMerc()
    vi.mocked(Sound.voice).mockClear()

    // Act
    click('[data-guide-start]')
    const clock = runs[runs.length - 1]
    const counted = vi.mocked(Sound.voice).mock.calls[0]
    clock.end(true)
    await settle()
    const asked = shown('[data-panel="feel"]')
    click('[data-feel="easy"]')

    // Assert: FACTS 69; WEB-SPEC, Toys 5
    expect(counted?.[0]).toBeCloseTo(hz(67), 5)
    expect(counted?.[1]).toMatchObject({ dur: 0.8, gain: 0.065 })
    expect(clock.o.audible).toBe(false)
    expect(clock.points[clock.points.length - 1].t).toBeCloseTo(
      COUNT_IN_SEC + 6.6,
      5,
    )
    expect(asked).toBe(true)
    expect(shown('[data-after="steps"]')).toBe(true)
    expect(status()).toBe(FLOW.AFTER.steps)
    expect(shown('#practiseCard [data-ending="rest"]')).toBe(false)
  })

  it('puts the guide away after Effortful, and the Wrap shows its rest line', async () => {
    // Arrange
    boot()
    choose('lower')
    await hearMerc()
    click('[data-guide-start]')
    runs[runs.length - 1].end(true)
    await settle()

    // Act
    click('[data-feel="effortful"]')

    // Assert: FACTS 58, 59
    expect(shown('[data-after="gentle"]')).toBe(true)
    expect(shown('[data-guide-start]')).toBe(false)
    expect(shown('#practiseCard [data-ending="rest"]')).toBe(true)
    // Compose stays on the card after every ending
    expect(words(el('#practiseCard h3'))).toBe('Compose, in Sheet Music')
  })

  it("plays Merc's notes on a tap for Just listen today, offers no guide, and shows the rest line", () => {
    // Arrange
    boot()

    // Act
    click('[data-comfort="listen"]')
    click('[data-voice="higher"]')
    click('[data-notes-play]')

    // Assert: FACTS 50, 59
    expect(shown('[data-panel="listen"]')).toBe(true)
    expect(shown('[data-guide-start]')).toBe(false)
    expect(runs).toHaveLength(1)
    expect(shown('#practiseCard [data-ending="rest"]')).toBe(true)
  })

  it("lets a newer sound anywhere stop Merc's notes, which then count as not heard", async () => {
    // Arrange
    boot()
    choose('lower')
    click('[data-notes-play]')

    // Act
    NowPlaying.claim(() => undefined)
    await settle()

    // Assert
    expect(runs[0].stopped).toBe(true)
    expect(status()).toBe(STATUS.first)
    expect(el('[data-guide-start]').getAttribute('aria-disabled')).toBe('true')
  })
})
