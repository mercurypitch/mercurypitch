import { describe, expect, it, vi } from 'vitest'
import { createStudioLongPress, placeStudioMenu, stepStudioMenu, STUDIO_LONG_PRESS_LIFT_MS, } from './context-menu'

const VIEWPORT = { width: 1440, height: 900 }
const MENU = { width: 240, height: 300 }

describe('placeStudioMenu', () => {
  it('opens right of and below the pointer where there is room', () => {
    expect(placeStudioMenu({ x: 400, y: 200 }, MENU, VIEWPORT)).toEqual({
      x: 400,
      y: 200,
    })
  })

  it('opens left of and above the pointer near the far edges', () => {
    expect(placeStudioMenu({ x: 1436, y: 880 }, MENU, VIEWPORT)).toEqual({
      // Left of the pointer, then 8 px clear of the right edge.
      x: 1440 - 240 - 8,
      y: 880 - 300,
    })
  })

  it('stays inside the viewport when neither side has the room', () => {
    const small = { width: 390, height: 320 }
    const placed = placeStudioMenu({ x: 200, y: 160 }, MENU, small)
    expect(placed.x).toBeGreaterThanOrEqual(8)
    expect(placed.x + MENU.width).toBeLessThanOrEqual(390 - 8)
    expect(placed.y).toBeGreaterThanOrEqual(8)
    expect(placed.y + MENU.height).toBeLessThanOrEqual(320 - 8)
  })
})

describe('stepStudioMenu', () => {
  const enabled = [true, false, true, true]

  it('moves down and up past items that cannot be chosen, wrapping round', () => {
    expect(stepStudioMenu(enabled, 0, 'ArrowDown')).toBe(2)
    expect(stepStudioMenu(enabled, 3, 'ArrowDown')).toBe(0)
    expect(stepStudioMenu(enabled, 2, 'ArrowUp')).toBe(0)
    expect(stepStudioMenu(enabled, 0, 'ArrowUp')).toBe(3)
  })

  it('starts from nothing focused at either end', () => {
    expect(stepStudioMenu(enabled, -1, 'ArrowDown')).toBe(0)
    expect(stepStudioMenu(enabled, -1, 'ArrowUp')).toBe(3)
  })

  it('goes to the first and last choosable items on Home and End', () => {
    expect(stepStudioMenu([false, true, true, false], 2, 'Home')).toBe(1)
    expect(stepStudioMenu([false, true, true, false], 1, 'End')).toBe(2)
  })

  it('has nowhere to go when nothing can be chosen', () => {
    expect(stepStudioMenu([false, false], 0, 'ArrowDown')).toBe(-1)
  })
})

describe('createStudioLongPress', () => {
  function rig() {
    const pending: { run: () => void; ms: number }[] = []
    const onPress = vi.fn()
    const press = createStudioLongPress({
      onPress,
      timers: {
        set: (run, ms) => pending.push({ run, ms }) - 1,
        clear: (handle) => {
          pending[handle as number] = { run: () => {}, ms: -1 }
        },
      },
    })
    const elapse = () => pending.splice(0).forEach((timer) => timer.run())
    return { press, onPress, elapse, pending }
  }
  const finger = {
    pointerId: 7,
    pointerType: 'touch',
    clientX: 100,
    clientY: 50,
    target: null,
  }

  it('opens after a finger holds still for half a second, and swallows what follows', () => {
    const { press, onPress, elapse, pending } = rig()
    press.down(finger)
    expect(pending[0].ms).toBe(500)
    expect(press.swallow()).toBe(false)
    press.move({ pointerId: 7, clientX: 106, clientY: 50 })
    elapse()
    expect(onPress).toHaveBeenCalledWith(finger)
    expect(press.swallow()).toBe(true)
    press.reset()
    expect(press.swallow()).toBe(false)
  })

  it('lets a drift, a lift or a mouse go without opening anything', () => {
    const drift = rig()
    drift.press.down(finger)
    drift.press.move({ pointerId: 7, clientX: 109, clientY: 50 })
    drift.elapse()
    expect(drift.onPress).not.toHaveBeenCalled()

    const lift = rig()
    lift.press.down(finger)
    lift.press.end()
    lift.elapse()
    expect(lift.onPress).not.toHaveBeenCalled()

    const mouse = rig()
    mouse.press.down({ ...finger, pointerType: 'mouse' })
    mouse.elapse()
    expect(mouse.onPress).not.toHaveBeenCalled()
    expect(mouse.press.swallow()).toBe(false)
  })

  it('starts each press fresh: the next one is not swallowed for the last', () => {
    const { press, elapse } = rig()
    press.down(finger)
    elapse()
    press.down({ ...finger, pointerType: 'mouse' })
    expect(press.swallow()).toBe(false)
  })

  it("swallows the lift's own click, and nothing after it, where no click came", () => {
    const { press, elapse, pending } = rig()
    press.down(finger)
    elapse()
    press.lift()
    // The click the lift makes comes a task or so later: still swallowed.
    expect(press.swallow()).toBe(true)
    expect(pending.at(-1)?.ms).toBe(STUDIO_LONG_PRESS_LIFT_MS)
    elapse()
    expect(press.swallow()).toBe(false)
  })

  it('lets a lift with no press behind it change nothing', () => {
    const { press, pending } = rig()
    press.down(finger)
    press.lift()
    expect(press.swallow()).toBe(false)
    expect(pending.filter((timer) => timer.ms >= 0)).toHaveLength(0)
  })
})
