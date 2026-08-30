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
  durationSeconds = TEST_SONG_DURATION_SECONDS,
): Promise<void> {
  const stemWav = createTestWav(165, durationSeconds)

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
      durationSeconds,
      sessionId,
      stemBase64: stemWav.toString('base64'),
    },
  )
}

async function seedAuthoredGuitarScore(
  page: import('@playwright/test').Page,
  songId: string,
  includeSecondaryPart = false,
): Promise<void> {
  await page.addInitScript(
    ({ includeSecondary, seededSongId }) => {
      const notes = Array.from({ length: 16 }, (_, index) => ({
        midi: index % 2 === 0 ? 64 : 67,
        startBeat: index,
        duration: 1,
        stringIndex: 0,
        fret: index % 2 === 0 ? 0 : 3,
      }))
      const rhythmNotes = Array.from({ length: 16 }, (_, index) => ({
        midi: index % 2 === 0 ? 59 : 62,
        startBeat: index + 0.5,
        duration: 0.5,
        stringIndex: 1,
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
              ...(includeSecondary
                ? [
                    {
                      id: 'track-rhythm',
                      name: 'Rhythm guitar',
                      instrumentName: 'Rhythm Guitar',
                      noteCount: rhythmNotes.length,
                      notes: rhythmNotes,
                    },
                  ]
                : []),
            ],
            scoreTrackId: 'track-lead',
            backingTrackIds: includeSecondary ? ['track-rhythm'] : [],
            importedAt: Date.now(),
          },
        ]),
      )
    },
    { includeSecondary: includeSecondaryPart, seededSongId: songId },
  )
}

async function seedDenseAuthoredGuitarScore(
  page: import('@playwright/test').Page,
  songId: string,
): Promise<void> {
  await page.addInitScript((seededSongId) => {
    const noteCount = 2_245
    const totalBeats = 1_254
    const notes = Array.from({ length: noteCount }, (_, index) => {
      const stringIndex = index % 6
      return {
        midi: 64 - stringIndex * 5 + (index % 4),
        startBeat: (index * totalBeats) / noteCount,
        duration: 0.25,
        stringIndex,
        fret: 5 + (index % 5),
      }
    })
    localStorage.setItem(
      'pitchperfect_guitar_songs',
      JSON.stringify([
        {
          id: seededSongId,
          name: 'Fast dense rehearsal study',
          bpm: 169,
          tracks: [
            {
              id: 'track-fast-lead',
              name: 'Fast lead guitar',
              instrumentName: 'Electric Guitar',
              noteCount: notes.length,
              notes,
            },
          ],
          scoreTrackId: 'track-fast-lead',
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
  // Two entries, not three: the way to the Guitar workspace is a return
  // control on the eyebrow rather than a third choice of equal weight.
  await expect(buttons).toHaveCount(2)
  await expect(buttons.nth(0)).toHaveAccessibleName('Start')
  await expect(buttons.nth(1)).toHaveAccessibleName('Load a song')
  await expect(
    page.getByRole('button', { name: 'Open the Guitar workspace' }),
  ).toBeVisible()

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
  // Tune guitar sits outside the pair, so the third stop leaves the group.
  await expect(page.getByRole('button', { name: /Tune guitar/ })).toBeFocused()

  const accountTrigger = page.getByRole('button', {
    name: 'Sign in to MercuryPitch',
    exact: true,
  })
  await expect(accountTrigger).toBeVisible()
  const accountTriggerBox = await accountTrigger.boundingBox()
  expect(accountTriggerBox?.height).toBeGreaterThanOrEqual(44)

  const roomTrigger = page.getByRole('button', { name: 'Room', exact: true })
  await roomTrigger.click()
  const roomDrawer = page.getByRole('dialog', {
    name: 'Guitar Night room and settings',
  })
  await expect(roomDrawer).toBeVisible()
  await page.keyboard.press('Tab')
  await expect
    .poll(async () =>
      roomDrawer.evaluate((drawer) => drawer.contains(document.activeElement)),
    )
    .toBe(true)
  await page.keyboard.press('Escape')
  await expect(roomDrawer).toBeHidden()
  await expect(roomTrigger).toBeFocused()

  await accountTrigger.click()

  const authDialog = page.getByRole('dialog', {
    name: 'Sign in',
    exact: true,
  })
  await expect(authDialog).toBeVisible()
  await expect(page.locator('[role="dialog"][aria-modal="true"]')).toHaveCount(
    1,
  )
  await expect(page.getByTestId('auth-modal-overlay')).toHaveAttribute(
    'data-tone',
    'guitar-night',
  )
  await expect(page.getByTestId('auth-email')).toBeFocused()
  const createAccount = page.getByTestId('auth-switch-register')
  await createAccount.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('auth-display-name')).toBeFocused()
  const authClose = page.getByTestId('auth-modal-close')
  // The dialog enters at scale(.98); wait until that purely visual motion is
  // finished before measuring the settled CSS hit target.
  await expect
    .poll(async () => (await authClose.boundingBox())?.width ?? 0)
    .toBeGreaterThanOrEqual(44)
  await expect
    .poll(async () => (await authClose.boundingBox())?.height ?? 0)
    .toBeGreaterThanOrEqual(44)
  await page.keyboard.press('Escape')
  await expect(authDialog).toBeHidden()
  await expect(accountTrigger).toBeFocused()

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
    // Learn is opened from inside the room drawer, and opening it closes the
    // drawer. Its trigger is still in the document — the drawer slides off
    // the edge rather than unmounting — so handing focus back to it would
    // put focus on something off-screen and inert. The way back is the
    // button that opens the drawer.
    await expect(
      page.getByRole('button', { name: 'Room', exact: true }),
    ).toBeFocused()
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
    // The rooms are a picker in a drawer now, not a <select> in the rail.
    // Escape has to close the drawer and put focus back where it came from,
    // which is the one thing a phone user cannot recover on their own.
    await roomMenu.click()
    await expect(roomMenu).toHaveAttribute('aria-expanded', 'true')
    await expect(
      page.getByTestId('guitar-night-room-drawer').getByRole('button', {
        name: /^Velvet Rehearsal/,
      }),
    ).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(roomMenu).toHaveAttribute('aria-expanded', 'false')
    await expect(roomMenu).toBeFocused()

    const buttons = page
      .getByTestId('guitar-night-entry-actions')
      .getByRole('button')
    await expect(buttons).toHaveCount(2)
    for (let index = 0; index < 2; index += 1) {
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
  await expect(page.getByText('Choose your next song.')).toBeVisible()

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
    .getByRole('button', { name: 'Practice with tab', exact: true })
    .click()

  const room = page.getByTestId('guitar-night-score-room')
  const deck = room.getByTestId('guitar-night-score-deck')
  const slider = room.getByRole('slider', {
    name: 'Score position',
    exact: true,
  })
  const elapsed = room.getByLabel('Elapsed score time')
  await expect(slider).toBeVisible()

  const desktopDeck = await deck.evaluate((element) => {
    const rect = (testId: string): DOMRect => {
      const target = element.querySelector<HTMLElement>(
        `[data-testid="${testId}"]`,
      )
      if (target === null) throw new Error(`Missing ${testId}`)
      return target.getBoundingClientRect()
    }
    const listening = rect('guitar-night-score-listening-dock')
    const support = rect('guitar-night-score-listening-support')
    const core = rect('guitar-night-score-transport-core')
    const controls = rect('guitar-night-score-transport-controls')
    return {
      coreCenter: core.left + core.width / 2,
      controlsCenter: controls.left + controls.width / 2,
      listeningBottom: listening.bottom,
      supportLeft: support.left,
      supportRight: support.right,
      supportTop: support.top,
      coreLeft: core.left,
    }
  })
  expect(desktopDeck.supportTop).toBeGreaterThanOrEqual(
    desktopDeck.listeningBottom - 1,
  )
  expect(desktopDeck.supportLeft).toBeGreaterThanOrEqual(0)
  expect(desktopDeck.supportRight).toBeLessThanOrEqual(desktopDeck.coreLeft + 1)
  expect(
    Math.abs(desktopDeck.coreCenter - desktopDeck.controlsCenter),
  ).toBeLessThanOrEqual(1)

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
  const countIn = room.locator('details[open]').getByRole('button', {
    name: /^Count-in .* before playback\. Change count-in$/,
  })
  for (let step = 0; step < 4; step += 1) {
    if ((await countIn.getAttribute('aria-label'))?.includes('Off')) break
    await countIn.click()
  }
  await expect(countIn).toHaveAccessibleName(
    'Count-in Off before playback. Change count-in',
  )
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
  await expect(
    room.getByRole('button', { name: 'Resume score', exact: true }),
  ).toBeVisible()
  await expect(
    room.getByRole('button', { name: 'End the take', exact: true }),
  ).toBeVisible()

  await page.setViewportSize({ width: 568, height: 320 })
  const shortLandscape = await deck.evaluate((deck) => {
    const controls = deck.querySelector<HTMLElement>(
      '[data-testid="guitar-night-score-transport-controls"]',
    )
    const deckRect = deck.getBoundingClientRect()
    const controlsRect = controls?.getBoundingClientRect()
    return {
      viewportWidth: document.documentElement.clientWidth,
      pageWidth: document.documentElement.scrollWidth,
      deckLeft: deckRect.left,
      deckRight: deckRect.right,
      controlsWidth: controls?.clientWidth ?? 0,
      controlsScrollWidth: controls?.scrollWidth ?? 0,
      controlsRight: controlsRect?.right ?? 0,
    }
  })
  expect(shortLandscape.pageWidth).toBeLessThanOrEqual(
    shortLandscape.viewportWidth + 2,
  )
  expect(shortLandscape.deckLeft).toBeGreaterThanOrEqual(0)
  expect(shortLandscape.deckRight).toBeLessThanOrEqual(
    shortLandscape.viewportWidth + 1,
  )
  expect(shortLandscape.controlsScrollWidth).toBeLessThanOrEqual(
    shortLandscape.controlsWidth + 1,
  )
  expect(shortLandscape.controlsRight).toBeLessThanOrEqual(
    shortLandscape.viewportWidth + 1,
  )

  await room.getByLabel('Session controls').click()
  await expect(room.getByRole('group', { name: 'Session tempo' })).toBeVisible()
  await expect(room.getByLabel('Session rehearsal mix volume')).toBeVisible()
  await room.getByLabel('Session controls').click()

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

test('adapts and zooms a dense fast Tab with real wheel and slider input @smoke', async ({
  page,
}) => {
  const songId = `guitar-night-dense-tab-${Date.now()}`
  await seedDenseAuthoredGuitarScore(page, songId)
  await page.goto(`/guitar-night?song=${encodeURIComponent(songId)}`, {
    waitUntil: 'domcontentloaded',
  })

  await page.getByRole('button', { name: 'Load a song', exact: true }).click()
  await page
    .getByRole('button', { name: 'Practice with tab', exact: true })
    .click()

  const room = page.getByTestId('guitar-night-score-room')
  await room.getByRole('button', { name: 'Tab', exact: true }).click()

  const tab = room.getByTestId('guitar-night-moving-tab')
  const tabWindow = room.locator('[data-window-beats]')
  const zoom = room.getByRole('slider', { name: 'Tab zoom', exact: true })
  const sizeToggle = room.getByRole('button', {
    name: 'Large tab size',
    exact: true,
  })
  await expect(tab).toBeVisible()
  await expect(zoom).toHaveValue('125')
  await expect(sizeToggle).toHaveAttribute('aria-pressed', 'false')
  await expect(zoom).toHaveAttribute(
    'aria-valuetext',
    /^125% zoom, \d+(?:\.\d{1,2})? beats visible$/,
  )

  const initialWindow = Number(
    await tabWindow.getAttribute('data-window-beats'),
  )
  expect(initialWindow).toBeGreaterThan(1.75)
  expect(initialWindow).toBeLessThan(4.75)
  await expect(tab.locator('[data-note-id]')).not.toHaveCount(0)
  expect(await tab.locator('[data-note-id]').count()).toBeLessThan(40)

  const labelGutter = await tab.evaluate((lanes) => {
    const track = lanes.querySelector<HTMLElement>(
      '[data-testid="guitar-night-tab-note-track"]',
    )
    const label =
      track?.parentElement?.querySelector<HTMLElement>(':scope > span')
    if (
      track === null ||
      track === undefined ||
      label === null ||
      label === undefined
    ) {
      throw new Error('Tab label gutter is not mounted')
    }
    const trackStyle = getComputedStyle(track)
    return {
      labelRight: label.getBoundingClientRect().right,
      mask:
        trackStyle.maskImage ||
        trackStyle.getPropertyValue('-webkit-mask-image'),
      overflowX: trackStyle.overflowX,
      trackLeft: track.getBoundingClientRect().left,
    }
  })
  expect(labelGutter.trackLeft).toBeGreaterThanOrEqual(labelGutter.labelRight)
  expect(labelGutter.overflowX).toBe('hidden')
  expect(labelGutter.mask).not.toBe('none')

  const readTabScale = () =>
    tab.evaluate((lanes) => {
      const note = lanes.querySelector<HTMLElement>('[data-note-id]')
      const noteTrack = lanes.querySelector<HTMLElement>(
        '[data-testid="guitar-night-tab-note-track"]',
      )
      const laneRect = lanes.getBoundingClientRect()
      const noteRect = (note ?? noteTrack)?.getBoundingClientRect()
      if (noteRect === undefined)
        throw new Error('Tab note track is not mounted')
      const fontProbe = document.createElement('span')
      fontProbe.style.cssText =
        'position:absolute;visibility:hidden;font-size:var(--stage-tab-note-font-size)'
      lanes.append(fontProbe)
      const noteFontSize = Number.parseFloat(
        getComputedStyle(fontProbe).fontSize,
      )
      fontProbe.remove()
      return {
        laneHeight: laneRect.height,
        noteFontSize,
        noteHeight: noteRect.height,
      }
    })
  const readTabContainment = () =>
    tabWindow.evaluate((stage) => {
      const lanes = stage.querySelector<HTMLElement>(
        '[data-testid="guitar-night-moving-tab"]',
      )
      const controls = stage.querySelector<HTMLElement>(
        '[role="group"][aria-label="Tab reading controls"]',
      )
      const rows = [
        ...(lanes?.querySelectorAll<HTMLElement>(
          '[data-testid="guitar-night-tab-note-track"]',
        ) ?? []),
      ]
      if (lanes === null || controls === null || rows.length === 0) {
        throw new Error('Large Tab layout is not mounted')
      }
      const stageRect = stage.getBoundingClientRect()
      const laneRect = lanes.getBoundingClientRect()
      const controlsRect = controls.getBoundingClientRect()
      const rowRects = rows.map((row) =>
        (row.parentElement ?? row).getBoundingClientRect(),
      )
      const noteRects = [
        ...lanes.querySelectorAll<HTMLElement>('[data-note-id]'),
      ].map((note) => note.getBoundingClientRect())
      const intersectsControls = (rect: DOMRect) =>
        rect.right > controlsRect.left &&
        rect.left < controlsRect.right &&
        rect.bottom > controlsRect.top &&
        rect.top < controlsRect.bottom
      return {
        controlsBottom: controlsRect.bottom,
        controlsLeft: controlsRect.left,
        controlsRight: controlsRect.right,
        controlsTop: controlsRect.top,
        laneBottom: laneRect.bottom,
        laneTop: laneRect.top,
        noteControlOverlaps: noteRects.filter(intersectsControls).length,
        pageWidth: document.documentElement.scrollWidth,
        rowBottom: Math.max(...rowRects.map((rect) => rect.bottom)),
        rowControlOverlaps: rowRects.filter(intersectsControls).length,
        rowTop: Math.min(...rowRects.map((rect) => rect.top)),
        stageBottom: stageRect.bottom,
        stageLeft: stageRect.left,
        stageRight: stageRect.right,
        stageTop: stageRect.top,
        viewportHeight: document.documentElement.clientHeight,
        viewportWidth: document.documentElement.clientWidth,
      }
    })
  const expectLargeTabContained = async () => {
    const layout = await readTabContainment()
    expect(layout.rowTop).toBeGreaterThanOrEqual(layout.laneTop - 1)
    expect(layout.rowBottom).toBeLessThanOrEqual(layout.laneBottom + 1)
    expect(layout.laneTop).toBeGreaterThanOrEqual(layout.stageTop - 1)
    expect(layout.laneBottom).toBeLessThanOrEqual(layout.stageBottom + 1)
    expect(layout.controlsTop).toBeGreaterThanOrEqual(layout.stageTop - 1)
    expect(layout.controlsBottom).toBeLessThanOrEqual(layout.stageBottom + 1)
    expect(layout.controlsLeft).toBeGreaterThanOrEqual(layout.stageLeft - 1)
    expect(layout.controlsRight).toBeLessThanOrEqual(layout.stageRight + 1)
    expect(layout.rowBottom).toBeLessThanOrEqual(layout.controlsTop)
    expect(layout.rowControlOverlaps).toBe(0)
    expect(layout.noteControlOverlaps).toBe(0)
    expect(layout.pageWidth).toBeLessThanOrEqual(layout.viewportWidth + 1)
    expect(layout.controlsBottom).toBeLessThanOrEqual(layout.viewportHeight + 1)
  }
  const compactScale = await readTabScale()
  const compactWindow = await tabWindow.getAttribute('data-window-beats')

  await sizeToggle.click()
  await expect(tabWindow).toHaveAttribute('data-tab-size', 'large')
  await expect(sizeToggle).toHaveAttribute('aria-pressed', 'true')
  const largeScale = await readTabScale()
  expect(largeScale.noteHeight).toBeGreaterThan(compactScale.noteHeight * 1.2)
  expect(largeScale.laneHeight).toBeGreaterThan(compactScale.laneHeight + 12)
  expect(await tabWindow.getAttribute('data-window-beats')).toBe(compactWindow)
  expect(
    await page.evaluate(() => localStorage.getItem('guitar-night-tab-size-v1')),
  ).toBe('large')
  await expectLargeTabContained()

  const lanesBox = await tab.boundingBox()
  expect(lanesBox).not.toBeNull()
  await page.mouse.move(
    (lanesBox?.x ?? 0) + (lanesBox?.width ?? 0) / 2,
    (lanesBox?.y ?? 0) + (lanesBox?.height ?? 0) / 2,
  )
  await page.mouse.wheel(0, -120)
  await expect
    .poll(async () => Number(await zoom.inputValue()))
    .toBeGreaterThan(125)
  await expect
    .poll(async () => Number(await tabWindow.getAttribute('data-window-beats')))
    .toBeLessThan(initialWindow)

  await zoom.evaluate((input) => {
    const range = input as HTMLInputElement
    range.value = '125'
    range.dispatchEvent(new InputEvent('input', { bubbles: true }))
  })
  await expect(zoom).toHaveValue('125')
  const touch = await page.context().newCDPSession(page)
  const pinchBox = await tab.boundingBox()
  expect(pinchBox).not.toBeNull()
  const pinchY = (pinchBox?.y ?? 0) + (pinchBox?.height ?? 0) / 2
  const pinchX = (pinchBox?.x ?? 0) + (pinchBox?.width ?? 0) / 2
  await touch.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [
      { x: pinchX - 35, y: pinchY, id: 1, radiusX: 8, radiusY: 8 },
      { x: pinchX + 35, y: pinchY, id: 2, radiusX: 8, radiusY: 8 },
    ],
  })
  await touch.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [
      { x: pinchX - 70, y: pinchY, id: 1, radiusX: 8, radiusY: 8 },
      { x: pinchX + 70, y: pinchY, id: 2, radiusX: 8, radiusY: 8 },
    ],
  })
  await touch.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
  })
  await expect
    .poll(async () => Number(await zoom.inputValue()))
    .toBeGreaterThan(125)

  const zoomBox = await zoom.boundingBox()
  expect(zoomBox).not.toBeNull()
  const sliderY = (zoomBox?.y ?? 0) + (zoomBox?.height ?? 0) / 2
  const sliderLeft = (zoomBox?.x ?? 0) + 8
  const sliderTravel = Math.max(1, (zoomBox?.width ?? 16) - 16)
  await page.mouse.move(sliderLeft + sliderTravel * 0.75, sliderY)
  await page.mouse.down()
  await page.mouse.move(sliderLeft + sliderTravel * 0.9, sliderY, { steps: 5 })
  await page.mouse.up()
  await expect
    .poll(async () => Number(await zoom.inputValue()))
    .toBeGreaterThan(150)

  await zoom.press('End')
  await expect(zoom).toHaveValue('300')
  await expect
    .poll(async () => Number(await tabWindow.getAttribute('data-window-beats')))
    .toBeLessThan(2)

  const persistedZoom = await page.evaluate(() =>
    localStorage.getItem('guitar-night-tab-zoom-v1'),
  )
  expect(Number(persistedZoom)).toBeGreaterThan(1.5)

  await room.getByRole('button', { name: 'Highway', exact: true }).click()
  await expect(zoom).toHaveCount(0)
  await room.getByRole('button', { name: 'Tab', exact: true }).click()
  await expect(room.getByRole('slider', { name: 'Tab zoom' })).toHaveValue(
    String(Math.round(Number(persistedZoom) * 100)),
  )
  await expect(
    room.getByRole('button', {
      name: 'Large tab size',
      exact: true,
    }),
  ).toHaveAttribute('aria-pressed', 'true')

  await page.setViewportSize({ width: 390, height: 844 })
  const mobileBounds = await room
    .getByRole('slider', { name: 'Tab zoom' })
    .evaluate((slider) => {
      const rect = slider.getBoundingClientRect()
      return {
        left: rect.left,
        right: rect.right,
        height: rect.height,
        viewportWidth: document.documentElement.clientWidth,
        pageWidth: document.documentElement.scrollWidth,
      }
    })
  expect(mobileBounds.left).toBeGreaterThanOrEqual(0)
  expect(mobileBounds.right).toBeLessThanOrEqual(mobileBounds.viewportWidth + 1)
  expect(mobileBounds.height).toBeGreaterThanOrEqual(44)
  expect(mobileBounds.pageWidth).toBeLessThanOrEqual(
    mobileBounds.viewportWidth + 1,
  )
  const mobileSizeBounds = await room
    .getByRole('button', { name: 'Large tab size', exact: true })
    .evaluate((button) => {
      const rect = button.getBoundingClientRect()
      return {
        left: rect.left,
        right: rect.right,
        height: rect.height,
        viewportWidth: document.documentElement.clientWidth,
        pageWidth: document.documentElement.scrollWidth,
      }
    })
  expect(mobileSizeBounds.left).toBeGreaterThanOrEqual(0)
  expect(mobileSizeBounds.right).toBeLessThanOrEqual(
    mobileSizeBounds.viewportWidth + 1,
  )
  expect(mobileSizeBounds.height).toBeGreaterThanOrEqual(44)
  expect(mobileSizeBounds.pageWidth).toBeLessThanOrEqual(
    mobileSizeBounds.viewportWidth + 1,
  )
  await expectLargeTabContained()

  const setup = room.getByLabel('6-string guitar setup', { exact: true })
  await setup.click()
  await room.getByRole('combobox', { name: 'Strings' }).selectOption('8')
  await page.keyboard.press('Escape')
  await expect(tabWindow).toHaveAttribute('data-string-count', '8')
  await expectLargeTabContained()

  const readProtectedLayout = () =>
    zoom.evaluate((slider) => {
      const faceplate = slider.closest<HTMLElement>(
        '[role="group"][aria-label="Tab reading controls"]',
      )
      const tab = slider.closest('[data-window-beats]')
      if (
        !(faceplate instanceof HTMLElement) ||
        !(tab instanceof HTMLElement)
      ) {
        throw new Error('Tab zoom layout is not mounted')
      }
      const plateRect = faceplate.getBoundingClientRect()
      const overlaps = [...tab.querySelectorAll<HTMLElement>('[data-note-id]')]
        .map((note) => note.getBoundingClientRect())
        .filter(
          (note) =>
            note.right > plateRect.left &&
            note.left < plateRect.right &&
            note.bottom > plateRect.top &&
            note.top < plateRect.bottom,
        ).length
      return {
        clientWidth: faceplate.clientWidth,
        scrollWidth: faceplate.scrollWidth,
        left: plateRect.left,
        right: plateRect.right,
        bottom: plateRect.bottom,
        overlaps,
        viewportWidth: document.documentElement.clientWidth,
        viewportHeight: document.documentElement.clientHeight,
        pageWidth: document.documentElement.scrollWidth,
      }
    })

  await page.setViewportSize({ width: 320, height: 568 })
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '200%'
  })
  await expectLargeTabContained()
  const zoomedPhone = await readProtectedLayout()
  expect(zoomedPhone.scrollWidth).toBeLessThanOrEqual(
    zoomedPhone.clientWidth + 1,
  )
  expect(zoomedPhone.left).toBeGreaterThanOrEqual(0)
  expect(zoomedPhone.right).toBeLessThanOrEqual(zoomedPhone.viewportWidth + 1)
  expect(zoomedPhone.bottom).toBeLessThanOrEqual(zoomedPhone.viewportHeight + 1)
  expect(zoomedPhone.overlaps).toBe(0)
  expect(zoomedPhone.pageWidth).toBeLessThanOrEqual(
    zoomedPhone.viewportWidth + 1,
  )

  await page.evaluate(() => {
    document.documentElement.style.fontSize = ''
  })
  await page.setViewportSize({ width: 568, height: 320 })
  await expectLargeTabContained()
  const shortLandscapeLargeScale = await readTabScale()
  const shortLandscape = await readProtectedLayout()
  expect(shortLandscape.scrollWidth).toBeLessThanOrEqual(
    shortLandscape.clientWidth + 1,
  )
  expect(shortLandscape.right).toBeLessThanOrEqual(
    shortLandscape.viewportWidth + 1,
  )
  expect(shortLandscape.bottom).toBeLessThanOrEqual(
    shortLandscape.viewportHeight + 1,
  )
  expect(shortLandscape.overlaps).toBe(0)
  expect(shortLandscape.pageWidth).toBeLessThanOrEqual(
    shortLandscape.viewportWidth + 1,
  )

  await sizeToggle.click()
  await expect(sizeToggle).toHaveAttribute('aria-pressed', 'false')
  const shortLandscapeCompactScale = await readTabScale()
  expect(shortLandscapeLargeScale.noteHeight).toBeGreaterThanOrEqual(
    shortLandscapeCompactScale.noteHeight,
  )
  expect(shortLandscapeLargeScale.noteFontSize).toBeGreaterThanOrEqual(
    shortLandscapeCompactScale.noteFontSize,
  )
})

test('activates, edits, and clears an authored A B loop while playing with a real pointer @smoke', async ({
  page,
}) => {
  const songId = `guitar-night-loop-${Date.now()}`
  await instrumentAudioContext(page)
  await seedAuthoredGuitarScore(page, songId)
  await page.goto(`/guitar-night?song=${encodeURIComponent(songId)}`, {
    waitUntil: 'domcontentloaded',
  })

  await page.getByRole('button', { name: 'Load a song', exact: true }).click()
  await page
    .getByRole('button', { name: 'Practice with tab', exact: true })
    .click()

  const room = page.getByTestId('guitar-night-score-room')
  const deck = room.getByTestId('guitar-night-score-deck')
  const seek = deck.getByRole('slider', {
    name: 'Score position',
    exact: true,
  })
  const elapsed = deck.getByLabel('Elapsed score time')
  const loopControls = deck.getByRole('group', { name: 'Section loop' })
  const countIn = deck.getByRole('button', {
    name: /^Count-in .* before playback\. Change count-in$/,
  })

  for (let step = 0; step < 4; step += 1) {
    if ((await countIn.getAttribute('aria-label'))?.includes('4 beats')) break
    await countIn.click()
  }
  await expect(countIn).toHaveAccessibleName(
    'Count-in 4 beats before playback. Change count-in',
  )

  await room
    .getByRole('button', { name: 'Start the count-in', exact: true })
    .click()
  await expect(
    room.getByText('Click is running', { exact: true }),
  ).toBeVisible()
  await expect(elapsed).toHaveText('0:01')

  await loopControls
    .getByRole('button', {
      name: 'A — start the loop at the playhead',
      exact: true,
    })
    .click()
  const markerA = deck.getByTestId('guitar-night-score-loop-marker-a')
  await expect(markerA).toBeVisible()
  const aBeat = Number(await markerA.getAttribute('aria-valuenow'))
  expect(aBeat).toBeGreaterThanOrEqual(1)

  // Give the loop enough runway that a loaded CI worker cannot naturally
  // cross B while the real-pointer boundary drag is still being dispatched.
  // The deterministic controller suite separately proves the exact restart
  // beat; this smoke test protects the browser gesture and live transport.
  await page.waitForTimeout(2_000)
  const beforeB = Number(await seek.inputValue())
  await loopControls
    .getByRole('button', {
      name: 'B — end the loop at the playhead',
      exact: true,
    })
    .click()
  const markerB = deck.getByTestId('guitar-night-score-loop-marker-b')
  await expect(markerB).toBeVisible()
  const firstBBeat = Number(await markerB.getAttribute('aria-valuenow'))
  expect(firstBBeat - aBeat).toBeGreaterThanOrEqual(3)

  // The configured four-beat count-in remains a session preference, but
  // completing B during playback relaunches the running loop at A with none.
  await expect
    .poll(async () => Number(await seek.inputValue()), { timeout: 750 })
    .toBeLessThan(Math.min(beforeB - 0.25, aBeat * 0.5 + 0.65))
  await expect(room.getByText('Click is running', { exact: true })).toBeVisible(
    {
      timeout: 750,
    },
  )
  await expect(
    room.getByRole('button', { name: 'Pause score', exact: true }),
  ).toBeVisible()

  const loopStartSeconds = aBeat * 0.5
  const loopEndSeconds = firstBBeat * 0.5
  await expect
    .poll(async () => Number(await seek.inputValue()), { timeout: 1_000 })
    .toBeGreaterThan(
      loopStartSeconds + (loopEndSeconds - loopStartSeconds) * 0.25,
    )
  const beforeBoundaryEdit = Number(await seek.inputValue())
  await markerB.scrollIntoViewIfNeeded()
  const markerBox = await markerB.boundingBox()
  const seekBox = await seek.boundingBox()
  expect(markerBox).not.toBeNull()
  expect(seekBox).not.toBeNull()
  const markerCenterX = (markerBox?.x ?? 0) + (markerBox?.width ?? 0) / 2
  const markerCenterY = (markerBox?.y ?? 0) + (markerBox?.height ?? 0) / 2
  const targetX = Math.min(
    (seekBox?.x ?? 0) + (seekBox?.width ?? 0) - 12,
    markerCenterX + ((seekBox?.width ?? 0) * 2) / 16,
  )
  await page.mouse.move(markerCenterX, markerCenterY)
  await page.mouse.down()
  await page.mouse.move(targetX, markerCenterY, { steps: 8 })
  await page.mouse.up()

  // Stem Mixer semantics: widening B while the current beat remains inside
  // the range preserves that beat. Only initial A/B activation or an edit
  // that excludes the playhead may fold playback back to A.
  const afterBoundaryEdit = Number(await seek.inputValue())
  expect(afterBoundaryEdit).toBeGreaterThan(beforeBoundaryEdit - 0.15)

  await expect
    .poll(async () => Number(await markerB.getAttribute('aria-valuenow')))
    .toBeGreaterThan(firstBBeat)
  const movedBBeat = Number(await markerB.getAttribute('aria-valuenow'))
  await expect(room.getByText('Click is running', { exact: true })).toBeVisible(
    {
      timeout: 750,
    },
  )
  await expect(
    room.getByRole('button', { name: 'Pause score', exact: true }),
  ).toBeVisible()
  await expect(
    room.getByRole('button', { name: 'Resume score', exact: true }),
  ).toHaveCount(0)

  await loopControls.getByRole('button', { name: 'Clear', exact: true }).click()
  await expect(markerA).toHaveCount(0)
  await expect(markerB).toHaveCount(0)
  await expect(room.getByText('Click is running', { exact: true })).toBeVisible(
    {
      timeout: 750,
    },
  )
  await expect(
    room.getByRole('button', { name: 'Pause score', exact: true }),
  ).toBeVisible()

  // Crossing the former B proves Clear changed the active scheduler instead
  // of leaving the old range folding invisibly behind the removed markers.
  await expect
    .poll(async () => Number(await seek.inputValue()), { timeout: 5_000 })
    .toBeGreaterThan(movedBBeat * 0.5 + 0.1)
})

test('moves and widens the other-part preview without covering stage controls with a real pointer @smoke', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1_600, height: 900 })
  const songId = `guitar-night-secondary-${Date.now()}`
  await seedAuthoredGuitarScore(page, songId, true)
  await page.goto(`/guitar-night?song=${encodeURIComponent(songId)}`, {
    waitUntil: 'domcontentloaded',
  })
  await page.getByRole('button', { name: 'Load a song', exact: true }).click()
  await page
    .getByRole('button', { name: 'Practice with tab', exact: true })
    .click()

  const room = page.getByTestId('guitar-night-score-room')
  const panel = room.getByTestId('guitar-night-secondary-part')
  const moveHandle = room.getByRole('button', {
    name: 'Move Rhythm guitar preview',
  })
  const resizeHandle = room.getByRole('slider', {
    name: 'Resize Rhythm guitar preview horizontally',
  })
  await expect(panel).toBeVisible()
  await expect(panel).toHaveAttribute('data-placement-mode', 'floating')

  const initialPanel = await panel.boundingBox()
  const moveBox = await moveHandle.boundingBox()
  const resizeBox = await resizeHandle.boundingBox()
  expect(initialPanel).not.toBeNull()
  expect(moveBox?.height ?? 0).toBeGreaterThanOrEqual(44)
  expect(resizeBox?.width ?? 0).toBeGreaterThanOrEqual(44)

  await page.mouse.move(
    (moveBox?.x ?? 0) + (moveBox?.width ?? 0) / 2,
    (moveBox?.y ?? 0) + (moveBox?.height ?? 0) / 2,
  )
  await page.mouse.down()
  await page.mouse.move(
    (moveBox?.x ?? 0) + (moveBox?.width ?? 0) / 2 + 150,
    (moveBox?.y ?? 0) + (moveBox?.height ?? 0) / 2 - 75,
    { steps: 8 },
  )
  await page.mouse.up()
  const movedPanel = await panel.boundingBox()
  expect(movedPanel).not.toBeNull()
  expect(movedPanel?.x ?? 0).toBeGreaterThan((initialPanel?.x ?? 0) + 80)
  expect(movedPanel?.y ?? 0).toBeLessThan((initialPanel?.y ?? 0) - 35)

  const liveResizeBox = await resizeHandle.boundingBox()
  await page.mouse.move(
    (liveResizeBox?.x ?? 0) + (liveResizeBox?.width ?? 0) / 2,
    (liveResizeBox?.y ?? 0) + (liveResizeBox?.height ?? 0) / 2,
  )
  await page.mouse.down()
  await page.mouse.move(
    (liveResizeBox?.x ?? 0) + (liveResizeBox?.width ?? 0) / 2 + 1_000,
    (liveResizeBox?.y ?? 0) + (liveResizeBox?.height ?? 0) / 2,
    { steps: 8 },
  )
  await page.mouse.up()
  const widenedPanel = await panel.boundingBox()
  expect(widenedPanel?.width ?? 0).toBeGreaterThan(
    (movedPanel?.width ?? 0) + 80,
  )
  expect(widenedPanel?.width ?? 0).toBeGreaterThanOrEqual(559)

  const headerFaceplates = room.locator(
    'header > [data-guitar-night-secondary-protected]',
  )
  const guideFaceplate = headerFaceplates.first()
  const toolFaceplate = headerFaceplates.last()
  await expect(headerFaceplates).toHaveCount(2)
  const guideBox = await guideFaceplate.boundingBox()
  const toolBox = await toolFaceplate.boundingBox()
  const widePanel = await panel.boundingBox()
  const wideMoveBox = await moveHandle.boundingBox()
  expect(guideBox).not.toBeNull()
  expect(toolBox).not.toBeNull()
  expect(widePanel).not.toBeNull()
  expect(wideMoveBox).not.toBeNull()
  expect(
    (toolBox?.x ?? 0) - ((guideBox?.x ?? 0) + (guideBox?.width ?? 0)),
  ).toBeGreaterThan((widePanel?.width ?? 0) + 20)

  const desiredPanelX = (guideBox?.x ?? 0) + (guideBox?.width ?? 0) + 11
  const desiredPanelY = guideBox?.y ?? 0
  await page.mouse.move(
    (wideMoveBox?.x ?? 0) + (wideMoveBox?.width ?? 0) / 2,
    (wideMoveBox?.y ?? 0) + (wideMoveBox?.height ?? 0) / 2,
  )
  await page.mouse.down()
  await page.mouse.move(
    (wideMoveBox?.x ?? 0) +
      (wideMoveBox?.width ?? 0) / 2 +
      desiredPanelX -
      (widePanel?.x ?? 0),
    (wideMoveBox?.y ?? 0) +
      (wideMoveBox?.height ?? 0) / 2 +
      desiredPanelY -
      (widePanel?.y ?? 0),
    { steps: 8 },
  )
  await page.mouse.up()

  const panelBesideGuide = await panel.boundingBox()
  expect(panelBesideGuide?.x ?? 0).toBeGreaterThanOrEqual(
    (guideBox?.x ?? 0) + (guideBox?.width ?? 0) + 9,
  )
  expect(
    (panelBesideGuide?.x ?? 0) + (panelBesideGuide?.width ?? 0),
  ).toBeLessThanOrEqual((toolBox?.x ?? 0) - 9)
  expect(panelBesideGuide?.y ?? Number.POSITIVE_INFINITY).toBeLessThan(
    (guideBox?.y ?? 0) + (guideBox?.height ?? 0),
  )

  const storedLayout = await page.evaluate(() =>
    JSON.parse(
      localStorage.getItem('guitar-night-secondary-part-layout-v1') ?? '{}',
    ),
  )
  expect(storedLayout.highway?.width ?? 0).toBeGreaterThan(300)

  const protectedTarget = room
    .locator('[data-guitar-night-secondary-protected]')
    .first()
  const targetBox = await protectedTarget.boundingBox()
  const currentMoveBox = await moveHandle.boundingBox()
  expect(targetBox).not.toBeNull()
  await page.mouse.move(
    (currentMoveBox?.x ?? 0) + (currentMoveBox?.width ?? 0) / 2,
    (currentMoveBox?.y ?? 0) + (currentMoveBox?.height ?? 0) / 2,
  )
  await page.mouse.down()
  await page.mouse.move(
    (targetBox?.x ?? 0) + (targetBox?.width ?? 0) / 2,
    (targetBox?.y ?? 0) + (targetBox?.height ?? 0) / 2,
    { steps: 8 },
  )
  await page.mouse.up()

  const protectedRects = await room
    .locator('[data-guitar-night-secondary-protected]')
    .evaluateAll((elements) =>
      elements
        .filter((element) => {
          if (element.closest('details:not([open])') !== null) return false
          const style = getComputedStyle(element)
          return style.display !== 'none' && style.visibility !== 'hidden'
        })
        .map((element) => {
          const rect = element.getBoundingClientRect()
          return {
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height,
          }
        }),
    )
  expect(protectedRects.length).toBeGreaterThan(0)
  const finalPanel = await panel.boundingBox()
  for (const protectedRect of protectedRects) {
    const overlaps =
      (finalPanel?.x ?? 0) < protectedRect.x + protectedRect.width &&
      (finalPanel?.x ?? 0) + (finalPanel?.width ?? 0) > protectedRect.x &&
      (finalPanel?.y ?? 0) < protectedRect.y + protectedRect.height &&
      (finalPanel?.y ?? 0) + (finalPanel?.height ?? 0) > protectedRect.y
    expect(overlaps).toBe(false)
  }

  await page.setViewportSize({ width: 390, height: 844 })
  await expect(panel).toHaveAttribute('data-placement-mode', 'docked')
  await expect(
    room.getByRole('button', {
      name: 'Rhythm guitar preview is docked on this screen',
    }),
  ).toBeDisabled()
  await expect(resizeHandle).toBeHidden()
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
      .getByRole('button', { name: 'Practice with tab', exact: true })
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

    const stageViews = room.getByRole('group', {
      name: 'Stage view',
      exact: true,
    })
    for (const view of ['Highway', 'Grid', 'Tab', 'Neck', 'Sheet']) {
      await expect(
        stageViews.getByRole('button', { name: view, exact: true }),
      ).toBeVisible()
    }
    const reflow = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }))
    expect(reflow.scrollWidth).toBeLessThanOrEqual(reflow.clientWidth + 2)

    const expectHittableInsideViewport = async (
      control: Locator,
    ): Promise<void> => {
      await expect(control).toBeVisible()
      const metrics = await control.evaluate((element) => {
        const bounds = element.getBoundingClientRect()
        const centerX = bounds.left + bounds.width / 2
        const centerY = bounds.top + bounds.height / 2
        const hit = document.elementFromPoint(centerX, centerY)
        return {
          bottom: bounds.bottom,
          hit: hit === element || element.contains(hit),
          left: bounds.left,
          right: bounds.right,
          top: bounds.top,
          viewportHeight: window.innerHeight,
          viewportWidth: window.innerWidth,
        }
      })
      expect(metrics.left).toBeGreaterThanOrEqual(0)
      expect(metrics.right).toBeLessThanOrEqual(metrics.viewportWidth + 1)
      expect(metrics.top).toBeGreaterThanOrEqual(0)
      expect(metrics.bottom).toBeLessThanOrEqual(metrics.viewportHeight + 1)
      expect(metrics.hit).toBe(true)
    }

    const scorePosition = room.getByRole('slider', {
      name: 'Score position',
      exact: true,
    })
    const play = room.getByRole('button', {
      name: 'Start the count-in',
      exact: true,
    })
    const listening = room.getByRole('button', {
      name: 'Listening is off. Switch to Room mic',
      exact: true,
    })
    const targetMix = room.getByRole('button', {
      name: /^(?:Hear|Mute) target guide$/,
    })
    await expectHittableInsideViewport(scorePosition)
    await expectHittableInsideViewport(play)
    await expectHittableInsideViewport(listening)
    await expectHittableInsideViewport(targetMix)

    const highway = stageViews.getByRole('button', {
      name: 'Highway',
      exact: true,
    })
    await highway.focus()
    await page.keyboard.press('Shift+V')
    const voiceOverlay = page.getByTestId('voice-commands-overlay')
    await expect(voiceOverlay).toBeVisible()
    const commandFilter = voiceOverlay.getByRole('searchbox', {
      name: 'Filter commands',
    })
    await expect(commandFilter).toBeFocused()
    await commandFilter.fill('forward N minutes')
    await expect(
      voiceOverlay.getByText('forward N minutes', { exact: true }),
    ).toBeVisible()
    const voiceSurface = await voiceOverlay.evaluate((element) => {
      const card = element.firstElementChild
      return {
        backdrop: getComputedStyle(element).backgroundColor,
        card: card === null ? '' : getComputedStyle(card).backgroundColor,
      }
    })
    expect(voiceSurface.backdrop).toBe('rgba(8, 6, 5, 0.84)')
    expect(voiceSurface.card).toBe('rgb(23, 18, 15)')
    const voiceClose = voiceOverlay.getByRole('button', { name: 'Close' })
    const voiceCloseBounds = await voiceClose.boundingBox()
    expect(voiceCloseBounds?.width ?? 0).toBeGreaterThanOrEqual(44)
    expect(voiceCloseBounds?.height ?? 0).toBeGreaterThanOrEqual(44)
    await page.keyboard.press('Escape')
    await expect(voiceOverlay).not.toBeVisible()
    await expect(highway).toBeFocused()

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

    await page.keyboard.press('Escape')
    await page.setViewportSize({ width: 568, height: 320 })
    await expectHittableInsideViewport(scorePosition)
    await expectHittableInsideViewport(play)
    await expectHittableInsideViewport(listening)
    await expectHittableInsideViewport(targetMix)
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
  const resumeSong = page.getByRole('button', { name: /^midnight-drums\.wav/ })
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
 * elements rather than decoded PCM. The estimate is computed against the
 * AudioContext's OWN sample rate, which is the machine's, not ours — CI runs
 * at 44.1 kHz where this first landed in buffered mode at a length that
 * streamed locally at 48 kHz. Six stems at three minutes clears the budget
 * from 32 kHz upwards, so the path under test is the one that runs.
 */
const STREAMED_SONG_SECONDS = 180
const STREAMED_SONG_STEMS = 6

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
    await seedCompletedFullBandSong(page, sessionId, STREAMED_SONG_SECONDS)
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
    expect(after.seeks.length).toBeGreaterThanOrEqual(STREAMED_SONG_STEMS)
    expect(after.seeks.length).toBeLessThanOrEqual(STREAMED_SONG_STEMS * 2)
    for (const seek of after.seeks) expect(seek).toBeCloseTo(target, 0)
    // And each stem was moved while stopped and started again, rather than
    // seeked mid-flight — the sequence the fix is. A browser fast enough to
    // hide the stall (this one) still shows the difference here.
    expect(after.restarts).toBeGreaterThanOrEqual(STREAMED_SONG_STEMS)

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
