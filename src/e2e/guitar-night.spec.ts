// Guitar Night smoke coverage protects the standalone boundary and first-viewport accessibility.
// ============================================================

import { devices, expect, test } from '@playwright/test'

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
): Promise<void> {
  const vocalWav = createTestWav(330)
  const instrumentalWav = createTestWav(110)

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
      durationSeconds: TEST_SONG_DURATION_SECONDS,
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

async function instrumentMicrophoneRequests(
  page: import('@playwright/test').Page,
) {
  await page.addInitScript(() => {
    const trackedWindow = window as unknown as {
      __guitarNightMicCalls: number
    }
    trackedWindow.__guitarNightMicCalls = 0

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

    const runningAnimations = await page.evaluate(
      () =>
        document
          .getAnimations()
          .filter((animation) => animation.playState === 'running').length,
    )
    expect(runningAnimations).toBe(0)
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

  const chooseAudio = page.getByRole('button', {
    name: 'Choose audio',
    exact: true,
  })
  await chooseAudio.scrollIntoViewIfNeeded()
  const buttonBox = await chooseAudio.boundingBox()
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
    page.getByRole('heading', { name: 'Start with one string.' }),
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
    name: 'Tap each low E note',
  })
  for (let hit = 0; hit < 4; hit += 1) await rhythmButton.click()
  await expect(
    page.getByText('You just read your first bar of tab.'),
  ).toBeVisible()

  await page.getByRole('button', { name: 'Back', exact: true }).click()
  await page.getByRole('button', { name: 'Load a song', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'Bring a song into the room.' }),
  ).toBeVisible()
  await expect(
    page.getByText('Nothing starts playing on its own.'),
  ).toBeVisible()

  const fileChooserPromise = page.waitForEvent('filechooser')
  await page.getByRole('button', { name: 'Choose audio', exact: true }).click()
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
    fullRoomLayout.viewportHeight * 0.35,
  )
  expect(fullRoomLayout.deckBottom).toBeLessThanOrEqual(
    fullRoomLayout.viewportHeight + 1,
  )
  await expect(stage).toBeVisible()
  await expect(
    room.getByRole('heading', { name: 'midnight-drums.wav' }),
  ).toBeFocused()
  const flowCanvas = room.getByRole('img', {
    name: 'midnight-drums.wav flowing guitar fretboard',
    exact: true,
  })
  await expect(flowCanvas).toBeVisible()
  await expect(flowCanvas).toHaveAttribute('data-camera-ready', 'true')
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

  await room.getByRole('button', { name: 'Neck', exact: true }).click()
  await expect(room.locator('[data-stage-mode="neck"]')).toBeVisible()
  await room.getByRole('button', { name: 'Tab', exact: true }).click()
  await expect(room.locator('[data-stage-mode="tab"]')).toBeVisible()
  await room.getByRole('button', { name: 'Flow', exact: true }).click()
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

  await room.getByRole('button', { name: 'Songs', exact: true }).click()
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

  await room.getByRole('button', { name: 'Listening', exact: true }).click()
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
    expect(mobileStage?.height).toBeGreaterThanOrEqual(844 * 0.35)
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

    const controls = room.locator('button, input[type="range"]')
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
    const channels = room.locator('[aria-label="Backing tracks"] button')
    await expect(channels).toHaveCount(6)

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
    expect(phoneLayout.stageHeight).toBeGreaterThanOrEqual(844 * 0.35)
  } finally {
    await context.close()
  }
})
