import { createRoot, createSignal } from 'solid-js'
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

  it('publishes what lies under a stage, when asked for what is below it', () => {
    // The stage of Merc's room: its console stands under it, 300px of the
    // window's foot, whatever the stage's own height and `bottom` say.
    const el = pinned('0px')
    el.getBoundingClientRect = () =>
      ({ bottom: window.innerHeight - 300 }) as DOMRect
    const dispose = createRoot((done) => {
      publishFootSpace(el, VAR, 'below')
      return done
    })
    expect(read()).toBe('300px')

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

  it('counts what lies under a bar in the page flow, a relative one too', () => {
    // A phone stage's transport is `position: relative` (the count-in badge
    // hangs from it), which reads `bottom: 0px`; the tab bar under it, 62 px
    // of the window's foot, is its gap all the same.
    const el = document.createElement('div')
    el.style.position = 'relative'
    // As a browser resolves a relative box's `bottom: auto`.
    el.style.bottom = '0px'
    document.body.appendChild(el)
    el.getBoundingClientRect = () =>
      ({ bottom: window.innerHeight - 62 }) as DOMRect
    const dispose = createRoot((done) => {
      publishFootSpace(el, VAR)
      return done
    })
    expect(read()).toBe('62px')
    dispose()
  })

  it('publishes only while its condition holds, and follows it as it turns', () => {
    // The Singing stage's transport spans the foot upright, and the notices
    // stand on it; on its side it is in the stage's left column, beside
    // them, and must not lift them.
    const el = pinned('20px')
    const [upright, setUpright] = createSignal(true)
    const dispose = createRoot((done) => {
      publishFootSpace(el, VAR, 'self', upright)
      return done
    })
    expect(read()).toBe('20px')

    setUpright(false)
    expect(read()).toBe('')

    setUpright(true)
    expect(read()).toBe('20px')
    dispose()
    expect(read()).toBe('')
  })

  it('publishes how far a column reaches across the foot, when asked for what is beside it', () => {
    // Karaoke's stage on its side: its bar is in a 320 px column, and the
    // notices stand to the right of it.
    const el = pinned('0px')
    el.getBoundingClientRect = () => ({ right: 335.5 }) as DOMRect
    const dispose = createRoot((done) => {
      publishFootSpace(el, VAR, 'beside')
      return done
    })
    expect(read()).toBe('336px')

    dispose()
    expect(read()).toBe('')
  })
})
