// ============================================================
// Lesson 23 Sing it tests — the flow on the page, the staff for each voice, ti and fa, one sound
// ============================================================
//
// On the page's own markup (WEB-SPEC, Toys 5 and Tests 9): the comfort
// check first, the voice choice before anything plays, the learner's staff
// in the bass clef for the lower voice and the treble for the higher, do,
// so, then so, do with the house under each do, Merc's notes as two halves
// a breath apart, lit amber as they sound and dark through the breath, the
// guide only after they have been heard with sound on, its count-in on do
// and its 7.0 s sweep, "How did that feel?" after it, this page's line
// after Easy, and the rest ending after Effortful, Uncomfortable or Just
// listen today. Then just listen shows in every ending once a voice is
// chosen and plays C♯ and G together, then D and F♯, in the voice's octave,
// each pair written as it sounds (FACTS 52, 55 to 57, 72). Every play is
// the page's one sound.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import { VisitEnding } from '@/features/lessons/kit/comfort'
import { COUNT_IN_SEC } from '@/features/lessons/kit/move-do'
import { hz } from '@/features/lessons/kit/notes'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import type * as RunModule from '@/features/lessons/kit/run'
import { resetRuns, runs, } from '@/features/lessons/kit/run-recorder.test-fixtures'
import { contourLength, Sound } from '@/features/lessons/kit/sound'
import { ledgerCount, placeOf } from '@/features/lessons/kit/staff-places'
import { VoiceChoice } from '@/features/lessons/kit/voice-choice'
import { listenNotes, listenSaid } from './listen-pair'
import { el, loadPage, settle, soundOn, words } from './page-dom.test-fixtures'
import { FLOW, initSing, singLines, singStaff } from './sing'
import { SING_HALF, SING_ONSETS, SING_SEC } from './sounds'

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
const pairSvg = (): SVGSVGElement =>
  el<SVGSVGElement>('#pairStaff [data-staff-svg]')
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
  it('writes do, so, then so, do in D on the staff each voice gives, the house under each do', () => {
    // Assert: FACTS 52, 55
    const lower = singStaff('lower')
    const higher = singStaff('higher')
    expect([lower.clef, higher.clef]).toEqual(['bass', 'treble'])
    const places = (s: typeof lower) =>
      (s.score ?? []).map((n) => placeOf(n.note, s.clef ?? 'treble'))
    // D3 on the middle line, A3 on the top line, D4 just above middle C's ledger line
    expect(places(lower)).toEqual([4, 8, 8, 11])
    expect(ledgerCount(11, 'bass')).toBe(1)
    // D4 hangs below the treble staff's bottom line, with no ledger line
    expect(places(higher)).toEqual([-1, 3, 3, 6])
    expect(ledgerCount(-1, 'treble')).toBe(0)
    expect((lower.score ?? []).map((n) => n.home === true)).toEqual([
      true,
      false,
      false,
      true,
    ])
  })

  it('sings each half as one voice, 1.2 s and 1.8 s, with 1.0 s of quiet between them, 7.0 s', () => {
    // Assert: FACTS 55, 72
    expect(SING_ONSETS).toEqual([0, 1.2, 4, 5.2])
    expect([SING_HALF, SING_SEC]).toEqual([3, 7])
    const lines = singLines('lower')
    expect(lines.map((l) => l.t)).toEqual([0, 4])
    expect(lines.map((l) => contourLength(l.points))).toEqual([3, 3])
    const ends = lines.map((l) => [l.points[0].hz, l.points.at(-1)?.hz])
    expect(ends).toEqual([
      [hz(50), hz(57)],
      [hz(57), hz(62)],
    ])
  })
})

describe('Sing it on the page', () => {
  it('opens on the comfort check, the staff waiting in the treble with no notes, and nothing to listen to yet', () => {
    // Act
    initSing()

    // Assert
    expect(status()).toBe(FLOW.STATUS.comfort)
    expect(shown('[data-panel="comfort"]')).toBe(true)
    expect(shown('[data-panel="notes"]')).toBe(false)
    expect(shown('[data-listen-pair]')).toBe(false)
    expect(staffSvg().getAttribute('aria-label')).toBe(
      'Treble staff, five lines and four spaces',
    )
    expect(count(staffSvg(), '.st-head')).toBe(0)
  })

  it("asks for the voice before anything plays, then draws the lower voice's four notes on the bass staff", () => {
    // Arrange
    initSing()
    click('[data-comfort="sing"]')
    const before = [shown('[data-panel="notes"]'), shown('[data-listen-pair]')]

    // Act
    click('[data-voice="lower"]')

    // Assert
    expect(before).toEqual([false, false])
    expect(shown('[data-panel="notes"]')).toBe(true)
    expect(staffSvg().getAttribute('aria-label')).toBe(
      'Bass staff, five lines and four spaces',
    )
    expect(count(staffSvg(), '.st-head')).toBe(4)
    expect(count(staffSvg(), '.st-home')).toBe(2)
    expect(count(staffSvg(), '.st-ledger')).toBe(1)
    expect(el<HTMLImageElement>('#singStaff .sing-merc').alt).toMatch(/^Merc/)
    expect(VoiceChoice.voice).toBe('lower')
  })

  it('follows a change of voice at once: the treble staff for the higher voice, Tavi beside it, and the listening staff with it', () => {
    // Arrange
    initSing()
    choose('lower')

    // Act
    click('[data-voice="higher"]')

    // Assert
    expect(staffSvg().getAttribute('aria-label')).toBe(
      'Treble staff, five lines and four spaces',
    )
    expect(count(staffSvg(), '.st-ledger')).toBe(0)
    expect(el<HTMLImageElement>('#singStaff .sing-merc').alt).toMatch(/^Tavi/)
    expect(pairSvg().getAttribute('aria-label')).toBe(
      'Treble staff, five lines and four spaces',
    )
  })

  it("plays Merc's notes as two halves a breath apart in Merc's voice, each note lit amber as it sounds and none through the breath", async () => {
    // Arrange
    vi.useFakeTimers()
    initSing()
    choose('lower')

    // Act
    click('[data-notes-play]')
    const lit = (): number => count(staffSvg(), '.st-head.is-amber')
    // just after each onset, and in the breath
    const at: number[] = []
    let now = 0
    for (const ms of [100, 1300, 3100, 4100, 5300]) {
      vi.advanceTimersByTime(ms - now)
      now = ms
      at.push(lit())
    }
    runs[0].end(true)
    await settle()

    // Assert
    expect(runs[0].kind).toBe('lines')
    expect(runs[0].lines.map((l) => l.t)).toEqual([0, 4])
    expect(runs[0].o.kind).toBe('merc')
    expect(at).toEqual([1, 1, 0, 1, 1])
    expect(lit()).toBe(0)
    expect(status()).toBe(FLOW.STATUS.ready)
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

  it("counts in on do, sweeps 7.0 s with no voice, then asks how it felt, and gives this page's line after Easy", async () => {
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

    // Assert: FACTS 72, D4 for the higher voice
    expect(counted?.[0]).toBeCloseTo(hz(62), 5)
    expect(counted?.[1]).toMatchObject({ dur: 0.8, gain: 0.065 })
    expect(clock.o.audible).toBe(false)
    expect(clock.points.at(-1)?.t).toBeCloseTo(COUNT_IN_SEC + 7, 5)
    expect(asked).toBe(true)
    expect(shown('[data-after="interval"]')).toBe(true)
    expect(words(el('[data-after="interval"]'))).toBe(FLOW.AFTER.interval)
    expect(status()).toBe(FLOW.AFTER.interval)
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

      // Assert: FACTS 54, 56
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

    // Assert: FACTS 50, 56
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

describe('Then just listen', () => {
  it("plays C♯ and G together, then D and F♯, 1.5 s each, in the soft tone and the voice's octave", () => {
    // Arrange
    initSing()
    choose('lower')

    // Act
    click('[data-pair-play]')

    // Assert: FACTS 57, 72
    expect(runs[0].notes.map((n) => [n.t, n.midi, n.dur])).toEqual([
      [0, 49, 1.5],
      [0, 55, 1.5],
      [1.5, 50, 1.5],
      [1.5, 54, 1.5],
    ])
    expect(runs[0].o).toMatchObject({ kind: 'soft', audible: true })
    expect(listenNotes('treble').map((n) => n.midi)).toEqual([61, 67, 62, 66])
  })

  it('writes each pair on its staff as it sounds, with its sharp, lit while it sounds, the house under do', async () => {
    // Arrange
    initSing()
    choose('higher')
    click('[data-pair-play]')
    const r = runs[0]
    const before = count(pairSvg(), '.st-head')

    // Act
    r.note(0)
    r.note(1)
    const first = [
      count(pairSvg(), '.st-head'),
      count(pairSvg(), '.st-head.is-lit'),
      count(pairSvg(), '.st-sign'),
      count(pairSvg(), '.st-ledger'),
    ]
    r.note(2)
    r.note(3)
    const second = [
      count(pairSvg(), '.st-head'),
      count(pairSvg(), '.st-head.is-lit'),
      count(pairSvg(), '.st-sign'),
      count(pairSvg(), '.st-home'),
    ]
    r.end(true)
    await settle()

    // Assert: C♯4 on middle C's ledger line, its sharp, then F♯4's, the house under D4
    expect(before).toBe(0)
    expect(first).toEqual([2, 2, 1, 1])
    expect(second).toEqual([4, 2, 2, 1])
    expect(count(pairSvg(), '.st-head')).toBe(4)
    expect(count(pairSvg(), '.st-head.is-lit')).toBe(0)
    expect(el('[data-pair-play]').classList.contains('is-on')).toBe(false)
  })

  it('says its four notes in words as it starts, each with its letter and octave', () => {
    // Arrange
    initSing()
    choose('lower')

    // Act
    click('[data-pair-play]')

    // Assert
    expect(words(el('#pairStaff [data-staff-said]'))).toBe(
      'Ti and fa together, C sharp 3 and G3, then do and mi, D3 and F sharp 3.',
    )
    expect(listenSaid('treble')).toContain('C sharp 4 and G4')
  })

  it('shows in every ending and plays after it: Effortful, Uncomfortable and Just listen today', async () => {
    for (const ending of ['effortful', 'uncomfortable', 'listen']) {
      // Arrange
      loadPage()
      resetRuns()
      initSing()

      // Act
      if (ending === 'listen') {
        click('[data-comfort="listen"]')
        click('[data-voice="lower"]')
      } else {
        choose('lower')
        await sweepAndFeel(ending)
      }
      click('[data-pair-play]')

      // Assert: WEB-SPEC, Tests 9
      expect(shown('[data-listen-pair]'), ending).toBe(true)
      expect(runs.at(-1)?.notes, ending).toHaveLength(4)
    }
  })

  it("is the page's one sound: it stops Merc's notes, and a newer sound stops it, its button put out", async () => {
    // Arrange
    initSing()
    choose('lower')
    click('[data-notes-play]')

    // Act
    click('[data-pair-play]')
    const lit = el('[data-pair-play]').classList.contains('is-on')
    NowPlaying.claim(() => undefined)
    await settle()

    // Assert
    expect(runs[0].stopped).toBe(true)
    expect(lit).toBe(true)
    expect(runs[1].stopped).toBe(true)
    expect(el('[data-pair-play]').classList.contains('is-on')).toBe(false)
  })

  it('stops for a change of voice, its staff written afresh in the new clef', () => {
    // Arrange
    initSing()
    choose('lower')
    click('[data-pair-play]')
    runs[0].note(0)

    // Act
    click('[data-voice="higher"]')

    // Assert
    expect(runs[0].stopped).toBe(true)
    expect(count(pairSvg(), '.st-head')).toBe(0)
    expect(pairSvg().getAttribute('aria-label')).toBe(
      'Treble staff, five lines and four spaces',
    )
  })
})
