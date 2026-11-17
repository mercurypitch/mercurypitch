// ============================================================
// The Warm-up on the web: its path, its stops over it, and its song
// ============================================================
//
// The web's frame (WebRoomHost.tsx) with the real path and the real stop
// hand-over (warm-up-stop.ts), in the web build's terms (`WEB_ROOMS`): the
// web's routine of four rooms, each opened over the path in the same frame
// and coming back to it by its result, its Skip stop or Back. The rooms are
// stood in for, each saying which stop it was handed; they have their own
// tests, and the browser spec opens the real ones. "Sing a song" is handed
// to the page, which knows the tabs (tabs/song-tab.ts).

import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { RoutineStop } from '@/components/room-kit/routine-stop'
import { warmUpMinutes } from '@/features/warm-up/estimate'
import { ACTIONS_MS } from '@/features/warm-up/path-motion'
import { finishStop, freshDay } from '@/features/warm-up/routine'
import { planWarmUp, roomCount, WEB_ROUTINE, } from '@/features/warm-up/warm-up-plan'
import { openStop, resetWarmUpForTests, WARM_UP_TODAY_KEY, warmUpDay, } from '@/features/warm-up/warm-up-store'
import { PULSE_MS } from '@/features/warm-up/WarmUpPath'
import { AUTO_CONTINUE_SECONDS } from '@/lib/auto-continue'
import { EXERCISE_FIRST_NOTE_STAGE, EXERCISE_WARM_UP_PATH, } from '@/lib/domain/exercise-contracts'
import { WEB_WARM_UP_LINE, webRooms } from './web-room-list'
import WebRoomHost from './WebRoomHost'

// The web build: its routine, and its way in.
vi.mock('@/lib/native-build', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  WEB_ROOMS: true,
}))

vi.mock('@/components/room-kit/MercView', () => ({
  MERC_FEET: 0.81,
  MercView: () => document.createElement('div'),
}))

/** A room that draws the stop it was handed, and can end it either way. */
const standIn = vi.hoisted(
  () =>
    (id: string, line: string) =>
    (props: { routine?: RoutineStop }): HTMLElement => {
      // eslint-disable-next-line solid/reactivity -- a room is handed its stop once, at mount (warm-up-stop.ts)
      const stop = props.routine
      const room = document.createElement('div')
      room.dataset.testid = 'stand-in'
      room.dataset.room = id
      room.dataset.stop =
        stop === undefined ? 'none' : `${stop.index + 1} of ${stop.count}`
      const finish = document.createElement('button')
      finish.dataset.testid = 'stand-in-finish'
      finish.addEventListener('click', () =>
        stop?.finish({ id: id as never, line, settledNote: null }),
      )
      const skip = document.createElement('button')
      skip.dataset.testid = 'stand-in-skip'
      skip.addEventListener('click', () => stop?.skip())
      room.append(finish, skip)
      return room
    },
)

vi.mock('@/features/lip-roll/LipRollRoom', () => ({
  LipRollRoom: standIn('lip-roll-bay', '86% lit'),
}))
vi.mock('@/features/ng-slides/NgSlidesRoom', () => ({
  NgSlidesRoom: standIn('ng-slides-bridge', '92% lit'),
}))
vi.mock('@/features/long-note/LongNoteRoom', () => ({
  LongNoteRoom: standIn('long-note-lantern', '12.6 s'),
}))
vi.mock('@/features/echo/EchoRoom', () => ({
  EchoRoom: standIn('echo-stars', '8 of 9 on pitch'),
}))

const onBack = vi.fn()
const onSong = vi.fn()

/** The frame is portalled to the body. */
const frame = (): HTMLElement => screen.getByTestId('web-room')

/** The room on top, as the frame names it, and the stop it was handed. */
function onTop(): string {
  const stop =
    frame().querySelector<HTMLElement>('[data-testid="stand-in"]')?.dataset
      .stop ?? 'path'
  return `${frame().dataset.room} ${stop}`
}

/** A room's code, or the path's, loads; then what it shows settles. */
async function settle(): Promise<void> {
  for (let i = 0; i < 3; i += 1) {
    await vi.dynamicImportSettled()
    await vi.advanceTimersByTimeAsync(0)
  }
}

async function wait(ms: number): Promise<void> {
  await vi.advanceTimersByTimeAsync(ms)
  await settle()
}

async function click(testId: string): Promise<void> {
  fireEvent.click(screen.getByTestId(testId))
  await settle()
}

/** Next, once the card has made room for it, then the ring's pulse. */
async function next(): Promise<void> {
  await wait(ACTIONS_MS)
  await click('warm-up-next')
  await wait(PULSE_MS)
}

/** The Warm-up's card is pressed: the frame opens on the path. */
async function openWarmUp(): Promise<void> {
  render(() => (
    <WebRoomHost id={EXERCISE_WARM_UP_PATH} onBack={onBack} onSong={onSong} />
  ))
  await settle()
}

/** Today's run with every stop sung, as this device keeps it. */
function keepSungRun(): void {
  const sung = WEB_ROUTINE.stops.reduce(
    (day, stop, index) =>
      stop.kind === 'room'
        ? finishStop(day, index, { line: '86% lit', settledNote: null })
        : day,
    freshDay(WEB_ROUTINE),
  )
  localStorage.setItem(WARM_UP_TODAY_KEY, JSON.stringify(sung))
  resetWarmUpForTests()
}

beforeEach(async () => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2026, 10, 16, 9, 0))
  onBack.mockReset()
  onSong.mockReset()
  localStorage.clear()
  resetWarmUpForTests()
  await openWarmUp()
})

afterEach(async () => {
  await vi.dynamicImportSettled()
  cleanup()
  resetWarmUpForTests()
  vi.useRealTimers()
})

describe("the web's routine", () => {
  it('is four rooms and the song, First note not among them', () => {
    expect(planWarmUp()).toBe(WEB_ROUTINE)
    expect(roomCount(WEB_ROUTINE)).toBe(4)
    expect(
      WEB_ROUTINE.stops.map((stop) =>
        stop.kind === 'room' ? stop.id : 'song',
      ),
    ).not.toContain(EXERCISE_FIRST_NOTE_STAGE)
  })

  it("is what the card's line says: four stops, about three minutes", () => {
    const card = webRooms().find((room) => room.id === EXERCISE_WARM_UP_PATH)

    expect(card?.entry.line).toBe(WEB_WARM_UP_LINE)
    expect(WEB_WARM_UP_LINE).toMatch(/^Four stops, about three minutes/u)
    for (const level of ['learning', 'singer', 'professional'] as const) {
      expect(warmUpMinutes(WEB_ROUTINE, level)).toBe(3)
    }
  })
})

describe('the Warm-up in the web frame', () => {
  it('walks four stops, each over the path, to the end, and hands Sing a song to the page', async () => {
    expect(onTop()).toBe('warm-up-path path')
    expect(screen.getByTestId('warm-up-path')).not.toBeNull()

    // Start: Lip roll, stop 1 of 4, over the path in the same frame.
    await click('warm-up-start')
    await wait(PULSE_MS)
    expect(onTop()).toBe('lip-roll-bay 1 of 4')
    expect(screen.queryByTestId('warm-up-path')).toBeNull()
    expect(frame().querySelector('h2')?.textContent).toBe('Lip roll')

    // Its result goes back to the path, which lights the stop.
    await click('stand-in-finish')
    expect(onTop()).toBe('warm-up-path path')
    expect(warmUpDay().marks[0]).toEqual({ state: 'done', line: '86% lit' })

    // The countdown takes the singer on to Ng slides by itself.
    await wait(ACTIONS_MS + AUTO_CONTINUE_SECONDS * 1000 + PULSE_MS)
    expect(onTop()).toBe('ng-slides-bridge 2 of 4')
    await click('stand-in-finish')

    await next()
    expect(onTop()).toBe('long-note-lantern 3 of 4')
    await click('stand-in-finish')

    await next()
    expect(onTop()).toBe('echo-stars 4 of 4')
    await click('stand-in-finish')

    // The end: the day warmed up, four of four.
    expect(screen.getByTestId('warm-up-title').textContent).toBe('Warmed up')
    expect(screen.getByText('4 of 4 today')).not.toBeNull()
    expect(warmUpDay().warmedUp).toBe(true)
    expect(onBack).not.toHaveBeenCalled()

    await click('warm-up-sing')
    expect(onSong).toHaveBeenCalledTimes(1)
    expect(onBack).not.toHaveBeenCalled()
  })

  it("a room's Skip stop goes back to the path, the stop skipped", async () => {
    await click('warm-up-start')
    await wait(PULSE_MS)

    await click('stand-in-skip')

    expect(onTop()).toBe('warm-up-path path')
    expect(warmUpDay().marks[0]).toEqual({ state: 'skipped' })
  })

  it('Back from a room leaves its stop unfinished and returns to the path', async () => {
    await click('warm-up-start')
    await wait(PULSE_MS)
    expect(onTop()).toBe('lip-roll-bay 1 of 4')

    await click('web-room-back')

    expect(onBack).not.toHaveBeenCalled()
    expect(onTop()).toBe('warm-up-path path')
    expect(openStop()).toBeNull()
    expect(warmUpDay().marks[0]).toEqual({ state: 'waiting' })
    expect(screen.getByTestId('warm-up-start').textContent).toBe(
      'Start warm-up',
    )

    // Back from the path leaves the Warm-up.
    await click('web-room-back')
    expect(onBack).toHaveBeenCalledTimes(1)
  })

  it('Escape does what Back does, at each level', async () => {
    await click('warm-up-start')
    await wait(PULSE_MS)

    fireEvent.keyDown(document, { key: 'Escape' })
    await settle()

    expect(onBack).not.toHaveBeenCalled()
    expect(onTop()).toBe('warm-up-path path')
    expect(openStop()).toBeNull()

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onBack).toHaveBeenCalledTimes(1)
  })
})

describe('for a singer already warmed up today', () => {
  beforeEach(() => {
    cleanup()
    keepSungRun()
  })

  it('opens on the run as it was left, with no padlock, and Sing a song goes to the page', async () => {
    await openWarmUp()
    expect(screen.getByTestId('warm-up-path').dataset.state).toBe('done')
    expect(screen.queryByTestId('warm-up-premium')).toBeNull()

    await click('warm-up-sing')

    expect(onSong).toHaveBeenCalledTimes(1)
    expect(onBack).not.toHaveBeenCalled()
  })
})
