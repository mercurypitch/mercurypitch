import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { holdRoomArrival, roomArrivalHeld } from '@/stores/native-shell-store'
import type { DoorOpenPlan } from './alley-entry'
import { openDoor } from './alley-entry'
import { layoutDoors } from './alley-geometry'
import { ALLEY_PLATE, DOORS } from './alley-plate'

const W = 393
const H = 852
const sing = layoutDoors(ALLEY_PLATE, DOORS, W, H).find((d) => d.key === 'sing')

function plan(over: Partial<DoorOpenPlan> = {}): DoorOpenPlan {
  if (sing === undefined) throw new Error('no Sing door')
  return {
    door: sing,
    width: W,
    height: H,
    reduced: false,
    video: null,
    plateSrc: '/rooms/alley/night-rooms-hero.webp',
    platePosition: ALLEY_PLATE.position,
    roomBackground: '[data-testid="sing-cover"]',
    ambientSilent: Promise.resolve(),
    onCovered: () => undefined,
    holdArrival: holdRoomArrival,
    ...over,
  }
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  document.body.innerHTML = ''
})

describe('the hold on the room', () => {
  it('is let go when building the clone throws', () => {
    const video = document.createElement('video')
    Object.defineProperty(video, 'classList', {
      value: {
        add: () => {
          throw new Error('the clip would not move')
        },
        remove: () => undefined,
      },
    })

    expect(() => openDoor(plan({ video }))).toThrow('the clip would not move')
    expect(roomArrivalHeld()).toBe(false)
    expect(document.querySelector('[data-testid="alley-morph"]')).toBeNull()
  })

  it('stays on until the clone is gone AND the ambient is silent', async () => {
    let silence: () => void = () => undefined
    const ambientSilent = new Promise<void>((resolve) => {
      silence = resolve
    })
    const room = document.createElement('div')
    room.dataset.testid = 'sing-cover'
    room.style.backgroundImage = 'url(/sing/room.webp)'
    document.body.appendChild(room)
    const onCovered = vi.fn()

    const open = openDoor(plan({ ambientSilent, onCovered }))
    expect(roomArrivalHeld()).toBe(true)

    // Covered: the room mounts under the clone, and must not start yet.
    await vi.advanceTimersByTimeAsync(700)
    expect(onCovered).toHaveBeenCalledTimes(1)
    expect(roomArrivalHeld()).toBe(true)

    // The room drew, the clone faded and is gone. The ambient is not silent.
    await vi.advanceTimersByTimeAsync(2000)
    expect(open.clone.isConnected).toBe(false)
    expect(roomArrivalHeld()).toBe(true)

    silence()
    await vi.advanceTimersByTimeAsync(0)
    expect(roomArrivalHeld()).toBe(false)
  })

  it('is let go by the failsafe if the ambient never says it is silent', async () => {
    openDoor(plan({ ambientSilent: new Promise<void>(() => undefined) }))
    await vi.advanceTimersByTimeAsync(3900)
    expect(roomArrivalHeld()).toBe(true)
    await vi.advanceTimersByTimeAsync(200)
    expect(roomArrivalHeld()).toBe(false)
  })
})

describe('an open called off', () => {
  it('lets the hold go, takes the clone away and never covers', async () => {
    const door = document.createElement('div')
    const video = document.createElement('video')
    door.appendChild(video)
    document.body.appendChild(door)
    vi.spyOn(video, 'play').mockResolvedValue(undefined)
    const pause = vi.spyOn(video, 'pause').mockImplementation(() => undefined)
    const onCovered = vi.fn()

    const open = openDoor(plan({ video, onCovered }))
    expect(video.parentElement).toBe(open.clone)
    await vi.advanceTimersByTimeAsync(150)

    expect(open.cancel()).toBe(true)
    expect(roomArrivalHeld()).toBe(false)
    expect(open.clone.isConnected).toBe(false)
    // The clip is back in its door, paused, and still has its source.
    expect(video.parentElement).toBe(door)
    expect(video.classList.contains('mp-alley-morph__clip')).toBe(false)
    expect(pause).toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(5000)
    expect(onCovered).not.toHaveBeenCalled()
    expect(open.cancel()).toBe(false)
  })

  it('cannot be called off once the clone has covered', async () => {
    const open = openDoor(plan())
    await vi.advanceTimersByTimeAsync(700)
    expect(open.cancel()).toBe(false)
    expect(roomArrivalHeld()).toBe(true)
    await vi.advanceTimersByTimeAsync(5000)
    expect(roomArrivalHeld()).toBe(false)
  })
})
