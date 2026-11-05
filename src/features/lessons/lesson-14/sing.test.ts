// ============================================================
// Lesson 14 Sing it — the card on the page's own markup
// ============================================================
//
// WEB-SPEC, Toys 4, with the take (sing-take.ts), the microphone's holder
// and the recorder doubled: the comfort check, listening only, the sound
// off, take 1 and take 2 with their lines and feelings, the playback with
// its own Plays and a seek bar that never starts the sound, Delete,
// "Uncomfortable", no microphone, and leaving during a take. Only Start
// asks for the microphone.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import { VisitEnding } from '@/features/lessons/kit/comfort'
import type * as RunModule from '@/features/lessons/kit/run'
import { resetRuns, runs, } from '@/features/lessons/kit/run-recorder.test-fixtures'
import { Sound } from '@/features/lessons/kit/sound'
import { VoiceChoice } from '@/features/lessons/kit/voice-choice'
import { el, loadPage, settle, soundOn } from './page-dom.test-fixtures'
import { CLOSING, STATUS } from './phrase-flow'
import { initSing, WARMUP_KEY } from './sing'
import type { TakeContext, TakeEnd } from './sing-take'

vi.mock('@/features/lessons/kit/run', async (actual) => ({
  ...(await actual<typeof RunModule>()),
  ...(await import('@/features/lessons/kit/run-recorder.test-fixtures'))
    .recordedRuns,
}))

const mic = vi.hoisted(() => ({ open: vi.fn(), release: vi.fn(), ok: true }))
vi.mock('@/features/lessons/kit/mic-hold', () => ({
  MicHold: class {
    mod: unknown = null
    listener: unknown = null
    async open(): Promise<boolean> {
      mic.open()
      if (!mic.ok) return false
      this.mod = {}
      this.listener = { media: {} }
      return true
    }
    release(now?: boolean): void {
      mic.release(now)
    }
  },
}))

const takes = vi.hoisted(() => ({
  calls: [] as TakeContext[],
  ends: [] as ((c: TakeContext) => Promise<TakeEnd>)[],
}))
vi.mock('./sing-take', () => ({
  takePhrase: (c: TakeContext) => {
    takes.calls.push(c)
    c.onListen()
    const next = takes.ends.shift()
    return next === undefined ? Promise.resolve({ kind: 'left' }) : next(c)
  },
}))

const playback = vi.hoisted(() => ({ played: [] as number[] }))
vi.mock('@/features/lessons/kit/record', () => ({
  canRecord: () => true,
  startOf: (t: { voicedAt: number }) => Math.max(0, t.voicedAt - 0.2),
  playTake: (
    _t: unknown,
    _c: unknown,
    owner: { claim(f: () => void): void },
    from: number,
  ) => {
    playback.played.push(from)
    let end: (heard: boolean) => void = () => undefined
    const stop = (): void => end(false)
    owner.claim(stop)
    return {
      done: new Promise<boolean>((r) => {
        end = r
      }),
      position: () => from,
      stop,
    }
  },
}))

/** A take that heard the phrase from D3 to B3, its recording kept. */
const heardTake =
  (take: 1 | 2): ((c: TakeContext) => Promise<TakeEnd>) =>
  () =>
    Promise.resolve({
      kind: 'read',
      reading: {
        heard: true,
        low: 50,
        high: 59,
        line: `Take ${String(take)}, drawn over Merc's bands: your line ran from about D3 to B3.`,
        spoken: '',
        octaveLine: null,
      },
      trace: [
        { t: 0, c: 5000 },
        { t: 1, c: 5700 },
      ],
      kept: { buffer: {} as AudioBuffer, gain: 1, voicedAt: 1, length: 6 },
    })

const visible = (selector: string): boolean => {
  const found = document.querySelector<HTMLElement>(selector)
  return found !== null && found.closest('[hidden]') === null
}
const status = (): string => el('#singStatus').textContent ?? ''
/** Presses `selector` and lets what it began finish: a dynamic import takes a task or two. */
const press = async (selector: string): Promise<void> => {
  el<HTMLButtonElement>(selector).click()
  for (let i = 0; i < 3; i++) {
    await settle()
    await new Promise((r) => setTimeout(r, 0))
  }
}

beforeEach(() => {
  localStorage.clear()
  resetRuns()
  mic.open.mockReset()
  mic.release.mockReset()
  mic.ok = true
  takes.calls = []
  takes.ends = []
  playback.played = []
  Object.assign(window, { AudioContext: function AudioContext() {} })
  vi.spyOn(Sound, 'context').mockReturnValue({} as AudioContext)
  VoiceChoice.set('lower')
  VisitEnding.set('practise')
  loadPage()
})

afterEach(() => {
  vi.restoreAllMocks()
  Reflect.deleteProperty(window, 'AudioContext')
  document.body.textContent = ''
})

describe("Lesson 14's Sing it", () => {
  it('asks how the voice is first, then offers the warm-up, the briefing and Start take 1, asking for no microphone', async () => {
    // Arrange
    soundOn()
    initSing()
    const first = [
      visible('[data-panel="comfort"]'),
      visible('[data-sing="start"]'),
    ]

    // Act
    await press('[data-comfort="sing"]')

    // Assert
    expect(first).toEqual([true, false])
    expect(visible('[data-sing="start"]')).toBe(true)
    expect(el<HTMLDetailsElement>('#warmup').open).toBe(true)
    expect(status()).toBe(STATUS.turn)
    expect(mic.open).not.toHaveBeenCalled()
  })

  it('keeps the warm-up closed once skipped, and stores only the Skip', async () => {
    // Arrange
    localStorage.setItem(WARMUP_KEY, 'true')
    soundOn()
    initSing()

    // Act
    await press('[data-comfort="sing"]')

    // Assert
    expect(el<HTMLDetailsElement>('#warmup').open).toBe(false)
  })

  it('listens only today: Merc sings take 2 on a tap, nothing listens, and the Wrap rests', async () => {
    // Arrange
    soundOn()
    initSing()

    // Act
    await press('[data-comfort="listen"]')
    await press('[data-merc-phrase]')

    // Assert
    expect(visible('[data-listen-why="listen"]')).toBe(true)
    expect(visible('[data-sing="start"]')).toBe(false)
    expect(visible('#warmup')).toBe(false)
    expect(runs.map((r) => r.kind)).toEqual(['lines'])
    expect(VisitEnding.ending).toBe('rest')
    expect(mic.open).not.toHaveBeenCalled()
  })

  it('with the sound off asks for nothing and says why beside Start', async () => {
    // Arrange
    vi.spyOn(Sound, 'state', 'get').mockReturnValue('off')
    initSing()
    await press('[data-comfort="sing"]')

    // Act
    await press('[data-sing="start"]')

    // Assert
    expect(mic.open).not.toHaveBeenCalled()
    expect(el('[data-start-hint]').textContent).toBe(
      "Sound is off, so nothing played. Turn sound on to hear Merc's phrase, then press Start.",
    )
  })

  it('turns the sound on with Start when nothing has set the switch yet, as any first play does', async () => {
    // Arrange: nothing on the page has played since it loaded
    vi.spyOn(Sound, 'state', 'get').mockReturnValue('unset')
    const canPlay = vi.spyOn(Sound, 'canPlay').mockReturnValue(true)
    initSing()
    await press('[data-comfort="sing"]')

    // Act
    await press('[data-sing="start"]')

    // Assert
    expect(canPlay).toHaveBeenCalledTimes(1)
    expect(takes.calls).toHaveLength(1)
  })

  it('sings take 1 after Merc, draws its line and asks how it felt; take 2 follows Easy, with its count-in alone', async () => {
    // Arrange
    soundOn()
    const card = initSing()
    await press('[data-comfort="sing"]')
    takes.ends.push(heardTake(1), heardTake(2))

    // Act
    await press('[data-sing="start"]')
    const line = el('[data-take-line]').textContent
    const asked = [visible('[data-panel="feel"]'), status()]
    await press('[data-feel="easy"]')
    const next = [
      visible('[data-closing="next"]'),
      visible('[data-sing="take2"]'),
    ]
    await press('[data-sing="take2"]')

    // Assert
    expect(mic.open).toHaveBeenCalledTimes(2)
    expect(takes.calls.map((c) => [c.id, c.mercFirst])).toEqual([
      [1, true],
      [2, false],
    ])
    expect(line).toBe(
      "Take 1, drawn over Merc's bands: your line ran from about D3 to B3.",
    )
    expect(asked).toEqual([true, STATUS.feel])
    expect(next).toEqual([true, true])
    const traces = card.line.chart.scene.song?.traces ?? []
    expect(traces.map((t) => [t.name, t.faint])).toEqual([
      ['take 1', true],
      ['take 2', false],
    ])
    expect(card.line.summary).toBe(
      "Your take 2, drawn as a line over Merc's bands, from about D3 to B3. Gaps in the line are where we heard no voice.",
    )
  })

  it('plays each take back from its own Play, from 0.2 s before its voice, and the seek bar never starts the sound', async () => {
    // Arrange
    soundOn()
    initSing()
    await press('[data-comfort="sing"]')
    takes.ends.push(heardTake(1), heardTake(2))
    await press('[data-sing="start"]')
    await press('[data-feel="easy"]')
    await press('[data-sing="take2"]')
    await press('[data-feel="workable"]')

    // Act
    const seek = el<HTMLInputElement>('[data-take-seek]')
    seek.value = '3'
    seek.dispatchEvent(new Event('input'))
    const seeked = playback.played.length
    await press('[data-take-play="1"]')
    const word = el('[data-take-play="1"] [data-play-word]').textContent

    // Assert
    expect(status()).toBe(CLOSING.back)
    expect(visible('[data-take-play="2"]')).toBe(true)
    expect(seeked).toBe(0)
    expect(playback.played).toEqual([0.8])
    expect(word).toBe('Stop')
    expect(seek.getAttribute('aria-valuetext')).toMatch(/^0\.8 seconds of 6\.0/)
  })

  it('deletes both takes, their lines and their playback', async () => {
    // Arrange
    soundOn()
    const card = initSing()
    await press('[data-comfort="sing"]')
    takes.ends.push(heardTake(1), heardTake(2))
    await press('[data-sing="start"]')
    await press('[data-feel="easy"]')
    await press('[data-sing="take2"]')
    await press('[data-feel="easy"]')

    // Act
    await press('[data-sing="delete"]')

    // Assert
    expect(visible('[data-playback]')).toBe(false)
    expect(visible('[data-take-line]')).toBe(false)
    expect(card.line.chart.scene.song?.traces).toEqual([])
    expect(status()).toBe(STATUS.deleted)
  })

  it('after Uncomfortable takes the line away, shows the doctor lines and rests the Wrap', async () => {
    // Arrange
    soundOn()
    initSing()
    await press('[data-comfort="sing"]')
    takes.ends.push(heardTake(1))
    await press('[data-sing="start"]')

    // Act
    await press('[data-feel="uncomfortable"]')

    // Assert
    expect(visible('[data-take-line]')).toBe(false)
    expect(visible('[data-after-doctor]')).toBe(true)
    expect(visible('[data-sing="retry"]')).toBe(false)
    expect(VisitEnding.ending).toBe('rest')
  })

  it('listens only with no microphone, and keeps the practice card', async () => {
    // Arrange
    soundOn()
    mic.ok = false
    initSing()
    await press('[data-comfort="sing"]')

    // Act
    await press('[data-sing="start"]')

    // Assert
    expect(visible('[data-listen-why="nomic"]')).toBe(true)
    expect(visible('[data-sing="start"]')).toBe(false)
    expect(VisitEnding.ending).toBe('practise')
  })

  it('abandons a take when the page is hidden, and lets the microphone go at once', async () => {
    // Arrange
    soundOn()
    initSing()
    await press('[data-comfort="sing"]')
    let cancelled: boolean | null = null
    takes.ends.push(
      (c) =>
        new Promise((resolve) => {
          document.addEventListener('visibilitychange', () => {
            cancelled = c.cancelled()
            resolve({ kind: 'left' })
          })
        }),
    )
    await press('[data-sing="start"]')

    // Act
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(true)
    document.dispatchEvent(new Event('visibilitychange'))
    await settle()
    await new Promise((r) => setTimeout(r, 0))

    // Assert
    expect(cancelled).toBe(true)
    expect(mic.release).toHaveBeenCalledWith(true)
    expect(status()).toBe(STATUS.left)
    expect(visible('[data-sing="retry"]')).toBe(true)
  })
})
