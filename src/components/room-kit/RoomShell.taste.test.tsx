// The dock asks the premium rooms' free taste before each new run
// (free-taste-store.ts holdAnotherRun): its Again and its Start at rest
// start nothing while the taste holds the run back, a stop goes through
// whatever the taste says, and so does a Warm-up stop's room.

import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import type { Accessor } from 'solid-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ShellRun } from './RoomShell'
import { createRoomShell, ShellDock } from './RoomShell'

const taste = vi.hoisted(() => ({ hold: false, asked: 0 }))

vi.mock('@/stores/free-taste-store', () => ({
  holdAnotherRun: () => {
    taste.asked += 1
    return taste.hold
  },
}))

const STYLES = {
  said: 'said',
  skip: 'skip',
  bottom: 'bottom',
  bottomAway: 'bottomAway',
  head: 'head',
  chip: 'chip',
  bubble: 'bubble',
}

function renderDock(phase: Accessor<string>, onAgain?: () => void) {
  const calls = { start: 0, stop: 0 }
  const run: ShellRun = {
    state: () => ({ phase: phase(), block: null }),
    start: () => {
      calls.start += 1
    },
    stop: () => {
      calls.stop += 1
    },
    micLevel: () => 0,
    script: { active: () => false },
  }
  render(() => (
    <ShellDock
      shell={createRoomShell({ ids: 'room', styles: STYLES, run, demo: null })}
      onAgain={onAgain}
      onDone={() => undefined}
      mic="ready"
      micLabel="Start"
      still
    />
  ))
  return calls
}

afterEach(() => {
  cleanup()
  taste.hold = false
  taste.asked = 0
})

describe('the dock and the free taste', () => {
  it('starts a run at rest while the taste allows it', () => {
    const calls = renderDock(() => 'intro')
    fireEvent.click(screen.getByTestId('room-mic'))
    expect([calls.start, taste.asked]).toEqual([1, 1])
  })

  it('starts nothing at rest once the taste holds the run back', () => {
    taste.hold = true
    const calls = renderDock(() => 'intro')
    fireEvent.click(screen.getByTestId('room-mic'))
    expect(calls.start).toBe(0)
  })

  it("holds back Again, the room's own included", () => {
    taste.hold = true
    let again = 0
    const calls = renderDock(
      () => 'result',
      () => (again += 1),
    )
    fireEvent.click(screen.getByTestId('room-again'))
    expect([again, calls.start]).toEqual([0, 0])
  })

  it('lets a stop through whatever the taste says', () => {
    taste.hold = true
    const calls = renderDock(() => 'singing')
    fireEvent.click(screen.getByTestId('room-mic'))
    expect([calls.stop, taste.asked]).toEqual([1, 0])
  })
})
