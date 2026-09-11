// Guitar Night browser tests share a hardware-safe audio guard and amp preference helpers.
// ============================================================

import { expect } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'

export const STORAGE_V1 = 'guitar-night-amp-settings-v1'
export const STORAGE_V2 = 'guitar-night-amp-settings-v2'

export interface AudioActivity {
  contexts: number
  sourceStarts: number
  mediaPlays: number
  microphoneRequests: number
}

/** Observe real browser boundaries; prevent any accidental sound or hardware access. */
export async function guardPassiveAudio(page: Page): Promise<string[]> {
  const cabinetRequests: string[] = []
  await page.route('**/*', (route) => {
    const url = new URL(route.request().url())
    // Vite's ?url request is a JS URL module, not cabinet audio preparation.
    const isAssetUrlModule =
      url.searchParams.has('url') || url.searchParams.has('import')
    if (
      !isAssetUrlModule &&
      /(?:cabinet|cookie-monster|guitar).*\.(wav|bin)$/i.test(url.pathname)
    ) {
      cabinetRequests.push(url.pathname)
      return route.abort()
    }
    if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) {
      return route.abort()
    }
    return route.continue()
  })
  await page.addInitScript(() => {
    const tracked = window as unknown as {
      __ampActivity: AudioActivity
      AudioContext: typeof AudioContext
      webkitAudioContext?: typeof AudioContext
    }
    const activity: AudioActivity = {
      contexts: 0,
      sourceStarts: 0,
      mediaPlays: 0,
      microphoneRequests: 0,
    }
    tracked.__ampActivity = activity
    const NativeContext = tracked.AudioContext ?? tracked.webkitAudioContext
    if (NativeContext !== undefined) {
      const ObservedContext = new Proxy(NativeContext, {
        construct(target, args, newTarget) {
          activity.contexts += 1
          return Reflect.construct(target, args, newTarget)
        },
      })
      tracked.AudioContext = ObservedContext
      tracked.webkitAudioContext = ObservedContext
    }
    for (const constructor of [AudioBufferSourceNode, OscillatorNode]) {
      constructor.prototype.start = () => {
        activity.sourceStarts += 1
        throw new Error('Amp settings must not start an audio source')
      }
    }
    const blobs = new Map<string, Blob>()
    const createObjectURL = URL.createObjectURL.bind(URL)
    URL.createObjectURL = (object) => {
      const url = createObjectURL(object)
      if (object instanceof Blob) blobs.set(url, object)
      return url
    }
    HTMLMediaElement.prototype.play = async function () {
      const blob = blobs.get(this.currentSrc || this.src)
      // audio-unlock.ts primes iOS with exactly 0.1 s of zero PCM. Exempt
      // only those inspected bytes, not every blob URL or every short clip.
      if (
        blob?.type === 'audio/wav' &&
        blob.size === 1644 &&
        this.hasAttribute('playsinline')
      ) {
        const buffer = await blob.arrayBuffer()
        const view = new DataView(buffer)
        if (
          view.getUint32(0) === 0x52494646 &&
          view.getUint32(8) === 0x57415645 &&
          view.getUint32(12) === 0x666d7420 &&
          view.getUint16(20, true) === 1 &&
          view.getUint16(22, true) === 1 &&
          view.getUint32(24, true) === 8000 &&
          view.getUint16(34, true) === 16 &&
          view.getUint32(36) === 0x64617461 &&
          view.getUint32(40, true) === 1600 &&
          new Uint8Array(buffer, 44).every((byte) => byte === 0)
        )
          return
      }
      activity.mediaPlays += 1
      throw new Error('Amp settings must not play media')
    }
    navigator.mediaDevices.getUserMedia = async () => {
      activity.microphoneRequests += 1
      throw new Error('Amp settings must not request a microphone')
    }
  })
  return cabinetRequests
}

export async function audioActivity(page: Page): Promise<AudioActivity> {
  return page.evaluate(
    () => (window as unknown as { __ampActivity: AudioActivity }).__ampActivity,
  )
}

export async function openSongAmp(page: Page): Promise<Locator> {
  await page
    .getByRole('button', { name: 'Session controls', exact: true })
    .click()
  const amp = page
    .getByRole('dialog', { name: 'Session', exact: true })
    .getByRole('region', { name: 'Guitar amp', exact: true })
  await expect(amp).toBeVisible()
  return amp
}

export async function reloadSongAmp(page: Page): Promise<Locator> {
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Enter room', exact: true }).click()
  return openSongAmp(page)
}

export async function storedAmp(
  page: Page,
): Promise<Record<string, unknown> | null> {
  return page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key) ?? 'null'),
    STORAGE_V2,
  )
}
