import { createRoot } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createReducedMotion } from './reduced-motion'

type Listener = (event: MediaQueryListEvent) => void

/** A `matchMedia` whose answer the test sets. jsdom ships none. */
const fakeMedia = (
  matches: boolean,
): { flip(to: boolean): void; listening(): number } => {
  const listeners = new Set<Listener>()
  const query = {
    matches,
    addEventListener: (_type: string, l: Listener) => void listeners.add(l),
    removeEventListener: (_type: string, l: Listener) =>
      void listeners.delete(l),
  }
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: () => query,
  })
  return {
    flip(to) {
      query.matches = to
      for (const l of listeners) l({ matches: to } as MediaQueryListEvent)
    },
    listening: () => listeners.size,
  }
}

let original: PropertyDescriptor | undefined

beforeEach(() => {
  original = Object.getOwnPropertyDescriptor(window, 'matchMedia')
})

afterEach(() => {
  if (original === undefined) {
    delete (window as { matchMedia?: unknown }).matchMedia
  } else {
    Object.defineProperty(window, 'matchMedia', original)
  }
})

describe('createReducedMotion', () => {
  it('reads the preference as it stands', () => {
    fakeMedia(true)
    createRoot((dispose) => {
      expect(createReducedMotion()()).toBe(true)
      dispose()
    })
  })

  it('follows the setting when it changes with the screen open', () => {
    const media = fakeMedia(false)
    createRoot((dispose) => {
      const reduced = createReducedMotion()
      expect(reduced()).toBe(false)
      media.flip(true)
      expect(reduced()).toBe(true)
      media.flip(false)
      expect(reduced()).toBe(false)
      dispose()
    })
  })

  it('stops listening when its owner goes', () => {
    const media = fakeMedia(false)
    createRoot((dispose) => {
      createReducedMotion()
      expect(media.listening()).toBe(1)
      dispose()
    })
    expect(media.listening()).toBe(0)
  })

  it('answers no where there is no matchMedia at all', () => {
    delete (window as { matchMedia?: unknown }).matchMedia
    createRoot((dispose) => {
      expect(createReducedMotion()()).toBe(false)
      dispose()
    })
  })
})
