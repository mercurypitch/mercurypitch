// ============================================================
// Between the beats: the View Transition, the cross-fade, Merc's move
// ============================================================
//
// jsdom has neither element.animate nor document.startViewTransition, so
// each case stands them in: a recorded animate whose `finished` the case
// resolves, and a View Transition that runs its update callback a frame
// later, as a WebView does.

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { SwapDone } from './beat-swap'
import { createBeatSwap, GHOST_ATTR, MERC_CLASS, MOVE_MS, SWAP_CLASS, SWAP_MS, SWAP_REDUCED_MS, } from './beat-swap'

interface Played {
  target: Element
  keyframes: Keyframe[]
  options: KeyframeAnimationOptions
  finish: () => void
  cancelled: boolean
}

let played: Played[] = []

/** element.animate, recorded; each animation finishes when the case says. */
function standInAnimate(): void {
  Element.prototype.animate = function animate(
    this: Element,
    keyframes: Keyframe[] | PropertyIndexedKeyframes | null,
    options?: number | KeyframeAnimationOptions,
  ): Animation {
    let finish = (): void => undefined
    const finished = new Promise<void>((resolve) => {
      finish = resolve
    })
    const entry: Played = {
      target: this,
      keyframes: keyframes as Keyframe[],
      options: options as KeyframeAnimationOptions,
      finish,
      cancelled: false,
    }
    played.push(entry)
    return {
      finished,
      cancel: () => {
        entry.cancelled = true
      },
    } as unknown as Animation
  }
}

interface Transition {
  run: () => void
  finish: () => void
}
let transitions: Transition[] = []

/** document.startViewTransition: the update a frame later, as a WebView. */
function standInViewTransition(): void {
  Object.defineProperty(document, 'startViewTransition', {
    configurable: true,
    value: (update: () => void) => {
      let done = (): void => undefined
      const finished = new Promise<void>((resolve) => {
        done = resolve
      })
      let ran = false
      const transition: Transition = {
        run: () => {
          if (ran) return
          ran = true
          update()
        },
        finish: () => {
          transition.run()
          done()
        },
      }
      transitions.push(transition)
      return {
        ready: Promise.resolve(),
        updateCallbackDone: Promise.resolve(),
        finished,
      }
    },
  })
}

/** A layer with one beat on screen and Merc in it, boxes stood in. */
function layerWith(beatName: string): {
  layer: HTMLElement
  merc: HTMLElement
  beat: () => HTMLElement | undefined
  show: (name: string, mercAt: DOMRect) => void
} {
  const layer = document.createElement('div')
  document.body.append(layer)
  const merc = document.createElement('div')
  merc.className = MERC_CLASS
  merc.dataset.testid = 'onboarding-merc'
  let mercBox = new DOMRect(100, 200, 240, 240)
  merc.getBoundingClientRect = () => mercBox
  const make = (name: string): HTMLElement => {
    const beat = document.createElement('div')
    beat.className = 'beat'
    beat.dataset.testid = `onboarding-${name}`
    const bubble = document.createElement('p')
    bubble.dataset.testid = 'onboarding-line'
    bubble.textContent = name
    beat.append(bubble)
    beat.getBoundingClientRect = () => new DOMRect(0, 60, 390, 700)
    return beat
  }
  layer.append(make(beatName))
  layer.querySelector('.beat')?.append(merc)
  const beat = (): HTMLElement | undefined =>
    [...layer.children].find(
      (child): child is HTMLElement =>
        child instanceof HTMLElement &&
        child.classList.contains('beat') &&
        !child.hasAttribute(GHOST_ATTR),
    )
  return {
    layer,
    merc,
    beat,
    show: (name, mercAt) => {
      const next = make(name)
      beat()?.replaceWith(next)
      next.append(merc)
      mercBox = mercAt
    },
  }
}

const ANIMATE = Element.prototype.animate

beforeEach(() => {
  played = []
  transitions = []
})

afterEach(() => {
  Element.prototype.animate = ANIMATE
  Reflect.deleteProperty(document, 'startViewTransition')
  document.documentElement.classList.remove(SWAP_CLASS)
  document.body.replaceChildren()
})

describe('a beat giving way to the next', () => {
  it('cuts straight to the next beat where nothing can be animated', () => {
    const page = layerWith('first-note')
    const done: SwapDone[] = []
    const swap = createBeatSwap({
      layer: () => page.layer,
      beat: page.beat,
      merc: () => page.merc,
      reduced: () => false,
      done: (how) => done.push(how),
    })

    swap.swap(() => page.show('range', new DOMRect(20, 300, 96, 96)), 'view')

    expect(page.beat()?.dataset.testid).toBe('onboarding-range')
    expect(done).toEqual(['cut'])
  })

  it('cross-fades without a View Transition: the old beat a picture over the new, and Merc moves across', async () => {
    standInAnimate()
    const page = layerWith('first-note')
    const swap = createBeatSwap({
      layer: () => page.layer,
      beat: page.beat,
      merc: () => page.merc,
      reduced: () => false,
    })

    swap.swap(() => page.show('range', new DOMRect(20, 300, 120, 120)), 'view')

    // The new beat is there at once, the old one a picture over it.
    expect(page.beat()?.dataset.testid).toBe('onboarding-range')
    const ghost = page.layer.querySelector(`[${GHOST_ATTR}]`)
    expect(ghost).not.toBeNull()
    expect(ghost?.getAttribute('aria-hidden')).toBe('true')
    expect((ghost as HTMLElement).inert).toBe(true)
    expect((ghost as HTMLElement).style.pointerEvents).toBe('none')
    // Nothing in it answers a probe, and Merc is not in the picture.
    expect(ghost?.querySelector('[data-testid]')).toBeNull()
    expect(ghost?.hasAttribute('data-testid')).toBe(false)
    expect(ghost?.querySelector(`.${MERC_CLASS}`)).toBeNull()
    expect(page.layer.querySelectorAll(`.${MERC_CLASS}`)).toHaveLength(1)

    const fadeOut = played.find((p) => p.target === ghost)
    const fadeIn = played.find((p) => p.target === page.beat())
    expect(fadeOut?.options.duration).toBe(SWAP_MS)
    expect(fadeOut?.keyframes.map((k) => k.opacity)).toEqual([1, 0])
    expect(fadeIn?.keyframes.map((k) => k.opacity)).toEqual([0, 1])

    // Merc, drawn from his old box (100, 200, 240 wide) to his new one.
    const move = played.find((p) => p.target === page.merc)
    expect(move?.options.duration).toBe(MOVE_MS)
    expect(move?.keyframes[0].transform).toBe(
      'translate(80px, -100px) scale(2)',
    )
    expect(move?.keyframes[1].transform).toBe('none')

    // The picture goes once it has faded.
    fadeOut?.finish()
    await Promise.resolve()
    await Promise.resolve()
    expect(page.layer.querySelector(`[${GHOST_ATTR}]`)).toBeNull()
  })

  it("swaps the layer's own beats in a View Transition, the page changed in its update a frame later", async () => {
    standInAnimate()
    standInViewTransition()
    const page = layerWith('first-note')
    const done: SwapDone[] = []
    const swap = createBeatSwap({
      layer: () => page.layer,
      beat: page.beat,
      merc: () => page.merc,
      reduced: () => false,
      done: (how) => done.push(how),
    })

    swap.swap(() => page.show('range', new DOMRect(20, 300, 120, 120)), 'view')

    // Asked for: Merc named for it, and the page as it was until the update.
    expect(done).toEqual(['view'])
    expect(document.documentElement.classList.contains(SWAP_CLASS)).toBe(true)
    expect(page.beat()?.dataset.testid).toBe('onboarding-first-note')
    transitions[0].run()
    expect(page.beat()?.dataset.testid).toBe('onboarding-range')
    // No picture of the old beat: the View Transition fades it.
    expect(page.layer.querySelector(`[${GHOST_ATTR}]`)).toBeNull()
    expect(
      played.find((p) => p.target === page.merc)?.keyframes[0].transform,
    ).toBe('translate(80px, -100px) scale(2)')

    transitions[0].finish()
    await Promise.resolve()
    await Promise.resolve()
    expect(document.documentElement.classList.contains(SWAP_CLASS)).toBe(false)
  })

  it('keeps Merc named until the last of two View Transitions has finished', async () => {
    standInAnimate()
    standInViewTransition()
    const page = layerWith('first-note')
    const swap = createBeatSwap({
      layer: () => page.layer,
      beat: page.beat,
      merc: () => page.merc,
      reduced: () => false,
    })

    swap.swap(() => page.show('range', new DOMRect(20, 300, 120, 120)), 'view')
    swap.swap(() => page.show('reveal', new DOMRect(16, 600, 76, 76)), 'view')
    transitions[0].finish()
    await Promise.resolve()
    await Promise.resolve()

    expect(document.documentElement.classList.contains(SWAP_CLASS)).toBe(true)
    transitions[1].finish()
    await Promise.resolve()
    await Promise.resolve()
    expect(document.documentElement.classList.contains(SWAP_CLASS)).toBe(false)
    expect(page.beat()?.dataset.testid).toBe('onboarding-reveal')
  })

  it('cross-fades a beat that brings a sheet up, even where there is a View Transition', () => {
    standInAnimate()
    standInViewTransition()
    const page = layerWith('reveal')
    const done: SwapDone[] = []
    const swap = createBeatSwap({
      layer: () => page.layer,
      beat: page.beat,
      merc: () => page.merc,
      reduced: () => false,
      done: (how) => done.push(how),
    })

    swap.swap(() => page.show('keep', new DOMRect(150, 80, 240, 240)), 'fade')

    expect(transitions).toHaveLength(0)
    expect(done).toEqual(['fade'])
    expect(page.beat()?.dataset.testid).toBe('onboarding-keep')
    expect(page.layer.querySelector(`[${GHOST_ATTR}]`)).not.toBeNull()
  })

  it('under reduced motion: one 150 ms cross-fade, no View Transition, and Merc does not move', () => {
    standInAnimate()
    standInViewTransition()
    const page = layerWith('first-note')
    const swap = createBeatSwap({
      layer: () => page.layer,
      beat: page.beat,
      merc: () => page.merc,
      reduced: () => true,
    })

    swap.swap(() => page.show('range', new DOMRect(20, 300, 120, 120)), 'view')

    expect(transitions).toHaveLength(0)
    expect(page.beat()?.dataset.testid).toBe('onboarding-range')
    const fades = played.filter((p) => p.target !== page.merc)
    expect(fades.map((p) => p.options.duration)).toEqual([
      SWAP_REDUCED_MS,
      SWAP_REDUCED_MS,
    ])
    expect(played.some((p) => p.target === page.merc)).toBe(false)
  })

  it('never flies Merc over the reveal: a cross-fade, and he comes with the beat', () => {
    standInAnimate()
    standInViewTransition()
    const page = layerWith('range')
    const done: SwapDone[] = []
    const swap = createBeatSwap({
      layer: () => page.layer,
      beat: page.beat,
      merc: () => page.merc,
      reduced: () => false,
      done: (how) => done.push(how),
    })

    swap.swap(
      () => page.show('reveal', new DOMRect(16, 600, 76, 76)),
      'view',
      false,
    )

    // No View Transition to name him in, and no move across the card.
    expect(transitions).toHaveLength(0)
    expect(done).toEqual(['fade'])
    expect(page.beat()?.dataset.testid).toBe('onboarding-reveal')
    expect(played.some((p) => p.target === page.merc)).toBe(false)
    // The new beat, Merc in it, fades in; the old one's picture, without
    // him, fades out.
    const fadeIn = played.find((p) => p.target === page.beat())
    expect(fadeIn?.keyframes.map((k) => k.opacity)).toEqual([0, 1])
    expect(page.beat()?.contains(page.merc)).toBe(true)
    const ghost = page.layer.querySelector(`[${GHOST_ATTR}]`)
    expect(ghost?.querySelector(`.${MERC_CLASS}`)).toBeNull()
  })

  it('takes a picture still fading with it when the layer goes', () => {
    standInAnimate()
    const page = layerWith('first-note')
    const swap = createBeatSwap({
      layer: () => page.layer,
      beat: page.beat,
      merc: () => page.merc,
      reduced: () => false,
    })
    swap.swap(() => page.show('range', new DOMRect(20, 300, 120, 120)), 'view')
    expect(page.layer.querySelector(`[${GHOST_ATTR}]`)).not.toBeNull()

    swap.dispose()

    expect(page.layer.querySelector(`[${GHOST_ATTR}]`)).toBeNull()
    expect(played.find((p) => p.target === page.merc)?.cancelled).toBe(true)
  })
})
