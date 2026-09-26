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
  { label: 'phone', width: 390, height: 844, touch: true, safeAreaBottom: 0 },
  {
    label: 'phone-safe-area-34',
    width: 390,
    height: 844,
    touch: true,
    safeAreaBottom: 34,
  },
  {
    label: 'tablet',
    width: 768,
    height: 1_024,
    touch: true,
    safeAreaBottom: 0,
  },
  {
    label: 'desktop',
    width: 1_180,
    height: 800,
    touch: false,
    safeAreaBottom: 0,
  },
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

async function openGarden(page: Page): Promise<void> {
  await page.addInitScript(() => {
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
    const prefix = 'beside-cue:glass-adventure:'
    localStorage.setItem(`${prefix}tutorial`, 'seen')
    localStorage.setItem(
      `${prefix}progress:glassworks-journey/journey`,
      JSON.stringify({
        version: 1,
        levelId: 'glassworks-journey/journey',
        checkpointId: 'glassworks-journey/journey/garden/checkpoint/entry',
        completedBreakableIds: [
          'glassworks-journey/journey/vestibule/encounter/vestibule-goblet',
        ],
      }),
    )
  })
  const response = await page.goto('/glass-game/?layout=journey', {
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
    const sing = document.querySelector<HTMLElement>(
      '[data-testid="glass-sing-action"]',
    )
    const encounterOffer = sing?.parentElement ?? null
    if (
      sing !== null &&
      (encounterOffer === null ||
        encounterOffer.children.length !== 2 ||
        encounterOffer.firstElementChild?.tagName !== 'SPAN' ||
        encounterOffer.lastElementChild !== sing)
    )
      throw new Error(
        'The Sing action is not inside its complete offer wrapper.',
      )
    const encounterOfferBox = encounterOffer?.getBoundingClientRect()
    const controls = [
      {
        name: 'move',
        element: document.querySelector<HTMLElement>(
          '[data-testid="floating-stick-base"][data-active="true"]',
        ),
      },
      {
        name: 'jump',
        element: document.querySelector<HTMLElement>(
          'button[aria-label="Jump"]',
        ),
      },
      {
        name: 'encounter-offer',
        element: encounterOffer,
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
      encounterOffer:
        encounterOfferBox === undefined
          ? null
          : {
              bottomClearance: window.innerHeight - encounterOfferBox.bottom,
              verticalGap: encounterOfferBox.top - stackBox.bottom,
            },
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
      stackBottomClearance: window.innerHeight - stackBox.bottom,
    }
  })
}

test('stacks two current messages and clears them for the voice challenge @smoke', async ({
  browser,
}) => {
  const proofDirectory = process.env.GLASS_MESSAGE_STACK_PROOF_DIR
  if (proofDirectory !== undefined)
    await mkdir(resolve(proofDirectory), { recursive: true })
  let phoneClearance: { offer: number; stack: number } | null = null

  for (const viewport of VIEWPORTS) {
    const context = await browser.newContext({
      hasTouch: viewport.touch,
      isMobile: viewport.touch,
      viewport: { width: viewport.width, height: viewport.height },
    })
    const page = await context.newPage()
    const cdp = await context.newCDPSession(page)
    try {
      await cdp.send('Emulation.setSafeAreaInsetsOverride', {
        insets: {
          top: 0,
          right: 0,
          bottom: viewport.safeAreaBottom,
          left: 0,
        },
      })
      await openVisit(page)

      const sing = page.getByRole('button', { name: /Sing to the glass/ })
      await expect(sing).toBeVisible()
      const initialStack = page.getByTestId('glass-message-stack')
      await expect(initialStack).toHaveRole('status')
      await expect(initialStack).toHaveAttribute('aria-live', 'polite')
      await expect(initialStack).toHaveAttribute('aria-atomic', 'false')
      await expect(initialStack).toHaveAttribute(
        'aria-label',
        'Museum guidance',
      )
      await expect(initialStack).toHaveAttribute('data-message-count', '1')
      if (proofDirectory !== undefined)
        await page.screenshot({
          path: resolve(proofDirectory, `nearby-${viewport.label}.png`),
        })
      const nearbyLayout = await messageLayout(page)
      expect(nearbyLayout).toMatchObject({
        count: 1,
        display: 'grid',
        insideViewport: true,
        overlappingControls: [],
        rowOverlap: false,
      })
      expect(nearbyLayout.encounterOffer).not.toBeNull()
      const encounterOfferLayout = nearbyLayout.encounterOffer!
      if (viewport.label === 'phone' || viewport.label === 'phone-safe-area-34')
        expect(encounterOfferLayout.verticalGap).toBeGreaterThanOrEqual(8)
      else expect(encounterOfferLayout.verticalGap).toBeGreaterThanOrEqual(0)
      if (viewport.label === 'phone')
        phoneClearance = {
          offer: encounterOfferLayout.bottomClearance,
          stack: nearbyLayout.stackBottomClearance,
        }
      if (viewport.safeAreaBottom > 0) {
        expect(phoneClearance).not.toBeNull()
        expect(
          encounterOfferLayout.bottomClearance - phoneClearance!.offer,
        ).toBeGreaterThanOrEqual(viewport.safeAreaBottom - 8)
        expect(
          nearbyLayout.stackBottomClearance - phoneClearance!.stack,
        ).toBeGreaterThanOrEqual(viewport.safeAreaBottom - 8)
      }

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
      await cdp.detach().catch(() => undefined)
      await context.close()
    }
  }
})

test('hides contextual messages behind pause, tutorial and artwork dialogs @smoke', async ({
  page,
}) => {
  await openGarden(page)
  const stack = page.getByTestId('glass-message-stack')
  await expect(stack).toBeVisible()

  await page.getByRole('button', { name: 'Pause game' }).click()
  const pause = page.getByRole('dialog', { name: 'Take a little breath.' })
  await expect(pause).toBeVisible()
  await expect(stack).toHaveCount(0)
  await pause.getByRole('button', { name: 'Back to the museum' }).click()
  await expect(stack).toBeVisible()

  await page.getByRole('button', { name: 'How to play' }).click()
  const tutorial = page.getByRole('dialog').filter({
    has: page.getByRole('button', { name: 'Skip tutorial' }),
  })
  await expect(tutorial).toBeVisible()
  await expect(stack).toHaveCount(0)
  await tutorial.getByRole('button', { name: 'Skip tutorial' }).click()
  await expect(stack).toBeVisible()

  await page.getByRole('button', { name: 'View nearby artwork' }).click()
  await expect(
    page.getByRole('dialog', { name: 'The garden between notes' }),
  ).toBeVisible()
  await expect(stack).toHaveCount(0)
})
