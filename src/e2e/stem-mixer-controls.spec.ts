// ============================================================
// Stem Mixer controls — real-pointer mute, solo, and fader coherence
// ============================================================

import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import { writeToneWav } from './helpers/tone-wav'
import { dismissOverlays } from './helpers/ui'

interface MixerE2EStore {
  initSessionStore: () => Promise<void>
  getUvrSession: (id: string) => unknown
  importUvrSessionDurable: (session: unknown) => Promise<boolean>
}

const SESSION_ID = 'e2e-stem-mix-controls'
const NEXT_SESSION_ID = 'e2e-stem-mix-drawer-target'
const EXTRA_STEMS = [
  { key: 'drums', label: 'Drums' },
  { key: 'piano', label: 'Piano' },
  { key: 'guitar', label: 'Guitar' },
  { key: 'bass', label: 'Bass' },
  { key: 'other', label: 'Other' },
] as const
const toneDataUrl = `data:audio/wav;base64,${fs
  .readFileSync(writeToneWav(220, 1))
  .toString('base64')}`

test.use({ viewport: { width: 1440, height: 900 } })

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    ;(window as unknown as Record<string, unknown>).E2E_TEST_MODE = true
  })
  await page.goto('/')
  await dismissOverlays(page)
  await page.waitForFunction(() => window.__pp?.appStore !== undefined)

  await page.evaluate(
    async ({ audioUrl, extraStems, nextSessionId, sessionId }) => {
      const store = window.__pp?.appStore as unknown as MixerE2EStore
      await store.initSessionStore()
      if (store.getUvrSession(sessionId) === undefined) {
        await store.importUvrSessionDurable({
          sessionId,
          status: 'completed',
          progress: 100,
          originalFile: {
            name: 'Stem control regression.wav',
            size: 1,
            mimeType: 'audio/wav',
          },
          outputs: { vocal: audioUrl, instrumental: audioUrl },
          createdAt: Date.now(),
        })
      }
      if (store.getUvrSession(nextSessionId) === undefined) {
        await store.importUvrSessionDurable({
          sessionId: nextSessionId,
          status: 'completed',
          progress: 100,
          originalFile: {
            name: 'Drawer navigation target.wav',
            size: 1,
            mimeType: 'audio/wav',
          },
          outputs: { vocal: audioUrl, instrumental: audioUrl },
          createdAt: Date.now() - 1_000,
        })
      }

      const audioData = await fetch(audioUrl).then((response) =>
        response.arrayBuffer(),
      )
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open('MercuryPitchDB')
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      })
      const transaction = db.transaction('uvrStemBlobs', 'readwrite')
      const blobStore = transaction.objectStore('uvrStemBlobs')
      const existing = await new Promise<Array<{ stemType: string }>>(
        (resolve, reject) => {
          const request = blobStore.index('sessionId').getAll(sessionId)
          request.onsuccess = () =>
            resolve(request.result as Array<{ stemType: string }>)
          request.onerror = () => reject(request.error)
        },
      )
      const storedTypes = new Set(existing.map((record) => record.stemType))
      const now = new Date().toISOString()
      for (const part of extraStems) {
        if (storedTypes.has(part.key)) continue
        blobStore.add({
          id: crypto.randomUUID(),
          sessionId,
          stemType: part.key,
          derivedFrom: 'instrumental',
          producedBy: 'e2e-full-band',
          mimeType: 'audio/wav',
          data: audioData,
          size: audioData.byteLength,
          fileName: `${part.key}.wav`,
          createdAt: now,
          updatedAt: now,
        })
      }
      await new Promise<void>((resolve, reject) => {
        transaction.oncomplete = () => resolve()
        transaction.onerror = () => reject(transaction.error)
        transaction.onabort = () => reject(transaction.error)
      })
      db.close()
      localStorage.setItem('pitchperfect_mixer_strip_view', 'compact')
    },
    {
      audioUrl: toneDataUrl,
      extraStems: EXTRA_STEMS,
      nextSessionId: NEXT_SESSION_ID,
      sessionId: SESSION_ID,
    },
  )

  await page.goto(`/#/karaoke/session/${SESSION_ID}/mixer`)
  await dismissOverlays(page)
  await expect(page.locator('.stem-mixer')).toBeVisible({ timeout: 15_000 })
  await expect(page.getByRole('slider', { name: 'Vocal volume' })).toBeVisible({
    timeout: 15_000,
  })
})

test('preserves solo isolation and mute through a real fader drag @smoke', async ({
  page,
}) => {
  const vocal = page.getByRole('group', { name: 'Vocal stem controls' })
  const instrumental = page.getByRole('group', {
    name: 'Instrumental stem controls',
  })
  const vocalMute = page.getByRole('button', { name: 'Mute Vocal' })
  const vocalSolo = page.getByRole('button', { name: 'Solo Vocal' })
  const instrumentalSolo = page.getByRole('button', {
    name: 'Solo Instrumental',
  })

  await vocalMute.click()
  await instrumentalSolo.click()
  await expect(vocalMute).toHaveAttribute('aria-pressed', 'true')
  await expect(vocal).toHaveAttribute('data-audible', 'false')
  await expect(instrumental).toHaveAttribute('data-audible', 'true')

  const slider = page.getByRole('slider', { name: 'Vocal volume' })
  const box = await slider.boundingBox()
  if (box === null) throw new Error('Vocal fader has no bounding box')
  const y = box.y + box.height / 2

  await page.mouse.move(box.x + box.width * 0.8, y)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width * 0.35, y, { steps: 8 })
  await page.mouse.up()

  const finalValue = Number(await slider.inputValue())
  expect(finalValue).toBeGreaterThanOrEqual(20)
  expect(finalValue).toBeLessThanOrEqual(55)
  await expect(vocal.locator('.sm-stem-vol-pct')).toHaveText(`${finalValue}%`)
  await expect(vocalMute).toHaveAttribute('aria-pressed', 'true')
  await expect(vocal).toHaveAttribute('data-audible', 'false')

  // Mute wins even when the same stem is soloed.
  await vocalSolo.click()
  await expect(vocal).toHaveAttribute('data-audible', 'false')

  // With both stems soloed and unmuted, releasing only Vocal must leave the
  // Instrumental solo isolated rather than restoring every unmuted stem.
  await vocalMute.click()
  await expect(vocal).toHaveAttribute('data-audible', 'true')
  await vocalSolo.click()
  await expect(vocal).toHaveAttribute('data-audible', 'false')
  await expect(instrumental).toHaveAttribute('data-audible', 'true')
})

test('switches songs directly from the Songs drawer @smoke', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Songs' }).click()
  await expect(
    page.getByRole('complementary', { name: 'Songs and playlists' }),
  ).toBeVisible()
  await expect(page.getByRole('tab', { name: /Songs/ })).toHaveAttribute(
    'aria-selected',
    'true',
  )

  await page.getByRole('button', { name: /Drawer navigation target/ }).click()

  await expect(
    page.getByRole('heading', {
      name: 'Drawer navigation target (session)',
    }),
  ).toBeVisible()
})

test('launches a full-band guitar role without doubling the backing @smoke', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Songs' }).click()
  const role = page.getByRole('combobox', {
    name: 'Choose what you perform in Stem control regression',
  })
  await expect(role).toBeEnabled()
  await expect(role.locator('option[value="guitar"]')).toHaveText(
    'I play guitar',
  )

  await role.selectOption('guitar')

  const guitar = page.getByRole('group', { name: 'Guitar stem controls' })
  await expect(guitar).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Mute Guitar' }),
  ).toHaveAttribute('aria-pressed', 'true')
  await expect(guitar).toHaveAttribute('data-audible', 'false')
  await expect(
    page.getByRole('group', { name: 'Instrumental stem controls' }),
  ).toHaveCount(0)
  await expect(
    page.getByRole('group', { name: 'Drums stem controls' }),
  ).toHaveAttribute('data-audible', 'true')
})

test('keeps seven-stem compact and expanded decks readable while scrolling @smoke', async ({
  page,
}) => {
  for (const part of EXTRA_STEMS) {
    await page.getByRole('button', { name: `+ ${part.label}` }).click()
    await expect(
      page.getByRole('group', { name: `${part.label} stem controls` }),
    ).toBeVisible()
  }

  const strips = page.locator('.sm-strips')
  const body = strips.locator('.sm-strips-body')
  await expect(strips).toHaveAttribute('data-stem-count', '7')

  await page.setViewportSize({ width: 1440, height: 520 })
  const compactMetrics = await body.evaluate((element) => {
    const cards = [...element.querySelectorAll<HTMLElement>('.sm-stem-strip')]
    return {
      clientHeight: element.clientHeight,
      scrollHeight: element.scrollHeight,
      minCardHeight: Math.min(...cards.map((card) => card.offsetHeight)),
    }
  })
  expect(compactMetrics.scrollHeight).toBeGreaterThan(
    compactMetrics.clientHeight,
  )
  expect(compactMetrics.minCardHeight).toBeGreaterThanOrEqual(48)

  await page
    .getByRole('button', { name: 'Switch to expanded stem controls' })
    .click()
  await expect(strips).toHaveClass(/sm-strips-expanded/)
  const expandedMetrics = await body.evaluate((element) => {
    const cards = [...element.querySelectorAll<HTMLElement>('.sm-stem-strip')]
    return {
      clientHeight: element.clientHeight,
      scrollHeight: element.scrollHeight,
      minCardHeight: Math.min(...cards.map((card) => card.offsetHeight)),
    }
  })
  expect(expandedMetrics.scrollHeight).toBeGreaterThan(
    expandedMetrics.clientHeight,
  )
  expect(expandedMetrics.minCardHeight).toBeGreaterThanOrEqual(190)

  // The overview now reserves a left label rail. Real pointer seeks must map
  // the remaining waveform width—not the whole canvas—or the playhead drifts.
  await page
    .getByRole('button', { name: 'Switch to compact stem controls' })
    .click()
  await page.setViewportSize({ width: 1440, height: 900 })
  const overview = page.locator('[data-canvas-id="overview"]').first()
  const overviewBox = await overview.boundingBox()
  if (overviewBox === null) throw new Error('Overview has no bounding box')
  const preferredRail =
    overviewBox.width >= 320
      ? 112
      : overviewBox.width >= 180
        ? 88
        : Math.max(36, overviewBox.width * 0.42)
  const railWidth = Math.round(
    Math.min(preferredRail, Math.max(0, overviewBox.width - 47)),
  )
  const waveformWidth = overviewBox.width - railWidth - 5

  await page.mouse.click(overviewBox.x + 8, overviewBox.y + 24)
  await expect
    .poll(async () =>
      parseFloat(
        await page
          .locator('.sm-progress-fill')
          .evaluate((element) => getComputedStyle(element).width),
      ),
    )
    .toBeLessThan(2)

  await page.mouse.click(
    overviewBox.x + railWidth + 1 + waveformWidth * 0.015,
    overviewBox.y + 24,
  )
  await expect
    .poll(async () => {
      const fill = page.locator('.sm-progress-fill')
      const progress = page.locator('.sm-progress-bar')
      const [fillBox, progressBox] = await Promise.all([
        fill.boundingBox(),
        progress.boundingBox(),
      ])
      if (fillBox === null || progressBox === null) return 0
      return fillBox.width / progressBox.width
    })
    // The one-second fixture sits inside the mixer's default thirty-second
    // window, so 1.5% of the visible waveform lands at 0.45 seconds. Mapping
    // against the whole canvas would include the rail and clamp to the end.
    .toBeCloseTo(0.45, 1)
})
