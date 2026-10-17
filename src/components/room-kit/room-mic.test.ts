// ============================================================
// Room mic: one start's microphone, step by step and answer by answer
// ============================================================
//
// A capture whose note, mic and clock each wait until the test says how
// they went, so a test can stop the start, end the screen or start again
// between any two steps. The room's state is a plain signal, as a room's
// machine keeps it.

import { createSignal } from 'solid-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { RoomMicStart, RoomStartState } from './room-mic'
import { openRoomMic } from './room-mic'
import { CaptureError } from './useExerciseCapture'

interface Pending<T> {
  readonly promise: Promise<T>
  readonly resolve: (value: T) => void
  readonly reject: (error: unknown) => void
}

function pending<T>(): Pending<T> {
  let resolve: (value: T) => void = () => undefined
  let reject: (error: unknown) => void = () => undefined
  const promise = new Promise<T>((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}

const CLOCK = { state: 'running' } as unknown as AudioContext

/** A room at its first start, with a capture that waits on the test. */
function room(options: Partial<RoomMicStart> = {}) {
  const [state, setState] = createSignal<RoomStartState>({
    phase: 'starting',
    run: 1,
  })
  let alive = true
  const log: string[] = []
  const tones: Pending<void>[] = []
  const mics: Pending<void>[] = []
  const clocks: Pending<AudioContext | null>[] = []
  const capture: RoomMicStart['capture'] = {
    playTone: (midi) => {
      log.push(`tone ${midi}`)
      const step: Pending<void> = pending()
      tones.push(step)
      return step.promise
    },
    acquire: () => {
      log.push('mic')
      const step: Pending<void> = pending()
      mics.push(step)
      return step.promise
    },
    audio: () => {
      log.push('clock')
      const step: Pending<AudioContext | null> = pending()
      clocks.push(step)
      return step.promise
    },
  }
  const open = (): void => {
    openRoomMic({
      capture,
      alive: () => alive,
      state,
      onOpen: (run, clock) => {
        log.push(`open ${run}${clock === null ? '' : ' with the clock'}`)
      },
      onFail: (run, block) => {
        log.push(`fail ${run} ${block}`)
      },
      onHidden: () => {
        log.push('hidden')
      },
      ...options,
    })
  }
  return {
    log,
    tones,
    mics,
    clocks,
    open,
    setState,
    /** The screen goes. */
    end: () => {
      alive = false
    },
  }
}

/** Every promise step settled, however deep the chain. */
async function settle(): Promise<void> {
  for (let i = 0; i < 12; i++) await Promise.resolve()
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('openRoomMic: the mic, then the clock', () => {
  it('opens the mic inside the tap, then the clock, and hands the clock over', async () => {
    const r = room({ clock: true })
    r.setState({ phase: 'starting', run: 3 })
    r.open()
    // The mic is asked for before the tap returns: iOS unlocks only there.
    expect(r.log).toEqual(['mic'])

    r.mics[0].resolve()
    await settle()
    expect(r.log).toEqual(['mic', 'clock'])

    r.clocks[0].resolve(CLOCK)
    await settle()
    expect(r.log).toEqual(['mic', 'clock', 'open 3 with the clock'])
  })

  it('fails the start when the clock will not start', async () => {
    const r = room({ clock: true })
    r.open()
    r.mics[0].resolve()
    await settle()
    r.clocks[0].resolve(null)
    await settle()
    expect(r.log).toEqual(['mic', 'clock', 'fail 1 unavailable'])
  })

  it('fails with the reason a refused mic gives, and asks for no clock', async () => {
    const reasons: [unknown, string][] = [
      [new CaptureError('denied', 'Test'), 'denied'],
      [new CaptureError('unavailable', 'Test'), 'unavailable'],
      [new Error('no device'), 'unavailable'],
    ]
    for (const [error, block] of reasons) {
      const r = room({ clock: true })
      r.open()
      r.mics[0].reject(error)
      await settle()
      expect(r.log).toEqual(['mic', `fail 1 ${block}`])
    }
  })

  it('asks for no clock once the start no longer stands, and answers nothing', async () => {
    const stops: [string, (r: ReturnType<typeof room>) => void][] = [
      ['the screen went', (r) => r.end()],
      ['the room went back', (r) => r.setState({ phase: 'intro', run: 1 })],
      ['a newer start', (r) => r.setState({ phase: 'starting', run: 2 })],
    ]
    for (const [, stop] of stops) {
      const r = room({ clock: true })
      r.open()
      stop(r)
      r.mics[0].resolve()
      await settle()
      expect(r.log).toEqual(['mic'])
    }
  })

  it('drops an answer that comes after the start stopped standing', async () => {
    const r = room({ clock: true })
    r.open()
    r.mics[0].resolve()
    await settle()
    r.setState({ phase: 'intro', run: 1 })
    r.clocks[0].resolve(CLOCK)
    await settle()

    const refused = room({ clock: true })
    refused.open()
    refused.end()
    refused.mics[0].reject(new CaptureError('denied', 'Test'))
    await settle()

    expect(r.log).toEqual(['mic', 'clock'])
    expect(refused.log).toEqual(['mic'])
  })

  it('answers only the newer of two starts', async () => {
    const r = room({ clock: true })
    r.open()
    r.setState({ phase: 'starting', run: 2 })
    r.open()
    r.mics[0].resolve()
    r.mics[1].resolve()
    await settle()
    r.clocks.forEach((clock) => clock.resolve(CLOCK))
    await settle()
    expect(r.log).toEqual(['mic', 'mic', 'clock', 'open 2 with the clock'])
  })
})

describe('openRoomMic: the page went away while the mic opened', () => {
  it('tells the room after it opened', async () => {
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
    const r = room({ clock: true })
    r.open()
    r.mics[0].resolve()
    await settle()
    r.clocks[0].resolve(CLOCK)
    await settle()
    expect(r.log).toEqual(['mic', 'clock', 'open 1 with the clock', 'hidden'])
  })

  it('says nothing of the page when the mic failed, or the page shows', async () => {
    const hidden = vi
      .spyOn(document, 'visibilityState', 'get')
      .mockReturnValue('hidden')
    const failed = room({ clock: true })
    failed.open()
    failed.mics[0].reject(new CaptureError('denied', 'Test'))
    await settle()

    hidden.mockReturnValue('visible')
    const shown = room()
    shown.open()
    shown.mics[0].resolve()
    await settle()

    expect(failed.log).toEqual(['mic', 'fail 1 denied'])
    expect(shown.log).toEqual(['mic', 'open 1'])
  })
})

describe('openRoomMic: a note first', () => {
  it('plays the note, then opens the mic once it has ended', async () => {
    const r = room({ tone: 57 })
    r.open()
    expect(r.log).toEqual(['tone 57'])

    r.tones[0].resolve()
    await settle()
    expect(r.log).toEqual(['tone 57', 'mic'])

    r.mics[0].resolve()
    await settle()
    expect(r.log).toEqual(['tone 57', 'mic', 'open 1'])
  })

  it('opens the mic inside the tap when there is no note', () => {
    const r = room({ tone: null })
    r.open()
    expect(r.log).toEqual(['mic'])
  })

  it('opens no mic after the note once the start no longer stands', async () => {
    const r = room({ tone: 57 })
    r.open()
    r.setState({ phase: 'intro', run: 1 })
    r.tones[0].resolve()
    await settle()
    expect(r.log).toEqual(['tone 57'])
  })

  it('fails the start when the note cannot play', async () => {
    const r = room({ tone: 57 })
    r.open()
    r.tones[0].reject(new Error('no clock'))
    await settle()
    expect(r.log).toEqual(['tone 57', 'fail 1 unavailable'])
  })
})

describe('openRoomMic: a room that takes late answers', () => {
  it('hears an answer for a start that no longer stands, for its machine to drop', async () => {
    const r = room({ tone: 57, lateAnswers: true })
    r.open()
    r.setState({ phase: 'intro', run: 1 })
    r.tones[0].resolve()
    await settle()

    const refused = room({ lateAnswers: true })
    refused.open()
    refused.setState({ phase: 'intro', run: 1 })
    refused.mics[0].reject(new CaptureError('denied', 'Test'))
    await settle()

    // No mic after the note: the step itself still waits on the start.
    expect(r.log).toEqual(['tone 57', 'open 1'])
    expect(refused.log).toEqual(['mic', 'fail 1 denied'])
  })

  it('hears a late answer under its own start, not the newer one', async () => {
    const r = room({ lateAnswers: true })
    r.open()
    r.setState({ phase: 'starting', run: 2 })
    r.mics[0].resolve()
    await settle()
    // The machine drops a `mic-ready` for start 1 while start 2 opens; under
    // start 2's number it would take it.
    expect(r.log).toEqual(['mic', 'open 1'])
  })

  it('hears nothing once its screen has gone', async () => {
    const r = room({ lateAnswers: true })
    r.open()
    r.end()
    r.mics[0].resolve()
    await settle()

    const refused = room({ lateAnswers: true })
    refused.open()
    refused.end()
    refused.mics[0].reject(new CaptureError('denied', 'Test'))
    await settle()

    expect(r.log).toEqual(['mic'])
    expect(refused.log).toEqual(['mic'])
  })
})

describe('openRoomMic: where an answer lands', () => {
  // A probe chained on the same mic, one `then` a microtask, marks where
  // the room's answer lands. A step that awaited, or a chain one `then`
  // longer, would move it.
  async function landing(
    options: Partial<RoomMicStart>,
    first: 'mic' | 'tone',
  ) {
    const r = room(options)
    r.open()
    const step = first === 'mic' ? r.mics[0] : r.tones[0]
    let probe: Promise<void> = step.promise
    for (let tick = 1; tick <= 6; tick++) {
      probe = probe.then(() => {
        r.log.push(`tick ${tick}`)
      })
    }
    step.resolve()
    if (options.clock === true) {
      await Promise.resolve()
      r.clocks[0].resolve(CLOCK)
    }
    if (first === 'tone') {
      await Promise.resolve()
      r.mics[0].resolve()
    }
    await settle()
    return r.log
  }

  it('answers the mic and the clock where a then on each lands', async () => {
    expect(await landing({ clock: true }, 'mic')).toEqual([
      'mic',
      'clock',
      'tick 1',
      'tick 2',
      'tick 3',
      'open 1 with the clock',
      'tick 4',
      'tick 5',
      'tick 6',
    ])
  })

  it('answers the mic straight after it, and the note then the mic in order', async () => {
    expect(await landing({}, 'mic')).toEqual([
      'mic',
      'open 1',
      'tick 1',
      'tick 2',
      'tick 3',
      'tick 4',
      'tick 5',
      'tick 6',
    ])
    expect(await landing({ tone: 57 }, 'tone')).toEqual([
      'tone 57',
      'mic',
      'tick 1',
      'tick 2',
      'tick 3',
      'open 1',
      'tick 4',
      'tick 5',
      'tick 6',
    ])
  })
})
