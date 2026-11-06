// ============================================================
// Lesson 17 steps tests — one rhythm bar, in each step's state
// ============================================================
//
// The live lines and what a change keeps written, pure; then on the page's
// own markup and its own deck, with the beat clock a recorder: each step
// shows its own row with the pitch-line switch in it, its label and its
// bar (WEB-SPEC, Toys 5); Halve and Join on the chosen beat, played at
// once, and the hint for a press that cannot go (Toys 1); Play both and the
// tempo; Count, faint every second play; Note · Rest and the rest strip;
// Step 5's lift, its bars written by their first play, Dot, Tie and Clef,
// and the clef of a voice chosen later in the sung part; the switch kept
// across steps; and leaving a step stops what it plays.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import type * as BeatClockModule from '@/features/lessons/kit/beat-clock'
import { A3, A4, hz } from '@/features/lessons/kit/notes'
import type { Bar, NoteValue, Written, } from '@/features/lessons/kit/rhythm-model'
import { FOUR_QUARTERS, halve, join, toggleRest, writeGrid, } from '@/features/lessons/kit/rhythm-model'
import type * as SoundAheadModule from '@/features/lessons/kit/sound-ahead'
import type { StepDeck } from '@/features/lessons/kit/step-deck'
import { createStepDeck } from '@/features/lessons/kit/step-deck'
import { VoiceChoice } from '@/features/lessons/kit/voice-choice'
import type * as WoodblockModule from '@/features/lessons/kit/woodblock'
import { drive, el, finish, loadPage, resetRuns, runs, soundOn, words, } from './page-dom.test-fixtures'
import { halvedLine, initSteps, joinedLine, keptWritten, REFUSAL_HINT, restLine, } from './steps'

vi.mock('@/features/lessons/kit/beat-clock', async (actual) => ({
  ...(await actual<typeof BeatClockModule>()),
  BeatClock: (await import('./page-dom.test-fixtures')).FakeBeatClock,
}))
const voices: number[] = []
vi.mock('@/features/lessons/kit/sound-ahead', async (actual) => ({
  ...(await actual<typeof SoundAheadModule>()),
  bookNote: (freq: number) => {
    voices.push(freq)
    return null
  },
}))
vi.mock('@/features/lessons/kit/woodblock', async (actual) => ({
  ...(await actual<typeof WoodblockModule>()),
  bookWood: () => undefined,
}))

/** The steps on the page's own deck, as main.ts mounts them: the toy, then the deck's start. */
function mountSteps(): StepDeck {
  loadPage()
  vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined)
  const deck = createStepDeck({
    toyFor: () => 1,
    after: { label: 'Tap it', selector: '#sing' },
  })
  initSteps()
  deck.start()
  return deck
}

const note = (value: NoteValue, more: Partial<Written> = {}): Written => ({
  kind: 'note',
  value,
  ...more,
})
const rest = (value: NoteValue): Written => ({ kind: 'rest', value })

beforeEach(() => {
  resetRuns()
  voices.length = 0
  soundOn()
})

afterEach(() => {
  vi.restoreAllMocks()
  window.location.hash = ''
  document.body.textContent = ''
})

/** The figure's written symbols, by index. */
const written = (): number[] =>
  Array.from(
    document.querySelectorAll('#toyRhythm .rb-sym:not(.is-hidden)'),
    (g) => Number(g.getAttribute('data-i')),
  )
/** The strip's readings showing, in order. */
const readings = (): string[] =>
  Array.from(
    document.querySelectorAll('#toyRhythm .rb-read:not(.is-hidden)'),
    (t) => t.textContent ?? '',
  )
const figure = () => el('#toyRhythm [data-rb]')
const said = () => words(el('#toyRhythm [data-rb-said]'))
const pad = (beat: number) =>
  el<HTMLButtonElement>(`#toyRhythm .rb-padbtn[data-beat="${beat}"]`)
/** The showing row's button `selector` finds. */
const showing = (selector: string) =>
  Array.from(document.querySelectorAll<HTMLButtonElement>(selector)).find(
    (b) => b.closest('[hidden]') === null,
  ) ?? el<HTMLButtonElement>(selector)

describe('the live lines and what stays written', () => {
  it('says each refusal as the spec words it', () => {
    // Assert (WEB-SPEC, Toys 1)
    expect(REFUSAL_HINT).toEqual({
      shortest: 'A sixteenth is the shortest note here.',
      pair: 'Join needs a quarter on the other beat of the pair too.',
      halves: 'Join needs a half note in the other half of the bar too.',
      whole: 'A whole note already fills the bar.',
      silent: 'Turn the rest back into a note first.',
    })
  })

  it('keeps written what a change leaves as it was heard, and nothing it wrote anew', () => {
    // Arrange
    const quarters = writeGrid(FOUR_QUARTERS)
    const all = [true, true, true, true]
    const split = halve(FOUR_QUARTERS, 1)
    if (!('bar' in split)) throw new Error('no halve')
    const oneRest: Bar = [rest(1), note(1), note(1), note(1)]
    const halfRest: Bar = [rest(2), note(1), note(1)]

    // Act
    const halved = keptWritten([quarters], all, [writeGrid(split.bar)])
    const merged = keptWritten([oneRest], all, [halfRest])
    const tied = keptWritten(
      [[note(2), note(1), note(1)]],
      [true, true, true],
      [[note(2), note(1), note(1, { tie: true })]],
    )
    const unheard = keptWritten([quarters], [true, false], [quarters])

    // Assert
    expect(halved).toEqual([true, false, false, true, true])
    expect(merged).toEqual([false, true, true])
    expect(tied).toEqual([true, true, false])
    expect(unheard).toEqual([true, false, false, false])
  })

  it('says what each Halve, Join and pad press made', () => {
    // Arrange
    const step = (g: ReturnType<typeof halve>) => {
      if (!('bar' in g)) throw new Error('refused')
      return g.bar
    }
    const eighths = step(halve(FOUR_QUARTERS, 1))
    const half = step(join(FOUR_QUARTERS, 0))
    const twoHalves = step(join(half, 2))

    // Assert
    expect(halvedLine(FOUR_QUARTERS, eighths, 1)).toBe(
      'Beat 2 halved: two eighth notes',
    )
    expect(halvedLine(half, step(halve(half, 1)), 1)).toBe(
      'The half note halved: two quarter notes',
    )
    expect(joinedLine(eighths, FOUR_QUARTERS, 1)).toBe(
      'Beat 2 joined: a quarter note',
    )
    expect(joinedLine(FOUR_QUARTERS, half, 1)).toBe(
      'Beats 1 and 2 joined: a half note',
    )
    expect(joinedLine(twoHalves, step(join(twoHalves, 0)), 0)).toBe(
      'The two half notes joined: a whole note',
    )
    expect(restLine(toggleRest(FOUR_QUARTERS, 2), 2)).toBe(
      'Beat 3 silent: a quarter rest',
    )
    expect(restLine(toggleRest(half, 1), 1)).toBe('Beat 2 silent: a half rest')
    expect(restLine(toggleRest(toggleRest(FOUR_QUARTERS, 2), 2), 2)).toBe(
      'Beat 3 sounding again: a quarter note',
    )
  })
})

describe('the stage, step by step', () => {
  it('shows each step its own row, with the pitch-line switch in it, its label and its bar', () => {
    // Arrange
    const deck = mountSteps()
    const seen: string[][] = []

    // Act
    for (const n of [1, 2, 3, 4, 5]) {
      deck.show(n)
      const rows = Array.from(
        document.querySelectorAll<HTMLElement>('#toyRhythm [data-rb-for]'),
      )
        .filter((r) => !r.hidden)
        .map((r) => r.dataset.rbFor ?? '')
      const lanes = el('[data-rb-lanes]').closest<HTMLElement>('[data-rb-for]')
      seen.push([
        [...new Set(rows)].join(' '),
        lanes?.dataset.rbFor ?? '',
        words(el('#toyRhythm [data-fig-label]')),
        figure().getAttribute('aria-label') ?? '',
      ])
    }

    // Assert (WEB-SPEC, Toys 5)
    expect(seen).toEqual([
      [
        'halves',
        'halves',
        'Fig. 1 A bar, halved and joined',
        'One bar of 4/4: four quarter notes, on one line',
      ],
      [
        'tempo',
        'tempo',
        'Fig. 2 One bar, any tempo',
        'One bar of 4/4: two quarter notes and a half note, on one line',
      ],
      [
        'count',
        'count',
        'Fig. 3 The counts under the notes',
        'One bar of 4/4: eight eighth notes, on one line',
      ],
      [
        'rests',
        'rests',
        'Fig. 4 Notes and rests',
        'One bar of 4/4: four quarter notes, on one line',
      ],
      [
        'staff',
        'staff',
        'Fig. 5 Two bars on the staff',
        'One bar of 4/4: four quarter notes, on the bass staff',
      ],
    ])
  })

  it('halves the chosen beat and plays it at once, its unchanged beats still written', async () => {
    // Arrange
    mountSteps()
    showing('[data-rb-play]').click()
    await finish()

    // Act
    pad(1).click()
    showing('[data-rb-halve]').click()

    // Assert
    expect(pad(1).getAttribute('aria-pressed')).toBe('true')
    expect(said()).toBe('Beat 2 halved: two eighth notes')
    expect(figure().getAttribute('aria-label')).toBe(
      'One bar of 4/4: a quarter note, two eighth notes and two quarter notes, on one line',
    )
    expect(written()).toEqual([0, 3, 4])
    expect(runs.length).toBe(2)
    drive()
    expect(written()).toEqual([0, 1, 2, 3, 4])
  })

  it('marks a press that cannot go aria-disabled, with its hint, after the halvings leave sixteenths', async () => {
    // Arrange
    mountSteps()
    const halveBtn = showing('[data-rb-halve]')
    const hint = el('#rbHint')

    // Act
    showing('[data-rb-halvings]').click()
    await finish()
    const after = [halveBtn.getAttribute('aria-disabled'), words(hint)]
    halveBtn.click()
    const refused = said()
    showing('[data-rb-reset]').click()

    // Assert
    expect(after).toEqual(['true', 'A sixteenth is the shortest note here.'])
    expect(refused).toBe('A sixteenth is the shortest note here.')
    expect(halveBtn.getAttribute('aria-disabled')).toBe('false')
    expect(hint.hidden).toBe(true)
    expect(figure().getAttribute('aria-label')).toBe(
      'One bar of 4/4: four quarter notes, on one line',
    )
  })

  it('shows the hint for a Join that cannot go while Halve still can', () => {
    // Arrange
    mountSteps()
    pad(1).click()
    showing('[data-rb-halve]').click()

    // Act
    pad(0).click()

    // Assert (WEB-SPEC, Toys 1)
    expect(showing('[data-rb-join]').getAttribute('aria-disabled')).toBe('true')
    expect(showing('[data-rb-halve]').getAttribute('aria-disabled')).toBe(
      'false',
    )
    expect(words(el('#rbHint'))).toBe(
      'Join needs a quarter on the other beat of the pair too.',
    )
  })

  it('puts back four quarters, unwritten, when Reset stops the halvings partway', async () => {
    // Arrange
    mountSteps()
    showing('[data-rb-play]').click()
    await finish()
    showing('[data-rb-halvings]').click()
    drive(5)

    // Act
    showing('[data-rb-reset]').click()

    // Assert (FACTS 66)
    expect(said()).toBe('Back to four quarter notes')
    expect(figure().getAttribute('aria-label')).toBe(
      'One bar of 4/4: four quarter notes, on one line',
    )
    expect(written()).toEqual([])
  })

  it("redraws Step 2's bar at the slider's tempo, its readings gone until each note ends again", async () => {
    // Arrange
    const deck = mountSteps()
    deck.show(2)
    const slider = el<HTMLInputElement>('#tempoBar')
    showing('[data-rb-play]').click()
    await finish()
    const before = readings()

    // Act
    slider.value = '120'
    slider.dispatchEvent(new Event('input', { bubbles: true }))
    const cleared = readings()
    showing('[data-rb-play]').click()
    await finish()

    // Assert (WEB-SPEC, Toys 6)
    expect(before).toEqual(['1 s', '1 s', '2 s'])
    expect(cleared).toEqual([])
    expect(readings()).toEqual(['0.5 s', '0.5 s', '1 s'])
  })

  it("plays Play both's two rows, and gives Step 2's bar back to Play at the slider's tempo, the track filled to the thumb", () => {
    // Arrange
    const deck = mountSteps()
    deck.show(2)
    const slider = el<HTMLInputElement>('#tempoBar')
    const filled = slider.style.getPropertyValue('--p')

    // Act
    showing('[data-rb-both]').click()
    const both = figure().getAttribute('aria-label')
    slider.value = '90'
    slider.dispatchEvent(new Event('input', { bubbles: true }))
    showing('[data-rb-play]').click()

    // Assert
    expect(both).toMatch(/^Two rows on one time axis, on one line: /)
    expect(words(el('label[for="tempoBar"]'))).toBe('Tempo 90 BPM')
    expect(slider.getAttribute('aria-valuetext')).toBe('90 beats per minute')
    // the kit's track fill reads --p, and without it sits halfway at any tempo
    expect([filled, slider.style.getPropertyValue('--p')]).toEqual([
      '0%',
      '50%',
    ])
    expect(figure().getAttribute('aria-label')).toBe(
      'One bar of 4/4: two quarter notes and a half note, on one line',
    )
    expect(runs.at(-1)?.o.bpm()).toBe(90)
  })

  it('counts Step 3 under its notes, faint every second play, and nowhere else', async () => {
    // Arrange
    const deck = mountSteps()
    deck.show(3)
    const count = showing('[data-rb-count]')

    // Act
    count.click()
    showing('[data-rb-play]').click()
    drive(1)
    const first = document.querySelectorAll('#toyRhythm .rb-count.is-faint')
    await finish()
    showing('[data-rb-play]').click()
    drive(1)
    const second = document.querySelectorAll('#toyRhythm .rb-count.is-faint')
    deck.show(4)

    // Assert
    expect(count.getAttribute('aria-pressed')).toBe('true')
    expect(first.length).toBe(0)
    expect(second.length).toBeGreaterThan(0)
    expect(document.querySelectorAll('#toyRhythm .rb-count').length).toBe(0)
  })

  it('silences a beat from its pad and plays the bar at once; the rest strip plays an example', () => {
    // Arrange
    const deck = mountSteps()
    deck.show(4)

    // Act
    pad(2).click()
    const silenced = [said(), figure().getAttribute('aria-label')]
    const playing = runs.length
    showing('[data-rb-rest="2"]').click()

    // Assert
    expect(silenced).toEqual([
      'Beat 3 silent: a quarter rest',
      'One bar of 4/4: two quarter notes, a quarter rest and a quarter note, on one line',
    ])
    expect(playing).toBe(1)
    expect(figure().getAttribute('aria-label')).toBe(
      'Two bars of 4/4: two quarter notes and a half rest, then a quarter note, on one line',
    )
    expect(el('#toyRhythm [data-rb-pads]').hidden).toBe(true)
  })

  it("lifts Step 4's line into the staff as Step 5 opens, and writes Step 5's bars by their first play", () => {
    // Arrange
    const deck = mountSteps()
    deck.show(4)
    showing('[data-rb-play]').click()
    drive()

    // Act
    deck.show(5)
    const carried = written()
    const lifting = figure().classList.contains('is-lifting')
    const lines = Array.from(
      document.querySelectorAll<SVGElement>('#toyRhythm .rb-staff[data-place]'),
      (l) => l.style.getPropertyValue('--lift-y'),
    )
    showing('[data-rb-play]').click()

    // Assert (WEB-SPEC, Toys 5)
    expect(carried).toEqual([0, 1, 2, 3])
    expect(lifting).toBe(true)
    expect(lines).toHaveLength(5)
    expect(lines.every((y) => /^-?\d+(\.\d)?px$/.test(y))).toBe(true)
    expect(figure().getAttribute('aria-label')).toBe(
      'Two bars of 4/4: a half note and two quarter notes, then two quarter notes and a half note, on the bass staff',
    )
    expect(written()).toEqual([])
    drive()
    expect(written()).toEqual([0, 1, 2, 3, 4, 5])
  })

  it('changes the bars with Dot and Tie, says so and plays them; Clef moves the staff and the sound', () => {
    // Arrange
    const deck = mountSteps()
    deck.show(5)

    // Act
    showing('[data-rb-dot]').click()
    const dotted = [said(), figure().getAttribute('aria-label')]
    drive()
    const low = [...voices]
    showing('[data-rb-tie]').click()
    const tied = said()
    showing('[data-rb-clef="treble"]').click()
    const treble = said()
    voices.length = 0
    showing('[data-rb-play]').click()
    drive()

    // Assert (WEB-SPEC, Toys 1)
    expect(dotted).toEqual([
      'Dots added: a dotted half note, then a dotted quarter and an eighth',
      'Two bars of 4/4: a dotted half note and a quarter note, then a dotted quarter note, an eighth note and a half note, on the bass staff',
    ])
    expect(el('[data-rb-dot]').getAttribute('aria-pressed')).toBe('true')
    expect(new Set(low)).toEqual(new Set([hz(A3)]))
    expect(tied).toBe('Tie added across the bar line')
    expect(treble).toBe('The treble staff: every note on A4')
    expect(el('[data-rb-clef="treble"]').getAttribute('aria-pressed')).toBe(
      'true',
    )
    expect(figure().getAttribute('aria-label')).toMatch(
      /tied across the bar line, on the treble staff$/,
    )
    expect(new Set(voices)).toEqual(new Set([hz(A4)]))
  })

  it('takes the clef of a voice chosen later, in the sung part, redrawing Step 5 as it shows', () => {
    // Arrange
    const deck = mountSteps()

    // Act: chosen while Step 1 plays, which plays on, then at Step 5 once
    // its bars are written: the same voice again changes nothing
    showing('[data-rb-play]').click()
    VoiceChoice.set('higher')
    const stepOne = runs[runs.length - 1].stopped
    drive()
    deck.show(5)
    const opened = figure().getAttribute('aria-label')
    showing('[data-rb-play]').click()
    VoiceChoice.set('higher')
    const same = runs[runs.length - 1].stopped
    drive()
    VoiceChoice.set('lower')
    const bass = [
      el('[data-rb-clef="bass"]').getAttribute('aria-pressed'),
      figure().getAttribute('aria-label'),
      written(),
    ]
    voices.length = 0
    showing('[data-rb-play]').click()
    drive()

    // Assert (WEB-SPEC, Toys 7, part 2, state 2)
    expect([stepOne, same]).toEqual([false, false])
    expect(opened).toMatch(/on the treble staff$/)
    expect(bass[0]).toBe('true')
    expect(bass[1]).toMatch(/on the bass staff$/)
    expect(bass[2]).toEqual([0, 1, 2, 3, 4, 5])
    expect(new Set(voices)).toEqual(new Set([hz(A3)]))
  })

  it('keeps the pitch line on across the steps, and stops what a step plays as it is left', () => {
    // Arrange
    const deck = mountSteps()
    const lanes = el<HTMLButtonElement>('[data-rb-lanes]')

    // Act
    lanes.click()
    showing('[data-rb-play]').click()
    deck.show(2)

    // Assert
    expect(lanes.getAttribute('aria-pressed')).toBe('true')
    expect(runs[0].stopped).toBe(true)
    expect(figure().querySelector('svg')?.dataset.staff).toBe('lanes')
    expect(figure().getAttribute('aria-label')).toBe(
      'One bar of 4/4: two quarter notes and a half note, on the pitch line',
    )
    expect(lanes.closest<HTMLElement>('[data-rb-for]')?.dataset.rbFor).toBe(
      'tempo',
    )
  })
})
