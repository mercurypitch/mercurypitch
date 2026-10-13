// ============================================================
// Portrait lock: a phone held upright in a premium room, and only there
// ============================================================

import { createRoot, createSignal } from 'solid-js'
import { afterEach, describe, expect, it } from 'vitest'
import { installPortraitLock } from './portrait-lock'

let dispose: (() => void) | null = null

afterEach(() => {
  dispose?.()
  dispose = null
})

function install(phone: boolean, roomAtStart = false) {
  const [room, setRoom] = createSignal(roomAtStart)
  const holds: boolean[] = []
  createRoot((done) => {
    dispose = done
    installPortraitLock({
      room,
      phone: () => phone,
      hold: (on) => holds.push(on),
    })
  })
  return { setRoom, holds }
}

describe('the portrait lock', () => {
  it('holds a phone upright while the room is open, and lets it turn after', () => {
    const { setRoom, holds } = install(true)
    expect(holds).toEqual([])

    setRoom(true)
    expect(holds).toEqual([true])

    setRoom(false)
    expect(holds).toEqual([true, false])
  })

  it('leaves an iPad or a tablet free to turn', () => {
    const { setRoom, holds } = install(false)

    setRoom(true)
    setRoom(false)

    expect(holds).toEqual([])
  })

  it('lets the phone turn again when the shell goes with the room open', () => {
    const { holds } = install(true, true)
    expect(holds).toEqual([true])

    dispose?.()
    dispose = null

    expect(holds).toEqual([true, false])
  })

  it('asks once per change, never again for the same answer', () => {
    const { setRoom, holds } = install(true)

    setRoom(true)
    setRoom(true)

    expect(holds).toEqual([true])
  })
})
