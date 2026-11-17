// The room's console as a dock at the window's foot (foot-dock.ts): the web
// says how much of the foot lies under the room's stage, and the native
// app, which shows a notice in its own pill, says nothing.

import { createRoot } from 'solid-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type * as NativeBuild from '@/lib/native-build'

const build = vi.hoisted(() => ({ native: false }))
vi.mock('@/lib/native-build', async (importOriginal) => ({
  ...(await importOriginal<typeof NativeBuild>()),
  get IS_NATIVE_BUILD() {
    return build.native
  },
}))

const { dock, PAGE_DOCK_SPACE } = await import('./foot-dock')

const published = (): string =>
  document.documentElement.style.getPropertyValue(PAGE_DOCK_SPACE)

/** A stage whose foot is `above` px over the window's. */
function stage(above: number): HTMLElement {
  const el = document.createElement('div')
  el.getBoundingClientRect = () =>
    ({ bottom: window.innerHeight - above }) as DOMRect
  document.body.appendChild(el)
  return el
}

afterEach(() => {
  build.native = false
  document.body.innerHTML = ''
  document.documentElement.removeAttribute('style')
})

describe("the drill room's console as a dock", () => {
  it('publishes what lies under the stage while the room is up, on the web', () => {
    const dispose = createRoot((done) => {
      dock(stage(288))
      return done
    })
    expect(published()).toBe('288px')

    dispose()
    expect(published()).toBe('')
  })

  it('publishes nothing in the native app', () => {
    build.native = true
    const dispose = createRoot((done) => {
      dock(stage(288))
      return done
    })
    expect(published()).toBe('')
    dispose()
  })
})
