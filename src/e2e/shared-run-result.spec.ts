// Shared result links reach the built app without adding runs to the guest's history.
import { readFileSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'
import { encodeSharedRunResult } from '../lib/shared-run-result'

const version = (
  JSON.parse(readFileSync('package.json', 'utf8')) as { version: string }
).version
const existingHistory = [
  {
    sessionId: 'existing-guest-run',
    name: 'Earlier practice',
    sessionName: 'Earlier practice',
    score: 64,
    practiceItemResult: [],
    itemsCompleted: 1,
    completedAt: 1_760_270_400_000,
  },
]

async function readHistory(page: Page) {
  return page.evaluate(
    () =>
      new Promise((resolve, reject) => {
        const request = indexedDB.open('MercuryPitchDB')
        request.onerror = () => reject(request.error)
        request.onsuccess = () => {
          const db = request.result
          const transaction = db.transaction('sessionRecords', 'readonly')
          const records = transaction.objectStore('sessionRecords').getAll()
          transaction.oncomplete = () => {
            db.close()
            resolve({
              records: records.result,
              sessions: localStorage.getItem('pitchperfect_session_history'),
              exercises: localStorage.getItem('mercurypitch_exercise_history'),
            })
          }
          transaction.onabort = () => {
            db.close()
            reject(transaction.error)
          }
        }
      }),
  )
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(
    ({ version, history }) => {
      ;(window as Window & { E2E_TEST_MODE?: boolean }).E2E_TEST_MODE = true
      localStorage.setItem('pitchperfect_welcome_version', version)
      localStorage.setItem('pitchperfect_onboarding_done', '1')
      localStorage.setItem('pitchperfect_focus_mode', 'false')
      if (localStorage.getItem('pitchperfect_session_history') === null) {
        localStorage.setItem(
          'pitchperfect_session_history',
          JSON.stringify(history),
        )
      }
    },
    { version, history: existingHistory },
  )
  await page.route('https://**/*', (route) => route.abort())
  await page.goto('/#/community')
  await expect(
    page.getByRole('heading', { name: 'Community', exact: true }),
  ).toBeVisible()
  await expect
    .poll(() =>
      page.evaluate(async () =>
        (await indexedDB.databases()).map((database) => database.name),
      ),
    )
    .toContain('MercuryPitchDB')
})

test('opens a Unicode guest result on a phone and returns without recording a run @smoke', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const before = await readHistory(page)
  expect(before).toMatchObject({
    records: [],
    sessions: JSON.stringify(existingHistory),
  })
  // An unbroken title checks that a recipient's narrow screen does not overflow.
  const name = `Željkina vježba: ${'DugiNaslov'.repeat(12)}`
  const payload = encodeSharedRunResult({
    name,
    author: 'François Šarić',
    results: [0, 87.5, 100],
    date: 1_760_270_400_000,
  })
  if (payload === null)
    throw new Error('The valid shared result did not encode')

  await page.goto(`/#/result/${payload}`)
  const result = page.getByRole('region', { name: 'Shared practice result' })
  await expect(result.getByRole('heading', { level: 1 })).toHaveText(name)
  await expect(result).toContainText('by François Šarić')
  await expect(
    result.getByRole('list', { name: 'Shared scores' }).getByRole('listitem'),
  ).toHaveText(['0%', '87.5%', '100%'])
  await expect(page).toHaveURL(new RegExp(`/#/result/${payload}$`))
  expect(await readHistory(page)).toEqual(before)
  expect(
    await result.evaluate(
      (element) => element.scrollWidth <= element.clientWidth,
    ),
  ).toBe(true)
  const back = result.getByRole('button', { name: 'Back to Community' })
  expect((await back.boundingBox())?.height).toBeGreaterThanOrEqual(44)

  await back.click()
  await expect(page).toHaveURL(/\/#\/community$/)
  await expect(
    page.getByRole('heading', { name: 'Community', exact: true }),
  ).toBeVisible()
  await expect(result).toHaveCount(0)
  expect(await readHistory(page)).toEqual(before)
})

test('keeps a malformed result link on its unavailable page without recording a run @smoke', async ({
  page,
}) => {
  const before = await readHistory(page)
  await page.goto('/#/result/not-base64!')
  const result = page.getByRole('region', { name: 'Shared practice result' })
  await expect(result.getByRole('status')).toHaveText(
    'This shared result is unavailable. It may have been unpublished, or the link may be incomplete.',
  )
  await expect(result.getByRole('list', { name: 'Shared scores' })).toHaveCount(
    0,
  )
  await expect(page).toHaveURL(/\/#\/result\/not-base64!$/)
  expect(await readHistory(page)).toEqual(before)
})
