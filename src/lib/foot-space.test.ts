import { createRoot } from 'solid-js'
import { afterEach, describe, expect, it } from 'vitest'
import { publishFootSpace } from './foot-space'

// The layers pinned to the foot of a phone screen stand on each other through
// what each publishes on <html> (src/e2e/toast-above-confirm-bar.spec.ts).
// jsdom lays nothing out, so every element here is 0px tall and its room is
// its `bottom`; the browser spec measures real heights.

const VAR = '--test-foot-space'
const read = (name = VAR): string =>
  document.documentElement.style.getPropertyValue(name)

function pinned(bottom: string): HTMLElement {
  const el = document.createElement('div')
  el.style.position = 'fixed'
  el.style.bottom = bottom
  document.body.appendChild(el)
  return el
}

afterEach(() => {
  document.body.innerHTML = ''
  document.documentElement.removeAttribute('style')
})

describe('publishFootSpace', () => {
  it('publishes the room the element takes while its owner lives', () => {
    const el = pinned('16px')
    const dispose = createRoot((done) => {
      publishFootSpace(el, VAR)
      return done
    })
    expect(read()).toBe('16px')

    dispose()
    expect(read()).toBe('')
  })

  it('publishes nothing for an element CSS hides at this width', () => {
    // The confirm bar's desktop pill on a phone: it takes no room, so it
    // must not lift the toasts.
    const el = pinned('18px')
    el.style.display = 'none'
    const dispose = createRoot((done) => {
      publishFootSpace(el, VAR)
      return done
    })
    expect(read()).toBe('')
    dispose()
  })

  it('measures again when a layer below it publishes, and settles', async () => {
    // The confirm bar stands on the cookie banner without resizing when the
    // banner opens; the banner's space landing on <html> is the cue.
    const el = pinned('18px')
    const dispose = createRoot((done) => {
      publishFootSpace(el, VAR)
      return done
    })
    expect(read()).toBe('18px')

    el.style.bottom = '182px'
    document.documentElement.style.setProperty('--below-space', '174px')
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(read()).toBe('182px')
    dispose()
  })
})
