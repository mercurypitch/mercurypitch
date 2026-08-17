// Guitar Night smoke coverage protects the standalone boundary and first-viewport accessibility.
// ============================================================

import { devices, expect, test } from '@playwright/test'
import type { Locator } from '@playwright/test'

const TEST_SONG_DURATION_SECONDS = 4

function createTestWav(
  frequencyHz: number,
  durationSeconds = TEST_SONG_DURATION_SECONDS,
): Buffer {
  const sampleRate = 8_000
  const sampleCount = sampleRate * durationSeconds
  const bytesPerSample = 2
  const wav = Buffer.alloc(44 + sampleCount * bytesPerSample)

  wav.write('RIFF', 0)
  wav.writeUInt32LE(wav.length - 8, 4)
  wav.write('WAVE', 8)
  wav.write('fmt ', 12)
  wav.writeUInt32LE(16, 16)
  wav.writeUInt16LE(1, 20)
  wav.writeUInt16LE(1, 22)
  wav.writeUInt32LE(sampleRate, 24)
  wav.writeUInt32LE(sampleRate * bytesPerSample, 28)
  wav.writeUInt16LE(bytesPerSample, 32)
  wav.writeUInt16LE(16, 34)
  wav.write('data', 36)
  wav.writeUInt32LE(sampleCount * bytesPerSample, 40)

  for (let sample = 0; sample < sampleCount; sample += 1) {
    const seconds = sample / sampleRate
    const fade = Math.min(1, seconds * 20, (durationSeconds - seconds) * 20)
    const amplitude = Math.sin(seconds * frequencyHz * Math.PI * 2) * fade
    wav.writeInt16LE(Math.round(amplitude * 3_000), 44 + sample * 2)
  }

  return wav
}

async function instrumentAudioContext(
  page: import('@playwright/test').Page,
): Promise<void> {
  await page.addInitScript(() => {
    const trackedWindow = window as unknown as {
      __guitarNightAudioContexts: number
      AudioContext?: typeof AudioContext
      webkitAudioContext?: typeof AudioContext
    }
    trackedWindow.__guitarNightAudioContexts = 0

    const NativeAudioContext =
      trackedWindow.AudioContext ?? trackedWindow.webkitAudioContext
    if (NativeAudioContext === undefined) return

    const TrackedAudioContext = new Proxy(NativeAudioContext, {
      construct(target, args, newTarget) {
        trackedWindow.__guitarNightAudioContexts += 1
        return Reflect.construct(target, args, newTarget)
      },
    })
    trackedWindow.AudioContext = TrackedAudioContext
    trackedWindow.webkitAudioContext = TrackedAudioContext
  })
}

async function initializeGuitarNightDatabase(
  page: import('@playwright/test').Page,
): Promise<void> {
  await page.goto('/guitar-night', { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Load a song', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'Prepared songs', exact: true }),
  ).toBeVisible()
  await expect(page.getByText(/on this device$/)).toBeVisible()
}

async function seedCompletedTwoStemSong(
  page: import('@playwright/test').Page,
  sessionId: string,
  durationSeconds = TEST_SONG_DURATION_SECONDS,
): Promise<void> {
  const vocalWav = createTestWav(330, durationSeconds)
  const instrumentalWav = createTestWav(110, durationSeconds)

  await page.evaluate(
    async ({
      durationSeconds,
      instrumentalBase64,
      sessionId: seededSessionId,
      vocalBase64,
    }) => {
      const decodeBase64 = (encoded: string): ArrayBuffer => {
        const bytes = Uint8Array.from(atob(encoded), (character) =>
          character.charCodeAt(0),
        )
        return bytes.buffer
      }
      const vocalData = decodeBase64(vocalBase64)
      const instrumentalData = decodeBase64(instrumentalBase64)
      const now = new Date().toISOString()
      const sessionRecordId = `${seededSessionId}-record`
      const vocalStemId = `${seededSessionId}-vocal`
      const instrumentalStemId = `${seededSessionId}-instrumental`

      await new Promise<void>((resolve, reject) => {
        const openRequest = indexedDB.open('MercuryPitchDB')
        openRequest.onerror = () => reject(openRequest.error)
        openRequest.onsuccess = () => {
          const database = openRequest.result
          const transaction = database.transaction(
            ['uvrSessions', 'uvrStemBlobs'],
            'readwrite',
          )
          transaction.objectStore('uvrSessions').put({
            id: sessionRecordId,
            appSessionId: seededSessionId,
            userId: 'guitar-night-e2e',
            status: 'completed',
            progress: 100,
            originalFileName: 'midnight-drums.wav',
            originalFileSize: instrumentalData.byteLength,
            originalFileType: 'audio/wav',
            processingMode: 'local',
            provider: 'local',
            vocalStemId,
            instrumentalStemId,
            stemMetaJson: JSON.stringify({
              vocal: {
                duration: durationSeconds,
                size: vocalData.byteLength,
              },
              instrumental: {
                duration: durationSeconds,
                size: instrumentalData.byteLength,
              },
            }),
            appCreatedAt: Date.now(),
            createdAt: now,
            updatedAt: now,
          })
          transaction.objectStore('uvrStemBlobs').put({
            id: vocalStemId,
            sessionId: seededSessionId,
            stemType: 'vocal',
            mimeType: 'audio/wav',
            data: vocalData,
            size: vocalData.byteLength,
            fileName: 'midnight-drums-vocal.wav',
            createdAt: now,
            updatedAt: now,
          })
          transaction.objectStore('uvrStemBlobs').put({
            id: instrumentalStemId,
            sessionId: seededSessionId,
            stemType: 'instrumental',
            mimeType: 'audio/wav',
            data: instrumentalData,
            size: instrumentalData.byteLength,
            fileName: 'midnight-drums-instrumental.wav',
            createdAt: now,
            updatedAt: now,
          })
          transaction.oncomplete = () => {
            database.close()
            resolve()
          }
          transaction.onerror = () => {
            database.close()
            reject(transaction.error)
          }
          transaction.onabort = () => {
            database.close()
            reject(transaction.error)
          }
        }
      })
    },
    {
      durationSeconds,
      instrumentalBase64: instrumentalWav.toString('base64'),
      sessionId,
      vocalBase64: vocalWav.toString('base64'),
    },
  )
}

async function seedCompletedFullBandSong(
  page: import('@playwright/test').Page,
  sessionId: string,
): Promise<void> {
  const stemWav = createTestWav(165)

  await page.evaluate(
    async ({ durationSeconds, sessionId: seededSessionId, stemBase64 }) => {
      const bytes = Uint8Array.from(atob(stemBase64), (character) =>
        character.charCodeAt(0),
      )
      const stemKinds = [
        'vocal',
        'drums',
        'bass',
        'guitar',
        'piano',
        'other',
      ] as const
      const now = new Date().toISOString()

      await new Promise<void>((resolve, reject) => {
        const openRequest = indexedDB.open('MercuryPitchDB')
        openRequest.onerror = () => reject(openRequest.error)
        openRequest.onsuccess = () => {
          const database = openRequest.result
          const transaction = database.transaction(
            ['uvrSessions', 'uvrStemBlobs'],
            'readwrite',
          )
          transaction.objectStore('uvrSessions').put({
            id: `${seededSessionId}-record`,
            appSessionId: seededSessionId,
            userId: 'guitar-night-e2e',
            status: 'completed',
            progress: 100,
            originalFileName: 'full-band-tablet.wav',
            originalFileSize: bytes.byteLength,
            originalFileType: 'audio/wav',
            processingMode: 'local',
            provider: 'local',
            stemMetaJson: JSON.stringify(
              Object.fromEntries(
                stemKinds.map((kind) => [
                  kind,
                  { duration: durationSeconds, size: bytes.byteLength },
                ]),
              ),
            ),
            appCreatedAt: Date.now(),
            createdAt: now,
            updatedAt: now,
          })
          for (const kind of stemKinds) {
            transaction.objectStore('uvrStemBlobs').put({
              id: `${seededSessionId}-${kind}`,
              sessionId: seededSessionId,
              stemType: kind,
              mimeType: 'audio/wav',
              data: bytes.buffer,
              size: bytes.byteLength,
              fileName: `full-band-${kind}.wav`,
              createdAt: now,
              updatedAt: now,
            })
          }
          transaction.oncomplete = () => {
            database.close()
            resolve()
          }
          transaction.onerror = () => {
            database.close()
            reject(transaction.error)
          }
          transaction.onabort = () => {
            database.close()
            reject(transaction.error)
          }
        }
      })
    },
    {
      durationSeconds: TEST_SONG_DURATION_SECONDS,
      sessionId,
      stemBase64: stemWav.toString('base64'),
    },
  )
}

async function seedAuthoredGuitarScore(
  page: import('@playwright/test').Page,
  songId: string,
): Promise<void> {
  await page.addInitScript((seededSongId) => {
    const notes = Array.from({ length: 16 }, (_, index) => ({
      midi: index % 2 === 0 ? 64 : 67,
      startBeat: index,
      duration: 1,
      stringIndex: 0,
      fret: index % 2 === 0 ? 0 : 3,
    }))
    localStorage.setItem(
      'pitchperfect_guitar_songs',
      JSON.stringify([
        {
          id: seededSongId,
          name: 'Velvet pointer study',
          bpm: 120,
          tracks: [
            {
              id: 'track-lead',
              name: 'Lead guitar',
              instrumentName: 'Clean Guitar',
              noteCount: notes.length,
              notes,
            },
          ],
          scoreTrackId: 'track-lead',
          backingTrackIds: [],
          importedAt: Date.now(),
        },
      ]),
    )
  }, songId)
}

async function instrumentMicrophoneRequests(
  page: import('@playwright/test').Page,
) {
  await page.addInitScript(() => {
    const trackedWindow = window as unknown as {
      __guitarNightMicCalls: number
      __guitarNightMidiCalls: number
    }
    trackedWindow.__guitarNightMicCalls = 0
    trackedWindow.__guitarNightMidiCalls = 0

    Object.defineProperty(navigator, 'requestMIDIAccess', {
      configurable: true,
      value: () => {
        trackedWindow.__guitarNightMidiCalls += 1
        return Promise.reject(new Error('Unexpected MIDI request'))
      },
    })

    if (navigator.mediaDevices === undefined) return
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
      configurable: true,
      value: () => {
        trackedWindow.__guitarNightMicCalls += 1
        return Promise.reject(new Error('Unexpected microphone request'))
      },
    })
  })
}

test('loads the standalone Guitar Night entry @smoke', async ({ page }) => {
  const pageErrors: Error[] = []
  page.on('pageerror', (error) => pageErrors.push(error))
  await instrumentMicrophoneRequests(page)

  const response = await page.goto('/guitar-night', {
    waitUntil: 'domcontentloaded',
  })

  expect(response?.ok()).toBe(true)
  await expect(page).toHaveTitle(/Guitar Night/)
  await expect(
    page.getByRole('heading', { level: 1, name: 'Guitar Night' }),
  ).toBeVisible()
  await expect(page.getByTestId('guitar-night-shell')).toBeVisible()
  await expect(page.locator('#app-tabs')).toHaveCount(0)
  await expect(page.getByTestId('guitar-night-backdrop')).toHaveAttribute(
    'aria-hidden',
    'true',
  )
  await expect(page.locator('meta[name="viewport"]')).toHaveAttribute(
    'content',
    /viewport-fit=cover/,
  )
  await expect(page.locator('body')).not.toContainText(/\bAI\b/i)

  const actions = page.getByTestId('guitar-night-entry-actions')
  const buttons = actions.getByRole('button')
  await expect(buttons).toHaveCount(3)
  await expect(buttons.nth(0)).toHaveAccessibleName('Start')
  await expect(buttons.nth(1)).toHaveAccessibleName('Load a song')
  await expect(buttons.nth(2)).toHaveAccessibleName('I know my way around')

  await buttons.nth(0).focus()
  await page.keyboard.press('Tab')
  await expect(buttons.nth(1)).toBeFocused()
  const focusStyle = await buttons.nth(1).evaluate((element) => {
    const style = getComputedStyle(element)
    return { outline: style.outlineStyle, width: style.outlineWidth }
  })
  expect(focusStyle.outline).not.toBe('none')
  expect(focusStyle.width).not.toBe('0px')
  await page.keyboard.press('Tab')
  await expect(buttons.nth(2)).toBeFocused()

  const microphoneRequests = await page.evaluate(
    () =>
      (window as unknown as { __guitarNightMicCalls: number })
        .__guitarNightMicCalls,
  )
  expect(microphoneRequests).toBe(0)
  expect(pageErrors).toEqual([])
})

test('opens the Velvet tuner silently and returns focus on Escape @smoke', async ({
  page,
}) => {
  await instrumentMicrophoneRequests(page)
  await page.goto('/guitar-night', { waitUntil: 'domcontentloaded' })

  const tune = page.locator('[data-entry="tuner"]')
  await tune.click()

  const tuner = page.getByTestId('guitar-night-tuner')
  await expect(tuner).toBeVisible()
  await expect(tuner).toHaveAttribute('role', 'dialog')
  await expect(
    tuner.getByRole('button', { name: 'Allow microphone' }),
  ).toBeVisible()
  expect(
    await page.evaluate(
      () =>
        (window as unknown as { __guitarNightMicCalls: number })
          .__guitarNightMicCalls,
    ),
  ).toBe(0)

  await page.keyboard.press('Escape')
  await expect(tuner).toHaveCount(0)
  await expect(tune).toBeFocused()
  expect(
    await page.evaluate(
      () =>
        (window as unknown as { __guitarNightMicCalls: number })
          .__guitarNightMicCalls,
    ),
  ).toBe(0)
})

test('keeps the tuner touchable and stable on an Android tablet @smoke', async ({
  browser,
}) => {
  const baseURL = test.info().project.use.baseURL
  const context = await browser.newContext({
    baseURL,
    deviceScaleFactor: 1,
    hasTouch: true,
    isMobile: true,
    viewport: { width: 800, height: 1280 },
  })
  const page = await context.newPage()
  await instrumentMicrophoneRequests(page)
  await instrumentAudioContext(page)
  await page.emulateMedia({ reducedMotion: 'reduce' })

  const expectViewportFit = async (): Promise<void> => {
    const metrics = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      innerHeight: window.innerHeight,
      scrollWidth: document.documentElement.scrollWidth,
    }))
    const controls = await page
      .getByTestId('guitar-night-tuner-controls')
      .boundingBox()
    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 2)
    expect(controls).not.toBeNull()
    expect((controls?.y ?? 0) + (controls?.height ?? 0)).toBeLessThanOrEqual(
      metrics.innerHeight + 1,
    )
  }

  try {
    await page.goto('/guitar-night', { waitUntil: 'domcontentloaded' })
    await page.locator('[data-entry="tuner"]').click()

    const tuner = page.getByTestId('guitar-night-tuner')
    const listening = tuner.getByRole('button', { name: 'Allow microphone' })
    await expect(tuner).toBeVisible()
    await expect(listening).toBeVisible()

    const listeningMetrics = await listening.evaluate((control) => {
      const style = getComputedStyle(control)
      const parseRgb = (value: string): [number, number, number] => {
        const channels = value
          .match(/[\d.]+/g)
          ?.slice(0, 3)
          .map(Number)
        if (channels === undefined || channels.length !== 3) return [0, 0, 0]
        return [channels[0] ?? 0, channels[1] ?? 0, channels[2] ?? 0]
      }
      const luminance = ([red, green, blue]: [number, number, number]) => {
        const linear = [red, green, blue].map((channel) => {
          const encoded = channel / 255
          return encoded <= 0.04045
            ? encoded / 12.92
            : Math.pow((encoded + 0.055) / 1.055, 2.4)
        })
        return (
          (linear[0] ?? 0) * 0.2126 +
          (linear[1] ?? 0) * 0.7152 +
          (linear[2] ?? 0) * 0.0722
        )
      }
      const foreground = luminance(parseRgb(style.color))
      const background = luminance(parseRgb(style.backgroundColor))
      return {
        contrast:
          (Math.max(foreground, background) + 0.05) /
          (Math.min(foreground, background) + 0.05),
        height: control.getBoundingClientRect().height,
        textFill: style.webkitTextFillColor,
        width: control.getBoundingClientRect().width,
      }
    })
    expect(listeningMetrics.contrast).toBeGreaterThanOrEqual(4.5)
    expect(listeningMetrics.height).toBeGreaterThanOrEqual(44)
    expect(listeningMetrics.width).toBeGreaterThanOrEqual(44)
    expect(listeningMetrics.textFill).not.toBe('rgb(244, 234, 219)')

    const strings = tuner.getByTestId('guitar-night-tuner-strings')
    const controls = tuner.getByTestId('guitar-night-tuner-controls')
    const setup = tuner.getByTestId('guitar-night-tuner-setup')
    const beforeDisclosure = {
      controls: await controls.boundingBox(),
      strings: await strings.boundingBox(),
    }
    await setup.getByLabel('Tuning presets, Standard').click()
    const presetChoice = setup.getByRole('button', { name: /Drop D/ })
    await expect(presetChoice).toBeVisible()
    const afterDisclosure = {
      controls: await controls.boundingBox(),
      strings: await strings.boundingBox(),
    }
    expect(afterDisclosure.strings?.y).toBeCloseTo(
      beforeDisclosure.strings?.y ?? 0,
      0,
    )
    expect(afterDisclosure.strings?.height).toBeCloseTo(
      beforeDisclosure.strings?.height ?? 0,
      0,
    )
    expect(afterDisclosure.controls?.y).toBeCloseTo(
      beforeDisclosure.controls?.y ?? 0,
      0,
    )

    await page.keyboard.press('Escape')
    await expect(presetChoice).toBeHidden()
    await expect(setup.getByLabel('Tuning presets, Standard')).toBeFocused()
    await expect(tuner).toBeVisible()

    const stringTargets = strings.getByRole('button')
    for (const [index, corner] of [
      [0, 'top-left'],
      [2, 'top-right'],
      [3, 'bottom-left'],
      [5, 'bottom-right'],
    ] as const) {
      const target = stringTargets.nth(index)
      const bounds = await target.boundingBox()
      expect(bounds).not.toBeNull()
      if (bounds === null) continue
      const x = corner.endsWith('left')
        ? bounds.x + 4
        : bounds.x + bounds.width - 4
      const y = corner.startsWith('top')
        ? bounds.y + 4
        : bounds.y + bounds.height - 4
      await page.touchscreen.tap(x, y)
      await expect(target).toHaveAttribute('aria-pressed', 'true')
    }

    await expectViewportFit()
    await page.setViewportSize({ width: 1280, height: 800 })
    await expectViewportFit()

    await listening.click()
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            (window as unknown as { __guitarNightMicCalls: number })
              .__guitarNightMicCalls,
        ),
      )
      .toBe(1)
  } finally {
    await context.close()
  }
})

test('opens Learn and marks exact Note Hunt positions with a real pointer @smoke', async ({
  browser,
}) => {
  test.setTimeout(45_000)
  const baseURL = test.info().project.use.baseURL
  const context = await browser.newContext({
    ...devices['iPhone 12'],
    baseURL,
    viewport: { width: 390, height: 844 },
  })
  const page = await context.newPage()
  await instrumentMicrophoneRequests(page)
  await instrumentAudioContext(page)
  await page.emulateMedia({ reducedMotion: 'reduce' })

  const microphoneRequestCount = () =>
    page.evaluate(
      () =>
        (window as unknown as { __guitarNightMicCalls: number })
          .__guitarNightMicCalls,
    )
  const midiRequestCount = () =>
    page.evaluate(
      () =>
        (window as unknown as { __guitarNightMidiCalls: number })
          .__guitarNightMidiCalls,
    )
  const audioContextCount = () =>
    page.evaluate(
      () =>
        (window as unknown as { __guitarNightAudioContexts: number })
          .__guitarNightAudioContexts,
    )
  const clickCenter = async (locator: Locator): Promise<void> => {
    const bounds = await locator.boundingBox()
    expect(bounds).not.toBeNull()
    await page.mouse.click(
      (bounds?.x ?? 0) + (bounds?.width ?? 0) / 2,
      (bounds?.y ?? 0) + (bounds?.height ?? 0) / 2,
    )
  }
  const expectTouchableLayout = async (): Promise<void> => {
    const metrics = await page.evaluate(() => {
      const root = document.querySelector<HTMLElement>(
        '[data-testid="guitar-night-note-hunt"]',
      )
      const rootBounds = root?.getBoundingClientRect()
      const visibleControls = root
        ? [...root.querySelectorAll<HTMLElement>('button, summary')].filter(
            (control) => {
              const bounds = control.getBoundingClientRect()
              return bounds.width > 0 && bounds.height > 0
            },
          )
        : []
      return {
        clientWidth: document.documentElement.clientWidth,
        innerHeight: window.innerHeight,
        rootBottom: rootBounds?.bottom ?? Infinity,
        rootLeft: rootBounds?.left ?? -Infinity,
        rootRight: rootBounds?.right ?? Infinity,
        scrollWidth: document.documentElement.scrollWidth,
        undersizedControls: visibleControls
          .filter((control) => {
            const bounds = control.getBoundingClientRect()
            return bounds.width < 43.5 || bounds.height < 43.5
          })
          .map(
            (control) =>
              control.getAttribute('aria-label') ?? control.textContent,
          ),
      }
    })

    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 2)
    expect(metrics.rootLeft).toBeGreaterThanOrEqual(-1)
    expect(metrics.rootRight).toBeLessThanOrEqual(metrics.clientWidth + 1)
    expect(metrics.rootBottom).toBeLessThanOrEqual(metrics.innerHeight + 1)
    expect(metrics.undersizedControls).toEqual([])
  }

  try {
    await page.goto('/guitar-night', { waitUntil: 'domcontentloaded' })

    const main = page.locator('#guitar-night-main')
    const roomMenu = page.getByRole('button', { name: 'Room', exact: true })
    const openLearn = async (): Promise<void> => {
      await roomMenu.click()
      await page
        .locator('#guitar-night-venue-menu')
        .getByRole('button', { name: 'Learn', exact: true })
        .click()
    }

    await openLearn()
    const shelf = page.getByTestId('guitar-night-learn-shelf')
    const dialog = shelf.getByRole('dialog', {
      name: 'One small win at a time.',
    })
    const firstSteps = dialog.getByRole('button', {
      name: /Start with one string/,
    })
    const shapeWalkAction = dialog.getByRole('button', { name: /Shape Walk/ })
    await expect(dialog).toBeVisible()
    await expect(firstSteps).toBeFocused()
    expect(
      await main.evaluate((element) => (element as HTMLElement).inert),
    ).toBe(true)
    await expect(main).toHaveAttribute('aria-hidden', 'true')
    expect(await microphoneRequestCount()).toBe(0)
    expect(await midiRequestCount()).toBe(0)
    expect(await audioContextCount()).toBe(0)

    await shapeWalkAction.focus()
    await page.keyboard.press('Tab')
    await expect(
      dialog.getByRole('button', { name: 'Close', exact: true }),
    ).toBeFocused()
    await page.keyboard.press('Shift+Tab')
    await expect(shapeWalkAction).toBeFocused()

    await page.keyboard.press('Escape')
    await expect(shelf).toHaveCount(0)
    await expect(roomMenu).toBeFocused()
    expect(
      await main.evaluate((element) => (element as HTMLElement).inert),
    ).toBe(false)

    await openLearn()
    await page
      .getByTestId('guitar-night-learn-shelf')
      .getByRole('button', { name: /Note Hunt/ })
      .click()

    const hunt = page.getByTestId('guitar-night-note-hunt')
    await expect(hunt).toBeVisible()
    await expect(
      hunt.getByRole('heading', { level: 1, name: 'Find every E.' }),
    ).toBeFocused()
    expect(await microphoneRequestCount()).toBe(0)
    expect(await midiRequestCount()).toBe(0)
    expect(await audioContextCount()).toBe(0)
    const markedProgress = hunt.getByTestId('guitar-night-note-hunt-progress')
    await expect(markedProgress).toContainText('0 of 3 marked')

    const wrongCell = hunt.locator(
      'button[data-string-index="0"][data-fret="1"]',
    )
    const exactCell = hunt.locator(
      'button[data-string-index="0"][data-fret="0"]',
    )
    await expect(wrongCell).toHaveAttribute('data-state', 'idle')
    await clickCenter(wrongCell)
    await expect(wrongCell).toHaveAttribute('data-state', 'miss')
    await expect(markedProgress).toContainText('0 of 3 marked')
    const huntFeedback = hunt.locator('p[role="status"]')
    await expect(huntFeedback).toContainText('That position is not E.')

    await clickCenter(exactCell)
    await expect(exactCell).toHaveAttribute('data-state', 'found')
    await expect(markedProgress).toContainText('1 of 3 marked')
    await expect(huntFeedback).toContainText('string 1, open marked')
    expect(await microphoneRequestCount()).toBe(0)

    await expectTouchableLayout()
    await page.setViewportSize({ width: 320, height: 568 })
    await expectTouchableLayout()
    expect(
      await page
        .getByTestId('guitar-night-shell')
        .evaluate((element) => element.scrollTop),
    ).toBe(0)
    await page.setViewportSize({ width: 844, height: 390 })
    await expectTouchableLayout()
    expect(await microphoneRequestCount()).toBe(0)

    const neck = hunt.locator('[data-interactive="true"]')
    for (const target of [
      hunt.locator('button[data-string-index="3"][data-fret="2"]'),
      hunt.locator('button[data-string-index="5"][data-fret="0"]'),
    ]) {
      await target.scrollIntoViewIfNeeded()
      await clickCenter(target)
      await expect(target).toHaveAttribute('data-state', 'found')
    }
    await expect(markedProgress).toContainText('3 of 3 marked')

    await neck.evaluate((element) => {
      element.scrollTop = element.scrollHeight
    })
    expect(await neck.evaluate((element) => element.scrollTop)).toBeGreaterThan(
      0,
    )
    await hunt.getByRole('button', { name: /Find another note/ }).click()
    const startListening = hunt.getByRole('button', {
      name: /Start listening/,
    })
    await expect(startListening).toBeFocused()
    await expect(
      hunt.getByRole('heading', { name: 'Find every G.' }),
    ).toBeVisible()
    expect(await neck.evaluate((element) => element.scrollTop)).toBe(0)

    await startListening.click()
    await expect.poll(microphoneRequestCount).toBe(1)
    await expect(hunt.getByRole('alert')).toContainText(
      'Unexpected microphone request',
    )

    await hunt.getByRole('button', { name: 'Back from Note Hunt' }).click()
    const returnedShelf = page.getByTestId('guitar-night-learn-shelf')
    await expect(returnedShelf.getByRole('dialog')).toBeVisible()
    await returnedShelf.getByRole('button', { name: 'Close' }).click()
    await expect(page.locator('[data-room-action="learn"]')).toBeFocused()
  } finally {
    await context.close()
  }
})

test('runs the rebuilt Learn set through real neck pointers @smoke', async ({
  browser,
}) => {
  test.setTimeout(60_000)
  const baseURL = test.info().project.use.baseURL
  const context = await browser.newContext({
    ...devices['iPhone 12'],
    baseURL,
    viewport: { width: 390, height: 844 },
  })
  const page = await context.newPage()
  await instrumentMicrophoneRequests(page)
  await instrumentAudioContext(page)
  await page.emulateMedia({ reducedMotion: 'reduce' })

  const audioContextCount = () =>
    page.evaluate(
      () =>
        (window as unknown as { __guitarNightAudioContexts: number })
          .__guitarNightAudioContexts,
    )
  const microphoneRequestCount = () =>
    page.evaluate(
      () =>
        (window as unknown as { __guitarNightMicCalls: number })
          .__guitarNightMicCalls,
    )
  const midiRequestCount = () =>
    page.evaluate(
      () =>
        (window as unknown as { __guitarNightMidiCalls: number })
          .__guitarNightMidiCalls,
    )
  const clickCenter = async (locator: Locator): Promise<void> => {
    const bounds = await locator.boundingBox()
    expect(bounds).not.toBeNull()
    await page.mouse.click(
      (bounds?.x ?? 0) + (bounds?.width ?? 0) / 2,
      (bounds?.y ?? 0) + (bounds?.height ?? 0) / 2,
    )
  }
  const openLearn = async (): Promise<void> => {
    await page.getByRole('button', { name: 'Room', exact: true }).click()
    await page
      .locator('#guitar-night-venue-menu')
      .getByRole('button', { name: 'Learn', exact: true })
      .click()
  }
  const expectActivityFits = async (testId: string): Promise<void> => {
    const metrics = await page.evaluate((activityTestId) => {
      const root = document.querySelector<HTMLElement>(
        `[data-testid="${activityTestId}"]`,
      )
      const rootBounds = root?.getBoundingClientRect()
      const controls = root
        ? [...root.querySelectorAll<HTMLElement>('button, summary, select')]
            .filter((control) => {
              const bounds = control.getBoundingClientRect()
              return bounds.width > 0 && bounds.height > 0
            })
            .map((control) => {
              const bounds = control.getBoundingClientRect()
              return {
                height: bounds.height,
                label:
                  control.getAttribute('aria-label') ?? control.textContent,
                width: bounds.width,
              }
            })
        : []
      return {
        clientWidth: document.documentElement.clientWidth,
        innerHeight: window.innerHeight,
        rootBottom: rootBounds?.bottom ?? Infinity,
        rootLeft: rootBounds?.left ?? -Infinity,
        rootRight: rootBounds?.right ?? Infinity,
        scrollWidth: document.documentElement.scrollWidth,
        undersized: controls.filter(
          (control) => control.width < 43.5 || control.height < 43.5,
        ),
      }
    }, testId)

    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 2)
    expect(metrics.rootLeft).toBeGreaterThanOrEqual(-1)
    expect(metrics.rootRight).toBeLessThanOrEqual(metrics.clientWidth + 1)
    expect(metrics.rootBottom).toBeLessThanOrEqual(metrics.innerHeight + 1)
    expect(metrics.undersized).toEqual([])
  }

  try {
    await page.goto('/guitar-night', { waitUntil: 'domcontentloaded' })
    await openLearn()

    const shelf = page.getByTestId('guitar-night-learn-shelf')
    await shelf.getByRole('button', { name: /Hear & Find/ }).click()
    const hearFind = page.getByTestId('guitar-night-hear-find')
    await expect(
      hearFind.getByRole('heading', {
        name: 'Find that sound.',
      }),
    ).toBeFocused()
    expect(await audioContextCount()).toBe(0)

    const earlyCell = hearFind.locator(
      'button[data-string-index="0"][data-fret="0"]',
    )
    await clickCenter(earlyCell)
    await expect(hearFind.locator('p[role="status"]')).toContainText(
      'Hear the reference first',
    )

    await hearFind.getByRole('button', { name: /Hear the note/ }).click()
    await expect(hearFind.locator('p[role="status"]')).toContainText(
      'Tap where that exact pitch lives',
      { timeout: 5_000 },
    )
    expect(await audioContextCount()).toBe(1)
    const hearTarget = hearFind.locator(
      'button[data-string-index="5"][data-fret="3"]',
    )
    await clickCenter(hearTarget)
    await expect(
      hearFind.getByRole('heading', { name: 'That was G2.' }),
    ).toBeVisible()
    await expect(hearTarget).toHaveAttribute('data-state', 'found')
    await expectActivityFits('guitar-night-hear-find')
    await page.setViewportSize({ width: 1024, height: 768 })
    await expectActivityFits('guitar-night-hear-find')
    await page.setViewportSize({ width: 390, height: 844 })

    await hearFind
      .getByRole('button', { name: 'Back from Hear & Find' })
      .click()
    const returnedFromHear = page.getByTestId('guitar-night-learn-shelf')
    await expect(
      returnedFromHear.getByRole('button', { name: /Hear & Find/ }),
    ).toBeFocused()
    await returnedFromHear
      .getByRole('button', { name: /Echo a Phrase/ })
      .click()

    const echo = page.getByTestId('guitar-night-echo-phrase')
    await expect(
      echo.getByRole('heading', { name: 'Echo 3 notes.' }),
    ).toBeFocused()
    expect(await audioContextCount()).toBe(1)
    await echo.getByRole('button', { name: /Hear the phrase/ }).click()
    await expect(
      echo.getByRole('heading', { name: 'Your turn · note 1.' }),
    ).toBeVisible({ timeout: 6_000 })
    expect(await audioContextCount()).toBe(2)

    const g = echo.locator('button[data-string-index="2"][data-fret="0"]')
    const a = echo.locator('button[data-string-index="2"][data-fret="2"]')
    const b = echo.locator('button[data-string-index="1"][data-fret="0"]')
    await clickCenter(g)
    await expect(
      echo.getByRole('heading', { name: 'Your turn · note 2.' }),
    ).toBeVisible()
    await clickCenter(g)
    await expect(
      echo.getByRole('heading', { name: 'Repair one note.' }),
    ).toBeVisible()
    await echo.getByRole('button', { name: /Hear this note/ }).click()
    await expect(
      echo.getByRole('heading', { name: 'Your turn · note 2.' }),
    ).toBeVisible({ timeout: 5_000 })
    await clickCenter(a)
    await expect(
      echo.getByRole('heading', { name: 'Your turn · note 3.' }),
    ).toBeVisible()
    await clickCenter(b)
    await expect(
      echo.getByRole('heading', { name: 'The phrase is yours.' }),
    ).toBeVisible()
    await expectActivityFits('guitar-night-echo-phrase')
    await page.setViewportSize({ width: 1024, height: 768 })
    await expectActivityFits('guitar-night-echo-phrase')
    await page.setViewportSize({ width: 390, height: 844 })

    await echo.getByRole('button', { name: 'Back from Echo a Phrase' }).click()
    const returnedFromEcho = page.getByTestId('guitar-night-learn-shelf')
    await returnedFromEcho.getByRole('button', { name: /Shape Walk/ }).click()

    const shape = page.getByTestId('guitar-night-shape-walk')
    await expect(
      shape.getByRole('heading', { name: 'C major · C shape.' }),
    ).toBeFocused()
    expect(await audioContextCount()).toBe(2)
    const shapeRoot = shape.getByRole('button', { name: /chord root/ }).first()
    await clickCenter(shapeRoot)
    await expect.poll(audioContextCount).toBe(3)
    await shape.getByLabel('Major chord').selectOption('7')
    await shape
      .getByRole('group', { name: 'CAGED shape', exact: true })
      .getByRole('button', { name: 'E', exact: true })
      .click()
    await expect(
      shape.getByRole('heading', { name: 'G major · E shape.' }),
    ).toBeVisible()
    await expectActivityFits('guitar-night-shape-walk')
    await page.setViewportSize({ width: 1024, height: 768 })
    await expectActivityFits('guitar-night-shape-walk')

    expect(await microphoneRequestCount()).toBe(0)
    expect(await midiRequestCount()).toBe(0)
    await shape.getByRole('button', { name: 'Back from Shape Walk' }).click()
    await expect(
      page
        .getByTestId('guitar-night-learn-shelf')
        .getByRole('button', { name: /Shape Walk/ }),
    ).toBeFocused()
  } finally {
    await context.close()
  }
})

test('fits a phone and keeps every entry path touchable @smoke', async ({
  browser,
}) => {
  const baseURL = test.info().project.use.baseURL
  const context = await browser.newContext({
    ...devices['iPhone 12'],
    baseURL,
    viewport: { width: 390, height: 844 },
  })
  const page = await context.newPage()
  await page.emulateMedia({ reducedMotion: 'reduce' })

  try {
    const response = await page.goto('/guitar-night', {
      waitUntil: 'domcontentloaded',
    })
    expect(response?.ok()).toBe(true)

    const shell = page.getByTestId('guitar-night-shell')
    await expect(shell).toBeVisible()
    const viewportMetrics = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      innerHeight: window.innerHeight,
      scrollWidth: document.documentElement.scrollWidth,
    }))
    expect(viewportMetrics.scrollWidth).toBeLessThanOrEqual(
      viewportMetrics.clientWidth + 2,
    )

    const shellBox = await shell.boundingBox()
    expect(shellBox).not.toBeNull()
    expect(shellBox?.height).toBeGreaterThanOrEqual(
      viewportMetrics.innerHeight - 1,
    )

    const roomMenu = page.getByRole('button', { name: 'Room', exact: true })
    await roomMenu.click()
    await expect(roomMenu).toHaveAttribute('aria-expanded', 'true')
    await page
      .getByRole('combobox', { name: 'Room', exact: true })
      .press('Escape')
    await expect(roomMenu).toHaveAttribute('aria-expanded', 'false')
    await expect(roomMenu).toBeFocused()

    const buttons = page
      .getByTestId('guitar-night-entry-actions')
      .getByRole('button')
    await expect(buttons).toHaveCount(3)
    for (let index = 0; index < 3; index += 1) {
      const box = await buttons.nth(index).boundingBox()
      expect(box).not.toBeNull()
      expect(box?.width).toBeGreaterThanOrEqual(44)
      expect(box?.height).toBeGreaterThanOrEqual(44)
      expect(box?.x).toBeGreaterThanOrEqual(0)
      expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(
        viewportMetrics.clientWidth,
      )
    }

    const tune = page.locator('[data-entry="tuner"]')
    const tuneBox = await tune.boundingBox()
    expect(tuneBox?.width).toBeGreaterThanOrEqual(44)
    expect(tuneBox?.height).toBeGreaterThanOrEqual(44)
    await tune.click()

    const tuner = page.getByTestId('guitar-night-tuner')
    await expect(tuner).toBeVisible()
    const tunerMetrics = await tuner.evaluate((surface) => {
      const visibleButtons = [...surface.querySelectorAll('button')].filter(
        (button) => button.getClientRects().length > 0,
      )
      return {
        clientWidth: surface.clientWidth,
        scrollWidth: surface.scrollWidth,
        undersizedControls: visibleButtons.filter((button) => {
          const box = button.getBoundingClientRect()
          return box.width < 44 || box.height < 44
        }).length,
      }
    })
    expect(tunerMetrics.scrollWidth).toBeLessThanOrEqual(
      tunerMetrics.clientWidth + 2,
    )
    expect(tunerMetrics.undersizedControls).toBe(0)
    await tuner.evaluate((surface) => {
      surface.scrollTop = surface.scrollHeight
    })
    const tuningSummary = tuner.getByLabel('Tuning presets, Standard')
    const tunerStrings = tuner.getByTestId('guitar-night-tuner-strings')
    const stringsBeforePreset = await tunerStrings.boundingBox()
    await expect(tuningSummary).toBeVisible()
    await tuningSummary.click()
    const tuningChoices = tuner.getByRole('group', { name: 'Tuning preset' })
    await expect(tuningChoices).toBeVisible()
    for (
      let index = 0;
      index < (await tuningChoices.getByRole('button').count());
      index += 1
    ) {
      const bounds = await tuningChoices
        .getByRole('button')
        .nth(index)
        .boundingBox()
      expect(bounds).not.toBeNull()
      expect(bounds?.y).toBeGreaterThanOrEqual(0)
      expect((bounds?.y ?? 0) + (bounds?.height ?? 0)).toBeLessThanOrEqual(
        viewportMetrics.innerHeight,
      )
    }
    const stringsAfterPreset = await tunerStrings.boundingBox()
    expect(stringsAfterPreset?.y).toBeCloseTo(stringsBeforePreset?.y ?? 0, 0)
    expect(stringsAfterPreset?.height).toBeCloseTo(
      stringsBeforePreset?.height ?? 0,
      0,
    )
    await page.keyboard.press('Escape')
    await expect(tuningChoices).toBeHidden()
    await expect(tuningSummary).toBeFocused()

    const targetModeBox = await tuner
      .getByRole('button', { name: 'Auto' })
      .boundingBox()
    const listeningBox = await tuner
      .getByRole('button', { name: 'Allow microphone' })
      .boundingBox()
    expect(targetModeBox?.y).toBeLessThan(listeningBox?.y ?? 0)

    const runningAnimations = await page.evaluate(
      () =>
        document
          .getAnimations()
          .filter((animation) => animation.playState === 'running').length,
    )
    expect(runningAnimations).toBe(0)

    await page.keyboard.press('Escape')
    await roomMenu.click()
    await page
      .locator('#guitar-night-venue-menu')
      .getByRole('button', { name: 'Tune guitar' })
      .click()
    await page.keyboard.press('Escape')
    await expect(roomMenu).toBeFocused()
  } finally {
    await context.close()
  }
})

test('keeps the first-win stage dominant across phone orientations @smoke', async ({
  browser,
}) => {
  const baseURL = test.info().project.use.baseURL
  const context = await browser.newContext({
    ...devices['iPhone 12'],
    baseURL,
    viewport: { width: 390, height: 844 },
  })
  const page = await context.newPage()

  const expectStageFirstLayout = async (
    minimumStageRatio: number,
    cameraRadius: string,
  ): Promise<void> => {
    const metrics = await page.evaluate(() => {
      const stage = document.querySelector<HTMLElement>(
        '[data-testid="guitar-night-stage"]',
      )
      const deck = document.querySelector<HTMLElement>(
        '[data-testid="guitar-night-first-win-deck"]',
      )
      const stageBounds = stage?.getBoundingClientRect()
      const deckBounds = deck?.getBoundingClientRect()
      return {
        deckBottom: deckBounds?.bottom ?? Infinity,
        innerHeight: window.innerHeight,
        innerWidth: window.innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
        stageHeight: stageBounds?.height ?? 0,
        stageWidth: stageBounds?.width ?? 0,
      }
    })
    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.innerWidth + 2)
    expect(metrics.deckBottom).toBeLessThanOrEqual(metrics.innerHeight + 1)
    expect(metrics.stageWidth).toBeGreaterThanOrEqual(metrics.innerWidth - 2)
    expect(metrics.stageHeight).toBeGreaterThanOrEqual(
      metrics.innerHeight * minimumStageRatio,
    )
    await expect(
      page.locator('[data-testid="guitar-night-stage"] canvas'),
    ).toHaveAttribute('data-camera-radius', cameraRadius)
  }

  try {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/guitar-night', { waitUntil: 'domcontentloaded' })
    await page.getByRole('button', { name: 'Start', exact: true }).click()
    await expect(page.getByTestId('guitar-night-first-win')).toBeVisible()
    await expectStageFirstLayout(0.55, '32.0000')

    const loopPractice = page.getByRole('button', {
      name: 'Loop',
      exact: true,
    })
    const shuffleBeats = page.getByRole('button', {
      name: 'Shuffle',
      exact: true,
    })
    await expect(loopPractice).toHaveAttribute('aria-pressed', 'false')
    await expect(shuffleBeats).toBeDisabled()
    await loopPractice.click()
    await expect(loopPractice).toHaveAttribute('aria-pressed', 'true')
    await expect(shuffleBeats).toBeEnabled()
    await shuffleBeats.click()
    await expect(shuffleBeats).toHaveAttribute('aria-pressed', 'true')
    await page.getByRole('button', { name: 'Start count-in' }).click()
    await expect(
      page.getByRole('button', { name: 'Stop groove' }),
    ).toBeVisible()
    await expect(loopPractice).toBeEnabled()
    await loopPractice.click()
    await expect(loopPractice).toHaveAttribute('aria-pressed', 'false')
    await expect(shuffleBeats).toBeDisabled()
    await expect(
      page.getByRole('button', { name: 'Start count-in' }),
    ).toBeVisible()

    const firstWinButtons = page
      .getByTestId('guitar-night-first-win')
      .getByRole('button')
    for (let index = 0; index < (await firstWinButtons.count()); index += 1) {
      const bounds = await firstWinButtons.nth(index).boundingBox()
      expect(bounds).not.toBeNull()
      expect(bounds?.width).toBeGreaterThanOrEqual(44)
      expect(bounds?.height).toBeGreaterThanOrEqual(44)
    }

    const markOpenString = page.getByRole('button', {
      name: 'Mark open low E',
    })
    for (let hit = 0; hit < 3; hit += 1) await markOpenString.click()
    await page.getByRole('button', { name: 'Read tab' }).click()
    await expect(
      page.getByRole('heading', { name: 'Read a one-string phrase.' }),
    ).toBeVisible()
    await expectStageFirstLayout(0.55, '32.0000')

    await page.setViewportSize({ width: 844, height: 390 })
    await expectStageFirstLayout(0.55, '21.0000')

    for (const viewport of [
      { width: 720, height: 450, camera: '32.0000' },
      { width: 1024, height: 600, camera: '21.0000' },
      { width: 1440, height: 900, camera: '21.0000' },
    ]) {
      await page.setViewportSize({
        width: viewport.width,
        height: viewport.height,
      })
      await expectStageFirstLayout(0.55, viewport.camera)
    }
  } finally {
    await context.close()
  }
})

test('keeps the song actions reachable in a short desktop viewport @smoke', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 720 })
  await page.goto('/guitar-night', { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Load a song', exact: true }).click()

  const chooseFile = page
    .getByRole('button', {
      name: 'Choose a file',
      exact: true,
    })
    .last()
  await chooseFile.scrollIntoViewIfNeeded()
  const buttonBox = await chooseFile.boundingBox()
  expect(buttonBox).not.toBeNull()
  expect((buttonBox?.y ?? 0) + (buttonBox?.height ?? 0)).toBeLessThanOrEqual(
    720,
  )
  await expect(page.locator('main')).toHaveCSS('overflow-y', 'auto')
})

test('keeps the beginner preview and local song choice honest @smoke', async ({
  page,
}) => {
  await instrumentMicrophoneRequests(page)
  await instrumentAudioContext(page)
  await page.goto('/guitar-night', { waitUntil: 'domcontentloaded' })

  await page.getByRole('button', { name: 'Start', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'Make one string groove.' }),
  ).toBeVisible()
  expect(
    await page.evaluate(
      () =>
        (window as unknown as { __guitarNightAudioContexts: number })
          .__guitarNightAudioContexts,
    ),
  ).toBe(0)
  await page
    .getByRole('button', { name: 'Start count-in', exact: true })
    .click()
  await expect(
    page.getByRole('button', { name: 'Stop groove', exact: true }),
  ).toBeVisible()
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as unknown as { __guitarNightAudioContexts: number })
            .__guitarNightAudioContexts,
      ),
    )
    .toBe(1)
  await page.getByRole('button', { name: 'Stop groove', exact: true }).click()
  const rhythmButton = page.getByRole('button', {
    name: 'Mark open low E',
  })
  await rhythmButton.click()
  const introOptions = page.locator('details').filter({
    has: page.getByText('Adjust intro', { exact: true }),
  })
  await introOptions.locator('summary').focus()
  await page.keyboard.press('Space')
  await expect(introOptions).toHaveAttribute('open', '')
  await expect(page.getByLabel('1 of 4 targets marked')).toBeVisible()
  await page.keyboard.press('Space')
  await expect(introOptions).not.toHaveAttribute('open', '')
  for (let hit = 0; hit < 3; hit += 1) await rhythmButton.click()
  await expect(page.getByText('4 open-string targets marked.')).toBeVisible()

  await page.getByRole('button', { name: 'Read tab', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'Read a one-string phrase.' }),
  ).toBeVisible()
  await expect(
    page.getByText(
      'Each line is a string. A number is the fret; 0 means open.',
    ),
  ).toBeVisible()
  for (let hit = 0; hit < 15; hit += 1) await page.keyboard.press('Space')
  await expect(
    page.getByText(
      'Full phrase marked. You followed your first one-string tab.',
    ),
  ).toBeVisible()

  await page.getByRole('button', { name: 'Load a song', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'Bring a song into the room.' }),
  ).toBeVisible()
  await expect(
    page.getByText('Nothing starts playing on its own.'),
  ).toBeVisible()

  const fileChooserPromise = page.waitForEvent('filechooser')
  await page
    .getByRole('button', { name: 'Choose a file', exact: true })
    .first()
    .click()
  const fileChooser = await fileChooserPromise
  await fileChooser.setFiles({
    name: 'practice-room.wav',
    mimeType: 'audio/wav',
    buffer: Buffer.from('RIFF'),
  })

  await expect(page.getByText('practice-room.wav')).toBeVisible()
  await expect(
    page.getByRole('progressbar', {
      name: 'Preparing practice-room.wav',
    }),
  ).toBeVisible()
  await page
    .getByRole('button', { name: 'Cancel preparation', exact: true })
    .click()
  await expect(
    page.getByText('Preparation cancelled', { exact: true }),
  ).toBeVisible()
  await expect(page).toHaveURL(/\/guitar-night$/)

  const microphoneRequests = await page.evaluate(
    () =>
      (window as unknown as { __guitarNightMicCalls: number })
        .__guitarNightMicCalls,
  )
  expect(microphoneRequests).toBe(0)
})

test('scrubs, pauses, and resumes an authored score with a real pointer @smoke', async ({
  page,
}) => {
  const songId = `guitar-night-score-${Date.now()}`
  await instrumentAudioContext(page)
  await seedAuthoredGuitarScore(page, songId)
  await page.goto(`/guitar-night?song=${encodeURIComponent(songId)}`, {
    waitUntil: 'domcontentloaded',
  })

  await page.getByRole('button', { name: 'Load a song', exact: true }).click()
  await page
    .getByRole('button', { name: 'Rehearse the tab', exact: true })
    .click()

  const room = page.getByTestId('guitar-night-score-room')
  const slider = room.getByRole('slider', {
    name: 'Score position',
    exact: true,
  })
  const elapsed = room.getByLabel('Elapsed score time')
  await expect(slider).toBeVisible()
  await slider.focus()
  await slider.press('Home')
  await slider.press('ArrowRight')
  await expect(slider).toHaveValue('0.125')
  await expect(slider).toHaveAttribute('aria-valuetext', /beat 1\.25$/)

  const rail = await slider.boundingBox()
  expect(rail).not.toBeNull()
  const y = (rail?.y ?? 0) + (rail?.height ?? 0) / 2
  // Chromium maps a native range across the thumb-centre travel, not the
  // input's full border box. Aim inside that real 16 px travel so quarter
  // positions stay exact on both local and CI viewport widths.
  const railX = (fraction: number): number =>
    (rail?.x ?? 0) + 8 + ((rail?.width ?? 0) - 16) * fraction

  await page.mouse.click(railX(0.75), y)
  await expect(elapsed).toHaveText('0:06')

  await page.mouse.move(railX(0.75), y)
  await page.mouse.down()
  await page.mouse.move(railX(0.25), y, {
    steps: 8,
  })
  await page.mouse.up()
  await expect(elapsed).toHaveText('0:02')

  await room.getByLabel('Session controls').click()
  await room.getByLabel('Count-in beats').selectOption('0')
  await room.getByLabel('Session controls').click()
  expect(
    await page.evaluate(
      () =>
        (window as unknown as { __guitarNightAudioContexts: number })
          .__guitarNightAudioContexts,
    ),
  ).toBe(0)

  await room
    .getByRole('button', { name: 'Start from here', exact: true })
    .click()
  await expect(elapsed).toHaveText('0:03', { timeout: 2_500 })
  expect(
    await page.evaluate(
      () =>
        (window as unknown as { __guitarNightAudioContexts: number })
          .__guitarNightAudioContexts,
    ),
  ).toBe(1)
  await room.getByRole('button', { name: 'Pause score', exact: true }).click()
  const pausedAt = await elapsed.textContent()
  await page.waitForTimeout(700)
  await expect(elapsed).toHaveText(pausedAt ?? '')

  await room.getByRole('button', { name: 'Resume score', exact: true }).click()
  await expect(elapsed).not.toHaveText(pausedAt ?? '', { timeout: 2_500 })
  expect(
    await page.evaluate(
      () =>
        (window as unknown as { __guitarNightAudioContexts: number })
          .__guitarNightAudioContexts,
    ),
  ).toBe(1)
})

test('keeps stage settings reachable at 200% text on a narrow phone @smoke', async ({
  browser,
}) => {
  const baseURL = test.info().project.use.baseURL
  const context = await browser.newContext({
    baseURL,
    viewport: { width: 320, height: 568 },
  })
  const page = await context.newPage()
  const songId = `guitar-night-reflow-${Date.now()}`

  try {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await seedAuthoredGuitarScore(page, songId)
    await page.goto(`/guitar-night?song=${encodeURIComponent(songId)}`, {
      waitUntil: 'domcontentloaded',
    })
    await page.getByRole('button', { name: 'Load a song', exact: true }).click()
    await page
      .getByRole('button', { name: 'Rehearse the tab', exact: true })
      .click()
    await page.evaluate(() => {
      document.documentElement.style.setProperty(
        'font-size',
        '200%',
        'important',
      )
    })

    const room = page.getByTestId('guitar-night-score-room')
    const roomMenuButton = page.getByRole('button', {
      name: 'Room',
      exact: true,
    })
    await roomMenuButton.click()
    const roomMenu = page.locator('#guitar-night-venue-menu')
    await expect(roomMenu).toBeVisible()
    const roomMenuMetrics = await roomMenu.evaluate((element) => {
      const bounds = element.getBoundingClientRect()
      const children = [...element.querySelectorAll<HTMLElement>('select, a')]
      return {
        allControlsInside: children.every((child) => {
          const childBounds = child.getBoundingClientRect()
          return childBounds.left >= 0 && childBounds.right <= window.innerWidth
        }),
        left: bounds.left,
        right: bounds.right,
        viewportWidth: window.innerWidth,
      }
    })
    expect(roomMenuMetrics.left).toBeGreaterThanOrEqual(0)
    expect(roomMenuMetrics.right).toBeLessThanOrEqual(
      roomMenuMetrics.viewportWidth,
    )
    expect(roomMenuMetrics.allControlsInside).toBe(true)
    await page.keyboard.press('Escape')
    await expect(roomMenu).not.toBeVisible()
    await expect(roomMenuButton).toBeFocused()

    const stage = room.getByTestId('guitar-night-stage')
    await expect(stage).toBeVisible()
    const liveScore = stage.getByTestId('guitar-night-live-score')
    await expect(liveScore).toBeVisible()
    await expect(liveScore).toHaveAttribute('data-state', 'needs-input')
    await expect(liveScore.getByLabel('Live score')).toHaveCount(0)
    const scoreBounds = await liveScore.evaluate((element) => {
      const bounds = element.getBoundingClientRect()
      const stageBounds = element
        .closest('[data-testid="guitar-night-stage"]')
        ?.getBoundingClientRect()
      const toolBounds = element
        .closest('[data-testid="guitar-night-stage"]')
        ?.querySelector('[aria-label="Stage view"]')
        ?.parentElement?.getBoundingClientRect()
      return {
        bottom: bounds.bottom,
        left: bounds.left,
        right: bounds.right,
        stageBottom: stageBounds?.bottom ?? 0,
        stageLeft: stageBounds?.left ?? 0,
        stageRight: stageBounds?.right ?? 0,
        stageTop: stageBounds?.top ?? 0,
        top: bounds.top,
        toolsBottom: toolBounds?.bottom ?? 0,
      }
    })
    expect(scoreBounds.left).toBeGreaterThanOrEqual(scoreBounds.stageLeft)
    expect(scoreBounds.right).toBeLessThanOrEqual(scoreBounds.stageRight)
    expect(scoreBounds.top).toBeGreaterThanOrEqual(scoreBounds.stageTop)
    expect(scoreBounds.top).toBeGreaterThanOrEqual(scoreBounds.toolsBottom)
    expect(scoreBounds.bottom).toBeLessThanOrEqual(scoreBounds.stageBottom)
    await expect(stage.locator('canvas')).toHaveAttribute(
      'data-camera-ready',
      'true',
    )

    const modeButtons = room.getByRole('button').filter({
      hasText: /^(Highway|Grid|Tab|Neck)$/,
    })
    await expect(modeButtons).toHaveCount(4)
    const reflow = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }))
    expect(reflow.scrollWidth).toBeLessThanOrEqual(reflow.clientWidth + 2)

    const camera = room.getByLabel('Camera, Runway', { exact: true })
    await camera.click()
    // A narrow phone gets the portalled sheet, not the in-place popup: the
    // popup was a child of `.stageHeader`, a stacking context, so it painted
    // under the LEARN card and ran off the header's top corner. The sheet is
    // its own scroller, which is what these metrics are about.
    const panel = page.getByRole('dialog', {
      name: 'Camera and display settings',
      exact: true,
    })
    await expect(panel).toBeVisible()
    const panelMetrics = await panel.evaluate((element) => {
      const bounds = element.getBoundingClientRect()
      return {
        bottom: bounds.bottom,
        clientHeight: element.clientHeight,
        overflowY: getComputedStyle(element).overflowY,
        scrollHeight: element.scrollHeight,
        top: bounds.top,
        viewportHeight: window.innerHeight,
      }
    })
    expect(panelMetrics.top).toBeGreaterThanOrEqual(0)
    expect(panelMetrics.bottom).toBeLessThanOrEqual(
      panelMetrics.viewportHeight + 1,
    )
    expect(panelMetrics.overflowY).toBe('auto')
    expect(panelMetrics.scrollHeight).toBeGreaterThan(panelMetrics.clientHeight)

    const reducedEffects = panel.getByRole('button', {
      name: /Reduced effects/,
    })
    await reducedEffects.scrollIntoViewIfNeeded()
    await expect(reducedEffects).toBeVisible()
    const reducedBounds = await reducedEffects.boundingBox()
    expect(reducedBounds).not.toBeNull()
    expect(reducedBounds?.y).toBeGreaterThanOrEqual(0)
    expect(
      (reducedBounds?.y ?? 0) + (reducedBounds?.height ?? 0),
    ).toBeLessThanOrEqual(568)

    await page.keyboard.press('Escape')
    await expect(panel).not.toBeVisible()
    await expect(camera).toBeFocused()

    const setup = room.getByLabel('6-string guitar setup', { exact: true })
    await setup.click()
    const strings = room.getByRole('combobox', { name: 'Strings' })
    await expect(strings).toBeVisible()
    const stringBounds = await strings.boundingBox()
    expect(stringBounds).not.toBeNull()
    expect(
      (stringBounds?.y ?? 0) + (stringBounds?.height ?? 0),
    ).toBeLessThanOrEqual(568)
  } finally {
    await context.close()
  }
})

test('enters a silent prepared-song room, plays, pauses, and seeks with a real pointer @smoke', async ({
  page,
}) => {
  const sessionId = `guitar-night-two-stem-${Date.now()}`
  await instrumentMicrophoneRequests(page)
  await instrumentAudioContext(page)
  await initializeGuitarNightDatabase(page)
  await seedCompletedTwoStemSong(page, sessionId)

  await page.goto(`/guitar-night?session=${encodeURIComponent(sessionId)}`, {
    waitUntil: 'domcontentloaded',
  })
  await expect(page.getByText('2 local stems ready')).toBeVisible()
  const enterRoom = page.getByRole('button', {
    name: 'Enter room',
    exact: true,
  })
  await expect(enterRoom).toBeVisible()
  await expect(page.getByRole('button', { name: 'Play backing' })).toHaveCount(
    0,
  )
  expect(
    await page.evaluate(
      () =>
        (window as unknown as { __guitarNightAudioContexts: number })
          .__guitarNightAudioContexts,
    ),
  ).toBe(0)

  await enterRoom.click()
  const room = page.getByTestId('guitar-night-room')
  await expect(room).toBeVisible()
  const stage = page.getByTestId('guitar-night-stage')
  const fullRoomLayout = await page.evaluate(() => {
    const roomElement = document.querySelector<HTMLElement>(
      '[data-testid="guitar-night-room"]',
    )
    const stageElement = document.querySelector<HTMLElement>(
      '[data-testid="guitar-night-stage"]',
    )
    const deckElement = document.querySelector<HTMLElement>(
      '[data-testid="guitar-night-deck"]',
    )
    const roomBounds = roomElement?.getBoundingClientRect()
    const stageBounds = stageElement?.getBoundingClientRect()
    const deckBounds = deckElement?.getBoundingClientRect()
    return {
      deckBottom: deckBounds?.bottom ?? Number.POSITIVE_INFINITY,
      roomWidth: roomBounds?.width ?? 0,
      stageHeight: stageBounds?.height ?? 0,
      stageWidth: stageBounds?.width ?? 0,
      viewportHeight: window.innerHeight,
      viewportWidth: window.innerWidth,
    }
  })
  expect(fullRoomLayout.roomWidth).toBeGreaterThanOrEqual(
    fullRoomLayout.viewportWidth * 0.98,
  )
  expect(fullRoomLayout.stageWidth).toBeGreaterThanOrEqual(
    fullRoomLayout.viewportWidth * 0.98,
  )
  expect(fullRoomLayout.stageHeight).toBeGreaterThanOrEqual(
    fullRoomLayout.viewportHeight * 0.6,
  )
  expect(fullRoomLayout.deckBottom).toBeLessThanOrEqual(
    fullRoomLayout.viewportHeight + 1,
  )
  await expect(stage).toBeVisible()
  await expect(
    room.getByRole('heading', { name: 'midnight-drums.wav' }),
  ).toBeFocused()
  const flowCanvas = room.locator('canvas[data-tab-presentation]')
  await expect(flowCanvas).toBeVisible()
  await expect(
    room.getByRole('img', {
      name: /midnight-drums\.wav\. Interactive 6-string guitar string runway/,
    }),
  ).toBeVisible()
  await expect(flowCanvas).toHaveAttribute('data-camera-ready', 'true')
  await expect(flowCanvas).toHaveAttribute(
    'data-tab-presentation',
    'string-highway',
  )
  await room.getByLabel('Camera, Runway', { exact: true }).click()
  await room.getByRole('button', { name: /Phrase follow/ }).click()
  await expect(flowCanvas).toHaveAttribute('data-camera-following', 'true')
  await flowCanvas.scrollIntoViewIfNeeded()
  const initialYaw = await flowCanvas.getAttribute('data-camera-yaw')
  const canvasBox = await flowCanvas.boundingBox()
  expect(canvasBox).not.toBeNull()
  await page.mouse.move(
    (canvasBox?.x ?? 0) + (canvasBox?.width ?? 0) * 0.45,
    (canvasBox?.y ?? 0) + (canvasBox?.height ?? 0) * 0.55,
  )
  await page.mouse.down()
  await page.mouse.move(
    (canvasBox?.x ?? 0) + (canvasBox?.width ?? 0) * 0.62,
    (canvasBox?.y ?? 0) + (canvasBox?.height ?? 0) * 0.46,
    { steps: 4 },
  )
  await page.mouse.up()
  await expect
    .poll(() => flowCanvas.getAttribute('data-camera-yaw'))
    .not.toBe(initialYaw)
  await expect(flowCanvas).toHaveAttribute('data-camera-following', 'false')
  const orbitedYaw = await flowCanvas.getAttribute('data-camera-yaw')
  const orbitedRadius = await flowCanvas.getAttribute('data-camera-radius')

  await room.getByRole('button', { name: 'Grid', exact: true }).click()
  await expect(flowCanvas).toHaveAttribute('data-tab-presentation', 'fret-axis')
  await expect(
    room.getByRole('img', {
      name: /midnight-drums\.wav\. Interactive 6-string guitar fretboard grid/,
    }),
  ).toBeVisible()
  await expect(flowCanvas).toHaveAttribute('data-camera-yaw', orbitedYaw ?? '')
  await expect(flowCanvas).toHaveAttribute(
    'data-camera-radius',
    orbitedRadius ?? '',
  )
  expect(
    await page.evaluate(() =>
      localStorage.getItem('guitar-night-flow-presentation-v1'),
    ),
  ).toBe('fret-axis')

  await room.getByRole('button', { name: 'Highway', exact: true }).click()
  await expect(flowCanvas).toHaveAttribute(
    'data-tab-presentation',
    'string-highway',
  )
  await expect(flowCanvas).toHaveAttribute('data-camera-yaw', orbitedYaw ?? '')

  await room
    .getByRole('group', { name: '3D performance view controls' })
    .press('r')
  await expect(flowCanvas).toHaveAttribute('data-camera-following', 'true')

  await room.getByRole('button', { name: 'Neck', exact: true }).click()
  await expect(room.locator('[data-stage-mode="neck"]')).toBeVisible()
  await room.getByRole('button', { name: 'Tab', exact: true }).click()
  await expect(room.locator('[data-stage-mode="tab"]')).toBeVisible()
  await room.getByRole('button', { name: 'Highway', exact: true }).click()
  await expect(room.locator('[data-stage-mode="flow"]')).toBeVisible()
  await room.getByRole('button', { name: 'Slow down from 1.00×' }).click()
  await expect(
    room.getByLabel('Playback speed 0.95×', { exact: true }),
  ).toBeVisible()
  expect(
    await page.evaluate(
      () =>
        (window as unknown as { __guitarNightAudioContexts: number })
          .__guitarNightAudioContexts,
    ),
  ).toBe(0)
  const playBacking = room.getByRole('button', {
    name: 'Play backing',
    exact: true,
  })
  await expect(playBacking).toBeVisible()
  expect(
    await page.evaluate(
      () =>
        (window as unknown as { __guitarNightAudioContexts: number })
          .__guitarNightAudioContexts,
    ),
  ).toBe(0)

  await playBacking.click()
  await expect(room).toHaveAttribute('data-playback-mode', 'streamed')
  await expect(
    room.getByRole('button', { name: 'Pause backing', exact: true }),
  ).toBeVisible()
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as unknown as { __guitarNightAudioContexts: number })
            .__guitarNightAudioContexts,
      ),
    )
    .toBe(1)

  const songPosition = room.getByRole('slider', {
    name: 'Song position',
    exact: true,
  })
  await expect(songPosition).toBeVisible()
  await expect
    .poll(async () => Number(await songPosition.inputValue()))
    .toBeGreaterThan(0)
  const playingPosition = Number(await songPosition.inputValue())

  await room.getByRole('button', { name: 'Grid', exact: true }).click()
  await expect(
    room.getByRole('button', { name: 'Pause backing', exact: true }),
  ).toBeVisible()
  await expect
    .poll(async () => Number(await songPosition.inputValue()))
    .toBeGreaterThanOrEqual(playingPosition)
  await room.getByRole('button', { name: 'Highway', exact: true }).click()
  await expect(
    room.getByRole('button', { name: 'Pause backing', exact: true }),
  ).toBeVisible()

  const sliderBox = await songPosition.boundingBox()
  expect(sliderBox).not.toBeNull()
  await page.mouse.click(
    (sliderBox?.x ?? 0) + (sliderBox?.width ?? 0) * 0.75,
    (sliderBox?.y ?? 0) + (sliderBox?.height ?? 0) / 2,
  )
  await expect
    .poll(async () => Number(await songPosition.inputValue()))
    .toBeGreaterThan(TEST_SONG_DURATION_SECONDS * 0.6)

  await room.getByRole('button', { name: 'Pause backing', exact: true }).click()
  await expect(
    room.getByRole('button', { name: 'Resume backing', exact: true }),
  ).toBeVisible()
  const pausedPosition = Number(await songPosition.inputValue())
  await page.waitForTimeout(250)
  expect(Number(await songPosition.inputValue())).toBeCloseTo(pausedPosition, 1)

  await room.getByRole('button', { name: 'Back to Songs', exact: true }).click()
  const resumeSong = page.getByRole('button', { name: /midnight-drums\.wav/ })
  await expect(resumeSong).toContainText('Resume')
  await resumeSong.click()
  await expect(
    room.getByRole('button', { name: 'Resume backing', exact: true }),
  ).toBeVisible()
  expect(Number(await songPosition.inputValue())).toBeCloseTo(pausedPosition, 1)

  // Space owns the transport even while another control holds focus — the
  // focused button must not be activated on top of the toggle.
  const restartControl = room.getByRole('button', {
    name: 'Restart song',
    exact: true,
  })
  await restartControl.focus()
  await page.keyboard.press('Space')
  await expect(
    room.getByRole('button', { name: 'Pause backing', exact: true }),
  ).toBeVisible()
  expect(Number(await songPosition.inputValue())).toBeGreaterThanOrEqual(
    pausedPosition - 0.2,
  )
  await page.keyboard.press('Space')
  await expect(
    room.getByRole('button', { name: 'Resume backing', exact: true }),
  ).toBeVisible()

  const microphoneRequests = await page.evaluate(
    () =>
      (window as unknown as { __guitarNightMicCalls: number })
        .__guitarNightMicCalls,
  )
  expect(microphoneRequests).toBe(0)

  await room
    .getByRole('button', { name: 'Turn on Listening', exact: true })
    .click()
  await expect(room.getByRole('alert')).toContainText(
    'Unexpected microphone request',
  )
  expect(
    await page.evaluate(
      () =>
        (window as unknown as { __guitarNightMicCalls: number })
          .__guitarNightMicCalls,
    ),
  ).toBe(1)
})

test('keeps the prepared-song room controls touchable without phone overflow @smoke', async ({
  browser,
}) => {
  const baseURL = test.info().project.use.baseURL
  const context = await browser.newContext({
    ...devices['iPhone 12'],
    baseURL,
    viewport: { width: 390, height: 844 },
  })
  const page = await context.newPage()
  const sessionId = `guitar-night-mobile-two-stem-${Date.now()}`

  try {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await initializeGuitarNightDatabase(page)
    await seedCompletedTwoStemSong(page, sessionId)
    await page.goto(`/guitar-night?session=${encodeURIComponent(sessionId)}`, {
      waitUntil: 'domcontentloaded',
    })
    await page.getByRole('button', { name: 'Enter room', exact: true }).click()

    const room = page.getByTestId('guitar-night-room')
    await expect(room).toBeVisible()
    const stage = page.getByTestId('guitar-night-stage')
    const mobileStage = await stage.boundingBox()
    expect(mobileStage).not.toBeNull()
    expect(mobileStage?.width).toBeGreaterThanOrEqual(388)
    expect(mobileStage?.height).toBeGreaterThanOrEqual(844 * 0.65)
    await expect(
      room.getByRole('button', { name: 'Play backing', exact: true }),
    ).toBeVisible()
    await expect(
      room.getByRole('slider', { name: 'Song position', exact: true }),
    ).toBeVisible()

    const viewportMetrics = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }))
    expect(viewportMetrics.scrollWidth).toBeLessThanOrEqual(
      viewportMetrics.clientWidth + 2,
    )

    const controls = room.locator('button:visible, input[type="range"]:visible')
    expect(await controls.count()).toBeGreaterThanOrEqual(4)
    for (let index = 0; index < (await controls.count()); index += 1) {
      const control = controls.nth(index)
      await control.scrollIntoViewIfNeeded()
      const box = await control.boundingBox()
      expect(box).not.toBeNull()
      expect(box?.width).toBeGreaterThanOrEqual(44)
      expect(box?.height).toBeGreaterThanOrEqual(44)
      expect(box?.x).toBeGreaterThanOrEqual(0)
      expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(
        viewportMetrics.clientWidth,
      )
    }

    await page.setViewportSize({ width: 320, height: 568 })
    const narrowMetrics = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }))
    expect(narrowMetrics.scrollWidth).toBeLessThanOrEqual(
      narrowMetrics.clientWidth + 2,
    )
    await expect(
      room.getByRole('button', { name: 'Play backing', exact: true }),
    ).toBeVisible()
    await expect(
      room.getByRole('slider', { name: 'Backing volume', exact: true }),
    ).toBeVisible()
  } finally {
    await context.close()
  }
})

test('keeps a full band inside the room across tablet and phone widths @smoke', async ({
  browser,
}) => {
  const baseURL = test.info().project.use.baseURL
  const context = await browser.newContext({
    baseURL,
    viewport: { width: 768, height: 900 },
  })
  const page = await context.newPage()
  const sessionId = `guitar-night-tablet-band-${Date.now()}`

  try {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await initializeGuitarNightDatabase(page)
    await seedCompletedFullBandSong(page, sessionId)
    await page.goto(`/guitar-night?session=${encodeURIComponent(sessionId)}`, {
      waitUntil: 'domcontentloaded',
    })
    await page.getByRole('button', { name: 'Enter room', exact: true }).click()

    const room = page.getByTestId('guitar-night-room')
    const bandControls = room.getByLabel(
      'Band, loop, and input controls, 6 tracks',
      { exact: true },
    )
    await bandControls.click()
    const channels = room.locator('[aria-label="Backing tracks"] button')
    await expect(channels).toHaveCount(6)
    await channels.first().focus()
    await page.keyboard.press('Escape')
    await expect(bandControls).toBeFocused()
    await expect(bandControls.locator('..')).not.toHaveAttribute('open', '')
    await bandControls.click()

    const layout = await room.evaluate((element) => {
      const panel = element.getBoundingClientRect()
      const strip = element.querySelector<HTMLElement>(
        '[aria-label="Backing tracks"]',
      )
      const buttons = [
        ...element.querySelectorAll<HTMLElement>(
          '[aria-label="Backing tracks"] button',
        ),
      ]
      return {
        allChannelsInside: buttons.every((button) => {
          const bounds = button.getBoundingClientRect()
          return (
            bounds.left >= panel.left - 1 && bounds.right <= panel.right + 1
          )
        }),
        stripClientWidth: strip?.clientWidth ?? 0,
        stripScrollWidth: strip?.scrollWidth ?? 0,
      }
    })
    expect(layout.allChannelsInside).toBe(true)
    expect(layout.stripScrollWidth).toBeLessThanOrEqual(
      layout.stripClientWidth + 1,
    )

    await page.setViewportSize({ width: 390, height: 844 })
    const phoneLayout = await room.evaluate((element) => {
      const panel = element.getBoundingClientRect()
      const stage = element.querySelector<HTMLElement>(
        '[data-testid="guitar-night-stage"]',
      )
      const deck = element.querySelector<HTMLElement>(
        '[data-testid="guitar-night-deck"]',
      )
      const strip = element.querySelector<HTMLElement>(
        '[aria-label="Backing tracks"]',
      )
      const buttons = [
        ...element.querySelectorAll<HTMLElement>(
          '[aria-label="Backing tracks"] button',
        ),
      ]
      return {
        allChannelsInside: buttons.every((button) => {
          const bounds = button.getBoundingClientRect()
          return (
            bounds.left >= panel.left - 1 && bounds.right <= panel.right + 1
          )
        }),
        deckBottom: deck?.getBoundingClientRect().bottom ?? Infinity,
        stageHeight: stage?.getBoundingClientRect().height ?? 0,
        stripClientWidth: strip?.clientWidth ?? 0,
        stripScrollWidth: strip?.scrollWidth ?? 0,
      }
    })
    expect(phoneLayout.allChannelsInside).toBe(true)
    expect(phoneLayout.stripScrollWidth).toBeLessThanOrEqual(
      phoneLayout.stripClientWidth + 1,
    )
    expect(phoneLayout.deckBottom).toBeLessThanOrEqual(845)
    expect(phoneLayout.stageHeight).toBeGreaterThanOrEqual(844 * 0.65)
  } finally {
    await context.close()
  }
})

test('keeps the phone chrome to one row and splits the transport evenly @smoke', async ({
  browser,
}) => {
  // Every finding here is geometry, so it needs a real layout engine: on the
  // owner's iPhone 13 Pro the header wrapped to two rows, the speed control
  // swallowed the transport while volume was squeezed against the edge, and
  // in landscape the wordmark plus room name cost the fretboard a whole row.
  const baseURL = test.info().project.use.baseURL
  const context = await browser.newContext({
    baseURL,
    viewport: { width: 390, height: 844 },
  })
  const page = await context.newPage()

  try {
    const sessionId = `guitar-night-mobile-chrome-${Date.now()}`
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await instrumentMicrophoneRequests(page)
    await instrumentAudioContext(page)
    await initializeGuitarNightDatabase(page)
    await seedCompletedTwoStemSong(page, sessionId)
    await page.goto(`/guitar-night?session=${encodeURIComponent(sessionId)}`, {
      waitUntil: 'domcontentloaded',
    })
    await page.getByRole('button', { name: 'Enter room', exact: true }).click()
    await expect(page.getByTestId('guitar-night-room')).toBeVisible()

    /**
     * The header's visible children share one band when the lowest top still
     * sits above the highest bottom. Counting distinct tops would not do: the
     * voice pill is shorter than the brand and centres itself inside the row.
     */
    const headerBand = () =>
      page.getByTestId('guitar-night-topbar').evaluate((bar) => {
        const boxes = [...bar.children]
          .map((child) => child.getBoundingClientRect())
          .filter((box) => box.width > 0 && box.height > 0)
        return {
          singleRow:
            Math.max(...boxes.map((box) => box.top)) <
            Math.min(...boxes.map((box) => box.bottom)),
          height: bar.getBoundingClientRect().height,
        }
      })

    const portraitHeader = await headerBand()
    expect(portraitHeader.singleRow).toBe(true)
    expect(portraitHeader.height).toBeLessThanOrEqual(72)

    // The voice pill belongs to the rail now. As a floating overlay it cleared
    // `--tabbar-total` for a tab bar this screen does not have and landed on
    // the primary action button.
    const pill = page.getByTestId('voice-control-pill')
    await expect(pill).toHaveAttribute('data-placement', 'docked')
    expect(
      await pill.evaluate((element) => {
        const bar = element.closest('[data-testid="guitar-night-topbar"]')
        if (bar === null) return false
        const pillBox = element.getBoundingClientRect()
        const barBox = bar.getBoundingClientRect()
        return (
          pillBox.top >= barBox.top - 1 && pillBox.bottom <= barBox.bottom + 1
        )
      }),
    ).toBe(true)

    /** Speed and volume widths, as laid out. */
    const transportHalves = () =>
      page.evaluate(() => {
        const speed = document.querySelector('[aria-label="Playback speed"]')
        const volume = document
          .querySelector('input[aria-label="Backing volume"]')
          ?.closest('label')
        return {
          speed: speed?.getBoundingClientRect().width ?? 0,
          volume: volume?.getBoundingClientRect().width ?? 0,
        }
      })

    const portrait = await transportHalves()
    expect(portrait.speed).toBeGreaterThan(0)
    expect(portrait.volume).toBeGreaterThan(0)
    // "half half seems like it should be nice for space" — before this, speed
    // took roughly three times the width volume did.
    expect(Math.abs(portrait.speed - portrait.volume)).toBeLessThanOrEqual(
      portrait.speed * 0.12,
    )

    const overflow = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }))
    expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 2)

    await page.setViewportSize({ width: 844, height: 390 })
    const landscapeHeader = await headerBand()
    expect(landscapeHeader.singleRow).toBe(true)
    // 390px of height, most of it owed to the fretboard.
    expect(landscapeHeader.height).toBeLessThanOrEqual(64)

    const landscape = await transportHalves()
    expect(Math.abs(landscape.speed - landscape.volume)).toBeLessThanOrEqual(
      landscape.speed * 0.12,
    )

    // A landscape phone escapes every max-width rule, which is why the app
    // name and the room name were still there taking a second row.
    const chrome = await page
      .getByTestId('guitar-night-topbar')
      .evaluate((bar) => {
        const shown = (element: Element | null | undefined): boolean =>
          element !== null &&
          element !== undefined &&
          element.getBoundingClientRect().height > 0
        const brand = bar.querySelector('a[aria-label="MercuryPitch home"]')
        const spans = [...bar.querySelectorAll('span')]
        return {
          mark: shown(brand),
          wordmark: shown(brand?.querySelector('span')),
          appName: shown(
            spans.find((span) => span.textContent?.trim() === 'Guitar Night'),
          ),
        }
      })
    // "keep the icon only in left corner" — the mark stays, the words go.
    expect(chrome.mark).toBe(true)
    expect(chrome.wordmark).toBe(false)
    expect(chrome.appName).toBe(false)
  } finally {
    await context.close()
  }
})

/**
 * A phone's decode budget is 192 MiB, so a real song plays through media
 * elements rather than decoded PCM. Long enough to land there: two stems
 * cost `duration * 768 KB` of estimated PCM between them.
 */
const STREAMED_SONG_SECONDS = 270

test('seeks a streamed room without a correction storm @smoke', async ({
  browser,
}) => {
  // Reported from an iPhone: "it stutters when I seek in advance on the song,
  // then when it seems to load the next few seconds it works, then if I seek
  // to another time it stutters again". Seeking a PLAYING media element
  // stalls it while its pipeline re-primes; the room used to reopen the bus
  // 18 ms later and then let the drift servo seek the stems again, and again,
  // against clocks that were still settling. Every one of those is a hole in
  // the audio. This counts them.
  const baseURL = test.info().project.use.baseURL
  const context = await browser.newContext({
    baseURL,
    viewport: { width: 390, height: 844 },
  })
  const page = await context.newPage()
  const sessionId = `guitar-night-streamed-${Date.now()}`

  try {
    await page.addInitScript(() => {
      const tracked = window as unknown as {
        __stemSeeks: number[]
        __stemRestarts: number
      }
      tracked.__stemSeeks = []
      tracked.__stemRestarts = 0
      const descriptor = Object.getOwnPropertyDescriptor(
        HTMLMediaElement.prototype,
        'currentTime',
      )
      if (descriptor?.set !== undefined) {
        Object.defineProperty(HTMLMediaElement.prototype, 'currentTime', {
          ...descriptor,
          set(value: number) {
            tracked.__stemSeeks.push(value)
            descriptor.set?.call(this, value)
          },
        })
      }
      const play = HTMLMediaElement.prototype.play
      HTMLMediaElement.prototype.play = function replay(
        this: HTMLMediaElement,
      ) {
        tracked.__stemRestarts += 1
        return play.call(this)
      }
    })

    await initializeGuitarNightDatabase(page)
    await seedCompletedTwoStemSong(page, sessionId, STREAMED_SONG_SECONDS)
    await page.goto(`/guitar-night?session=${encodeURIComponent(sessionId)}`, {
      waitUntil: 'domcontentloaded',
    })
    await page.getByRole('button', { name: 'Enter room', exact: true }).click()

    const room = page.getByTestId('guitar-night-room')
    await expect(room).toBeVisible()
    await room
      .getByRole('button', { name: 'Play backing', exact: true })
      .click()
    // The path under test: two <audio> elements on one servo.
    await expect(room).toHaveAttribute('data-playback-mode', 'streamed')

    // Steady state. Two independently clocked elements must be held together
    // without seeking either of them — the old servo seeked one every 400 ms
    // and never converged, because each correction cost more latency than the
    // tolerance it was correcting to.
    //
    // Measure only once the room is genuinely running: starting a stem
    // legitimately aligns it to the offset, and the load mode is published
    // before that alignment finishes.
    const positionSlider = room.getByLabel('Song position')
    await expect
      .poll(
        () =>
          positionSlider.evaluate((element) =>
            Number((element as HTMLInputElement).value),
          ),
        { timeout: 8000 },
      )
      .toBeGreaterThan(1)
    await page.evaluate(() => {
      const tracked = window as unknown as {
        __stemSeeks: number[]
        __stemRestarts: number
      }
      tracked.__stemSeeks.length = 0
      tracked.__stemRestarts = 0
    })
    await page.waitForTimeout(3000)
    expect(
      await page.evaluate(
        () => (window as unknown as { __stemSeeks: number[] }).__stemSeeks,
      ),
    ).toEqual([])

    // Now the seek the owner does: drag the song timeline well forward.
    const target = Math.round(STREAMED_SONG_SECONDS * 0.4)
    await positionSlider.evaluate((element, value) => {
      const input = element as HTMLInputElement
      input.value = String(value)
      input.dispatchEvent(new Event('input', { bubbles: true }))
    }, target)
    await page.waitForTimeout(3000)

    const after = await page.evaluate(() => {
      const tracked = window as unknown as {
        __stemSeeks: number[]
        __stemRestarts: number
      }
      return { seeks: tracked.__stemSeeks, restarts: tracked.__stemRestarts }
    })
    // One landing per stem, and nothing piled on top of it afterwards.
    expect(after.seeks.length).toBeGreaterThanOrEqual(2)
    expect(after.seeks.length).toBeLessThanOrEqual(4)
    for (const seek of after.seeks) expect(seek).toBeCloseTo(target, 0)
    // And each stem was moved while stopped and started again, rather than
    // seeked mid-flight — the sequence the fix is. A browser fast enough to
    // hide the stall (this one) still shows the difference here.
    expect(after.restarts).toBeGreaterThanOrEqual(2)

    // And it is still playing, from where it was asked to play.
    await expect(room).toHaveAttribute('data-playback-mode', 'streamed')
    const position = await positionSlider.evaluate((element) =>
      Number((element as HTMLInputElement).value),
    )
    expect(position).toBeGreaterThan(target)
  } finally {
    await context.close()
  }
})
