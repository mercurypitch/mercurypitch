// Course codes travel through the real Games host without assuming a public URL or clipboard permission.
import { expect, test } from '@playwright/test'

test.use({ hasTouch: true })

for (const viewport of [
  { width: 320, height: 740 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
]) {
  test(`course sharing fits the Games host at ${viewport.width}px and survives clipboard denial @smoke`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize(viewport)
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: {
          writeText: async () => {
            throw new DOMException('Denied', 'NotAllowedError')
          },
        },
      })
    })
    await page.goto('/?devSeed&cold')
    await page.getByRole('button', { name: /B-side games/u }).tap()
    await page.getByRole('button', { name: /Little discoveries/u }).tap()
    await expect(
      page.getByRole('heading', { name: 'Cloudway Expedition Studio' }),
    ).toBeVisible()
    await page.getByLabel('Course seed').fill('shared-pearl')
    await page.getByRole('button', { name: 'Gentle', exact: true }).tap()
    await page
      .getByRole('button', { name: 'First Arc (3 notes)', exact: true })
      .tap()
    await page.getByRole('button', { name: 'Dawn', exact: true }).tap()
    await page.getByLabel('Living crystal', { exact: true }).uncheck()
    await page
      .getByRole('button', { name: 'Copy course code', exact: true })
      .tap()
    await expect(page.getByRole('status')).toContainText('Select and copy')
    const code = await page.getByLabel('Your course code').inputValue()
    expect(code).toMatch(/^cloudway:v1:/u)
    expect(code).not.toContain('localhost')
    await page.getByLabel('Your course code').tap()
    const selected = await page
      .getByLabel('Your course code')
      .evaluate(
        (node: HTMLTextAreaElement) => node.selectionEnd - node.selectionStart,
      )
    expect(selected).toBe(code.length)
    const geometry = await page
      .locator('section[aria-label="Procedural Cloudway Studio"]')
      .evaluate((section) => {
        const box = section.getBoundingClientRect()
        return {
          width: window.innerWidth,
          left: box.left,
          right: box.right,
          overflow: section.scrollWidth - section.clientWidth,
          overflows: [...section.querySelectorAll('*')]
            .filter((node) => node.getBoundingClientRect().right > box.right)
            .map((node) => ({
              tag: node.tagName,
              className: node.className,
              width: node.getBoundingClientRect().width,
              right: node.getBoundingClientRect().right,
            })),
          buttons: [...section.querySelectorAll('button')].map(
            (button) => button.getBoundingClientRect().height,
          ),
        }
      })
    expect(geometry.left).toBeGreaterThanOrEqual(0)
    expect(geometry.right).toBeLessThanOrEqual(geometry.width)
    expect(
      geometry.overflow,
      JSON.stringify(geometry.overflows),
    ).toBeLessThanOrEqual(1)
    expect(geometry.buttons.every((height) => height >= 44)).toBe(true)
    const screenshotPath = testInfo.outputPath('course-code-host.png')
    await page.screenshot({ path: screenshotPath })
    await testInfo.attach('course-code-host', {
      path: screenshotPath,
      contentType: 'image/png',
    })

    // Explicit import replaces settings but does not request microphone access or launch.
    await page.getByLabel('Course seed').fill('temporary-change')
    await page.getByLabel('Course code to import').fill(code)
    await page
      .getByRole('button', { name: 'Load course code', exact: true })
      .tap()
    await expect(page.getByLabel('Course seed')).toHaveValue('shared-pearl')
    await expect(
      page.getByRole('button', { name: 'Gentle', exact: true }),
    ).toHaveAttribute('aria-pressed', 'true')
    await expect(
      page.getByLabel('Living crystal', { exact: true }),
    ).not.toBeChecked()
    await expect(page.getByTestId('glass-adventure')).toHaveCount(0)

    await page.getByRole('button', { name: 'Back to games', exact: true }).tap()
    await page.getByRole('button', { name: /Little discoveries/u }).tap()
    await expect(page.getByLabel('Course seed')).toHaveValue('shared-pearl')
    await expect(
      page.getByRole('button', { name: /The archive after dark/u }),
    ).toBeVisible()
    expect(errors).toEqual([])
  })
}

test('a main-host course code launches the same course through the standalone Studio @smoke', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/?devSeed&cold')
  await page.getByRole('button', { name: /B-side games/u }).click()
  await page.getByRole('button', { name: /Little discoveries/u }).click()
  await page.getByLabel('Course seed').fill('shared-pearl')
  await page
    .getByRole('button', { name: 'First Arc (3 notes)', exact: true })
    .click()
  await page
    .getByRole('button', { name: 'Copy course code', exact: true })
    .click()
  const code = await page.getByLabel('Your course code').inputValue()
  await page
    .getByRole('button', { name: 'Launch expedition', exact: true })
    .click()
  const course = page.getByTestId('glass-adventure')
  await expect(course).toBeVisible()
  const identity = await course.getAttribute('data-level-id')
  expect(identity).toMatch(/^cloudway-procedural-v1-/u)

  await page.goto('/glass-game/?lab=creator-gallery')
  await page.getByLabel('Course seed').fill('different-course')
  await page.getByLabel('Course code to import').fill(code)
  await page
    .getByRole('button', { name: 'Load course code', exact: true })
    .click()
  await page
    .getByRole('button', { name: 'Launch expedition', exact: true })
    .click()
  await expect(page.getByTestId('glass-adventure')).toHaveAttribute(
    'data-level-id',
    identity!,
  )
  expect(errors).toEqual([])
})
