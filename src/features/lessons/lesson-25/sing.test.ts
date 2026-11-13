// ============================================================
// Lesson 25 Sing it tests — the flow on the page, the staff for each voice, one sound
// ============================================================
//
// On the page's own markup (WEB-SPEC, Toys 5 and Tests 4 and 9): the
// comfort check first, the voice choice before anything plays, the
// learner's staff in the bass clef for the lower voice and the treble for
// the higher, so, te, do, then so, ti, do in A minor with G sharp's sharp
// and the house under each do, Merc's notes as two figures a breath apart,
// lit in the singer's colour as they sound and dark through the breath,
// the guide only after they have been heard with sound on, its count-in on
// so and its 9.4 s sweep, "How did that feel?" after it, this page's line
// after Easy, and the rest ending after Effortful, Uncomfortable or Just
// listen today (FACTS 40 to 47, 65). Every play is the page's one sound.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import { VisitEnding } from '@/features/lessons/kit/comfort'
import { COUNT_IN_SEC } from '@/features/lessons/kit/move-do'
import { hz } from '@/features/lessons/kit/notes'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import type * as RunModule from '@/features/lessons/kit/run'
import { resetRuns, runs, } from '@/features/lessons/kit/run-recorder.test-fixtures'
import { contourLength, Sound } from '@/features/lessons/kit/sound'
import { ledgerCount, midiOf, placeOf, } from '@/features/lessons/kit/staff-places'
import type { Voice } from '@/features/lessons/kit/voice-choice'
import { VoiceChoice } from '@/features/lessons/kit/voice-choice'
import type { VocalRangePreset } from '@/stores/settings-store'
import { VOCAL_RANGES } from '@/stores/settings-store'
import { el, loadPage, settle, soundOn, words } from './page-dom.test-fixtures'
import { FLOW, initSing, SING_HALF, SING_ONSETS, SING_SEC, singLines, singNotes, singStaff, } from './sing'

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
const count = (svg: SVGSVGElement, sel: string): number =>
  svg.querySelectorAll(sel).length

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

/** A guide run to its end, and `f` its answer. */
async function sweepAndFeel(f: string): Promise<void> {
  await hearMerc()
  click('[data-guide-start]')
  runs[runs.length - 1].end(true)
  await settle()
  click(`[data-feel="${f}"]`)
}

describe('the sing-along', () => {
  it('writes so, te, do, then so, ti, do in A minor on the staff each voice gives, no ledger line, the house under each do (FACTS 42)', () => {
    // Act
    const lower = singStaff('lower')
    const higher = singStaff('higher')
    const places = (s: typeof lower) =>
      (s.score ?? []).map((n) => placeOf(n.note, s.clef ?? 'treble'))

    // Assert: E3 the third space, G3 the fourth, A3 the top line; E4 the
    // treble's bottom line, G4 its second line, A4 its second space
    expect([lower.clef, higher.clef]).toEqual(['bass', 'treble'])
    expect(places(lower)).toEqual([5, 7, 8, 5, 7, 8])
    expect(places(higher)).toEqual([0, 2, 3, 0, 2, 3])
    expect(
      [...places(lower), ...places(higher)].some(
        (p, i) => ledgerCount(p, i < 6 ? 'bass' : 'treble') > 0,
      ),
    ).toBe(false)
    expect(singNotes('lower').map((n) => n.alter)).toEqual([0, 0, 0, 0, 1, 0])
    expect((lower.score ?? []).map((n) => n.home === true)).toEqual([
      false,
      false,
      true,
      false,
      false,
      true,
    ])
    expect(lower.key).toBeUndefined()
  })

  it('keeps every note at least four semitones inside every preset of its voice, against the app’s VOCAL_RANGES (FACTS 42; WEB-SPEC, Tests 4)', () => {
    // Arrange: each voice's presets, as Lesson 10's guide test maps them
    const presets: Readonly<Record<Voice, readonly VocalRangePreset[]>> = {
      lower: ['bass', 'baritone', 'tenor'],
      higher: ['alto', 'mezzo-soprano', 'soprano'],
    }
    const room: number[] = []

    // Act
    for (const v of ['lower', 'higher'] as const) {
      const notes = singNotes(v).map(midiOf)
      for (const p of presets[v]) {
        const r = VOCAL_RANGES[p]
        room.push(
          Math.min(...notes) - r.lowMidi,
          r.highMidi - Math.max(...notes),
        )
      }
    }

    // Assert: the least room is 4, at the tenor's floor and the soprano's
    expect(Math.min(...room)).toBe(4)
  })

  it('sings each figure as one voice, so and te 1.2 s and do 1.8 s, with 1.0 s of quiet between them, 9.4 s (FACTS 45, 65)', () => {
    // Assert
    expect(SING_ONSETS).toEqual([0, 1.2, 2.4, 5.2, 6.4, 7.6])
    expect([SING_HALF, SING_SEC]).toEqual([4.2, 9.4])
    const lines = singLines('lower')
    expect(lines.map((l) => l.t)).toEqual([0, 5.2])
    for (const l of lines) expect(contourLength(l.points)).toBeCloseTo(4.2, 9)
    const ends = lines.map((l) => [l.points[0].hz, l.points.at(-1)?.hz])
    expect(ends).toEqual([
      [hz(52), hz(57)],
      [hz(52), hz(57)],
    ])
  })
})

describe('Sing it on the page', () => {
  it('opens on the comfort check, the staff waiting in the treble with no notes', () => {
    // Act
    initSing()

    // Assert
    expect(status()).toBe(FLOW.STATUS.comfort)
    expect(shown('[data-panel="comfort"]')).toBe(true)
    expect(shown('[data-panel="notes"]')).toBe(false)
    expect(staffSvg().getAttribute('aria-label')).toBe(
      'Treble staff, five lines and four spaces',
    )
    expect(count(staffSvg(), '.st-head')).toBe(0)
  })

  it("asks for the voice before anything plays, then draws the lower voice's six notes on the bass staff, G sharp with its sharp", () => {
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
    expect(count(staffSvg(), '.st-head')).toBe(6)
    expect(count(staffSvg(), '.st-home')).toBe(2)
    expect(count(staffSvg(), '.st-sign')).toBe(1)
    expect(count(staffSvg(), '.st-ledger')).toBe(0)
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
    expect(el<HTMLImageElement>('#singStaff .sing-merc').alt).toMatch(/^Tavi/)
  })

  it("plays Merc's notes as two figures a breath apart in Merc's voice, each note lit blue as it sounds and none through the breath", async () => {
    // Arrange
    vi.useFakeTimers()
    initSing()
    choose('lower')

    // Act
    click('[data-notes-play]')
    const lit = (): number => count(staffSvg(), '.st-head.is-blue')
    // just after each onset, and in the breath
    const at: number[] = []
    let now = 0
    for (const ms of [100, 1300, 2500, 4500, 5300, 7700]) {
      vi.advanceTimersByTime(ms - now)
      now = ms
      at.push(lit())
    }
    runs[0].end(true)
    await settle()

    // Assert
    expect(runs[0].kind).toBe('lines')
    expect(runs[0].lines.map((l) => l.t)).toEqual([0, 5.2])
    expect(runs[0].o.kind).toBe('merc')
    expect(at).toEqual([1, 1, 1, 0, 1, 1])
    expect(lit()).toBe(0)
    expect(status()).toBe(FLOW.STATUS.ready)
    expect(el('[data-guide-start]').getAttribute('aria-disabled')).toBe('false')
  })

  it('lights Tavi’s notes orange for the higher voice', () => {
    // Arrange
    vi.useFakeTimers()
    initSing()
    choose('higher')

    // Act
    click('[data-notes-play]')
    vi.advanceTimersByTime(100)

    // Assert: WEB-SPEC, Look
    expect(count(staffSvg(), '.st-head.is-orange')).toBe(1)
    runs[0].end(true)
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

  it("counts in on so, sweeps 9.4 s with no voice, then asks how it felt, and gives this page's line after Easy", async () => {
    // Arrange
    initSing()
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

    // Assert: FACTS 46a, E4 for the higher voice
    expect(counted?.[0]).toBeCloseTo(hz(64), 5)
    expect(counted?.[1]).toMatchObject({ dur: 0.8, gain: 0.065 })
    expect(clock.o.audible).toBe(false)
    expect(clock.points.at(-1)?.t).toBeCloseTo(COUNT_IN_SEC + 9.4, 5)
    expect(asked).toBe(true)
    expect(shown('[data-after="raised"]')).toBe(true)
    expect(words(el('[data-after="raised"]'))).toBe(FLOW.AFTER.raised)
    expect(status()).toBe(FLOW.AFTER.raised)
    expect(VisitEnding.ending).toBe('practise')
  })

  it.each([
    ['effortful', 'gentle', false],
    ['uncomfortable', 'enough', true],
  ])(
    'puts the guide away after %s, with its line, and picks the rest ending',
    async (feeling, after, doctor) => {
      // Arrange
      initSing()
      choose('lower')

      // Act
      await sweepAndFeel(feeling)

      // Assert: FACTS 46, 47
      expect(shown(`[data-after="${after}"]`)).toBe(true)
      expect(shown('[data-after-doctor]')).toBe(doctor)
      expect(shown('[data-guide-start]')).toBe(false)
      expect(shown('[data-notes-play]')).toBe(true)
      expect(VisitEnding.ending).toBe('rest')
    },
  )

  it("plays Merc's notes on a tap for Just listen today, offers no guide, and picks the rest ending", () => {
    // Arrange
    initSing()

    // Act
    click('[data-comfort="listen"]')
    click('[data-voice="higher"]')
    click('[data-notes-play]')

    // Assert: FACTS 40, 47
    expect(shown('[data-panel="listen"]')).toBe(true)
    expect(shown('[data-guide-start]')).toBe(false)
    expect(runs).toHaveLength(1)
    expect(VisitEnding.ending).toBe('rest')
  })

  it("lets a newer sound anywhere stop Merc's notes, which then count as not heard", async () => {
    // Arrange
    initSing()
    choose('lower')
    click('[data-notes-play]')

    // Act
    NowPlaying.claim(() => undefined)
    await settle()

    // Assert
    expect(runs[0].stopped).toBe(true)
    expect(status()).toBe(FLOW.STATUS.first)
    expect(el('[data-guide-start]').getAttribute('aria-disabled')).toBe('true')
  })
})
