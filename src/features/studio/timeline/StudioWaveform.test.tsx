// Studio waveform drawing tests — one prop read a draw, a kept bitmap, a colour read once a theme and no drawing out of view.
import { cleanup, render } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { studioFixture } from '@/lib/studio/model/model.test-fixtures'
import type { StudioClip } from '@/lib/studio/model/types'
import { StudioWaveform } from './StudioWaveform'
import { createStudioWaveformResource } from './waveform-resource'

const frames = new Map<number, FrameRequestCallback>()
let nextFrame = 0
let draws = 0
const restore: (() => void)[] = []

function flushFrames(): void {
  const due = [...frames.values()]
  frames.clear()
  for (const callback of due) callback(performance.now())
}

/** Shadow a prototype property for one test. */
function shadow(
  target: object,
  key: string,
  descriptor: PropertyDescriptor,
): void {
  const own = Object.getOwnPropertyDescriptor(target, key)
  Object.defineProperty(target, key, { configurable: true, ...descriptor })
  restore.push(() => {
    if (own) Object.defineProperty(target, key, own)
    else Reflect.deleteProperty(target, key)
  })
}

beforeEach(() => {
  frames.clear()
  draws = 0
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    frames.set(++nextFrame, callback)
    return nextFrame
  })
  vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id))
  // A 2D context that accepts every call; a draw starts with setTransform.
  const calls = new Map<PropertyKey, unknown>()
  const context = new Proxy(
    {},
    {
      get: (_, key) => {
        if (key === 'setTransform')
          return () => {
            draws++
          }
        if (!calls.has(key)) calls.set(key, () => {})
        return calls.get(key)
      },
      set: (_, key, value) => {
        calls.set(key, value)
        return true
      },
    },
  )
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(((
    kind: string,
  ) =>
    kind === '2d'
      ? context
      : null) as unknown as typeof HTMLCanvasElement.prototype.getContext)
  // jsdom lays nothing out: the canvas reports an 800 by 60 box.
  shadow(HTMLCanvasElement.prototype, 'clientWidth', { get: () => 800 })
  shadow(HTMLCanvasElement.prototype, 'clientHeight', { get: () => 60 })
  shadow(HTMLCanvasElement.prototype, 'getBoundingClientRect', {
    value: () => new DOMRect(0, 0, 800, 60),
  })
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  for (const undo of restore.splice(0).reverse()) undo()
  document.documentElement.removeAttribute('data-theme')
})

const pending = () => createStudioWaveformResource(() => new Promise(() => {}))

describe('Studio waveform drawing', () => {
  it('reads its source frames once a draw, not once a column of the fade curve', () => {
    const { clip, asset } = studioFixture()
    const resource = pending()
    let reads = 0
    const props = {
      clip,
      asset,
      resource,
      width: 800,
      get sourceInFrame() {
        reads++
        return 0
      },
      get sourceOutFrame() {
        reads++
        return 1000
      },
    }
    render(() => <StudioWaveform {...props} />)
    reads = 0
    flushFrames()
    expect(draws).toBe(1)
    expect(reads).toBeLessThanOrEqual(2)
    resource.dispose()
  })

  it('keeps the bitmap when a redraw has the same size', () => {
    const widths: number[] = []
    const width = Object.getOwnPropertyDescriptor(
      HTMLCanvasElement.prototype,
      'width',
    )!
    shadow(HTMLCanvasElement.prototype, 'width', {
      get(this: HTMLCanvasElement) {
        return width.get!.call(this)
      },
      set(this: HTMLCanvasElement, value: number) {
        widths.push(value)
        width.set!.call(this, value)
      },
    })
    const { clip, asset } = studioFixture()
    const resource = pending()
    const [gain, setGain] = createSignal(-6)
    render(() => (
      <StudioWaveform
        clip={{ ...clip, gainDb: gain() }}
        asset={asset}
        resource={resource}
        width={800}
        sourceInFrame={0}
        sourceOutFrame={1000}
      />
    ))
    flushFrames()
    setGain(-3)
    flushFrames()
    expect(draws).toBe(2)
    expect(widths).toHaveLength(1)
    resource.dispose()
  })

  it('reads the drawn colour again only for a new theme or lane colour', async () => {
    const style = vi.spyOn(globalThis, 'getComputedStyle')
    const canvasReads = () =>
      style.mock.calls.filter(
        ([element]) => element instanceof HTMLCanvasElement,
      ).length
    const { clip, asset } = studioFixture()
    const resource = pending()
    const [gain, setGain] = createSignal(-6)
    const [color, setColor] = createSignal('hsl(30 70% 50%)')
    render(() => (
      <StudioWaveform
        clip={{ ...clip, gainDb: gain() } satisfies StudioClip}
        asset={asset}
        resource={resource}
        width={800}
        color={color()}
        sourceInFrame={0}
        sourceOutFrame={1000}
      />
    ))
    flushFrames()
    setGain(-3)
    flushFrames()
    expect(draws).toBe(2)
    expect(canvasReads()).toBe(1)
    document.documentElement.setAttribute('data-theme', 'light')
    // A mutation observer reports in a microtask.
    await Promise.resolve()
    flushFrames()
    expect(canvasReads()).toBe(2)
    setColor('hsl(200 70% 50%)')
    flushFrames()
    expect(canvasReads()).toBe(3)
    resource.dispose()
  })

  it('waits to draw a canvas the timeline does not show', () => {
    let report: ((seen: boolean) => void) | undefined
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(callback: IntersectionObserverCallback) {
          report = (seen) =>
            callback(
              [{ isIntersecting: seen } as IntersectionObserverEntry],
              this as unknown as IntersectionObserver,
            )
        }
        observe() {}
        disconnect() {}
      },
    )
    const { clip, asset } = studioFixture()
    const resource = pending()
    const [gain, setGain] = createSignal(-6)
    render(() => (
      <StudioWaveform
        clip={{ ...clip, gainDb: gain() }}
        asset={asset}
        resource={resource}
        width={800}
        sourceInFrame={0}
        sourceOutFrame={1000}
      />
    ))
    flushFrames()
    report!(false)
    setGain(-3)
    flushFrames()
    expect(draws).toBe(0)
    report!(true)
    flushFrames()
    expect(draws).toBe(1)
    resource.dispose()
  })
})
