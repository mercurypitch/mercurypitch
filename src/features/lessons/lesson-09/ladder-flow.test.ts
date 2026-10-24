// ============================================================
// Lesson 9 ladder flow tests — before a take, and the flow's lines
// ============================================================
//
// The WEB-SPEC's Tests 7, up to the first take: the comfort check comes
// first, and with no voice stored the voice choice comes before either path;
// "Just listen today" shows its line and the doctor lines at once, beside
// the voice choice, no warm-up and no Start, and picks the rest card;
// without Web Audio, or with no microphone, Sing it is listen-only with the
// practise card; Move do stops four semitones each way; nothing changes
// during a take. Then the flow's lines, held to LESSON.md and the WEB-SPEC
// word for word and to the claims check. What follows a take is
// ladder-flow-takes.test.ts, the sound-off cases
// ladder-flow-sound-off.test.ts, and the walk over every route a visit can
// take ladder-flow-walk.test.ts.

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { MOVE_MAX } from '@/features/lessons/kit/move-do'
import { validateGuidedDynamicClaim } from '@/lib/guided-voice/claims'
import type { LadderEvent } from './ladder-flow'
import { AGAIN_NAMES, LADDER_LINES, next, offers } from './ladder-flow'
import { begin, briefed, HIGHER, LISTEN, NOMIC, run, SING, visit, } from './ladder-flow.test-fixtures'

/** Both paths, with Web Audio and without. */
const PATHS = [
  ['singing', true, SING],
  ['singing', false, SING],
  ['listening', true, LISTEN],
  ['listening', false, LISTEN],
] as const

describe('before a take', () => {
  it('asks the comfort check first', () => {
    // Act
    const o = offers(visit({ voice: null }))

    // Assert
    expect(o).toMatchObject({
      stage: 'comfort',
      voiceChoice: false,
      listenLine: false,
      doctor: false,
    })
  })

  it.each([true, false])(
    'with no voice stored, asks for the voice before the singing path plays anything (Web Audio %s)',
    (webAudio) => {
      // Act
      const o = offers(run([SING], visit({ voice: null, webAudio })))

      // Assert
      expect(o).toMatchObject({
        stage: 'voice',
        voiceLine: 'none',
        voiceChoice: true,
        listenLine: false,
        doctor: false,
        playMerc: false,
        start: false,
      })
    },
  )

  it.each([true, false])(
    'with no voice stored, shows the listen line and the doctor lines at once beside the voice choice (Web Audio %s)',
    (webAudio) => {
      // Act
      const o = offers(run([LISTEN], visit({ voice: null, webAudio })))

      // Assert
      expect(o).toMatchObject({
        stage: 'voice',
        voiceLine: 'listen',
        voiceChoice: true,
        listenLine: true,
        doctor: true,
        playMerc: false,
        start: false,
        card: 'rest',
      })
    },
  )

  it.each(PATHS)(
    'goes on to the %s path once a voice is chosen (Web Audio %s)',
    (_, webAudio, path) => {
      // Arrange
      const waiting = run([path], visit({ voice: null, webAudio }))

      // Act
      const chosen = next(waiting, HIGHER)

      // Assert
      expect(chosen.voice).toBe('higher')
      expect(offers(chosen).stage).toBe(
        path === LISTEN ? 'listen' : webAudio ? 'briefing' : 'nomic',
      )
    },
  )

  it('shows a stored voice pressed under its own line, ready at once', () => {
    // Act
    const v = briefed()

    // Assert
    expect(v.voice).toBe('lower')
    expect(offers(v)).toMatchObject({
      stage: 'briefing',
      voiceLine: 'stored',
      voiceChoice: true,
    })
  })

  it('lets a stored voice change before Start', () => {
    // Arrange
    const v = briefed()

    // Act
    const changed = next(v, HIGHER)

    // Assert
    expect(changed.voice).toBe('higher')
  })

  it('offers the warm-up, the ladder choice with the full ladder pressed, Move do, Play and Start', () => {
    // Act
    const o = offers(briefed())

    // Assert
    expect(o).toMatchObject({
      warmUp: true,
      ladders: ['full', 'smaller'],
      pressed: 'full',
      moveDo: true,
      playMerc: true,
      start: true,
      hint: null,
      card: 'practise',
    })
  })

  it('shows no warm-up and no Start after "Just listen today", plays the ladder, and picks the rest card', () => {
    // Act
    const o = offers(run([LISTEN], visit()))

    // Assert
    expect(o).toMatchObject({
      stage: 'listen',
      warmUp: false,
      start: false,
      playMerc: true,
      ladders: ['full', 'smaller'],
      moveDo: true,
      listenLine: true,
      doctor: true,
      card: 'rest',
    })
  })

  it('without Web Audio, listens only, with no Start, the hint, and the practise card', () => {
    // Act
    const o = offers(run([SING], visit({ webAudio: false })))

    // Assert
    expect(o).toMatchObject({
      stage: 'nomic',
      start: false,
      playMerc: true,
      hint: 'noAudio',
      card: 'practise',
    })
  })

  it('with no microphone, listens only from then on and keeps the practise card', () => {
    // Act
    const v = run([begin('full'), NOMIC], briefed())

    // Assert
    expect(v.takes).toEqual([])
    expect(offers(v)).toMatchObject({
      stage: 'nomic',
      start: false,
      playMerc: true,
      hint: null,
      card: 'practise',
    })
  })

  it.each([
    [-1, -MOVE_MAX],
    [1, MOVE_MAX],
  ])('moves do by %i a tap, four semitones at most', (step, end) => {
    // Act
    const v = run(Array<LadderEvent>(6).fill({ type: 'move', step }), briefed())

    // Assert
    expect(v.shift).toBe(end)
  })

  it('changes neither the ladder, do nor the voice during a take', () => {
    // Arrange
    const taking = run([begin('full')], briefed())

    // Act
    const after = run(
      [
        { type: 'ladder', ladder: 'smaller' },
        { type: 'move', step: 1 },
        HIGHER,
      ],
      taking,
    )

    // Assert
    expect(after).toBe(taking)
    expect(offers(taking)).toMatchObject({
      stage: 'take',
      ladders: [],
      moveDo: false,
    })
  })
})

describe("the flow's lines", () => {
  const PACKAGE = 'docs/plans/find-your-pitch/lessons/09-landing-a-leap'
  const flat = (file: string): string =>
    readFileSync(resolve(process.cwd(), PACKAGE, file), 'utf8').replace(
      /\s+/g,
      ' ',
    )
  const LINES = [...Object.values(LADDER_LINES), ...Object.values(AGAIN_NAMES)]

  it("are LESSON.md's and the WEB-SPEC's, word for word", () => {
    // Arrange
    const source = `${flat('LESSON.md')} ${flat('WEB-SPEC.md')}`

    // Act
    const missing = LINES.filter((line) => !source.includes(line))

    // Assert
    expect(missing).toEqual([])
  })

  it.each([
    ['soundOff', 'Start'],
    ['soundOffStartAgain', 'Start again'],
    ['soundOffAgain', 'Again'],
  ] as const)(
    'give the hint %s the button it sits beside, %s',
    (hint, button) => {
      // Act
      const line = LADDER_LINES[hint]

      // Assert
      expect(line.endsWith(`then press ${button}.`)).toBe(true)
    },
  )

  it("keep the no-voice line's first sentence after the last take, and drop its cue", () => {
    // Act
    const cue = LADDER_LINES.noVoice.slice(LADDER_LINES.noVoiceLast.length)

    // Assert
    expect(LADDER_LINES.noVoice.startsWith(LADDER_LINES.noVoiceLast)).toBe(true)
    expect(cue).toBe(' Start on do when its band lights.')
  })

  it.each(LINES)(
    'pass the claims check, and describe the singing and the task, never the voice: %s',
    (line) => {
      // Act
      const result = validateGuidedDynamicClaim({
        surface: 'finding',
        text: line,
      })

      // Assert
      expect(result.violations).toEqual([])
      expect(line).not.toMatch(
        /\b(in tune|on pitch|sharp|flat|great|perfect)\b/i,
      )
    },
  )
})
