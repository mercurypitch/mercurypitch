// Journey camera route probes — physical keyboard traversal and lifecycle cleanup.

import { expect, type Page } from '@playwright/test'

export interface PlayerPosition {
  x: number
  y: number
  z: number
}

export async function numericAdventureAttribute(
  page: Page,
  name: string,
): Promise<number> {
  const value = await page
    .getByTestId('glass-adventure')
    .getAttribute(`data-${name}`)
  if (value === null || !Number.isFinite(Number(value)))
    throw new Error(`Missing numeric adventure attribute: ${name}`)
  return Number(value)
}

export async function adventurePlayerPosition(
  page: Page,
): Promise<PlayerPosition> {
  return {
    x: await numericAdventureAttribute(page, 'player-x'),
    y: await numericAdventureAttribute(page, 'player-y'),
    z: await numericAdventureAttribute(page, 'player-z'),
  }
}

export function cameraAngleDelta(from: number, to: number): number {
  return Math.atan2(Math.sin(to - from), Math.cos(to - from))
}

async function pointCameraAt(page: Page, targetYaw: number): Promise<void> {
  const initialDelta = cameraAngleDelta(
    await numericAdventureAttribute(page, 'camera-yaw'),
    targetYaw,
  )
  if (Math.abs(initialDelta) < 0.08) return
  const key = initialDelta > 0 ? 'ArrowRight' : 'ArrowLeft'
  await page.keyboard.down(key)
  try {
    await expect
      .poll(
        async () =>
          Math.abs(
            cameraAngleDelta(
              await numericAdventureAttribute(page, 'camera-yaw'),
              targetYaw,
            ),
          ),
        { timeout: 4_000, intervals: [16] },
      )
      .toBeLessThan(0.08)
  } finally {
    await page.keyboard.up(key)
  }
}

export async function traverseJourneyPassageAndCorner(
  page: Page,
): Promise<void> {
  const start = await adventurePlayerPosition(page)
  const north = Math.PI

  // Step around the central decanter, then return to the route spine before
  // crossing the garden's visible north threshold.
  await pointCameraAt(page, north)
  await page.keyboard.down('KeyD')
  try {
    await expect
      .poll(
        async () =>
          start.x - (await numericAdventureAttribute(page, 'player-x')),
        { timeout: 4_000, intervals: [16] },
      )
      .toBeGreaterThan(1.25)
  } finally {
    await page.keyboard.up('KeyD')
  }

  await pointCameraAt(page, north)
  await page.keyboard.down('KeyW')
  try {
    await expect
      .poll(
        async () =>
          (await numericAdventureAttribute(page, 'player-z')) - start.z,
        { timeout: 5_000, intervals: [16] },
      )
      .toBeGreaterThan(5.3)
  } finally {
    await page.keyboard.up('KeyW')
  }

  await pointCameraAt(page, north)
  await page.keyboard.down('KeyA')
  try {
    await expect
      .poll(async () => await numericAdventureAttribute(page, 'player-x'), {
        timeout: 4_000,
        intervals: [16],
      })
      .toBeGreaterThan(start.x - 0.2)
  } finally {
    await page.keyboard.up('KeyA')
  }

  await pointCameraAt(page, north)
  await page.keyboard.down('KeyW')
  try {
    await expect
      .poll(
        async () =>
          (await numericAdventureAttribute(page, 'player-z')) - start.z,
        { timeout: 6_000, intervals: [16] },
      )
      .toBeGreaterThan(13.35)
  } finally {
    await page.keyboard.up('KeyW')
  }
  const beyondGardenThreshold = await adventurePlayerPosition(page)
  expect(beyondGardenThreshold.z - start.z).toBeGreaterThan(13.35)

  // At the authored right turn, W+A initially asks for the diagonal. The
  // north wall redirects Merc east, so the follow camera must settle on the
  // stable effective route heading without feeding that yaw back into WASD.
  await pointCameraAt(page, north)
  await page.keyboard.down('KeyW')
  await page.keyboard.down('KeyA')
  try {
    await page.waitForTimeout(50)
    const chordHeading = await numericAdventureAttribute(page, 'travel-yaw')
    await expect
      .poll(
        async () =>
          (await numericAdventureAttribute(page, 'player-x')) - start.x,
        { timeout: 7_000, intervals: [16] },
      )
      .toBeGreaterThan(4.5)
    await expect
      .poll(
        async () =>
          Math.abs(
            cameraAngleDelta(
              await numericAdventureAttribute(page, 'camera-yaw'),
              (await numericAdventureAttribute(page, 'merc-yaw')) + Math.PI,
            ),
          ),
        { timeout: 6_000 },
      )
      .toBeLessThan(0.16)
    expect(
      Math.abs(
        cameraAngleDelta(
          await numericAdventureAttribute(page, 'camera-yaw'),
          chordHeading,
        ),
      ),
    ).toBeGreaterThan(0.3)
  } finally {
    await page.keyboard.up('KeyA')
    await page.keyboard.up('KeyW')
  }

  const afterCorner = await adventurePlayerPosition(page)
  expect(afterCorner.x - start.x).toBeGreaterThan(4.5)
  expect(afterCorner.z - start.z).toBeGreaterThan(15.5)
  expect(afterCorner.z).toBeLessThan(25.9)
}

export async function verifyBlockedJourneyCameraReacquisition(
  page: Page,
): Promise<void> {
  const initialYaw = await numericAdventureAttribute(page, 'camera-yaw')
  const initialPosition = await adventurePlayerPosition(page)

  await page.keyboard.down('ArrowRight')
  await page.waitForTimeout(200)
  await page.keyboard.up('ArrowRight')
  expect(
    Math.abs(
      cameraAngleDelta(
        initialYaw,
        await numericAdventureAttribute(page, 'camera-yaw'),
      ),
    ),
  ).toBeGreaterThan(0.2)
  expect(
    Math.hypot(
      (await numericAdventureAttribute(page, 'player-x')) - initialPosition.x,
      (await numericAdventureAttribute(page, 'player-z')) - initialPosition.z,
    ),
  ).toBeLessThan(0.02)

  await page.getByRole('button', { name: 'Recenter camera' }).click()
  await page.waitForTimeout(50)
  await page.keyboard.down('KeyW')
  await page.keyboard.down('KeyD')
  try {
    await expect
      .poll(
        async () =>
          Math.abs(
            cameraAngleDelta(
              initialYaw,
              await numericAdventureAttribute(page, 'camera-yaw'),
            ),
          ),
        { timeout: 5_000 },
      )
      .toBeGreaterThan(0.35)
    await expect
      .poll(
        async () =>
          initialPosition.x -
          (await numericAdventureAttribute(page, 'player-x')),
        { timeout: 7_000 },
      )
      .toBeGreaterThan(2.5)
    await expect
      .poll(
        async () =>
          (await numericAdventureAttribute(page, 'player-z')) -
          initialPosition.z,
        { timeout: 7_000 },
      )
      .toBeGreaterThan(3)
    await expect
      .poll(
        async () =>
          Math.abs(
            cameraAngleDelta(
              await numericAdventureAttribute(page, 'camera-yaw'),
              (await numericAdventureAttribute(page, 'merc-yaw')) + Math.PI,
            ),
          ),
        { timeout: 7_000 },
      )
      .toBeLessThan(0.16)

    await page.keyboard.down('ArrowRight')
    try {
      await expect
        .poll(
          async () =>
            Math.abs(
              cameraAngleDelta(
                await numericAdventureAttribute(page, 'camera-yaw'),
                (await numericAdventureAttribute(page, 'merc-yaw')) + Math.PI,
              ),
            ),
          { timeout: 8_000, intervals: [16] },
        )
        .toBeGreaterThan(3)
    } finally {
      await page.keyboard.up('ArrowRight')
    }
    const frontFacingYaw = await numericAdventureAttribute(page, 'camera-yaw')

    await page.waitForTimeout(800)
    expect(
      Math.abs(
        cameraAngleDelta(
          frontFacingYaw,
          await numericAdventureAttribute(page, 'camera-yaw'),
        ),
      ),
    ).toBeLessThan(0.04)
    await expect
      .poll(
        async () =>
          Math.abs(
            cameraAngleDelta(
              await numericAdventureAttribute(page, 'camera-yaw'),
              (await numericAdventureAttribute(page, 'merc-yaw')) + Math.PI,
            ),
          ),
        { timeout: 6_000 },
      )
      .toBeLessThan(0.16)
  } finally {
    await page.keyboard.up('KeyD')
    await page.keyboard.up('KeyW')
  }
}

export async function verifyHeldArrowLifecycleCleanup(
  page: Page,
): Promise<void> {
  await page.keyboard.down('ArrowRight')
  await page.waitForTimeout(200)
  await page.evaluate(() => window.dispatchEvent(new Event('blur')))
  const blurReleasedYaw = await numericAdventureAttribute(page, 'camera-yaw')
  await page.waitForTimeout(250)
  expect(
    Math.abs(
      cameraAngleDelta(
        blurReleasedYaw,
        await numericAdventureAttribute(page, 'camera-yaw'),
      ),
    ),
  ).toBeLessThan(0.02)
  await page.keyboard.up('ArrowRight')

  await page.keyboard.down('ArrowLeft')
  await page.waitForTimeout(200)
  await page.getByRole('button', { name: 'Pause game' }).click()
  await expect(
    page.getByRole('dialog', { name: 'Take a little breath.' }),
  ).toBeVisible()
  const modalReleasedYaw = await numericAdventureAttribute(page, 'camera-yaw')
  await page.waitForTimeout(250)
  expect(
    Math.abs(
      cameraAngleDelta(
        modalReleasedYaw,
        await numericAdventureAttribute(page, 'camera-yaw'),
      ),
    ),
  ).toBeLessThan(0.02)
  await page.keyboard.up('ArrowLeft')
}
