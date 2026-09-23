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
})
