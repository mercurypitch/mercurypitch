// ============================================================
// Lesson 10 Sing it tests — the comfort check, the voice and Merc's notes
// ============================================================
//
// WEB-SPEC, Toys 6 states 1 to 5 and Tests 8's page half, on the page's own
// markup, each visit loaded afresh (sing.test-fixtures.ts), its runs the
// kit's recorder: the comfort check first on every visit and never stored;
// with no voice stored, the choice after either answer under its first
// line and nothing played until one is chosen; a stored voice pressed under
// its second line, and the other taking over from the next play; the
// keyboard's place on text after each answer; "Just listen today" with its
// doctor lines and Play Merc's notes alone, the Wrap resting; Merc's notes
// from E3 or E4 in Merc's "ooh", 10.0 s, with the singing Merc in the ring;
// Start the guide waiting until they have been heard with sound on, under
// the hint or the sound-off hint; notes cut short by a press, another
// sound or every sound stopping, never heard, the ring resting with them;
// Move do's reach and its ends; and every state showing exactly what the
// flow offers.

import { afterEach, describe, expect, it, vi } from 'vitest'
import { MOVE_MAX } from '@/features/lessons/kit/move-do'
import { hz } from '@/features/lessons/kit/notes'
import type * as RunModule from '@/features/lessons/kit/run'
import { SING_LINES } from './lines'
import type { Step, Visit } from './sing.test-fixtures'
import { choose, closeSing, comfortStep, heardStep, hearMerc, lastRun, loadSing, offered, onCard, PANELS, shows, status, voiceStep, } from './sing.test-fixtures'
import { HINT, nextState, openState, STATUS } from './sing-flow'
import { readoutHtml, SING_SEC, singNotes } from './sing-guide'
import { lengthOf } from './sounds'

vi.mock('@/features/lessons/kit/run', async (actual) => {
  const recorder =
    await import('@/features/lessons/kit/run-recorder.test-fixtures')
  return {
    ...(await actual<typeof RunModule>()),
    ...recorder.recordedRuns,
    recorder,
  }
})

const storedKeys = (): (string | null)[] =>
  Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i))

const lit = (p: Visit, selector: string): boolean =>
  p.el(selector).classList.contains('is-on')

afterEach(closeSing)

describe("Lesson 10's Sing it: the comfort check and the voice", () => {
  it.each([
    ['with no voice stored', null],
    ['with a voice stored', 'lower'],
  ] as const)(
    'asks the comfort check first again on the next visit, %s, and stores neither answer',
    async (_, voice) => {
      // Arrange: a first visit, its comfort check answered
      const first = await loadSing({ voice })
      choose(first, 'listen')
      const kept = storedKeys()

      // Act: the next visit
      const p = await loadSing({ again: true })

      // Assert
      expect(kept).toEqual(voice === null ? [] : ['fyp-voice'])
      expect(PANELS.filter((id) => onCard(p, `[data-panel="${id}"]`))).toEqual([
        'comfort',
      ])
      expect(status(p)).toBe(STATUS.comfort)
      expect(p.el('#singStatus').getAttribute('role')).toBe('status')
    },
  )

  it.each([
    ['sing', STATUS.voiceSing],
    ['listen', STATUS.voiceListen],
  ] as const)(
    'with no voice stored, shows the choice after "%s" under its first line, neither pressed, and plays nothing until one is chosen',
    async (comfort, line) => {
      // Arrange
      const p = await loadSing()

      // Act: the answer, then Merc's notes pressed before any voice
      choose(p, comfort)
      p.el('[data-notes-play]').click()

      // Assert
      expect(onCard(p, '[data-panel="voice"]')).toBe(true)
      expect(onCard(p, '[data-voice-line="none"]')).toBe(true)
      expect(onCard(p, '[data-voice-line="stored"]')).toBe(false)
      expect(
        Array.from(document.querySelectorAll('[data-voice]'), (b) =>
          b.getAttribute('aria-pressed'),
        ),
      ).toEqual(['false', 'false'])
      expect(onCard(p, '[data-panel="notes"]')).toBe(false)
      expect(p.runs).toEqual([])
      expect(status(p)).toBe(line)
    },
  )

  it('shows a stored voice pressed under its second line, and a tap on the other sings in that voice from the next play', async () => {
    // Arrange
    const p = await loadSing({ voice: 'lower' })
    choose(p, 'sing')
    const before = p.el('[data-voice="lower"]').getAttribute('aria-pressed')

    // Act
    p.el('[data-voice="higher"]').click()
    p.el('[data-notes-play]').click()

    // Assert
    expect(before).toBe('true')
    expect(onCard(p, '[data-voice-line="stored"]')).toBe(true)
    expect(onCard(p, '[data-voice-line="none"]')).toBe(false)
    expect(p.el('[data-voice="higher"]').getAttribute('aria-pressed')).toBe(
      'true',
    )
    expect(p.el('[data-voice="lower"]').getAttribute('aria-pressed')).toBe(
      'false',
    )
    expect(localStorage.getItem('fyp-voice')).toBe(JSON.stringify('higher'))
    expect(lastRun(p).notes).toEqual(singNotes(64))
    expect(p.el('[data-do-readout]').innerHTML).toBe(readoutHtml('higher', 0))
  })

  it.each([
    ['sing', null, '[data-voice-line="none"]'],
    ['sing', 'lower', '[data-voice-line="stored"]'],
    ['listen', null, '.listen-line'],
    ['listen', 'higher', '.listen-line'],
  ] as const)(
    'moves the keyboard to the first shown line after "%s" with %s stored, never to a button',
    async (comfort, voice, line) => {
      // Arrange
      const p = await loadSing({ voice })
      p.el(`[data-comfort="${comfort}"]`).focus()

      // Act
      choose(p, comfort)

      // Assert
      expect(document.activeElement).toBe(p.el(line))
      expect(document.activeElement?.tagName).toBe('P')
    },
  )
})

describe("Lesson 10's Sing it: just listen today", () => {
  it("shows its line, the doctor lines and Play Merc's notes, nothing that asks for singing, and rests the Wrap", async () => {
    // Arrange
    const p = await loadSing()

    // Act
    choose(p, 'listen', 'lower')

    // Assert
    expect(onCard(p, '.listen-line')).toBe(true)
    expect(onCard(p, '[data-panel="listen"] .doctor')).toBe(true)
    expect(onCard(p, '[data-notes-play]')).toBe(true)
    for (const part of [
      '[data-guide-start]',
      '.move-do',
      '.turn',
      '.stop-line',
      '.unscored',
      '[data-guide-hint]',
    ])
      expect(onCard(p, part)).toBe(false)
    expect(p.VisitEnding.ending).toBe('rest')
    expect(status(p)).toBe(STATUS.listen)
  })

  it("sings both chords on a tap in the chosen voice, Tavi's still in the ring for the higher", async () => {
    // Arrange
    const p = await loadSing()
    choose(p, 'listen', 'higher')

    // Act
    p.el('[data-notes-play]').click()

    // Assert
    expect(lastRun(p).notes).toEqual(singNotes(64))
    expect(p.el<HTMLImageElement>('.ring-merc').getAttribute('src')).toBe(
      'orange.png',
    )
    expect(lit(p, '[data-notes-play]')).toBe(true)
  })
})

describe("Lesson 10's Sing it: Merc's notes", () => {
  it("sings do-mi-so, then do-me-so, from E3 in Merc's ooh for 10.0 s, Merc's still and do in the ring", async () => {
    // Arrange
    const p = await loadSing()
    choose(p, 'sing', 'lower')

    // Act
    p.el('[data-notes-play]').click()

    // Assert: E3, G sharp 3, B3, then E3, G3, B3
    const run = lastRun(p)
    expect(run.kind).toBe('notes')
    expect(run.notes.map((n) => n.midi)).toEqual([52, 56, 59, 52, 55, 59])
    expect(lengthOf(run.notes)).toBeCloseTo(SING_SEC, 9)
    expect(SING_SEC).toBeCloseTo(10, 9)
    expect(run.o.kind).toBeUndefined()
    expect(run.o.audible).toBe(true)
    expect(p.el<HTMLImageElement>('.ring-merc').getAttribute('src')).toBe(
      'blue.png',
    )
    expect(p.el('.ring-note').textContent).toBe('Do: E3 · 165 Hz')
    expect(p.el('.ring-state').textContent).toBe('Listen')
  })

  it('keeps Start the guide aria-disabled under "Play Merc\'s notes first" until a voice and Merc\'s notes', async () => {
    // Arrange
    const p = await loadSing()

    // Act
    choose(p, 'sing', 'lower')

    // Assert
    expect(onCard(p, '[data-guide-start]')).toBe(true)
    expect(p.el('[data-guide-start]').getAttribute('aria-disabled')).toBe(
      'true',
    )
    expect(onCard(p, '[data-guide-hint]')).toBe(true)
    expect(p.el('[data-guide-hint]').textContent).toBe(SING_LINES.first)
    expect(status(p)).toBe(STATUS.first)
  })

  it("enables Start the guide once Merc's notes have been heard to their end with sound on", async () => {
    // Arrange
    const p = await loadSing()
    choose(p, 'sing', 'lower')

    // Act
    await hearMerc(p)

    // Assert
    expect(p.el('[data-guide-start]').getAttribute('aria-disabled')).toBe(
      'false',
    )
    expect(onCard(p, '[data-guide-hint]')).toBe(false)
    expect(status(p)).toBe(STATUS.ready)
    expect(lit(p, '[data-notes-play]')).toBe(false)
  })

  it('plays the notes silently with sound off, and keeps Start the guide waiting under the sound-off hint', async () => {
    // Arrange
    const p = await loadSing()
    vi.mocked(p.Sound.canPlay).mockReturnValue(false)
    choose(p, 'sing', 'lower')

    // Act
    const run = await hearMerc(p)

    // Assert
    expect(run.o.audible).toBe(false)
    expect(p.el('[data-guide-start]').getAttribute('aria-disabled')).toBe(
      'true',
    )
    expect(p.el('[data-guide-hint]').textContent).toBe(SING_LINES.silent)
    expect(HINT.silent).toBe(SING_LINES.silent)
    expect(status(p)).toBe(STATUS.first)
  })

  it.each([
    ['a press of Move do', (p: Visit) => p.el('[data-move-do="1"]').click()],
    ['a change of voice', (p: Visit) => p.el('[data-voice="higher"]').click()],
    [
      'another sound on the page',
      (p: Visit) => p.NowPlaying.claim(() => undefined),
    ],
    // the kit's run ends unheard when every sound stops: the Sound switch, a hidden page
    ['every sound stopping', (p: Visit) => lastRun(p).end(false)],
  ])(
    "stops Merc's notes at %s, the ring resting with them, and they have not been heard",
    async (_, cut) => {
      // Arrange
      const p = await loadSing()
      choose(p, 'sing', 'lower')
      p.el('[data-notes-play]').click()
      const run = lastRun(p)

      // Act
      cut(p)
      await p.settle()

      // Assert
      expect(run.stopped).toBe(true)
      expect(lit(p, '[data-notes-play]')).toBe(false)
      expect(p.el('.ring-state').textContent).toBe('Rest')
      expect(p.el('[data-guide-start]').getAttribute('aria-disabled')).toBe(
        'true',
      )
      expect(status(p)).toBe(STATUS.first)
    },
  )
})

describe("Lesson 10's Sing it: Move do", () => {
  it.each([
    ['higher', '1', MOVE_MAX, 56, 'do is A<span aria-hidden="true">♭</span>'],
    ['lower', '-1', -MOVE_MAX, 48, 'do is C3'],
  ] as const)(
    "moves do %s a semitone a press up to four, Merc's notes, the readout and the ring's do with it, and no further",
    async (_, step, shift, lowest, readout) => {
      // Arrange
      const p = await loadSing()
      choose(p, 'sing', 'lower')
      const button = p.el(`[data-move-do="${step}"]`)
      const other = p.el(`[data-move-do="${-Number(step)}"]`)

      // Act: four presses, then one more at the end, then Merc's notes
      for (let k = 0; k <= MOVE_MAX; k++) button.click()
      p.el('[data-notes-play]').click()

      // Assert
      expect(p.el('[data-do-readout]').innerHTML).toBe(
        readoutHtml('lower', shift),
      )
      expect(p.el('[data-do-readout]').innerHTML.startsWith(readout)).toBe(true)
      expect(lastRun(p).notes).toEqual(singNotes(52 + shift))
      expect(lastRun(p).notes[0].midi).toBe(lowest)
      expect(button.getAttribute('aria-disabled')).toBe('true')
      expect(other.getAttribute('aria-disabled')).toBe('false')
      expect(p.el('.ring-note').innerHTML).toContain(
        `${Math.round(hz(lowest))} Hz`,
      )
    },
  )

  it('comes back a semitone at the first press the other way, however often its end was pressed', async () => {
    // Arrange: do four higher, then higher pressed three times more at the end
    const p = await loadSing()
    choose(p, 'sing', 'lower')
    const higher = p.el('[data-move-do="1"]')
    for (let k = 0; k < MOVE_MAX + 3; k++) higher.click()

    // Act
    p.el('[data-move-do="-1"]').click()

    // Assert: G3, a semitone under A flat 3
    expect(p.el('[data-do-readout]').innerHTML).toBe(
      readoutHtml('lower', MOVE_MAX - 1),
    )
    expect(p.el('[data-do-readout]').textContent).toBe('do is G3')
    expect(higher.getAttribute('aria-disabled')).toBe('false')
  })

  it("leaves Merc's notes playing, do where it is and the keyboard on the button at a press at its end", async () => {
    // Arrange: do four higher, Merc's notes playing, the keyboard on higher
    const p = await loadSing()
    choose(p, 'sing', 'lower')
    const higher = p.el<HTMLButtonElement>('[data-move-do="1"]')
    for (let k = 0; k < MOVE_MAX; k++) higher.click()
    p.el('[data-notes-play]').click()
    const run = lastRun(p)
    higher.focus()

    // Act
    higher.click()
    await p.settle()

    // Assert
    expect(run.stopped).toBe(false)
    expect(lit(p, '[data-notes-play]')).toBe(true)
    expect(p.el('[data-do-readout]').innerHTML).toBe(
      readoutHtml('lower', MOVE_MAX),
    )
    expect(document.activeElement).toBe(higher)
    expect(higher.disabled).toBe(false)
  })
})

describe("Lesson 10's Sing it: its live lines", () => {
  /** Watches a line from now on; the words of every write it has had, when asked. */
  function watchWrites(target: HTMLElement): () => string[] {
    const records: MutationRecord[] = []
    const watch = new MutationObserver((found) => records.push(...found))
    watch.observe(target, {
      childList: true,
      characterData: true,
      subtree: true,
    })
    return () =>
      [...records, ...watch.takeRecords()].flatMap((r) =>
        Array.from(r.addedNodes, (n) => n.textContent ?? ''),
      )
  }

  it("writes the status line and the do line only when their words change, however often Merc's notes play", async () => {
    // Arrange: both lines watched once the voice is chosen
    const p = await loadSing()
    choose(p, 'sing', 'lower')
    const doLine = watchWrites(p.el('[data-do-readout]'))
    const line = watchWrites(p.el('#singStatus'))

    // Act: the chosen voice pressed again, then Merc's notes heard twice
    p.el('[data-voice="lower"]').click()
    await hearMerc(p)
    await hearMerc(p)

    // Assert
    expect(doLine()).toEqual([])
    expect(line()).toEqual([STATUS.ready])
  })
})

describe("Lesson 10's Sing it: every state", () => {
  it.each([
    ['the opening, with no voice', null, []],
    ['the opening, with a voice stored', 'higher', []],
    ['"I\'m comfortable", no voice yet', null, [comfortStep('sing')]],
    ['"Just listen today", no voice yet', null, [comfortStep('listen')]],
    [
      '"Just listen today" and the lower voice',
      null,
      [comfortStep('listen'), voiceStep('lower')],
    ],
    [
      'Merc heard while just listening',
      'lower',
      [comfortStep('listen'), heardStep(true)],
    ],
    ['"I\'m comfortable" and a stored voice', 'lower', [comfortStep('sing')]],
    ['the voice changed', 'lower', [comfortStep('sing'), voiceStep('higher')]],
    [
      "Merc's notes heard",
      null,
      [comfortStep('sing'), voiceStep('lower'), heardStep(true)],
    ],
    [
      "Merc's notes played with sound off",
      null,
      [comfortStep('sing'), voiceStep('higher'), heardStep(false)],
    ],
    [
      'played with sound off after hearing them',
      'lower',
      [comfortStep('sing'), heardStep(true), heardStep(false)],
    ],
  ] as const)(
    'shows exactly what the flow offers, and its line, for %s',
    async (_, stored, steps: readonly Step[]) => {
      // Arrange
      const p = await loadSing({ voice: stored })
      let s = openState(stored)

      // Act
      for (const step of steps) {
        await step.act(p)
        s = nextState(s, step.e)
      }

      // Assert
      expect(shows(p)).toEqual(offered(s))
    },
  )
})
