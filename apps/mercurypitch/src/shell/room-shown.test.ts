// ============================================================
// A room shown: each moment the shell puts a room on screen
// ============================================================
//
// The output check runs at each of them (output-check.ts): the owner's way
// back from the Developer screen to Karaoke, after button 3, was the moment
// the room started to play on the TV (mp-v0.8.57), and a room left and opened
// again must say where the sound goes then.

import { createSignal } from 'solid-js'
import { describe, expect, it, vi } from 'vitest'
import { onRoomShown } from './room-shown'
import type { RoomVisitStep } from './room-visit'

/** The shell as the test moves it: a tab, a screen pushed over it, a door. */
function shell() {
  const [tab, setTab] = createSignal('karaoke')
  const [pushed, setPushed] = createSignal<string | null>(null)
  let visit: (step: RoomVisitStep) => void = () => undefined
  return {
    options: {
      tab,
      pushed,
      visits: (listener: (step: RoomVisitStep) => void) => {
        visit = listener
        return () => {
          visit = () => undefined
        }
      },
    },
    setTab,
    setPushed,
    door: (moment: RoomVisitStep['moment']) => {
      visit({ room: 'long-note', moment, oneVolume: false, asks: false })
    },
  }
}

describe('onRoomShown', () => {
  it('hears the room on screen at once, and each one the shell shows after it', () => {
    const s = shell()
    const heard = vi.fn()
    const stop = onRoomShown(heard, s.options)
    expect(heard).toHaveBeenCalledTimes(1)

    s.setTab('sing')
    s.setTab('karaoke')

    expect(heard).toHaveBeenCalledTimes(3)
    stop()
  })

  it('hears the way back from a screen pushed over the room, and not the push', () => {
    const s = shell()
    const heard = vi.fn()
    const stop = onRoomShown(heard, s.options)

    s.setPushed('developer')
    expect(heard).toHaveBeenCalledTimes(1)
    s.setPushed(null)

    expect(heard).toHaveBeenCalledTimes(2)
    stop()
  })

  it('hears a premium room’s door on the way in, and not on the way out', () => {
    const s = shell()
    const heard = vi.fn()
    const stop = onRoomShown(heard, s.options)

    s.door('enter')
    s.door('release-hidden')
    s.door('leave')

    expect(heard).toHaveBeenCalledTimes(2)
    stop()
  })

  it('hears nothing more once stopped', () => {
    const s = shell()
    const heard = vi.fn()
    const stop = onRoomShown(heard, s.options)

    stop()
    s.setTab('sing')
    s.door('enter')

    expect(heard).toHaveBeenCalledTimes(1)
  })
})
