// ============================================================
// RoomShell: the page around a room's world, and its parts
// ============================================================

import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import type { Accessor } from 'solid-js'
import { createSignal, Show } from 'solid-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { DemoTakeId } from '@/components/demo-kit/demo-plan'
import { DEMO_WORDS } from '@/components/demo-kit/demo-words'
import type { DemoMode, ExerciseDemo, } from '@/components/demo-kit/useExerciseDemo'
import { EXERCISE_LIP_ROLL_BAY } from '@/lib/domain/exercise-contracts'
import type { RoomShellState, ShellRun } from './RoomShell'
import { createRoomShell, RoomShell, ShellBarEnd, ShellBubble, ShellDock, ShellHead, ShellSkip, } from './RoomShell'
import type { RoutineStop, ShellRoutine, StopResult } from './routine-stop'
import { ROUTINE_RESULT_HOLD_MS, ROUTINE_TAP_GRACE_MS, ROUTINE_WORDS, } from './routine-stop'

/** A room's stylesheet: the classes the parts read. */
const STYLES = {
  said: 'said',
  skip: 'skip',
  bottom: 'bottom',
  bottomAway: 'bottomAway',
  head: 'head',
  chip: 'chip',
  bubble: 'bubble',
}

/** "How it works", as a room's demo hands it over, steered by the test. */
function fakeDemo() {
  const [mode, setMode] = createSignal<DemoMode>('idle')
  const [take, setTake] = createSignal<DemoTakeId | null>(null)
  const [canAsk, setCanAsk] = createSignal(true)
  const calls = { ask: 0, skip: 0 }
  const demo: ExerciseDemo<'cue', 'spot'> = {
    mode,
    take,
    canAsk,
    tip: () => null,
    fast: () => false,
    run: () => null,
    micPulse: () => false,
    said: () => '',
    still: false,
    ask: () => {
      calls.ask += 1
    },
    dismiss: () => undefined,
    skip: () => {
      calls.skip += 1
    },
    tryIt: () => undefined,
  }
  return { demo, setMode, setTake, setCanAsk, calls }
}

/** A room's run as the shell reads it, counting what the shell asks of it. */
function fakeRun(phase: Accessor<string>, scripted: Accessor<boolean>) {
  const calls = { start: 0, stop: 0 }
  const run: ShellRun = {
    state: () => ({
      phase: phase(),
      block: phase() === 'blocked' ? 'denied' : null,
    }),
    start: () => {
      calls.start += 1
    },
    stop: () => {
      calls.stop += 1
    },
    micLevel: () => 0,
    script: { active: scripted },
  }
  return { run, calls }
}

function shellFor(
  phase: Accessor<string>,
  demo: ExerciseDemo<'cue', 'spot'> | null,
  scripted: Accessor<boolean> = () => false,
): RoomShellState<'cue', 'spot'> {
  const { run } = fakeRun(phase, scripted)
  return createRoomShell({ ids: 'room', styles: STYLES, run, demo })
}

afterEach(() => {
  cleanup()
  document.body.replaceChildren()
})

describe('createRoomShell', () => {
  it('reads no demo as idle, the room free and no take on the pill', () => {
    const shell = shellFor(() => 'intro', null)

    expect([shell.mode(), shell.busy(), shell.take()]).toEqual([
      'idle',
      false,
      null,
    ])
  })

  it("reads the room's phase and the demo's script off its run", () => {
    let phase = 'intro'
    let scripted = false
    const shell = shellFor(
      () => phase,
      null,
      () => scripted,
    )

    expect([shell.phase(), shell.scripted()]).toEqual(['intro', false])
    phase = 'result'
    scripted = true
    expect([shell.phase(), shell.scripted()]).toEqual(['result', true])
  })

  it("reads the demo: the room is its whenever it is not idle, and the pill's take", () => {
    const fake = fakeDemo()
    const shell = shellFor(() => 'intro', fake.demo)

    fake.setMode('card')
    expect(shell.busy()).toBe(true)
    fake.setMode('idle')
    expect(shell.busy()).toBe(false)
    fake.setTake('off')
    expect(shell.take()).toBe('off')
  })
})

describe('RoomShell', () => {
  it("puts the room's classes, phase and demo mode on its root, and speaks from one polite region", () => {
    const [phase, setPhase] = createSignal('intro')
    render(() => (
      <RoomShell
        shell={shellFor(phase, null)}
        class="room surface"
        classList={{ still: true }}
        testId="room-root"
        said="Hold G3"
        aim={() => null}
      >
        <p>The world</p>
      </RoomShell>
    ))

    const root = screen.getByTestId('room-root')
    expect(root.className).toBe('room surface still')
    expect([root.dataset.phase, root.dataset.demo]).toEqual(['intro', 'idle'])
    const said = screen.getByTestId('room-said')
    expect(said.getAttribute('aria-live')).toBe('polite')
    expect(said.className).toBe('said')
    expect(said.textContent).toBe('Hold G3')
    expect(screen.queryByTestId('room-demo')).toBeNull()
    setPhase('result')
    expect(root.dataset.phase).toBe('result')
  })

  it("lays the demo's layer over everything when the room has a demo", () => {
    const fake = fakeDemo()
    render(() => (
      <RoomShell
        shell={shellFor(() => 'intro', fake.demo)}
        class="room"
        testId="room-root"
        said=""
        aim={() => null}
      >
        <p>The world</p>
      </RoomShell>
    ))

    const root = screen.getByTestId('room-root')
    expect(root.lastElementChild?.getAttribute('data-testid')).toBe('room-demo')
    fake.setMode('playing')
    expect(root.dataset.demo).toBe('playing')
  })

  it('hands focus to Again when the result takes the focused mic away', () => {
    const [phase, setPhase] = createSignal('intro')
    render(() => (
      <RoomShell
        shell={shellFor(phase, null)}
        class="room"
        testId="room-root"
        said=""
        aim={() => null}
      >
        <Show
          when={phase() === 'result'}
          fallback={
            <button type="button" data-testid="room-mic">
              Mic
            </button>
          }
        >
          <button type="button" data-testid="room-again">
            Again
          </button>
        </Show>
      </RoomShell>
    ))

    screen.getByTestId('room-mic').focus()
    setPhase('result')

    expect(document.activeElement).toBe(screen.getByTestId('room-again'))
  })
})

describe('ShellHead', () => {
  it("shows the take's chip, and none while the demo's pill speaks", () => {
    const fake = fakeDemo()
    render(() => (
      <ShellHead
        shell={shellFor(() => 'run', fake.demo)}
        summary={() => null}
        chip="Wave 2 of 3"
      >
        {() => <p>The result</p>}
      </ShellHead>
    ))

    expect(screen.getByTestId('room-chip').textContent).toBe('Wave 2 of 3')
    fake.setTake('on')
    expect(screen.queryByTestId('room-chip')).toBeNull()
  })

  it('draws the result at a result, and keeps the unlock chip mounted all along', () => {
    const [phase, setPhase] = createSignal('intro')
    render(() => (
      <ShellHead
        shell={shellFor(phase, null)}
        summary={() => ({ pct: 88 })}
        chip={null}
      >
        {(summary) => <p data-testid="room-result">{summary().pct}%</p>}
      </ShellHead>
    ))

    const unlock = screen.getByTestId('room-unlock')
    expect(screen.getByTestId('room-header').className).toBe('head')
    expect(screen.queryByTestId('room-result')).toBeNull()
    setPhase('result')
    expect(screen.getByTestId('room-result').textContent).toBe('88%')
    expect(screen.getByTestId('room-unlock')).toBe(unlock)
  })

  it('is out of reach while the demo has the room', () => {
    const fake = fakeDemo()
    render(() => (
      <ShellHead
        shell={shellFor(() => 'intro', fake.demo)}
        summary={() => null}
        chip={null}
      >
        {() => <p>The result</p>}
      </ShellHead>
    ))

    const head = screen.getByTestId('room-header')
    expect(head.inert).toBe(false)
    fake.setMode('playing')
    expect(head.inert).toBe(true)
  })
})

describe('ShellBarEnd', () => {
  it('shows the level when the room asks, and "?" while the demo allows it', () => {
    const fake = fakeDemo()
    const [showLevel, setShowLevel] = createSignal(false)
    render(() => (
      <ShellBarEnd
        shell={shellFor(() => 'intro', fake.demo)}
        showLevel={showLevel()}
        level={<span data-testid="room-level">Level</span>}
      />
    ))

    expect(screen.queryByTestId('room-level')).toBeNull()
    setShowLevel(true)
    expect(screen.getByTestId('room-level').textContent).toBe('Level')
    const ask = screen.getByTestId('room-ask')
    expect(ask.getAttribute('aria-label')).toBe(DEMO_WORDS.ask)
    fireEvent.click(ask)
    expect(fake.calls.ask).toBe(1)
    fake.setCanAsk(false)
    expect(screen.queryByTestId('room-ask')).toBeNull()
  })
})

describe('ShellSkip', () => {
  it('offers Skip only while the demo plays', () => {
    const fake = fakeDemo()
    render(() => <ShellSkip shell={shellFor(() => 'intro', fake.demo)} />)

    expect(screen.queryByTestId('room-demo-skip')).toBeNull()
    fake.setMode('playing')
    const skip = screen.getByTestId('room-demo-skip')
    expect([skip.textContent, skip.className]).toEqual([
      DEMO_WORDS.skip,
      'skip',
    ])
    fireEvent.click(skip)
    expect(fake.calls.skip).toBe(1)
  })
})

describe('ShellBubble', () => {
  it("places Merc's line where the room says, in the room's own class at a result", () => {
    const [phase, setPhase] = createSignal('intro')
    const [show, setShow] = createSignal(true)
    render(() => (
      <ShellBubble
        shell={shellFor(phase, null)}
        show={show()}
        line="Easy does it"
        bottom={120}
        atResult="bubbleResult"
      />
    ))

    const line = screen.getByTestId('room-bubble')
    const box = line.parentElement
    expect(line.textContent).toBe('Easy does it')
    expect([box?.className, box?.style.bottom]).toEqual(['bubble', '120px'])
    setPhase('result')
    expect(box?.className).toBe('bubble bubbleResult')
    setShow(false)
    expect(screen.queryByTestId('room-bubble')).toBeNull()
  })
})

describe('ShellDock', () => {
  function renderDock(
    phase: Accessor<string>,
    demo: ExerciseDemo<'cue', 'spot'> | null,
    scripted: Accessor<boolean> = () => false,
    own: { onAgain?: () => void; onMic?: () => void } = {},
  ) {
    const { run, calls } = fakeRun(phase, scripted)
    const done = { count: 0 }
    render(() => (
      <ShellDock
        shell={createRoomShell({ ids: 'room', styles: STYLES, run, demo })}
        onAgain={own.onAgain}
        onDone={() => (done.count += 1)}
        mic="ready"
        micLabel="Start: hold G3"
        onMic={own.onMic}
        still
        besideResult={
          <button type="button" data-testid="room-other">
            Pick another note
          </button>
        }
        overMic={<div data-testid="room-picker">G3</div>}
      />
    ))
    return { calls, done }
  }

  it('stands the mic under what the room puts over it; at rest its tap starts a take', () => {
    const { calls } = renderDock(() => 'intro', null)

    const mic = screen.getByTestId('room-mic')
    expect(mic.getAttribute('aria-label')).toBe('Start: hold G3')
    const picker = screen.getByTestId('room-picker')
    expect(
      picker.compareDocumentPosition(mic) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
    fireEvent.click(mic)
    expect([calls.start, calls.stop]).toEqual([1, 0])
    expect(screen.queryByTestId('room-again')).toBeNull()
  })

  it("ends the take on a tap mid-take, or does the room's own tap", () => {
    const { calls } = renderDock(() => 'listen', null)
    fireEvent.click(screen.getByTestId('room-mic'))
    expect([calls.start, calls.stop]).toEqual([0, 1])
    cleanup()

    let own = 0
    const second = renderDock(
      () => 'listen',
      null,
      () => false,
      {
        onMic: () => (own += 1),
      },
    )
    fireEvent.click(screen.getByTestId('room-mic'))
    expect([own, second.calls.start, second.calls.stop]).toEqual([1, 0, 0])
  })

  it("puts the demo's take pill over the mic while its takes sing", () => {
    const fake = fakeDemo()
    renderDock(
      () => 'listen',
      fake.demo,
      () => true,
    )

    fake.setTake('off')
    expect(screen.getByTestId('room-demo-take').textContent).toBe(
      DEMO_WORDS.off,
    )
  })

  it("offers Again (a new take), Done and the room's own button at a take's result", () => {
    const { calls, done } = renderDock(() => 'result', null)

    fireEvent.click(screen.getByTestId('room-again'))
    fireEvent.click(screen.getByTestId('room-done'))
    expect([calls.start, done.count]).toEqual([1, 1])
    expect(screen.getByTestId('room-other').textContent).toBe(
      'Pick another note',
    )
    expect(screen.queryByTestId('room-mic')).toBeNull()
  })

  it("does the room's own Again when it has one", () => {
    let again = 0
    const { calls } = renderDock(
      () => 'result',
      null,
      () => false,
      {
        onAgain: () => (again += 1),
      },
    )

    fireEvent.click(screen.getByTestId('room-again'))
    expect([again, calls.start]).toEqual([1, 0])
  })

  it("keeps the mic at a result the demo's script is singing", () => {
    renderDock(
      () => 'result',
      null,
      () => true,
    )

    expect(screen.getByTestId('room-mic').getAttribute('aria-label')).toBe(
      'Start: hold G3',
    )
    expect(screen.queryByTestId('room-again')).toBeNull()
  })

  it("shows the run's reason the mic is blocked, and Try again starts a take", () => {
    const { calls } = renderDock(() => 'blocked', null)

    expect(screen.getByRole('alert').textContent).toContain(
      'Allow it in Settings',
    )
    fireEvent.click(screen.getByTestId('room-retry'))
    expect(calls.start).toBe(1)
  })

  it("keeps its place unseen under the demo's cards, out of reach while the demo runs", () => {
    const fake = fakeDemo()
    renderDock(() => 'intro', fake.demo)

    const dock = screen.getByTestId('room-mic').closest('.bottom')
    expect(dock).toBeInstanceOf(HTMLElement)
    const el = dock as HTMLElement
    expect([el.className, el.inert]).toEqual(['bottom', false])
    fake.setMode('card')
    expect([el.className, el.inert]).toEqual(['bottom bottomAway', true])
    fake.setMode('playing')
    expect([el.className, el.inert]).toEqual(['bottom', true])
  })
})

describe('warm-up mode', () => {
  const RESULT: StopResult = {
    id: EXERCISE_LIP_ROLL_BAY,
    line: '86% lit',
    settledNote: 50,
  }
  const SETTLE_MS = 1200

  /** The second stop of four, counting what the room asks of it. */
  function fakeStop() {
    const calls = { finish: [] as StopResult[], skip: 0 }
    const stop: RoutineStop = {
      index: 1,
      count: 4,
      settledNote: null,
      finish: (result) => calls.finish.push(result),
      skip: () => {
        calls.skip += 1
      },
    }
    const routine: ShellRoutine = {
      stop,
      settleMs: SETTLE_MS,
      result: () => RESULT,
    }
    return { routine, calls }
  }

  function createRoutineShell(
    phase: Accessor<string>,
    demo: ExerciseDemo<'cue', 'spot'> | null,
    routine: ShellRoutine,
    scripted: Accessor<boolean> = () => false,
  ): RoomShellState<'cue', 'spot'> {
    const { run } = fakeRun(phase, scripted)
    return createRoomShell({ ids: 'room', styles: STYLES, run, demo, routine })
  }

  afterEach(() => {
    vi.useRealTimers()
  })

  it('reads the chip "Warm-up 2 of 4" before the take only, and none outside the Warm-up', () => {
    const [phase, setPhase] = createSignal('intro')
    const [scripted, setScripted] = createSignal(false)
    const shell = createRoutineShell(phase, null, fakeStop().routine, scripted)

    const chips = [
      'intro',
      'starting',
      'blocked',
      'settle',
      'run',
      'result',
    ].map((each) => {
      setPhase(each)
      return shell.routineChip()
    })
    expect(chips).toEqual([
      'Warm-up 2 of 4',
      'Warm-up 2 of 4',
      'Warm-up 2 of 4',
      null,
      null,
      null,
    ])
    setPhase('intro')
    setScripted(true)
    expect(shell.routineChip()).toBeNull()
    expect(shellFor(() => 'intro', null).routineChip()).toBeNull()
  })

  it("shows its chip in the room's place before the take, and the room's own during it", () => {
    const [phase, setPhase] = createSignal('intro')
    render(() => (
      <ShellHead
        shell={createRoutineShell(phase, null, fakeStop().routine)}
        summary={() => null}
        chip={phase() === 'run' ? 'Wave 2 of 3' : null}
      >
        {() => <p>The result</p>}
      </ShellHead>
    ))

    expect(screen.getByTestId('room-chip').textContent).toBe('Warm-up 2 of 4')
    setPhase('run')
    expect(screen.getByTestId('room-chip').textContent).toBe('Wave 2 of 3')
  })

  it('puts "Skip stop" in the level\'s place before the take, and keeps "?" there', () => {
    const fake = fakeDemo()
    const stop = fakeStop()
    const [phase, setPhase] = createSignal('intro')
    render(() => (
      <ShellBarEnd
        shell={createRoutineShell(phase, fake.demo, stop.routine)}
        showLevel
        level={<span data-testid="room-level">Level</span>}
      />
    ))

    expect(screen.queryByTestId('room-level')).toBeNull()
    const skip = screen.getByTestId('room-skip-stop')
    expect(skip.textContent).toBe(ROUTINE_WORDS.skip)
    fireEvent.click(skip)
    expect(stop.calls.skip).toBe(1)
    fireEvent.click(screen.getByTestId('room-ask'))
    expect(fake.calls.ask).toBe(1)

    setPhase('blocked')
    expect(screen.queryByTestId('room-skip-stop')).not.toBeNull()
    for (const each of ['starting', 'settle', 'run', 'result']) {
      setPhase(each)
      expect(screen.queryByTestId('room-skip-stop')).toBeNull()
    }
    // "?" goes at the held result: the routine takes the room on from there.
    expect(screen.queryByTestId('room-ask')).toBeNull()

    setPhase('intro')
    fake.setMode('playing')
    expect(screen.queryByTestId('room-skip-stop')).toBeNull()
    fake.setMode('card')
    expect(screen.queryByTestId('room-skip-stop')).toBeNull()
  })

  it('drops Again and Done at the result, and keeps the mic before it', () => {
    const [phase, setPhase] = createSignal('intro')
    render(() => (
      <ShellDock
        shell={createRoutineShell(phase, null, fakeStop().routine)}
        onDone={() => undefined}
        mic="ready"
        micLabel="Start: hold G3"
        besideResult={
          <button type="button" data-testid="room-other">
            Pick another note
          </button>
        }
      />
    ))

    expect(screen.getByTestId('room-mic')).not.toBeNull()
    setPhase('result')
    expect(screen.queryByTestId('room-again')).toBeNull()
    expect(screen.queryByTestId('room-done')).toBeNull()
    expect(screen.queryByTestId('room-other')).toBeNull()
    expect(screen.queryByTestId('room-mic')).toBeNull()
  })

  /** The room at its intro; the setter moves it on. */
  function renderRoom(routine: ShellRoutine): (phase: string) => void {
    const [phase, setPhase] = createSignal('intro')
    render(() => (
      <RoomShell
        shell={createRoutineShell(phase, null, routine)}
        class="room"
        testId="room-root"
        said=""
        aim={() => null}
      >
        <Show
          when={phase() === 'result'}
          fallback={
            <button type="button" data-testid="room-mic">
              Mic
            </button>
          }
        >
          <p>86%</p>
        </Show>
      </RoomShell>
    ))
    return setPhase
  }

  it('holds the result, then hands it to the routine once', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] })
    const stop = fakeStop()
    const setPhase = renderRoom(stop.routine)

    expect(screen.queryByTestId('room-routine-on')).toBeNull()
    setPhase('result')
    vi.advanceTimersByTime(SETTLE_MS + ROUTINE_RESULT_HOLD_MS - 1)
    expect(stop.calls.finish).toEqual([])
    vi.advanceTimersByTime(1)
    expect(stop.calls.finish).toEqual([RESULT])
    fireEvent.click(screen.getByTestId('room-routine-on'))
    expect(stop.calls.finish).toEqual([RESULT])
  })

  it('goes on sooner at a tap anywhere on the result, and hands focus to it', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] })
    const stop = fakeStop()
    const setPhase = renderRoom(stop.routine)

    screen.getByTestId('room-mic').focus()
    setPhase('result')
    const onward = screen.getByTestId('room-routine-on')
    expect(onward.getAttribute('aria-label')).toBe(ROUTINE_WORDS.onward)
    expect(document.activeElement).toBe(onward)
    fireEvent.click(onward)
    expect(stop.calls.finish).toEqual([])
    vi.advanceTimersByTime(ROUTINE_TAP_GRACE_MS)
    fireEvent.click(onward)
    expect(stop.calls.finish).toEqual([RESULT])
  })

  it('holds nothing outside the Warm-up', () => {
    const [phase, setPhase] = createSignal('intro')
    render(() => (
      <RoomShell
        shell={shellFor(phase, null)}
        class="room"
        testId="room-root"
        said=""
        aim={() => null}
      >
        <p>The world</p>
      </RoomShell>
    ))

    setPhase('result')
    expect(screen.queryByTestId('room-routine-on')).toBeNull()
  })
})
