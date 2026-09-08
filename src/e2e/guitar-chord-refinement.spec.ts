// Real saved PCM crosses the packaged worker, reversible review and IndexedDB reload boundary.
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { enterRecording, RECORDING_ID } from './helpers/guitar-recording'

async function savedNotes(page: Page) {
  return page.evaluate(async (id) => {
    const open = indexedDB.open('MercuryPitchDB')
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      open.onsuccess = () => resolve(open.result)
      open.onerror = () => reject(open.error)
    })
    const tx = db.transaction(
      ['guitarRecordingChunks', 'guitarRecordings'],
      'readonly',
    )
    const read = (table: string, key: string) =>
      new Promise<Record<string, unknown>>((resolve, reject) => {
        const query = tx.objectStore(table).get(key)
        query.onsuccess = () => resolve(query.result)
        query.onerror = () => reject(query.error)
      })
    const [ending, recording] = await Promise.all([
      read('guitarRecordingChunks', `${id}:ending`),
      read('guitarRecordings', id),
    ])
    db.close()
    return { ending, recording }
  }, RECORDING_ID)
}

test('chord proposals are explicit, comparable, saved and undoable after reload @smoke', async ({
  page,
}) => {
  const issues: string[] = []
  const models: string[] = []
  page.on('pageerror', (error) => issues.push(error.message))
  page.on('console', (message) => {
    if (message.text().includes('computations created outside'))
      issues.push(message.text())
  })
  page.on('request', (request) => {
    if (request.url().endsWith('.onnx')) models.push(request.url())
  })
  await enterRecording(page)
  const original = await savedNotes(page)
  expect(models).toEqual([])
  await page.getByRole('button', { name: 'Review take', exact: true }).click()
  const review = page.getByRole('dialog').filter({ hasText: 'Recorded melody' })
  await review
    .getByRole('button', { name: 'Refine chords', exact: true })
    .click()
  await expect(
    review.getByRole('button', { name: 'Use refined notes' }),
  ).toBeVisible()
  expect(models).toHaveLength(1)
  expect((await savedNotes(page)).ending.editableScore).toBeUndefined()
  await expect(
    review.getByRole('button', { name: 'Practice these notes' }),
  ).toBeDisabled()
  await review.getByRole('radio', { name: /Current ·/ }).check()
  await expect(review.getByRole('radio', { name: /Current ·/ })).toBeChecked()
  await review.getByRole('radio', { name: /Refined ·/ }).check()
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 850 })
    const apply = review.getByRole('button', { name: 'Use refined notes' })
    await apply.scrollIntoViewIfNeeded()
    const panel = review.getByRole('region', { name: 'Chord refinement' })
    expect(
      await panel.evaluate((node) => node.scrollWidth <= node.clientWidth),
    ).toBe(true)
    await page.screenshot({
      path: test.info().outputPath(`chord-review-${width}.png`),
      animations: 'disabled',
    })
  }
  await review.getByRole('button', { name: 'Use refined notes' }).click()
  await expect(
    review.getByRole('button', { name: 'Restore previous notes' }),
  ).toBeEnabled()
  const refined = await savedNotes(page)
  expect(refined.ending.notes).toEqual(original.ending.notes)
  expect(refined.ending.refinementBackup).toBeDefined()
  expect(refined.recording.scoreId).toBeNull()
  await review.getByRole('button', { name: 'Keep take', exact: true }).click()
  await expect(
    review.getByRole('button', { name: 'Take kept', exact: true }),
  ).toBeDisabled()
  await page.reload()
  await expect(review).toBeVisible()
  await review.getByRole('button', { name: 'Restore previous notes' }).click()
  await expect(review.getByText(/Previous notes restored/)).toBeVisible()
  expect((await savedNotes(page)).ending.refinementBackup).toBeUndefined()
  await expect(
    review.getByRole('button', { name: 'Practice these notes' }),
  ).toBeEnabled()
  const download = page.waitForEvent('download')
  await review.getByRole('button', { name: 'Export MIDI', exact: true }).click()
  expect((await download).suggestedFilename()).toMatch(/\.mid$/)
  expect(issues).toEqual([])
})
