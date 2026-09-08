// Practice recovers from missing or denied input without silently starting capture or playback.
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { enterRecording } from './helpers/guitar-recording'

async function openPrompt(page: Page) {
  await enterRecording(page)
  await page
    .getByRole('group', { name: 'Free-form mode' })
    .getByRole('button', { name: 'Practice', exact: true })
    .click()
  const deck = page.getByTestId('guitar-free-form-practice-deck')
  await deck.getByRole('button', { name: 'Play practice', exact: true }).click()
  const prompt = page.getByRole('dialog', {
    name: 'Enable Listening to practice',
    exact: true,
  })
  await expect(prompt).toBeVisible()
  return { deck, prompt }
}

test('Practice offers visible input recovery, leaves monitoring opt-in and advances after explicit Play @smoke', async ({
  page,
}) => {
  const { deck, prompt } = await openPrompt(page)
  expect(await page.evaluate(() => window.__songAudioProbe.micCalls)).toBe(0)
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 })
    await expect(
      prompt.getByRole('button', { name: 'Direct input', exact: true }),
    ).toBeInViewport()
    await expect(
      prompt.getByRole('button', {
        name: 'Replay without scoring',
        exact: true,
      }),
    ).toBeInViewport()
    const box = await prompt.boundingBox()
    expect(box!.x).toBeGreaterThanOrEqual(0)
    expect(box!.x + box!.width).toBeLessThanOrEqual(width)
    await test.info().attach(`practice-input-${width}`, {
      body: await page.screenshot({
        path: `/tmp/guitar-practice-input-${width}.png`,
      }),
      contentType: 'image/png',
    })
  }
  await page.setViewportSize({ width: 1440, height: 900 })
  await prompt
    .getByRole('button', { name: 'Direct input', exact: true })
    .click()
  await expect(prompt).toBeHidden()
  expect(await page.evaluate(() => window.__songAudioProbe.micCalls)).toBe(1)
  await expect(
    page.getByRole('button', { name: 'Turn on your monitoring', exact: true }),
  ).toHaveAttribute('aria-pressed', 'false')
  await expect(
    deck.getByRole('button', { name: 'Play practice', exact: true }),
  ).toBeVisible()
  expect(
    await page.evaluate(() => window.__songAudioProbe.sources.length),
  ).toBe(0)
  await expect(
    page.getByText(
      'Turn on Listening to score your playing against these notes.',
      { exact: true },
    ),
  ).toBeHidden()
  await deck.getByRole('button', { name: 'Play practice', exact: true }).click()
  await expect(
    deck.getByRole('button', { name: 'Pause practice', exact: true }),
  ).toBeVisible()
  const seek = deck.getByRole('slider', {
    name: 'Practice position',
    exact: true,
  })
  await expect
    .poll(async () => Number(await seek.inputValue()))
    .toBeGreaterThan(0.2)
})

test('Practice input dismissal cancels late permission and Replay stays capture-free @smoke', async ({
  page,
}) => {
  const { deck, prompt } = await openPrompt(page)
  await page.evaluate(() => {
    const original = navigator.mediaDevices.getUserMedia.bind(
      navigator.mediaDevices,
    )
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
      configurable: true,
      value: async (constraints: MediaStreamConstraints) => {
        const stream = await original(constraints)
        await new Promise<void>((resolve) =>
          window.addEventListener('release-test-input', () => resolve(), {
            once: true,
          }),
        )
        return stream
      },
    })
  })
  await prompt
    .getByRole('button', { name: 'Direct input', exact: true })
    .click()
  await expect
    .poll(() => page.evaluate(() => window.__songAudioProbe.micTracks.length))
    .toBe(1)
  await prompt
    .getByRole('button', { name: 'Close practice input', exact: true })
    .click()
  await expect(prompt).toBeHidden()
  // A browser permission prompt can outlive our dialog. Cancelling must free
  // the controls immediately, and its late result must not close a new prompt.
  await deck.getByRole('button', { name: 'Play practice', exact: true }).click()
  await expect(prompt).toBeVisible()
  await page.evaluate(() =>
    window.dispatchEvent(new Event('release-test-input')),
  )
  await expect
    .poll(() =>
      page.evaluate(() =>
        window.__songAudioProbe.micTracks.map((track) => track.readyState),
      ),
    )
    .toEqual(['ended'])
  expect(
    await page.evaluate(() => window.__songAudioProbe.sources.length),
  ).toBe(0)
  await expect(prompt).toBeVisible()
  await prompt
    .getByRole('button', { name: 'Replay without scoring', exact: true })
    .click()
  await expect(prompt).toBeHidden()
  await expect(
    page
      .getByRole('group', { name: 'Free-form mode' })
      .getByRole('button', { name: 'Replay', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true')
  expect(await page.evaluate(() => window.__songAudioProbe.micCalls)).toBe(1)
})

test('closing Practice input during device enumeration never starts capture @smoke', async ({
  page,
}) => {
  const { deck, prompt } = await openPrompt(page)
  await page.evaluate(() => {
    const original = navigator.mediaDevices.enumerateDevices.bind(
      navigator.mediaDevices,
    )
    Object.defineProperty(navigator.mediaDevices, 'enumerateDevices', {
      configurable: true,
      value: async () => {
        document.documentElement.dataset.inputEnumeration = 'waiting'
        await new Promise<void>((resolve) =>
          window.addEventListener('release-test-enumeration', () => resolve(), {
            once: true,
          }),
        )
        return original()
      },
    })
  })
  await prompt
    .getByRole('button', { name: 'Direct input', exact: true })
    .click()
  await expect(page.locator('html')).toHaveAttribute(
    'data-input-enumeration',
    'waiting',
  )
  await prompt
    .getByRole('button', { name: 'Close practice input', exact: true })
    .click()
  await deck.getByRole('button', { name: 'Play practice', exact: true }).click()
  await expect(prompt).toBeVisible()
  await page.evaluate(() =>
    window.dispatchEvent(new Event('release-test-enumeration')),
  )
  await prompt
    .getByRole('button', { name: 'Replay without scoring', exact: true })
    .click()
  await expect(
    page
      .getByRole('group', { name: 'Free-form mode' })
      .getByRole('button', { name: 'Replay', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true')
  expect(await page.evaluate(() => window.__songAudioProbe.micCalls)).toBe(0)
  expect(
    await page.evaluate(() => window.__songAudioProbe.sources.length),
  ).toBe(0)
})

test('Practice permission failure remains actionable and opens the existing input settings @smoke', async ({
  page,
}) => {
  const { prompt } = await openPrompt(page)
  await page.evaluate(() => {
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
      configurable: true,
      value: async () => {
        throw new DOMException('Permission denied', 'NotAllowedError')
      },
    })
  })
  await prompt
    .getByRole('button', { name: 'Direct input', exact: true })
    .click()
  await expect(prompt.getByRole('alert')).toBeVisible()
  await expect(
    prompt.getByRole('button', { name: 'Direct input', exact: true }),
  ).toBeEnabled()
  await prompt
    .getByRole('button', { name: 'Input settings', exact: true })
    .click()
  await expect(prompt).toBeHidden()
  await expect(
    page.getByRole('dialog', { name: 'Session', exact: true }),
  ).toBeVisible()
  expect(
    await page.evaluate(() => window.__songAudioProbe.sources.length),
  ).toBe(0)
})
