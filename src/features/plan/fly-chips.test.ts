// ============================================================
// Fly chips — each answer's pill flies into the card it made
// ============================================================
//
// jsdom has no Web Animations, so each case that needs a flight puts an
// `animate` on Element.prototype that writes down what it was asked to play,
// and takes it away again afterwards. A chip's place is its rect, and jsdom
// has no layout, so every chip and pill is given a rect of its own.

import { afterEach, describe, expect, it, vi } from 'vitest'
import { FLY_MS, flyChips } from './fly-chips'

interface Played {
  chip: Element
  frames: Keyframe[]
  options: KeyframeAnimationOptions
}

const played: Played[] = []
const ORIGINAL_ANIMATE = Object.getOwnPropertyDescriptor(
  Element.prototype,
  'animate',
)

/** Lets the next flights be played, each ending when `finished` says so. */
function allowAnimation(finished: () => Promise<unknown> = async () => {}) {
  Object.defineProperty(Element.prototype, 'animate', {
    configurable: true,
    writable: true,
    value(
      this: Element,
      frames: Keyframe[],
      options: KeyframeAnimationOptions,
    ) {
      played.push({ chip: this, frames, options })
      return { finished: finished() }
    },
  })
}

afterEach(() => {
  played.length = 0
  vi.unstubAllGlobals()
  if (ORIGINAL_ANIMATE === undefined) {
    delete (Element.prototype as { animate?: unknown }).animate
  } else {
    Object.defineProperty(Element.prototype, 'animate', ORIGINAL_ANIMATE)
  }
})

const rect = (
  left: number,
  top: number,
  width: number,
  height: number,
): DOMRect =>
  ({
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    x: left,
    y: top,
  }) as DOMRect

/** A chip on a card, `label` on it, standing where `at` says. */
function chip(label: string, at = rect(20, 100, 80, 24)): HTMLElement {
  const el = document.createElement('span')
  el.dataset.chip = label
  el.getBoundingClientRect = () => at
  return el
}

/** The first number pair of the `translate(Xpx, Ypx)` a keyframe starts from. */
function translateOf(frame: Keyframe): [number, number] | null {
  const found = /translate\((-?[\d.]+)px, (-?[\d.]+)px\)/u.exec(
    String(frame.transform),
  )
  return found === null ? null : [Number(found[1]), Number(found[2])]
}

const PILL = rect(100, 400, 200, 40)

describe('without a flight to make', () => {
  it('finishes at once without animation support', async () => {
    delete (Element.prototype as { animate?: unknown }).animate

    await expect(
      flyChips([chip('A teacher')], new Map([['A teacher', PILL]])),
    ).resolves.toBeUndefined()
  })

  it('finishes at once, and plays nothing, under reduced motion', async () => {
    allowAnimation()

    await expect(
      flyChips([chip('A teacher')], new Map([['A teacher', PILL]]), {
        reduced: true,
      }),
    ).resolves.toBeUndefined()
    expect(played).toHaveLength(0)
  })

  it("takes the person's own motion setting when none is given", async () => {
    allowAnimation()
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query.includes('prefers-reduced-motion: reduce'),
    }))

    await flyChips([chip('A teacher')], new Map())

    expect(played).toHaveLength(0)
  })

  it('plays when the person has not asked for less motion', async () => {
    allowAnimation()
    vi.stubGlobal('matchMedia', () => ({ matches: false }))

    await flyChips([chip('A teacher')], new Map())

    expect(played).toHaveLength(1)
  })

  it('has nothing to do for a plan with no chips', async () => {
    allowAnimation()

    await expect(flyChips([], new Map())).resolves.toBeUndefined()
    expect(played).toHaveLength(0)
  })
})

describe('a chip with a pill behind it', () => {
  it('flies a chip from the pill that made it', async () => {
    allowAnimation()
    const el = chip('A teacher', rect(20, 100, 80, 24))

    await flyChips([el], new Map([['A teacher', PILL]]), { reduced: false })

    const [flight] = played
    expect(flight.chip).toBe(el)
    // The pill's middle is (200, 420) and the chip's is (60, 112): the chip
    // starts 140 right of and 308 under where it lands.
    expect(translateOf(flight.frames[0])).toEqual([140, 308])
    expect(flight.frames.at(-1)?.transform).toBe('none')
    expect(flight.options.duration).toBeLessThanOrEqual(900)
  })

  it('shows the chip as it leaves, and holds it there until its turn', async () => {
    allowAnimation()

    await flyChips([chip('A teacher')], new Map([['A teacher', PILL]]))

    const [{ frames, options }] = played
    expect(frames[0].opacity).toBe(0)
    expect(frames.at(-1)?.opacity).toBe(1)
    // `backwards` keeps the first frame on show during a delay, so a chip
    // never sits in its card for a moment before it is sent.
    expect(options.fill).toBe('backwards')
  })

  it('sends two chips from one pill, and each from the same place', async () => {
    allowAnimation()
    const first = chip('A teacher', rect(20, 100, 80, 24))
    const second = chip('A teacher', rect(20, 300, 80, 24))

    await flyChips([first, second], new Map([['A teacher', PILL]]))

    expect(translateOf(played[0].frames[0])).toEqual([140, 308])
    expect(translateOf(played[1].frames[0])).toEqual([140, 108])
  })
})

describe('a chip nothing made it from', () => {
  it('rises in where it stands', async () => {
    allowAnimation()

    await flyChips(
      [chip("Telling if I'm getting better")],
      new Map([['A teacher', PILL]]),
    )

    const [{ frames }] = played
    expect(translateOf(frames[0])).toBeNull()
    expect(frames[0].opacity).toBe(0)
    expect(frames.at(-1)).toMatchObject({ transform: 'none', opacity: 1 })
  })

  it('treats a chip with no label as one to rise in', async () => {
    allowAnimation()
    const bare = document.createElement('span')
    bare.getBoundingClientRect = () => rect(0, 0, 10, 10)

    await flyChips([bare], new Map([['', PILL]]))

    expect(played).toHaveLength(1)
    expect(translateOf(played[0].frames[0])).toBeNull()
  })
})

describe('the whole flight', () => {
  it('lands every chip inside FLY_MS, however many there are', async () => {
    allowAnimation()
    const chips = Array.from({ length: 14 }, (_, i) =>
      chip(i % 2 === 0 ? 'A teacher' : `Answer ${i}`),
    )

    await flyChips(chips, new Map([['A teacher', PILL]]))

    expect(FLY_MS).toBe(900)
    expect(played).toHaveLength(14)
    for (const { options } of played) {
      expect(
        Number(options.delay) + Number(options.duration),
      ).toBeLessThanOrEqual(FLY_MS)
    }
  })

  it('sends the chips one after another, in the order they stand', async () => {
    allowAnimation()
    const chips = ['one', 'two', 'three'].map((label) => chip(label))

    await flyChips(chips, new Map())

    const delays = played.map(({ options }) => Number(options.delay))
    expect(
      played.map(({ chip: el }) => (el as HTMLElement).dataset.chip),
    ).toEqual(['one', 'two', 'three'])
    expect(delays[0]).toBe(0)
    expect(delays[1]).toBeGreaterThan(delays[0])
    expect(delays[2]).toBeGreaterThan(delays[1])
  })

  it('resolves only when the last chip has landed', async () => {
    const landings: (() => void)[] = []
    allowAnimation(() => new Promise((land) => landings.push(() => land(null))))
    let resolved = false

    const flight = flyChips([chip('one'), chip('two')], new Map()).then(() => {
      resolved = true
    })
    landings[0]()
    // A whole turn of the event loop: any promise that was going to settle has.
    await new Promise((turn) => setTimeout(turn))
    expect(resolved).toBe(false)

    landings[1]()
    await flight
    expect(resolved).toBe(true)
  })

  it('still resolves when a flight is cancelled outright (its `finished` rejects)', async () => {
    allowAnimation(() => Promise.reject(new DOMException('', 'AbortError')))

    await expect(
      flyChips([chip('A teacher')], new Map([['A teacher', PILL]])),
    ).resolves.toBeUndefined()
  })
})
