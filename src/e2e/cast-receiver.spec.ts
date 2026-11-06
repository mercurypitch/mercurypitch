// Cast receiver — the stage on a Cast device, driven in a real browser through a stand-in for Google's Web Receiver SDK.
//
// The SDK only runs a receiver on a Cast device, so the page's request for
// it is answered with a stand-in (FAKE_SDK) that keeps what the page asks
// of it and lets the spec play the device: a sender connecting, sending,
// and leaving. Everything past that is the real page: the receiver, the
// stage's loop and its renderer, on a 1080p canvas.
import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'

const SDK_PATTERN = 'https://www.gstatic.com/cast/sdk/**'

/** `cast.framework` as much as the receiver uses, recording all of it. */
const FAKE_SDK = `
(() => {
  const listeners = new Map()
  const events = new Map()
  const senders = new Set()
  const fake = { started: null, stopped: false, sent: [] }
  const context = {
    addCustomMessageListener: (namespace, listener) => listeners.set(namespace, listener),
    addEventListener: (type, listener) => events.set(type, listener),
    sendCustomMessage: (namespace, senderId, data) => fake.sent.push({ namespace, senderId, data }),
    getSenders: () => [...senders].map((id) => ({ id })),
    start: (options) => { fake.started = options },
    stop: () => { fake.stopped = true },
  }
  fake.connect = (senderId) => { senders.add(senderId); events.get('senderconnected')?.({ senderId }) }
  fake.disconnect = (senderId) => { senders.delete(senderId); events.get('senderdisconnected')?.({ senderId }) }
  fake.message = (namespace, senderId, data) => listeners.get(namespace)?.({ senderId, data })
  window.__fakeCast = fake
  window.cast = { framework: {
    CastReceiverContext: { getInstance: () => context },
    system: {
      EventType: { SENDER_CONNECTED: 'senderconnected', SENDER_DISCONNECTED: 'senderdisconnected' },
      MessageType: { JSON: 'JSON' },
    },
  } }
})()
`

const NAMESPACE = 'urn:x-cast:com.mercurypitch.stage'

/** A digest of what the stage's canvas shows now. */
async function canvasDigest(page: Page): Promise<string> {
  return page.evaluate(() => {
    const canvas = document.getElementById('stage') as HTMLCanvasElement
    const ctx = canvas.getContext('2d')!
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height)
    let hash = 0
    for (let i = 0; i < data.length; i += 997) hash = (hash * 31 + data[i]) | 0
    return `${String(canvas.width)}x${String(canvas.height)}:${String(hash)}`
  })
}

/** Whether the canvas holds more than its background: some light pixels. */
async function lightPixels(page: Page): Promise<number> {
  return page.evaluate(() => {
    const canvas = document.getElementById('stage') as HTMLCanvasElement
    const ctx = canvas.getContext('2d')!
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height)
    let count = 0
    for (let i = 0; i < data.length; i += 4 * 61)
      if (data[i] + data[i + 1] + data[i + 2] > 450) count += 1
    return count
  })
}

test.describe('Cast receiver', () => {
  test.use({ viewport: { width: 1920, height: 1080 } })

  test('starts the SDK for the stage, plays the demo for a sender, answers a probe, and idles when the sender leaves @smoke', async ({
    page,
  }) => {
    await page.route(SDK_PATTERN, (route) =>
      route.fulfill({ contentType: 'text/javascript', body: FAKE_SDK }),
    )
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.goto('/cast-receiver')

    // Started as the receiver starts it: the stage's namespace, as JSON,
    // with no media players and no idle timeout of the SDK's own.
    await expect
      .poll(() => page.evaluate(() => (window as any).__fakeCast.started))
      .toEqual({
        customNamespaces: { [NAMESPACE]: 'JSON' },
        skipPlayersLoad: true,
        disableIdleTimeout: true,
        statusText: 'Mercury Pitch',
      })

    // The idle screen, at 1080p.
    await expect.poll(() => lightPixels(page)).toBeGreaterThan(0)
    const idle = await canvasDigest(page)
    expect(idle.startsWith('1920x1080:')).toBe(true)

    // A sender connects and asks for the demo: the stage draws a song.
    await page.evaluate((namespace) => {
      const cast = (window as any).__fakeCast
      cast.connect('phone')
      cast.message(namespace, 'phone', { v: 1, kind: 'demo' })
    }, NAMESPACE)
    await expect.poll(() => canvasDigest(page)).not.toBe(idle)

    // A probe is answered on the namespace, to the sender that asked.
    await page.evaluate((namespace) => {
      ;(window as any).__fakeCast.message(namespace, 'phone', {
        v: 1,
        kind: 'probe',
      })
    }, NAMESPACE)
    await expect
      .poll(() => page.evaluate(() => (window as any).__fakeCast.sent.length))
      .toBe(1)
    const reply = await page.evaluate(() => (window as any).__fakeCast.sent[0])
    expect(reply).toMatchObject({
      namespace: NAMESPACE,
      senderId: 'phone',
      data: {
        v: 1,
        kind: 'capabilities',
        capabilities: { screen: { width: 1920, height: 1080 } },
      },
    })

    // The last sender leaves: the song stops and the idle screen is back.
    await page.evaluate(() => {
      ;(window as any).__fakeCast.disconnect('phone')
    })
    await expect.poll(() => canvasDigest(page)).toBe(idle)
    expect(errors).toEqual([])
  })
})
