// ============================================================
// Lesson 21 Sing it tests — two runs, the staff turning to G, the flow, one sound
// ============================================================
//
// On the page's own markup (WEB-SPEC, Toys 7; FACTS 56, 57, 64): the
// comfort check first, the voice choice before anything plays, the
// learner's staff in the bass clef for the lower voice and the treble for
// the higher, so, la, ti and do in C with the house on do; Merc's notes as
// two runs, each one voice, the second 7.4 s in, 12.8 s in all, each note
// lit amber as it sounds, the staff turning to G between them, its
// signature gaining F sharp, said; the guide only after they have been
// heard with sound on, its count-ins on so, G and then D, its 13.8 s clock
// and its sweep along each run in turn; "How did that feel?" after it, this
// page's line after Easy, and the rest ending after Effortful or Just
// listen today. Merc's notes are the page's one sound.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import { VisitEnding } from '@/features/lessons/kit/comfort'
import { COUNT_IN_SEC } from '@/features/lessons/kit/move-do'
import { hz } from '@/features/lessons/kit/notes'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import type * as RunModule from '@/features/lessons/kit/run'
import { resetRuns, runs, } from '@/features/lessons/kit/run-recorder.test-fixtures'
import { STATUS } from '@/features/lessons/kit/sing-flow'
import { contourLength, Sound } from '@/features/lessons/kit/sound'
import { ledgerCount, placeOf } from '@/features/lessons/kit/staff-places'
import { VoiceChoice } from '@/features/lessons/kit/voice-choice'
import { el, loadPage, settle, soundOn, words } from './page-dom.test-fixtures'
import { FLOW, initSing, RUN_SEC, RUN2_AT, runOf, SING_ONSETS, SING_SEC, singLines, singStaff, sweepAt, } from './sing'

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
const heads = (sel = ''): number =>
  staffSvg().querySelectorAll(`.st-head${sel}`).length

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
  it('sings so, la, ti, do in C and then in G, inside each voice, on the staff its clef gives', () => {
    // Assert: FACTS 64; the lower run in C reaches middle C's ledger line
    expect(singStaff('lower').clef).toBe('bass')
    expect(singStaff('higher').clef).toBe('treble')
    const name = (v: 'lower' | 'higher', r: 0 | 1) =>
      runOf(v, r).map((n) => `${n.letter}${n.alter > 0 ? '♯' : ''}${n.octave}`)
    expect(name('lower', 0)).toEqual(['G3', 'A3', 'B3', 'C4'])
    expect(name('lower', 1)).toEqual(['D3', 'E3', 'F♯3', 'G3'])
    expect(name('higher', 0)).toEqual(['G4', 'A4', 'B4', 'C5'])
    expect(name('higher', 1)).toEqual(['D4', 'E4', 'F♯4', 'G4'])
    expect(ledgerCount(placeOf(runOf('lower', 0)[3], 'bass'), 'bass')).toBe(1)
    expect(singStaff('lower', 1).key).toEqual({ sign: 'sharp', count: 1 })
    expect(singStaff('lower', 0).key).toBeNull()
    // the house on do, C and then G
    for (const r of [0, 1] as const)
      expect(singStaff('higher', r).score?.map((s) => s.home === true)).toEqual(
        [false, false, false, true],
      )
  })

  it('sings two runs, each one voice of three 1.2 s notes and a 1.8 s do, the second 7.4 s in: 12.8 s', () => {
    // Assert: FACTS 56
    expect(RUN_SEC).toBe(5.4)
    expect(RUN2_AT).toBe(7.4)
    expect(SING_SEC).toBe(12.8)
    expect(SING_ONSETS).toEqual([0, 1.2, 2.4, 3.6, 7.4, 8.6, 9.8, 11])
    const [c, g] = singLines('lower')
    expect([c.t, g.t]).toEqual([0, 7.4])
    expect(contourLength(c.points)).toBeCloseTo(5.4, 5)
    expect(contourLength(g.points)).toBeCloseTo(5.4, 5)
    expect(c.points[0].hz).toBeCloseTo(hz(55), 5)
    expect(g.points[0].hz).toBeCloseTo(hz(50), 5)
    expect(g.points[g.points.length - 1].hz).toBeCloseTo(hz(55), 5)
  })

  it('sweeps along the run in C, rests between the runs, then sweeps along the run in G', () => {
    // Assert
    expect(sweepAt(-0.1)).toBeNull()
    expect(sweepAt(2.7)).toBeCloseTo(0.5, 5)
    expect(sweepAt(6)).toBeNull()
    expect(sweepAt(RUN2_AT + 2.7)).toBeCloseTo(0.5, 5)
    expect(sweepAt(SING_SEC + 1)).toBe(1)
  })
})

describe('Sing it on the page', () => {
  it('opens on the comfort check, with nothing else shown and the staff waiting in the treble', () => {
    // Act
    initSing()

    // Assert
    expect(status()).toBe(STATUS.comfort)
    expect(shown('[data-panel="comfort"]')).toBe(true)
    expect(shown('[data-panel="notes"]')).toBe(false)
    expect(staffSvg().getAttribute('aria-label')).toBe(
      'Treble staff, five lines and four spaces',
    )
    expect(heads()).toBe(0)
  })

  it('asks for the voice before anything plays, and draws the lower voice’s four notes in C on the bass staff, the house on C', () => {
    // Arrange
    initSing()
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
    expect(heads()).toBe(4)
    expect(staffSvg().querySelectorAll('.st-home')).toHaveLength(1)
    expect(staffSvg().querySelectorAll('.st-keysign')).toHaveLength(0)
    expect(el<HTMLImageElement>('#singStaff .sing-merc').alt).toMatch(/^Merc/)
    expect(VoiceChoice.voice).toBe('lower')
  })

  it('follows a change of voice at once: the treble staff for the higher voice, Tavi beside it', () => {
    // Arrange
    initSing()
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

  it("plays Merc's two runs in Merc's voice, each note lit amber, the staff turning to G between them, its sharp said", async () => {
    // Arrange
    vi.useFakeTimers()
    initSing()
    choose('lower')

    // Act
    click('[data-notes-play]')
    vi.advanceTimersByTime(1300)
    const la = heads('.is-amber')
    vi.advanceTimersByTime(5400 - 1300 + 100)
    const inG = [
      staffSvg().querySelectorAll('.st-keysign').length,
      words(el('#singStaff [data-staff-said]')),
    ]
    vi.advanceTimersByTime(7400 + 1300 - 5500)
    const eLit = heads('.is-amber')
    runs[0].end(true)
    await settle()

    // Assert
    expect(runs[0].kind).toBe('lines')
    expect(runs[0].o.kind).toBe('merc')
    expect(runs[0].lines.map((l) => l.t)).toEqual([0, 7.4])
    expect(la).toBe(1)
    expect(inG).toEqual([1, 'Key signature: one sharp, F sharp'])
    expect(eLit).toBe(1)
    // resting in C again, where the next run starts
    expect(staffSvg().querySelectorAll('.st-keysign')).toHaveLength(0)
    expect(heads('.is-amber')).toBe(0)
    expect(status()).toBe(STATUS.ready)
    expect(el('[data-guide-start]').getAttribute('aria-disabled')).toBe('false')
  })

  it("waits to start the guide until Merc's notes have been heard, and says why", () => {
    // Arrange
    initSing()
    choose('higher')

    // Act
    click('[data-guide-start]')

    // Assert
    expect(runs).toHaveLength(0)
    expect(words(el('[data-guide-hint]'))).toBe("Play Merc's notes first")
    expect(el('[data-guide-start]').getAttribute('aria-disabled')).toBe('true')
  })

  it('counts in on so, G4, turns to G and counts in on its so, D4, in the gap’s last second, over a 13.8 s silent clock', async () => {
    // Arrange
    vi.useFakeTimers()
    initSing()
    choose('higher')
    click('[data-notes-play]')
    runs[0].end(true)
    await settle()
    vi.mocked(Sound.voice).mockClear()

    // Act
    click('[data-guide-start]')
    const clock = runs[runs.length - 1]
    vi.advanceTimersByTime((COUNT_IN_SEC + RUN_SEC) * 1000 - 50)
    const notYet = staffSvg().querySelectorAll('.st-keysign').length
    vi.advanceTimersByTime(100)
    const turned = staffSvg().querySelectorAll('.st-keysign').length
    const before = vi.mocked(Sound.voice).mock.calls.length
    vi.advanceTimersByTime((RUN2_AT - COUNT_IN_SEC - RUN_SEC) * 1000)
    const counted = vi.mocked(Sound.voice).mock.calls.map((c) => c[0])

    // Assert: FACTS 56, 64
    expect(clock.o.audible).toBe(false)
    expect(clock.points[clock.points.length - 1].t).toBeCloseTo(13.8, 5)
    expect([notYet, turned]).toEqual([0, 1])
    expect(before).toBe(1)
    expect(counted).toHaveLength(2)
    expect(counted[0]).toBeCloseTo(hz(67), 5)
    expect(counted[1]).toBeCloseTo(hz(62), 5)
  })

  it("asks how it felt once the guide ends, and gives this page's line after Easy", async () => {
    // Arrange
    initSing()
    choose('lower')
    await hearMerc()

    // Act
    click('[data-guide-start]')
    runs[runs.length - 1].end(true)
    await settle()
    const asked = shown('[data-panel="feel"]')
    click('[data-feel="easy"]')

    // Assert: FACTS 57
    expect(asked).toBe(true)
    expect(shown('[data-after="keys"]')).toBe(true)
    expect(words(el('[data-after="keys"]'))).toBe(FLOW.AFTER.keys)
    expect(status()).toBe(FLOW.AFTER.keys)
    expect(VisitEnding.ending).toBe('practise')
  })

  it('puts the guide away after Effortful, with the rest ending', async () => {
    // Arrange
    initSing()
    choose('lower')
    await hearMerc()
    click('[data-guide-start]')
    runs[runs.length - 1].end(true)
    await settle()

    // Act
    click('[data-feel="effortful"]')

    // Assert: FACTS 57, 58
    expect(shown('[data-after="gentle"]')).toBe(true)
    expect(shown('[data-guide-start]')).toBe(false)
    expect(VisitEnding.ending).toBe('rest')
  })

  it("plays Merc's notes on a tap for Just listen today, offers no guide, and ends at rest", () => {
    // Arrange
    initSing()

    // Act
    click('[data-comfort="listen"]')
    click('[data-voice="higher"]')
    click('[data-notes-play]')

    // Assert: FACTS 49, 58
    expect(shown('[data-panel="listen"]')).toBe(true)
    expect(shown('[data-guide-start]')).toBe(false)
    expect(runs).toHaveLength(1)
    expect(VisitEnding.ending).toBe('rest')
  })

  it("lets a newer sound anywhere stop Merc's notes, which then count as not heard, the staff back in C", async () => {
    // Arrange
    vi.useFakeTimers()
    initSing()
    choose('lower')
    click('[data-notes-play]')
    vi.advanceTimersByTime(6000)
    const inG = staffSvg().querySelectorAll('.st-keysign').length

    // Act
    NowPlaying.claim(() => undefined)
    await settle()

    // Assert
    expect(inG).toBe(1)
    expect(runs[0].stopped).toBe(true)
    expect(staffSvg().querySelectorAll('.st-keysign')).toHaveLength(0)
    expect(status()).toBe(STATUS.first)
    expect(el('[data-guide-start]').getAttribute('aria-disabled')).toBe('true')
  })
})
