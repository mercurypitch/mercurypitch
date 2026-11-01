// ============================================================
// LeapScreen: the room on the shell's stack, Merc's voice handed in
// ============================================================
//
// The screen records Leap as the last exercise the moment it opens, hands
// the room Merc's sampled voice, and pops itself on Done. The room is
// stood in for; what it does is its own suite's business.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { LeapRoomProps } from '@/features/leap/LeapRoom'
import { resetLastExerciseForTests } from '@/features/premium-exercises/last-exercise'
import { LeapScreen } from './LeapScreen'
import type { RenderedShell } from './render-for-test'
import { renderShell } from './render-for-test'

const room = vi.hoisted(() => ({ props: null as LeapRoomProps | null }))

vi.mock('@/features/leap/LeapRoom', () => ({
  LeapRoom: (props: LeapRoomProps) => {
    // eslint-disable-next-line solid/reactivity -- kept to call its handlers, not to read them reactively
    room.props = props
    const el = document.createElement('div')
    el.dataset.testid = 'leap-room'
    return el
  },
}))

let view: RenderedShell | undefined

beforeEach(() => {
  localStorage.clear()
  resetLastExerciseForTests()
  room.props = null
})

afterEach(() => {
  view?.unmount()
  view = undefined
})

describe('LeapScreen', () => {
  it('records Leap as the last exercise the moment it opens', () => {
    view = renderShell(() => <LeapScreen />)
    expect(localStorage.getItem('mp_last_exercise')).toBe('leap-cliffs')
  })

  it("hands the room Merc's sampled voice and a way out", () => {
    view = renderShell(() => <LeapScreen />)
    expect(room.props?.voice).toBeDefined()
    expect(typeof room.props?.onDone).toBe('function')
  })
})
