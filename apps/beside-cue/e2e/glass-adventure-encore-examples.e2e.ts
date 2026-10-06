// Encore example integration — on-demand variants, recoverable delivery failures and audio ownership on touch screens.

import type { Page, TestInfo } from '@playwright/test'
import { expect, test } from '@playwright/test'
import { writeFile } from 'node:fs/promises'
import { GLASSWORKS_JOURNEY } from '../../../packages/glass-game/src/content/glassworks-journey'
import { readProgress } from '../../../packages/glass-game/src/core/progress'

declare global {
  interface Window {
    encoreIntegration: {
      audioEvents: string[]
      streams: MediaStream[]
    }
  }
}

const DEFAULT_VARIANT = '/games/adventure-voice-v6/first-arc/r60-p100.mp3'
const BRISK_VARIANT = '/games/adventure-voice-v6/first-arc/r60-p080.mp3'
const LOWER_BRISK_VARIANT = '/games/adventure-voice-v6/first-arc/r59-p080.mp3'
const LOWER_NATURAL_VARIANT = '/games/adventure-voice-v6/first-arc/r59-p100.mp3'
const SUNLIT_VARIANT = '/games/adventure-voice-v6/sunlit-steps/r60-p100.mp3'
const VOICE_ROUTE = '**/games/adventure-voice-v6/**/*.mp3'

const completeProgress = {
  ...readProgress(GLASSWORKS_JOURNEY, null),
  completedBreakableIds: GLASSWORKS_JOURNEY.breakables
    .filter((item) => !item.optional)
    .map((item) => item.id),
  finished: true,
}

test.use({
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  launchOptions: {
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  },
})
test.setTimeout(120_000)

function assetPath(url: string): string {
  return new URL(url).pathname
}

function count(requests: readonly string[], path: string): number {
  return requests.filter((request) => request === path).length
}

async function attachJson(
  testInfo: TestInfo,
  name: string,
  value: unknown,
): Promise<void> {
  const path = testInfo.outputPath(`${name}.json`)
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`)
  await testInfo.attach(name, { path, contentType: 'application/json' })
}

async function installCompletedVisit(
  page: Page,
  rejectDefault = false,
): Promise<void> {
  await page.addInitScript(
    ({ complete, rejectDefault }) => {
      // This proof owns browser lifecycle and audio ordering; rendered-world
      // pixels are covered separately and would only slow these touch cases.
      if (typeof WebGL2RenderingContext !== 'undefined')
        for (const method of [
          'clear',
          'drawArrays',
          'drawArraysInstanced',
          'drawElements',
          'drawElementsInstanced',
        ])
          Object.defineProperty(WebGL2RenderingContext.prototype, method, {
            configurable: true,
            value: () => undefined,
          })

      localStorage.setItem('beside-cue:glass-adventure:tutorial', 'seen')
      localStorage.setItem('beside-cue:glass-adventure:comfortable-note', '60')
      localStorage.setItem(
        `beside-cue:glass-adventure:progress:${complete.levelId}`,
        JSON.stringify(complete),
      )

      const audioEvents: string[] = []
      const streams: MediaStream[] = []
      const activeOneShots = new Set<AudioBufferSourceNode>()
      const createBufferSource = AudioContext.prototype.createBufferSource
      AudioContext.prototype.createBufferSource = function () {
        const context = this
        const source = createBufferSource.call(this)
        const start = source.start.bind(source)
        const stop = source.stop.bind(source)
        source.start = (...args) => {
          if (!source.loop) {
            activeOneShots.add(source)
            audioEvents.push('one-shot-start')
          }
          start(...args)
        }
        source.stop = (when = 0) => {
          if (activeOneShots.has(source)) {
            const delayMs = Math.max(0, (when - context.currentTime) * 1000)
            setTimeout(() => {
              if (!activeOneShots.delete(source)) return
              audioEvents.push('one-shot-stopped')
            }, delayMs)
          }
          stop(when)
        }
        source.addEventListener('ended', () => {
          if (!activeOneShots.delete(source)) return
          audioEvents.push('one-shot-ended')
        })
        return source
      }

      const createMediaStreamSource =
        AudioContext.prototype.createMediaStreamSource
      AudioContext.prototype.createMediaStreamSource = function (stream) {
        audioEvents.push(
          activeOneShots.size === 0
            ? 'mic-stream-after-example'
            : 'mic-stream-overlapped-example',
        )
        return createMediaStreamSource.call(this, stream)
      }

      if (rejectDefault)
        navigator.mediaDevices.enumerateDevices = async () => [
          {
            deviceId: 'scarlett',
            groupId: 'input',
            kind: 'audioinput',
            label: 'Scarlett microphone',
            toJSON: () => ({}),
          },
        ]
      navigator.mediaDevices.getUserMedia = async (constraints) => {
        audioEvents.push('get-user-media')
        const audio = constraints?.audio as MediaTrackConstraints | undefined
        const deviceId = audio?.deviceId as
          | ConstrainDOMStringParameters
          | undefined
        if (rejectDefault && deviceId?.exact !== 'scarlett')
          throw new DOMException(
            'Starting audio capture failed',
            'NotReadableError',
          )
        const context = new AudioContext()
        await context.resume()
        const oscillator = context.createOscillator()
        const gain = context.createGain()
        const output = context.createMediaStreamDestination()
        gain.gain.value = 0
        oscillator.connect(gain).connect(output)
        oscillator.start()
        const track = output.stream.getAudioTracks()[0]!
        const stop = track.stop.bind(track)
        track.stop = () => {
          stop()
          oscillator.stop()
          oscillator.disconnect()
          gain.disconnect()
          void context.close()
        }
        streams.push(output.stream)
        return output.stream
      }
      window.encoreIntegration = { audioEvents, streams }
    },
    { complete: completeProgress, rejectDefault },
  )
}

async function openEncore(page: Page) {
  await page.goto('/glass-game/?layout=journey')
  const completedVisit = page.getByRole('dialog', {
    name: `${GLASSWORKS_JOURNEY.title} is already complete.`,
    exact: true,
  })
  await expect(completedVisit).toBeVisible()
  await expect(page.getByTestId('glass-adventure')).toHaveCount(0)
  expect(
    await page.evaluate(() => window.encoreIntegration.streams.length),
  ).toBe(0)
  expect(
    await page.evaluate(() => window.encoreIntegration.audioEvents),
  ).toEqual([])
  await completedVisit
    .getByRole('button', { name: 'Review completion', exact: true })
    .tap()
  await expect(page.getByTestId('glass-adventure')).toHaveAttribute(
    'data-ready',
    'true',
    { timeout: 60_000 },
  )
  await page.getByRole('button', { name: 'Encore', exact: true }).tap()
  const dialog = page.getByRole('dialog', { name: 'Leave a little light.' })
  await expect(dialog).toBeVisible()
  return dialog
}

test('recovers the encore microphone from its phone dialog @smoke', async ({
  page,
}, testInfo) => {
  await installCompletedVisit(page, true)
  const dialog = await openEncore(page)
  await dialog
    .getByRole('button', { name: 'Sing the melody', exact: true })
    .tap()
  const practice = dialog.locator('section[data-mode]')
  await expect(practice).toHaveAttribute('data-mode', 'error')
  const picker = dialog.getByRole('combobox', {
    name: 'Microphone',
    exact: true,
  })
  await expect(picker).toBeVisible()
  await picker.selectOption('scarlett')
  await dialog.getByText('Technical details', { exact: true }).tap()
  await expect(dialog).toContainText('NotReadableError')
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390)
  await page.screenshot({
    path: testInfo.outputPath('encore-microphone-recovery-phone.png'),
  })
  await dialog.getByRole('button', { name: 'Try again', exact: true }).tap()
  await expect(practice).toHaveAttribute('data-mode', /reference|singing/, {
    timeout: 15_000,
  })
  expect(
    await page.evaluate(() => localStorage.getItem('beside-cue:input-device')),
  ).toBe('scarlett')
  expect(
    await page.evaluate(() => window.encoreIntegration.streams.length),
  ).toBe(1)
  await dialog
    .getByRole('button', { name: 'Back to completion card', exact: true })
    .tap()
})

test('loads only the selected voice and retries HTTP and decode failures on a phone @smoke', async ({
  page,
}, testInfo) => {
  await installCompletedVisit(page)
  const requests: string[] = []
  await page.route(VOICE_ROUTE, async (route) => {
    const path = assetPath(route.request().url())
    requests.push(path)
    const attempt = count(requests, path)
    if (path === DEFAULT_VARIANT && attempt === 1) {
      await route.fulfill({
        status: 200,
        contentType: 'audio/mpeg',
        body: Buffer.from('corrupt but nonempty MPEG response'),
      })
      return
    }
    if (path === LOWER_NATURAL_VARIANT && attempt === 1) {
      await route.fulfill({ status: 503, body: 'temporarily unavailable' })
      return
    }
    await route.continue()
  })

  const dialog = await openEncore(page)
  expect(requests).toEqual([])
  const hearMerc = dialog.getByRole('button', {
    name: 'Hear Merc',
    exact: true,
  })
  await hearMerc.tap()
  const retry = dialog.getByRole('button', {
    name: 'Retry Merc’s example',
    exact: true,
  })
  await expect(retry).toBeVisible({ timeout: 15_000 })
  await expect(
    dialog.getByText(
      'Merc’s take could not load. Hear melody still plays the exact instrumental guide.',
      { exact: true },
    ),
  ).toBeVisible()
  await expect(
    dialog.getByText(
      'Merc could not play this time. You can still hear your note guide.',
      { exact: true },
    ),
  ).toBeVisible()
  expect(count(requests, DEFAULT_VARIANT)).toBe(1)

  await retry.tap()
  await expect(
    dialog.getByRole('button', { name: 'Stop listening', exact: true }),
  ).toBeVisible({ timeout: 15_000 })
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          window.encoreIntegration.audioEvents.filter(
            (event) => event === 'one-shot-start',
          ).length,
      ),
    )
    .toBe(1)
  expect(count(requests, DEFAULT_VARIANT)).toBe(2)
  await dialog
    .getByRole('button', { name: 'Stop listening', exact: true })
    .tap()

  await dialog.getByLabel('Starting height').selectOption({ label: 'Lower 1' })
  expect(count(requests, LOWER_NATURAL_VARIANT)).toBe(0)
  await hearMerc.tap()
  await expect(retry).toBeVisible({ timeout: 15_000 })
  expect(count(requests, LOWER_NATURAL_VARIANT)).toBe(1)
  await retry.tap()
  await expect(
    dialog.getByRole('button', { name: 'Stop listening', exact: true }),
  ).toBeVisible({ timeout: 15_000 })
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          window.encoreIntegration.audioEvents.filter(
            (event) => event === 'one-shot-start',
          ).length,
      ),
    )
    .toBe(2)
  expect(count(requests, LOWER_NATURAL_VARIANT)).toBe(2)

  expect(
    await dialog.evaluate(
      (element) => element.scrollWidth <= element.clientWidth,
    ),
  ).toBe(true)
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true)
  await page.screenshot({
    path: testInfo.outputPath('encore-example-recovered-phone.png'),
  })
  await attachJson(testInfo, 'voice-request-trace', requests)
})

test('cancels a delayed voice, follows key pace and shape, then starts capture after playback @smoke', async ({
  page,
}, testInfo) => {
  await installCompletedVisit(page)
  const requests: string[] = []
  const failedRequests: string[] = []
  let releaseDelayed!: () => void
  const delayed = new Promise<void>((resolve) => {
    releaseDelayed = resolve
  })
  let markDelayedSeen!: () => void
  const delayedSeen = new Promise<void>((resolve) => {
    markDelayedSeen = resolve
  })
  let heldDefault = false
  let heldRequestRetired = false
  page.on('requestfailed', (request) => {
    const path = assetPath(request.url())
    if (path.includes('/adventure-voice-v6/')) failedRequests.push(path)
  })
  await page.route(VOICE_ROUTE, async (route) => {
    const path = assetPath(route.request().url())
    requests.push(path)
    if (path === DEFAULT_VARIANT && !heldDefault) {
      heldDefault = true
      markDelayedSeen()
      await delayed
      try {
        await route.continue()
      } catch {
        // AbortController may retire the intercepted request before release.
        heldRequestRetired = true
      }
      return
    }
    await route.continue()
  })

  const dialog = await openEncore(page)
  await dialog.getByRole('button', { name: 'Hear Merc', exact: true }).tap()
  await delayedSeen
  await expect(
    dialog.getByRole('button', {
      name: 'Loading Merc’s example…',
      exact: true,
    }),
  ).toBeVisible()

  await dialog.getByLabel('Pace').selectOption({ label: 'Brisk' })
  await expect(
    dialog.getByRole('button', { name: 'Hear Merc', exact: true }),
  ).toBeVisible()
  releaseDelayed()
  await expect.poll(() => count(requests, DEFAULT_VARIANT)).toBe(1)
  await expect
    .poll(() => heldRequestRetired || failedRequests.includes(DEFAULT_VARIANT))
    .toBe(true)
  await expect(
    dialog.getByRole('button', { name: 'Retry Merc’s example', exact: true }),
  ).not.toBeVisible()

  await dialog.getByRole('button', { name: 'Hear Merc', exact: true }).tap()
  await expect(
    dialog.getByRole('button', { name: 'Stop listening', exact: true }),
  ).toBeVisible({ timeout: 15_000 })
  await expect.poll(() => count(requests, BRISK_VARIANT)).toBe(1)

  await dialog.getByLabel('Starting height').selectOption({ label: 'Lower 1' })
  await expect(
    dialog.getByRole('button', { name: 'Stop listening', exact: true }),
  ).not.toBeVisible()
  expect(count(requests, LOWER_BRISK_VARIANT)).toBe(0)
  await dialog.getByRole('button', { name: 'Hear Merc', exact: true }).tap()
  await expect(
    dialog.getByRole('button', { name: 'Stop listening', exact: true }),
  ).toBeVisible({ timeout: 15_000 })
  await expect.poll(() => count(requests, LOWER_BRISK_VARIANT)).toBe(1)

  await dialog.getByLabel('Melody shape').selectOption('sunlit-steps')
  await expect(dialog.getByLabel('Pace')).toHaveValue('1')
  await expect(dialog.getByLabel('Starting height')).toHaveValue('0')
  expect(count(requests, SUNLIT_VARIANT)).toBe(0)
  await dialog.getByRole('button', { name: 'Hear Merc', exact: true }).tap()
  await expect(
    dialog.getByRole('button', { name: 'Stop listening', exact: true }),
  ).toBeVisible({ timeout: 15_000 })
  await expect.poll(() => count(requests, SUNLIT_VARIANT)).toBe(1)

  await dialog
    .getByRole('button', { name: 'Sing the melody', exact: true })
    .tap()
  const practice = dialog.locator('section[data-mode]')
  await expect(practice).toHaveAttribute(
    'data-mode',
    /permission|reference|singing/,
    { timeout: 15_000 },
  )
  await expect(
    dialog.getByRole('button', { name: 'Stop listening', exact: true }),
  ).not.toBeVisible()
  await expect
    .poll(() =>
      page.evaluate(() =>
        window.encoreIntegration.audioEvents.find((event) =>
          event.startsWith('mic-stream-'),
        ),
      ),
    )
    .toBe('mic-stream-after-example')

  expect(count(requests, DEFAULT_VARIANT)).toBe(1)
  expect(count(requests, BRISK_VARIANT)).toBe(1)
  expect(count(requests, LOWER_BRISK_VARIANT)).toBe(1)
  expect(count(requests, SUNLIT_VARIANT)).toBe(1)
  await attachJson(testInfo, 'variant-and-audio-order', {
    requests,
    failedRequests,
    heldRequestRetired,
    audioEvents: await page.evaluate(
      () => window.encoreIntegration.audioEvents,
    ),
  })
})

test('keeps a reopened microphone lease over the old dialog fade @smoke', async ({
  page,
}, testInfo) => {
  await installCompletedVisit(page)
  const museumAudioRequests: string[] = []
  page.on('request', (request) => {
    const path = assetPath(request.url())
    if (path.includes('/games/adventure-audio-v1/'))
      museumAudioRequests.push(path)
  })

  const dialog = await openEncore(page)
  await dialog.getByRole('button', { name: 'Hear Merc', exact: true }).tap()
  await expect(
    dialog.getByRole('button', { name: 'Stop listening', exact: true }),
  ).toBeVisible({ timeout: 15_000 })
  await expect
    .poll(() =>
      page.evaluate(() =>
        window.encoreIntegration.audioEvents.includes('one-shot-start'),
      ),
    )
    .toBe(true)
  const requestsBeforeRace = museumAudioRequests.length

  // These three clicks intentionally share one browser task. A normal
  // Playwright action wait can outlast the 120 ms fade and miss the ownership
  // race this regression is meant to exercise.
  await page.evaluate(async () => {
    const button = (label: string) =>
      [...document.querySelectorAll('button')].find(
        (candidate) =>
          candidate.getAttribute('aria-label') === label ||
          candidate.textContent?.trim() === label,
      )
    button('Back to completion card')?.click()
    await Promise.resolve()
    button('Encore')?.click()
    await Promise.resolve()
    button('Sing the melody')?.click()
  })

  const reopened = page.getByRole('dialog', { name: 'Leave a little light.' })
  const practice = reopened.locator('section[data-mode]')
  await expect(practice).toHaveAttribute(
    'data-mode',
    /permission|reference|singing/,
    { timeout: 15_000 },
  )
  await expect
    .poll(() =>
      page.evaluate(() =>
        window.encoreIntegration.audioEvents.some((event) =>
          event.startsWith('mic-stream-'),
        ),
      ),
    )
    .toBe(true)
  await page.waitForTimeout(300)
  expect(museumAudioRequests).toHaveLength(requestsBeforeRace)
  await page.screenshot({
    path: testInfo.outputPath('encore-reopened-microphone-phone.png'),
  })
  await attachJson(testInfo, 'reopen-audio-ownership', {
    museumAudioRequests,
    audioEvents: await page.evaluate(
      () => window.encoreIntegration.audioEvents,
    ),
    mode: await practice.getAttribute('data-mode'),
  })
})

for (const theme of ['light', 'dark'] as const) {
  test(`encore shared chrome keeps the full ribbon and independent controls (${theme}) @smoke`, async ({
    page,
  }, testInfo) => {
    await installCompletedVisit(page)
    await page.addInitScript(
      (theme) =>
        localStorage.setItem(
          'beside-cue:glass-adventure:glass-ui-appearance:v1',
          JSON.stringify({ theme, reducedTransparency: false }),
        ),
      theme,
    )
    const dialog = await openEncore(page)
    await expect(page.locator('[data-game-theme]')).toHaveAttribute(
      'data-game-theme',
      theme,
    )
    const practice = dialog.locator('section[data-mode]')
    const help = dialog.getByRole('button', { name: /encore instructions/ })
    const close = dialog.getByRole('button', {
      name: 'Back to completion card',
      exact: true,
    })
    const consent = dialog.getByRole('checkbox', {
      name: 'Keep a recording of my next melody',
    })
    for (const viewport of [
      { width: 320, height: 640 },
      { width: 393, height: 852 },
      { width: 852, height: 393 },
      { width: 740, height: 320 },
    ]) {
      await page.setViewportSize(viewport)
      await dialog.evaluate((element) => {
        element.scrollTop = 0
      })
      const layout = await dialog.evaluate((element) => {
        const box = element.getBoundingClientRect()
        return {
          left: box.left,
          right: box.right,
          top: box.top,
          bottom: box.bottom,
          overflows: element.scrollWidth > element.clientWidth,
          buttons: [...element.querySelectorAll('button')].map((button) => ({
            label: button.getAttribute('aria-label') ?? button.textContent,
            height: button.getBoundingClientRect().height,
            width: button.getBoundingClientRect().width,
          })),
        }
      })
      expect(layout.left).toBeGreaterThanOrEqual(0)
      expect(layout.right).toBeLessThanOrEqual(viewport.width)
      expect(layout.top).toBeGreaterThanOrEqual(0)
      expect(layout.bottom).toBeLessThanOrEqual(viewport.height)
      expect(layout.overflows).toBe(false)
      for (const button of layout.buttons) {
        expect(button.height, button.label ?? '').toBeGreaterThanOrEqual(44)
        expect(button.width, button.label ?? '').toBeGreaterThanOrEqual(44)
      }
      const helpBox = (await help.boundingBox())!,
        closeBox = (await close.boundingBox())!
      expect(closeBox.x - helpBox.x - helpBox.width).toBeGreaterThanOrEqual(8)
      await help.tap()
      await expect(help).toHaveAttribute('aria-expanded', 'true')
      await page.keyboard.press('Escape')
      await expect(help).toHaveAttribute('aria-expanded', 'false')
      await expect(help).toBeFocused()
      await expect(dialog).toBeVisible()
      const melodyHelp = practice.getByRole('button', {
        name: /melody instructions/,
      })
      await melodyHelp.tap()
      await expect(melodyHelp).toHaveAttribute('aria-expanded', 'true')
      await page.keyboard.press('Escape')
      await expect(melodyHelp).toBeFocused()
      await expect(practice).toHaveAttribute('data-mode', 'idle')
      const ribbon = practice.getByRole('img', { name: /Melody ribbon/ })
      await ribbon.scrollIntoViewIfNeeded()
      const ribbonBox = (await ribbon.boundingBox())!
      for (const control of [help, close]) {
        const bounds = (await control.boundingBox())!
        expect(bounds.y).toBeGreaterThanOrEqual(0)
        expect(bounds.y + bounds.height).toBeLessThanOrEqual(viewport.height)
        expect(
          await control.evaluate((element) => {
            const bounds = element.getBoundingClientRect()
            return element.contains(
              document.elementFromPoint(
                bounds.x + bounds.width / 2,
                bounds.y + bounds.height / 2,
              ),
            )
          }),
        ).toBe(true)
      }
      const surface = (await dialog
        .locator(':scope > [data-game-surface]')
        .boundingBox())!
      expect(surface.y).toBeGreaterThanOrEqual(0)
      expect(surface.y + surface.height).toBeLessThanOrEqual(viewport.height)
      expect(ribbonBox.width).toBeGreaterThan(200)
      expect(ribbonBox.height).toBeGreaterThan(60)
      expect(ribbonBox.width / ribbonBox.height).toBeCloseTo(720 / 220, 1)
      const visibleRibbon = await ribbon.evaluate((element) => {
        let top = 0
        let bottom = window.innerHeight
        for (
          let parent = element.parentElement;
          parent;
          parent = parent.parentElement
        ) {
          if (
            ['auto', 'scroll', 'hidden', 'clip'].includes(
              getComputedStyle(parent).overflowY,
            )
          ) {
            const bounds = parent.getBoundingClientRect()
            top = Math.max(top, bounds.top)
            bottom = Math.min(bottom, bounds.bottom)
          }
        }
        return { top, bottom }
      })
      expect(ribbonBox.y).toBeGreaterThanOrEqual(visibleRibbon.top - 0.5)
      expect(ribbonBox.y + ribbonBox.height).toBeLessThanOrEqual(
        visibleRibbon.bottom + 0.5,
      )
      await page.screenshot({
        path: testInfo.outputPath(
          `encore-${theme}-${viewport.width}x${viewport.height}.png`,
        ),
      })
    }
    await expect(dialog.getByLabel('Pace')).toBeEnabled()
    await expect(dialog.getByLabel('Starting height')).toBeEnabled()
    await expect(consent).not.toBeChecked()
    expect(
      await page.evaluate(() => window.encoreIntegration.streams.length),
    ).toBe(0)
    expect(
      await page.evaluate(() => window.encoreIntegration.audioEvents),
    ).toEqual([])
    const closeTarget = (await close.boundingBox())!
    await page.mouse.click(
      closeTarget.x + closeTarget.width / 2,
      closeTarget.y + closeTarget.height / 2,
    )
    await expect(dialog).toBeHidden()
  })
}
