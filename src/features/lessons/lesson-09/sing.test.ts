// ============================================================
// Lesson 9 Sing it tests — the card without the microphone, on the page's markup
// ============================================================
//
// WEB-SPEC, Tests 7, the parts the pure flow cannot show, and Tests 3's
// button clause: every state draws exactly the controls the flow offers,
// and none it withholds (no Start or warm-up while listening, no warm-up
// with no Web Audio); the voice choice comes first when none is stored,
// and a stored one starts pressed under its own line; "Just listen today"
// shows its line and the doctor lines at once, beside the voice choice,
// and picks the rest card; Play Merc's ladder sings the pressed ladder in
// the chosen voice from do as Move do left it, each rung lighting as he
// sings it, and gives way to any other sound on the page; without Web
// Audio it lights the rungs in silence beside "This browser can't play
// sound here."; with the sound off Start asks for nothing and its hint
// names it, while a switch still unset counts as on; Move do's end buttons
// are `aria-disabled` at four steps each way, never `disabled`, and a press
// there neither moves do nor stops Merc's ladder; and nothing is stored but
// `fyp-voice` and `fyp-l09-warmup`. The page's modules load afresh for each
// test, since the voice choice reads storage as it loads; its runs are the
// kit's recorders, and Merc and Tavi's renderer is left out.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import type * as MercDuo from '@/features/lessons/kit/merc-duo'
import type * as RunModule from '@/features/lessons/kit/run'
import type * as Recorder from '@/features/lessons/kit/run-recorder.test-fixtures'
import { mercLadderNotes } from './sounds'

const duo = vi.hoisted(() => ({ sing: vi.fn() }))
const mic = vi.hoisted(() => ({ asks: 0, loaded: 0 }))

// the recorder rides on the swapped module, so a test reads the very runs
// the page's modules, loaded afresh, started
vi.mock('@/features/lessons/kit/run', async (actual) => {
  const recorder =
    await import('@/features/lessons/kit/run-recorder.test-fixtures')
  return {
    ...(await actual<typeof RunModule>()),
    ...recorder.recordedRuns,
    recorder,
  }
})

vi.mock('@/features/lessons/kit/merc-duo', async (actual) => ({
  ...(await actual<typeof MercDuo>()),
  mercSing: duo.sing,
}))

// the listener's chunk, counted: nothing on this card may load it
vi.mock('@/features/lessons/kit/listen', async (actual) => {
  mic.loaded += 1
  return await actual()
})

/** The browser's own Web Audio, as the test setup gives it. */
const REAL_AUDIO = window.AudioContext

/** Whether the test's browser has Web Audio: the page only asks whether it is there. */
function webAudio(on: boolean): void {
  const w = window as unknown as Record<string, unknown>
  if (on) w.AudioContext = REAL_AUDIO
  else delete w.AudioContext
}

/** The page's modules, loaded afresh, its body loaded and Sing it mounted. */
async function load() {
  vi.resetModules()
  const dom = await import('./page-dom.test-fixtures')
  const sing = await import('./sing')
  const flow = await import('./ladder-flow')
  const comfort = await import('@/features/lessons/kit/comfort')
  const sound = await import('@/features/lessons/kit/sound')
  const owner = await import('@/features/lessons/kit/now-playing')
  const { recorder } =
    (await import('@/features/lessons/kit/run')) as unknown as {
      readonly recorder: typeof Recorder
    }
  recorder.resetRuns()
  dom.loadPage()
  const card = sing.initSing()
  return {
    ...dom,
    ...sing,
    ...flow,
    ...comfort,
    ...sound,
    ...owner,
    runs: recorder.runs,
    card,
  }
}

type Page = Awaited<ReturnType<typeof load>>

/** Shown on the card: neither it nor any box around it hidden. */
function onCard(p: Page, selector: string): boolean {
  for (let el: HTMLElement | null = p.el(selector); el; el = el.parentElement)
    if (el.hidden) return false
  return true
}

const status = (p: Page): string => p.el('#singStatus').textContent ?? ''
const summary = (p: Page): string | null =>
  p.el('#singChart canvas').getAttribute('aria-label')

/** What the card draws, named as the flow's offers name it. */
function drawn(p: Page) {
  return {
    voiceChoice: onCard(p, '[data-panel="voice"] .voice-choice'),
    listenLine: onCard(p, '.listen-line[data-listen-why="listen"]'),
    warmUp: onCard(p, '#warmup'),
    ladders: p.LADDER_ORDER.filter((id) => onCard(p, `[data-ladder="${id}"]`)),
    pressed: p.el('[data-ladder][aria-pressed="true"]').dataset.ladder,
    moveDo: onCard(p, '.move-do'),
    playMerc: onCard(p, '[data-merc-ladder]'),
    start: onCard(p, '[data-sing="start"]'),
  }
}

/** The same controls, as the flow offers them for the visit as it stands. */
function offered(p: Page) {
  const o = p.offers(p.card.visit)
  return {
    voiceChoice: o.voiceChoice,
    listenLine: o.listenLine,
    warmUp: o.warmUp,
    ladders: [...o.ladders],
    pressed: o.pressed,
    moveDo: o.moveDo,
    playMerc: o.playMerc,
    start: o.start,
  }
}

/** Every key in storage. */
const keys = (): string[] =>
  Array.from(
    { length: localStorage.length },
    (_, i) => localStorage.key(i) ?? '',
  )

/** The comfort answered, then the voice if none is stored. */
function toCard(p: Page, comfort: 'sing' | 'listen', voice = 'lower'): void {
  p.el(`[data-comfort="${comfort}"]`).click()
  if (p.card.visit.voice === null)
    p.el(`[data-panel="voice"] [data-voice="${voice}"]`).click()
}

beforeEach(() => {
  localStorage.clear()
  webAudio(true)
  mic.asks = 0
  mic.loaded = 0
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: {
      getUserMedia: () => {
        mic.asks += 1
        return Promise.reject(new Error('the card asks for no microphone'))
      },
    },
  })
})

afterEach(() => {
  vi.restoreAllMocks()
  duo.sing.mockReset()
  webAudio(true)
  document.body.textContent = ''
  localStorage.clear()
})

describe("Lesson 9's Sing it: each state's controls", () => {
  it('opens on the comfort check alone, asking how the voice is today', async () => {
    // Act
    const p = await load()

    // Assert
    const open = Array.from(
      document.querySelectorAll<HTMLElement>('#singCard [data-panel]'),
    )
      .filter((el) => !el.hidden)
      .map((el) => el.dataset.panel)
    expect(open).toEqual(['comfort'])
    expect(p.el('#singLive').hidden).toBe(true)
    expect(status(p)).toBe('Before you sing: how is your voice today?')
  })

  it('asks for the voice before either path when none is stored, then briefs', async () => {
    // Arrange
    const p = await load()

    // Act
    p.el('[data-comfort="sing"]').click()
    const asked = drawn(p)
    const askedOffers = offered(p)
    const askedStatus = status(p)
    p.el('[data-panel="voice"] [data-voice="lower"]').click()

    // Assert
    expect(asked).toEqual(askedOffers)
    expect(askedStatus).toBe(
      'Choose a voice to sing with. If you chose one in an earlier lesson, pick it again:',
    )
    expect([asked.start, asked.warmUp, asked.playMerc]).toEqual([
      false,
      false,
      false,
    ])
    expect(drawn(p)).toEqual(offered(p))
    expect(drawn(p)).toMatchObject({
      warmUp: true,
      ladders: ['full', 'smaller'],
      pressed: 'full',
      start: true,
    })
    expect(onCard(p, '.brief')).toBe(true)
    expect(status(p)).toBe('Your turn: do-mi-so-do, slowly.')
  })

  it('starts a stored voice pressed, changeable, under its own line', async () => {
    // Arrange
    localStorage.setItem('fyp-voice', JSON.stringify('higher'))
    const p = await load()

    // Act
    p.el('[data-comfort="sing"]').click()
    p.el('[data-panel="voice"] [data-voice="lower"]').click()

    // Assert
    expect(onCard(p, '[data-voice-line="stored"]')).toBe(true)
    expect(onCard(p, '[data-voice-line="none"]')).toBe(false)
    expect(p.el('[data-voice="lower"]').getAttribute('aria-pressed')).toBe(
      'true',
    )
    expect(p.card.chart.doMidi).toBe(50)
    expect(drawn(p)).toEqual(offered(p))
  })

  it('listens only after "Just listen today": its line and the doctor lines at once, no Start, no warm-up, Merc\'s ladder with no microphone, the rest card', async () => {
    // Arrange
    const p = await load()

    // Act
    p.el('[data-comfort="listen"]').click()
    const beforeOffers = offered(p)
    const beforeStatus = status(p)
    const before = {
      ...drawn(p),
      doctor: onCard(p, '.doctor[data-listen-why="listen"]'),
      line: onCard(p, '[data-voice-line="listen"]'),
    }
    p.el('[data-panel="voice"] [data-voice="lower"]').click()
    p.soundOn()
    p.el('[data-merc-ladder]').click()

    // Assert
    expect(before).toMatchObject(beforeOffers)
    expect(beforeStatus).toBe('Choose a voice: it picks the Merc who sings.')
    expect(before).toMatchObject({
      listenLine: true,
      doctor: true,
      voiceChoice: true,
      line: true,
      start: false,
    })
    // the markup carries the flow's line
    expect(
      (p.el('[data-voice-line="listen"]').textContent ?? '')
        .replace(/\s+/g, ' ')
        .trim(),
    ).toBe(p.LADDER_LINES.voiceListen)
    expect(drawn(p)).toEqual(offered(p))
    expect(drawn(p)).toMatchObject({
      start: false,
      warmUp: false,
      playMerc: true,
    })
    expect(onCard(p, '.brief')).toBe(false)
    expect(status(p)).toBe(
      'Good call. Merc sings the ladder, and nothing listens. Rest your voice.',
    )
    expect(p.VisitEnding.ending).toBe('rest')
    expect(onCard(p, '#practiseCard [data-ending="rest"]')).toBe(true)
    expect(onCard(p, '#practiseCard [data-ending="practise"]')).toBe(false)
    expect(p.runs[0].notes).toEqual(mercLadderNotes('full', 50))
    expect([mic.asks, mic.loaded]).toEqual([0, 0])
  })

  it('keeps the practise card in the Wrap when the viewer chooses to sing', async () => {
    // Arrange
    const p = await load()

    // Act
    toCard(p, 'sing')

    // Assert
    expect(p.VisitEnding.ending).toBe('practise')
    expect(onCard(p, '#practiseCard [data-ending="practise"]')).toBe(true)
  })

  it('listens only, with no Start and no warm-up, in a browser without Web Audio', async () => {
    // Arrange
    webAudio(false)
    const p = await load()

    // Act
    toCard(p, 'sing')

    // Assert
    expect(drawn(p)).toEqual(offered(p))
    expect(drawn(p)).toMatchObject({
      start: false,
      warmUp: false,
      playMerc: true,
    })
    expect(onCard(p, '[data-listen-why="nomic"]')).toBe(true)
    expect(p.el('[data-start-hint]').textContent).toBe(
      "This browser can't play sound here.",
    )
    expect(onCard(p, '[data-start-hint]')).toBe(true)
    expect(status(p)).toBe(
      'No microphone? Sing along anyway: Merc sings the ladder first, and nothing listens.',
    )
    expect(p.VisitEnding.ending).toBe('practise')
  })
})

describe("Lesson 9's Sing it: the chart and Merc's ladder", () => {
  it("shows the pressed ladder's slots, faint, and says where do is", async () => {
    // Arrange
    const p = await load()
    toCard(p, 'sing')

    // Act
    p.el('[data-ladder="smaller"]').click()

    // Assert
    expect(p.el('[data-ladder="smaller"]').getAttribute('aria-pressed')).toBe(
      'true',
    )
    expect(p.card.chart.view.places.map((s) => s.midi)).toEqual([
      50, 54, 57, 54, 50,
    ])
    expect(p.card.chart.view.places.every((s) => s.faint)).toBe(true)
    expect(summary(p)).toBe('Do is D3')
  })

  it.each([
    ['lower', 'full', 0, 50],
    ['higher', 'full', 0, 62],
    ['lower', 'smaller', 0, 50],
    ['lower', 'full', 1, 51],
  ] as const)(
    'sings the pressed ladder in the %s voice (%s ladder, do moved %i), each rung lighting as Merc sings it',
    async (voice, ladder, moves, doMidi) => {
      // Arrange
      const p = await load()
      toCard(p, 'sing', voice)
      p.el(`[data-ladder="${ladder}"]`).click()
      for (let i = 0; i < moves; i++) p.el('[data-move-do="1"]').click()
      p.soundOn()

      // Act
      p.el('[data-merc-ladder]').click()
      const run = p.runs[0]
      run.note(1)

      // Assert
      expect(run.notes).toEqual(mercLadderNotes(ladder, doMidi))
      expect(run.o.audible).toBe(true)
      expect(p.card.chart.chart.scene.rungs?.map((r) => r.glow)).toEqual(
        run.notes.map((_, i) => (i === 1 ? 1 : 0)),
      )
      expect(duo.sing).toHaveBeenLastCalledWith(
        voice === 'lower' ? 'blue' : 'orange',
        doMidi + 4,
        true,
      )
    },
  )

  it("gives way to any other sound on the page: Merc's ladder stops, and his button rests", async () => {
    // Arrange
    const p = await load()
    toCard(p, 'sing')
    p.soundOn()
    p.el('[data-merc-ladder]').click()
    const run = p.runs[0]

    // Act
    p.NowPlaying.claim(() => undefined)

    // Assert
    expect(run.stopped).toBe(true)
    expect(p.el('[data-merc-ladder]').classList.contains('is-on')).toBe(false)
  })

  it('lights the rungs in silence without Web Audio, beside the hint', async () => {
    // Arrange
    webAudio(false)
    const p = await load()
    toCard(p, 'sing')
    vi.spyOn(p.Sound, 'canPlay').mockReturnValue(false)

    // Act
    p.el('[data-merc-ladder]').click()
    p.runs[0].note(0)

    // Assert
    expect(p.runs[0].o.audible).toBe(false)
    expect(p.card.chart.chart.scene.rungs?.[0].glow).toBe(1)
    expect(p.el('[data-start-hint]').textContent).toBe(
      "This browser can't play sound here.",
    )
  })
})

describe("Lesson 9's Sing it: Move do", () => {
  it.each([
    ['-1', 'lower', 'B flat 2', 46],
    ['1', 'higher', 'F sharp 3', 54],
  ] as const)(
    'marks the %s button aria-disabled at four steps, never disabled, and frees it one step back',
    async (step, _, name, doMidi) => {
      // Arrange
      const p = await load()
      toCard(p, 'sing')
      const end = p.el<HTMLButtonElement>(`[data-move-do="${step}"]`)
      const back = p.el<HTMLButtonElement>(`[data-move-do="${-Number(step)}"]`)

      // Act
      for (let i = 0; i < 4; i++) end.click()
      const atEnd = {
        end: end.getAttribute('aria-disabled'),
        back: back.getAttribute('aria-disabled'),
        disabled: [end.disabled, back.disabled],
        summary: summary(p),
        doMidi: p.card.chart.doMidi,
      }
      back.click()

      // Assert
      expect(atEnd).toEqual({
        end: 'true',
        back: 'false',
        disabled: [false, false],
        summary: `Do is ${name}`,
        doMidi,
      })
      expect(end.getAttribute('aria-disabled')).toBe('false')
      expect([end.disabled, back.disabled]).toEqual([false, false])
    },
  )

  it("does nothing at its end: do stays, Merc's ladder plays on and the focus stays on the button", async () => {
    // Arrange
    const p = await load()
    toCard(p, 'sing')
    const lower = p.el<HTMLButtonElement>('[data-move-do="-1"]')
    for (let i = 0; i < 4; i++) lower.click()
    p.soundOn()
    p.el('[data-merc-ladder]').click()
    const run = p.runs[0]
    lower.focus()

    // Act
    lower.click()

    // Assert
    expect(run.stopped).toBe(false)
    expect(p.card.visit.shift).toBe(-4)
    expect(summary(p)).toBe('Do is B flat 2')
    expect(document.activeElement).toBe(lower)
  })

  it("moves do a semitone and stops Merc's ladder, away from its ends", async () => {
    // Arrange
    const p = await load()
    toCard(p, 'sing')
    p.soundOn()
    p.el('[data-merc-ladder]').click()
    const run = p.runs[0]

    // Act
    p.el('[data-move-do="-1"]').click()

    // Assert
    expect(run.stopped).toBe(true)
    expect(summary(p)).toBe('Do is D flat 3')
    expect(p.card.chart.view.window).toEqual([48, 62])
  })
})

describe("Lesson 9's Sing it: the sound off", () => {
  it('asks for no microphone from Start with the sound off, and its hint names Start', async () => {
    // Arrange
    const p = await load()
    toCard(p, 'sing')
    p.Sound.set('off')

    // Act
    p.el('[data-sing="start"]').click()
    await p.settle()

    // Assert
    expect(p.el('[data-start-hint]').textContent).toBe(
      "Sound is off, so nothing played. Turn sound on to hear Merc's ladder, then press Start.",
    )
    expect(onCard(p, '[data-start-hint]')).toBe(true)
    expect(p.card.visit.takes).toEqual([])
    expect(p.card.visit.taking).toBeNull()
    expect([mic.asks, mic.loaded]).toEqual([0, 0])
  })

  it("shows Start's hint after Play Merc's ladder with the sound off, and takes it away once the sound is on", async () => {
    // Arrange
    const p = await load()
    toCard(p, 'sing')
    p.Sound.set('off')
    p.el('[data-merc-ladder]').click()
    const hint = p.el('[data-start-hint]').textContent

    // Act
    p.Sound.set('on')

    // Assert
    expect(hint).toBe(
      "Sound is off, so nothing played. Turn sound on to hear Merc's ladder, then press Start.",
    )
    expect(p.runs[0].o.audible).toBe(false)
    expect(onCard(p, '[data-start-hint]')).toBe(false)
  })

  it('counts a sound switch still unset as on: Start shows no sound-off hint', async () => {
    // Arrange
    const p = await load()
    toCard(p, 'sing')

    // Act
    p.el('[data-sing="start"]').click()
    await p.settle()

    // Assert
    expect(p.Sound.state).toBe('unset')
    expect(p.card.visit.sound).toBe(true)
    expect(p.offers(p.card.visit).hint).toBeNull()
    expect(onCard(p, '[data-start-hint]')).toBe(false)
  })
})

describe("Lesson 9's Sing it: storage", () => {
  it("stores the warm-up's Skip, so a return visit opens it folded", async () => {
    // Arrange
    const first = await load()
    toCard(first, 'sing')
    const opened = first.el<HTMLDetailsElement>('#warmup').open
    first.el('[data-warm="skip"]').click()

    // Act
    const again = await load()
    toCard(again, 'sing')

    // Assert
    expect(opened).toBe(true)
    expect(again.el<HTMLDetailsElement>('#warmup').open).toBe(false)
    expect(localStorage.getItem('fyp-l09-warmup')).toBe('true')
  })

  it("stores nothing but the voice and the warm-up's Skip, whatever the card is asked", async () => {
    // Arrange
    const p = await load()
    p.soundOn()

    // Act: every control the card has without the microphone
    toCard(p, 'sing')
    p.el('[data-warm="sigh"]').click()
    p.el('[data-warm="slide"]').click()
    p.el('[data-warm="skip"]').click()
    p.el('[data-ladder="smaller"]').click()
    p.el('[data-move-do="1"]').click()
    p.el('[data-merc-ladder]').click()
    p.runs.at(-1)?.end(true)
    await p.settle()
    p.el('[data-panel="voice"] [data-voice="higher"]').click()
    p.Sound.set('off')
    p.el('[data-sing="start"]').click()
    await p.settle()

    // Assert
    expect(keys().sort()).toEqual(['fyp-l09-warmup', 'fyp-voice'])
  })
})
