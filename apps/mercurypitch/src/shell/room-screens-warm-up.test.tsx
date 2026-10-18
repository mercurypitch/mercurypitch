// ============================================================
// The four rooms' screens in the Warm-up: a stop, not the singer's pick
// ============================================================
//
// Opened by the Warm-up's path, each room's screen hands its room the stop
// (warm-up-stop.ts), leaves the last exercise as it was (the Warm-up is
// the singer's pick, not its stop: DESIGN-warm-up.md §14.8) and goes back
// to the path once the stop ends. The rooms are stood in for, each saying
// which stop it was handed.

import type { JSX } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { RoutineStop } from '@/components/room-kit/routine-stop'
import { lastExercise, rememberLastExercise, resetLastExerciseForTests, } from '@/features/premium-exercises/last-exercise'
import { enterStop, resetWarmUpForTests, } from '@/features/warm-up/warm-up-store'
import { EchoScreen } from './EchoScreen'
import { LipRollScreen } from './LipRollScreen'
import { LongNoteScreen } from './LongNoteScreen'
import { NgSlidesScreen } from './NgSlidesScreen'
import type { RenderedShell } from './render-for-test'
import { renderShell } from './render-for-test'
import { pushed, pushScreen, resetRunShell } from './run-shell-store'

const handed = vi.hoisted(() => ({ stop: null as RoutineStop | null }))

/** A room that keeps the stop it was handed, and draws its index. */
const stand = vi.hoisted(
  () =>
    (props: { routine?: RoutineStop }): HTMLElement => {
      // eslint-disable-next-line solid/reactivity -- a room is handed its stop once, at mount (warm-up-stop.ts)
      const stop = props.routine
      handed.stop = stop ?? null
      const room = document.createElement('div')
      room.dataset.testid = 'room'
      room.dataset.stop = String(stop?.index ?? 'none')
      return room
    },
)

vi.mock('@/features/lip-roll/LipRollRoom', () => ({ LipRollRoom: stand }))
vi.mock('@/features/ng-slides/NgSlidesRoom', () => ({ NgSlidesRoom: stand }))
vi.mock('@/features/long-note/LongNoteRoom', () => ({ LongNoteRoom: stand }))
vi.mock('@/features/echo/EchoRoom', () => ({ EchoRoom: stand }))

const SCREENS: readonly [string, number, string, string, () => JSX.Element][] =
  [
    ['Lip roll', 0, 'lip-roll', 'lip-roll-bay', LipRollScreen],
    ['Ng slides', 1, 'ng-slides', 'ng-slides-bridge', NgSlidesScreen],
    ['Long note', 2, 'long-note', 'long-note-lantern', LongNoteScreen],
    ['Echo', 3, 'echo', 'echo-stars', EchoScreen],
  ]

let view: RenderedShell | undefined

beforeEach(() => {
  localStorage.clear()
  resetLastExerciseForTests()
  resetWarmUpForTests()
  resetRunShell()
  handed.stop = null
})

afterEach(() => {
  view?.unmount()
  view = undefined
  resetWarmUpForTests()
  resetRunShell()
})

describe.each(SCREENS)(
  '%s, as a stop of the Warm-up',
  (_, index, screen, id, Screen) => {
    it('hands the room its stop and leaves the Warm-up as the last exercise', () => {
      rememberLastExercise('warm-up-path')
      expect(enterStop(index)).toBe(true)

      view = renderShell(() => <Screen />)

      expect(handed.stop?.index).toBe(index)
      expect(lastExercise()).toBe('warm-up-path')
    })

    it('goes back to the path once the stop is skipped', () => {
      pushScreen('warm-up')
      pushScreen(screen as 'lip-roll')
      expect(enterStop(index)).toBe(true)
      view = renderShell(() => <Screen />)

      handed.stop?.skip()

      expect(pushed()).toBe('warm-up')
    })

    it('opened from the picker, is the room on its own', () => {
      view = renderShell(() => <Screen />)

      expect(handed.stop).toBeNull()
      expect(lastExercise()).toBe(id)
    })
  },
)
