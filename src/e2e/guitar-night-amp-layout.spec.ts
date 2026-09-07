// Shared guitar amp controls fit both rehearsal hosts without clipped or undersized controls.
import { expect, test } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'
import { join } from 'node:path'

import { seedAuthoredGuitarScore } from './helpers/guitar-night-score'
import { enterSong } from './helpers/guitar-night-song'

const VIEWPORTS = [
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1440, height: 900 },
]

async function openAmp(page: Page, host: 'song' | 'score'): Promise<Locator> {
  await page.route('https://**/*', (route) => route.abort())
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = async () => {
      throw new Error('Layout inspection must not request microphone input')
    }
  })
  if (host === 'song') {
    await enterSong(page, 2)
  } else {
    const songId = 'amp-layout-study'
    await seedAuthoredGuitarScore(page, songId)
    await page.goto(`/guitar-night?song=${songId}`, {
      waitUntil: 'domcontentloaded',
    })
    await page.getByRole('button', { name: 'Load a song', exact: true }).click()
    await page
      .getByRole('button', { name: 'Practice with tab', exact: true })
      .click()
  }
  // Song uses a dialog trigger; score keeps its native Session disclosure.
  await page.getByLabel('Session controls', { exact: true }).click()
  const amp = page.getByRole('region', { name: 'Guitar amp', exact: true })
  await expect(amp).toBeVisible()
  return amp
}

async function assertControls(amp: Locator): Promise<void> {
  const controls = amp.locator(
    'button:visible, select:visible, input:visible, summary:visible',
  )
  expect(await controls.count()).toBeGreaterThanOrEqual(5)
  for (const control of await controls.all()) {
    await control.scrollIntoViewIfNeeded()
    const box = await control.boundingBox()
    if (box === null) throw new Error('Amp control has no layout bounds')
    expect(box.height).toBeGreaterThanOrEqual(44)
    expect(box.width).toBeGreaterThanOrEqual(44)
    const geometry = await control.evaluate((element) => {
      const bounds = element.getBoundingClientRect()
      const amp = element.closest('section[aria-label="Guitar amp"]')!
      const panel = element.closest('[role="dialog"]') ?? amp.parentElement!
      const ampBounds = amp.getBoundingClientRect()
      const panelBounds = panel.getBoundingClientRect()
      const x = bounds.left + bounds.width / 2
      const y = bounds.top + bounds.height / 2
      const hit = document.elementFromPoint(x, y)
      return {
        controlLeft: bounds.left,
        controlRight: bounds.right,
        ampLeft: ampBounds.left,
        ampRight: ampBounds.right,
        panelTop: panelBounds.top,
        panelBottom: panelBounds.bottom,
        centreY: y,
        hittable: element.contains(hit),
        disabled: 'disabled' in element && element.disabled,
      }
    })
    expect(geometry.controlLeft).toBeGreaterThanOrEqual(geometry.ampLeft - 1)
    expect(geometry.controlRight).toBeLessThanOrEqual(geometry.ampRight + 1)
    expect(geometry.centreY).toBeGreaterThanOrEqual(geometry.panelTop)
    expect(geometry.centreY).toBeLessThanOrEqual(geometry.panelBottom)
    // Disabled monitor buttons are intentionally inert; they still need space.
    if (!geometry.disabled) expect(geometry.hittable).toBe(true)
  }
  const overflow = await amp.evaluate((element) => {
    const panel = element.closest('[role="dialog"]') ?? element.parentElement!
    return {
      amp: element.scrollWidth - element.clientWidth,
      panel: panel.scrollWidth - panel.clientWidth,
      page:
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    }
  })
  expect(overflow.amp).toBeLessThanOrEqual(1)
  expect(overflow.panel).toBeLessThanOrEqual(1)
  expect(overflow.page).toBeLessThanOrEqual(1)
  const monitorLayout = await amp
    .getByRole('button', { name: 'Turn monitoring on', exact: true })
    .evaluate((button) => {
      const hint = document.getElementById(
        button.getAttribute('aria-describedby')!,
      )!
      const buttonBounds = button.getBoundingClientRect()
      const hintBounds = hint.getBoundingClientRect()
      return {
        horizontalOverlap:
          Math.min(buttonBounds.right, hintBounds.right) -
          Math.max(buttonBounds.left, hintBounds.left),
        verticalOverlap:
          Math.min(buttonBounds.bottom, hintBounds.bottom) -
          Math.max(buttonBounds.top, hintBounds.top),
        hintWidth: hintBounds.width,
      }
    })
  expect(
    Math.min(monitorLayout.horizontalOverlap, monitorLayout.verticalOverlap),
  ).toBeLessThanOrEqual(0)
  expect(monitorLayout.hintWidth).toBeGreaterThan(80)
}

async function capture(
  page: Page,
  amp: Locator,
  name: string,
  toneOpen = false,
): Promise<void> {
  const directory = process.env.GUITAR_AMP_LAYOUT_ARTIFACTS
  const path =
    directory === undefined
      ? test.info().outputPath(name)
      : join(directory, name)
  const target = toneOpen
    ? amp.getByRole('slider', { name: 'Guitar amp bass', exact: true })
    : amp.getByRole('combobox', { name: 'Guitar amp preset', exact: true })
  await target.scrollIntoViewIfNeeded()
  await page.screenshot({ path })
  await test.info().attach(name, { path, contentType: 'image/png' })
}

for (const host of ['song', 'score'] as const) {
  for (const viewport of VIEWPORTS) {
    test(`keeps ${host} amp controls usable at ${viewport.width}px @smoke`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport)
      const amp = await openAmp(page, host)
      const preset = amp.getByRole('combobox', {
        name: 'Guitar amp preset',
        exact: true,
      })
      await preset.selectOption('tight')
      await expect(
        amp.getByRole('slider', { name: 'Guitar amp character', exact: true }),
      ).toBeVisible()
      await assertControls(amp)
      await capture(page, amp, `${host}-${viewport.width}-tight.png`)

      await amp.getByText('Shape tone & cabinet', { exact: true }).click()
      await assertControls(amp)
      await capture(page, amp, `${host}-${viewport.width}-tone.png`, true)

      await preset.selectOption('heavy')
      await amp.getByText('Shape tone & cabinet', { exact: true }).click()
      await expect(
        amp.getByRole('slider', { name: 'Guitar amp character', exact: true }),
      ).toBeHidden()
      await expect(
        amp.getByRole('combobox', {
          name: 'Guitar cabinet voicing',
          exact: true,
        }),
      ).toBeHidden()
      await expect(amp.getByRole('status')).toHaveText(
        'Cabinet loads when you play an electric part or monitor Direct input.',
      )
      await assertControls(amp)
      await capture(page, amp, `${host}-${viewport.width}-heavy.png`)
    })
  }
}
