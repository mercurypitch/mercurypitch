// ============================================================
// The pushed screens the shell draws: only the top of the stack
// ============================================================

import { Capacitor } from '@capacitor/core'
import { resetPageAudioSessionForTests } from '@irchiinnuss/mobile-runtime/page-audio-session'
import { onCleanup } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// The Legend room is pushed only on a build with it (NATIVE_LEAGUES).
vi.mock('@/lib/native-build', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  NATIVE_LEAGUES: true,
}))

import { RoomAsk, RoomBarEnd } from '@/components/room-kit/RoomBar'
import { TAB_SINGING } from '@/features/tabs/constants'
import { setActiveTab } from '@/stores/ui-store'
import type { RenderedShell } from './render-for-test'
import { renderShell } from './render-for-test'
import { setOneVolumeInRooms } from './room-volume-switch'
import { pushScreen, resetRunShell } from './run-shell-store'
import { ShellScreens } from './ShellScreens'

let view: RenderedShell | null = null

function screens(): HTMLElement[] {
  return [
    ...(view?.container.querySelectorAll<HTMLElement>(
      '[data-testid="shell-pushed"]',
    ) ?? []),
  ]
}

function back(): void {
  view?.container
    .querySelector<HTMLButtonElement>('[data-testid="shell-pushed-back"]')
    ?.click()
}

beforeEach(() => {
  setActiveTab(TAB_SINGING)
  resetRunShell()
  view = renderShell(() => <ShellScreens />)
})

afterEach(() => {
  view?.unmount()
  view = null
  resetRunShell()
})

describe('a premium room, full-bleed (D1)', () => {
  it('draws Long note under a see-through bar, and Settings under the opaque one', () => {
    view?.unmount()
    view = renderShell(() => (
      <ShellScreens longNote={() => <div data-testid="room-stub" />} />
    ))

    pushScreen('long-note')
    const room = screens()[0]
    expect(room?.classList.contains('mp-pushed--bleed')).toBe(true)
    expect(room?.dataset.bleed).toBe('on')
    expect(room?.querySelector('[data-testid="room-stub"]')).not.toBeNull()
    // Back stays where it was: the bar floats over the art, it is not gone.
    expect(
      room?.querySelector('[data-testid="shell-pushed-back"]'),
    ).not.toBeNull()
    // The art is a dark stage in either theme, and so is the bar over it:
    // a light theme's dark title would otherwise sit on the dark art.
    expect(
      room
        ?.querySelector('.mp-pushed__bar')
        ?.classList.contains('mp-dark-stage'),
    ).toBe(true)

    pushScreen('settings')
    expect(screens()[0]?.classList.contains('mp-pushed--bleed')).toBe(false)
    expect(screens()[0]?.hasAttribute('data-bleed')).toBe(false)
    expect(
      screens()[0]
        ?.querySelector('.mp-pushed__bar')
        ?.classList.contains('mp-dark-stage'),
    ).toBe(false)
  })
})

describe("the bar's right side", () => {
  it("holds the room's own controls after Back and the room's name", () => {
    view?.unmount()
    view = renderShell(() => (
      <ShellScreens
        echo={() => (
          <RoomBarEnd>
            <RoomAsk
              onAsk={() => undefined}
              label="How it works"
              testId="echo-ask"
            />
          </RoomBarEnd>
        )}
      />
    ))

    pushScreen('echo')

    const bar = screens()[0]?.querySelector('.mp-pushed__bar')
    const order = [
      ...(bar?.querySelectorAll('button, .mp-pushed__title') ?? []),
    ].map((el) => el.getAttribute('data-testid') ?? el.textContent)
    expect(order).toEqual(['shell-pushed-back', 'Echo', 'echo-ask'])
  })

  it('is empty on a screen that puts nothing there', () => {
    pushScreen('settings')

    const end = screens()[0]?.querySelector('[data-testid="shell-pushed-end"]')
    expect(end?.childElementCount).toBe(0)
  })
})

describe('the Echo room', () => {
  it('draws the room passed in, titled Echo, full-bleed', () => {
    view?.unmount()
    view = renderShell(() => (
      <ShellScreens echo={() => <div data-testid="echo-stub" />} />
    ))

    pushScreen('echo')
    const room = screens()[0]
    expect(room?.querySelector('[data-testid="echo-stub"]')).not.toBeNull()
    expect(room?.classList.contains('mp-pushed--bleed')).toBe(true)
    expect(room?.querySelector('.mp-pushed__title')?.textContent).toBe('Echo')
  })

  it('draws nothing in the body on a build without it', () => {
    pushScreen('echo')

    expect(screens()[0]?.querySelector('[data-testid="echo-stub"]')).toBeNull()
    expect(screens()[0]?.querySelector('.mp-pushed__title')?.textContent).toBe(
      'Echo',
    )
  })
})

describe('the Legend room', () => {
  it('draws the room passed in, titled Legend, full-bleed', () => {
    view?.unmount()
    view = renderShell(() => (
      <ShellScreens legend={() => <div data-testid="legend-stub" />} />
    ))

    pushScreen('legend')
    const room = screens()[0]
    expect(room?.querySelector('[data-testid="legend-stub"]')).not.toBeNull()
    expect(room?.classList.contains('mp-pushed--bleed')).toBe(true)
    expect(room?.querySelector('.mp-pushed__title')?.textContent).toBe('Legend')
  })
})

describe('the Ng slides room', () => {
  it('draws the room passed in, titled Ng slides, full-bleed', () => {
    view?.unmount()
    view = renderShell(() => (
      <ShellScreens ngSlides={() => <div data-testid="ng-stub" />} />
    ))

    pushScreen('ng-slides')
    const room = screens()[0]
    expect(room?.querySelector('[data-testid="ng-stub"]')).not.toBeNull()
    expect(room?.classList.contains('mp-pushed--bleed')).toBe(true)
    expect(room?.querySelector('.mp-pushed__title')?.textContent).toBe(
      'Ng slides',
    )
  })
})

describe('the Lip roll room', () => {
  it('draws the room passed in, titled Lip roll, full-bleed', () => {
    view?.unmount()
    view = renderShell(() => (
      <ShellScreens lipRoll={() => <div data-testid="lip-stub" />} />
    ))

    pushScreen('lip-roll')
    const room = screens()[0]
    expect(room?.querySelector('[data-testid="lip-stub"]')).not.toBeNull()
    expect(room?.classList.contains('mp-pushed--bleed')).toBe(true)
    expect(room?.querySelector('.mp-pushed__title')?.textContent).toBe(
      'Lip roll',
    )
  })
})

describe("the Warm-up's path", () => {
  it('draws the screen passed in, titled Warm-up, full-bleed', () => {
    view?.unmount()
    view = renderShell(() => (
      <ShellScreens warmUp={() => <div data-testid="warm-stub" />} />
    ))

    pushScreen('warm-up')
    const path = screens()[0]
    expect(path?.querySelector('[data-testid="warm-stub"]')).not.toBeNull()
    expect(path?.classList.contains('mp-pushed--bleed')).toBe(true)
    expect(path?.querySelector('.mp-pushed__title')?.textContent).toBe(
      'Warm-up',
    )
  })

  it('draws nothing on a build without the premium exercises', () => {
    pushScreen('warm-up')
    expect(screens()[0]?.querySelector('[data-testid="warm-stub"]')).toBeNull()
  })
})

describe('the low-volume hint', () => {
  const stub = () => <div />

  it.each(['long-note', 'echo', 'lip-roll', 'ng-slides'] as const)(
    'watches the volume over %s',
    (screen) => {
      view?.unmount()
      view = renderShell(() => (
        <ShellScreens
          longNote={stub}
          echo={stub}
          lipRoll={stub}
          ngSlides={stub}
        />
      ))
      pushScreen(screen)
      expect(
        screens()[0]?.querySelector('[data-testid="room-volume-slot"]'),
      ).not.toBeNull()
    },
  )

  it('is over no other screen', () => {
    pushScreen('settings')
    expect(
      screens()[0]?.querySelector('[data-testid="room-volume-slot"]'),
    ).toBeNull()
  })
})

// WebKit's session for the page is stood in for by an object that keeps
// every type written to it (room-visit.ts says why a room asks for one).
describe('one volume for a room’s visit', () => {
  const stub = () => <div />
  let writes: string[] = []
  let type = 'auto'

  /** The type a room's own code reads. */
  const pageType = (): string =>
    (navigator as Navigator & { audioSession: { type: string } }).audioSession
      .type

  function drawRooms(longNote = stub): void {
    view?.unmount()
    view = renderShell(() => (
      <ShellScreens
        longNote={longNote}
        echo={stub}
        lipRoll={stub}
        ngSlides={stub}
      />
    ))
  }

  beforeEach(() => {
    writes = []
    type = 'auto'
    // The switch is off by default (room-volume-switch.ts); these rooms ask.
    setOneVolumeInRooms(true)
    // An iPhone: only iOS asks (room-visit.ts).
    vi.spyOn(Capacitor, 'getPlatform').mockReturnValue('ios')
    Object.defineProperty(navigator, 'audioSession', {
      configurable: true,
      value: {
        get type() {
          return type
        },
        set type(value: string) {
          writes.push(value)
          type = value
        },
        state: 'active',
      },
    })
    drawRooms()
  })

  afterEach(() => {
    view?.unmount()
    view = null
    setOneVolumeInRooms(false)
    resetPageAudioSessionForTests()
    Reflect.deleteProperty(navigator, 'audioSession')
    Reflect.deleteProperty(document, 'visibilityState')
    vi.restoreAllMocks()
  })

  it.each(['long-note', 'echo', 'lip-roll', 'ng-slides'] as const)(
    'asks for play-and-record in %s, and gives the page its type back on the way out',
    (screen) => {
      pushScreen(screen)
      expect(type).toBe('play-and-record')
      back()
      expect(type).toBe('auto')
      expect(writes).toEqual(['play-and-record', 'auto'])
    },
  )

  it('asks before the room is drawn, and gives the type back after it has gone', () => {
    let atDoor: string | null = null
    let onWayOut: string | null = null
    drawRooms(() => {
      atDoor = pageType()
      onCleanup(() => {
        onWayOut = pageType()
      })
      return <div />
    })
    pushScreen('long-note')
    back()
    expect([atDoor, onWayOut]).toEqual(['play-and-record', 'play-and-record'])
    expect(type).toBe('auto')
  })

  it('asks for nothing over any other screen', () => {
    pushScreen('settings')
    pushScreen('appearance')
    back()
    back()
    expect(writes).toEqual([])
  })

  it('asks for nothing with "One volume in rooms" off', () => {
    setOneVolumeInRooms(false)
    pushScreen('echo')
    back()
    expect(writes).toEqual([])
  })

  it('asks for nothing on Android, where a WebView may one day have the API', () => {
    vi.spyOn(Capacitor, 'getPlatform').mockReturnValue('android')
    pushScreen('long-note')
    back()
    expect(writes).toEqual([])
  })

  it('gives the type back while the page is hidden, and asks again as it shows', () => {
    const hide = (hidden: boolean): void => {
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        get: () => (hidden ? 'hidden' : 'visible'),
      })
      document.dispatchEvent(new Event('visibilitychange'))
    }
    pushScreen('ng-slides')
    hide(true)
    expect(type).toBe('auto')
    hide(false)
    expect(type).toBe('play-and-record')
    back()
    expect(writes).toEqual([
      'play-and-record',
      'auto',
      'play-and-record',
      'auto',
    ])
  })
})

describe('the pushed screens', () => {
  it('draws only the screen on top of the stack', () => {
    // Two copies of the same Back would also be two matches for every probe
    // and every screen reader that looks for it.
    pushScreen('settings')

    pushScreen('appearance')

    expect(screens()).toHaveLength(1)
    expect(screens()[0]?.getAttribute('aria-label')).toBe('Appearance')
  })

  it("walks back down the stack with each screen's own Back", () => {
    pushScreen('settings')
    pushScreen('appearance')

    back()
    const under = screens().map((s) => s.getAttribute('aria-label'))
    back()

    expect(under).toEqual(['Settings'])
    expect(screens()).toHaveLength(0)
  })

  it('titles Settings once, in its bar and nowhere in its body (D8)', () => {
    pushScreen('settings')

    const titled = [...(view?.container.querySelectorAll('*') ?? [])].filter(
      (node) =>
        node.children.length === 0 && node.textContent?.trim() === 'Settings',
    )

    expect(titled).toHaveLength(1)
    expect(titled[0]?.classList.contains('mp-pushed__title')).toBe(true)
  })

  it('pushes the native Settings, not the web panel with its links out (D3 to D7)', () => {
    pushScreen('settings')

    const root = view?.container
    const hrefs = [...(root?.querySelectorAll('a[href]') ?? [])].map((a) =>
      a.getAttribute('href'),
    )

    expect(root?.querySelector('[data-testid="settings-screen"]')).not.toBe(
      null,
    )
    expect(root?.querySelector('#settings-panel')).toBe(null)
    expect(hrefs).toEqual([])
  })
})
