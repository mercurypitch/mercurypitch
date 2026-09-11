// Media-edge tests keep decorative motion out of capture and retire every decoder.
import { cleanup, fireEvent, render } from '@solidjs/testing-library'
import { createSignal, untrack } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GuitarRecorderArtwork } from './GuitarRecorderArtwork'

let preference: EventTarget & { matches: boolean }
let intersect: (entries: { isIntersecting: boolean }[]) => void
let visible = true
let disconnected = false
const media = new Map<HTMLMediaElement, boolean>()

beforeEach(() => {
  visible = true
  disconnected = false
  media.clear()
  preference = Object.assign(new EventTarget(), { matches: false })
  vi.stubGlobal('matchMedia', () => preference)
  vi.stubGlobal('CSS', { supports: () => true })
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(callback: typeof intersect) {
        intersect = callback
      }
      observe() {
        intersect([{ isIntersecting: true }])
      }
      disconnect() {
        disconnected = true
      }
    },
  )
  vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() =>
    visible ? 'visible' : 'hidden',
  )
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(function (
    this: HTMLMediaElement,
  ) {
    media.set(this, true)
    return Promise.resolve()
  })
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(function (
    this: HTMLMediaElement,
  ) {
    media.set(this, false)
  })
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(
    () => undefined,
  )
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

function setup(initial = false) {
  const [recording, setRecording] = createSignal(initial)
  const view = render(() => <GuitarRecorderArtwork recording={recording()} />)
  // Decorative media deliberately has no accessibility role or visible label.
  const video = () => view.container.querySelector('video')
  const still = () => view.container.querySelector('img')
  return { ...view, setRecording, video, still }
}

describe('recorder reel motion', () => {
  it('does not load video while idle and retires it immediately when capture ends', () => {
    const view = setup()
    expect(view.video()).toBeNull()
    expect(media.size).toBe(0)
    view.setRecording(true)
    const video = view.video()!
    expect(media.get(video)).toBe(true)
    expect(video.muted).toBe(true)
    expect(video.loop).toBe(true)
    expect(video.tabIndex).toBe(-1)
    expect(video).toHaveAttribute('data-playing', 'false')
    fireEvent.playing(video)
    expect(video).toHaveAttribute('data-playing', 'true')
    view.setRecording(false)
    expect(view.video()).toBeNull()
    expect(media.get(video)).toBe(false)
    expect(video.getAttribute('src')).toBeNull()
    expect(view.still()).toHaveAttribute(
      'src',
      '/guitar-night/melody-recorder.webp',
    )
  })

  it.each(['reduced motion', 'hidden document', 'offscreen'] as const)(
    'pauses and releases video for %s and resumes only while still recording',
    (reason) => {
      const view = setup(true)
      const video = view.video()!
      const change = (blocked: boolean) => {
        if (reason === 'reduced motion') {
          preference.matches = blocked
          preference.dispatchEvent(new Event('change'))
        } else if (reason === 'hidden document') {
          visible = !blocked
          document.dispatchEvent(new Event('visibilitychange'))
        } else intersect([{ isIntersecting: !blocked }])
      }
      change(true)
      expect(view.video()).toBeNull()
      expect(media.get(video)).toBe(false)
      expect(video.getAttribute('src')).toBeNull()
      change(false)
      expect(media.get(view.video()!)).toBe(true)
      view.setRecording(false)
      change(true)
      change(false)
      expect(view.video()).toBeNull()
    },
  )

  it('never loads motion for an existing reduced-motion preference or unsupported mask', () => {
    preference.matches = true
    const view = setup(true)
    expect(view.video()).toBeNull()
    expect(media.size).toBe(0)
    view.unmount()
    preference.matches = false
    vi.stubGlobal('CSS', { supports: () => false })
    expect(setup(true).video()).toBeNull()
    expect(media.size).toBe(0)
    vi.stubGlobal('CSS', {})
    expect(setup(true).video()).toBeNull()
    expect(media.size).toBe(0)
  })

  it('keeps the still after media failure without retrying each capture or losing the button action', () => {
    const [recording, setRecording] = createSignal(true)
    const view = render(() => (
      <button onClick={() => setRecording(!recording())}>
        {recording() ? 'Stop' : 'Record'}
        <GuitarRecorderArtwork recording={recording()} />
      </button>
    ))
    const video = view.container.querySelector('video')!
    fireEvent.error(video)
    expect(media.get(video)).toBe(false)
    expect(view.container.querySelector('video')).toBeNull()
    fireEvent.click(view.getByRole('button', { name: 'Stop' }))
    fireEvent.click(view.getByRole('button', { name: 'Record' }))
    expect(untrack(recording)).toBe(true)
    expect(view.container.querySelector('video')).toBeNull()
    expect(media.size).toBe(1)
  })

  it('does not let an obsolete play rejection poison a new capture', async () => {
    let reject!: (error: Error) => void
    vi.mocked(HTMLMediaElement.prototype.play).mockImplementationOnce(function (
      this: HTMLMediaElement,
    ) {
      media.set(this, true)
      return new Promise<void>((_, fail) => {
        reject = fail
      })
    })
    const view = setup(true)
    const oldVideo = view.video()!
    view.setRecording(false)
    view.setRecording(true)
    const newVideo = view.video()!
    fireEvent.error(oldVideo)
    reject(new Error('Aborted play'))
    await Promise.resolve()
    expect(view.video()).toBe(newVideo)
    expect(media.get(newVideo)).toBe(true)
    expect(media.get(oldVideo)).toBe(false)
    view.unmount()
    expect(media.get(newVideo)).toBe(false)
    expect(disconnected).toBe(true)
  })

  it('falls back when the current play permission is denied', async () => {
    vi.mocked(HTMLMediaElement.prototype.play).mockRejectedValueOnce(
      new Error('Not allowed'),
    )
    const view = setup(true)
    await Promise.resolve()
    expect(view.video()).toBeNull()
    expect(view.still()).toBeInTheDocument()
  })
})
