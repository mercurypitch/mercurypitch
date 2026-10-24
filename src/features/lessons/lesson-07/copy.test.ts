// ============================================================
// Lesson 7 copy tests — the words the page writes, against the house rules
// ============================================================
//
// WEB-SPEC, Tests 8: every line Sing it and the chart write passes the
// guided-voice claims check as a finding; no quick-check feedback starts
// "Right", "Yes" or "Correct" (the kit's quiz writes "Right." and "Not
// quite." itself); nothing spoken holds a ♯ or ♭ sign; and no two controls
// on the steps' stage share an accessible name. The live words name notes
// in words, and never a span or an end of a voice.

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import { validateGuidedDynamicClaim } from '@/lib/guided-voice/claims'
import { GUESS, HINTS } from './cold-open'
import { QUIZ_QUESTIONS, RECALL_QUESTIONS } from './quiz-questions'
import type { ChartVoice } from './range-data'
import { bandLabel, BANDS, bandSaid, pushReadout, SIREN_SEC, sirenWhere, twinkleDo, } from './range-data'
import { HERO_BEFORE, heroAfter, singerLines, sirenSaid, songSaid, TYPES_NAMED, typesSaid, } from './range-words'
import { afterStatus, STATUS } from './sing'
import { takeSaid } from './sing-take'
import { SIREN_LINES } from './siren-flow'
import { TYPES_GUESS } from './steps'

const VOICES: readonly ChartVoice[] = ['lower', 'higher']

/** Every line the chart speaks, for both voices and every state. */
function spokenLines(): string[] {
  const lines: string[] = [HERO_BEFORE, TYPES_NAMED]
  for (const v of VOICES) {
    lines.push(heroAfter(v), sirenSaid(v, null))
    for (const s of ['ng', 'trill', 'oo'] as const) lines.push(sirenSaid(v, s))
    for (let d = -12; d <= 15; d++) lines.push(songSaid(v, twinkleDo(v) + d))
    for (let m = 45; m <= 81; m++) lines.push(pushReadout(v, m).spoken)
    for (let t = 0; t <= SIREN_SEC; t += 0.1) lines.push(sirenWhere(v, t))
  }
  for (const singer of [null, 'a', 'b'] as const)
    lines.push(typesSaid({ singer, all: false, band: null }))
  lines.push(typesSaid({ singer: null, all: true, band: null }))
  for (const b of BANDS) lines.push(bandSaid(b), bandLabel(b))
  return lines
}

/** Sing it's own lines: its status, its closing lines and the chart's words after a take. */
function singLines(): string[] {
  const band = (low: number, high: number) => ({
    kind: 'half' as const,
    heard: true,
    band: { low, high },
    line: '',
    spoken: '',
  })
  return [
    ...Object.values(STATUS),
    ...Object.values(SIREN_LINES),
    takeSaid('lower', band(55, 60)),
    takeSaid('lower', band(57, 57)),
    takeSaid('lower', band(80, 84)),
    takeSaid('higher', band(40, 44)),
  ]
}

describe("Lesson 7's live words", () => {
  it('pass the guided-voice claims check, as a finding', () => {
    for (const text of [...singLines(), ...spokenLines()]) {
      // Act
      const result = validateGuidedDynamicClaim({ surface: 'finding', text })

      // Assert
      expect(result.violations, text).toEqual([])
    }
  })

  it('hold no ♯ or ♭ sign in anything spoken', () => {
    const signed = [...spokenLines(), ...singLines()].filter((l) =>
      /[♯♭]/.test(l),
    )
    expect(signed).toEqual([])
  })

  it('say the singers apart only by where each is comfortable', () => {
    expect(singerLines(null)).toEqual(['Two singers, one range', 'A3 to C6'])
    expect(singerLines('a')).toEqual([
      'Singer A',
      'comfortable E4 to E5',
      'probably a soprano',
    ])
    expect(singerLines('b')).toEqual([
      'Singer B',
      'comfortable C4 to C5',
      'probably a mezzo-soprano',
    ])
  })

  it('give the status after an answer as the flow closes it', () => {
    // Arrange: an unsteady take, answered "Easy", with Again still to come
    const offers = {
      start: false,
      startReady: false,
      startHint: null,
      ask: true,
      locked: false,
      again: true,
      done: true,
      closing: 'plain' as const,
      tryAgain: true,
      doctor: false,
      keepBand: true,
      restCard: false,
    }

    // Act
    const said = afterStatus(offers, "We didn't hear a steady siren that time.")
    const asked = afterStatus(
      { ...offers, closing: null, tryAgain: false },
      'The lit band is the middle of your siren: about A3.',
    )

    // Assert
    expect(said).toBe(
      "That's it: one gentle siren, done. Try again at about speaking volume.",
    )
    expect(asked).toBe(
      'The lit band is the middle of your siren: about A3. How did that feel?',
    )
  })
})

describe("Lesson 7's predicts and quiz", () => {
  it('never call a guess right or wrong', () => {
    const lines = [
      ...Object.values(GUESS),
      ...Object.values(TYPES_GUESS),
      ...Object.values(HINTS),
    ]
    expect(lines.filter((l) => /\b(?:right|wrong|correct)\b/i.test(l))).toEqual(
      [],
    )
  })

  it('start no feedback line with "Right", "Yes" or "Correct": the quiz says so itself', () => {
    const feedback = [...QUIZ_QUESTIONS, ...RECALL_QUESTIONS].flatMap((q) =>
      q.options.map((o) => o.feedback),
    )
    expect(feedback).toHaveLength(18)
    expect(feedback.filter((f) => /^(?:Right|Yes|Correct)\b/.test(f))).toEqual(
      [],
    )
  })

  it('ask the recall under Lesson 3’s own ids, and the quick check under its own', () => {
    expect(RECALL_QUESTIONS.map((q) => q.id)).toEqual(['l03-q1', 'l03-q4'])
    expect(QUIZ_QUESTIONS.map((q) => q.id)).toEqual([
      'l07-q1',
      'l07-q2',
      'l07-q3',
      'l07-q4',
    ])
    for (const q of QUIZ_QUESTIONS) {
      expect(q.options).toHaveLength(3)
      expect(q.options.filter((o) => o.correct === true)).toHaveLength(1)
    }
  })

  it('links each misconception back to the step whose chart answers it', () => {
    const links = QUIZ_QUESTIONS.map((q) =>
      q.options
        .map((o) => /data-goto-step="(\d)"/.exec(o.feedback)?.[1])
        .filter((s) => s !== undefined),
    )
    expect(links).toEqual([['1'], ['2'], ['4'], ['5']])
  })
})

describe("the steps' stage", () => {
  it('gives no two of its controls the same accessible name', () => {
    // Arrange: the stage's markup, from its toy to the step texts
    const page = readFileSync(resolve(process.cwd(), 'learn/07.html'), 'utf8')
    const stage = page.slice(
      page.indexOf('id="toyRange"'),
      page.indexOf('id="stepsText"'),
    )
    const doc = new DOMParser().parseFromString(stage, 'text/html')
    for (const b of doc.querySelectorAll<HTMLElement>('[data-band]')) {
      const band = BANDS.find((x) => x.id === b.dataset.band)
      if (band !== undefined) b.setAttribute('aria-label', bandLabel(band))
    }

    // Act
    const names = Array.from(
      doc.querySelectorAll<HTMLElement>('button, [role="slider"]'),
      (c) =>
        (c.getAttribute('aria-label') ?? c.textContent ?? '')
          .replace(/\s+/g, ' ')
          .trim(),
    )
    const twice = names.filter((n, i) => names.indexOf(n) !== i)

    // Assert
    expect(names.length).toBeGreaterThan(20)
    expect(twice).toEqual([])
  })
})
