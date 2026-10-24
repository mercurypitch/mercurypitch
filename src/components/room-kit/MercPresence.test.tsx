// ============================================================
// MercPresence: his still without a GPU or with less motion, him live otherwise
// ============================================================
//
// Only the browser's edges are faked: its WebGL2 request (the GPU gate reads
// the answer for real), his stage (it puts a canvas in the host, as the
// renderer does, and says ready when a test says his first frame is drawn)
// and the screen's frames, which a test runs by hand.

import { render, screen } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi, } from 'vitest'
import type { MercState } from '@/lib/merc/constants'
import { LIVE_MERC_WAIT_MS } from '@/lib/merc/gpu-gate'
import { MercPresence } from './MercPresence'
import { SILENT_VOICE } from './room-constants'

const STILL = '/onboarding/coach/merc-point.webp'
const STILL_LISTENING = '/onboarding/coach/merc-listen.webp'
const ALT = 'Merc, pointing the way'

const stage = vi.hoisted(() => ({
  mounts: [] as { state: string | undefined }[],
  states: [] as string[],
  voices: [] as unknown[],
  ready: [] as (() => void)[],
  destroyed: 0,
  ok: true,
}))

vi.mock('@/lib/merc/stage', () => ({
  mountMercStage: (
    host: HTMLElement,
    options: { state?: string; onReady?: () => void },
  ) => {
    stage.mounts.push({ state: options.state })
    // The renderer puts his canvas in the host, unless he cannot be drawn.
    if (stage.ok) host.appendChild(document.createElement('canvas'))
    if (stage.ok && options.onReady) stage.ready.push(options.onReady)
    return {
      ok: stage.ok,
      setState: (name: string) => stage.states.push(name),
      setVoice: (voice: unknown) => stage.voices.push(voice),
      setPaused: () => undefined,
      setStill: () => undefined,
      destroy: () => {
        stage.destroyed += 1
      },
    }
  },
}))

/** His stage has drawn his first frame, as the renderer says once his shader has linked. */
function firstFrameDrawn(): void {
  for (const ready of stage.ready) ready()
}

// The screen's frames, run by hand.
let frames: { id: number; run: FrameRequestCallback }[] = []
let lastFrameId = 0

/** One screen frame: runs what was asked for before it; later asks wait. */
function screenFrame(): void {
  const due = frames
  frames = []
  for (const frame of due) frame.run(0)
}

/** A few turns of the event loop, for what must NOT happen to have not happened. */
async function settle(): Promise<void> {
  for (let turn = 0; turn < 5; turn++) {
    await new Promise((resolve) => setTimeout(resolve, 0))
  }
}

/** The browser's answer to a WebGL2 request: a context from this renderer, or none. */
function browserDrawsWith(renderer: string | null): void {
  const gl =
    renderer === null
      ? null
      : { RENDERER: 1, getExtension: () => null, getParameter: () => renderer }
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(((
    id: string,
  ) =>
    id === 'webgl2'
      ? gl
      : null) as typeof HTMLCanvasElement.prototype.getContext)
}

const onAGpu = (): void => browserDrawsWith('ANGLE (NVIDIA GeForce RTX 3070)')
const onSoftware = (): void =>
  browserDrawsWith(
    'ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)))',
  )
const withoutWebGL = (): void => browserDrawsWith(null)

const asksForLessMotion = (): void => {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query === '(prefers-reduced-motion: reduce)',
  }))
}

/** The one MercPresence a screen mounts, dropping in. */
function presence() {
  return render(() => (
    <MercPresence
      state={() => 'drop'}
      stillSrc={STILL}
      alt={ALT}
      size={160}
      testId="plan-merc"
    />
  ))
}

beforeAll(async () => {
  // Warm his stage, which a wrongly mounted Merc would wait on, so that what a
  // test says did not happen had the time to happen.
  await import('@/lib/merc/stage')
})

beforeEach(() => {
  frames = []
  stage.mounts = []
  stage.states = []
  stage.voices = []
  stage.ready = []
  stage.destroyed = 0
  stage.ok = true
  vi.stubGlobal('requestAnimationFrame', (run: FrameRequestCallback) => {
    lastFrameId += 1
    frames.push({ id: lastFrameId, run })
    return lastFrameId
  })
  vi.stubGlobal('cancelAnimationFrame', (id: number) => {
    frames = frames.filter((frame) => frame.id !== id)
  })
  // Unless a test says otherwise, this browser has no WebGL at all. Bare
  // jsdom says as much too, but logs "Not implemented" while it does.
  withoutWebGL()
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('MercPresence without his live self', () => {
  it('shows the still when the singer asks for less motion', async () => {
    // Arrange: a GPU is there, so the singer's setting is the only reason.
    onAGpu()
    asksForLessMotion()

    // Act
    const { container } = presence()
    await settle()

    // Assert
    expect(screen.getByRole('img', { name: ALT })).toHaveAttribute('src', STILL)
    expect(container.querySelector('canvas')).toBeNull()
    expect(stage.mounts).toHaveLength(0)
  })

  it('shows the still when the browser has no GPU', async () => {
    // Arrange
    withoutWebGL()

    // Act
    const { container } = presence()
    await settle()

    // Assert
    expect(screen.getByRole('img', { name: ALT })).toHaveAttribute('src', STILL)
    expect(container.querySelector('canvas')).toBeNull()
    expect(stage.mounts).toHaveLength(0)
  })

  it('shows the still when the GPU is only software', async () => {
    // Arrange: WebGL2 answers, but from the CPU.
    onSoftware()

    // Act
    const { container } = presence()
    await settle()

    // Assert
    expect(screen.getByRole('img', { name: ALT })).toHaveAttribute('src', STILL)
    expect(container.querySelector('canvas')).toBeNull()
    expect(stage.mounts).toHaveLength(0)
  })

  it('keeps the still when his stage cannot draw', async () => {
    // Arrange
    onAGpu()
    stage.ok = false

    // Act
    const { container } = presence()
    await vi.waitFor(() => expect(stage.mounts).toHaveLength(1))
    screenFrame()
    screenFrame()
    screenFrame()

    // Assert
    expect(screen.getByTestId('plan-merc').dataset.presence).toBe('still')
    expect(container.querySelector('canvas')).toBeNull()
  })
})

describe('MercPresence on a GPU', () => {
  it('starts him with the pose asked for, and keeps the still up while he loads', async () => {
    // Arrange
    onAGpu()

    // Act
    presence()
    await vi.waitFor(() => expect(stage.mounts).toHaveLength(1))

    // Assert
    const live = screen.getByTestId('plan-merc-live')
    expect(live).toHaveAttribute('data-merc-state', 'drop')
    expect(live.querySelector('canvas')).not.toBeNull()
    expect(stage.mounts[0]).toEqual({ state: 'drop' })
    expect(screen.getByTestId('plan-merc').dataset.presence).toBe('still')
    expect(screen.getByRole('img', { name: ALT })).toHaveAttribute('src', STILL)
  })

  it('steps the still aside once his first frame has drawn, and not before', async () => {
    // Arrange
    onAGpu()
    presence()
    await vi.waitFor(() => expect(stage.mounts).toHaveLength(1))
    const host = screen.getByTestId('plan-merc')
    screenFrame()
    screenFrame()
    const whileLinking = host.dataset.presence

    // Act
    firstFrameDrawn()

    // Assert
    expect(whileLinking).toBe('still')
    expect(host.dataset.presence).toBe('live')
  })

  it('keeps the still and lets his stage go when his shader is not ready in time', async () => {
    // Arrange
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    onAGpu()
    presence()
    await vi.waitFor(() => expect(stage.mounts).toHaveLength(1))
    const host = screen.getByTestId('plan-merc')

    // Act
    vi.advanceTimersByTime(LIVE_MERC_WAIT_MS)

    // Assert
    expect(stage.destroyed).toBe(1)
    expect(screen.queryByTestId('plan-merc-live')).toBeNull()
    expect(host.querySelector('canvas')).toBeNull()
    expect(host.dataset.presence).toBe('still')
    expect(screen.getByRole('img', { name: ALT })).toHaveAttribute('src', STILL)
  })

  it('keeps a Merc who was ready in time, however long the screen stays', async () => {
    // Arrange
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    onAGpu()
    presence()
    await vi.waitFor(() => expect(stage.mounts).toHaveLength(1))
    firstFrameDrawn()

    // Act
    vi.advanceTimersByTime(LIVE_MERC_WAIT_MS * 3)

    // Assert
    expect(stage.destroyed).toBe(0)
    expect(screen.getByTestId('plan-merc').dataset.presence).toBe('live')
    expect(screen.getByTestId('plan-merc-live')).toBeInTheDocument()
  })

  it('counts only the time the page is on screen before it gives up on him', async () => {
    // Arrange
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const visibility = vi
      .spyOn(document, 'visibilityState', 'get')
      .mockReturnValue('hidden')
    onAGpu()
    presence()
    await vi.waitFor(() => expect(stage.mounts).toHaveLength(1))

    // Act
    vi.advanceTimersByTime(LIVE_MERC_WAIT_MS * 3)
    const destroyedHidden = stage.destroyed
    visibility.mockReturnValue('visible')
    document.dispatchEvent(new Event('visibilitychange'))
    vi.advanceTimersByTime(LIVE_MERC_WAIT_MS - 1)
    const destroyedShortOfWait = stage.destroyed
    vi.advanceTimersByTime(1)

    // Assert
    expect(destroyedHidden).toBe(0)
    expect(destroyedShortOfWait).toBe(0)
    expect(stage.destroyed).toBe(1)
    expect(screen.getByTestId('plan-merc').dataset.presence).toBe('still')
  })

  it('gives him no voice of his own to follow', async () => {
    // Arrange
    onAGpu()
    presence()
    await vi.waitFor(() => expect(stage.mounts).toHaveLength(1))

    // Act
    screenFrame()

    // Assert
    expect(stage.voices.at(-1)).toBe(SILENT_VOICE)
  })

  it('turns him to the pose the screen asks for next', async () => {
    // Arrange
    onAGpu()
    const [pose, setPose] = createSignal<MercState>('drop')
    render(() => (
      <MercPresence
        state={pose}
        stillSrc={STILL}
        alt={ALT}
        size={160}
        testId="plan-merc"
      />
    ))
    await vi.waitFor(() => expect(stage.mounts).toHaveLength(1))

    // Act
    setPose('hop')

    // Assert
    expect(stage.states).toEqual(['hop'])
  })

  it('stops waiting for his first frame when the screen leaves', async () => {
    // Arrange
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    onAGpu()
    const { unmount } = presence()
    await vi.waitFor(() => expect(stage.mounts).toHaveLength(1))

    // Act
    unmount()

    // Assert: nothing is left asking for a screen frame or a give-up.
    expect(frames).toHaveLength(0)
    expect(vi.getTimerCount()).toBe(0)
    expect(stage.destroyed).toBe(1)
  })
})

describe('MercPresence as a box on a screen', () => {
  it('takes the size and the class the screen gives it', () => {
    // Act
    render(() => (
      <MercPresence
        state={() => 'idle'}
        stillSrc={STILL}
        size={72}
        class="plan-merc-corner"
        testId="plan-merc"
      />
    ))

    // Assert
    const host = screen.getByTestId('plan-merc')
    expect(host).toHaveClass('plan-merc-corner')
    expect(host).toHaveStyle({ width: '72px', height: '72px' })
  })

  it('leaves the still out of the reading order unless the screen describes it', () => {
    // Act
    const { container } = render(() => (
      <MercPresence
        state={() => 'idle'}
        stillSrc={STILL}
        size={72}
        testId="plan-merc"
      />
    ))

    // Assert: no role to query by; an empty alt is the point.
    expect(screen.queryByRole('img')).toBeNull()
    expect(container.querySelector('img')).toHaveAttribute('alt', '')
  })

  it('shows a new still when the screen swaps it', () => {
    // Arrange
    const [still, setStill] = createSignal(STILL)
    render(() => (
      <MercPresence
        state={() => 'idle'}
        stillSrc={still()}
        alt={ALT}
        size={72}
        testId="plan-merc"
      />
    ))

    // Act
    setStill(STILL_LISTENING)

    // Assert
    expect(screen.getByRole('img', { name: ALT })).toHaveAttribute(
      'src',
      STILL_LISTENING,
    )
  })
})
