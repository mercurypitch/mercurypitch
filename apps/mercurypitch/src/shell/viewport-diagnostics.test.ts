// Did the web view ever turn? The record says so from launch, one line per
// change, in the same ring the Audio section copies off the phone. A fresh
// module per case: the ring and the listeners are module state.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type Orientation = { type: string } & EventTarget

let orientation: Orientation

function turn(type: string, width: number, height: number): void {
  orientation.type = type
  vi.stubGlobal('innerWidth', width)
  vi.stubGlobal('innerHeight', height)
}

async function load() {
  const diagnostics = await import('@/lib/audio-diagnostics')
  const viewport = await import('./viewport-diagnostics')
  return { ...diagnostics, ...viewport }
}

const uninstalls: Array<() => void> = []

beforeEach(() => {
  vi.resetModules()
  vi.useFakeTimers()
  vi.spyOn(console, 'info').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  orientation = Object.assign(new EventTarget(), { type: 'portrait-primary' })
  vi.stubGlobal('screen', { orientation })
  turn('portrait-primary', 390, 844)
  const root = document.documentElement.style
  root.setProperty('--safe-top', '47px')
  root.setProperty('--safe-right', '0px')
  root.setProperty('--safe-bottom', '34px')
  root.setProperty('--safe-left', '0px')
})

afterEach(() => {
  for (const uninstall of uninstalls.splice(0)) uninstall()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  document.documentElement.removeAttribute('style')
})

describe('the viewport in the record', () => {
  it('writes where the app launched: orientation, size and the insets', async () => {
    const { audioDiagnosticEntries, installViewportDiagnostics } = await load()
    uninstalls.push(installViewportDiagnostics())

    const [launch] = audioDiagnosticEntries()
    expect(launch.source).toBe('viewport')
    expect(launch.event).toBe('launch')
    expect(launch.detail).toMatchObject({
      orientation: 'portrait-primary',
      w: 390,
      h: 844,
      safe: '47px 0px 34px 0px',
    })
  })

  it('writes a turn as the events that told the web view, then its settled size', async () => {
    const {
      audioDiagnosticEntries,
      formatAudioDiagnostics,
      installViewportDiagnostics,
    } = await load()
    uninstalls.push(installViewportDiagnostics())

    turn('landscape-primary', 844, 390)
    window.dispatchEvent(new Event('orientationchange'))
    orientation.dispatchEvent(new Event('change'))
    // A turn is a burst of resizes; the record keeps the one it settles on.
    window.dispatchEvent(new Event('resize'))
    window.dispatchEvent(new Event('resize'))
    vi.advanceTimersByTime(250)

    expect(
      audioDiagnosticEntries().map((e) => [e.event, e.detail.orientation]),
    ).toEqual([
      ['launch', 'portrait-primary'],
      ['orientationchange', 'landscape-primary'],
      ['orientation', 'landscape-primary'],
      ['resize', 'landscape-primary'],
    ])
    const resize = audioDiagnosticEntries().at(-1)
    expect(resize?.detail).toMatchObject({ w: 844, h: 390 })
    // The line the Copy button carries off the phone.
    expect(formatAudioDiagnostics()).toMatch(
      /viewport resize orientation=landscape-primary w=844 h=390 safe=47px 0px 34px 0px/u,
    )
  })

  it('writes nothing for a resize that changed nothing it reads', async () => {
    const { audioDiagnosticEntries, installViewportDiagnostics } = await load()
    uninstalls.push(installViewportDiagnostics())
    window.dispatchEvent(new Event('resize'))
    vi.advanceTimersByTime(250)
    expect(audioDiagnosticEntries().map((e) => e.event)).toEqual(['launch'])
  })

  it('answers "not available" where the web view has no screen.orientation', async () => {
    vi.stubGlobal('screen', {})
    const { audioDiagnosticEntries, installViewportDiagnostics } = await load()
    uninstalls.push(installViewportDiagnostics())
    expect(audioDiagnosticEntries()[0].detail.orientation).toBe('not available')
  })

  it('stops listening once uninstalled', async () => {
    const { audioDiagnosticEntries, installViewportDiagnostics } = await load()
    installViewportDiagnostics()()
    turn('landscape-primary', 844, 390)
    window.dispatchEvent(new Event('orientationchange'))
    window.dispatchEvent(new Event('resize'))
    vi.advanceTimersByTime(250)
    expect(audioDiagnosticEntries().map((e) => e.event)).toEqual(['launch'])
  })
})

describe('the rows', () => {
  it('say the orientation and the size', async () => {
    const { orientationRow } = await load()
    turn('landscape-secondary', 852, 393)
    expect(orientationRow()).toBe('landscape-secondary · 852 x 393')
  })

  it('say each inset as the custom property resolves, and as a box gets it', async () => {
    const { safeInsetsRow } = await load()
    const real = window.getComputedStyle.bind(window)
    // jsdom resolves no var() in a padding; a phone does.
    vi.spyOn(window, 'getComputedStyle').mockImplementation((element) => {
      const style = real(element)
      if (!(element as HTMLElement).hasAttribute('data-viewport-probe')) {
        return style
      }
      return Object.assign(Object.create(style) as CSSStyleDeclaration, {
        paddingTop: '47px',
        paddingRight: '0px',
        paddingBottom: '34px',
        paddingLeft: '0px',
      })
    })
    expect(safeInsetsRow()).toBe('47px 0px 34px 0px · in use 47 0 34 0')
    // The probe box is gone again.
    expect(document.querySelector('[data-viewport-probe]')).toBeNull()
  })

  it('show an env() the engine did not substitute, verbatim (PR 859 NB10)', async () => {
    const { safeInsetsRow } = await load()
    document.documentElement.style.setProperty(
      '--safe-right',
      'env(safe-area-inset-right, 0px)',
    )
    expect(safeInsetsRow()).toMatch(
      /^47px env\(safe-area-inset-right, 0px\) 34px 0px · in use /u,
    )
  })
})
