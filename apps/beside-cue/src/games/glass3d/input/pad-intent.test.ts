import { describe, expect, it, vi } from 'vitest'
import type { PadConfig } from './pad-intent'
import { bindKeyboard, createIntentSource, isTap, PAD_CONFIG, padMove, } from './pad-intent'

/** A 200px pad starting 40px from the left edge, so its centre is 140. */
const RECT = { left: 40, width: 200 }
const CFG: PadConfig = PAD_CONFIG

describe('reading the walk pad', () => {
  it('is still in the middle', () => {
    expect(padMove(140, RECT, CFG.deadZoneRatio)).toBe(0)
  })

  it('walks the way the thumb is, at full speed at the ends', () => {
    expect(padMove(240, RECT, CFG.deadZoneRatio)).toBeCloseTo(1, 5)
    expect(padMove(40, RECT, CFG.deadZoneRatio)).toBeCloseTo(-1, 5)
  })

  it('is analogue between them', () => {
    const half = padMove(190, RECT, CFG.deadZoneRatio)
    expect(half).toBeGreaterThan(0.3)
    expect(half).toBeLessThan(0.8)
  })

  it('ignores a thumb resting near the centre', () => {
    // Inside the dead zone: 12% of a 100px half-width is 12px.
    expect(padMove(150, RECT, CFG.deadZoneRatio)).toBe(0)
  })

  // The reason the dead zone is rescaled rather than merely gated: a
  // gate would step from standing still to 12% of walking speed the
  // instant the thumb crossed the line.
  it('leaves the dead zone at a crawl, not at a lurch', () => {
    const justOut = padMove(140 + 13, RECT, CFG.deadZoneRatio)
    expect(justOut).toBeGreaterThan(0)
    expect(justOut).toBeLessThan(0.05)
  })

  it('clamps a thumb dragged off the end of the pad', () => {
    expect(padMove(9999, RECT, CFG.deadZoneRatio)).toBeCloseTo(1, 5)
    expect(padMove(-9999, RECT, CFG.deadZoneRatio)).toBeCloseTo(-1, 5)
  })

  it('answers nothing for a pad that has not been laid out yet', () => {
    expect(padMove(100, { left: 0, width: 0 }, CFG.deadZoneRatio)).toBe(0)
    expect(padMove(Number.NaN, RECT, CFG.deadZoneRatio)).toBe(0)
  })
})

describe('telling a tap from a walk', () => {
  it('is a tap when it is quick and it stayed put', () => {
    expect(isTap(0.1, 0.02, CFG)).toBe(true)
  })

  it('is not a tap when it lingered', () => {
    expect(isTap(0.5, 0.02, CFG)).toBe(false)
  })

  it('is not a tap when it was out where walking starts', () => {
    expect(isTap(0.1, 0.4, CFG)).toBe(false)
  })

  // The tap window has to reach past the dead zone, or a press that
  // never moved him would also fail to jump and the gesture would do
  // nothing at all.
  it('accepts a press that stayed inside the dead zone', () => {
    expect(isTap(0.1, PAD_CONFIG.deadZoneRatio, CFG)).toBe(true)
  })
})

describe('the intent source', () => {
  it('starts still and un-jumping', () => {
    const s = createIntentSource(CFG)
    expect(s.read(0)).toEqual({ move: 0, jump: false })
  })

  it('holds a jump for as long as the button is down', () => {
    const s = createIntentSource(CFG)
    s.setHeldJump(true)
    expect(s.read(0).jump).toBe(true)
    expect(s.read(10_000).jump).toBe(true)
    s.setHeldJump(false)
    expect(s.read(10_001).jump).toBe(false)
  })

  // A tapped jump has to outlive the frame it was tapped on, or a
  // 30fps device drops it between two reads.
  it('holds a tapped jump long enough to be seen, and then lets go', () => {
    const s = createIntentSource(CFG)
    s.pulseJump(1000)
    expect(s.read(1000).jump).toBe(true)
    expect(s.read(1000 + CFG.jumpPulseSeconds * 1000 * 0.9).jump).toBe(true)
    expect(s.read(1000 + CFG.jumpPulseSeconds * 1000 + 1).jump).toBe(false)
  })

  it('lets a second tap fire, because the first one ended', () => {
    const s = createIntentSource(CFG)
    s.pulseJump(0)
    expect(s.read(0).jump).toBe(true)
    expect(s.read(500).jump).toBe(false)
    s.pulseJump(500)
    expect(s.read(500).jump).toBe(true)
  })

  it('refuses a nonsense move rather than passing it on', () => {
    const s = createIntentSource(CFG)
    s.setMove(Number.NaN)
    expect(s.read(0).move).toBe(0)
    s.setMove(9)
    expect(s.read(0).move).toBe(1)
  })

  it('lets go of everything on release', () => {
    const s = createIntentSource(CFG)
    s.setMove(1)
    s.setHeldJump(true)
    s.pulseJump(0)
    s.release()
    expect(s.read(0)).toEqual({ move: 0, jump: false })
  })
})

describe('the keyboard', () => {
  /** A window stand-in that keeps its listeners where a test can fire
   * them, which is cheaper and clearer than jsdom's real one. */
  const fakeWindow = () => {
    const listeners = new Map<string, Set<(e: Event) => void>>()
    return {
      addEventListener: (type: string, fn: (e: Event) => void) => {
        const set = listeners.get(type) ?? new Set()
        set.add(fn)
        listeners.set(type, set)
      },
      removeEventListener: (type: string, fn: (e: Event) => void) => {
        listeners.get(type)?.delete(fn)
      },
      fire: (type: string, event: Partial<KeyboardEvent> = {}) => {
        const e = { preventDefault: vi.fn(), ...event } as unknown as Event
        for (const fn of listeners.get(type) ?? []) fn(e)
      },
      count: (type: string) => listeners.get(type)?.size ?? 0,
    }
  }

  it('walks while a direction key is down, and stops when it is up', () => {
    const s = createIntentSource(CFG)
    const w = fakeWindow()
    bindKeyboard(s, w as never)
    w.fire('keydown', { key: 'ArrowRight' })
    expect(s.read(0).move).toBe(1)
    w.fire('keyup', { key: 'ArrowRight' })
    expect(s.read(0).move).toBe(0)
  })

  // Holding both and letting one go should leave him walking, which is
  // why the binding tracks the held set rather than the last event.
  it('keeps walking the other way when one of two keys is released', () => {
    const s = createIntentSource(CFG)
    const w = fakeWindow()
    bindKeyboard(s, w as never)
    w.fire('keydown', { key: 'ArrowLeft' })
    w.fire('keydown', { key: 'ArrowRight' })
    expect(s.read(0).move).toBe(0)
    w.fire('keyup', { key: 'ArrowRight' })
    expect(s.read(0).move).toBe(-1)
  })

  it('jumps on space, and stops the page scrolling under it', () => {
    const s = createIntentSource(CFG)
    const w = fakeWindow()
    bindKeyboard(s, w as never)
    const prevented = vi.fn()
    w.fire('keydown', { key: ' ', preventDefault: prevented })
    expect(s.read(0).jump).toBe(true)
    expect(prevented).toHaveBeenCalled()
  })

  it('leaves keys it does not own alone', () => {
    const s = createIntentSource(CFG)
    const w = fakeWindow()
    bindKeyboard(s, w as never)
    const prevented = vi.fn()
    w.fire('keydown', { key: 'Tab', preventDefault: prevented })
    expect(prevented).not.toHaveBeenCalled()
    expect(s.read(0).move).toBe(0)
  })

  // A key held while the tab loses focus never sends its keyup.
  it('lets go of everything when the window is blurred', () => {
    const s = createIntentSource(CFG)
    const w = fakeWindow()
    bindKeyboard(s, w as never)
    w.fire('keydown', { key: 'ArrowRight' })
    w.fire('blur')
    expect(s.read(0).move).toBe(0)
  })

  it('unbinds everything it bound', () => {
    const s = createIntentSource(CFG)
    const w = fakeWindow()
    const off = bindKeyboard(s, w as never)
    off()
    expect(w.count('keydown')).toBe(0)
    expect(w.count('keyup')).toBe(0)
    expect(w.count('blur')).toBe(0)
  })
})
