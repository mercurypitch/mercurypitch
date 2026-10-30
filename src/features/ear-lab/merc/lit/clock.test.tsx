// The stage clock: it runs while a question is on, and a screen put away
// and brought back finds it running again, not frozen where it stopped.

import { cleanup, render } from '@solidjs/testing-library'
import type { JSX } from 'solid-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { RoomState } from '../room-context'
import { RoomContext } from '../room-context'
import { useStageClock } from './clock'

const loop = vi.hoisted(() => ({ start: vi.fn(), stop: vi.fn() }))
vi.mock('@/components/room-kit/frame-loop', () => ({
  createFrameLoop: () => loop,
}))

afterEach(() => {
  cleanup()
  loop.start.mockClear()
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => 'visible',
  })
})

const room = (beat: RoomState['beat']): RoomState => ({
  beat,
  verdict: () => null,
  sounding: () => false,
  running: () => true,
  ritual: () => false,
  askCalibration: (begin) => begin(),
  offerAnswerMode: () => undefined,
  tapped: () => undefined,
})

function Clocked(): JSX.Element {
  useStageClock()
  return null
}

function show(state: 'hidden' | 'visible'): void {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => state,
  })
  document.dispatchEvent(new Event('visibilitychange'))
}

describe('the stage clock', () => {
  it('runs again when the screen comes back during a question', () => {
    render(() => (
      <RoomContext.Provider value={room(() => 'answer')}>
        <Clocked />
      </RoomContext.Provider>
    ))
    const started = loop.start.mock.calls.length
    expect(started).toBeGreaterThan(0)
    show('hidden')
    expect(loop.start.mock.calls.length).toBe(started)
    show('visible')
    expect(loop.start.mock.calls.length).toBe(started + 1)
  })

  it('stays still between questions, the screen back or not', () => {
    render(() => (
      <RoomContext.Provider value={room(() => 'idle')}>
        <Clocked />
      </RoomContext.Provider>
    ))
    show('hidden')
    show('visible')
    expect(loop.start).not.toHaveBeenCalled()
  })
})
