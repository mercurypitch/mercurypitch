// ============================================================
// The sung line, on screen: Merc's call, the singer's turn, the score
// ============================================================
//
// Driven through the stand-in capture and a hand-cranked screen frame
// (onboarding-capture.test-fixtures.ts), with a clock that stands still at
// zero and a voice for Merc that only says when his notes fall: the line
// moves on by the frames each case hands the mic.

import type { JSX } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MercView } from '@/components/room-kit/MercView'
import { CaptureError } from '@/components/room-kit/useExerciseCapture'
import type { CallVoice } from '@/features/echo/merc-call'
import { callTimes } from '@/features/echo/merc-call'
import type * as MicSentinel from '@/lib/mic-sentinel'
import type { PitchFrame } from '@/lib/pitch-f0-stream'
import { RESPONSE_GATE_SECONDS } from '@/lib/sequence/sequence-engine'
import type { RenderedShell } from '../shell/render-for-test'
import { renderShell } from '../shell/render-for-test'
import { lineSaysText, LineView } from './LineView'
import type { Stand } from './onboarding-capture.test-fixtures'
import { flushFrame, settle, stand, stubFrames, } from './onboarding-capture.test-fixtures'
import { ONBOARDING_COPY } from './onboarding-copy'
import type { TimedNote } from './sung-line'
import { LINE_SEC, lineNotes } from './sung-line'
import type { LineController } from './useLine'
import { COUNT_IN_SEC, LATE_FRAMES_SEC, TURN_TAIL_SEC, useLine, } from './useLine'

vi.mock('@/lib/merc/stage', () => ({
  mountMercStage: () => ({
    ok: false,
    setState: () => undefined,
    setVoice: () => undefined,
    setPaused: () => undefined,
    setStill: () => undefined,
    destroy: () => undefined,
  }),
}))

// The app's mic watchdog compares the icon with a real stream, and a
// stand-in has none.
vi.mock('@/lib/mic-sentinel', async (importOriginal) => ({
  ...(await importOriginal<typeof MicSentinel>()),
  registerMicIndicator: () => () => undefined,
}))

const GRANT = 'pitchperfect_sing_mic_granted'
/** Merc's call starts this far in: Echo's lead. */
const LEAD = 0.35

/** A clock that stands at zero, with no output latency. */
const CLOCK = {
  currentTime: 0,
  outputLatency: 0,
  baseLatency: 0,
} as unknown as AudioContext

/** Merc's voice, minus the sound: what was sung, and when it falls. */
const sung: number[][] = []
let stopped = 0
const VOICE: CallVoice = {
  sing: (_ctx, notes, startAt) => {
    sung.push(notes.map((note) => note.midi))
    return {
      ...callTimes(notes, startAt),
      stop: () => {
        stopped += 1
      },
    }
  },
}

let view: RenderedShell | null = null
let controller: LineController | null = null

function show(s: Stand, tonic: () => number = () => 60): void {
  s.capture.audio = async () => Promise.resolve(CLOCK)
  const Harness = (): JSX.Element => {
    const line = useLine({
      capture: s.capture,
      tonic,
      still: () => false,
      voice: VOICE,
      preload: async () => Promise.resolve(null),
    })
    controller = line
    return (
      <LineView
        controller={line}
        line={lineSaysText(line)}
        onContinue={() => undefined}
        continuing={false}
        merc={
          <MercView
            state={line.mercState}
            voice={line.mercVoice}
            testId="onboarding-merc"
          />
        }
      />
    )
  }
  view = renderShell(() => <Harness />)
}

const q = (id: string): HTMLElement | null =>
  view?.container.querySelector(`[data-testid="${id}"]`) ?? null
const line = (): string | null => q('onboarding-line')?.textContent ?? null
const micState = (): string | null =>
  q('onboarding-mic')?.getAttribute('data-state') ?? null
/** The words under the mic: drawn, and hidden from a screen reader. */
const caption = (): string | null =>
  view?.container.querySelector('p[aria-hidden="true"]:not([data-testid])')
    ?.textContent ?? null
const bars = (attribute: string): (string | null)[] =>
  [...(view?.container.querySelectorAll('[data-note]') ?? [])].map((bar) =>
    bar.getAttribute(attribute),
  )

/** When the call ends and the turn's notes fall, from C4. */
const CALL_END = LEAD + LINE_SEC
const TURN = lineNotes(60, CALL_END + RESPONSE_GATE_SECONDS + COUNT_IN_SEC)
const TURN_END = TURN[TURN.length - 1].to + TURN_TAIL_SEC

const hz = (midi: number): number => 440 * 2 ** ((midi - 69) / 12)

/**
 * The mic's frames to `until`, 100 a second: the turn's notes sung, cents
 * off by index (null leaves one unsung); quiet around them.
 */
function take(
  until: number,
  notes: readonly TimedNote[] = TURN,
  off: Readonly<Record<number, number | null>> = {},
): PitchFrame[] {
  const frames: PitchFrame[] = []
  for (let i = 0; i / 100 <= until; i++) {
    const t = i / 100
    const on = notes.find((note) => t >= note.from && t < note.to)
    const cents = on === undefined ? null : on.index in off ? off[on.index] : 0
    frames.push(
      on === undefined || cents === null
        ? { t, f0: 0, conf: 0, rms: 0.002 }
        : { t, f0: hz(on.midi + cents / 100), conf: 0.95, rms: 0.1 },
    )
  }
  return frames
}

/** The mic's answer, then the clock's: twice the hops of the mic alone. */
async function opened(): Promise<void> {
  await settle()
  await settle()
}

/** The mic tapped, open, and Merc's call scheduled. */
async function tap(): Promise<void> {
  q('onboarding-mic')?.click()
  await opened()
}

/** The frames to `until` handed to the mic, and a screen frame drawn. */
function to(s: Stand, until: number, frames = take(until)): void {
  s.frames = frames.filter((frame) => frame.t <= until)
  flushFrame()
}

beforeEach(() => {
  vi.useFakeTimers({
    toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'],
  })
  stubFrames()
  localStorage.clear()
  sung.length = 0
  stopped = 0
})

afterEach(() => {
  view?.unmount()
  view = null
  controller = null
  vi.unstubAllGlobals()
  vi.useRealTimers()
  localStorage.clear()
})

describe('the sung line', () => {
  it('asks, shows the words, and waits for a tap with nothing captured', () => {
    const s = stand()
    show(s)

    expect(line()).toBe(ONBOARDING_COPY.lineAsk)
    expect(q('onboarding-sung-words')?.textContent?.trim()).toBe(
      'Open the window, let the morning in',
    )
    expect(micState()).toBe('ready')
    expect(q('onboarding-mic')?.getAttribute('aria-label')).toBe(
      ONBOARDING_COPY.singLine,
    )
    expect(bars('data-pass').every((pass) => pass === null)).toBe(true)
    expect(s.calls.acquire).toBe(0)
  })

  it('opens the mic in the tap, and Merc sings the line first', async () => {
    const s = stand()
    show(s)

    q('onboarding-mic')?.click()
    expect(s.calls.acquire).toBe(1)
    await opened()

    expect(controller?.state().phase).toBe('call')
    expect(sung).toEqual([[60, 62, 64, 67, 65, 64, 62, 64, 62, 60]])
    expect(micState()).toBe('wait')
    // Whose turn it is, in a word, under the mic; a tap still stops.
    expect(caption()).toBe(ONBOARDING_COPY.mercsTurn)
    expect(q('onboarding-mic')?.getAttribute('aria-label')).toBe(
      ONBOARDING_COPY.mercsTurnStop,
    )
    expect(localStorage.getItem(GRANT)).toBe('true')
    // Two seconds in: his first four notes lit, in his colour.
    to(s, LEAD + 1.6)
    expect(bars('data-pass')).toEqual([
      'call',
      'call',
      'call',
      'call',
      null,
      null,
      null,
      null,
      null,
      null,
    ])
    expect(line()).toBe(ONBOARDING_COPY.lineAsk)
  })

  it('hands the turn over once his call has ended', async () => {
    const s = stand()
    show(s)
    await tap()

    to(s, CALL_END + RESPONSE_GATE_SECONDS - 0.05)
    expect(controller?.state().phase).toBe('call')
    to(s, CALL_END + RESPONSE_GATE_SECONDS)

    expect(controller?.state().phase).toBe('turn')
    expect(line()).toBe('Your turn.')
    expect(micState()).toBe('sing')
    // The count-in: the cursor is still on its way to the first note.
    expect(bars('data-pass').every((pass) => pass === null)).toBe(true)
  })

  it('scores a line sung on pitch: all ten, the mic shut', async () => {
    const s = stand()
    show(s)
    await tap()

    to(s, CALL_END + RESPONSE_GATE_SECONDS)
    to(s, TURN[4].to)
    expect(bars('data-pass').slice(0, 5)).toEqual([
      'turn',
      'turn',
      'turn',
      'turn',
      'turn',
    ])
    expect(view?.container.querySelectorAll('polyline').length).toBe(1)
    to(s, TURN_END)

    expect(controller?.state().phase).toBe('done')
    expect(q('onboarding-sung-score')?.textContent).toBe(
      '10 of 10 notes on pitch',
    )
    expect(line()).toBe('All ten. Clean.')
    expect(bars('data-hit').every((hit) => hit === 'on')).toBe(true)
    expect(s.calls.release).toBeGreaterThan(0)
    expect(q('onboarding-mic')).toBeNull()
    expect(q('onboarding-continue')?.textContent).toBe(ONBOARDING_COPY.continue)
    expect(q('onboarding-sung-again')?.textContent).toBe(ONBOARDING_COPY.again)
    // Continue leads: the big button, first.
    const ways = q('onboarding-continue')?.parentElement
    expect(ways?.getAttribute('data-lead')).toBe('continue')
    expect(ways?.firstElementChild).toBe(q('onboarding-continue'))
  })

  it('leads with Once more under four in ten, and ends on a statement', async () => {
    const s = stand()
    show(s)
    await tap()

    // A voice on every note, each three semitones off: none hit.
    to(s, CALL_END + RESPONSE_GATE_SECONDS)
    const off = Object.fromEntries(TURN.map((note) => [note.index, 300]))
    to(s, TURN_END, take(TURN_END, TURN, off))

    expect(controller?.state().phase).toBe('done')
    expect(controller?.state().score?.hit ?? 0).toBeLessThan(4)
    expect(line()).toBe('Your voice is still warming up. Try it once more.')
    const ways = q('onboarding-sung-again')?.parentElement
    expect(ways?.getAttribute('data-lead')).toBe('again')
    expect(ways?.firstElementChild).toBe(q('onboarding-sung-again'))
  })

  it('draws the voice on the lane only: its count-in and tail kept inside', async () => {
    const s = stand()
    show(s)
    await tap()

    // A voice through the whole count-in and on past the line's last note.
    const turnAt = CALL_END + RESPONSE_GATE_SECONDS
    const last = TURN[TURN.length - 1]
    const frames = take(TURN_END).map((frame) =>
      frame.t >= turnAt && (frame.t < TURN[0].from || frame.t >= last.to)
        ? {
            t: frame.t,
            f0: hz(frame.t < TURN[0].from ? TURN[0].midi : last.midi),
            conf: 0.95,
            rms: 0.1,
          }
        : frame,
    )
    to(s, turnAt, frames)
    to(s, TURN[0].from, frames)
    to(s, TURN_END, frames)
    expect(controller?.state().phase).toBe('done')

    const svg = view?.container.querySelector(
      '[data-testid="onboarding-sung-lane"] svg',
    )
    const [minX, minY, width, height] = (svg?.getAttribute('viewBox') ?? '')
      .split(' ')
      .map(Number)
    const points = [...(view?.container.querySelectorAll('polyline') ?? [])]
      .flatMap((stroke) => (stroke.getAttribute('points') ?? '').split(' '))
      .map((point) => point.split(',').map(Number))
    const xs = points.map(([x]) => x)
    expect(points.length).toBeGreaterThan(0)
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(minX)
    expect(Math.max(...xs)).toBeLessThanOrEqual(minX + width)
    expect(points.every(([, y]) => y >= minY && y <= minY + height)).toBe(true)
    // The lead-in still shows the count-in's last second, and the tail its end.
    expect(Math.min(...xs)).toBeLessThan(minX + 0.1)
    expect(Math.max(...xs)).toBeGreaterThan(LINE_SEC)
  })

  it('says how the notes missed went, from what was sung', async () => {
    const s = stand()
    show(s)
    await tap()
    const frames = take(TURN_END, TURN, { 8: -80, 9: -80 })

    to(s, CALL_END + RESPONSE_GATE_SECONDS, frames)
    to(s, TURN_END, frames)

    expect(q('onboarding-sung-score')?.textContent).toBe(
      '8 of 10 notes on pitch',
    )
    expect(line()).toBe('Nearly all. The rest sat a hair flat.')
    expect(bars('data-hit').slice(7)).toEqual(['on', 'off', 'off'])
  })

  it('asks again when the turn heard no voice, the mic shut', async () => {
    const s = stand()
    show(s)
    await tap()
    const silent = take(
      TURN_END,
      TURN,
      Object.fromEntries(TURN.map((note) => [note.index, null])),
    )

    to(s, CALL_END + RESPONSE_GATE_SECONDS, silent)
    to(s, TURN_END, silent)

    expect(controller?.state().phase).toBe('missed')
    expect(line()).toBe(ONBOARDING_COPY.lineUnheard)
    expect(micState()).toBe('ready')
    expect(q('onboarding-sung-score')?.getAttribute('data-shown')).toBe('off')
    expect(s.calls.release).toBeGreaterThan(0)
  })

  it('ends a turn whose frames stopped coming on the wall clock, the mic shut', async () => {
    const s = stand()
    show(s)
    let wall = performance.now()
    const clock = vi.spyOn(performance, 'now').mockImplementation(() => wall)
    await tap()
    to(s, CALL_END + RESPONSE_GATE_SECONDS)
    expect(controller?.state().phase).toBe('turn')

    // The mic goes quiet under the page: no frame after the gate. Within
    // the grace the frames' clock still rules, past it the wall clock.
    wall += TURN_END * 1000
    flushFrame()
    const withinGrace = controller?.state().phase
    wall += (LATE_FRAMES_SEC + 0.1) * 1000
    flushFrame()
    clock.mockRestore()

    expect(withinGrace).toBe('turn')
    expect(controller?.state().phase).toBe('missed')
    expect(micState()).toBe('ready')
    expect(s.calls.release).toBeGreaterThan(0)
  })

  it('sings it again on Once more, from his call, the mic opened in that tap', async () => {
    const s = stand()
    show(s)
    await tap()
    to(s, CALL_END + RESPONSE_GATE_SECONDS)
    to(s, TURN_END)

    q('onboarding-sung-again')?.click()
    expect(s.calls.acquire).toBe(2)
    await opened()

    expect(controller?.state().phase).toBe('call')
    expect(sung).toHaveLength(2)
    expect(q('onboarding-sung-score')?.getAttribute('data-shown')).toBe('off')
    expect(bars('data-hit').every((hit) => hit === null)).toBe(true)
  })

  it('stops on a tap while it listens: back to ready, his call cut', async () => {
    const s = stand()
    show(s)
    await tap()
    to(s, 2)

    q('onboarding-mic')?.click()

    expect(controller?.state().phase).toBe('ready')
    expect(stopped).toBe(1)
    expect(s.calls.release).toBeGreaterThan(0)
    expect(line()).toBe(ONBOARDING_COPY.lineAsk)
  })

  it('drops a mic still opening when the onboarding leaves: no call plays', async () => {
    const s = stand()
    let open = (): void => undefined
    s.answer = async () =>
      new Promise<void>((resolve) => {
        open = resolve
      })
    show(s)
    q('onboarding-mic')?.click()
    await settle()
    expect(controller?.state().phase).toBe('starting')

    controller?.leave()
    open()
    await opened()

    expect(controller?.state().phase).toBe('ready')
    expect(sung).toHaveLength(0)
    expect(s.calls.startWindow).toBe(0)
  })

  it('goes back to ready when the page hides in the turn', async () => {
    const s = stand()
    show(s)
    await tap()
    to(s, CALL_END + RESPONSE_GATE_SECONDS)

    const visibility = vi
      .spyOn(document, 'visibilityState', 'get')
      .mockReturnValue('hidden')
    document.dispatchEvent(new Event('visibilitychange'))
    visibility.mockRestore()

    expect(controller?.state().phase).toBe('ready')
    expect(s.calls.release).toBeGreaterThan(0)
  })

  it('says why a refused mic did not open, takes the grant back, and tries again', async () => {
    const s = stand()
    localStorage.setItem(GRANT, 'true')
    s.answer = async () => Promise.reject(new CaptureError('denied'))
    show(s)

    await tap()

    expect(controller?.state()).toMatchObject({
      phase: 'blocked',
      block: 'denied',
    })
    expect(localStorage.getItem(GRANT)).toBe('false')
    expect(line()).toBeNull()
    s.answer = async () => Promise.resolve()
    q('onboarding-retry')?.click()
    expect(s.calls.acquire).toBe(2)
  })

  it('sings from the tonic it is given, read as each start begins', async () => {
    const s = stand()
    let tonic = 60
    show(s, () => tonic)
    tonic = 52
    await tap()

    expect(controller?.tonic()).toBe(52)
    expect(sung[0][0]).toBe(52)
    const notes = lineNotes(52, CALL_END + RESPONSE_GATE_SECONDS + COUNT_IN_SEC)
    const frames = take(TURN_END, notes)
    to(s, CALL_END + RESPONSE_GATE_SECONDS, frames)
    to(s, TURN_END, frames)
    expect(controller?.state().score?.hit).toBe(10)
  })
})
