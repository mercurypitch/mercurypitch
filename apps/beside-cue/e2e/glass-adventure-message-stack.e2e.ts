// Glass adventure message stack — keep contextual copy bounded around live controls.

import { expect, test, type Page } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { CLOUDWAY_CURRENT_TRIAL } from '../../../packages/glass-game/src/content/cloudway-layouts'
import { installCloudwayVisit } from './helpers/cloudway-platform-proof'

test.use({
  launchOptions: {
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  },
})
test.setTimeout(180_000)

const VIEWPORTS = [
  { label: 'phone', width: 390, height: 844, touch: true },
  { label: 'tablet', width: 768, height: 1_024, touch: true },
  { label: 'desktop', width: 1_180, height: 800, touch: false },
] as const

const tutorialPreference = `beside-cue:glass-adventure:tutorial:${CLOUDWAY_CURRENT_TRIAL.id}:cloudway-first-crossing:v2`

async function openVisit(page: Page): Promise<void> {
  await installCloudwayVisit(page, { realRendering: false })
  await page.addInitScript(
    (key) => localStorage.setItem(key, 'seen'),
    tutorialPreference,
  )
  const response = await page.goto('/glass-game/?layout=cloudway-current', {
    waitUntil: 'domcontentloaded',
  })
  expect(response?.status()).toBe(200)
  await expect(page.getByTestId('glass-adventure')).toHaveAttribute(
    'data-ready',
    'true',
    { timeout: 60_000 },
  )
}

async function messageLayout(page: Page) {
  return page.getByTestId('glass-message-stack').evaluate((stack) => {
    const stackBox = stack.getBoundingClientRect()
    const rows = [...stack.children].map((row) => {
      const box = row.getBoundingClientRect()
      return {
        bottom: box.bottom,
        left: box.left,
        right: box.right,
        top: box.top,
      }
    })
    const controls = [
      {
        name: 'move',
        element: document.querySelector<HTMLElement>(
          '[role="group"][aria-label="Move Merc"]',
        ),
      },
      {
        name: 'jump',
        element: document.querySelector<HTMLElement>(
          'button[aria-label="Jump"]',
        ),
      },
      {
        name: 'sing',
        element: document.querySelector<HTMLElement>(
          '[data-testid="glass-sing-action"]',
        ),
      },
    ]
      .filter(
        (control): control is { name: string; element: HTMLElement } =>
          control.element !== null,
      )
      .filter((control) => control.element.getClientRects().length > 0)
      .map((control) => ({
        name: control.name,
        box: control.element.getBoundingClientRect(),
      }))
    const overlaps = (left: DOMRect, right: DOMRect) =>
      left.left < right.right &&
      left.right > right.left &&
      left.top < right.bottom &&
      left.bottom > right.top
    const style = getComputedStyle(stack)
    return {
      count: rows.length,
      display: style.display,
      insideViewport:
        stackBox.left >= 0 &&
        stackBox.right <= window.innerWidth &&
        stackBox.top >= 0 &&
        stackBox.bottom <= window.innerHeight,
      rowOverlap:
        rows.length > 1 &&
        rows.slice(1).some((row, index) => {
          const previous = rows[index]
          return previous !== undefined && previous.bottom > row.top
        }),
      overlappingControls: controls
        .filter((control) => overlaps(stackBox, control.box))
        .map((control) => control.name),
    }
  })
}

test('stacks two current messages and clears them for the voice challenge @smoke', async ({
  browser,
}) => {
  const proofDirectory = process.env.GLASS_MESSAGE_STACK_PROOF_DIR
  if (proofDirectory !== undefined)
    await mkdir(resolve(proofDirectory), { recursive: true })

  for (const viewport of VIEWPORTS) {
    const context = await browser.newContext({
      hasTouch: viewport.touch,
      isMobile: viewport.touch,
      viewport: { width: viewport.width, height: viewport.height },
    })
    const page = await context.newPage()
    try {
      await openVisit(page)

      const sing = page.getByRole('button', { name: /Sing to the glass/ })
      await expect(sing).toBeVisible()
      await expect(page.getByTestId('glass-message-stack')).toHaveAttribute(
        'data-message-count',
        '1',
      )
      if (proofDirectory !== undefined)
        await page.screenshot({
          path: resolve(proofDirectory, `nearby-${viewport.label}.png`),
        })
      expect(await messageLayout(page)).toMatchObject({
        count: 1,
        display: 'grid',
        insideViewport: true,
        overlappingControls: [],
        rowOverlap: false,
      })

      await sing.click()
      await expect(
        page.getByRole('region', { name: 'Voice challenge' }),
      ).toBeVisible()
      await expect(page.getByTestId('glass-message-stack')).toHaveCount(0)

      await page.reload({ waitUntil: 'domcontentloaded' })
      await expect(page.getByTestId('glass-adventure')).toHaveAttribute(
        'data-ready',
        'true',
        { timeout: 60_000 },
      )
      await page.keyboard.down('KeyS')
      await expect(sing).toHaveCount(0, { timeout: 10_000 })
      await page.keyboard.up('KeyS')
      await expect(page.getByTestId('glass-progress-guidance')).toBeVisible()
      const stack = page.getByTestId('glass-message-stack')
      await expect(stack).toHaveAttribute('data-message-count', '2')
      expect(await messageLayout(page)).toMatchObject({
        count: 2,
        display: 'grid',
        insideViewport: true,
        overlappingControls: [],
        rowOverlap: false,
      })

      if (proofDirectory !== undefined)
        await page.screenshot({
          path: resolve(proofDirectory, `message-stack-${viewport.label}.png`),
        })
    } finally {
      await page.keyboard.up('KeyS').catch(() => undefined)
      await context.close()
    }
  }
})
