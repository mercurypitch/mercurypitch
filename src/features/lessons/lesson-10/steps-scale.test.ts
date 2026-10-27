// ============================================================
// Lesson 10 Step 5 tests — the chord in its scale, its predict and the names
// ============================================================
//
// On the page's own markup and deck, its runs recorded (kit/run-recorder.
// test-fixtures.ts) on fake timers: Chord · Scale spreads the chord into
// its staircase and folds it back, stopping the stage's sound first; the
// predict's Play C major and Play C minor spread it first if it is folded,
// show their scale and light each stair as it sounds, 0.45 s a note and
// the last 0.9 s, twice as long with Slow (FACTS 77); the reveal, with the
// Notice and the drawer, waits until both are heard to their end with
// sound on, and a scale cut short is not heard (WEB-SPEC, Toys 3); Step
// 5's Major · Minor waits for the choice and stays enabled after the
// viewer leaves and comes back (End to end 3, here on the page's modules);
// and the names switch, one page-wide store, names the stairs do re mi fa
// so la ti do in major and do re me fa so le te do in minor, and Letters
// gives `spellScale`'s names on every root (Tests 13).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import { MAJOR_DEGREES } from '@/features/lessons/kit/major-scale'
import type { Letter } from '@/features/lessons/kit/notes'
import { signName, spellScale } from '@/features/lessons/kit/notes'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import type * as RunModule from '@/features/lessons/kit/run'
import type { RecordedRun } from '@/features/lessons/kit/run-recorder.test-fixtures'
import { resetRuns, runs, } from '@/features/lessons/kit/run-recorder.test-fixtures'
import { Sound } from '@/features/lessons/kit/sound'
import { MOTION } from './chord-beads'
import type { BeadsScene } from './chord-beads-draw'
import type { Quality } from './chords'
import { NATURAL_MINOR_DEGREES, ROOTS } from './chords'
import { SCALE_PREDICT } from './lines'
import { el, mountSteps, settle, soundOn } from './page-dom.test-fixtures'
import { scaleSound, slow } from './sounds'

vi.mock('@/features/lessons/kit/run', async (actual) => ({
  ...(await actual<typeof RunModule>()),
  ...(await import('@/features/lessons/kit/run-recorder.test-fixtures'))
    .recordedRuns,
}))

type Deck = ReturnType<typeof mountSteps>

/** The page on Step 5, its figure a phone's 356 x 340 (FACTS 82). */
function openFive(): Deck {
  const deck = mountSteps()
  vi.spyOn(
    el<HTMLCanvasElement>('#toyChord [data-chord-viz] canvas'),
    'getBoundingClientRect',
  ).mockReturnValue(new DOMRect(0, 0, 356, 340))
  deck.show(5)
  return deck
}

const stage = (selector: string): HTMLButtonElement =>
  el<HTMLButtonElement>(`#toyChord ${selector}`)
const view = (v: 'chord' | 'scale'): HTMLButtonElement =>
  stage(`[data-chord-view] [data-view="${v}"]`)
const quality = (qy: Quality): HTMLButtonElement =>
  stage(`[data-scale-quality] [data-quality="${qy}"]`)
const namesBtn = (m: 'letters' | 'solfege'): HTMLButtonElement =>
  stage(`[data-names="${m}"]`)
const predict = (selector: string): HTMLElement =>
  el(`#predictScale ${selector}`)
const choose = (c: 'one' | 'three'): void => {
  predict(`[data-choice="${c}"]`).click()
}
const playBtn = (qy: Quality): HTMLButtonElement =>
  el<HTMLButtonElement>(`#predictScale [data-play="scale-${qy}"]`)
const hint = (): string => predict('.lock-hint').textContent?.trim() ?? ''
const revealed = (): boolean[] =>
  [
    predict('.reveal'),
    ...document.querySelectorAll<HTMLElement>('#step-5 [data-scale-reveal]'),
  ].map((r) => !r.hidden)
const pressed = (b: HTMLElement): string | null =>
  b.getAttribute('aria-pressed')
const last = (): RecordedRun => {
  const r = runs.at(-1)
  if (r === undefined) throw new Error('nothing played')
  return r
}
const sceneOf = (deck: Deck): BeadsScene => {
  const s = deck.beads.scene()
  if (s === null) throw new Error('no scene')
  return s
}
const stairs = (deck: Deck): string[] => sceneOf(deck).stairs.map((s) => s.name)

/** The clock on by `seconds`. */
const later = (seconds: number): void => {
  vi.advanceTimersByTime(seconds * 1000)
}

/** Plays `qy`'s scale from the predict and hears it to its end. */
async function hear(qy: Quality): Promise<RecordedRun> {
  playBtn(qy).click()
  const run = last()
  run.end(true)
  await settle()
  await settle()
  return run
}

beforeEach(() => {
  resetRuns()
  soundOn()
  vi.useFakeTimers({
    toFake: ['setTimeout', 'clearTimeout', 'performance'],
    now: 0,
  })
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  window.location.hash = ''
  document.body.textContent = ''
})

describe("Lesson 10's Step 5, the chord in its scale", () => {
  it('opens on the chord, C major, folded, with Chord and Letters pressed and its own Major · Minor disabled', () => {
    // Act
    const deck = openFive()

    // Assert
    expect(deck.beads.settings).toMatchObject({
      state: 'scale',
      root: 60,
      quality: 'major',
      spread: false,
      names: 'letters',
    })
    expect([pressed(view('chord')), pressed(view('scale'))]).toEqual([
      'true',
      'false',
    ])
    expect(pressed(namesBtn('letters'))).toBe('true')
    expect([quality('major').disabled, quality('minor').disabled]).toEqual([
      true,
      true,
    ])
    expect(hint()).toBe(SCALE_PREDICT.lock)
  })

  it('spreads the chord into its staircase with Scale and folds it back with Chord, each pressed, stopping the stage’s sound first', () => {
    // Arrange: a bead sounding
    const deck = openFive()
    el('#toyChord [data-chord-targets] button').click()
    const bead = last()

    // Act
    view('scale').click()
    later(MOTION.spread)
    const spread = { set: deck.beads.settings.spread, at: sceneOf(deck).spread }
    const shown = [pressed(view('chord')), pressed(view('scale'))]
    view('chord').click()
    later(MOTION.spread)

    // Assert
    expect(bead.stopped).toBe(true)
    expect(spread).toEqual({ set: true, at: 1 })
    expect(shown).toEqual(['false', 'true'])
    expect(deck.beads.settings.spread).toBe(false)
    expect(sceneOf(deck).spread).toBe(0)
    expect(pressed(view('chord'))).toBe('true')
  })

  it('keeps its own Major · Minor disabled until the predict’s choice unlocks it, and enabled after the viewer leaves and comes back', () => {
    // Arrange
    const deck = openFive()
    const before = [quality('major').disabled, quality('minor').disabled]

    // Act
    choose('three')
    const chosen = [quality('major').disabled, quality('minor').disabled]
    deck.show(4)
    deck.show(5)

    // Assert: End to end 3
    expect(before).toEqual([true, true])
    expect(chosen).toEqual([false, false])
    expect([quality('major').disabled, quality('minor').disabled]).toEqual([
      false,
      false,
    ])
    expect(pressed(quality('major'))).toBe('true')
  })

  it('plays C major on the staircase, spreading it first, each stair lit as it sounds, 0.45 s a note and the last 0.9 s', () => {
    // Arrange
    const deck = openFive()
    choose('one')

    // Act
    playBtn('major').click()
    const run = last()
    run.note(0)
    const first = sceneOf(deck).stairs.map((s) => s.lit)
    run.note(2)

    // Assert: FACTS 77
    expect(deck.beads.settings.spread).toBe(true)
    expect(pressed(view('scale'))).toBe('true')
    expect(run.notes).toEqual(scaleSound(60, 'major'))
    expect(run.o.kind).toBe('soft')
    expect(first).toEqual([1, 0, 0, 0, 0, 0, 0, 0])
    expect(sceneOf(deck).stairs[2].lit).toBe(1)
  })

  it('plays C minor on the staircase in minor, Minor pressed, and both scales twice as long with Slow', async () => {
    // Arrange
    const deck = openFive()
    choose('three')
    stage('[data-chord-slow]').click()

    // Act
    const major = await hear('major')
    const minor = await hear('minor')

    // Assert
    expect(deck.beads.settings.quality).toBe('minor')
    expect(pressed(quality('minor'))).toBe('true')
    expect(major.notes).toEqual(slow(scaleSound(60, 'major')))
    expect(minor.notes).toEqual(slow(scaleSound(60, 'minor')))
  })

  it('reveals once both scales have been heard to their end, the Notice and the drawer with it, saying what was chosen', async () => {
    // Arrange
    openFive()
    choose('one')

    // Act
    await hear('major')
    const afterOne = { hint: hint(), shown: revealed() }
    await hear('minor')

    // Assert: LESSON.md's hints and "You said" line
    expect(afterOne).toEqual({
      hint: SCALE_PREDICT.hints.next,
      shown: [false, false, false],
    })
    expect(revealed()).toEqual([true, true, true])
    expect(predict('.reveal .mono').textContent).toBe('You said: just one')
    expect(hint()).toBe(SCALE_PREDICT.hints.again)
  })

  it.each([
    {
      cut: 'another sound on the page',
      by: () => NowPlaying.claim(() => undefined),
    },
    { cut: 'the names switch', by: () => namesBtn('solfege').click() },
    { cut: 'Chord · Scale', by: () => view('chord').click() },
  ])(
    'counts a scale cut short by $cut as not heard: no reveal',
    async ({ by }) => {
      // Arrange: C major heard, C minor sounding
      openFive()
      choose('three')
      await hear('major')
      playBtn('minor').click()
      const minor = last()

      // Act
      by()
      await settle()
      await settle()

      // Assert
      expect(minor.stopped).toBe(true)
      expect(revealed()).toEqual([false, false, false])
      expect(hint()).toBe(SCALE_PREDICT.hints.next)
    },
  )

  it('counts a scale cut short by leaving the step as not heard, and reveals once it is heard on the viewer’s return', async () => {
    // Arrange
    const deck = openFive()
    choose('three')
    await hear('major')
    playBtn('minor').click()
    const minor = last()

    // Act
    deck.show(4)
    await settle()
    await settle()
    const away = revealed()
    deck.show(5)
    await hear('minor')

    // Assert
    expect(minor.stopped).toBe(true)
    expect(away).toEqual([false, false, false])
    expect(revealed()).toEqual([true, true, true])
    expect(predict('.reveal .mono').textContent).toBe('You said: three')
  })

  it('plays silently with sound off, says so, and waits to reveal', async () => {
    // Arrange
    openFive()
    vi.spyOn(Sound, 'canPlay').mockReturnValue(false)
    vi.spyOn(Sound, 'state', 'get').mockReturnValue('off')
    choose('three')

    // Act
    const major = await hear('major')
    const minor = await hear('minor')

    // Assert
    expect([major.o.audible, minor.o.audible]).toEqual([false, false])
    expect(hint()).toBe(SCALE_PREDICT.hints.silent)
    expect(revealed()).toEqual([false, false, false])
  })
})

describe("Lesson 10's names on the stairs", () => {
  it('names the stairs do re mi fa so la ti do on Do-re-mi, and do re me fa so le te do under Minor, on the page’s one store (Tests 13)', () => {
    // Arrange: spread, the choice in
    const deck = openFive()
    view('scale').click()
    later(MOTION.spread)
    choose('three')

    // Act
    namesBtn('solfege').click()
    const major = stairs(deck)
    quality('minor').click()
    later(MOTION.third)
    const minor = stairs(deck)
    namesBtn('letters').click()

    // Assert: FACTS 8, 26
    expect(major).toEqual(['do', 're', 'mi', 'fa', 'so', 'la', 'ti', 'do'])
    expect(minor).toEqual(['do', 're', 'me', 'fa', 'so', 'le', 'te', 'do'])
    expect(stairs(deck)).toEqual([
      'C4',
      'D4',
      'E♭4',
      'F4',
      'G4',
      'A♭4',
      'B♭4',
      'C5',
    ])
    expect(deck.names.mode).toBe('letters')
  })

  it('shows the store’s choice pressed, whichever control set it, and keeps it as the viewer leaves the step and comes back', () => {
    // Arrange
    const deck = openFive()

    // Act
    deck.names.set('solfege')
    const shown = [pressed(namesBtn('letters')), pressed(namesBtn('solfege'))]
    deck.show(1)
    deck.show(5)

    // Assert
    expect(shown).toEqual(['false', 'true'])
    expect(deck.beads.settings.names).toBe('solfege')
    expect(pressed(namesBtn('solfege'))).toBe('true')
  })

  it('stops the stage’s sound first when the names change', () => {
    // Arrange: a bead sounding
    openFive()
    el('#toyChord [data-chord-targets] button').click()
    const bead = last()

    // Act
    namesBtn('solfege').click()

    // Assert
    expect(bead.stopped).toBe(true)
  })

  it.each(ROOTS)(
    'names the stairs by spellScale’s letters on root %i, major and minor (Tests 13, FACTS 27)',
    (root) => {
      // Arrange: spread on C4, then slid to `root`, as free play can
      const deck = openFive()
      deck.beads.setSpread(true)
      while (deck.beads.settings.root < root) deck.beads.slideRoot(1)
      later(MOTION.root + MOTION.spread)
      const letter = 'CDEFGAB'[ROOTS.indexOf(root)] as Letter
      const want = (degrees: readonly number[]): string[] =>
        spellScale(letter, root, degrees).map((s) => signName(s))

      // Act
      const major = stairs(deck)
      deck.beads.setQuality('minor')
      later(MOTION.third)

      // Assert
      expect(deck.beads.settings.root).toBe(root)
      expect(major).toEqual(want(MAJOR_DEGREES))
      expect(stairs(deck)).toEqual(want(NATURAL_MINOR_DEGREES))
    },
  )
})
