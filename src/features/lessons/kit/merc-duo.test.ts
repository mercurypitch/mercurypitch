// Merc duo: Merc and Tavi step in once each says ready, and stay stills if not.
//
// The renderer is faked at its mount(): it puts a canvas in the host, as the
// real one does, and says ready, or fails, when a test says so. Whether the
// real renderer says ready only once its shader has linked is stage.test.ts's
// to prove.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as GateModule from '@/lib/merc/gpu-gate'
import { LIVE_MERC_WAIT_MS } from '@/lib/merc/gpu-gate'
import type { MercMountOptions } from '@/lib/merc/renderer'
import type * as DuoModule from './merc-duo'

const renderer = vi.hoisted(() => ({
  mounts: [] as { host: HTMLElement; opts: MercMountOptions }[],
  destroyed: [] as HTMLElement[],
}))

vi.mock('@/lib/merc/gpu-gate', async (importActual) => ({
  ...(await importActual<typeof GateModule>()),
  canRunLiveMerc: () => true,
}))

vi.mock('@/lib/merc/renderer', () => ({
  mount: (host: HTMLElement, opts: MercMountOptions) => {
    renderer.mounts.push({ host, opts })
    host.appendChild(document.createElement('canvas'))
    return {
      setLook: () => undefined,
      setPoseBias: () => undefined,
      setPaused: () => undefined,
      setState: () => undefined,
      setVoice: () => undefined,
      destroy: () => {
        renderer.destroyed.push(host)
      },
    }
  },
}))

/** The duo module, fresh: its Mercs and its mercsReady belong to one page. */
async function duo(): Promise<typeof DuoModule> {
  vi.resetModules()
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }))
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      observe(): void {}
      disconnect(): void {}
    },
  )
  return import('./merc-duo')
}

/** The lesson's stage: each Merc a still with a host for his live canvas. */
function stage(): HTMLElement {
  document.body.innerHTML = `
    <div class="duo" id="stage">
      <div class="merc" id="mercBlue"><img alt="" /><div class="live"></div></div>
      <div class="merc" id="mercOrange"><img alt="" /><div class="live"></div></div>
    </div>`
  return document.querySelector<HTMLElement>('#stage')!
}

const mercEl = (id: string): HTMLElement =>
  document.querySelector<HTMLElement>(`#${id}`)!

/** The renderer mounted into this Merc's host. */
function mounted(id: string): MercMountOptions {
  const found = renderer.mounts.find((m) => mercEl(id).contains(m.host))
  if (!found) throw new Error(`no renderer mounted for ${id}`)
  return found.opts
}

/** Lets the renderer's chunk arrive and what waits on it run. */
async function flush(): Promise<void> {
  await vi.dynamicImportSettled()
  for (let turn = 0; turn < 5; turn++) await Promise.resolve()
}

/** True once `p` has settled, checked after a flush. */
function settledFlag(p: Promise<void>): () => boolean {
  let settled = false
  void p.then(() => {
    settled = true
  })
  return () => settled
}

beforeEach(() => {
  renderer.mounts = []
  renderer.destroyed = []
  localStorage.clear()
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  document.body.innerHTML = ''
})

describe('initMercs', () => {
  it('keeps each still up until its Merc says ready, then lets him step in', async () => {
    // Arrange
    const m = await duo()
    void m.initMercs(stage())
    const settled = settledFlag(m.mercsReady)
    await flush()
    const liveBefore = ['mercBlue', 'mercOrange'].filter((id) =>
      mercEl(id).classList.contains('is-live'),
    )

    // Act
    mounted('mercBlue').onReady!()
    await flush()
    const settledAfterBlue = settled()
    mounted('mercOrange').onReady!()
    await flush()

    // Assert
    expect(liveBefore).toEqual([])
    expect(settledAfterBlue).toBe(false)
    expect(mercEl('mercBlue').classList.contains('is-live')).toBe(true)
    expect(mercEl('mercOrange').classList.contains('is-live')).toBe(true)
    expect(settled()).toBe(true)
    expect(renderer.destroyed).toEqual([])
  })

  it('mounts Tavi once Merc is ready, as Merc was mounted, so her shader is his', async () => {
    // Arrange
    const m = await duo()
    void m.initMercs(stage())
    await flush()
    const mountsBeforeReady = renderer.mounts.length

    // Act
    mounted('mercBlue').onReady!()
    await flush()

    // Assert
    const own = (o: MercMountOptions): MercMountOptions => ({
      ...o,
      onReady: undefined,
      onFailure: undefined,
    })
    expect(mountsBeforeReady).toBe(1)
    expect(renderer.mounts).toHaveLength(2)
    expect(own(mounted('mercOrange'))).toEqual(own(mounted('mercBlue')))
  })

  it('keeps the still and frees the renderer of a Merc not ready in time', async () => {
    // Arrange
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const m = await duo()
    void m.initMercs(stage())
    const settled = settledFlag(m.mercsReady)
    await flush()
    mounted('mercBlue').onReady!()
    await flush()

    // Act
    vi.advanceTimersByTime(LIVE_MERC_WAIT_MS)
    await flush()

    // Assert
    const orange = mercEl('mercOrange')
    expect(orange.classList.contains('is-live')).toBe(false)
    expect(orange.querySelector('canvas')).toBeNull()
    expect(orange.querySelector('img')).not.toBeNull()
    expect(renderer.destroyed).toEqual([orange.querySelector('.live')])
    expect(mercEl('mercBlue').classList.contains('is-live')).toBe(true)
    expect(settled()).toBe(true)
  })

  it.each([
    ['fails', () => mounted('mercBlue').onFailure!(new Error('no context'))],
    ['is not ready in time', () => vi.advanceTimersByTime(LIVE_MERC_WAIT_MS)],
  ])('leaves Tavi a still, never mounted, when Merc %s', async (_, ends) => {
    // Arrange
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const m = await duo()
    void m.initMercs(stage())
    const settled = settledFlag(m.mercsReady)
    await flush()

    // Act
    ends()
    await flush()

    // Assert
    const orange = mercEl('mercOrange')
    expect(renderer.mounts).toHaveLength(1)
    expect(renderer.destroyed).toEqual([
      mercEl('mercBlue').querySelector('.live'),
    ])
    expect(orange.classList.contains('is-live')).toBe(false)
    expect(orange.querySelector('canvas')).toBeNull()
    expect(settled()).toBe(true)
  })

  it('counts only the time the page is on screen before it gives up on Merc', async () => {
    // Arrange
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const visibility = vi
      .spyOn(document, 'visibilityState', 'get')
      .mockReturnValue('hidden')
    const m = await duo()
    void m.initMercs(stage())
    await flush()
    // An earlier test's Tavi may still be waiting, so this page's Merc is
    // looked for by his own host.
    const blueHost = mercEl('mercBlue').querySelector<HTMLElement>('.live')
    const gaveUp = (): boolean => renderer.destroyed.includes(blueHost!)

    // Act
    vi.advanceTimersByTime(LIVE_MERC_WAIT_MS * 3)
    const gaveUpHidden = gaveUp()
    visibility.mockReturnValue('visible')
    document.dispatchEvent(new Event('visibilitychange'))
    vi.advanceTimersByTime(LIVE_MERC_WAIT_MS - 1)
    const gaveUpShortOfWait = gaveUp()
    vi.advanceTimersByTime(1)
    await flush()

    // Assert
    expect(gaveUpHidden).toBe(false)
    expect(gaveUpShortOfWait).toBe(false)
    expect(gaveUp()).toBe(true)
    expect(mercEl('mercBlue').classList.contains('is-live')).toBe(false)
  })

  it('takes a Merc who fails back to his still and lets his renderer go', async () => {
    // Arrange
    const m = await duo()
    void m.initMercs(stage())
    await flush()
    mounted('mercBlue').onReady!()
    const blue = mercEl('mercBlue')
    const liveBefore = blue.classList.contains('is-live')

    // Act
    mounted('mercBlue').onFailure!(new Error('context lost for good'))

    // Assert
    expect(liveBefore).toBe(true)
    expect(blue.classList.contains('is-live')).toBe(false)
    expect(blue.querySelector('canvas')).toBeNull()
    expect(renderer.destroyed).toEqual([blue.querySelector('.live')])
  })
})
