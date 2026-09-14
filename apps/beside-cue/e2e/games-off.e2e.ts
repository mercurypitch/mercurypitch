// ============================================================
// Store build boundary — no game entry, detector warm-up, or microphone use
// ============================================================

import { expect, test } from '@playwright/test'

test('the store app stays usable without loading the B-side games', async ({
  page,
}) => {
  const gameRequests: string[] = []
  page.on('request', (request) => {
    const url = request.url()
    const path = new URL(url).pathname
    if (
      path.startsWith('/games/') ||
      path.startsWith('/ort/') ||
      path.includes('/models/swiftf0.onnx') ||
      path.includes('/src/games/glass') ||
      path.includes('/src/screens/GamesScreen') ||
      path.includes('/pitch-engine/') ||
      path.includes('f0-detector')
    )
      gameRequests.push(url)
  })
  await page.addInitScript(() => {
    const log = { microphones: 0, workers: [] as string[] }
    ;(
      window as unknown as { __storeGameActivity: typeof log }
    ).__storeGameActivity = log
    const media = navigator.mediaDevices
    const ask = media.getUserMedia.bind(media)
    media.getUserMedia = (constraints) => {
      log.microphones += 1
      return ask(constraints)
    }
    const Spawn = window.Worker
    window.Worker = class extends Spawn {
      constructor(url: string | URL, options?: WorkerOptions) {
        super(url, options)
        log.workers.push(String(url))
      }
    }
  })
  await page.goto('/?devSeed')
  await expect(page.getByRole('button', { name: /^Cue me now/u })).toBeVisible()
  await expect(page.getByRole('button', { name: /B-side games/u })).toHaveCount(
    0,
  )
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  await expect(page.getByRole('link', { name: /Terms of use/u })).toBeVisible()
  const activity = await page.evaluate(
    () =>
      (
        window as unknown as {
          __storeGameActivity: { microphones: number; workers: string[] }
        }
      ).__storeGameActivity,
  )
  expect(activity.microphones).toBe(0)
  expect(activity.workers.filter((url) => url.includes('f0-detector'))).toEqual(
    [],
  )
  expect(gameRequests).toEqual([])
})
