// ============================================================
// WarmUpPath: each state's words and buttons, the timing, the live region
// ============================================================
//
// DESIGN-warm-up.md §12, 13c's component tests, against the real store
// (warm-up-store.ts) on a cleared storage and a fixed day: the first
// visit, the way into a stop, the way back with its card and countdown
// (pw-next), Skip and Again, the end and the same day again, the free run
// used, leaving, the routine's unlocks, and a new day on the way back.
// Merc's canvas is stood in for: the renderer is his own suite's business.

import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { createSignal, Show } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { HOP_MS } from '@/components/room-kit/merc-moves'
import { AUTO_CONTINUE_SECONDS } from '@/lib/auto-continue'
import { EXERCISE_ECHO_STARS, EXERCISE_LIP_ROLL_BAY, EXERCISE_LONG_NOTE_LANTERN, EXERCISE_NG_SLIDES_BRIDGE, } from '@/lib/domain/exercise-contracts'
import { haptics } from '@/lib/haptics'
import type { UnlockItem } from '@/stores/notifications-store'
import { onUnlockShown, resetNotifications, setNotificationPresenter, showNotification, } from '@/stores/notifications-store'
import { ACTIONS_MS, END_SONG_MS, END_STEP_MS, HOP_AT_MS, LIGHT_MS, } from './path-motion'
import { pinnedSource } from './path-source'
import { freshDay } from './routine'
import type { WarmUpRoomId } from './warm-up-plan'
import { OWNER_ROUTINE } from './warm-up-plan'
import { enterStop, leavePath, openStop, resetWarmUpForTests, routineStopFor, routineUnlocks, skipNextStop, warmUpDay, warmUpLastMove, } from './warm-up-store'
import { PULSE_MS, WarmUpPath } from './WarmUpPath'

vi.mock('@/lib/haptics', () => ({
  haptics: { tapLight: vi.fn(), tapMedium: vi.fn(), success: vi.fn() },
}))

vi.mock('@/components/room-kit/MercView', () => ({
  MERC_FEET: 0.81,
  MercView: () => {
    const merc = document.createElement('div')
    merc.dataset.testid = 'warm-up-merc'
    return merc
  },
}))

const ROOMS: readonly WarmUpRoomId[] = [
  EXERCISE_LIP_ROLL_BAY,
  EXERCISE_NG_SLIDES_BRIDGE,
  EXERCISE_LONG_NOTE_LANTERN,
  EXERCISE_ECHO_STARS,
]
const LINES = ['86% lit', '92% lit', '12.6 s', '8 of 9 on pitch']

/** A stop sung in its room: opened, then finished with its line. */
function sing(index: number): void {
  const id = ROOMS[index]!
  expect(enterStop(index)).toBe(true)
  routineStopFor(id)!.finish({ id, line: LINES[index]!, settledNote: null })
}

interface Mounted {
  onOpenRoom: ReturnType<typeof vi.fn>
  onPreload: ReturnType<typeof vi.fn>
  onDone: ReturnType<typeof vi.fn>
  onSong: ReturnType<typeof vi.fn>
  onPremium: ReturnType<typeof vi.fn>
  /** Take the path off screen, as the shell does for Back or a room. */
  leave: () => void
}

function mount(source?: Parameters<typeof WarmUpPath>[0]['source']): Mounted {
  const [shown, setShown] = createSignal(true)
  const handlers = {
    onOpenRoom: vi.fn(),
    onPreload: vi.fn(),
    onDone: vi.fn(),
    onSong: vi.fn(),
    onPremium: vi.fn(),
  }
  render(() => (
    <Show when={shown()}>
      <WarmUpPath source={source} {...handlers} />
    </Show>
  ))
  return { ...handlers, leave: () => setShown(false) }
}

const text = (id: string): string | null =>
  screen.queryByTestId(id)?.textContent ?? null
/** Which of the path's two zones, the top or the buttons', holds a test id. */
const zoneOf = (id: string): string | undefined =>
  screen
    .getByTestId(id)
    .closest<HTMLElement>(
      '[data-testid="warm-up-top"], [data-testid="warm-up-bottom"]',
    )?.dataset.testid
const said = (): string | null =>
  document.querySelector('[role="status"][aria-live="polite"]')?.textContent ??
  null

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2026, 9, 19, 9, 0))
  localStorage.clear()
  resetWarmUpForTests()
  resetNotifications()
  setNotificationPresenter('pill')
})

afterEach(() => {
  cleanup()
  resetWarmUpForTests()
  resetNotifications()
  vi.useRealTimers()
})

describe('the first visit', () => {
  it('says the minutes and offers Start, the level pill beside the title', () => {
    mount()
    expect(screen.getByTestId('warm-up-path').dataset.state).toBe('start')
    expect(text('warm-up-chip')).toBe('3 min')
    expect(text('warm-up-start')).toBe('Start warm-up')
    expect(screen.queryByTestId('warm-up-level')).not.toBeNull()
  })

  it('reads the path as an ordered list, bottom stop first', () => {
    mount()
    const list = screen.getByRole('list', { name: 'Warm-up stops' })
    expect(list.tagName).toBe('OL')
    expect(
      [...list.querySelectorAll('li')].map((li) =>
        li.getAttribute('aria-label'),
      ),
    ).toEqual([
      'Lip roll, next',
      'Ng slides, waiting',
      'Long note, waiting',
      'Echo, waiting',
      'Your song, waiting',
    ])
  })

  it('Start loads Lip roll at the tap and opens it after the ring pulses', () => {
    const path = mount()
    fireEvent.click(screen.getByTestId('warm-up-start'))
    expect(path.onPreload).toHaveBeenCalledWith(EXERCISE_LIP_ROLL_BAY)
    expect(path.onOpenRoom).not.toHaveBeenCalled()
    expect(openStop()).toBeNull()
    vi.advanceTimersByTime(PULSE_MS)
    expect(path.onOpenRoom).toHaveBeenCalledWith(EXERCISE_LIP_ROLL_BAY)
    expect(openStop()).toBe(0)
  })

  it('a second tap during the pulse opens nothing more', () => {
    const path = mount()
    fireEvent.click(screen.getByTestId('warm-up-start'))
    fireEvent.click(screen.getByTestId('warm-up-start'))
    vi.advanceTimersByTime(PULSE_MS)
    expect(path.onOpenRoom).toHaveBeenCalledTimes(1)
  })
})

describe('back from a stop', () => {
  beforeEach(() => {
    sing(0)
  })

  it('the stop lights with a tick', () => {
    mount()
    expect(haptics.tapLight).not.toHaveBeenCalled()
    vi.advanceTimersByTime(LIGHT_MS)
    expect(haptics.tapLight).toHaveBeenCalledTimes(1)
    expect(haptics.success).not.toHaveBeenCalled()
  })

  it('raises the card at 0.3 s and says it once, politely', () => {
    mount()
    expect(screen.queryByTestId('warm-up-card')).toBeNull()
    vi.advanceTimersByTime(HOP_AT_MS)
    expect(text('warm-up-card')).toContain('Lip roll: 86% lit')
    expect(said()).toBe('Lip roll: 86% lit')
  })

  it('shows Again, Skip and Next at 2.5 s, then opens Ng slides after five seconds', () => {
    const path = mount()
    vi.advanceTimersByTime(ACTIONS_MS - 1)
    expect(screen.queryByTestId('warm-up-next')).toBeNull()
    vi.advanceTimersByTime(1)
    expect(text('warm-up-again')).toBe('Again')
    expect(screen.getByTestId('warm-up-skip').getAttribute('aria-label')).toBe(
      'Skip Ng slides',
    )
    expect(text('warm-up-next')).toBe('Next: Ng slides')
    expect(screen.queryByTestId('warm-up-countdown')).not.toBeNull()
    expect(said()).toBe(
      'Next: Ng slides in 5 seconds. Choose Stay here to wait.',
    )
    vi.advanceTimersByTime(AUTO_CONTINUE_SECONDS * 1000 + PULSE_MS)
    expect(path.onOpenRoom).toHaveBeenCalledWith(EXERCISE_NG_SLIDES_BRIDGE)
    expect(openStop()).toBe(1)
  })

  it('Stay here stops the countdown, and Next still opens on a tap', () => {
    const path = mount()
    vi.advanceTimersByTime(ACTIONS_MS)
    fireEvent.click(screen.getByTestId('warm-up-stay'))
    expect(screen.queryByTestId('warm-up-countdown')).toBeNull()
    vi.advanceTimersByTime(30_000)
    expect(path.onOpenRoom).not.toHaveBeenCalled()
    fireEvent.click(screen.getByTestId('warm-up-next'))
    vi.advanceTimersByTime(PULSE_MS)
    expect(path.onOpenRoom).toHaveBeenCalledWith(EXERCISE_NG_SLIDES_BRIDGE)
  })

  it('a tap anywhere else on the path stops the countdown', () => {
    const path = mount()
    vi.advanceTimersByTime(ACTIONS_MS)
    fireEvent.pointerDown(screen.getByTestId('warm-up-card'))
    expect(screen.queryByTestId('warm-up-countdown')).toBeNull()
    vi.advanceTimersByTime(30_000)
    expect(path.onOpenRoom).not.toHaveBeenCalled()
  })

  it('Skip skips Ng slides: its card, "Skipped" under it, Next: Long note', () => {
    mount()
    vi.advanceTimersByTime(ACTIONS_MS)
    fireEvent.click(screen.getByTestId('warm-up-skip'))
    vi.advanceTimersByTime(HOP_AT_MS)
    expect(text('warm-up-card')).toBe('Ng slides skipped')
    expect(screen.queryByTestId('warm-up-again')).toBeNull()
    expect(text('warm-up-stop-1')).toContain('Skipped')
    vi.advanceTimersByTime(ACTIONS_MS)
    expect(text('warm-up-next')).toBe('Next: Long note')
  })

  it('Again opens Lip roll once more', () => {
    const path = mount()
    vi.advanceTimersByTime(ACTIONS_MS)
    fireEvent.click(screen.getByTestId('warm-up-again'))
    vi.advanceTimersByTime(PULSE_MS)
    expect(path.onOpenRoom).toHaveBeenCalledWith(EXERCISE_LIP_ROLL_BAY)
    expect(openStop()).toBe(0)
  })
})

describe('coming back the same day', () => {
  it('"1 of 4 today", the result under its name, and Next: Long note', () => {
    sing(0)
    skipNextStop()
    leavePath()
    mount()
    expect(text('warm-up-chip')).toBe('1 of 4 today')
    expect(text('warm-up-stop-0')).toContain('86% lit')
    expect(text('warm-up-stop-1')).toContain('Skipped')
    expect(text('warm-up-next')).toBe('Next: Long note')
    expect(screen.queryByTestId('warm-up-card')).toBeNull()
  })
})

describe('the end', () => {
  beforeEach(() => {
    for (const i of [0, 1, 2, 3]) sing(i)
  })

  it('"Warmed up", "4 of 4 today", every result under its stop', () => {
    mount()
    expect(text('warm-up-title')).toBe('Warmed up')
    expect(screen.queryByTestId('warm-up-week')).toBeNull()
    expect(screen.getByText('4 of 4 today')).not.toBeNull()
    for (const [i, line] of LINES.entries()) {
      expect(text(`warm-up-stop-${i}`)).toContain(line)
    }
    expect(screen.queryByTestId('warm-up-level')).toBeNull()
  })

  it('the song lights with its burst, and Merc lands on it with a success', () => {
    mount()
    expect(screen.queryByTestId('warm-up-burst')).toBeNull()
    vi.advanceTimersByTime(4 * END_STEP_MS + END_SONG_MS)
    expect(screen.queryByTestId('warm-up-burst')).not.toBeNull()
    expect(haptics.success).not.toHaveBeenCalled()
    vi.advanceTimersByTime(HOP_MS)
    expect(haptics.success).toHaveBeenCalledTimes(1)
  })

  it('Done leaves; Sing a song and the song stop open the song list', () => {
    const path = mount()
    fireEvent.click(screen.getByTestId('warm-up-done'))
    expect(path.onDone).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByTestId('warm-up-sing'))
    fireEvent.click(screen.getByTestId('warm-up-song-stop'))
    expect(path.onSong).toHaveBeenCalledTimes(2)
  })

  it('opened again that day: "Warmed up today", and Warm up again starts over', () => {
    leavePath()
    mount()
    expect(text('warm-up-chip')).toBe('Warmed up today')
    // Drawn settled: no burst on the song.
    expect(screen.queryByTestId('warm-up-burst')).toBeNull()
    // This week's dots under the chip: Monday 19 Oct, today, filled.
    expect(zoneOf('warm-up-week')).toBe('warm-up-top')
    expect(screen.getByTestId('warm-up-week').getAttribute('aria-label')).toBe(
      'Warmed up this week: today',
    )
    fireEvent.click(screen.getByTestId('warm-up-again-run'))
    expect(text('warm-up-start')).toBe('Start warm-up')
    expect(warmUpDay().warmedUp).toBe(true)
  })
})

describe('the free run used (N3)', () => {
  it('offers Warm up with Premium, with a padlock', () => {
    const path = mount(
      pinnedSource({
        day: freshDay(OWNER_ROUTINE, '2026-10-19', 0),
        last: null,
        canStart: false,
      }),
    )
    expect(text('warm-up-premium')).toBe('Warm up with Premium')
    expect(
      screen.getByTestId('warm-up-premium').querySelector('svg'),
    ).not.toBeNull()
    expect(screen.queryByTestId('warm-up-start')).toBeNull()
    fireEvent.click(screen.getByTestId('warm-up-premium'))
    expect(path.onPremium).toHaveBeenCalledTimes(1)
  })
})

describe('leaving the path, and what the routine unlocked', () => {
  const STEADY: UnlockItem = {
    kind: 'badge',
    name: 'Steady Hold',
    icon: 'leaf',
  }
  const grant = (item: UnlockItem): void => {
    showNotification(`Unlocked: ${item.name}`, 'success', { unlock: item })
  }

  it('says a badge earned in a stop, with the tap you feel', () => {
    let felt = 0
    const stop = onUnlockShown(() => (felt += 1))
    expect(enterStop(0)).toBe(true)
    grant(STEADY)
    routineStopFor(EXERCISE_LIP_ROLL_BAY)!.finish({
      id: EXERCISE_LIP_ROLL_BAY,
      line: '86% lit',
      settledNote: null,
    })
    mount()
    expect(text('warm-up-unlock-chip')).toBe('New badge: Steady Hold')
    expect(felt).toBe(1)
    stop()
  })

  it('says it at the top between stops, where no chip is', () => {
    sing(0)
    mount()
    grant(STEADY)
    expect(zoneOf('warm-up-unlock-chip')).toBe('warm-up-top')
  })

  it('says it over the buttons at the end, under the titles and Merc', () => {
    for (const i of [0, 1, 2]) sing(i)
    expect(enterStop(3)).toBe(true)
    grant(STEADY)
    routineStopFor(EXERCISE_ECHO_STARS)!.finish({
      id: EXERCISE_ECHO_STARS,
      line: LINES[3]!,
      settledNote: null,
    })
    mount()
    expect(text('warm-up-title')).toBe('Warmed up')
    expect(zoneOf('warm-up-unlock-chip')).toBe('warm-up-bottom')
  })

  it('Back lets go of the card and the unlocks', () => {
    sing(0)
    const path = mount()
    grant(STEADY)
    expect(routineUnlocks()).toEqual([STEADY])
    path.leave()
    expect(warmUpLastMove()).toBeNull()
    expect(routineUnlocks()).toEqual([])
  })

  it("going into a stop's room keeps the unlocks for the way back", () => {
    sing(0)
    const path = mount()
    grant(STEADY)
    vi.advanceTimersByTime(ACTIONS_MS)
    fireEvent.click(screen.getByTestId('warm-up-next'))
    vi.advanceTimersByTime(PULSE_MS)
    path.leave()
    expect(openStop()).toBe(1)
    expect(routineUnlocks()).toEqual([STEADY])
  })
})

describe('a new day', () => {
  it('starts when the app comes back after midnight', () => {
    sing(0)
    leavePath()
    mount()
    expect(text('warm-up-chip')).toBe('1 of 4 today')
    vi.setSystemTime(new Date(2026, 9, 20, 7, 0))
    document.dispatchEvent(new Event('visibilitychange'))
    expect(text('warm-up-chip')).toBe('3 min')
    expect(text('warm-up-start')).toBe('Start warm-up')
  })
})
