import { cleanup, render, screen, waitFor } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import lanternStyles from '../Lantern.module.css'
import { CHIMNEY_BOTTOM, CHIMNEY_TOP, LANTERN_VIEW_H, } from '../lantern-geometry'
import { formatHoldSeconds } from '../long-note-entry'
import { LongNoteRoom } from '../LongNoteRoom'
import styles from '../LongNoteRoom.module.css'
import type * as ControllerModule from '../useLongNoteController'
import type { LongNoteFixtureName } from './fixture-scenes'
import { FIXTURE_SCENES, mercLine } from './fixture-scenes'
import { fixtureController, isFixtureName, LongNoteFixture, } from './LongNoteFixture'
import { mountLongNoteFixture } from './mount-long-note-fixture'

// Merc's renderer is WebGL: a stand-in that does nothing.
vi.mock('@/lib/merc/stage', () => ({
  mountMercStage: () => ({
    ok: true,
    setState: () => undefined,
    setVoice: () => undefined,
    setPaused: () => undefined,
    destroy: () => undefined,
  }),
}))

// The room's own run, counted: a room handed a run must not build one.
const own = vi.hoisted(() => ({ built: 0 }))
vi.mock('../useLongNoteController', async () => {
  const actual = await vi.importActual<typeof ControllerModule>(
    '../useLongNoteController',
  )
  return {
    ...actual,
    useLongNoteController: () => {
      own.built += 1
      return actual.useLongNoteController()
    },
  }
})

// jsdom has no 2D canvas: the trace draws nothing.
beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
})

afterEach(() => {
  cleanup()
  own.built = 0
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})

/** The lantern's level, read off the liquid's window in its back layer. */
function shownLevel(): number {
  const liquid = screen
    .getByTestId('lantern-back')
    .querySelector<HTMLElement>(`.${lanternStyles.window}`)
  const shift = /translateY\((-?[\d.]+)%\)/.exec(liquid?.style.transform ?? '')
  const surface = (Number(shift?.[1]) / 100) * LANTERN_VIEW_H
  return (CHIMNEY_BOTTOM - surface) / (CHIMNEY_BOTTOM - CHIMNEY_TOP)
}

const NAMES = Object.keys(FIXTURE_SCENES) as LongNoteFixtureName[]

describe('LongNoteRoom on a run that is not its own', () => {
  it('builds no run of its own, and has no demo', () => {
    render(() => (
      <LongNoteRoom
        onDone={() => undefined}
        controller={fixtureController(FIXTURE_SCENES.intro)}
      />
    ))

    expect(own.built).toBe(0)
    expect(screen.getByTestId('long-note-room').dataset.demo).toBe('idle')
    expect(screen.queryByTestId('long-note-demo')).toBeNull()
    expect(screen.queryByTestId('long-note-ask')).toBeNull()
    expect(screen.getByTestId('long-note-line').textContent).toBe(
      mercLine('intro', 'intro-breathe'),
    )
  })

  it('builds its own run, and its demo, when it is handed none', () => {
    render(() => <LongNoteRoom onDone={() => undefined} />)

    expect(own.built).toBe(1)
    expect(screen.getByTestId('long-note-demo')).toBeTruthy()
  })

  it('draws the run it was handed: the timer, the chip and the light', () => {
    render(() => (
      <LongNoteRoom
        onDone={() => undefined}
        controller={fixtureController(FIXTURE_SCENES['mid-take'])}
      />
    ))

    const scene = FIXTURE_SCENES['mid-take']
    expect(screen.getByTestId('long-note-room').dataset.phase).toBe('hold')
    expect(screen.getByTestId('long-note-timer').textContent).toContain(
      formatHoldSeconds(scene.inBandSeconds),
    )
    expect(screen.getByTestId('long-note-chip').textContent).toBe(scene.chip)
    expect(shownLevel()).toBeCloseTo(scene.level, 3)
  })
})

describe('LongNoteRoom held still', () => {
  it('marks the room and both lantern layers still', () => {
    render(() => (
      <LongNoteRoom
        onDone={() => undefined}
        controller={fixtureController(FIXTURE_SCENES.result)}
        still
      />
    ))

    expect(
      screen.getByTestId('long-note-room').classList.contains(styles.still),
    ).toBe(true)
    for (const id of ['lantern-back', 'lantern-front']) {
      expect(
        screen.getByTestId(id).classList.contains(lanternStyles.paused),
      ).toBe(true)
    }
  })

  it('moves as before without it', () => {
    render(() => (
      <LongNoteRoom
        onDone={() => undefined}
        controller={fixtureController(FIXTURE_SCENES.result)}
      />
    ))

    expect(
      screen.getByTestId('long-note-room').classList.contains(styles.still),
    ).toBe(false)
    for (const id of ['lantern-back', 'lantern-front']) {
      expect(
        screen.getByTestId(id).classList.contains(lanternStyles.paused),
      ).toBe(false)
    }
  })

  it('asks for no frames to draw the voice in a hold', () => {
    const frames = vi.fn(() => 1)
    vi.stubGlobal('requestAnimationFrame', frames)
    vi.stubGlobal('cancelAnimationFrame', () => undefined)

    render(() => (
      <LongNoteRoom
        onDone={() => undefined}
        controller={fixtureController(FIXTURE_SCENES['mid-take'])}
        still
      />
    ))

    expect(frames).not.toHaveBeenCalled()
  })
})

describe('LongNoteRoom settling', () => {
  it('says it has settled once every picture in it has decoded', async () => {
    let release: () => void = () => undefined
    const decoded = new Promise<void>((resolve) => {
      release = resolve
    })
    const decode = vi.fn(() => decoded)
    Object.defineProperty(HTMLImageElement.prototype, 'decode', {
      configurable: true,
      value: decode,
    })
    const settled = vi.fn()

    render(() => (
      <LongNoteRoom
        onDone={() => undefined}
        controller={fixtureController(FIXTURE_SCENES.intro)}
        onSettled={settled}
      />
    ))
    const plates = screen
      .getByTestId('long-note-lantern')
      .querySelectorAll('img').length
    await Promise.resolve()
    await Promise.resolve()

    expect(plates).toBe(5)
    expect(decode).toHaveBeenCalledTimes(plates)
    expect(settled).not.toHaveBeenCalled()
    release()
    await waitFor(() => {
      expect(settled).toHaveBeenCalledTimes(1)
    })
    Reflect.deleteProperty(HTMLImageElement.prototype, 'decode')
  })
})

describe('the Long note fixtures', () => {
  // jsdom never runs a frame: the fixture's two settling frames run here.
  beforeEach(() => {
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) =>
      setTimeout(() => cb(performance.now()), 0),
    )
    vi.stubGlobal('cancelAnimationFrame', (id: number) => clearTimeout(id))
  })

  it.each(NAMES)(
    '%s: the room in its state, ready once settled',
    async (name) => {
      const scene = FIXTURE_SCENES[name]

      render(() => <LongNoteFixture name={name} />)

      const page = screen.getByTestId('long-note-fixture')
      expect(page.dataset.fixture).toBe(name)
      await waitFor(() => {
        expect(page.dataset.ready).toBe('true')
      })
      const room = screen.getByTestId('long-note-room')
      expect(room.dataset.phase).toBe(scene.phase)
      expect(room.classList.contains(styles.still)).toBe(true)
      expect(shownLevel()).toBeCloseTo(scene.level, 3)
      if (scene.line === '') {
        expect(screen.queryByTestId('long-note-line')).toBeNull()
      } else {
        expect(screen.getByTestId('long-note-line').textContent).toBe(
          scene.line,
        )
      }
      if (scene.summary !== null) {
        expect(screen.getByTestId('long-note-result').textContent).toContain(
          formatHoldSeconds(scene.summary.inBandSeconds),
        )
      }
    },
  )

  it('draws a stop of the Warm-up: its chip and "Skip stop" at the intro, no buttons at the result', async () => {
    const stop = {
      index: 1,
      count: 4,
      settledNote: null,
      finish: () => undefined,
      skip: () => undefined,
    }
    render(() => <LongNoteFixture name="intro" stop={stop} />)
    expect(screen.getByTestId('long-note-chip').textContent).toBe(
      'Warm-up 2 of 4',
    )
    expect(screen.getByTestId('long-note-skip-stop')).toBeTruthy()
    expect(screen.queryByTestId('long-note-level')).toBeNull()
    cleanup()

    render(() => <LongNoteFixture name="result" stop={stop} />)
    await waitFor(() => {
      expect(screen.getByTestId('long-note-fixture').dataset.ready).toBe('true')
    })
    expect(screen.queryByTestId('long-note-again')).toBeNull()
    expect(screen.queryByTestId('long-note-done')).toBeNull()
    expect(screen.getByTestId('long-note-routine-on')).toBeTruthy()
  })

  it('names the five states, and nothing else', () => {
    expect(NAMES).toEqual(['intro', 'rest', 'mid-take', 'demo-off', 'result'])
    expect(isFixtureName('result')).toBe(true)
    expect(isFixtureName('toString')).toBe(false)
    expect(isFixtureName(null)).toBe(false)
  })

  it('mounts a named fixture in place of the app, and marks the root loaded', () => {
    const root = document.createElement('div')
    document.body.append(root)

    expect(mountLongNoteFixture(root, 'nope')).toBe(false)
    expect(root.classList.contains('loaded')).toBe(false)
    expect(mountLongNoteFixture(root, 'intro')).toBe(true)
    expect(root.classList.contains('loaded')).toBe(true)
    expect(
      root.querySelector('[data-testid="long-note-fixture"]'),
    ).not.toBeNull()
  })
})
