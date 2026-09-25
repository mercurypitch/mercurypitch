import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { holdRoomArrival, roomArrivalHeld } from '@/stores/native-shell-store'
import type { DoorOpenPlan } from './alley-entry'
import { openDoor, ROOM_LATE_MS } from './alley-entry'
import { artBox, coverCrop, layoutDoors, scaleCrop } from './alley-geometry'
import { ALLEY_PLATE, DOORS } from './alley-plate'
import type { RoomPicture, RoomPictureSource } from './alley-room'

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
    room: null,
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

describe("the Sing clip's crop", () => {
  // In its door the loop is cover-fit to the art box; the clone's box is
  // cover-fit to the screen. Both are warped onto the same quad at t = 0, so
  // unless the clone starts on the door's crop the first frame shows 2.7
  // times as much of the loop, squeezed.
  const clipIn = (): HTMLVideoElement => {
    const door = document.createElement('div')
    const video = document.createElement('video')
    Object.defineProperty(video, 'videoWidth', { value: 1080 })
    Object.defineProperty(video, 'videoHeight', { value: 1920 })
    vi.spyOn(video, 'play').mockResolvedValue(undefined)
    vi.spyOn(video, 'pause').mockImplementation(() => undefined)
    door.appendChild(video)
    document.body.appendChild(door)
    return video
  }
  /** The source rect the clip's transform lays over the W x H clone. */
  const shown = (video: HTMLVideoElement) => {
    const [kx, , , ky, tx, ty] = video.style.transform
      .replace(/^matrix\(|\)$/gu, '')
      .split(',')
      .map(Number)
    return { x: -tx / kx, y: -ty / ky, w: W / kx, h: H / ky }
  }

  it("starts on the door's own crop and ends on the screen's", async () => {
    if (sing === undefined) throw new Error('no Sing door')
    const video = clipIn()
    openDoor(plan({ video }))

    const art = artBox(sing)
    const door = coverCrop(1080, 1920, art.w, art.h)
    const first = shown(video)
    expect(first.x).toBeCloseTo(door.x, 0)
    expect(first.w).toBeCloseTo(door.w, 0)
    expect(first.h).toBeCloseTo(door.h, 0)

    await vi.advanceTimersByTimeAsync(700)
    const last = shown(video)
    const screen = coverCrop(1080, 1920, W, H)
    expect(last.x).toBeCloseTo(screen.x, 0)
    expect(last.w).toBeCloseTo(screen.w, 0)
  })

  it('goes back into its door with none of it', async () => {
    const video = clipIn()
    const open = openDoor(plan({ video }))
    await vi.advanceTimersByTimeAsync(150)
    open.cancel()
    expect(video.getAttribute('style') ?? '').toBe('')
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

describe("the room's own picture", () => {
  // The open ends on the room's picture, not the plate's pixels: the Ear
  // Lab's door grew the tuning forks from a 1024 x 1536 plate to the full
  // screen, about 14 times their size, and only then did the room replace
  // them (device round 4).
  const ear = layoutDoors(ALLEY_PLATE, DOORS, W, H).find((d) => d.key === 'ear')

  function picture(over: Partial<RoomPicture> = {}): RoomPicture {
    const image = new Image()
    image.src = '/ear-lab/regulator-room-portrait.webp'
    return {
      image,
      src: image.src,
      width: 1440,
      height: 2560,
      focus: [0.5, 0.42],
      scale: 1.012,
      ...over,
    }
  }
  const ready = (p: RoomPicture): RoomPictureSource => ({
    now: p,
    later: Promise.resolve(p),
  })

  function pending(): {
    source: RoomPictureSource
    arrive: (p: RoomPicture | null) => void
  } {
    let arrive: (p: RoomPicture | null) => void = () => undefined
    const later = new Promise<RoomPicture | null>((resolve) => {
      arrive = resolve
    })
    return { source: { now: null, later }, arrive: (p) => arrive(p) }
  }
  const earPlan = (over: Partial<DoorOpenPlan> = {}): DoorOpenPlan => {
    if (ear === undefined) throw new Error('no Ear Lab door')
    return plan({ door: ear, ...over })
  }
  /** The source rect a `matrix()` crop lays over the W x H clone. */
  const shown = (element: HTMLElement) => {
    const [kx, , , ky, tx, ty] = element.style.transform
      .replace(/^matrix\(|\)$/gu, '')
      .split(',')
      .map(Number)
    return { x: -tx / kx, y: -ty / ky, w: W / kx, h: H / ky }
  }
  const layers = (clone: HTMLElement) => ({
    room: clone.querySelector<HTMLImageElement>(
      '[data-testid="alley-morph-room"]',
    ),
    paint: clone.querySelector<HTMLElement>('.mp-alley-morph__paint'),
  })
  const closeTo = (
    a: { x: number; y: number; w: number; h: number },
    b: { x: number; y: number; w: number; h: number },
  ) => {
    for (const k of ['x', 'y', 'w', 'h'] as const) {
      expect(a[k], k).toBeCloseTo(b[k], 3)
    }
  }
  /** Where the Ear Lab's element draws its picture on this screen. */
  const theRoom = (p: RoomPicture, w = W, h = H) =>
    scaleCrop(coverCrop(p.width, p.height, w, h, p.focus), p.scale)

  it('is in the clone from Enter, over the door, and not yet showing', () => {
    if (ear === undefined) throw new Error('no Ear Lab door')
    const p = picture()
    const open = openDoor(earPlan({ room: ready(p) }))
    const { room, paint } = layers(open.clone)

    // The element that decoded, not a copy that would have to decode again.
    expect(room).toBe(p.image)
    expect(open.clone.lastElementChild).toBe(p.image)
    expect(open.clone.dataset.room).toBe('in')
    expect(p.image.style.opacity).toBe('0')
    expect(paint?.style.opacity).toBe('')
    // Cover-fit to the door's own box at the picture's focus: the doorway
    // shows it unsquashed once it is in.
    const art = artBox(ear)
    closeTo(shown(p.image), coverCrop(1440, 2560, art.w, art.h, p.focus))
  })

  it('has taken over from the plate by the second frame, and the plate goes', async () => {
    const p = picture()
    const open = openDoor(earPlan({ room: ready(p) }))
    const { paint } = layers(open.clone)
    const frames: Array<[string, string | undefined]> = []
    for (let i = 0; i < 4; i++) {
      await vi.advanceTimersByTimeAsync(16)
      frames.push([p.image.style.opacity, paint?.style.opacity])
    }
    // The ease front-loads the grow: the door is four times its size on the
    // first frame, so the picture is nearly whole there and whole on the
    // second, when the plate under it is taken away.
    expect(Number(frames[0][0])).toBeGreaterThan(0.8)
    expect(frames[0][1]).toBe('')
    expect(frames[1]).toEqual(['1', '0'])
    expect(frames[3]).toEqual(['1', '0'])
  })

  it("ends exactly where the room's element draws it", async () => {
    const p = picture()
    const open = openDoor(earPlan({ room: ready(p) }))
    await vi.advanceTimersByTimeAsync(700)

    expect(open.clone.dataset.phase).toBe('covered')
    closeTo(shown(p.image), theRoom(p))
    expect(p.image.style.opacity).toBe('1')
    expect(layers(open.clone).paint?.style.opacity).toBe('0')
  })

  it('takes over from the Sing clip the same way, and the clip stops', async () => {
    const door = document.createElement('div')
    const video = document.createElement('video')
    Object.defineProperty(video, 'videoWidth', { value: 1080 })
    Object.defineProperty(video, 'videoHeight', { value: 1920 })
    vi.spyOn(video, 'play').mockResolvedValue(undefined)
    const pause = vi.spyOn(video, 'pause').mockImplementation(() => undefined)
    door.appendChild(video)
    document.body.appendChild(door)
    const p = picture({
      width: 2160,
      height: 3840,
      focus: [0.5, 0.68],
      scale: 1,
    })

    const open = openDoor(plan({ video, room: ready(p) }))
    expect(open.clone.lastElementChild).toBe(p.image)
    await vi.advanceTimersByTimeAsync(40)
    expect(p.image.style.opacity).toBe('1')
    expect(video.style.opacity).toBe('0')
    expect(pause).toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(700)
    closeTo(shown(p.image), theRoom(p))
  })

  it('leaves the door to grow as it did when the picture is not decoded by Enter, and fades it in when it is', async () => {
    const animate = vi.fn()
    Object.defineProperty(HTMLElement.prototype, 'animate', {
      value: animate,
      configurable: true,
    })
    try {
      const { source, arrive } = pending()
      const open = openDoor(earPlan({ room: source }))
      await vi.advanceTimersByTimeAsync(100)
      // Nothing half-loaded: no picture at all until it has decoded.
      expect(layers(open.clone).room).toBeNull()
      expect(open.clone.dataset.room).toBe('waiting')
      expect(layers(open.clone).paint?.style.opacity).toBe('')

      const p = picture()
      arrive(p)
      await vi.advanceTimersByTimeAsync(0)
      expect(layers(open.clone).room).toBe(p.image)
      expect(open.clone.dataset.room).toBe('in')
      expect(animate).toHaveBeenLastCalledWith(
        [{ opacity: 0 }, { opacity: 1 }],
        { duration: ROOM_LATE_MS, easing: 'linear' },
      )
      expect(animate.mock.contexts.at(-1)).toBe(p.image)
      // The plate stays under it until it is whole.
      expect(layers(open.clone).paint?.style.opacity).toBe('')
      await vi.advanceTimersByTimeAsync(ROOM_LATE_MS)
      expect(layers(open.clone).paint?.style.opacity).toBe('0')

      await vi.advanceTimersByTimeAsync(600)
      expect(open.clone.dataset.phase).toBe('covered')
      closeTo(shown(p.image), theRoom(p))
    } finally {
      delete (HTMLElement.prototype as Partial<HTMLElement>).animate
    }
  })

  it('keeps the plate, and the wait for the room, when the picture never comes', async () => {
    const { source, arrive } = pending()
    const open = openDoor(earPlan({ room: source }))
    await vi.advanceTimersByTimeAsync(700)
    expect(open.clone.dataset.phase).toBe('covered')
    arrive(null)
    await vi.advanceTimersByTimeAsync(0)
    expect(layers(open.clone).room).toBeNull()
    expect(layers(open.clone).paint?.style.opacity).toBe('')
    // Today's wait on the room's own background, to its deadline.
    await vi.advanceTimersByTimeAsync(1000)
    expect(open.clone.isConnected).toBe(true)
    await vi.advanceTimersByTimeAsync(1000)
    expect(open.clone.isConnected).toBe(false)
  })

  it('reduced motion: no grow, the picture where the room draws it, crossfaded in', () => {
    const animate = vi.fn()
    Object.defineProperty(HTMLElement.prototype, 'animate', {
      value: animate,
      configurable: true,
    })
    try {
      const p = picture()
      const open = openDoor(earPlan({ reduced: true, room: ready(p) }))

      expect(open.clone.style.transform).toBe('')
      expect(p.image.style.opacity).toBe('1')
      closeTo(shown(p.image), theRoom(p))
      expect(layers(open.clone).paint?.style.opacity).toBe('0')
      expect(animate.mock.contexts[0]).toBe(open.clone)
      expect(animate.mock.calls[0]).toEqual([
        [{ opacity: 0 }, { opacity: 1 }],
        { duration: 120, easing: 'linear' },
      ])
    } finally {
      delete (HTMLElement.prototype as Partial<HTMLElement>).animate
    }
  })

  it('goes with the clone when the open is called off, and the clip comes home clean', async () => {
    const door = document.createElement('div')
    const video = document.createElement('video')
    Object.defineProperty(video, 'videoWidth', { value: 1080 })
    Object.defineProperty(video, 'videoHeight', { value: 1920 })
    vi.spyOn(video, 'play').mockResolvedValue(undefined)
    vi.spyOn(video, 'pause').mockImplementation(() => undefined)
    door.appendChild(video)
    document.body.appendChild(door)
    const p = picture()
    const open = openDoor(plan({ video, room: ready(p) }))
    let over = false
    void open.done.then(() => {
      over = true
    })
    await vi.advanceTimersByTimeAsync(150)
    expect(video.style.opacity).toBe('0')

    expect(open.cancel()).toBe(true)
    await vi.advanceTimersByTimeAsync(0)
    expect(over).toBe(true)
    expect(open.clone.isConnected).toBe(false)
    expect(p.image.isConnected).toBe(false)
    expect(roomArrivalHeld()).toBe(false)
    expect(video.parentElement).toBe(door)
    expect(video.getAttribute('style') ?? '').toBe('')
  })

  it('a picture that arrives after the open was called off shows nowhere', async () => {
    const door = document.createElement('div')
    const video = document.createElement('video')
    vi.spyOn(video, 'play').mockResolvedValue(undefined)
    vi.spyOn(video, 'pause').mockImplementation(() => undefined)
    door.appendChild(video)
    document.body.appendChild(door)
    const { source, arrive } = pending()
    const open = openDoor(plan({ video, room: source }))
    await vi.advanceTimersByTimeAsync(100)
    open.cancel()

    const p = picture()
    arrive(p)
    await vi.advanceTimersByTimeAsync(1000)
    expect(p.image.isConnected).toBe(false)
    // Not even in the clone that was taken down.
    expect(p.image.parentElement).toBeNull()
    // Its late fade did not reach the clip, which is back in its door.
    expect(video.parentElement).toBe(door)
    expect(video.style.opacity).toBe('')
  })

  it('a picture that arrives once the room is showing through stays out of it', async () => {
    const { source, arrive } = pending()
    const open = openDoor(earPlan({ room: source }))
    for (let i = 0; i < 80 && open.clone.dataset.phase !== 'revealing'; i++) {
      await vi.advanceTimersByTimeAsync(50)
    }
    expect(open.clone.dataset.phase).toBe('revealing')

    arrive(picture())
    await vi.advanceTimersByTimeAsync(0)
    // The clone is already dissolving into the room: a picture fading in
    // over it, and the plate under it taken away, would pop mid-dissolve.
    expect(layers(open.clone).room).toBeNull()
    expect(layers(open.clone).paint?.style.opacity).toBe('')
    await vi.advanceTimersByTimeAsync(1000)
    expect(open.clone.isConnected).toBe(false)
  })

  it('holds the room until the clone is gone and the ambient is silent, as before', async () => {
    let silence: () => void = () => undefined
    const ambientSilent = new Promise<void>((resolve) => {
      silence = resolve
    })
    const p = picture()
    const open = openDoor(earPlan({ room: ready(p), ambientSilent }))
    let over = false
    void open.done.then(() => {
      over = true
    })
    await vi.advanceTimersByTimeAsync(700)
    expect(roomArrivalHeld()).toBe(true)
    expect(over).toBe(false)

    await vi.advanceTimersByTimeAsync(2000)
    expect(open.clone.isConnected).toBe(false)
    expect(over).toBe(true)
    expect(roomArrivalHeld()).toBe(true)
    silence()
    await vi.advanceTimersByTimeAsync(0)
    expect(roomArrivalHeld()).toBe(false)
  })

  it('a rotation mid-open ends on the room as drawn on the new screen', async () => {
    const p = picture()
    const open = openDoor(earPlan({ room: ready(p) }))
    await vi.advanceTimersByTimeAsync(150)
    vi.stubGlobal('innerWidth', 852)
    vi.stubGlobal('innerHeight', 393)
    window.dispatchEvent(new Event('resize'))
    await vi.advanceTimersByTimeAsync(600)

    expect(open.clone.dataset.phase).toBe('covered')
    const [kx, , , ky, tx, ty] = p.image.style.transform
      .replace(/^matrix\(|\)$/gu, '')
      .split(',')
      .map(Number)
    closeTo(
      { x: -tx / kx, y: -ty / ky, w: 852 / kx, h: 393 / ky },
      theRoom(p, 852, 393),
    )
    vi.unstubAllGlobals()
  })
})
