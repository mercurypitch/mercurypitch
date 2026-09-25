import { readFile } from 'node:fs/promises'

import { expect, test } from '@playwright/test'

import { createDemoLevel, inspectGeometry, parseLevelJson, } from './level-model.js'

const studioPath = '/art/glass-adventure/level-studio/v1/index.html'

async function openStudio(page) {
  if (process.env.LEVEL_STUDIO_MUTATION === 'missing-pointer-move') {
    await page.route('**/level-studio/v1/app.js', async (route) => {
      const response = await route.fetch()
      const source = await response.text()
      const mutated = source.replace(
        "stageSvg.addEventListener('pointermove', onStagePointerMove)",
        "stageSvg.addEventListener('pointermove', () => {})",
      )
      await route.fulfill({ response, body: mutated })
    })
  }
  await page.goto(studioPath)
  await expect(page.getByTestId('studio')).toBeVisible()
  await expect
    .poll(() =>
      page.evaluate(
        () => window.__CLOUDWAY_LEVEL_STUDIO__?.snapshot().pieces.length,
      ),
    )
    .toBe(15)
}

async function snapshot(page) {
  return page.evaluate(() => window.__CLOUDWAY_LEVEL_STUDIO__.snapshot())
}

function piece(level, id) {
  return level.pieces.find((candidate) => candidate.id === id)
}

test('real mouse drags and resizes a platform @smoke', async ({ page }) => {
  await openStudio(page)
  const before = await snapshot(page)
  const beforePiece = piece(before, 'approach-deck')
  const body = page.getByTestId('piece-body-approach-deck')
  const bodyBox = await body.boundingBox()
  expect(bodyBox).not.toBeNull()

  await page.mouse.move(
    bodyBox.x + bodyBox.width / 2,
    bodyBox.y + bodyBox.height / 2,
  )
  await page.mouse.down()
  await page.mouse.move(
    bodyBox.x + bodyBox.width / 2 + 90,
    bodyBox.y + bodyBox.height / 2 + 45,
    {
      steps: 5,
    },
  )
  await page.mouse.up()

  await expect
    .poll(async () => piece(await snapshot(page), 'approach-deck').x)
    .not.toBe(beforePiece.x)

  const afterDrag = piece(await snapshot(page), 'approach-deck')
  const handle = page.getByTestId('resize-handle-approach-deck')
  await expect(handle).toBeVisible()
  const handleBox = await handle.boundingBox()
  expect(handleBox).not.toBeNull()
  await page.mouse.move(
    handleBox.x + handleBox.width / 2,
    handleBox.y + handleBox.height / 2,
  )
  await page.mouse.down()
  await page.mouse.move(
    handleBox.x + handleBox.width / 2 + 85,
    handleBox.y + handleBox.height / 2 + 55,
    {
      steps: 5,
    },
  )
  await page.mouse.up()

  await expect
    .poll(async () => piece(await snapshot(page), 'approach-deck').width)
    .toBeGreaterThan(afterDrag.width)
  await expect
    .poll(async () => piece(await snapshot(page), 'approach-deck').depth)
    .toBeGreaterThan(afterDrag.depth)
  await expect(page.getByRole('button', { name: 'Undo' })).toBeEnabled()
})

test.describe('touch tablet input', () => {
  test.use({
    viewport: { width: 820, height: 1180 },
    hasTouch: true,
    isMobile: true,
  })

  test('native touch drags, taps, and cancels from real child targets @smoke', async ({
    page,
    context,
  }) => {
    await openStudio(page)
    const client = await context.newCDPSession(page)
    const body = page.getByTestId('piece-body-approach-deck')
    const bodyBox = await body.boundingBox()
    expect(bodyBox).not.toBeNull()
    const start = {
      x: Math.round(bodyBox.x + bodyBox.width / 2),
      y: Math.round(bodyBox.y + bodyBox.height / 2),
    }
    const before = piece(await snapshot(page), 'approach-deck')

    await client.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ ...start, id: 1, radiusX: 4, radiusY: 4, force: 1 }],
    })
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [
        {
          x: start.x + 78,
          y: start.y + 34,
          id: 1,
          radiusX: 4,
          radiusY: 4,
          force: 1,
        },
      ],
    })
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [],
    })

    await expect
      .poll(async () => piece(await snapshot(page), 'approach-deck').x)
      .not.toBe(before.x)

    const frostBody = page.getByTestId('piece-body-frost-spur')
    await frostBody.tap()
    await expect(page.locator('[data-piece-id="frost-spur"]')).toHaveClass(
      /is-selected/,
    )

    const selectedBox = await frostBody.boundingBox()
    const cancelStart = {
      x: Math.round(selectedBox.x + selectedBox.width / 2),
      y: Math.round(selectedBox.y + selectedBox.height / 2),
    }
    const beforeCancel = piece(await snapshot(page), 'frost-spur')
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [
        { ...cancelStart, id: 2, radiusX: 4, radiusY: 4, force: 1 },
      ],
    })
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [
        {
          x: cancelStart.x + 70,
          y: cancelStart.y - 42,
          id: 2,
          radiusX: 4,
          radiusY: 4,
          force: 1,
        },
      ],
    })
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchCancel',
      touchPoints: [],
    })
    await expect
      .poll(async () => piece(await snapshot(page), 'frost-spur'))
      .toEqual(beforeCancel)
  })
})

test('JSON export-import round trip and malformed import guard @smoke', async ({
  page,
}) => {
  await openStudio(page)
  await page.getByRole('button', { name: 'Export JSON' }).click()
  const exportedText = await page.locator('#exportText').inputValue()
  const exported = JSON.parse(exportedText)
  expect(exported.schema).toBe('mercurypitch.cloudway-level')
  expect(exported.schemaVersion).toBe(1)
  expect(exported.pieces).toHaveLength(15)
  expect(piece(exported, 'scroll-bridge').motion).toEqual({
    axis: 'x',
    minLengthRatio: 0.25,
    extendedSeconds: 4,
    retractedSeconds: 3,
    transitionSeconds: 1.5,
    initialState: 'retracted',
  })

  await page.getByRole('button', { name: 'Close export dialog' }).click()
  exported.title = 'Round trip proof'
  exported.untrustedUrl = 'https://invalid.example/script.js'
  await page.getByRole('button', { name: 'Import JSON' }).click()
  await page.locator('#importText').fill(JSON.stringify(exported))
  await page.getByRole('button', { name: 'Import level' }).click()
  await expect
    .poll(async () => (await snapshot(page)).title)
    .toBe('Round trip proof')
  expect(
    await page.evaluate(
      () => 'untrustedUrl' in window.__CLOUDWAY_LEVEL_STUDIO__.snapshot(),
    ),
  ).toBe(false)

  const beforeMalformed = await snapshot(page)
  await page.getByRole('button', { name: 'Import JSON' }).click()
  await page.locator('#importText').fill('{"schema":')
  await page.getByRole('button', { name: 'Import level' }).click()
  await expect(page.locator('#importErrors')).toContainText(
    'JSON could not be parsed',
  )
  expect(await snapshot(page)).toEqual(beforeMalformed)

  const semanticallyInvalid = structuredClone(beforeMalformed)
  piece(semanticallyInvalid, 'voice-fifth').melodyNoteId = 'missing-note'
  piece(semanticallyInvalid, 'scroll-bridge').motion.transitionSeconds = 0
  await page.locator('#importText').fill(JSON.stringify(semanticallyInvalid))
  await page.getByRole('button', { name: 'Import level' }).click()
  await expect(page.locator('#importErrors')).toContainText(
    'references an unknown melody note',
  )
  await expect(page.locator('#importErrors')).toContainText(
    'must be a finite number from 0.25 to 30',
  )
  expect(await snapshot(page)).toEqual(beforeMalformed)
})

test('safe route anchors and transient-support warnings @smoke', async () => {
  const fixtureText = await readFile(
    new URL('./example-cloudway-level.json', import.meta.url),
    'utf8',
  )
  const fixture = parseLevelJson(fixtureText)
  expect(fixture.errors).toEqual([])
  expect(fixture.level.pieces).toHaveLength(10)
  expect(inspectGeometry(fixture.level)).toEqual([])
  expect(inspectGeometry(createDemoLevel())).toEqual([])

  const transientSupport = createDemoLevel()
  const transientExit = piece(transientSupport, 'exit-main')
  transientExit.x = 9
  transientExit.z = -5.5
  expect(
    inspectGeometry(transientSupport).map((notice) => notice.code),
  ).toContain('unsafe-anchor-support')

  const overhang = createDemoLevel()
  piece(overhang, 'exit-main').x = 7.4
  expect(inspectGeometry(overhang).map((notice) => notice.code)).toContain(
    'support-overhang',
  )
})
