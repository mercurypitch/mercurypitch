import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { holdRoomArrival, roomArrivalHeld } from '@/stores/native-shell-store'
import type { DoorOpenPlan } from './alley-entry'
import { openDoor } from './alley-entry'
import { layoutDoors } from './alley-geometry'
import { ALLEY_PLATE, DOORS } from './alley-plate'

const W = 393
const H = 852
const sing = layoutDoors(ALLEY_PLATE, DOORS, W, H).find((d) => d.key === 'sing')

// The hold is a module-level count. Every hold a case takes is let go after
// it, so a case that leaks one (a regression in the release) fails alone
// instead of failing every case after it too.
const releases: Array<() => void> = []

function held(): () => void {
  const release = holdRoomArrival()
  releases.push(release)
  return release
}

function plan(over: Partial<DoorOpenPlan> = {}): DoorOpenPlan {
  if (sing === undefined) throw new Error('no Sing door')
  return {
    door: sing,
    width: W,
    height: H,
    reduced: false,
    video: null,
    plateSrc: '/rooms/alley/night-rooms-hero.webp',
    plateBox: { x: -126, y: 0, w: 568, h: 852 },
    ambientSilent: Promise.resolve(),
    onCovered: () => undefined,
    away: () => false,
    holdArrival: held,
    ...over,
  }
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  for (const release of releases.splice(0)) release()
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
    vi.spyOn(video, 'pause').mockImplementation(() => undefined)
    vi.spyOn(video, 'load').mockImplementation(() => undefined)

    expect(() => openDoor(plan({ video }))).toThrow('the clip would not move')
    expect(roomArrivalHeld()).toBe(false)
    expect(document.querySelector('[data-testid="alley-morph"]')).toBeNull()
  })

  it('leaves the clip unmarked when the clone throws half-built', () => {
    const door = document.createElement('div')
    const video = document.createElement('video')
    door.appendChild(video)
    document.body.appendChild(door)
    vi.spyOn(video, 'pause').mockImplementation(() => undefined)
    // Marked for the clone, then the next step throws.
    Object.defineProperty(video, 'muted', {
      set: () => {
        throw new Error('the clip would not mute')
      },
    })

    expect(() => openDoor(plan({ video }))).toThrow('the clip would not mute')
    expect(roomArrivalHeld()).toBe(false)
    expect(video.parentElement).toBe(door)
    expect(video.classList.contains('mp-alley-morph__clip')).toBe(false)
  })

  it('is let go, and the clip goes home, when a throw comes after the clip moved', () => {
    const door = document.createElement('div')
    const video = document.createElement('video')
    door.appendChild(video)
    document.body.appendChild(door)
    vi.spyOn(video, 'pause').mockImplementation(() => undefined)
    vi.spyOn(document.body, 'appendChild').mockImplementationOnce(() => {
      throw new Error('the clone would not go up')
    })

    expect(() => openDoor(plan({ video }))).toThrow('the clone would not go up')
    expect(roomArrivalHeld()).toBe(false)
    expect(video.parentElement).toBe(door)
    expect(video.classList.contains('mp-alley-morph__clip')).toBe(false)
  })

  it('stays on until the clone is gone AND the ambient is silent', async () => {
    let silence: () => void = () => undefined
    const ambientSilent = new Promise<void>((resolve) => {
      silence = resolve
    })
    const room = document.createElement('div')
    room.dataset.roomBackground = ''
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

describe("the wait on the room's background", () => {
  // The contract is `data-room-background`, on the element the room draws its
  // picture on: nothing else is read.
  afterEach(() => {
    delete (HTMLImageElement.prototype as Partial<HTMLImageElement>).decode
  })

  it('reveals as soon as the marked picture decodes', async () => {
    let decoded: () => void = () => undefined
    Object.defineProperty(HTMLImageElement.prototype, 'decode', {
      value: () =>
        new Promise<void>((resolve) => {
          decoded = resolve
        }),
      configurable: true,
    })
    const room = document.createElement('div')
    room.dataset.roomBackground = ''
    room.style.backgroundImage = 'url(/sing/room.webp)'
    document.body.appendChild(room)
    const open = openDoor(plan())
    await vi.advanceTimersByTimeAsync(700)
    expect(open.clone.dataset.phase).toBe('covered')

    decoded()
    await vi.advanceTimersByTimeAsync(300)
    expect(open.clone.isConnected).toBe(false)
  })

  it('waits the whole deadline for a room that marks nothing', async () => {
    // A room with its own test id and no attribute is not waited on as drawn.
    const room = document.createElement('div')
    room.dataset.testid = 'sing-cover'
    room.style.backgroundImage = 'url(/sing/room.webp)'
    document.body.appendChild(room)
    const open = openDoor(plan())
    await vi.advanceTimersByTimeAsync(700)

    // Covered at about 420 ms; ROOM_WAIT_MS runs out 1500 ms after that.
    await vi.advanceTimersByTimeAsync(1100)
    expect(open.clone.dataset.phase).toBe('covered')
    // Past ROOM_WAIT_MS from the cover, plus the fade.
    await vi.advanceTimersByTimeAsync(600)
    expect(open.clone.isConnected).toBe(false)
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

describe('somewhere else, once the clone has covered', () => {
  // Covered, the open cannot be called off: the room is being mounted. A rail
  // tab, More or Back in the wait for the room's background left the new
  // surface under an opaque clone until the deadline and the fade, 1.7 s.
  it('the clone is gone within 120 ms of the user going elsewhere', async () => {
    let elsewhere = false
    const open = openDoor(plan({ away: () => elsewhere }))
    await vi.advanceTimersByTimeAsync(700)
    expect(open.clone.dataset.phase).toBe('covered')

    elsewhere = true
    await vi.advanceTimersByTimeAsync(120)
    expect(open.clone.isConnected).toBe(false)
  })

  it('the clone is gone within 120 ms of the room unmounting', async () => {
    // A room that mounted but has not drawn its background yet.
    const room = document.createElement('div')
    room.dataset.roomBackground = ''
    document.body.appendChild(room)
    const open = openDoor(plan())
    await vi.advanceTimersByTimeAsync(700)
    expect(open.clone.dataset.phase).toBe('covered')

    room.remove()
    await vi.advanceTimersByTimeAsync(120)
    expect(open.clone.isConnected).toBe(false)
  })

  it('a room that stays waits out its background as before', async () => {
    const open = openDoor(plan())
    await vi.advanceTimersByTimeAsync(700)
    await vi.advanceTimersByTimeAsync(1000)
    expect(open.clone.isConnected).toBe(true)
  })
})

describe('reduced motion', () => {
  // A crossfade, and it has to run. As a CSS transition it never did: set in
  // the frame the clone was appended it had nothing to start from, and
  // app.css's reduced-motion rule cuts every transition to 0.001 ms anyway.
  // A Web Animation is touched by neither.
  afterEach(() => {
    delete (HTMLElement.prototype as Partial<HTMLElement>).animate
  })

  it('fades the clone in over 120 ms as a Web Animation, from the append', () => {
    const animate = vi.fn()
    Object.defineProperty(HTMLElement.prototype, 'animate', {
      value: animate,
      configurable: true,
    })

    const open = openDoor(plan({ reduced: true }))

    expect(animate).toHaveBeenCalledTimes(1)
    expect(animate.mock.contexts[0]).toBe(open.clone)
    expect(animate.mock.calls[0]).toEqual([
      [{ opacity: 0 }, { opacity: 1 }],
      { duration: 120, easing: 'linear' },
    ])
    expect(open.clone.style.transition).toBe('')
    expect(open.clone.style.transform).toBe('')
  })

  it('fades the clone out the same way', async () => {
    const animate = vi.fn()
    Object.defineProperty(HTMLElement.prototype, 'animate', {
      value: animate,
      configurable: true,
    })
    let elsewhere = false
    const open = openDoor(plan({ reduced: true, away: () => elsewhere }))
    await vi.advanceTimersByTimeAsync(400)
    expect(open.clone.dataset.phase).toBe('covered')

    elsewhere = true
    await vi.advanceTimersByTimeAsync(40)
    expect(animate).toHaveBeenLastCalledWith([{ opacity: 1 }, { opacity: 0 }], {
      duration: 80,
      easing: 'linear',
    })
    expect(open.clone.style.transition).toBe('')
  })
})

describe('a rotation mid-open', () => {
  it('retargets the clone to the new screen', async () => {
    const open = openDoor(plan())
    await vi.advanceTimersByTimeAsync(150)
    vi.stubGlobal('innerWidth', 852)
    vi.stubGlobal('innerHeight', 393)
    window.dispatchEvent(new Event('resize'))

    expect(open.clone.style.width).toBe('852px')
    expect(open.clone.style.height).toBe('393px')
    await vi.advanceTimersByTimeAsync(600)
    // Covered: the clone is the new screen, drawn without a warp.
    expect(open.clone.dataset.phase).toBe('covered')
    const values = open.clone.style.transform
      .replace(/^matrix3d\(|\)$/gu, '')
      .split(',')
      .map(Number)
    const identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
    expect(values).toHaveLength(16)
    values.forEach((value, i) => expect(value).toBeCloseTo(identity[i], 6))
    vi.unstubAllGlobals()
  })
})
