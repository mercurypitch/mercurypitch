// ============================================================
// EchoRoomFixture: the Echo room as a stop of the Warm-up, pinned
// ============================================================

import { cleanup, render, screen, waitFor } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resetPlatesForTests } from '@/components/room-kit/plate-loader'
import { EchoRoomFixture, isRoomFixtureName, ROOM_FIXTURES, } from './EchoRoomFixture'
import { mountEchoFixture } from './mount-echo-fixture'

vi.mock('@/lib/merc/stage', () => ({
  mountMercStage: () => ({
    ok: true,
    setState: () => undefined,
    setVoice: () => undefined,
    setPaused: () => undefined,
    destroy: () => undefined,
  }),
}))

beforeEach(() => {
  // jsdom never runs a frame: the fixture's two settling frames run here.
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) =>
    setTimeout(() => cb(performance.now()), 0),
  )
  vi.stubGlobal('cancelAnimationFrame', (id: number) => clearTimeout(id))
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe(): void {}
      disconnect(): void {}
    },
  )
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(390)
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(844)
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
  // jsdom loads no pictures: every plate decodes at once.
  Object.defineProperty(HTMLImageElement.prototype, 'decode', {
    configurable: true,
    value: () => Promise.resolve(),
  })
})

afterEach(() => {
  resetPlatesForTests()
  Reflect.deleteProperty(HTMLImageElement.prototype, 'decode')
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})

describe("the Echo room's Warm-up fixtures", () => {
  it('opens as the last stop: its chip, Merc\'s cue and "Skip stop", no level', async () => {
    render(() => <EchoRoomFixture name="warm-intro" />)

    const page = screen.getByTestId('echo-room-fixture')
    await waitFor(() => expect(page.dataset.ready).toBe('true'))
    expect(screen.getByTestId('echo-room').dataset.phase).toBe('intro')
    expect(screen.getByTestId('echo-chip').textContent).toBe('Warm-up 4 of 4')
    expect(screen.getByTestId('echo-bubble').textContent).toBe(
      'I sing it first. Then you sing it back.',
    )
    expect(screen.getByTestId('echo-skip-stop')).toBeTruthy()
    expect(screen.queryByTestId('echo-level')).toBeNull()
  })

  it("holds a three-phrase result on the result's first, third and fifth places", async () => {
    render(() => <EchoRoomFixture name="warm-result" />)

    const page = screen.getByTestId('echo-room-fixture')
    await waitFor(() => expect(page.dataset.ready).toBe('true'))
    expect(screen.getByTestId('echo-room').dataset.phase).toBe('result')
    expect(screen.getByTestId('echo-result').textContent).toContain('8 of 9')
    expect(screen.queryByTestId('echo-again')).toBeNull()
    expect(screen.queryByTestId('echo-done')).toBeNull()
    expect(screen.getByTestId('echo-routine-on')).toBeTruthy()
    // Eight stars lit and a dark ring for the one missed, over three places.
    const lit = screen
      .queryAllByTestId('echo-star')
      .filter((el) => el.dataset.size === 'result')
    expect(lit).toHaveLength(8)
    const missed = screen
      .queryAllByTestId('echo-ring')
      .filter((el) => el.getAttribute('data-style') === 'missed')
    expect(missed).toHaveLength(1)
  })

  it('names its two frames, and mounts them beside the art fixtures', () => {
    expect([...ROOM_FIXTURES]).toEqual(['warm-intro', 'warm-result'])
    expect(isRoomFixtureName('warm-result')).toBe(true)
    expect(isRoomFixtureName('intro')).toBe(false)
    expect(isRoomFixtureName(null)).toBe(false)

    const root = document.createElement('div')
    document.body.append(root)
    expect(mountEchoFixture(root, 'warm-intro')).toBe(true)
    expect(root.classList.contains('loaded')).toBe(true)
    expect(
      root.querySelector('[data-testid="echo-room-fixture"]'),
    ).not.toBeNull()
  })
})
