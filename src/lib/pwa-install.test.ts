import { beforeEach, describe, expect, it, vi } from 'vitest'

// The install state is a module-level singleton (it has to outlive any
// component, since `beforeinstallprompt` fires before the app renders), so each
// case takes a fresh copy of the module rather than trying to reset it.
async function freshModule(): Promise<typeof import('./pwa-install')> {
  vi.resetModules()
  return import('./pwa-install')
}

function setUserAgent(userAgent: string, maxTouchPoints = 0): void {
  Object.defineProperty(navigator, 'userAgent', {
    value: userAgent,
    configurable: true,
  })
  Object.defineProperty(navigator, 'maxTouchPoints', {
    value: maxTouchPoints,
    configurable: true,
  })
}

/** The shape Chromium hands over, with just the members the module uses. */
function beforeInstallPrompt(outcome: 'accepted' | 'dismissed'): Event {
  const event = new Event('beforeinstallprompt', { cancelable: true })
  return Object.assign(event, {
    prompt: vi.fn(async () => undefined),
    userChoice: Promise.resolve({ outcome }),
  })
}

const CHROME_ANDROID =
  'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Mobile Safari/537.36'
const SAFARI_IOS =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'
const CHROME_IOS =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126 Mobile/15E148 Safari/604.1'

describe('pwa install state', () => {
  beforeEach(() => {
    setUserAgent(CHROME_ANDROID)
  })

  it('offers nothing until the browser says the app is installable', async () => {
    const pwa = await freshModule()
    const target = new EventTarget()
    pwa.installPwaInstallListeners(target)

    expect(pwa.canInstall()).toBe(false)
    expect(await pwa.promptInstall()).toBe('unavailable')
  })

  it('stashes beforeinstallprompt and cancels the browser mini-infobar', async () => {
    const pwa = await freshModule()
    const target = new EventTarget()
    pwa.installPwaInstallListeners(target)

    const event = beforeInstallPrompt('accepted')
    target.dispatchEvent(event)

    // Not cancelling it lets Chrome show its own bar and burns the event.
    expect(event.defaultPrevented).toBe(true)
    expect(pwa.canInstall()).toBe(true)
  })

  it('reports the choice and stops offering, because the event is single-use', async () => {
    const pwa = await freshModule()
    const target = new EventTarget()
    pwa.installPwaInstallListeners(target)
    target.dispatchEvent(beforeInstallPrompt('dismissed'))

    expect(await pwa.promptInstall()).toBe('dismissed')
    expect(pwa.canInstall()).toBe(false)
  })

  it('stops offering once the app reports itself installed', async () => {
    const pwa = await freshModule()
    const target = new EventTarget()
    pwa.installPwaInstallListeners(target)
    target.dispatchEvent(beforeInstallPrompt('accepted'))
    expect(pwa.canInstall()).toBe(true)

    target.dispatchEvent(new Event('appinstalled'))
    expect(pwa.canInstall()).toBe(false)
  })

  it('hints at the iOS Share menu, since iOS never fires the event', async () => {
    setUserAgent(SAFARI_IOS, 5)
    const pwa = await freshModule()
    expect(pwa.needsIosInstallHint()).toBe(true)
    expect(pwa.canInstall()).toBe(false)
  })

  it('says nothing on iOS Chrome, which cannot add to the home screen at all', async () => {
    setUserAgent(CHROME_IOS, 5)
    const pwa = await freshModule()
    expect(pwa.needsIosInstallHint()).toBe(false)
  })

  it('says nothing about iOS on Android', async () => {
    const pwa = await freshModule()
    expect(pwa.needsIosInstallHint()).toBe(false)
  })
})
