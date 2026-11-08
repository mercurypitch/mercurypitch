// Studio MIDI for browser tests — a fake Web MIDI keyboard in the page, the notes played on it, and a network that never reaches the sampled grand or the live site.
import { expect, type Page } from '@playwright/test'
import { studioRegion } from './dedicatedstudio-fixture'

/**
 * In the page: a keyboard named Fake Keys in place of the browser's Web
 * MIDI, played with `window.__fakeMidi.send(bytes)`, and a count of every
 * microphone the page asks for. Hand it to `page.addInitScript`.
 */
export function installFakeMidi() {
  type Listener = (event: { data: Uint8Array; timeStamp: number }) => void
  const listeners = new Set<Listener>()
  const input = {
    id: 'fake-keys',
    name: 'Fake Keys',
    manufacturer: 'MercuryPitch tests',
    type: 'input',
    state: 'connected',
    connection: 'closed',
    onmidimessage: null as Listener | null,
    addEventListener(type: string, listener: Listener) {
      if (type === 'midimessage') listeners.add(listener)
    },
    removeEventListener(type: string, listener: Listener) {
      if (type === 'midimessage') listeners.delete(listener)
    },
  }
  const access = {
    inputs: new Map([[input.id, input]]),
    outputs: new Map(),
    sysexEnabled: false,
    onstatechange: null,
    addEventListener() {},
    removeEventListener() {},
  }
  Object.defineProperty(navigator, 'requestMIDIAccess', {
    configurable: true,
    value: () => Promise.resolve(access),
  })
  const page = window as unknown as {
    __fakeMidi: { send(bytes: number[]): void }
    __microphones: number
  }
  page.__fakeMidi = {
    send(bytes) {
      const event = {
        data: new Uint8Array(bytes),
        timeStamp: performance.now(),
      }
      for (const listener of listeners) listener(event)
      input.onmidimessage?.(event)
    },
  }
  page.__microphones = 0
  const devices = navigator.mediaDevices as MediaDevices | undefined
  const ask = devices?.getUserMedia?.bind(devices)
  if (devices !== undefined && ask !== undefined)
    devices.getUserMedia = (constraints) => {
      page.__microphones += 1
      return ask(constraints)
    }
}

/** Play `bytes` on the fake keyboard. */
export const playMidi = (page: Page, bytes: number[]) =>
  page.evaluate((sent) => {
    ;(
      window as unknown as { __fakeMidi: { send(bytes: number[]): void } }
    ).__fakeMidi.send(sent)
  }, bytes)

/** How many microphones the page has asked for since it loaded. */
export const microphonesAsked = (page: Page) =>
  page.evaluate(
    () => (window as unknown as { __microphones: number }).__microphones,
  )

/** Refuse the sampled grand's samples, and every request to the live site, noting the latter. */
export async function routeNetwork(page: Page): Promise<string[]> {
  const live: string[] = []
  await page.route('https://cdn.jsdelivr.net/**', (route) => route.abort())
  await page.route(/https:\/\/([a-z.]+\.)?mercurypitch\.com\//, (route) => {
    live.push(route.request().url())
    return route.abort()
  })
  return live
}

/** Set `lane`'s input to the fake keyboard in its Track details, MIDI allowed from the press. */
export async function playLaneFromKeys(
  page: Page,
  lane: string,
): Promise<void> {
  const studio = studioRegion(page)
  await studio
    .getByRole('button', { name: `${lane} details`, exact: true })
    .click()
  await studio
    .getByRole('button', { name: 'Show MIDI keyboards and pads', exact: true })
    .click()
  const picker = studio.getByRole('combobox', { name: 'Input', exact: true })
  await expect(picker.locator('optgroup[label="MIDI"] option')).toHaveText([
    'Fake Keys',
  ])
  await picker.selectOption({ label: 'Fake Keys' })
  await expect(studio.locator('[data-studio-lane-sound]')).toHaveText(
    'Plays as piano until this instrument has its own sound.',
  )
  await studio
    .getByRole('button', { name: 'Close Track details', exact: true })
    .click()
}
