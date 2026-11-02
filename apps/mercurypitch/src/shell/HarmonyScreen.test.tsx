// ============================================================
// HarmonyScreen: the room on the shell's stack, Merc's voice handed in
// ============================================================
//
// The screen records Harmony as the last exercise the moment it opens,
// hands the room Merc's sampled voice, and pops itself on Done. The room
// is stood in for; what it does is its own suite's business.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MERC_CALL } from '@/features/echo/merc-sampler'
import type { HarmonyRoomProps } from '@/features/harmony/HarmonyRoom'
import { resetLastExerciseForTests } from '@/features/premium-exercises/last-exercise'
import { HarmonyScreen } from './HarmonyScreen'
import type { RenderedShell } from './render-for-test'
import { renderShell } from './render-for-test'

const room = vi.hoisted(() => ({ props: null as HarmonyRoomProps | null }))
const shell = vi.hoisted(() => ({ pops: 0 }))

vi.mock('@/features/harmony/HarmonyRoom', () => ({
  HarmonyRoom: (props: HarmonyRoomProps) => {
    // eslint-disable-next-line solid/reactivity -- kept to call its handlers, not to read them reactively
    room.props = props
    const el = document.createElement('div')
    el.dataset.testid = 'harmony-room'
    return el
  },
}))

vi.mock('./run-shell-store', async (importActual) => ({
  ...(await importActual<Record<string, unknown>>()),
  popScreen: () => {
    shell.pops += 1
  },
}))

let view: RenderedShell | undefined

beforeEach(() => {
  localStorage.clear()
  resetLastExerciseForTests()
  room.props = null
  shell.pops = 0
})

afterEach(() => {
  view?.unmount()
  view = undefined
})

describe('HarmonyScreen', () => {
  it('records Harmony as the last exercise the moment it opens', () => {
    view = renderShell(() => <HarmonyScreen />)
    expect(localStorage.getItem('mp_last_exercise')).toBe('harmony-lake')
  })

  it("hands the room Merc's sampled voice, and Done pops the screen", () => {
    view = renderShell(() => <HarmonyScreen />)
    expect(room.props?.voice).toBe(MERC_CALL)
    room.props?.onDone()
    expect(shell.pops).toBe(1)
  })
})
