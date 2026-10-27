// ============================================================
// Lesson 10 wrap tests — free play, every control of the chord beads
// ============================================================
//
// WEB-SPEC, Toys 1's free play and Audio, on the page's own markup with the
// steps mounted beside it as main.ts mounts them, its runs recorded
// (kit/run-recorder.test-fixtures.ts) on fake timers: free play opens on C
// major, says each change once in its polite line in the steps' words, and
// names its beads and gaps as the steps do; Play plays the chord note by
// note and then together, or the scale once it is spread, and Slow doubles
// every length; Play the pattern plays at Step 4's fast tempo, and under
// Slow at its slow one, and Slow and Major · Minor, pressed while it plays,
// act from its next quaver as it plays on, where Major · Minor stops a play
// of the chord; Root lower and Root higher are `aria-disabled` at C4 and
// B4, where a press keeps the focus, moves nothing and stops nothing;
// spread on a root slid to B4, the scale climbs to B5, 987.77 Hz, in the
// scale's own window (FACTS 70a, 82); nothing waits for anything; the
// names switch is the page's one store, so free play and Step 5 agree; and
// free play is one of the page's sounds: a play in it stops any other,
// another stops it, and so does leaving it.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { scrollIntoViewAgain, scrollOutOfView, } from '@/features/lessons/kit/browser-doubles.test-fixtures'
import { hz } from '@/features/lessons/kit/notes'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import type * as RunModule from '@/features/lessons/kit/run'
import type { RecordedRun } from '@/features/lessons/kit/run-recorder.test-fixtures'
import { resetRuns, runs, } from '@/features/lessons/kit/run-recorder.test-fixtures'
import type { ChordBeads } from './chord-beads'
import type { BeadsScene } from './chord-beads-draw'
import { el, mountSteps, settle, soundOn } from './page-dom.test-fixtures'
import { hideTab } from './sing.test-fixtures'
import { scaleSound, slow, thirdSound, triadSound } from './sounds'
import { freeTempo, initWrap } from './wrap'

vi.mock('@/features/lessons/kit/run', async (actual) => ({
  ...(await actual<typeof RunModule>()),
  ...(await import('@/features/lessons/kit/run-recorder.test-fixtures'))
    .recordedRuns,
}))

/** The steps mounted as main.ts mounts them, on Step 1, and free play beside them, its figure a phone's 356 x 340 (FACTS 82). */
function openFree(): {
  readonly deck: ReturnType<typeof mountSteps>
  readonly beads: ChordBeads
} {
  const deck = mountSteps()
  vi.spyOn(
    el<HTMLCanvasElement>('#freePlay [data-chord-viz] canvas'),
    'getBoundingClientRect',
  ).mockReturnValue(new DOMRect(0, 0, 356, 340))
  return { deck, beads: initWrap(deck.names) }
}

const free = (selector: string): HTMLButtonElement =>
  el<HTMLButtonElement>(`#freePlay ${selector}`)
const play = (): HTMLButtonElement => free('[data-free-play]')
const pattern = (): HTMLButtonElement => free('[data-chord-play="pattern"]')
const slowBtn = (): HTMLButtonElement => free('[data-chord-slow]')
const quality = (qy: 'major' | 'minor'): HTMLButtonElement =>
  free(`[data-chord-quality] [data-quality="${qy}"]`)
const view = (v: 'chord' | 'scale'): HTMLButtonElement =>
  free(`[data-chord-view] [data-view="${v}"]`)
const lower = (): HTMLButtonElement => free('[data-chord-root="-1"]')
const higher = (): HTMLButtonElement => free('[data-chord-root="1"]')
const said = (): string => el('#freePlay [data-chord-said]').textContent ?? ''
const pressed = (b: HTMLElement): string | null =>
  b.getAttribute('aria-pressed')
const labels = (selector: string): (string | null)[] =>
  Array.from(document.querySelectorAll(selector), (b) =>
    b.getAttribute('aria-label'),
  )
const last = (): RecordedRun => {
  const r = runs.at(-1)
  if (r === undefined) throw new Error('nothing played')
  return r
}
const sceneOf = (beads: ChordBeads): BeadsScene => {
  const s = beads.scene()
  if (s === null) throw new Error('no scene')
  return s
}

/** The clock on by `seconds`; a quaver's timer fires on the whole millisecond after its time. */
const later = (seconds: number): void => {
  vi.advanceTimersByTime(seconds * 1000)
}

const SLOW_Q = 30 / 70
const FAST_Q = 30 / 160

beforeEach(() => {
  resetRuns()
  soundOn()
  vi.useFakeTimers({
    toFake: ['setTimeout', 'clearTimeout', 'performance'],
    now: 0,
  })
})

afterEach(() => {
  window.dispatchEvent(new Event('pagehide'))
  vi.useRealTimers()
  vi.restoreAllMocks()
  Reflect.deleteProperty(document, 'hidden')
  window.location.hash = ''
  document.body.textContent = ''
})

describe("Lesson 10's free play, its lines", () => {
  it('opens on C major, its summary, beads and gaps named as the steps name them, and nothing waiting', () => {
    // Act
    openFree()

    // Assert
    expect(el('#freePlay [data-chord-summary]').textContent).toBe(
      'C major: C 4, E 4, G 4. Gaps of 4 and 3 semitones; root to fifth 7, a perfect fifth.',
    )
    expect(labels('#freePlay .chord-hit')).toEqual([
      'C 4, the root',
      'E 4, the third',
      'G 4, the fifth',
      '4, major third: C 4 up to E 4',
      '3, minor third: E 4 up to G 4',
    ])
    expect(
      Array.from(
        document.querySelectorAll<HTMLButtonElement>('#freePlay button'),
      ).filter((b) => b.disabled),
    ).toEqual([])
    expect([quality('major'), view('chord'), slowBtn()].map(pressed)).toEqual([
      'true',
      'true',
      'false',
    ])
  })

  it('says each change once in its polite line, in the steps’ words, and renames its beads and gaps', () => {
    // Arrange
    openFree()
    const lines: string[] = []

    // Act
    quality('minor').click()
    lines.push(said())
    higher().click()
    lines.push(said())
    view('scale').click()
    lines.push(said())
    quality('major').click()
    lines.push(said())
    view('chord').click()
    lines.push(said())

    // Assert
    expect(lines).toEqual([
      'Minor: the third moved down a semitone, to E flat 4. C minor.',
      'Root higher: D, F, A. D minor.',
      'Scale: D, E, F, G, A, B flat, C, D. D natural minor.',
      'Major: D, E, F sharp, G, A, B, C sharp, D. D major scale.',
      'Chord: D, F sharp, A. D major.',
    ])
    expect(labels('#freePlay .chord-hit')).toEqual([
      'D 4, the root',
      'F sharp 4, the third',
      'A 4, the fifth',
      '4, major third: D 4 up to F sharp 4',
      '3, minor third: F sharp 4 up to A 4',
    ])
  })

  it('shows Major · Minor and Chord · Scale pressed, and no stair is a target once the scale shows', () => {
    // Arrange
    openFree()

    // Act
    quality('minor').click()
    view('scale').click()

    // Assert
    expect([quality('major'), quality('minor')].map(pressed)).toEqual([
      'false',
      'true',
    ])
    expect([view('chord'), view('scale')].map(pressed)).toEqual([
      'false',
      'true',
    ])
    expect(el('#freePlay [data-chord-targets]').hidden).toBe(true)
  })
})

describe("Lesson 10's free play, its plays", () => {
  it('plays the chord note by note, then together, in the soft tone, its button lit while it sounds', async () => {
    // Arrange
    openFree()

    // Act
    play().click()
    const lit = play().classList.contains('is-on')
    last().end(true)
    await settle()

    // Assert
    expect(last().notes).toEqual(triadSound(60, 'major'))
    expect(last().o.kind).toBe('soft')
    expect(lit).toBe(true)
    expect(play().classList.contains('is-on')).toBe(false)
  })

  it('plays the scale once the chord is spread, and every length twice as long under Slow', () => {
    // Arrange
    openFree()
    quality('minor').click()
    view('scale').click()

    // Act
    play().click()
    const scale = last().notes
    slowBtn().click()
    play().click()

    // Assert
    expect(scale).toEqual(scaleSound(60, 'minor'))
    expect(pressed(slowBtn())).toBe('true')
    expect(last().notes).toEqual(slow(scaleSound(60, 'minor')))
    expect(runs[0].stopped).toBe(true)
  })

  it('plays the chord at twice its lengths under Slow, and a gap button too', () => {
    // Arrange
    openFree()
    slowBtn().click()

    // Act
    play().click()
    const chord = last().notes
    free('.chord-hit-gap').click()

    // Assert
    expect(chord).toEqual(slow(triadSound(60, 'major')))
    expect(last().notes).toEqual(slow(thirdSound(60, 'major')))
  })

  it.each<[string, boolean, number]>([
    ["at Step 4's fast tempo", false, FAST_Q],
    ["at Step 4's slow tempo under Slow", true, SLOW_Q],
  ])('plays the pattern %s, a quaver at a time', (_, slowOn, q) => {
    // Arrange
    const { beads } = openFree()
    if (slowOn) slowBtn().click()

    // Act
    pattern().click()
    later(q + 0.005)

    // Assert
    expect(beads.settings.tempo).toBe(freeTempo(slowOn))
    expect(runs.map((r) => r.notes)).toEqual([
      [{ t: 0, midi: 60, dur: 0.9 * q }],
      [{ t: 0, midi: 67, dur: 0.9 * q }],
    ])
  })

  it('takes Slow from the next quaver while the pattern plays, and plays on', () => {
    // Arrange: the root sounding at the fast tempo
    openFree()
    pattern().click()
    later(0.05)

    // Act
    slowBtn().click()
    later(FAST_Q - 0.05 + 0.005)
    const fifth = last().notes
    later(SLOW_Q)

    // Assert
    expect(runs[0].stopped).toBe(false)
    expect(fifth).toEqual([{ t: 0, midi: 67, dur: 0.9 * SLOW_Q }])
    expect(last().notes).toEqual([{ t: 0, midi: 64, dur: 0.9 * SLOW_Q }])
    expect(pattern().classList.contains('is-on')).toBe(true)
  })

  it('takes Major · Minor from the next quaver while the pattern plays, and plays on, as Step 4 does', () => {
    // Arrange: the root sounding at the fast tempo
    openFree()
    pattern().click()
    later(0.05)

    // Act: Minor, then on to the fifth and the third
    quality('minor').click()
    later(FAST_Q - 0.05 + 0.005)
    const fifth = last().notes
    later(FAST_Q)

    // Assert: the third the minor one, E flat 4, and nothing stopped
    expect(runs.some((r) => r.stopped)).toBe(false)
    expect(fifth).toEqual([{ t: 0, midi: 67, dur: 0.9 * FAST_Q }])
    expect(last().notes).toEqual([{ t: 0, midi: 63, dur: 0.9 * FAST_Q }])
    expect(pattern().classList.contains('is-on')).toBe(true)
  })

  it('stops a play of the chord when Major · Minor changes, as the steps do', async () => {
    // Arrange: the chord sounding
    openFree()
    play().click()

    // Act
    quality('minor').click()
    await settle()

    // Assert
    expect(last().stopped).toBe(true)
    expect(play().classList.contains('is-on')).toBe(false)
  })
})

describe("Lesson 10's free play, the root's ends and B5", () => {
  it('marks Root lower aria-disabled at C4 as it opens; a press there keeps the focus, moves nothing and stops nothing', () => {
    // Arrange: the chord sounding on C4
    const { beads } = openFree()
    play().click()
    const before = [lower(), higher()].map((b) =>
      b.getAttribute('aria-disabled'),
    )
    lower().focus()

    // Act
    lower().click()

    // Assert
    expect(before).toEqual(['true', 'false'])
    expect(beads.settings.root).toBe(60)
    expect(last().stopped).toBe(false)
    expect(said()).toBe('')
    expect(document.activeElement).toBe(lower())
  })

  it('marks Root higher aria-disabled at B4, never past it; a press there keeps the focus, moves nothing and stops nothing', () => {
    // Arrange: six white keys up, to B4, and the chord sounding there
    const { beads } = openFree()
    for (let i = 0; i < 6; i++) higher().click()
    const atB4 = [lower(), higher()].map((b) => b.getAttribute('aria-disabled'))
    play().click()
    higher().focus()

    // Act
    higher().click()

    // Assert
    expect(atB4).toEqual(['false', 'true'])
    expect(beads.settings.root).toBe(71)
    expect(sceneOf(beads).beads.map((b) => b.name)).toEqual([
      'B4',
      'D♯5',
      'F♯5',
    ])
    expect(last().stopped).toBe(false)
    expect(document.activeElement).toBe(higher())
  })

  it("climbs to B5, 987.77 Hz, spread into a scale on a root slid to B4, in the scale's own window", () => {
    // Arrange
    const { beads } = openFree()
    for (let i = 0; i < 6; i++) higher().click()
    view('scale').click()

    // Act
    play().click()

    // Assert: the scale's notes, B4 to B5, and its stairs on its own 12 rows
    const notes = last().notes
    expect(notes.map((n) => n.midi)).toEqual([71, 73, 75, 76, 78, 80, 82, 83])
    expect(hz(notes[notes.length - 1].midi)).toBeCloseTo(987.77, 2)
    const scene = sceneOf(beads)
    expect(scene.stairs.map((s) => s.name)).toEqual([
      'B4',
      'C♯5',
      'D♯5',
      'E5',
      'F♯5',
      'G♯5',
      'A♯5',
      'B5',
    ])
    const own = scene.rows[scene.rows.length - 1].layout
    expect(own.lo).toBe(71)
    expect(own.yOf(71) - own.yOf(83)).toBeCloseTo(12 * own.row, 6)
    expect(
      scene.stairs.filter((s) => s.box.y < 0 || s.box.y + s.box.h > 340),
    ).toEqual([])
  })
})

describe("Lesson 10's free play and the steps share the names switch", () => {
  it('switches the steps’ names when free play’s switch is pressed, and free play’s when the steps’ is', () => {
    // Arrange
    const { deck, beads } = openFree()
    const stepNames = (m: 'letters' | 'solfege'): HTMLButtonElement =>
      el<HTMLButtonElement>(`#toyChord [data-names="${m}"]`)

    // Act: Do-re-mi in free play
    free('[data-names="solfege"]').click()
    const sung = sceneOf(beads).beads.map((b) => b.name)
    const stepsPressed = pressed(stepNames('solfege'))

    // Act: Letters in the steps
    stepNames('letters').click()

    // Assert
    expect(sung).toEqual(['do', 'mi', 'so'])
    expect(stepsPressed).toBe('true')
    expect(deck.names.mode).toBe('letters')
    expect(pressed(free('[data-names="letters"]'))).toBe('true')
    expect(pressed(free('[data-names="solfege"]'))).toBe('false')
    expect(deck.beads.settings.names).toBe('letters')
    expect(sceneOf(beads).beads.map((b) => b.name)).toEqual(['C4', 'E4', 'G4'])
  })
})

describe("Lesson 10's free play, one of the page's sounds", () => {
  it('stops a sound elsewhere on the page when it plays: the steps’ third, its button out', async () => {
    // Arrange: Step 1's third sounding
    openFree()
    const third = el<HTMLButtonElement>('#toyChord [data-chord-play="third"]')
    third.click()
    const steps = last()

    // Act
    play().click()
    await settle()

    // Assert
    expect(steps.stopped).toBe(true)
    expect(third.classList.contains('is-on')).toBe(false)
    expect(last().stopped).toBe(false)
  })

  it('stops for another sound on the page, with no quaver after, its button and beads out', async () => {
    // Arrange: free play's pattern, its root sounding
    const { beads } = openFree()
    pattern().click()
    runs[0].note(0)

    // Act
    el<HTMLButtonElement>('#toyChord [data-chord-play="third"]').click()
    later(10)
    await settle()

    // Assert
    expect(runs).toHaveLength(2)
    expect(runs[0].stopped).toBe(true)
    expect(runs[1].stopped).toBe(false)
    expect(pattern().classList.contains('is-on')).toBe(false)
    expect(sceneOf(beads).beads.map((b) => b.lit)).toEqual([0, 0, 0])
  })

  it.each<[string, () => void]>([
    [
      'off screen for 600 ms',
      () => {
        scrollOutOfView(el('#freePlay'))
        later(0.6)
      },
    ],
    ['the tab hidden', () => hideTab()],
    ['the page going', () => window.dispatchEvent(new Event('pagehide'))],
  ])('stops when the viewer leaves it, %s', async (_, leave) => {
    // Arrange
    openFree()
    play().click()

    // Act
    leave()
    await settle()

    // Assert
    expect(last().stopped).toBe(true)
    expect(play().classList.contains('is-on')).toBe(false)
  })

  it('plays on through a moment off screen under 600 ms', () => {
    // Arrange
    openFree()
    play().click()

    // Act
    scrollOutOfView(el('#freePlay'))
    later(0.5)
    scrollIntoViewAgain(el('#freePlay'))
    later(1)

    // Assert
    expect(last().stopped).toBe(false)
  })

  it('claims the page’s one owner as it plays, so a claim from elsewhere stops it', () => {
    // Arrange
    openFree()
    play().click()

    // Act
    NowPlaying.claim(() => undefined)

    // Assert
    expect(last().stopped).toBe(true)
  })
})
