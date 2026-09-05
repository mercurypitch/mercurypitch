// ============================================================
// V2 onboarding — compact viewport layout contract
// ============================================================
//
// Interactive holds use one full-page content flow. Exercise the densest hold
// scenes in the real first-run journey to prove that compact phones and
// enlarged text can reach every control without horizontal overflow, stale
// scroll positions, or collisions with the fixed sound control.

import type { Locator, Page } from '@playwright/test'
import { expect, test } from '@playwright/test'

interface ViewportCase {
  readonly name: string
  readonly width: number
  readonly height: number
  readonly rootFontPx?: number
  readonly expectSingleViewport?: boolean
}

const CASES: readonly ViewportCase[] = [
  { name: '390x664', width: 390, height: 664, expectSingleViewport: true },
  { name: '375x667', width: 375, height: 667 },
  { name: '320x568', width: 320, height: 568 },
  { name: '390x844', width: 390, height: 844, expectSingleViewport: true },
  { name: '320x568-text-zoom-200', width: 320, height: 568, rootFontPx: 32 },
] as const

interface SceneProbe {
  readonly phase:
    | 'B03_PULL_CHOICE_HOLD'
    | 'B04_CUE_CONTEXT_HOLD'
    | 'B05_SIDE_B_CHOICE_HOLD'
    | 'B07_REMINDER_HOLD'
  readonly actionName: string
}

const SCENES = {
  pull: {
    phase: 'B03_PULL_CHOICE_HOLD',
    actionName: 'Continue',
  },
  context: {
    phase: 'B04_CUE_CONTEXT_HOLD',
    actionName: 'Choose Side B',
  },
  sideB: {
    phase: 'B05_SIDE_B_CHOICE_HOLD',
    actionName: 'Start the record',
  },
  reminder: {
    phase: 'B07_REMINDER_HOLD',
    actionName: 'Set reminder',
  },
} satisfies Record<string, SceneProbe>

async function selectFirstRadio(page: Page): Promise<void> {
  const radio = page.getByRole('radio').first()
  await radio.evaluate((element: HTMLInputElement) => element.click())
  await expect(radio).toBeChecked()
}

function safeName(value: string): string {
  return value
    .toLowerCase()
    .replaceAll('_', '-')
    .replaceAll(/[^a-z0-9-]/gu, '')
}

async function waitForPhase(page: Page, phase: SceneProbe['phase']) {
  const director = page.locator('main[data-phase]')
  await expect(director).toHaveAttribute('data-phase', phase, {
    timeout: 20_000,
  })
  return director
}

async function elementOverlap(a: Locator, b: Locator): Promise<boolean> {
  const [aBox, bBox] = await Promise.all([a.boundingBox(), b.boundingBox()])
  if (aBox === null || bBox === null) return false
  return !(
    aBox.x + aBox.width <= bBox.x ||
    aBox.x >= bBox.x + bBox.width ||
    aBox.y + aBox.height <= bBox.y ||
    aBox.y >= bBox.y + bBox.height
  )
}

async function fullyVisibleInScrollports(element: Locator): Promise<boolean> {
  return element.evaluate((node) => {
    const rect = node.getBoundingClientRect()
    let visibleTop = 0
    let visibleRight = innerWidth
    let visibleBottom = innerHeight
    let visibleLeft = 0

    for (
      let parent = node.parentElement;
      parent !== null;
      parent = parent.parentElement
    ) {
      const style = getComputedStyle(parent)
      const parentRect = parent.getBoundingClientRect()
      if (/(auto|clip|hidden|scroll)/u.test(style.overflowY)) {
        visibleTop = Math.max(visibleTop, parentRect.top)
        visibleBottom = Math.min(visibleBottom, parentRect.bottom)
      }
      if (/(auto|clip|hidden|scroll)/u.test(style.overflowX)) {
        visibleLeft = Math.max(visibleLeft, parentRect.left)
        visibleRight = Math.min(visibleRight, parentRect.right)
      }
    }

    return (
      rect.top >= visibleTop - 1 &&
      rect.right <= visibleRight + 1 &&
      rect.bottom <= visibleBottom + 1 &&
      rect.left >= visibleLeft - 1
    )
  })
}

async function verifyScene(
  page: Page,
  deviceCase: ViewportCase,
  scene: SceneProbe,
): Promise<Locator> {
  const director = await waitForPhase(page, scene.phase)
  const arrivalScrollY = await page.evaluate(() => scrollY)
  const heading = page.getByRole('heading', { level: 1 })
  const sound = page.locator(
    'button[aria-label="Mute audio"], button[aria-label="Unmute audio"]',
  )
  const action = page.getByRole('button', { name: scene.actionName })

  const metrics = await page.evaluate(() => {
    const directorElement =
      document.querySelector<HTMLElement>('main[data-phase]')
    const stageElement =
      directorElement?.querySelector<HTMLElement>(':scope > section')
    const headingElement = document.querySelector<HTMLElement>('h1')
    const soundElement = document.querySelector<HTMLElement>(
      'button[aria-label="Mute audio"], button[aria-label="Unmute audio"]',
    )
    const controlsElement = document.querySelector<HTMLElement>(
      'main[data-phase] [class*="copyControls"]',
    )
    const dialElement = document.querySelector<HTMLElement>(
      '[role="slider"][aria-label="Turn the record to choose a reminder time"]',
    )
    const captionElement = document.querySelector<HTMLElement>(
      'main[data-phase] h1 + p',
    )

    const rect = (element: HTMLElement | null) => {
      if (element === null) return null
      const box = element.getBoundingClientRect()
      return {
        top: box.top,
        right: box.right,
        bottom: box.bottom,
        left: box.left,
        width: box.width,
        height: box.height,
      }
    }
    const overlaps = (a: HTMLElement | null, b: HTMLElement | null) => {
      if (a === null || b === null) return false
      const ar = a.getBoundingClientRect()
      const br = b.getBoundingClientRect()
      return !(
        ar.right <= br.left ||
        ar.left >= br.right ||
        ar.bottom <= br.top ||
        ar.top >= br.bottom
      )
    }

    return {
      viewport: { width: innerWidth, height: innerHeight },
      documentWidth: document.documentElement.scrollWidth,
      documentHeight: document.documentElement.scrollHeight,
      scrollY,
      sessionKind: directorElement?.dataset.sessionKind ?? null,
      director: rect(directorElement),
      stage: rect(stageElement ?? null),
      stageScrollHeight: stageElement?.scrollHeight ?? null,
      stageClientHeight: stageElement?.clientHeight ?? null,
      stageScrollTop: stageElement?.scrollTop ?? null,
      heading: rect(headingElement),
      sound: rect(soundElement),
      controls: rect(controlsElement),
      controlsScrollHeight: controlsElement?.scrollHeight ?? null,
      controlsClientHeight: controlsElement?.clientHeight ?? null,
      controlsScrollTop: controlsElement?.scrollTop ?? null,
      dial: rect(dialElement),
      caption: rect(captionElement),
      captionText: captionElement?.textContent?.trim() ?? null,
      headingSoundOverlap: overlaps(headingElement, soundElement),
      soundBottom:
        soundElement === null ? null : getComputedStyle(soundElement).bottom,
      buttonSoundOverlaps:
        controlsElement === null
          ? []
          : Array.from(controlsElement.querySelectorAll<HTMLElement>('button'))
              .filter((button) => overlaps(button, soundElement))
              .map((button) => button.textContent?.trim() ?? ''),
    }
  })

  console.log(
    `[onboarding-layout] ${deviceCase.name} ${scene.phase} arrivalScrollY=${arrivalScrollY} ${JSON.stringify(metrics)}`,
  )

  const evidenceDirectory = process.env.BESIDE_CUE_LAYOUT_EVIDENCE_DIR
  if (evidenceDirectory !== undefined && evidenceDirectory !== '') {
    await page.screenshot({
      path: `${evidenceDirectory}/${deviceCase.name}-${safeName(scene.phase)}.png`,
    })
  }

  expect(arrivalScrollY).toBeLessThanOrEqual(1)
  expect(metrics.scrollY).toBeLessThanOrEqual(1)
  expect(metrics.sessionKind).toBe('first-run')
  expect(metrics.documentWidth).toBeLessThanOrEqual(metrics.viewport.width)
  expect(metrics.stageScrollTop).toBeLessThanOrEqual(1)
  expect(metrics.headingSoundOverlap).toBe(false)
  expect(metrics.controlsScrollTop).toBeLessThanOrEqual(1)
  expect(metrics.stage).not.toBeNull()
  expect(metrics.heading).not.toBeNull()
  expect(metrics.heading!.top).toBeGreaterThanOrEqual(metrics.stage!.top - 1)
  expect(metrics.heading!.bottom).toBeLessThanOrEqual(metrics.stage!.bottom + 1)
  expect(await fullyVisibleInScrollports(heading)).toBe(true)
  expect(metrics.sound).not.toBeNull()
  expect(metrics.sound!.left).toBeGreaterThanOrEqual(0)
  expect(metrics.sound!.right).toBeLessThanOrEqual(metrics.viewport.width)
  expect(metrics.sound!.top).toBeGreaterThanOrEqual(0)
  expect(metrics.sound!.bottom).toBeLessThanOrEqual(metrics.viewport.height)

  if (deviceCase.expectSingleViewport === true) {
    expect(metrics.documentHeight).toBeLessThanOrEqual(deviceCase.height + 1)
    expect(metrics.controlsScrollHeight).toBe(metrics.controlsClientHeight)
    expect(metrics.buttonSoundOverlaps).toEqual([])
  }

  if (scene.phase === 'B03_PULL_CHOICE_HOLD') {
    expect(metrics.captionText).toMatch(/notice sooner\.$/u)
    expect(metrics.caption).not.toBeNull()
    expect(metrics.caption!.top).toBeGreaterThanOrEqual(0)
  }

  await action.scrollIntoViewIfNeeded()
  const actionBox = await action.boundingBox()
  expect(actionBox).not.toBeNull()
  expect(actionBox!.x).toBeGreaterThanOrEqual(0)
  expect(actionBox!.x + actionBox!.width).toBeLessThanOrEqual(
    deviceCase.width + 1,
  )
  expect(actionBox!.y).toBeGreaterThanOrEqual(0)
  expect(actionBox!.y + actionBox!.height).toBeLessThanOrEqual(
    deviceCase.height + 1,
  )
  const stageBox = await director.locator(':scope > section').boundingBox()
  expect(stageBox).not.toBeNull()
  expect(actionBox!.y + actionBox!.height).toBeLessThanOrEqual(
    stageBox!.y + stageBox!.height + 1,
  )
  expect(await fullyVisibleInScrollports(action)).toBe(true)
  expect(await elementOverlap(action, sound)).toBe(false)
  expect(await elementOverlap(heading, sound)).toBe(false)
  const actionOverflow = await action.evaluate((element) => ({
    horizontal: element.scrollWidth - element.clientWidth,
    vertical: element.scrollHeight - element.clientHeight,
  }))
  expect(actionOverflow.horizontal).toBeLessThanOrEqual(1)
  expect(actionOverflow.vertical).toBeLessThanOrEqual(1)

  if (
    scene.phase === 'B03_PULL_CHOICE_HOLD' &&
    deviceCase.expectSingleViewport === true
  ) {
    const replay = page.getByRole('button', { name: 'Hear again' })
    await expect(replay).toBeVisible()
    await expect(replay).toBeDisabled()
    const replayBox = await replay.boundingBox()
    expect(replayBox).not.toBeNull()
    expect(replayBox!.width).toBeGreaterThanOrEqual(48)
    expect(replayBox!.height).toBeGreaterThanOrEqual(48)
    expect(actionBox!.height).toBeGreaterThanOrEqual(48)
    expect(replayBox!.x + replayBox!.width).toBeLessThanOrEqual(actionBox!.x)
    expect(Math.abs(replayBox!.y - actionBox!.y)).toBeLessThanOrEqual(1)
    expect(
      Math.abs(
        replayBox!.y + replayBox!.height - (actionBox!.y + actionBox!.height),
      ),
    ).toBeLessThanOrEqual(1)
    expect(await fullyVisibleInScrollports(replay)).toBe(true)
    expect(await elementOverlap(replay, sound)).toBe(false)
  }

  if (evidenceDirectory !== undefined && evidenceDirectory !== '') {
    await page.screenshot({
      path: `${evidenceDirectory}/${deviceCase.name}-${safeName(scene.phase)}-action.png`,
    })
  }

  return action
}

test.describe('V2 onboarding fits compact phones', () => {
  for (const deviceCase of CASES) {
    test(deviceCase.name, async ({ page }) => {
      test.setTimeout(60_000)
      await page.setViewportSize({
        width: deviceCase.width,
        height: deviceCase.height,
      })
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await page.goto('/')

      if (deviceCase.rootFontPx !== undefined) {
        await page.addStyleTag({
          content: `html { font-size: ${deviceCase.rootFontPx}px !important; }`,
        })
      }

      await expect(
        page.getByRole('button', { name: 'Tap to begin' }),
      ).toBeVisible()
      await page.getByRole('button', { name: 'Mute audio' }).click()
      await page.getByRole('button', { name: 'Tap to begin' }).click()

      await waitForPhase(page, SCENES.pull.phase)
      await selectFirstRadio(page)
      await (await verifyScene(page, deviceCase, SCENES.pull)).click()

      await waitForPhase(page, SCENES.context.phase)
      await selectFirstRadio(page)
      await (await verifyScene(page, deviceCase, SCENES.context)).click()

      await waitForPhase(page, SCENES.sideB.phase)
      await selectFirstRadio(page)
      await (await verifyScene(page, deviceCase, SCENES.sideB)).click()

      await expect(
        page.getByRole('button', { name: 'Stop and save plan' }),
      ).toBeVisible({ timeout: 20_000 })
      await page.getByRole('button', { name: 'Stop and save plan' }).click()

      await waitForPhase(page, SCENES.reminder.phase)
      await verifyScene(page, deviceCase, SCENES.reminder)
    })
  }
})
