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
const TONE_WAV = writeToneWav(220, 1)
const toneDataUrl = `data:audio/wav;base64,${fs
  .readFileSync(TONE_WAV)
  .toString('base64')}`

// Cross-tab ownership is the behavior under test, not Chromium's fake-device
// plumbing. A Web Audio stream is deterministic and still exercises the real
// MicManager, BroadcastChannel lock, controller graph, and UI in both tabs.
const SYNTHETIC_MIC_INIT = () => {
  Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
    configurable: true,
    value: async () => {
      const context = new AudioContext()
      const oscillator = context.createOscillator()
      const destination = context.createMediaStreamDestination()
      oscillator.frequency.value = 220
      oscillator.connect(destination)
      oscillator.start()
      const testWindow = window as unknown as {
        __e2eMicResources?: Array<{
          context: AudioContext
          oscillator: OscillatorNode
        }>
      }
      testWindow.__e2eMicResources ??= []
      testWindow.__e2eMicResources.push({ context, oscillator })
      return destination.stream
    },
  })
}

test.use({
  viewport: { width: 1440, height: 900 },
  permissions: ['microphone'],
})

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    ;(window as unknown as Record<string, unknown>).E2E_TEST_MODE = true
  })
  await page.addInitScript(SYNTHETIC_MIC_INIT)
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
  const drawer = page.locator('aside[aria-label="Songs and playlists"]')
  await expect(drawer).toBeVisible()
  await expect(page.getByRole('tab', { name: /Songs/ })).toHaveAttribute(
    'aria-selected',
    'true',
  )

  const currentRole = page.getByRole('combobox', {
    name: 'Choose what you perform in Stem control regression',
  })
  await expect(currentRole).toBeEnabled()
  await drawer.evaluate((element) => {
    element.setAttribute('data-mount-probe', 'hydrated')
  })

  await page.getByRole('button', { name: 'Close songs' }).click()
  await expect(drawer).toBeHidden()
  await page.getByRole('button', { name: 'Songs' }).click()
  await expect(drawer).toHaveAttribute('data-mount-probe', 'hydrated')
  await expect(currentRole).toBeEnabled()

  // Scoped to the drawer on purpose: the sidebar's Song library rail lists
  // the same songs, so a page-wide lookup by title now matches two real
  // controls. This test is about the drawer's own list.
  await drawer.getByRole('button', { name: /Drawer navigation target/ }).click()

  await expect(
    page.getByRole('heading', {
      name: 'Drawer navigation target (session)',
    }),
  ).toBeVisible()
})

test('keeps the play-along role picker readable in dark and light themes @smoke', async ({
  page,
}) => {
  const readMetrics = (target: import('@playwright/test').Locator) =>
    target.evaluate((element) => {
      const parse = (value: string): [number, number, number] => {
        const channels = value.match(/[\d.]+/g)?.map(Number)
        if (channels === undefined || channels.length < 3) {
          throw new Error(`Expected an RGB color, received ${value}`)
        }
        return [channels[0], channels[1], channels[2]]
      }
      const luminance = ([red, green, blue]: [number, number, number]) => {
        const channels = [red, green, blue].map((channel) => {
          const value = channel / 255
          return value <= 0.04045
            ? value / 12.92
            : Math.pow((value + 0.055) / 1.055, 2.4)
        })
        return (
          0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]
        )
      }
      const style = getComputedStyle(element)
      const foreground = luminance(parse(style.color))
      const background = luminance(parse(style.backgroundColor))

      return {
        background: style.backgroundColor,
        color: style.color,
        colorScheme: style.getPropertyValue('color-scheme'),
        contrast:
          (Math.max(foreground, background) + 0.05) /
          (Math.min(foreground, background) + 0.05),
      }
    })

  const assertReadablePalette = async (
    role: import('@playwright/test').Locator,
    expectedScheme: 'dark' | 'light',
  ): Promise<void> => {
    await expect(role).toBeVisible()
    await expect(role).toHaveCSS('color-scheme', expectedScheme)
    const enabledOption = role.locator('option:not(:disabled)').first()
    await expect(enabledOption).toBeEnabled()

    for (const target of [role, enabledOption]) {
      // The surface eases between theme colors for 150ms. Poll until each
      // rendered pair is readable instead of sleeping for a fixed frame.
      await expect
        .poll(async () => (await readMetrics(target)).contrast)
        .toBeGreaterThanOrEqual(4.5)
      const metrics = await readMetrics(target)

      expect(metrics.background).not.toBe('rgba(0, 0, 0, 0)')
      expect(metrics.contrast, JSON.stringify(metrics)).toBeGreaterThanOrEqual(
        4.5,
      )
    }
  }

  const assertReadableTheme = async (
    role: import('@playwright/test').Locator,
    theme: 'dark' | 'light',
  ): Promise<void> => {
    await page.evaluate((nextTheme) => {
      document.documentElement.setAttribute('data-theme', nextTheme)
    }, theme)
    await assertReadablePalette(role, theme)
  }

  await page.getByRole('button', { name: 'Songs' }).click()
  const drawerRole = page.getByRole('combobox', {
    name: 'Choose what you perform in Stem control regression',
  })
  await expect(drawerRole).toBeEnabled()
  await assertReadableTheme(drawerRole, 'dark')
  await assertReadableTheme(drawerRole, 'light')
  await page.getByTitle('Karaoke focus mode').click()
  await expect(page.locator('.stem-mixer')).toHaveClass(/stem-mixer--focus/)
  await expect(drawerRole).toHaveCSS('background-color', 'rgb(28, 33, 40)')
  await assertReadablePalette(drawerRole, 'dark')

  await page.goto(`/#/karaoke/session/${SESSION_ID}`)
  await dismissOverlays(page)
  const sessionRole = page.getByRole('combobox', {
    name: 'Choose what you perform in this song',
  })
  await expect(sessionRole).toBeEnabled({ timeout: 15_000 })
  await assertReadableTheme(sessionRole, 'dark')
  await assertReadableTheme(sessionRole, 'light')
})

test('recovers the mixer mic button after a cross-tab handoff @smoke', async ({
  page,
}) => {
  const micButton = (target: import('@playwright/test').Page) =>
    target.getByRole('button', {
      name: /^(?:Enable|Disable|Retry) microphone$/,
    })
  const secondPage = await page.context().newPage()
  await secondPage.addInitScript(() => {
    ;(window as unknown as Record<string, unknown>).E2E_TEST_MODE = true
  })
  await secondPage.addInitScript(SYNTHETIC_MIC_INIT)
  await secondPage.goto(`/#/karaoke/session/${SESSION_ID}/mixer`)
  await dismissOverlays(secondPage)
  await expect(secondPage.locator('.stem-mixer')).toBeVisible({
    timeout: 15_000,
  })

  // Prepare both tabs before opening the mic. Creating/loading the second tab
  // after capture starts can legitimately trigger the app's 20-second hidden
  // tab release policy before the handoff assertion is reached.
  await page.bringToFront()
  const firstMic = micButton(page)
  await firstMic.click()
  await expect(firstMic).toHaveAttribute('aria-pressed', 'true', {
    timeout: 15_000,
  })

  await secondPage.bringToFront()
  const secondMic = micButton(secondPage)
  await secondMic.click()
  const handoff = secondPage.getByRole('alertdialog', {
    name: 'Your mic is open in another tab',
  })
  await expect(handoff).toBeVisible()
  await handoff.getByRole('button', { name: 'Use it here' }).click()

  await expect(secondMic).toBeEnabled()
  await expect(secondMic).not.toHaveClass(/sm-mic-toggle-btn--error/)
  await secondMic.click()
  await expect(secondMic).toHaveAttribute('aria-pressed', 'true')

  // The tab that yielded must visibly become neutral/off. A handoff is
  // intentional, so presenting it as a red recording/error state is false.
  await expect(firstMic).toBeEnabled()
  await expect(firstMic).toHaveAccessibleName('Enable microphone')
  await expect(firstMic).toHaveAttribute('aria-pressed', 'false')
  await expect(firstMic).not.toHaveClass(/sm-mic-toggle-btn--(?:active|error)/)
  await secondPage.close()
})

test('maps a zoomed waveform context menu without seeking @smoke', async ({
  page,
}) => {
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
  const targetX = overviewBox.x + railWidth + 1 + waveformWidth * 0.02
  const targetY = overviewBox.y + Math.min(24, overviewBox.height / 2)

  // Zoom around the target first. The menu must use the same window and label
  // rail mapping as the waveform itself, not the canvas's full CSS box.
  await page.mouse.move(targetX, targetY)
  await page.mouse.wheel(0, -100)

  const progressWidth = () =>
    page
      .locator('.sm-progress-fill')
      .evaluate((element) => parseFloat(getComputedStyle(element).width))
  const before = await progressWidth()

  await page.mouse.click(targetX, targetY, { button: 'right' })
  const menu = page.locator('.sm-loop-menu')
  await expect(menu).toBeVisible()
  await expect(menu).toContainText('Loop point at 0:00')
  await expect.poll(progressWidth).toBeCloseTo(before, 1)

  await menu.getByRole('button', { name: 'Set loop start here' }).click()
  await expect(
    page.getByRole('button', { name: 'Set loop start (A)' }),
  ).toHaveClass(/sm-loop-btn--a-set/)

  await page.mouse.click(targetX, targetY, { button: 'right' })
  await expect(
    page.locator('.sm-loop-menu').getByRole('button', { name: 'Clear loop' }),
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

  await page.evaluate(() => {
    const testWindow = window as unknown as Record<string, unknown>
    let releaseGate: (() => void) | undefined
    testWindow.E2E_MIXER_PREPARATION_GATE = new Promise<void>((resolve) => {
      releaseGate = resolve
    })
    testWindow.E2E_RELEASE_MIXER_PREPARATION = () => releaseGate?.()
  })

  await role.selectOption('guitar')
  const preparation = page.getByRole('dialog', {
    name: /Preparing Stem control regression/,
  })
  await expect(preparation).toBeVisible()
  await expect(preparation.getByRole('progressbar')).toHaveAttribute(
    'aria-valuemax',
    '6',
  )

  // Cancelling leaves the current two-stem mixer untouched, even after the
  // held storage request is released. The same role can then be requested
  // again normally.
  await preparation.getByRole('button', { name: 'Cancel' }).click()
  await expect(preparation).toBeHidden()

  await page.evaluate(() => {
    const testWindow = window as unknown as Record<string, unknown>
    const release = testWindow.E2E_RELEASE_MIXER_PREPARATION
    if (typeof release === 'function') release()
    delete testWindow.E2E_MIXER_PREPARATION_GATE
    delete testWindow.E2E_RELEASE_MIXER_PREPARATION
  })
  await expect(
    page.getByRole('group', { name: 'Guitar stem controls' }),
  ).toHaveCount(0)

  await page.getByRole('button', { name: 'Songs' }).click()
  await expect(role).toBeEnabled()
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

  const vocalCard = page.getByRole('group', {
    name: 'Vocal stem controls',
  })
  const vocalSlider = page.getByRole('slider', { name: 'Vocal volume' })
  const compactSliderBox = await vocalSlider.boundingBox()
  if (compactSliderBox === null) {
    throw new Error('Compact Vocal fader has no bounding box')
  }
  await page.mouse.move(
    compactSliderBox.x + compactSliderBox.width * 0.8,
    compactSliderBox.y + compactSliderBox.height / 2,
  )
  await page.mouse.down()
  await page.mouse.move(
    compactSliderBox.x + compactSliderBox.width - 1,
    compactSliderBox.y + compactSliderBox.height / 2,
    { steps: 5 },
  )
  await page.mouse.up()
  await expect(vocalSlider).toHaveValue('100')

  const [vocalCardBox, maxSliderBox] = await Promise.all([
    vocalCard.boundingBox(),
    vocalSlider.boundingBox(),
  ])
  if (vocalCardBox === null || maxSliderBox === null) {
    throw new Error('Compact Vocal fader geometry is unavailable')
  }
  expect(
    vocalCardBox.x + vocalCardBox.width - (maxSliderBox.x + maxSliderBox.width),
  ).toBeGreaterThanOrEqual(7)

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

// ============================================================
// The music level is reachable on the phone, and it sticks
// ============================================================
//
// Reported: the backing track drops the moment the mic goes live and there is
// no way to bring it back. The app does no ducking of its own — the master was
// simply pinned at 0.7 with no control anywhere in the UI, so there was
// nothing to reach for. It is a stored, boostable level now.
//
// It shipped in this mixer's header, and the second report was that the one
// surface that needs it cannot see it: under `isNarrow()` StemMixer renders
// KaraokeMobileStage INSTEAD of the mixer, so on a phone the header is not on
// the page at all. The control lives on the zen transport now, beside the mic
// that makes it necessary, and the header no longer carries one.
//
// The clipper maths is pinned in
// `src/features/stem-mixer/master-headroom.test.ts` and the wiring in
// `src/tests/mixer-music-level.test.ts`. This is the half that needs a real
// browser: the presentation swap on resize, a real pointer on a capsule that
// resizes under the finger, and that the value survives a whole reload rather
// than only a re-render.

/** Press the capsule and slide `by` pixels up (negative slides down). */
async function dragLevel(
  page: import('@playwright/test').Page,
  by: number,
): Promise<void> {
  const box = await page.getByTestId('mobile-music-level').boundingBox()
  if (box === null) throw new Error('Music level pill has no bounding box')
  const x = box.x + box.width / 2
  const y = box.y + box.height / 2
  await page.mouse.move(x, y)
  await page.mouse.down()
  // In steps, because the capsule grows under the pointer as it opens: the
  // gesture has to keep reading its own start point, not the live geometry.
  for (let step = 1; step <= 6; step += 1) {
    await page.mouse.move(x, y - (by * step) / 6)
  }
  await page.mouse.up()
}

test('keeps a reachable music level that survives a reload @smoke', async ({
  page,
}) => {
  // The mixer is on screen from the shared setup. Narrowing swaps the
  // presentation without a reload — the audio engine lives in setup, not in
  // either JSX tree — which is the behaviour the zen stage was built on.
  await expect(page.locator('.stem-mixer')).toBeVisible()
  await expect(page.getByTestId('mixer-music-level')).toHaveCount(0)

  await page.setViewportSize({ width: 390, height: 844 })

  const level = page.getByTestId('mobile-music-level')
  await expect(level).toBeVisible()

  // It is the same capsule as the guide-vocal pill, so it answers to the same
  // things: a value for assistive tech, and a track that opens on touch.
  await expect(level).toHaveAttribute('role', 'slider')
  await expect(level).toHaveAttribute('aria-valuetext', '100 percent')
  await expect(level).not.toContainText('%')

  const closed = await level.boundingBox()
  if (closed === null) throw new Error('Music level pill has no bounding box')

  // A real pointer, because that is the gesture: press, slide, lift. 24px of
  // the 120px travel is a fifth of the range, and the readout appears over
  // the fill while the finger is down.
  await dragLevel(page, 24)
  await expect(level).toContainText('150%')
  await expect(level).toHaveAttribute('aria-valuetext', '150 percent')

  const open = await level.boundingBox()
  if (open === null) throw new Error('Music level pill has no bounding box')
  // Upright, and that is not decoration: a horizontal one had to be as wide
  // as the bar, which is what made the first cut a row inside the bar.
  expect(open.height).toBeGreaterThan(open.width * 2)
  expect(open.height).toBeGreaterThan(closed.height)

  // The keyboard reaches it too, and the store's own step is what one press
  // moves — 5% of the level the app has always played at.
  await level.focus()
  await page.keyboard.press('ArrowUp')
  await page.keyboard.press('ArrowUp')
  await expect(level).toContainText('160%')

  await expect
    .poll(() =>
      page.evaluate(() =>
        localStorage.getItem('pitchperfect_mixer_music_level'),
      ),
    )
    // 160% of the shipped 0.7, and no float tail: the store writes what it is
    // given straight to localStorage, and 1.12 in doubles is 1.1200000000000001.
    .toBe('1.12')

  await page.reload()
  await dismissOverlays(page)

  // The track is a gesture, not a state — it comes back closed, on the stored
  // level rather than the default.
  const reloaded = page.getByTestId('mobile-music-level')
  await expect(reloaded).not.toContainText('%')
  await expect(reloaded).toHaveAttribute('aria-valuetext', '160 percent')

  // And a tap on the capsule puts it back to the level the app ships at, so
  // there is a way home that does not need the value on screen.
  await dragLevel(page, 0)
  await expect(reloaded).toHaveAttribute('aria-valuetext', '100 percent')
})

// ============================================================
// Opening the music level costs the transport nothing
// ============================================================
//
// The second report on this control, from a tablet: "once I open it up, it
// conceals all playback commands, and none are reachable, not even the
// speaker toggle that opened it to close it", and from an iPhone: "it moves
// the playback control down".
//
// Both come from the same decision. The first cut put the slider in a row
// INSIDE the bottom bar, so the bar grew by the height of that row — 69px on
// a tablet, 83px on a phone, measured. Whatever cannot absorb that height
// pushes the transport towards, or past, the bottom of the screen, and the
// button that closes the panel goes with it.
//
// So the invariant is geometric, not visual: the bar and the transport must
// measure exactly the same open and closed. A capsule that grows upward out
// of the flow cannot fail it; any future control that takes a row in the bar
// will.
const ZEN_VIEWPORTS = [
  // A phone, where the stage renders because the viewport is narrow.
  { width: 390, height: 844, label: 'phone' },
  // A phone with barely any height — a landscape phone, or a resized window.
  // This is where a bar that grows has nothing left to take the height from.
  { width: 390, height: 420, label: 'short phone' },
  // A tablet in portrait, the device the report came from.
  { width: 768, height: 1024, label: 'tablet' },
] as const

test('opens the music level without moving the transport @smoke', async ({
  page,
}) => {
  const level = page.getByTestId('mobile-music-level')

  for (const viewport of ZEN_VIEWPORTS) {
    await page.setViewportSize({
      width: viewport.width,
      height: viewport.height,
    })
    await expect(level).toBeVisible()

    const measure = async (): Promise<{
      bar: number
      play: number
      pillBottom: number
      pillHeight: number
      pillTop: number
    }> =>
      page.evaluate(() => {
        const rect = (selector: string): DOMRect | undefined =>
          document.querySelector(selector)?.getBoundingClientRect()
        const play = rect('[aria-label="Play"], [aria-label="Pause"]')
        const pill = rect('[data-testid="mobile-music-level"]')
        return {
          bar: rect('[class*="bottomBar"]')?.height ?? -1,
          play: play?.top ?? -1,
          pillBottom: pill?.bottom ?? -1,
          pillHeight: pill?.height ?? -1,
          pillTop: pill?.top ?? -1,
        }
      })

    const closed = await measure()

    // Hold it open. Under the threshold, so this is a press, not a drag: the
    // level must not move for the geometry to be comparable.
    const box = await level.boundingBox()
    if (box === null) throw new Error('Music level pill has no bounding box')
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down()
    await expect(level).toContainText('%')

    // The capsule grows on a transition, so the readout appearing is not the
    // same moment as the geometry settling. Measure once it has stopped.
    await expect
      .poll(async () => (await measure()).pillHeight, { timeout: 4000 })
      .toBeGreaterThan(closed.pillHeight * 2)

    const open = await measure()

    expect(open.bar, `${viewport.label}: bottom bar height`).toBeCloseTo(
      closed.bar,
      1,
    )
    expect(open.play, `${viewport.label}: play button top`).toBeCloseTo(
      closed.play,
      1,
    )
    // It grows upward out of the flow: the capsule stays exactly where your
    // thumb left it, and the track appears above it.
    expect(open.pillBottom, `${viewport.label}: capsule bottom`).toBeCloseTo(
      closed.pillBottom,
      1,
    )
    expect(open.pillTop, `${viewport.label}: track rises`).toBeLessThan(
      closed.pillTop,
    )

    // Reachability is the half the geometry does not prove: the play button
    // must still answer a real tap while the level is open, and so must the
    // capsule itself.
    const hits = await page.evaluate(() => {
      const hit = (selector: string): boolean => {
        const element = document.querySelector(selector)
        if (element === null) return false
        const rect = element.getBoundingClientRect()
        if (rect.bottom > innerHeight || rect.top < 0) return false
        const at = document.elementFromPoint(
          rect.x + rect.width / 2,
          rect.y + rect.height / 2,
        )
        return at !== null && element.contains(at)
      }
      return {
        play: hit('[aria-label="Play"], [aria-label="Pause"]'),
        level: hit('[data-testid="mobile-music-level"]'),
      }
    })
    expect(hits.play, `${viewport.label}: play button reachable`).toBe(true)
    expect(hits.level, `${viewport.label}: level reachable`).toBe(true)

    await page.mouse.up()

    // Nothing to close, which is the point: it puts itself away a beat after
    // the finger lifts, and the level it was set to stays.
    await expect(level).not.toContainText('%', { timeout: 4000 })
    await expect(level).toHaveAttribute('aria-valuetext', '100 percent')
  }
})
