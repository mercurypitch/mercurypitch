// Drum Night smoke coverage protects silent first paint and the live-kit boundary.
// ============================================================

import type { Locator, Page } from '@playwright/test'
import { expect, test } from '@playwright/test'
import { Buffer } from 'node:buffer'

const DRUM_SESSION_MIDI = Buffer.from([
  0x4d, 0x54, 0x68, 0x64, 0x00, 0x00, 0x00, 0x06, 0x00, 0x00, 0x00, 0x01, 0x00,
  0x60, 0x4d, 0x54, 0x72, 0x6b, 0x00, 0x00, 0x00, 0x31, 0x00, 0xff, 0x03, 0x0a,
  0x45, 0x32, 0x45, 0x20, 0x50, 0x6f, 0x63, 0x6b, 0x65, 0x74, 0x00, 0xff, 0x51,
  0x03, 0x07, 0xa1, 0x20, 0x00, 0xff, 0x58, 0x04, 0x04, 0x02, 0x18, 0x08, 0x00,
  0x99, 0x24, 0x64, 0x60, 0x89, 0x24, 0x00, 0x60, 0x99, 0x26, 0x70, 0x60, 0x89,
  0x26, 0x00, 0x00, 0xff, 0x2f, 0x00,
])

const DRUM_PLAY_ALONG_SECONDS = 3

function midiTrack(bytes: readonly number[]): Buffer {
  const header = Buffer.alloc(8)
  header.write('MTrk', 0)
  header.writeUInt32BE(bytes.length, 4)
  return Buffer.concat([header, Buffer.from(bytes)])
}

/** Format-1 MIDI with one pitched bass guide and one channel-10 drum part. */
function createMixedDrumSessionMidi(): Buffer {
  const pitchedName = [...Buffer.from('Bass Guide', 'ascii')]
  const drumName = [...Buffer.from('Drum Part', 'ascii')]
  const pitchedTrack = midiTrack([
    0x00,
    0xff,
    0x03,
    pitchedName.length,
    ...pitchedName,
    0x00,
    0xff,
    0x51,
    0x03,
    0x07,
    0xa1,
    0x20,
    0x00,
    0xff,
    0x58,
    0x04,
    0x04,
    0x02,
    0x18,
    0x08,
    0x00,
    0xc0,
    0x21,
    0x00,
    0x90,
    0x30,
    0x60,
    0x60,
    0x80,
    0x30,
    0x00,
    0x00,
    0x90,
    0x34,
    0x60,
    0x60,
    0x80,
    0x34,
    0x00,
    0x00,
    0xff,
    0x2f,
    0x00,
  ])
  const drumTrack = midiTrack([
    0x00,
    0xff,
    0x03,
    drumName.length,
    ...drumName,
    0x00,
    0x99,
    0x24,
    0x64,
    0x60,
    0x89,
    0x24,
    0x00,
    0x00,
    0x99,
    0x2a,
    0x50,
    0x60,
    0x89,
    0x2a,
    0x00,
    0x00,
    0x99,
    0x26,
    0x70,
    0x60,
    0x89,
    0x26,
    0x00,
    0x00,
    0xff,
    0x2f,
    0x00,
  ])
  return Buffer.concat([
    Buffer.from([
      0x4d, 0x54, 0x68, 0x64, 0x00, 0x00, 0x00, 0x06, 0x00, 0x01, 0x00, 0x02,
      0x00, 0x60,
    ]),
    pitchedTrack,
    drumTrack,
  ])
}

function createDrumPlayAlongWav(frequencyHz: number): Buffer {
  const sampleRate = 8_000
  const sampleCount = sampleRate * DRUM_PLAY_ALONG_SECONDS
  const wav = Buffer.alloc(44 + sampleCount * 2)
  wav.write('RIFF', 0)
  wav.writeUInt32LE(wav.length - 8, 4)
  wav.write('WAVE', 8)
  wav.write('fmt ', 12)
  wav.writeUInt32LE(16, 16)
  wav.writeUInt16LE(1, 20)
  wav.writeUInt16LE(1, 22)
  wav.writeUInt32LE(sampleRate, 24)
  wav.writeUInt32LE(sampleRate * 2, 28)
  wav.writeUInt16LE(2, 32)
  wav.writeUInt16LE(16, 34)
  wav.write('data', 36)
  wav.writeUInt32LE(sampleCount * 2, 40)

  for (let sample = 0; sample < sampleCount; sample += 1) {
    const seconds = sample / sampleRate
    const fade = Math.min(
      1,
      seconds * 20,
      (DRUM_PLAY_ALONG_SECONDS - seconds) * 20,
    )
    const amplitude = Math.sin(seconds * frequencyHz * Math.PI * 2) * fade
    wav.writeInt16LE(Math.round(amplitude * 3_000), 44 + sample * 2)
  }
  return wav
}

async function instrumentFirstPaint(
  page: import('@playwright/test').Page,
): Promise<void> {
  await page.addInitScript(() => {
    const trackedWindow = window as unknown as {
      __drumNightAudioContexts: number
      __drumNightDatabaseOpens: number
      __drumNightFetches: number
      __drumNightIntervals: number
      __drumNightMidiRequests: number
      __drumNightMicRequests: number
      __drumNightOscillators: number
      __drumNightAnimationFrames: number
      __drumNightTimeouts: number
      __drumNightWorkers: number
      AudioContext?: typeof AudioContext
      webkitAudioContext?: typeof AudioContext
    }
    trackedWindow.__drumNightAudioContexts = 0
    trackedWindow.__drumNightDatabaseOpens = 0
    trackedWindow.__drumNightFetches = 0
    trackedWindow.__drumNightIntervals = 0
    trackedWindow.__drumNightMidiRequests = 0
    trackedWindow.__drumNightMicRequests = 0
    trackedWindow.__drumNightOscillators = 0
    trackedWindow.__drumNightAnimationFrames = 0
    trackedWindow.__drumNightTimeouts = 0
    trackedWindow.__drumNightWorkers = 0

    const nativeFetch = window.fetch.bind(window)
    window.fetch = ((...args: Parameters<typeof fetch>) => {
      trackedWindow.__drumNightFetches += 1
      return nativeFetch(...args)
    }) as typeof fetch

    const nativeSetTimeout = window.setTimeout.bind(window)
    window.setTimeout = ((
      handler: TimerHandler,
      timeout?: number,
      ...args: unknown[]
    ) => {
      trackedWindow.__drumNightTimeouts += 1
      return nativeSetTimeout(handler, timeout, ...args)
    }) as typeof window.setTimeout

    const nativeSetInterval = window.setInterval.bind(window)
    window.setInterval = ((
      handler: TimerHandler,
      timeout?: number,
      ...args: unknown[]
    ) => {
      trackedWindow.__drumNightIntervals += 1
      return nativeSetInterval(handler, timeout, ...args)
    }) as typeof window.setInterval

    const nativeRequestAnimationFrame =
      window.requestAnimationFrame.bind(window)
    window.requestAnimationFrame = ((callback: FrameRequestCallback) => {
      trackedWindow.__drumNightAnimationFrames += 1
      return nativeRequestAnimationFrame(callback)
    }) as typeof window.requestAnimationFrame

    const NativeAudioContext =
      trackedWindow.AudioContext ?? trackedWindow.webkitAudioContext
    if (NativeAudioContext !== undefined) {
      const TrackedAudioContext = new Proxy(NativeAudioContext, {
        construct(target, args, newTarget) {
          trackedWindow.__drumNightAudioContexts += 1
          const context = Reflect.construct(
            target,
            args,
            newTarget,
          ) as AudioContext
          const nativeCreateOscillator = context.createOscillator.bind(context)
          context.createOscillator = () => {
            trackedWindow.__drumNightOscillators += 1
            return nativeCreateOscillator()
          }
          return context
        },
      })
      trackedWindow.AudioContext = TrackedAudioContext
      trackedWindow.webkitAudioContext = TrackedAudioContext
    }

    const NativeWorker = window.Worker
    window.Worker = new Proxy(NativeWorker, {
      construct(target, args, newTarget) {
        trackedWindow.__drumNightWorkers += 1
        return Reflect.construct(target, args, newTarget)
      },
    })

    const nativeDatabaseOpen = indexedDB.open.bind(indexedDB)
    indexedDB.open = ((name: string, version?: number) => {
      trackedWindow.__drumNightDatabaseOpens += 1
      return version === undefined
        ? nativeDatabaseOpen(name)
        : nativeDatabaseOpen(name, version)
    }) as IDBFactory['open']

    Object.defineProperty(navigator, 'requestMIDIAccess', {
      configurable: true,
      value: () => {
        trackedWindow.__drumNightMidiRequests += 1
        return Promise.reject(new Error('Unexpected MIDI request'))
      },
    })
    if (navigator.mediaDevices !== undefined) {
      Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
        configurable: true,
        value: () => {
          trackedWindow.__drumNightMicRequests += 1
          return Promise.reject(new Error('Unexpected microphone request'))
        },
      })
    }
  })
}

async function boundaryCounts(
  page: import('@playwright/test').Page,
): Promise<Record<string, number>> {
  return page.evaluate(() => {
    const trackedWindow = window as unknown as Record<string, number>
    return {
      audio: trackedWindow.__drumNightAudioContexts,
      database: trackedWindow.__drumNightDatabaseOpens,
      fetch: trackedWindow.__drumNightFetches,
      interval: trackedWindow.__drumNightIntervals,
      midi: trackedWindow.__drumNightMidiRequests,
      mic: trackedWindow.__drumNightMicRequests,
      oscillator: trackedWindow.__drumNightOscillators,
      raf: trackedWindow.__drumNightAnimationFrames,
      timeout: trackedWindow.__drumNightTimeouts,
      workers: trackedWindow.__drumNightWorkers,
    }
  })
}

async function instrumentStemPayloadReads(
  page: import('@playwright/test').Page,
): Promise<void> {
  await page.addInitScript(() => {
    const trackedWindow = window as unknown as {
      __drumNightStemPayloadReads: number
    }
    trackedWindow.__drumNightStemPayloadReads = 0

    const isStemPayloadIndex = (index: IDBIndex): boolean =>
      index.objectStore.name === 'uvrStemBlobs' &&
      index.name === '[sessionId+stemType+createdAt]'

    const nativeOpenCursor = IDBIndex.prototype.openCursor
    IDBIndex.prototype.openCursor = function (...args) {
      if (isStemPayloadIndex(this)) {
        trackedWindow.__drumNightStemPayloadReads += 1
      }
      return nativeOpenCursor.apply(this, args)
    }

    // Chromium's current IndexedDB implementation lets Dexie satisfy a
    // reverse-first value query with getAll({ count: 1, direction: 'prev' }).
    // Older engines take the openCursor branch above, so cover both without
    // counting the manifest's metadata-only IDBIndex.count calls.
    const nativeGetAll = IDBIndex.prototype.getAll
    IDBIndex.prototype.getAll = function (...args) {
      if (isStemPayloadIndex(this)) {
        trackedWindow.__drumNightStemPayloadReads += 1
      }
      return nativeGetAll.apply(this, args)
    }
  })
}

async function stemPayloadReads(
  page: import('@playwright/test').Page,
): Promise<number> {
  return page.evaluate(
    () =>
      (
        window as unknown as {
          __drumNightStemPayloadReads: number
        }
      ).__drumNightStemPayloadReads,
  )
}

async function initializeDrumNightDatabase(
  page: import('@playwright/test').Page,
): Promise<void> {
  await page.goto('/drum-night?drawer=songs', {
    waitUntil: 'domcontentloaded',
  })
  const drawer = page.getByRole('region', { name: 'Bring a song' })
  await expect(drawer).toBeVisible()
  const loadSavedSongs = drawer.getByRole('button', {
    name: 'Load saved songs',
  })
  await expect(loadSavedSongs).toBeVisible()
  await loadSavedSongs.click()
  await expect(drawer.getByText('No prepared backing yet')).toBeVisible()
}

async function seedDrumPlayAlongSession(
  page: import('@playwright/test').Page,
  options: {
    sessionId: string
    fileName: string
    mix: 'two-stem' | 'parts'
  },
): Promise<void> {
  const stemWav = createDrumPlayAlongWav(options.mix === 'two-stem' ? 110 : 165)
  const stemKinds =
    options.mix === 'two-stem'
      ? (['vocal', 'instrumental'] as const)
      : ([
          'vocal',
          'instrumental',
          'drums',
          'bass',
          'guitar',
          'piano',
          'other',
        ] as const)

  await page.evaluate(
    async ({ durationSeconds, fileName, sessionId, stemBase64, stemKinds }) => {
      const stemData = Uint8Array.from(atob(stemBase64), (character) =>
        character.charCodeAt(0),
      ).buffer
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
            id: `${sessionId}-record`,
            appSessionId: sessionId,
            userId: 'drum-night-e2e',
            status: 'completed',
            progress: 100,
            originalFileName: fileName,
            originalFileSize: stemData.byteLength,
            originalFileType: 'audio/wav',
            processingMode: 'local',
            provider: 'local',
            ...(stemKinds.some((kind) => kind === 'vocal')
              ? { vocalStemId: `${sessionId}-vocal` }
              : {}),
            ...(stemKinds.some((kind) => kind === 'instrumental')
              ? { instrumentalStemId: `${sessionId}-instrumental` }
              : {}),
            stemMetaJson: JSON.stringify(
              Object.fromEntries(
                stemKinds.map((kind) => [
                  kind,
                  {
                    duration: durationSeconds,
                    size: stemData.byteLength,
                  },
                ]),
              ),
            ),
            appCreatedAt: Date.now(),
            createdAt: now,
            updatedAt: now,
          })
          for (const kind of stemKinds) {
            transaction.objectStore('uvrStemBlobs').put({
              id: `${sessionId}-${kind}`,
              sessionId,
              stemType: kind,
              mimeType: 'audio/wav',
              data: stemData,
              size: stemData.byteLength,
              fileName: `${fileName}-${kind}.wav`,
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
      durationSeconds: DRUM_PLAY_ALONG_SECONDS,
      fileName: options.fileName,
      sessionId: options.sessionId,
      stemBase64: stemWav.toString('base64'),
      stemKinds: [...stemKinds],
    },
  )
}

async function scoreGeometry(page: import('@playwright/test').Page): Promise<{
  readonly panelWidth: number
  readonly scoreWidth: number
  readonly viewportWidth: number
}> {
  const viewport = page.getByLabel('Windowed percussion score')
  await expect(viewport).toBeVisible()
  return viewport.evaluate((element) => {
    const panel = element.closest('figure')
    const score = element.querySelector('svg')
    if (panel === null || score === null) {
      throw new Error('Score viewport is missing its figure or SVG')
    }
    return {
      panelWidth: panel.getBoundingClientRect().width,
      scoreWidth: score.getBoundingClientRect().width,
      viewportWidth: element.getBoundingClientRect().width,
    }
  })
}

async function rangePoint(
  slider: import('@playwright/test').Locator,
  fraction: number,
): Promise<{ readonly x: number; readonly y: number }> {
  const bounds = await slider.boundingBox()
  if (bounds === null) throw new Error('Timeline slider has no pointer bounds')
  const thumbInset = Math.min(8, bounds.width / 4)
  return {
    x:
      bounds.x +
      thumbInset +
      Math.max(0, bounds.width - thumbInset * 2) * fraction,
    y: bounds.y + bounds.height / 2,
  }
}

async function clickWithRealMouse(page: Page, target: Locator): Promise<void> {
  await target.scrollIntoViewIfNeeded()
  const bounds = await target.boundingBox()
  if (bounds === null) throw new Error('Pointer target has no visible bounds')
  await page.mouse.click(
    bounds.x + bounds.width / 2,
    bounds.y + bounds.height / 2,
  )
}

async function loadedDrumPersistenceAssets(page: Page): Promise<string[]> {
  const resources = await page.evaluate(() =>
    performance
      .getEntriesByType('resource')
      .map((entry) => entry.name)
      .filter((name) => name.includes('/assets/')),
  )
  return resources.filter((name) =>
    /\/(?:drum-project-controller|drum-library-service|drum-take-history-controller|vendor-db)-/.test(
      name,
    ),
  )
}

async function openDrumGrooveRack(page: Page): Promise<Locator> {
  const editor = page.getByTestId('drum-groove-editor')
  if (await editor.isVisible()) return editor
  const trigger = page
    .getByRole('button', { name: 'Groove', exact: true })
    .filter({ visible: true })
    .first()
  await clickWithRealMouse(page, trigger)
  await expect(editor).toBeVisible()
  return editor
}

async function saveCurrentDrumProject(page: Page, name: string): Promise<void> {
  const editor = page.getByTestId('drum-groove-editor')
  await clickWithRealMouse(
    page,
    editor.getByRole('button', { name: 'Save project', exact: true }),
  )
  const library = page.getByTestId('drum-project-library')
  await expect(library).toBeVisible()
  const nameInput = library.getByRole('textbox', { name: 'Project name' })
  await expect(nameInput).toBeFocused()
  await nameInput.fill(name)
  await clickWithRealMouse(
    page,
    library.getByRole('button', { name: 'Save on this device' }),
  )
  await expect(library.getByRole('heading', { name })).toBeVisible()
  await expect(
    library.getByText('Saved on this device', { exact: true }),
  ).toBeVisible()
}

interface DrumProjectProbe {
  readonly revision: number
  readonly title: string
  readonly selectedVariantId: string
  readonly tempoBpm: number
  readonly countInBeats: number
  readonly clickEnabled: boolean
  readonly loopRange: {
    readonly startBeat: number
    readonly endBeat: number
  } | null
  readonly hats: { readonly level: number; readonly muted: boolean }
  readonly variants: Record<
    string,
    {
      readonly swing: number
      readonly density: number
      readonly tomSteps: readonly number[]
    }
  >
}

async function readDrumProjectProbe(
  page: Page,
  title: string,
): Promise<DrumProjectProbe | null> {
  return page.evaluate(
    async (requestedTitle): Promise<DrumProjectProbe | null> =>
      new Promise((resolve, reject) => {
        const open = window.indexedDB.open('MercuryPitchDB')
        open.onerror = () => reject(open.error)
        open.onsuccess = () => {
          const database = open.result
          if (!database.objectStoreNames.contains('drumProjects')) {
            database.close()
            resolve(null)
            return
          }
          const transaction = database.transaction('drumProjects', 'readonly')
          const read = transaction.objectStore('drumProjects').getAll()
          read.onerror = () => {
            database.close()
            reject(read.error)
          }
          read.onsuccess = () => {
            type PersistedProject = {
              readonly revision: number
              readonly title: string
              readonly selectedVariantId: string
              readonly tempoBpm: number
              readonly countInBeats: number
              readonly clickEnabled: boolean
              readonly loopRange: {
                readonly startBeat: number
                readonly endBeat: number
              } | null
              readonly authoredFamilyMix: Record<
                string,
                { readonly level: number; readonly muted: boolean }
              >
              readonly variants: Record<
                string,
                {
                  readonly swing: number
                  readonly density: number
                  readonly hits: readonly {
                    readonly gmKey: number
                    readonly stepIndex: number
                  }[]
                }
              >
            }
            const row = (
              read.result as readonly { readonly project?: PersistedProject }[]
            ).find((candidate) => candidate.project?.title === requestedTitle)
            const project = row?.project
            if (project === undefined) {
              database.close()
              resolve(null)
              return
            }
            const variants = Object.fromEntries(
              Object.entries(project.variants).map(([id, variant]) => [
                id,
                {
                  swing: variant.swing,
                  density: variant.density,
                  tomSteps: variant.hits
                    .filter((hit) => hit.gmKey === 48)
                    .map((hit) => hit.stepIndex)
                    .sort((left, right) => left - right),
                },
              ]),
            )
            database.close()
            resolve({
              revision: project.revision,
              title: project.title,
              selectedVariantId: project.selectedVariantId,
              tempoBpm: project.tempoBpm,
              countInBeats: project.countInBeats,
              clickEnabled: project.clickEnabled,
              loopRange: project.loopRange,
              hats: project.authoredFamilyMix.hats!,
              variants,
            })
          }
        }
      }),
    title,
  )
}

async function instrumentTakeWriteFailure(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const trackedWindow = window as unknown as {
      __drumNightFailTakeWrites: number
    }
    trackedWindow.__drumNightFailTakeWrites = 0
    const nativeAdd = IDBObjectStore.prototype.add
    IDBObjectStore.prototype.add = function (...args) {
      if (
        this.name === 'drumTakeSummaries' &&
        trackedWindow.__drumNightFailTakeWrites > 0
      ) {
        trackedWindow.__drumNightFailTakeWrites -= 1
        throw new DOMException(
          'Injected take write failure',
          'QuotaExceededError',
        )
      }
      return nativeAdd.apply(this, args)
    }
  })
}

async function failNextTakeWrite(page: Page): Promise<void> {
  await page.evaluate(() => {
    ;(
      window as unknown as {
        __drumNightFailTakeWrites: number
      }
    ).__drumNightFailTakeWrites += 1
  })
}

async function instrumentProjectWriteFailure(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const trackedWindow = window as unknown as {
      __drumNightFailProjectWrites: number
    }
    trackedWindow.__drumNightFailProjectWrites = 0
    const nativePut = IDBObjectStore.prototype.put
    IDBObjectStore.prototype.put = function (...args) {
      if (
        this.name === 'drumProjects' &&
        trackedWindow.__drumNightFailProjectWrites > 0
      ) {
        trackedWindow.__drumNightFailProjectWrites -= 1
        throw new DOMException(
          'Injected project write failure',
          'QuotaExceededError',
        )
      }
      return nativePut.apply(this, args)
    }
  })
}

async function failNextProjectWrite(page: Page): Promise<void> {
  await page.evaluate(() => {
    ;(
      window as unknown as {
        __drumNightFailProjectWrites: number
      }
    ).__drumNightFailProjectWrites += 1
  })
}

interface ScopedDrumStorageProbe {
  readonly projects: number
  readonly takes: number
  readonly unrelatedSettingPresent: boolean
}

async function seedScopedEraseSentinels(page: Page): Promise<void> {
  await page.evaluate(
    async (): Promise<void> =>
      new Promise((resolve, reject) => {
        const open = window.indexedDB.open('MercuryPitchDB')
        open.onerror = () => reject(open.error)
        open.onsuccess = () => {
          const database = open.result
          const transaction = database.transaction(
            ['drumTakeSummaries', 'userSettings'],
            'readwrite',
          )
          const timestamp = '2026-08-26T12:00:00.000Z'
          transaction.objectStore('drumTakeSummaries').put({
            id: 'e2e-drum-summary-sentinel',
            createdAt: timestamp,
            updatedAt: timestamp,
            projectId: 'e2e-drum-project-sentinel',
            completedAt: timestamp,
            summary: { schemaVersion: 99 },
          })
          transaction.objectStore('userSettings').put({
            id: 'e2e-unrelated-setting',
            createdAt: timestamp,
            updatedAt: timestamp,
            userId: 'e2e-user',
            key: 'e2e-unrelated',
            value: JSON.stringify({ retained: true }),
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
      }),
  )
  await page.evaluate(() => {
    localStorage.setItem('mp.drumNight.kit.v1', 'classic-gm')
    localStorage.setItem('pitchperfect_drum_background', 'drum-tape-room')
    localStorage.setItem(
      'mp.drumNight.midiMapping.v2',
      JSON.stringify({ version: 2, profiles: [] }),
    )
  })
}

async function readScopedDrumStorageProbe(
  page: Page,
): Promise<ScopedDrumStorageProbe> {
  return page.evaluate(
    async (): Promise<ScopedDrumStorageProbe> =>
      new Promise((resolve, reject) => {
        const open = window.indexedDB.open('MercuryPitchDB')
        open.onerror = () => reject(open.error)
        open.onsuccess = () => {
          const database = open.result
          const transaction = database.transaction(
            ['drumProjects', 'drumTakeSummaries', 'userSettings'],
            'readonly',
          )
          const projects = transaction.objectStore('drumProjects').count()
          const takes = transaction.objectStore('drumTakeSummaries').count()
          const unrelated = transaction
            .objectStore('userSettings')
            .get('e2e-unrelated-setting')
          transaction.oncomplete = () => {
            database.close()
            resolve({
              projects: projects.result,
              takes: takes.result,
              unrelatedSettingPresent: unrelated.result !== undefined,
            })
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
      }),
  )
}

test('lists Drum Night with the Home rooms and opens its doors @smoke', async ({
  page,
}) => {
  await page.addInitScript(() => {
    ;(window as unknown as { E2E_TEST_MODE: boolean }).E2E_TEST_MODE = true
    localStorage.setItem('pitchperfect_welcome_version', '1')
    localStorage.setItem('pitchperfect_onboarding_done', '1')
    localStorage.setItem('pitchperfect_focus_mode', 'false')
    localStorage.setItem(
      'mp.consent.v1',
      JSON.stringify({ status: 'denied', at: Date.now(), implicit: false }),
    )
  })
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('/#/home', { waitUntil: 'domcontentloaded' })

  const destinationOrder = await page
    .locator('[data-destination]')
    .evaluateAll((destinations) =>
      destinations.map((destination) =>
        destination.getAttribute('data-destination'),
      ),
    )
  expect(destinationOrder).toEqual([
    'practice',
    'karaoke',
    'pianoNight',
    'guitarNight',
    'drumNight',
    'exercises',
    'earLab',
    'analysis',
    'jam',
    'mystery',
  ])

  const drumCard = page.locator('[data-destination="drumNight"]')
  await expect(drumCard).toHaveAttribute('href', '/drum-night')

  const desktopDoor = page.getByRole('link', {
    name: 'Drums — open Drum Night room',
  })
  await expect(desktopDoor).toHaveAttribute('href', '/drum-night')
  await desktopDoor.click()
  await expect.poll(() => new URL(page.url()).pathname).toBe('/drum-night')
  await expect(page.getByTestId('drum-night-shell')).toBeVisible()

  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/#/home', { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'More tabs' }).click()
  const mobileDoor = page
    .getByRole('dialog', { name: 'More tabs' })
    .getByRole('link', { name: 'Drum Night — open standalone room' })
  await expect(mobileDoor).toBeVisible()
  await mobileDoor.click()
  await expect(page).toHaveURL(/\/drum-night$/)
  await expect(page.getByTestId('drum-night-shell')).toBeVisible()
})

test('opens the standalone Pocket Console without activating runtime capabilities @smoke', async ({
  page,
}) => {
  const pageErrors: Error[] = []
  page.on('pageerror', (error) => pageErrors.push(error))
  await instrumentFirstPaint(page)

  const response = await page.goto('/drum-night', {
    waitUntil: 'domcontentloaded',
  })

  expect(response?.ok()).toBe(true)
  await expect(page).toHaveTitle(/Drum Night/)
  await expect(page.getByTestId('drum-night-shell')).toBeVisible()
  await expect(page.getByTestId('drum-night-pocket-view')).toBeVisible()
  await expect(page.locator('#app-tabs')).toHaveCount(0)
  await expect(
    page
      .getByRole('status')
      .filter({ hasText: 'Audio, samples, and MIDI stay off' }),
  ).toBeVisible()
  await expect(page.getByText('MIDI not connected')).toBeVisible()
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    'content',
    'noindex, nofollow',
  )
  expect(await boundaryCounts(page)).toEqual({
    audio: 0,
    database: 0,
    fetch: 0,
    interval: 0,
    midi: 0,
    mic: 0,
    oscillator: 0,
    raf: 0,
    timeout: 0,
    workers: 0,
  })
  expect(pageErrors).toEqual([])
})

test('switches and closes the desktop rail workbench with URL and aria state in sync @smoke', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/drum-night', { waitUntil: 'domcontentloaded' })

  const rail = page.getByRole('complementary', {
    name: 'Drum Night sections',
  })
  const learn = rail.getByRole('button', { name: 'Learn', exact: true })
  const songs = rail.getByRole('button', { name: 'Songs', exact: true })
  const workbench = page.locator('#drum-workbench')

  await expect(learn).toHaveAttribute('aria-expanded', 'false')
  await expect(songs).toHaveAttribute('aria-expanded', 'false')

  await learn.click()
  await expect(
    page.getByRole('region', { name: 'Build the first pocket' }),
  ).toBeVisible()
  await expect(workbench).toBeVisible()
  await expect(learn).toHaveAttribute('aria-expanded', 'true')
  await expect(songs).toHaveAttribute('aria-expanded', 'false')
  await expect(page).toHaveURL(/drawer=learn/)

  await songs.click()
  await expect(page.getByRole('region', { name: 'Bring a song' })).toBeVisible()
  await expect(workbench).toBeVisible()
  await expect(learn).toHaveAttribute('aria-expanded', 'false')
  await expect(songs).toHaveAttribute('aria-expanded', 'true')
  await expect(page).toHaveURL(/drawer=songs/)

  await songs.click()
  await expect(workbench).toHaveAttribute('aria-hidden', 'true')
  await expect(workbench).toHaveAttribute('inert', '')
  await expect(page.getByTestId('drum-night-shell')).toHaveAttribute(
    'data-drawer-open',
    'false',
  )
  await expect(songs).toHaveAttribute('aria-expanded', 'false')
  await expect(page).not.toHaveURL(/drawer=/)
})

test('keeps the Songs play-along panel full-width without responsive overflow @smoke', async ({
  page,
}, testInfo) => {
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
    { width: 844, height: 390 },
  ]) {
    await page.setViewportSize(viewport)
    await page.goto('/drum-night?drawer=songs', {
      waitUntil: 'domcontentloaded',
    })
    const workbench = page.locator('#drum-workbench')
    await expect(workbench).toBeVisible()
    await expect(
      workbench.getByRole('heading', {
        name: 'Bring the band. Keep the drums yours.',
      }),
    ).toBeVisible()

    await workbench.evaluate(async (element) => {
      await Promise.all(
        element
          .getAnimations()
          .map((animation) => animation.finished.catch(() => undefined)),
      )
    })

    const geometry = await workbench.evaluate((element) => {
      const heading = [...element.querySelectorAll('h2')].find(
        (candidate) =>
          candidate.textContent?.trim() ===
          'Bring the band. Keep the drums yours.',
      )
      const panel = heading?.closest('section')
      const workspace = panel?.parentElement
      const sessionHeader = element.closest('main')?.querySelector('header')
      const workbenchBar = element.firstElementChild
      const closeButton = element.querySelector<HTMLButtonElement>(
        'button[aria-label="Close rack drawer"]',
      )
      const workbenchRect = element.getBoundingClientRect()
      const panelRect = panel?.getBoundingClientRect()
      const sessionHeaderRect = sessionHeader?.getBoundingClientRect()
      const workbenchBarRect = workbenchBar?.getBoundingClientRect()
      const closeRect = closeButton?.getBoundingClientRect()
      const closeCenterHit =
        closeButton !== null &&
        closeButton !== undefined &&
        closeRect !== undefined &&
        closeButton.contains(
          document.elementFromPoint(
            closeRect.left + closeRect.width / 2,
            closeRect.top + closeRect.height / 2,
          ),
        )
      return {
        closeCenterHit,
        closeTop: closeRect?.top ?? Number.NEGATIVE_INFINITY,
        documentClientWidth: document.documentElement.clientWidth,
        documentScrollWidth: document.documentElement.scrollWidth,
        panelLeft: panelRect?.left ?? Number.NEGATIVE_INFINITY,
        panelRight: panelRect?.right ?? Number.POSITIVE_INFINITY,
        panelWidth: panelRect?.width ?? 0,
        panelClientWidth: panel?.clientWidth ?? 0,
        panelScrollWidth: panel?.scrollWidth ?? 0,
        viewportHeight: innerHeight,
        viewportWidth: innerWidth,
        sessionHeaderBottom:
          sessionHeaderRect?.bottom ?? Number.POSITIVE_INFINITY,
        workbenchBarTop: workbenchBarRect?.top ?? Number.NEGATIVE_INFINITY,
        workbenchBottom: workbenchRect.bottom,
        workbenchClientWidth: element.clientWidth,
        workbenchLeft: workbenchRect.left,
        workbenchRight: workbenchRect.right,
        workbenchScrollWidth: element.scrollWidth,
        workbenchTop: workbenchRect.top,
        workspaceClientWidth: workspace?.clientWidth ?? 0,
        workspaceScrollWidth: workspace?.scrollWidth ?? 0,
      }
    })

    expect(geometry.documentScrollWidth, JSON.stringify(viewport)).toBe(
      geometry.documentClientWidth,
    )
    expect(geometry.workbenchScrollWidth, JSON.stringify(viewport)).toBe(
      geometry.workbenchClientWidth,
    )
    expect(geometry.workspaceScrollWidth, JSON.stringify(viewport)).toBe(
      geometry.workspaceClientWidth,
    )
    expect(geometry.panelScrollWidth, JSON.stringify(viewport)).toBe(
      geometry.panelClientWidth,
    )
    expect(
      geometry.workspaceClientWidth - geometry.panelWidth,
      JSON.stringify(viewport),
    ).toBeLessThanOrEqual(48)
    expect(
      geometry.panelWidth,
      JSON.stringify(viewport),
    ).toBeGreaterThanOrEqual(geometry.workspaceClientWidth * 0.9)
    expect(
      geometry.workbenchLeft,
      JSON.stringify(viewport),
    ).toBeGreaterThanOrEqual(0)
    expect(
      geometry.workbenchRight,
      JSON.stringify(viewport),
    ).toBeLessThanOrEqual(geometry.viewportWidth)
    expect(geometry.panelLeft, JSON.stringify(viewport)).toBeGreaterThanOrEqual(
      geometry.workbenchLeft,
    )
    expect(geometry.panelRight, JSON.stringify(viewport)).toBeLessThanOrEqual(
      geometry.workbenchRight,
    )
    expect(geometry.workbenchTop, JSON.stringify(viewport)).toBeLessThan(
      geometry.viewportHeight,
    )
    expect(geometry.workbenchBottom, JSON.stringify(viewport)).toBeGreaterThan(
      0,
    )
    expect(geometry.closeCenterHit, JSON.stringify(viewport)).toBe(true)
    expect(geometry.closeTop, JSON.stringify(viewport)).toBeGreaterThanOrEqual(
      0,
    )
    if (viewport.width === 844 && viewport.height === 390) {
      expect(
        geometry.workbenchBarTop,
        JSON.stringify(viewport),
      ).toBeGreaterThanOrEqual(geometry.sessionHeaderBottom)
    }

    await page.screenshot({
      path: testInfo.outputPath(
        `drum-night-songs-${viewport.width}x${viewport.height}.png`,
      ),
    })
  }
})

test('plays all six photographed Pocket zones with a real pointer across room sizes @smoke', async ({
  page,
}) => {
  await instrumentFirstPaint(page)
  const padNames = [
    'Closed hi-hat',
    'Acoustic snare',
    'Bass drum',
    'Hi-mid tom',
    'Ride cymbal',
    'Crash cymbal',
  ] as const

  for (const viewport of [
    { width: 844, height: 390 },
    { width: 390, height: 844 },
    { width: 320, height: 568 },
  ]) {
    await page.setViewportSize(viewport)
    await page.goto('/drum-night', { waitUntil: 'domcontentloaded' })

    const touchKit = page.getByRole('group', { name: 'Touch drum pads' })
    if (viewport.width <= 720) {
      await expect(touchKit).toBeVisible()
      await expect(touchKit.getByRole('button')).toHaveCount(6)
    } else {
      await expect(touchKit).toHaveCount(0)
    }

    const photoKit = page.locator('[aria-label="Pocket Console drum kit"]')
    await expect(photoKit).toBeVisible()
    await expect(photoKit.getByRole('button')).toHaveCount(6)

    for (const padName of padNames) {
      const pad = photoKit.getByRole('button', {
        name: new RegExp(`^${padName}, key`),
      })
      const bounds = await pad.boundingBox()
      if (bounds === null) {
        throw new Error(
          `${padName} has no pointer bounds at ${viewport.width}px`,
        )
      }
      expect(
        bounds.width,
        `${padName} at ${viewport.width}px`,
      ).toBeGreaterThanOrEqual(44)
      expect(
        bounds.height,
        `${padName} at ${viewport.width}px`,
      ).toBeGreaterThanOrEqual(44)
      await page.mouse.click(
        bounds.x + bounds.width / 2,
        bounds.y + bounds.height / 2,
      )
      expect(await pad.getAttribute('class')).toContain('isHit')
    }

    await expect
      .poll(async () => (await boundaryCounts(page)).audio)
      .toBeGreaterThan(0)
    await page.getByRole('button', { name: /^Open drum input setup:/ }).click()
    const input = page.getByRole('dialog', { name: 'Drum input' })
    await expect(input.getByText(/Crash cymbal · \d+ · touch/)).toBeVisible()
    await input.getByRole('button', { name: 'Close input details' }).click()
  }
})

test('plays a real prepared groove and changes its authored variation @smoke', async ({
  page,
}) => {
  await instrumentFirstPaint(page)
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/drum-night', { waitUntil: 'domcontentloaded' })

  await page
    .getByRole('button', { name: /Groove/ })
    .filter({ visible: true })
    .first()
    .click()
  const grooveDrawer = page.getByRole('region', { name: 'Shape the groove' })
  // Both the Feel panel and the pattern library carry style buttons named
  // like variations, so this scopes to the authored-variation rail.
  const variationRail = grooveDrawer.getByRole('group', {
    name: 'Prepared groove variation',
  })
  await variationRail.getByRole('button', { name: 'Funk' }).click()
  await expect(
    variationRail.getByRole('button', { name: 'Funk' }),
  ).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByTestId('drum-night-shell')).toHaveAttribute(
    'data-click-enabled',
    'false',
  )
  expect((await boundaryCounts(page)).audio).toBe(0)
  await grooveDrawer.getByRole('button', { name: 'Close rack drawer' }).click()
  await expect(
    page.getByRole('button', {
      name: /^First Pocket — Funk Built-in groove/,
    }),
  ).toBeVisible()

  const countIn = page.getByRole('button', {
    name: 'Count-in: 4 audible beats',
  })
  await expect(countIn).toHaveAttribute('aria-pressed', 'true')
  await expect(
    page.getByRole('button', { name: 'Playback click: off' }),
  ).toHaveAttribute('aria-pressed', 'false')
  const pocketSnare = page
    .locator('[aria-label="Pocket Console drum kit"]')
    .getByRole('button', { name: /^Acoustic snare, key/i })
  const pocketSnareBounds = await pocketSnare.boundingBox()
  if (pocketSnareBounds === null) {
    throw new Error('Pocket snare cannot arm audio before the count-in test')
  }
  await page.mouse.click(
    pocketSnareBounds.x + pocketSnareBounds.width / 2,
    pocketSnareBounds.y + pocketSnareBounds.height / 2,
  )
  await expect
    .poll(async () => (await boundaryCounts(page)).oscillator)
    .toBeGreaterThan(0)
  const oscillatorBaseline = (await boundaryCounts(page)).oscillator
  await page
    .getByRole('button', { name: /^Play First Pocket — Funk take clock$/ })
    .filter({ visible: true })
    .click()

  await expect(page.getByTestId('drum-night-shell')).toHaveAttribute(
    'data-playing',
    'true',
  )
  await expect
    .poll(async () => (await boundaryCounts(page)).oscillator)
    .toBeGreaterThan(oscillatorBaseline)
  await expect(page.getByTestId('drum-night-shell')).toHaveAttribute(
    'data-click-enabled',
    'false',
  )
  await expect(
    page.getByRole('button', { name: /Take events Armed/ }),
  ).toHaveAttribute('aria-pressed', 'true')
})

test('lazy-opens a responsive Groove Rack without undersized or overflowing controls @smoke', async ({
  page,
}, testInfo) => {
  await instrumentFirstPaint(page)
  const editorResponses: string[] = []
  page.on('response', (response) => {
    if (/DrumGrooveEditor-[^/]+\.js(?:$|\?)/.test(response.url())) {
      editorResponses.push(response.url())
    }
  })

  for (const viewport of [
    { width: 1440, height: 900, visibleSteps: 16 },
    { width: 1280, height: 720, visibleSteps: 8 },
    { width: 768, height: 1024, visibleSteps: 8 },
    { width: 844, height: 390, visibleSteps: 8 },
    { width: 390, height: 844, visibleSteps: 4 },
    { width: 320, height: 568, visibleSteps: 4 },
  ]) {
    await page.setViewportSize(viewport)
    const responseCountBeforeNavigation = editorResponses.length
    await page.goto('/drum-night', { waitUntil: 'domcontentloaded' })

    const editor = page.getByTestId('drum-groove-editor')
    await expect(editor).toHaveCount(0)
    if (viewport.width === 1440) {
      expect(editorResponses).toHaveLength(responseCountBeforeNavigation)
    }
    expect((await boundaryCounts(page)).audio).toBe(0)

    await page
      .getByRole('button', { name: /Groove/ })
      .filter({ visible: true })
      .first()
      .click()

    await expect(editor).toBeVisible()
    await expect(editor).toHaveAttribute(
      'data-visible-step-count',
      String(viewport.visibleSteps),
    )
    await expect(
      editor.getByRole('grid', { name: /exact drum articulations/ }),
    ).toHaveAttribute('aria-colcount', String(viewport.visibleSteps + 1))
    if (viewport.width === 1440) {
      await expect
        .poll(() => editorResponses.length)
        .toBeGreaterThan(responseCountBeforeNavigation)
    }

    await page.locator('#drum-workbench').evaluate(async (element) => {
      await Promise.all(
        element
          .getAnimations()
          .map((animation) => animation.finished.catch(() => undefined)),
      )
    })

    const geometry = await editor.evaluate((element) => {
      const workbench = element.closest<HTMLElement>('#drum-workbench')
      const workbenchBar = workbench?.firstElementChild as
        | HTMLElement
        | undefined
      const closeButton = workbench?.querySelector<HTMLButtonElement>(
        'button[aria-label="Close rack drawer"]',
      )
      const sessionHeader = workbench?.closest('main')?.querySelector('header')
      const editorBounds = element.getBoundingClientRect()
      const closeBounds = closeButton?.getBoundingClientRect()
      const visibleButtons = [
        ...(workbench?.querySelectorAll('button') ?? []),
      ].filter((button) => {
        const bounds = button.getBoundingClientRect()
        const style = getComputedStyle(button)
        return (
          bounds.width > 0 &&
          bounds.height > 0 &&
          style.display !== 'none' &&
          style.visibility !== 'hidden'
        )
      })
      const undersizedButtons = visibleButtons.filter((button) => {
        const bounds = button.getBoundingClientRect()
        return Math.round(bounds.width) < 44 || Math.round(bounds.height) < 44
      })
      const visibleStepCount = Number(
        element.getAttribute('data-visible-step-count'),
      )
      const rows = Number(
        element.querySelector('[role="grid"]')?.getAttribute('aria-rowcount') ??
          0,
      )
      return {
        documentClientWidth: document.documentElement.clientWidth,
        documentScrollWidth: document.documentElement.scrollWidth,
        editorClientWidth: element.clientWidth,
        editorLeft: editorBounds.left,
        editorRight: editorBounds.right,
        editorScrollWidth: element.scrollWidth,
        closeCenterHit:
          closeButton !== undefined &&
          closeButton !== null &&
          closeBounds !== undefined &&
          closeBounds !== null &&
          closeButton.contains(
            document.elementFromPoint(
              closeBounds.left + closeBounds.width / 2,
              closeBounds.top + closeBounds.height / 2,
            ),
          ),
        closeTop: closeBounds?.top ?? Number.NEGATIVE_INFINITY,
        renderedCellCount:
          element.querySelectorAll('[data-groove-cell]').length,
        rows,
        sessionHeaderBottom:
          sessionHeader?.getBoundingClientRect().bottom ??
          Number.POSITIVE_INFINITY,
        undersizedButtons: undersizedButtons.length,
        visibleStepCount,
        viewportWidth: innerWidth,
        workbenchBarTop:
          workbenchBar?.getBoundingClientRect().top ?? Number.NEGATIVE_INFINITY,
        workbenchClientWidth: workbench?.clientWidth ?? 0,
        workbenchScrollWidth: workbench?.scrollWidth ?? 0,
      }
    })

    expect(geometry.documentScrollWidth, JSON.stringify(viewport)).toBe(
      geometry.documentClientWidth,
    )
    expect(geometry.editorScrollWidth, JSON.stringify(viewport)).toBe(
      geometry.editorClientWidth,
    )
    expect(geometry.workbenchScrollWidth, JSON.stringify(viewport)).toBe(
      geometry.workbenchClientWidth,
    )
    expect(
      geometry.editorLeft,
      JSON.stringify(viewport),
    ).toBeGreaterThanOrEqual(0)
    expect(geometry.editorRight, JSON.stringify(viewport)).toBeLessThanOrEqual(
      geometry.viewportWidth,
    )
    expect(geometry.visibleStepCount, JSON.stringify(viewport)).toBe(
      viewport.visibleSteps,
    )
    expect(geometry.rows, JSON.stringify(viewport)).toBe(7)
    expect(geometry.renderedCellCount, JSON.stringify(viewport)).toBe(
      geometry.rows * viewport.visibleSteps,
    )
    expect(geometry.undersizedButtons, JSON.stringify(viewport)).toBe(0)
    expect(geometry.closeTop, JSON.stringify(viewport)).toBeGreaterThanOrEqual(
      0,
    )
    expect(geometry.closeCenterHit, JSON.stringify(viewport)).toBe(true)
    if (viewport.width > 720) {
      expect(
        geometry.workbenchBarTop,
        JSON.stringify(viewport),
      ).toBeGreaterThanOrEqual(geometry.sessionHeaderBottom)
    }
    expect((await boundaryCounts(page)).audio).toBe(0)

    await page.screenshot({
      path: testInfo.outputPath(
        `drum-night-groove-rack-${viewport.width}x${viewport.height}.png`,
      ),
    })
  }
})

test('hot-edits a playing A B groove with pointer and keyboard without restarting it @smoke', async ({
  page,
}) => {
  await instrumentFirstPaint(page)
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/drum-night', { waitUntil: 'domcontentloaded' })

  const shell = page.getByTestId('drum-night-shell')
  const timeline = page.getByTestId('drum-night-timeline')
  const seek = timeline.getByRole('slider', { name: 'Drum part position' })
  const markA = timeline.getByRole('button', {
    name: 'Set loop start A at the playhead',
  })
  const markB = timeline.getByRole('button', {
    name: 'Set loop end B at the playhead',
  })

  const loopStartPoint = await rangePoint(seek, 0.2)
  await page.mouse.click(loopStartPoint.x, loopStartPoint.y)
  await markA.click()
  const loopEndPoint = await rangePoint(seek, 0.88)
  await page.mouse.click(loopEndPoint.x, loopEndPoint.y)
  await markB.click()
  const playStartPoint = await rangePoint(seek, 0.5)
  await page.mouse.click(playStartPoint.x, playStartPoint.y)
  const positionAtPlayStart = Number(await seek.inputValue())

  await expect(timeline).toHaveAttribute('data-loop-state', 'active')
  const loopStart = timeline.getByRole('slider', { name: 'Loop start marker' })
  const loopEnd = timeline.getByRole('slider', { name: 'Loop end marker' })
  const loopStartBefore = await loopStart.getAttribute('aria-valuenow')
  const loopEndBefore = await loopEnd.getAttribute('aria-valuenow')
  expect(Number(loopStartBefore)).toBeGreaterThan(0)
  expect(Number(loopEndBefore)).toBeGreaterThan(Number(loopStartBefore))

  await page.getByRole('button', { name: 'Count-in: 4 audible beats' }).click()
  await page
    .getByRole('button', { name: /^Play First Pocket take clock$/ })
    .filter({ visible: true })
    .click()
  await expect(shell).toHaveAttribute('data-playing', 'true')
  await expect
    .poll(async () => Number(await seek.inputValue()))
    .toBeGreaterThan(positionAtPlayStart)

  await page
    .getByRole('button', { name: /Groove/ })
    .filter({ visible: true })
    .first()
    .click()
  const editor = page.getByTestId('drum-groove-editor')
  await expect(editor).toBeVisible()

  const emptyTom = editor.getByRole('button', {
    name: 'Add Hi-Mid Tom at bar 1, beat 1 e',
  })
  await emptyTom.scrollIntoViewIfNeeded()
  const emptyTomBounds = await emptyTom.boundingBox()
  if (emptyTomBounds === null) {
    throw new Error('Empty tom cell has no real pointer bounds')
  }
  const positionBeforeEdit = Number(await seek.inputValue())
  const audioContextsBeforeEdit = (await boundaryCounts(page)).audio
  await page.mouse.click(
    emptyTomBounds.x + emptyTomBounds.width / 2,
    emptyTomBounds.y + emptyTomBounds.height / 2,
  )

  await expect(editor).toHaveAttribute('data-dirty', 'true')
  const addedTom = editor.getByRole('button', {
    name: /Hi-Mid Tom, at bar 1, beat 1 e, velocity \d+, sounding, selected/,
  })
  await expect(addedTom).toBeVisible()
  await expect(shell).toHaveAttribute('data-playing', 'true')
  await expect(timeline).toHaveAttribute('data-loop-state', 'active')
  await expect(loopStart).toHaveAttribute(
    'aria-valuenow',
    loopStartBefore ?? '',
  )
  await expect(loopEnd).toHaveAttribute('aria-valuenow', loopEndBefore ?? '')
  await expect(page.getByText(/^Count in$/)).toHaveCount(0)
  await expect(
    page.getByRole('button', { name: 'Count-in: off' }),
  ).toBeVisible()
  expect((await boundaryCounts(page)).audio).toBe(audioContextsBeforeEdit)

  const positionAfterEdit = Number(await seek.inputValue())
  expect(positionAfterEdit).toBeGreaterThan(0)
  expect(Math.abs(positionAfterEdit - positionBeforeEdit)).toBeLessThan(1)

  const targetTom = editor.getByRole('button', {
    name: 'Add Hi-Mid Tom at bar 1, beat 1 and',
  })
  const [originBounds, targetBounds] = await Promise.all([
    addedTom.boundingBox(),
    targetTom.boundingBox(),
  ])
  if (originBounds === null || targetBounds === null) {
    throw new Error('Tom move cells have no real pointer bounds')
  }
  await page.mouse.move(
    originBounds.x + originBounds.width / 2,
    originBounds.y + originBounds.height / 2,
  )
  await page.mouse.down()
  await page.mouse.move(
    targetBounds.x + targetBounds.width / 2,
    targetBounds.y + targetBounds.height / 2,
    { steps: 8 },
  )
  await page.mouse.up()

  await expect(
    editor.getByRole('button', {
      name: 'Add Hi-Mid Tom at bar 1, beat 1 e',
    }),
  ).toBeVisible()
  await expect(
    editor.getByRole('button', {
      name: /Hi-Mid Tom, at bar 1, beat 1 and, velocity \d+, sounding, selected/,
    }),
  ).toBeVisible()

  const draggedTom = editor.getByRole('button', {
    name: /Hi-Mid Tom, at bar 1, beat 1 and, velocity \d+, sounding, selected/,
  })
  await draggedTom.focus()
  await draggedTom.press('Enter')
  const later = editor.getByRole('button', { name: 'Later', exact: true })
  await later.focus()
  await later.press('Enter')
  await expect(
    editor.getByRole('button', {
      name: 'Add Hi-Mid Tom at bar 1, beat 1 and',
    }),
  ).toBeVisible()
  await expect(
    editor.getByRole('button', {
      name: /Hi-Mid Tom, at bar 1, beat 1 a, velocity \d+, sounding, selected/,
    }),
  ).toBeVisible()
  await expect(
    editor.getByRole('button', {
      name: 'Add Hi-Mid Tom at bar 1, beat 2',
      exact: true,
    }),
  ).toBeVisible()
  await expect(
    page.getByText(/Built-in groove · 29 mapped hits · 84 BPM take clock/),
  ).toBeVisible()
  await expect(shell).toHaveAttribute('data-playing', 'true')

  const keyboardCell = editor.locator('[data-gm-key="48"][data-step-index="1"]')
  await keyboardCell.focus()
  await keyboardCell.press('Enter')
  await expect(keyboardCell).toHaveAttribute(
    'aria-label',
    /Hi-Mid Tom, at bar 1, beat 1 e, velocity \d+/,
  )
  await keyboardCell.press('Delete')
  await expect(keyboardCell).toHaveAttribute(
    'aria-label',
    'Add Hi-Mid Tom at bar 1, beat 1 e',
  )
  await keyboardCell.press('Control+z')
  await expect(keyboardCell).toHaveAttribute(
    'aria-label',
    /Hi-Mid Tom, at bar 1, beat 1 e, velocity \d+/,
  )
  await keyboardCell.press('Control+z')
  await expect(keyboardCell).toHaveAttribute(
    'aria-label',
    'Add Hi-Mid Tom at bar 1, beat 1 e',
  )

  await page.getByRole('button', { name: 'Close rack drawer' }).click()
  await page.getByRole('button', { name: 'Score view' }).click()
  await expect(
    page
      .getByText(/29 mapped hits · authored attack span/)
      .filter({ visible: true })
      .first(),
  ).toBeVisible()
  await expect(shell).toHaveAttribute('data-playing', 'true')
})

test('mixes an authored kit family without changing the live You bus @smoke', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/drum-night', { waitUntil: 'domcontentloaded' })

  await page
    .getByRole('button', { name: /Groove/ })
    .filter({ visible: true })
    .first()
    .click()
  const drawer = page.getByRole('region', { name: 'Shape the groove' })
  await drawer.getByRole('tab', { name: 'Mix' }).click()

  const mixer = page.getByTestId('drum-play-along-mixer')
  const familyLevel = mixer.getByRole('slider', {
    name: 'Kick authored level',
  })
  const youLevel = mixer.getByRole('slider', { name: 'You level' })
  const sourceLevel = mixer.getByRole('slider', { name: 'Source Drums level' })
  const youLevelBefore = await youLevel.inputValue()
  const sourceLevelBefore = await sourceLevel.inputValue()
  await familyLevel.scrollIntoViewIfNeeded()
  const initialFamilyLevel = await familyLevel.inputValue()
  const familyTarget = await rangePoint(familyLevel, 0.36)
  await page.mouse.click(familyTarget.x, familyTarget.y)

  await expect(familyLevel).not.toHaveValue(initialFamilyLevel)
  await mixer.getByRole('button', { name: 'Mute authored Kick' }).click()
  await expect(
    mixer.getByRole('button', { name: 'Unmute authored Kick' }),
  ).toHaveAttribute('aria-pressed', 'true')
  await expect(youLevel).toHaveValue(youLevelBefore)
  await expect(sourceLevel).toHaveValue(sourceLevelBefore)
  await expect(mixer.getByRole('button', { name: 'Mute You' })).toHaveAttribute(
    'aria-pressed',
    'false',
  )
})

test('changes only the visual room and preserves the authored Seat scene @smoke', async ({
  page,
}) => {
  await instrumentFirstPaint(page)
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/drum-night', { waitUntil: 'domcontentloaded' })

  const shell = page.getByTestId('drum-night-shell')
  await page
    .getByRole('button', {
      name: 'Change room, Pocket Console selected',
    })
    .click()

  const drawer = page.getByRole('region', { name: 'Choose the room' })
  const gallery = drawer.getByRole('region', {
    name: 'Choose your Drum Night room',
  })
  await expect(gallery).toBeVisible()
  await gallery.getByRole('button', { name: /Tape Room/i }).click()

  await expect(shell).toHaveAttribute('style', /tape-room-landscape\.webp/)
  await expect(
    page.getByRole('button', { name: 'Change room, Tape Room selected' }),
  ).toBeVisible()
  expect(
    await page.evaluate(() =>
      localStorage.getItem('pitchperfect_drum_background'),
    ),
  ).toBe('drum-tape-room')
  await expect(
    page
      .getByRole('status')
      .filter({ hasText: 'Tape Room selected. Drum sound unchanged.' }),
  ).toBeAttached()

  await drawer.getByRole('button', { name: 'Close rack drawer' }).click()
  await expect(drawer).not.toBeVisible()
  await page.getByRole('button', { name: 'Drummer Seat view' }).click()
  await expect(shell).toHaveAttribute('data-view', 'seat')
  await expect(page.getByTestId('drummer-seat-backdrop')).toBeVisible()

  const boundaries = await boundaryCounts(page)
  expect(boundaries.audio).toBe(0)
  expect(boundaries.database).toBe(0)
  expect(boundaries.midi).toBe(0)
  expect(boundaries.mic).toBe(0)
  expect(boundaries.workers).toBe(0)
})

test('imports one drum document across Score, Seat, transport, and the rack drawer @smoke', async ({
  page,
}) => {
  await page.goto('/drum-night', { waitUntil: 'domcontentloaded' })

  await page.getByRole('button', { name: 'Score view' }).click()
  await expect(page.getByTestId('drum-night-shell')).toHaveAttribute(
    'data-view',
    'score',
  )
  await expect(
    page.getByRole('heading', { name: 'First Pocket' }),
  ).toBeVisible()
  await expect
    .poll(async () => {
      const geometry = await scoreGeometry(page)
      return Math.min(
        geometry.viewportWidth / geometry.panelWidth,
        geometry.scoreWidth / geometry.viewportWidth,
      )
    })
    .toBeGreaterThanOrEqual(0.98)
  const preparedScoreGeometry = await scoreGeometry(page)
  expect(preparedScoreGeometry.viewportWidth).toBeGreaterThanOrEqual(
    preparedScoreGeometry.panelWidth * 0.98,
  )
  expect(preparedScoreGeometry.scoreWidth).toBeGreaterThanOrEqual(
    preparedScoreGeometry.viewportWidth * 0.98,
  )

  const songs = page
    .getByRole('button', { name: /Songs/ })
    .filter({ visible: true })
    .first()
  await songs.click()
  const songsDrawer = page.getByRole('region', { name: 'Bring a song' })
  await expect(songsDrawer).toBeVisible()
  await songsDrawer
    .getByTestId('drum-play-along-file-drop-input')
    .setInputFiles({
      name: 'e2e-pocket.mid',
      mimeType: 'audio/midi',
      buffer: DRUM_SESSION_MIDI,
    })
  await expect(songsDrawer).not.toBeVisible()
  await expect(page.getByTestId('drum-night-shell')).toHaveAttribute(
    'data-import-status',
    'ready',
  )
  await expect(
    page.getByText('Percussion score', { exact: true }),
  ).toBeVisible()
  await expect
    .poll(async () => {
      const geometry = await scoreGeometry(page)
      return geometry.scoreWidth / geometry.viewportWidth
    })
    .toBeGreaterThanOrEqual(0.98)
  const importedScoreGeometry = await scoreGeometry(page)
  expect(importedScoreGeometry.viewportWidth).toBeGreaterThanOrEqual(
    importedScoreGeometry.panelWidth * 0.98,
  )

  await page.getByRole('button', { name: 'Drummer Seat view' }).click()
  await expect(
    page.getByRole('heading', { name: 'Playable drummer’s seat' }),
  ).toBeAttached()
  await expect(page.getByTestId('drum-night-shell')).toHaveAttribute(
    'data-view',
    'seat',
  )

  const play = page
    .getByRole('button', { name: /^Play .* take clock$/ })
    .filter({ visible: true })
  await play.click()
  await expect(page.getByTestId('drum-night-shell')).toHaveAttribute(
    'data-playing',
    'true',
  )
  await expect(
    page.getByRole('status').filter({
      hasText:
        'e2e-pocket is starting on the shared take clock with take events armed.',
    }),
  ).toBeAttached()

  const groove = page
    .getByRole('button', { name: /Groove/ })
    .filter({ visible: true })
    .first()
  await groove.click()
  const drawer = page.getByRole('region', { name: 'Shape the groove' })
  await expect(drawer).toBeVisible()
  await expect(page).toHaveURL(/drawer=groove/)
  await expect(groove).toBeFocused()
  await expect(groove).toHaveAttribute('aria-expanded', 'true')

  await page.keyboard.press('Escape')
  await expect(drawer).not.toBeVisible()
  await expect(page).not.toHaveURL(/drawer=/)
  await expect(groove).toBeFocused()
})

test('keeps a mixed authored MIDI on one Score, mixer, and timeline clock @smoke', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/drum-night?view=score', {
    waitUntil: 'domcontentloaded',
  })

  await page
    .getByRole('button', { name: 'Songs', exact: true })
    .filter({ visible: true })
    .first()
    .click()
  const songsDrawer = page.getByRole('region', { name: 'Bring a song' })
  await songsDrawer
    .getByTestId('drum-play-along-file-drop-input')
    .setInputFiles({
      name: 'mixed-band.mid',
      mimeType: 'audio/midi',
      buffer: createMixedDrumSessionMidi(),
    })

  await expect(songsDrawer).not.toBeVisible()
  await expect(page.getByRole('heading', { name: 'mixed-band' })).toBeVisible()
  await expect(
    page.getByText('Percussion score', { exact: true }),
  ).toBeVisible()
  await expect(page.getByText('Song timeline', { exact: true })).toBeVisible()
  await page.screenshot({
    path: testInfo.outputPath('drum-night-mixed-midi-score-1440x900.png'),
  })

  await page
    .getByRole('button', { name: 'Songs', exact: true })
    .filter({ visible: true })
    .first()
    .click()
  await expect(
    page.getByText('3 authored drum hits · 1 backing track', { exact: true }),
  ).toBeVisible()
  await page
    .getByRole('button', { name: 'Songs', exact: true })
    .filter({ visible: true })
    .first()
    .click()

  await page
    .getByRole('button', { name: 'Groove', exact: true })
    .filter({ visible: true })
    .first()
    .click()
  const grooveDrawer = page.getByRole('region', { name: 'Shape the groove' })
  await grooveDrawer.getByRole('tab', { name: 'Mix' }).click()
  const mixer = page.getByTestId('drum-play-along-mixer')
  await expect(mixer).toHaveAttribute(
    'data-source-kind',
    'authored-arrangement',
  )
  await expect(
    mixer.getByRole('slider', { name: 'Source Drums level' }),
  ).toBeEnabled()
  const backingLevel = mixer.getByRole('slider', { name: 'Backing level' })
  await expect(backingLevel).toBeEnabled()
  await expect(mixer.getByRole('slider', { name: 'You level' })).toBeEnabled()
  await expect(mixer.getByText('Bass Guide', { exact: true })).toBeVisible()
  await page.screenshot({
    path: testInfo.outputPath('drum-night-mixed-midi-mixer-1440x900.png'),
  })

  const initialBackingLevel = await backingLevel.inputValue()
  await backingLevel.scrollIntoViewIfNeeded()
  const backingBounds = await backingLevel.boundingBox()
  if (backingBounds === null) {
    throw new Error('Authored Backing slider has no pointer bounds')
  }
  await page.mouse.move(
    backingBounds.x + backingBounds.width * (Number(initialBackingLevel) / 100),
    backingBounds.y + backingBounds.height / 2,
  )
  await page.mouse.down()
  await page.mouse.move(
    backingBounds.x + backingBounds.width * 0.3,
    backingBounds.y + backingBounds.height / 2,
    { steps: 5 },
  )
  await page.mouse.up()
  await expect(backingLevel).not.toHaveValue(initialBackingLevel)

  await mixer.getByRole('button', { name: 'Mute Source Drums' }).click()
  await expect(
    mixer.getByRole('button', { name: 'Unmute Source Drums' }),
  ).toHaveAttribute('aria-pressed', 'true')
  await expect(
    page
      .getByTestId('drum-night-timeline')
      .getByRole('slider', { name: 'Drum part position' }),
  ).toBeVisible()
})

test('keeps a saved two-stem source metadata-only until Play hydrates its audio @smoke', async ({
  page,
}, testInfo) => {
  const sessionId = `drum-night-two-stem-${Date.now()}`
  await instrumentFirstPaint(page)
  await instrumentStemPayloadReads(page)
  await initializeDrumNightDatabase(page)
  await seedDrumPlayAlongSession(page, {
    sessionId,
    fileName: 'two-stem-drive.wav',
    mix: 'two-stem',
  })

  await page.goto('/drum-night?drawer=songs', {
    waitUntil: 'domcontentloaded',
  })
  const songsDrawer = page.getByRole('region', { name: 'Bring a song' })
  const loadSavedSongs = songsDrawer.getByRole('button', {
    name: 'Load saved songs',
  })
  await expect(loadSavedSongs).toBeVisible()
  await loadSavedSongs.click()
  const song = songsDrawer.getByRole('button', {
    name: /two-stem-drive\.wav.*Load backing/i,
  })
  await expect(song).toBeVisible()
  expect((await boundaryCounts(page)).audio).toBe(0)
  expect(await stemPayloadReads(page)).toBe(0)

  const songBounds = await song.boundingBox()
  if (songBounds === null)
    throw new Error('Two-stem song has no pointer bounds')
  await page.mouse.click(
    songBounds.x + songBounds.width / 2,
    songBounds.y + songBounds.height / 2,
  )
  await expect(songsDrawer.getByText('Backing with drums inside')).toBeVisible()
  await expect(
    songsDrawer.getByText(
      'The source drums are still inside this two-stem mix, so they cannot be controlled separately yet.',
    ),
  ).toBeVisible()
  await expect(
    songsDrawer.getByRole('button', { name: 'Separate drums' }),
  ).toBeVisible()
  expect((await boundaryCounts(page)).audio).toBe(0)
  expect(await stemPayloadReads(page)).toBe(0)

  await songsDrawer
    .getByRole('button', { name: 'Open the play-along mixer' })
    .click()
  const mixer = page.getByTestId('drum-play-along-mixer')
  await expect(mixer).toHaveAttribute('data-source-kind', 'two-stem-audio')
  await expect(
    mixer.getByRole('slider', { name: 'Source Drums level' }),
  ).toBeDisabled()
  await expect(
    mixer.getByRole('button', { name: 'Mute Source Drums' }),
  ).toBeDisabled()
  await expect(
    mixer.getByRole('slider', { name: 'Backing level' }),
  ).toBeEnabled()
  await expect(mixer.getByRole('slider', { name: 'You level' })).toBeEnabled()
  expect((await boundaryCounts(page)).audio).toBe(0)
  expect(await stemPayloadReads(page)).toBe(0)
  await page.screenshot({
    path: testInfo.outputPath('drum-night-two-stem-mixer-metadata-only.png'),
  })

  await page.getByRole('button', { name: 'Close rack drawer' }).click()
  await page.getByRole('button', { name: 'Score view' }).click()
  await expect(page.getByText('No drum score was created')).toBeVisible()
  await expect(
    page.getByText(
      'Stem separation can isolate sound, but it does not author drum notation. Open MIDI or Guitar Pro to follow a score.',
    ),
  ).toBeVisible()
  expect(await stemPayloadReads(page)).toBe(0)

  await page
    .getByRole('button', { name: 'Play two-stem-drive.wav song clock' })
    .filter({ visible: true })
    .first()
    .click()
  await expect.poll(() => stemPayloadReads(page)).toBeGreaterThan(0)
  await expect
    .poll(async () => (await boundaryCounts(page)).audio)
    .toBeGreaterThan(0)
})

test('hydrates only reconstructed Source Drums and Backing after an inert full-manifest selection @smoke', async ({
  page,
}, testInfo) => {
  const sessionId = `drum-night-full-band-${Date.now()}`
  await instrumentFirstPaint(page)
  await instrumentStemPayloadReads(page)
  await initializeDrumNightDatabase(page)
  await seedDrumPlayAlongSession(page, {
    sessionId,
    fileName: 'full-band-room.wav',
    mix: 'parts',
  })

  await page.goto('/drum-night?drawer=songs', {
    waitUntil: 'domcontentloaded',
  })
  const songsDrawer = page.getByRole('region', { name: 'Bring a song' })
  const loadSavedSongs = songsDrawer.getByRole('button', {
    name: 'Load saved songs',
  })
  await expect(loadSavedSongs).toBeVisible()
  await loadSavedSongs.click()
  const song = songsDrawer.getByRole('button', {
    name: /full-band-room\.wav.*Load backing/i,
  })
  await expect(song).toBeVisible()
  await song.click()
  await expect(songsDrawer.getByText('Full mix ready')).toBeVisible()
  expect((await boundaryCounts(page)).audio).toBe(0)
  expect(await stemPayloadReads(page)).toBe(0)

  await songsDrawer
    .getByRole('button', { name: 'Open the play-along mixer' })
    .click()
  const mixer = page.getByTestId('drum-play-along-mixer')
  await expect(mixer).toHaveAttribute('data-source-kind', 'separated-audio')
  await expect(
    mixer.getByRole('slider', { name: 'Source Drums level' }),
  ).toBeEnabled()
  await expect(
    mixer.getByRole('slider', { name: 'Backing level' }),
  ).toBeEnabled()
  await expect(mixer.getByRole('slider', { name: 'You level' })).toBeEnabled()
  await expect(mixer.getByText('Drums', { exact: true })).toBeVisible()
  await expect(mixer.getByText('Vocals', { exact: true })).toBeVisible()
  await expect(
    mixer.getByText('Backing (drums removed)', { exact: true }),
  ).toBeVisible()
  await expect(mixer.getByText('Bass', { exact: true })).toHaveCount(0)
  await expect(mixer.getByText('Guitar', { exact: true })).toHaveCount(0)
  await expect(mixer.getByText('Piano', { exact: true })).toHaveCount(0)
  await expect(
    mixer.getByText('Other instruments', { exact: true }),
  ).toHaveCount(0)
  await expect(
    mixer.getByText('Backing (drums included)', { exact: true }),
  ).toHaveCount(0)
  await page.screenshot({
    path: testInfo.outputPath('drum-night-separated-mixer-metadata-only.png'),
  })

  await mixer.getByRole('button', { name: /Play along/ }).click()
  await expect(
    mixer.getByRole('button', { name: 'Unmute Source Drums' }),
  ).toHaveAttribute('aria-pressed', 'true')
  expect((await boundaryCounts(page)).audio).toBe(0)
  expect(await stemPayloadReads(page)).toBe(0)

  await page.getByRole('button', { name: 'Close rack drawer' }).click()
  await page
    .getByRole('button', { name: 'Play full-band-room.wav song clock' })
    .filter({ visible: true })
    .first()
    .click()
  await expect.poll(() => stemPayloadReads(page)).toBe(3)
  await expect
    .poll(async () => (await boundaryCounts(page)).audio)
    .toBeGreaterThan(0)
})

test('sets, moves, clears, and scrubs the authored A B loop with a real pointer @smoke', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/drum-night', { waitUntil: 'domcontentloaded' })

  const shell = page.getByTestId('drum-night-shell')
  const timeline = page.getByTestId('drum-night-timeline')
  const seek = timeline.getByRole('slider', { name: 'Drum part position' })
  const markAControl = timeline.getByRole('button', {
    name: 'Set loop start A at the playhead',
  })
  const markBControl = timeline.getByRole('button', {
    name: 'Set loop end B at the playhead',
  })

  await expect(timeline).toHaveAttribute('data-loop-state', 'full')
  await expect(timeline.getByText('Full song')).toBeVisible()
  await markAControl.click()
  await expect(timeline).toHaveAttribute('data-loop-state', 'waiting')
  await expect(timeline.getByText('Set B to finish the loop')).toBeVisible()

  const laterPosition = await rangePoint(seek, 0.62)
  await page.mouse.click(laterPosition.x, laterPosition.y)
  await expect
    .poll(async () => Number(await seek.inputValue()))
    .toBeGreaterThan(Number(await seek.getAttribute('min')))
  await markBControl.click()

  await expect(timeline).toHaveAttribute('data-loop-state', 'active')
  const loopToast = page
    .locator('[role="status"][data-visible="true"]')
    .filter({ hasText: 'A–B loop set' })
  await expect(loopToast).toBeVisible()
  const [toastBounds, timelineBounds] = await Promise.all([
    loopToast.boundingBox(),
    timeline.boundingBox(),
  ])
  if (toastBounds === null || timelineBounds === null) {
    throw new Error('A B feedback or timeline is missing geometry')
  }
  expect(toastBounds.y + toastBounds.height).toBeLessThanOrEqual(
    timelineBounds.y,
  )
  const markerA = timeline.getByRole('slider', { name: 'Loop start marker' })
  const markerB = timeline.getByRole('slider', { name: 'Loop end marker' })
  await expect(markerA).toHaveAttribute('aria-valuenow', '0')
  await expect(markerB).toBeVisible()
  const initialA = Number(await markerA.getAttribute('aria-valuenow'))
  const markerBounds = await markerA.boundingBox()
  const railBounds = await page
    .getByTestId('drum-night-loop-range')
    .locator('input[type="range"]')
    .boundingBox()
  if (markerBounds === null || railBounds === null) {
    throw new Error('A B timeline marker is missing real pointer bounds')
  }

  await page.mouse.move(
    markerBounds.x + markerBounds.width / 2,
    markerBounds.y + markerBounds.height / 2,
  )
  await page.mouse.down()
  await page.mouse.move(
    railBounds.x + railBounds.width * 0.24,
    markerBounds.y + markerBounds.height / 2,
    { steps: 8 },
  )
  await page.mouse.up()
  await expect
    .poll(async () => Number(await markerA.getAttribute('aria-valuenow')))
    .toBeGreaterThan(initialA)
  await expect(timeline).toHaveAttribute('data-loop-state', 'active')

  await timeline
    .getByRole('button', { name: 'Clear A B practice loop' })
    .click()
  await expect(timeline).toHaveAttribute('data-loop-state', 'full')
  await expect(markerA).toHaveCount(0)
  await expect(markerB).toHaveCount(0)

  await page.getByRole('button', { name: 'Count-in: 4 audible beats' }).click()
  await expect(
    page.getByRole('button', { name: 'Count-in: off' }),
  ).toBeVisible()
  await page
    .getByRole('button', { name: 'Play First Pocket take clock' })
    .filter({ visible: true })
    .click()
  await expect(shell).toHaveAttribute('data-playing', 'true')

  await shell.evaluate((element) => {
    const trackedWindow = window as unknown as {
      __drumNightPlayingTransitions: string[]
      __drumNightPlayingObserver?: MutationObserver
    }
    trackedWindow.__drumNightPlayingTransitions = []
    trackedWindow.__drumNightPlayingObserver?.disconnect()
    trackedWindow.__drumNightPlayingObserver = new MutationObserver(() => {
      trackedWindow.__drumNightPlayingTransitions.push(
        element.getAttribute('data-playing') ?? '',
      )
    })
    trackedWindow.__drumNightPlayingObserver.observe(element, {
      attributeFilter: ['data-playing'],
    })
  })

  const scrubFrom = await rangePoint(seek, 0.72)
  const scrubTo = await rangePoint(seek, 0.41)
  await page.mouse.move(scrubFrom.x, scrubFrom.y)
  await page.mouse.down()
  await expect(shell).toHaveAttribute('data-playing', 'false')
  await page.mouse.move(scrubTo.x, scrubTo.y, { steps: 8 })
  await page.mouse.up()
  await expect(shell).toHaveAttribute('data-playing', 'true')
  await expect(page.getByText(/^Count in$/)).toHaveCount(0)
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (
            window as unknown as {
              __drumNightPlayingTransitions: string[]
            }
          ).__drumNightPlayingTransitions,
      ),
    )
    .toEqual(['false', 'true'])
})

test('keeps quarter-beat marks and end-boundary controls pointer-safe at 320px @smoke', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 568 })
  await page.goto('/drum-night', { waitUntil: 'domcontentloaded' })

  const timeline = page.getByTestId('drum-night-timeline')
  const seek = timeline.getByRole('slider', { name: 'Drum part position' })
  const setA = timeline.getByRole('button', {
    name: 'Set loop start A at the playhead',
  })
  const setB = timeline.getByRole('button', {
    name: 'Set loop end B at the playhead',
  })

  await setA.click()
  await seek.focus()
  await seek.press('Home')
  for (let step = 0; step < 4; step += 1) await seek.press('ArrowRight')
  await setB.click()

  const markerA = timeline.getByRole('slider', { name: 'Loop start marker' })
  const markerB = timeline.getByRole('slider', { name: 'Loop end marker' })
  await expect(markerA).toHaveAttribute('aria-valuenow', '0')
  await expect(markerA).toHaveAttribute('aria-valuetext', 'Beat 1')
  await expect(markerB).toHaveAttribute('aria-valuenow', '0.25')
  await expect(markerB).toHaveAttribute('aria-valuetext', 'Beat 1.25')

  const openFocus = timeline.getByRole('button', {
    name: 'Focus the A B loop',
  })
  await expect(openFocus).toBeVisible()
  const openFocusBounds = await openFocus.boundingBox()
  if (openFocusBounds === null) {
    throw new Error('Focused A B editor action has no pointer bounds')
  }
  await page.mouse.click(
    openFocusBounds.x + openFocusBounds.width / 2,
    openFocusBounds.y + openFocusBounds.height / 2,
  )
  await expect(page.getByTestId('drum-night-loop-precision-lens')).toBeVisible()
  await expect(
    timeline.getByRole('button', {
      name: 'Close the focused loop editor',
    }),
  ).toHaveAttribute('aria-pressed', 'true')

  await timeline
    .getByRole('button', { name: 'Clear A B practice loop' })
    .click()
  await seek.focus()
  await seek.press('End')
  await setB.click()
  const endBeat = await markerB.getAttribute('aria-valuenow')
  expect(Number(endBeat)).toBeGreaterThan(0.25)
  await seek.focus()
  for (let step = 0; step < 4; step += 1) await seek.press('ArrowLeft')
  await setA.click()
  await expect(timeline).toHaveAttribute('data-loop-state', 'active')
  await expect(markerB).toHaveAttribute('aria-valuenow', endBeat ?? '')

  const neighboringFocus = timeline.getByRole('button', {
    name: 'Focus the A B loop',
  })
  await expect(neighboringFocus).toBeVisible()
  const neighboringBounds = await neighboringFocus.boundingBox()
  if (neighboringBounds === null) {
    throw new Error('End-boundary focus action has no pointer bounds')
  }
  await page.mouse.click(
    neighboringBounds.x + neighboringBounds.width / 2,
    neighboringBounds.y + neighboringBounds.height / 2,
  )
  await expect(page.getByTestId('drum-night-loop-precision-lens')).toBeVisible()
})

test('keeps the full song timeline inside Pocket, Seat, and Score at phone and landscape sizes @smoke', async ({
  page,
}, testInfo) => {
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 844, height: 390 },
  ]) {
    await page.setViewportSize(viewport)
    for (const view of ['pocket', 'seat', 'score'] as const) {
      await page.goto(`/drum-night?view=${view}`, {
        waitUntil: 'domcontentloaded',
      })
      const timeline = page.getByTestId('drum-night-timeline')
      const seek = timeline.getByRole('slider', {
        name: 'Drum part position',
      })
      await expect(timeline).toBeVisible()
      await expect(timeline).toHaveAttribute('data-loop-state', 'full')
      await expect(seek).toBeVisible()

      const geometry = await timeline.evaluate((element) => {
        const rect = element.getBoundingClientRect()
        const visibleButtons = [...element.querySelectorAll('button')].filter(
          (button) => {
            const bounds = button.getBoundingClientRect()
            const style = getComputedStyle(button)
            return (
              bounds.width > 0 &&
              bounds.height > 0 &&
              style.display !== 'none' &&
              style.visibility !== 'hidden'
            )
          },
        )
        const undersizedButtons = visibleButtons.filter((button) => {
          const bounds = button.getBoundingClientRect()
          return bounds.width < 44 || bounds.height < 44
        })
        const slider = element.querySelector<HTMLInputElement>(
          'input[type="range"]',
        )
        const sliderRect = slider?.getBoundingClientRect()
        return {
          bottom: rect.bottom,
          left: rect.left,
          pageWidth: document.documentElement.scrollWidth,
          right: rect.right,
          sliderHeight: sliderRect?.height ?? 0,
          top: rect.top,
          undersizedButtons: undersizedButtons.length,
          viewportHeight: document.documentElement.clientHeight,
          viewportWidth: document.documentElement.clientWidth,
        }
      })

      expect(
        geometry.left,
        `${view} ${viewport.width}px`,
      ).toBeGreaterThanOrEqual(0)
      expect(
        geometry.top,
        `${view} ${viewport.width}px`,
      ).toBeGreaterThanOrEqual(0)
      expect(geometry.right, `${view} ${viewport.width}px`).toBeLessThanOrEqual(
        geometry.viewportWidth,
      )
      expect(
        geometry.bottom,
        `${view} ${viewport.width}px`,
      ).toBeLessThanOrEqual(geometry.viewportHeight)
      expect(
        geometry.pageWidth,
        `${view} ${viewport.width}px`,
      ).toBeLessThanOrEqual(geometry.viewportWidth)
      expect(
        geometry.sliderHeight,
        `${view} ${viewport.width}px`,
      ).toBeGreaterThanOrEqual(44)
      expect(geometry.undersizedButtons, `${view} ${viewport.width}px`).toBe(0)
    }

    await page.screenshot({
      path: testInfo.outputPath(`drum-night-timeline-${viewport.width}.png`),
      fullPage: true,
    })
  }
})

test('plays the photographed Drummer Seat with a real pointer at desktop, landscape, and phone sizes @smoke', async ({
  page,
}) => {
  await instrumentFirstPaint(page)
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 844, height: 390 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport)
    await page.goto('/drum-night?view=seat', {
      waitUntil: 'domcontentloaded',
    })

    await expect(
      page.getByRole('group', { name: 'Touch drum pads' }),
    ).toHaveCount(0)
    const seatKit = page.getByRole('group', {
      name: 'Playable photographed drum kit',
    })
    await expect(seatKit.getByRole('button')).toHaveCount(6)
    const snare = seatKit.getByRole('button', {
      name: /^Play Acoustic snare/i,
    })
    await expect(snare).toBeVisible()
    const bounds = await snare.boundingBox()
    if (bounds === null) {
      throw new Error(`Seat snare has no pointer bounds at ${viewport.width}px`)
    }
    expect(bounds.width).toBeGreaterThanOrEqual(44)
    expect(bounds.height).toBeGreaterThanOrEqual(44)

    await page.mouse.click(
      bounds.x + bounds.width / 2,
      bounds.y + bounds.height / 2,
    )

    await expect(snare).toHaveAttribute('data-live-active', 'true')
    expect((await boundaryCounts(page)).audio).toBe(1)
  }
})

test('moves the live kit level with a real pointer @smoke', async ({
  page,
}) => {
  await page.goto('/drum-night', { waitUntil: 'domcontentloaded' })

  await page
    .getByRole('button', { name: /Groove/ })
    .filter({ visible: true })
    .first()
    .click()
  const drawer = page.getByRole('region', { name: 'Shape the groove' })
  await drawer.getByRole('tab', { name: 'Mix' }).click()
  const mixDrawer = page.getByRole('region', { name: 'Balance the room' })

  const youLevel = mixDrawer.getByRole('slider', { name: 'You level' })
  const initialValue = await youLevel.inputValue()
  await youLevel.scrollIntoViewIfNeeded()
  const bounds = await youLevel.boundingBox()
  if (bounds === null) throw new Error('You level slider has no pointer bounds')

  await page.mouse.move(
    bounds.x + bounds.width * (Number(initialValue) / 100),
    bounds.y + bounds.height / 2,
  )
  await page.mouse.down()
  await page.mouse.move(
    bounds.x + bounds.width * 0.35,
    bounds.y + bounds.height / 2,
    { steps: 5 },
  )
  await page.mouse.up()

  await expect(youLevel).not.toHaveValue(initialValue)
})

test('keeps URL history, selected rack tab, and focus in sync @smoke', async ({
  page,
}) => {
  await page.goto('/drum-night', { waitUntil: 'domcontentloaded' })

  const grooveTrigger = page
    .getByRole('button', { name: /Groove/ })
    .filter({ visible: true })
    .first()
  await grooveTrigger.click()
  const drawer = page.getByRole('region', { name: 'Shape the groove' })
  const grooveTab = drawer.getByRole('tab', { name: 'Groove' })
  await expect(grooveTrigger).toBeFocused()
  await drawer.getByRole('tab', { name: 'Kit' }).click()
  await expect(page).toHaveURL(/drawer=kit/)

  await page.goBack()
  await expect(page).toHaveURL(/drawer=groove/)
  await expect(grooveTab).toHaveAttribute('aria-selected', 'true')
  await expect(grooveTab).toBeFocused()

  await page.goBack()
  await expect(page).not.toHaveURL(/drawer=/)
  await expect(drawer).not.toBeVisible()

  await page.goForward()
  await expect(page).toHaveURL(/drawer=groove/)
  await expect(grooveTab).toBeFocused()
})

test('recomposes for phone and short landscape without overflow or clipped primary controls @smoke', async ({
  page,
}) => {
  for (const viewport of [
    { width: 320, height: 568 },
    { width: 390, height: 844 },
    { width: 844, height: 390 },
    { width: 768, height: 1024 },
    { width: 1024, height: 768 },
    { width: 1440, height: 900 },
  ]) {
    await page.setViewportSize(viewport)
    await page.goto('/drum-night', { waitUntil: 'domcontentloaded' })
    await expect(
      page.getByRole('button', { name: /^Open drum input setup:/ }),
    ).toBeVisible()

    const touchKit = page.getByRole('group', { name: 'Touch drum pads' })
    if (viewport.width <= 720) {
      await expect(touchKit).toBeVisible()
      await expect(touchKit.getByRole('button')).toHaveCount(6)
      await expect(touchKit.getByRole('button').first()).toBeVisible()
      await expect(touchKit.getByRole('button').last()).toBeVisible()
    } else {
      await expect(touchKit).toHaveCount(0)
    }

    const geometry = await page.evaluate(() => {
      const visible = (element: Element): boolean => {
        const rect = element.getBoundingClientRect()
        const style = getComputedStyle(element)
        return (
          rect.width > 0 &&
          rect.height > 0 &&
          rect.bottom > 0 &&
          rect.right > 0 &&
          rect.top < innerHeight &&
          rect.left < innerWidth &&
          style.display !== 'none' &&
          style.visibility !== 'hidden'
        )
      }
      const visiblePlay = [...document.querySelectorAll<HTMLElement>('button')]
        .filter(visible)
        .find((button) =>
          /^(?:Play|Pause) .+ take clock$/.test(
            button.getAttribute('aria-label') ?? '',
          ),
        )
      const playRect = visiblePlay?.getBoundingClientRect()
      const consoleRect =
        visiblePlay?.parentElement?.parentElement?.getBoundingClientRect()
      const roomRect = document.querySelector('main')?.getBoundingClientRect()
      const undersized = [...document.querySelectorAll('button')]
        .filter(visible)
        .map((button) => button.getBoundingClientRect())
        .filter((rect) => rect.width < 44 || rect.height < 44)
      return {
        horizontalOverflow:
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
        verticalOverflow:
          document.documentElement.scrollHeight -
          document.documentElement.clientHeight,
        playBottom: playRect?.bottom ?? Number.POSITIVE_INFINITY,
        playCenterDelta:
          playRect === undefined || roomRect === undefined
            ? Number.POSITIVE_INFINITY
            : Math.abs(
                playRect.left +
                  playRect.width / 2 -
                  (roomRect.left + roomRect.width / 2),
              ),
        playHeight: playRect?.height ?? 0,
        playRight: playRect?.right ?? Number.POSITIVE_INFINITY,
        playWidth: playRect?.width ?? 0,
        consoleBottom: consoleRect?.bottom ?? Number.POSITIVE_INFINITY,
        consoleLeft: consoleRect?.left ?? Number.NEGATIVE_INFINITY,
        consoleRight: consoleRect?.right ?? Number.POSITIVE_INFINITY,
        roomWidth: roomRect?.width ?? 0,
        undersized: undersized.length,
      }
    })

    expect(geometry.horizontalOverflow, JSON.stringify(viewport)).toBe(0)
    expect(geometry.verticalOverflow, JSON.stringify(viewport)).toBe(0)
    expect(geometry.playBottom, JSON.stringify(viewport)).toBeLessThanOrEqual(
      viewport.height,
    )
    expect(geometry.playRight, JSON.stringify(viewport)).toBeLessThanOrEqual(
      viewport.width,
    )
    expect(geometry.undersized, JSON.stringify(viewport)).toBe(0)
    if (
      (viewport.width === 844 && viewport.height === 390) ||
      (viewport.width === 1440 && viewport.height === 900)
    ) {
      expect(
        geometry.playCenterDelta,
        JSON.stringify(viewport),
      ).toBeLessThanOrEqual(geometry.roomWidth * 0.06)
      expect(
        geometry.playWidth,
        JSON.stringify(viewport),
      ).toBeGreaterThanOrEqual(54)
      expect(
        geometry.playHeight,
        JSON.stringify(viewport),
      ).toBeGreaterThanOrEqual(54)
      expect(
        geometry.consoleLeft,
        JSON.stringify(viewport),
      ).toBeGreaterThanOrEqual(0)
      expect(
        geometry.consoleRight,
        JSON.stringify(viewport),
      ).toBeLessThanOrEqual(viewport.width)
      expect(
        geometry.consoleBottom,
        JSON.stringify(viewport),
      ).toBeLessThanOrEqual(viewport.height)
    }
  }

  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/drum-night', { waitUntil: 'domcontentloaded' })
  await page
    .getByRole('button', { name: /Groove/ })
    .filter({ visible: true })
    .first()
    .click()
  await expect(
    page.getByRole('dialog', { name: 'Shape the groove' }),
  ).toBeVisible()

  await page.goto('/drum-night?view=score', {
    waitUntil: 'domcontentloaded',
  })
  const scoreTouchKit = page.getByRole('group', { name: 'Touch drum pads' })
  await expect(scoreTouchKit).toBeVisible()
  await expect(scoreTouchKit.getByRole('button')).toHaveCount(6)

  await page.setViewportSize({ width: 844, height: 390 })
  await page.goto('/drum-night?drawer=groove', {
    waitUntil: 'domcontentloaded',
  })
  const landscapeDrawer = page.getByRole('region', {
    name: 'Shape the groove',
  })
  await expect(landscapeDrawer).toBeVisible()
  await landscapeDrawer.getByRole('tab', { name: 'Kit' }).click()
  const kitDrawer = page.getByRole('region', { name: 'Choose the kit' })
  await expect(
    kitDrawer.getByRole('radio', { name: /Mercury Synth/i }),
  ).toBeVisible()
  const drawerGeometry = await kitDrawer.evaluate((element) => {
    const rect = element.getBoundingClientRect()
    return {
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
      left: rect.left,
      width: rect.width,
      height: rect.height,
    }
  })
  expect(drawerGeometry.top).toBeGreaterThanOrEqual(0)
  expect(drawerGeometry.left).toBeGreaterThanOrEqual(0)
  expect(drawerGeometry.right).toBeLessThanOrEqual(844)
  expect(drawerGeometry.bottom).toBeLessThanOrEqual(390)
  expect(drawerGeometry.width).toBeGreaterThan(0)
  expect(drawerGeometry.height).toBeGreaterThan(0)
})

test('keeps Drum projects lazy until explicit pointer intent and opens them audio-inert @smoke', async ({
  page,
}, testInfo) => {
  await instrumentFirstPaint(page)
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/drum-night?drawer=projects', {
    waitUntil: 'domcontentloaded',
  })

  await expect(page).toHaveURL(/drawer=groove/)
  await expect(page.getByTestId('drum-groove-editor')).toBeVisible()
  await expect(page.getByTestId('drum-project-library')).toHaveCount(0)
  expect(await loadedDrumPersistenceAssets(page)).toEqual([])
  expect(await boundaryCounts(page)).toEqual({
    audio: 0,
    database: 0,
    fetch: 0,
    interval: 0,
    midi: 0,
    mic: 0,
    oscillator: 0,
    raf: 0,
    timeout: 0,
    workers: 0,
  })
  await page.screenshot({
    path: testInfo.outputPath('drum-project-first-paint-1440x900.png'),
  })

  await clickWithRealMouse(
    page,
    page
      .getByTestId('drum-groove-editor')
      .getByRole('button', { name: 'Projects', exact: true }),
  )

  const library = page.getByTestId('drum-project-library')
  await expect(library).toBeVisible()
  await expect(page).toHaveURL(/drawer=projects/)
  await expect(
    page.getByRole('button', { name: 'Rack controls' }),
  ).toBeFocused()
  await expect(library.getByText('No saved grooves yet')).toBeVisible()
  const counts = await boundaryCounts(page)
  expect(counts.database).toBeGreaterThan(0)
  expect(await loadedDrumPersistenceAssets(page)).not.toEqual([])
  expect(counts.audio).toBe(0)
  expect(counts.fetch).toBe(0)
  expect(counts.midi).toBe(0)
  expect(counts.mic).toBe(0)
  expect(counts.oscillator).toBe(0)
  expect(counts.workers).toBe(0)
  await page.screenshot({
    path: testInfo.outputPath('drum-project-explicit-open-1440x900.png'),
  })
})

test('saves four prepared drafts, autosaves settings, and silently restores exact state @smoke', async ({
  page,
}, testInfo) => {
  const projectName = 'E2E Pocket Archive'
  await instrumentFirstPaint(page)
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/drum-night', { waitUntil: 'domcontentloaded' })
  const editor = await openDrumGrooveRack(page)
  const variationButtons = editor.getByRole('group', {
    name: 'Prepared groove variation',
  })
  const editedTomSteps: Record<string, number> = {}

  for (const [label, variantId] of [
    ['Classic', 'source'],
    ['Funk', 'tight'],
    ['Driving', 'loose'],
    ['Half-time', 'half-time'],
  ] as const) {
    await clickWithRealMouse(
      page,
      variationButtons.getByRole('button', { name: new RegExp(`^${label}`) }),
    )
    const emptyTom = editor
      .locator('[data-gm-key="48"]:not([data-hit-id])')
      .first()
    const stepIndex = Number(await emptyTom.getAttribute('data-step-index'))
    expect(Number.isSafeInteger(stepIndex)).toBe(true)
    editedTomSteps[variantId] = stepIndex
    await clickWithRealMouse(page, emptyTom)
    await expect(
      editor.locator(
        `[data-gm-key="48"][data-step-index="${stepIndex}"][data-hit-id]`,
      ),
    ).toBeVisible()
  }

  await clickWithRealMouse(
    page,
    editor
      .getByRole('group', { name: 'Swing amount' })
      .getByRole('button', { name: 'Triplet' }),
  )
  await clickWithRealMouse(
    page,
    editor
      .getByRole('group', { name: 'Groove density' })
      .getByRole('button', { name: 'Essential' }),
  )
  await saveCurrentDrumProject(page, projectName)
  const initialProject = await readDrumProjectProbe(page, projectName)
  if (initialProject === null) {
    throw new Error('Saved project was not written to IndexedDB')
  }

  await clickWithRealMouse(
    page,
    page.getByRole('button', { name: 'Rack controls' }),
  )
  await clickWithRealMouse(
    page,
    page.getByRole('button', { name: 'Close rack drawer' }),
  )
  await expect(page.locator('#drum-workbench')).toHaveAttribute(
    'aria-hidden',
    'true',
  )
  await clickWithRealMouse(
    page,
    page.getByRole('button', { name: 'Increase tempo' }),
  )
  await clickWithRealMouse(
    page,
    page.getByRole('button', { name: 'Increase tempo' }),
  )
  await clickWithRealMouse(
    page,
    page.getByRole('button', { name: 'Count-in: 4 audible beats' }),
  )
  await clickWithRealMouse(
    page,
    page.getByRole('button', { name: 'Playback click: off' }),
  )

  const timeline = page.getByTestId('drum-night-timeline')
  const seek = timeline.getByRole('slider', { name: 'Drum part position' })
  const markA = timeline.getByRole('button', {
    name: 'Set loop start A at the playhead',
  })
  const markB = timeline.getByRole('button', {
    name: 'Set loop end B at the playhead',
  })
  const loopStartPoint = await rangePoint(seek, 0.25)
  await page.mouse.click(loopStartPoint.x, loopStartPoint.y)
  await clickWithRealMouse(page, markA)
  const loopEndPoint = await rangePoint(seek, 0.75)
  await page.mouse.click(loopEndPoint.x, loopEndPoint.y)
  await clickWithRealMouse(page, markB)

  await openDrumGrooveRack(page)
  const workbench = page.locator('#drum-workbench')
  await clickWithRealMouse(page, workbench.getByRole('tab', { name: 'Mix' }))
  const hatsFamily = workbench
    .getByRole('group', { name: 'Kit pieces' })
    .getByRole('button', { name: /Hats/ })
  await clickWithRealMouse(page, hatsFamily)
  const hatsLevel = workbench.getByRole('slider', {
    name: 'Hats authored level',
  })
  const hatsBounds = await hatsLevel.boundingBox()
  if (hatsBounds === null) throw new Error('Hats level has no pointer bounds')
  await page.mouse.move(
    hatsBounds.x + hatsBounds.width,
    hatsBounds.y + hatsBounds.height / 2,
  )
  await page.mouse.down()
  await page.mouse.move(
    hatsBounds.x + hatsBounds.width * 0.37,
    hatsBounds.y + hatsBounds.height / 2,
    { steps: 6 },
  )
  await page.mouse.up()
  const expectedHatsPercent = Number(await hatsLevel.inputValue())
  await clickWithRealMouse(
    page,
    workbench.getByRole('button', { name: 'Mute authored Hats' }),
  )
  await clickWithRealMouse(page, workbench.getByRole('tab', { name: 'Groove' }))
  const liveEditor = page.getByTestId('drum-groove-editor')
  const extraTom = liveEditor
    .locator('[data-gm-key="48"]:not([data-hit-id])')
    .first()
  const extraTomStep = Number(await extraTom.getAttribute('data-step-index'))
  await clickWithRealMouse(page, extraTom)

  await expect
    .poll(
      async () =>
        (await readDrumProjectProbe(page, projectName))?.revision ?? -1,
    )
    .toBeGreaterThan(initialProject.revision)
  const persisted = await readDrumProjectProbe(page, projectName)
  if (persisted === null || persisted.loopRange === null) {
    throw new Error('Autosaved project did not retain its A/B range')
  }
  expect(persisted).toMatchObject({
    title: projectName,
    selectedVariantId: 'half-time',
    tempoBpm: 88,
    countInBeats: 0,
    clickEnabled: true,
    hats: {
      level: expectedHatsPercent / 100,
      muted: true,
    },
  })
  for (const [variantId, stepIndex] of Object.entries(editedTomSteps)) {
    expect(persisted.variants[variantId]?.tomSteps).toContain(stepIndex)
  }
  expect(persisted.variants['half-time']?.tomSteps).toContain(extraTomStep)
  expect(persisted.variants['half-time']).toMatchObject({
    swing: 1,
    density: 0.55,
  })

  await page.screenshot({
    path: testInfo.outputPath('drum-project-autosaved-1440x900.png'),
  })
  await page.reload({ waitUntil: 'domcontentloaded' })
  expect((await boundaryCounts(page)).database).toBe(0)
  expect((await boundaryCounts(page)).audio).toBe(0)

  await openDrumGrooveRack(page)
  expect((await boundaryCounts(page)).database).toBe(0)
  await clickWithRealMouse(
    page,
    page
      .getByTestId('drum-groove-editor')
      .getByRole('button', { name: 'Projects', exact: true }),
  )
  const library = page.getByTestId('drum-project-library')
  const savedRow = library
    .getByRole('list', { name: 'Saved drum projects' })
    .getByRole('listitem')
    .filter({ hasText: projectName })
  await clickWithRealMouse(
    page,
    savedRow.getByRole('button', { name: 'Open', exact: true }),
  )

  await expect(page).toHaveURL(/drawer=groove/)
  await expect(
    page.locator('#drum-workbench').getByRole('tab', { name: 'Groove' }),
  ).toBeFocused()
  await expect(page.getByTestId('drum-night-shell')).toHaveAttribute(
    'data-playing',
    'false',
  )
  await expect(
    page.getByRole('button', { name: 'Count-in: off' }),
  ).toHaveAttribute('aria-pressed', 'false')
  await expect(
    page.getByRole('button', { name: 'Playback click: on' }),
  ).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('[aria-label="Authored tempo"] strong')).toHaveText(
    '88',
  )
  await expect(
    timeline.getByRole('slider', { name: 'Loop start marker' }),
  ).toHaveAttribute('aria-valuenow', String(persisted.loopRange.startBeat))
  await expect(
    timeline.getByRole('slider', { name: 'Loop end marker' }),
  ).toHaveAttribute('aria-valuenow', String(persisted.loopRange.endBeat))

  const restoredEditor = page.getByTestId('drum-groove-editor')
  await expect(
    restoredEditor
      .getByRole('group', { name: 'Prepared groove variation' })
      .getByRole('button', { name: /^Half-time/ }),
  ).toHaveAttribute('aria-pressed', 'true')
  await expect(
    restoredEditor
      .getByRole('group', { name: 'Swing amount' })
      .getByRole('button', { name: 'Triplet' }),
  ).toHaveAttribute('aria-pressed', 'true')
  await expect(
    restoredEditor
      .getByRole('group', { name: 'Groove density' })
      .getByRole('button', { name: 'Essential' }),
  ).toHaveAttribute('aria-pressed', 'true')

  for (const [label, variantId] of [
    ['Classic', 'source'],
    ['Funk', 'tight'],
    ['Driving', 'loose'],
    ['Half-time', 'half-time'],
  ] as const) {
    await clickWithRealMouse(
      page,
      restoredEditor
        .getByRole('group', { name: 'Prepared groove variation' })
        .getByRole('button', { name: new RegExp(`^${label}`) }),
    )
    await expect(
      restoredEditor.locator(
        `[data-gm-key="48"][data-step-index="${editedTomSteps[variantId]}"][data-hit-id]`,
      ),
    ).toBeVisible()
  }

  await clickWithRealMouse(page, workbench.getByRole('tab', { name: 'Mix' }))
  await clickWithRealMouse(
    page,
    workbench
      .getByRole('group', { name: 'Kit pieces' })
      .getByRole('button', { name: /Hats/ }),
  )
  await expect(
    workbench.getByRole('slider', { name: 'Hats authored level' }),
  ).toHaveValue(String(expectedHatsPercent))
  await expect(
    workbench.getByRole('button', { name: 'Unmute authored Hats' }),
  ).toHaveAttribute('aria-pressed', 'true')
  expect((await boundaryCounts(page)).audio).toBe(0)
  await page.screenshot({
    path: testInfo.outputPath('drum-project-restored-1440x900.png'),
  })
})

test('recovers a failed autosave by retry or confirmed restore without activating audio @smoke', async ({
  page,
}, testInfo) => {
  const projectName = 'Autosave Recovery Pocket'
  await instrumentFirstPaint(page)
  await instrumentProjectWriteFailure(page)
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/drum-night', { waitUntil: 'domcontentloaded' })
  await openDrumGrooveRack(page)
  await saveCurrentDrumProject(page, projectName)
  const created = await readDrumProjectProbe(page, projectName)
  if (created === null) throw new Error('Recovery project was not created')

  await clickWithRealMouse(
    page,
    page.getByRole('button', { name: 'Rack controls' }),
  )
  await clickWithRealMouse(
    page,
    page.getByRole('button', { name: 'Close rack drawer' }),
  )
  await failNextProjectWrite(page)
  await clickWithRealMouse(
    page,
    page.getByRole('button', { name: 'Increase tempo' }),
  )
  await openDrumGrooveRack(page)
  const editor = page.getByTestId('drum-groove-editor')
  await expect(editor.getByText('Not saved · retry')).toBeVisible()
  const retry = editor.getByRole('button', { name: 'Try save again' })
  await expect(retry).toBeVisible()
  await clickWithRealMouse(page, retry)
  await expect(editor.getByText('Saved on this device')).toBeVisible()
  await expect
    .poll(async () => (await readDrumProjectProbe(page, projectName))?.tempoBpm)
    .toBe(86)

  await clickWithRealMouse(
    page,
    page.getByRole('button', { name: 'Close rack drawer' }),
  )
  await failNextProjectWrite(page)
  await clickWithRealMouse(
    page,
    page.getByRole('button', { name: 'Increase tempo' }),
  )
  await openDrumGrooveRack(page)
  await expect(editor.getByText('Not saved · retry')).toBeVisible()
  await clickWithRealMouse(
    page,
    editor.getByRole('button', { name: 'Projects', exact: true }),
  )
  const recoveryLibrary = page.getByTestId('drum-project-library')
  await expect(recoveryLibrary).toBeVisible()
  const recoveryRetry = recoveryLibrary.getByRole('button', {
    name: 'Try save again',
  })
  await expect(recoveryRetry).toBeFocused()
  await expect(recoveryRetry).toBeVisible()
  const restore = recoveryLibrary.getByRole('button', {
    name: 'Restore last saved',
  })
  await expect(restore).toBeVisible()
  await clickWithRealMouse(page, restore)

  const restoreDialog = recoveryLibrary.getByRole('alertdialog', {
    name: 'Restore last saved version?',
  })
  await expect(restoreDialog).toBeVisible()
  await expect(
    restoreDialog.getByRole('button', { name: 'Restore saved version' }),
  ).toBeFocused()
  await clickWithRealMouse(
    page,
    restoreDialog.getByRole('button', { name: 'Keep unsaved changes' }),
  )
  await expect(restoreDialog).toHaveCount(0)
  await expect(restore).toBeFocused()
  await expect(page.locator('[aria-label="Authored tempo"] strong')).toHaveText(
    '88',
  )
  await expect(recoveryRetry).toBeVisible()

  await clickWithRealMouse(page, restore)
  await clickWithRealMouse(
    page,
    restoreDialog.getByRole('button', { name: 'Restore saved version' }),
  )
  await expect(restoreDialog).toHaveCount(0)
  await expect(page.locator('[aria-label="Authored tempo"] strong')).toHaveText(
    '86',
  )
  await expect(editor.getByText('Saved on this device')).toBeVisible()
  await expect(
    page.locator('#drum-workbench').getByRole('tab', { name: 'Groove' }),
  ).toBeFocused()
  const restored = await readDrumProjectProbe(page, projectName)
  if (restored === null) throw new Error('Restored project row disappeared')
  expect(restored).toMatchObject({ tempoBpm: 86 })
  expect((await boundaryCounts(page)).audio).toBe(0)
  await page.screenshot({
    path: testInfo.outputPath('drum-project-autosave-recovery-1440x900.png'),
  })
})

test('erases only Drum projects and take history after scoped confirmation @smoke', async ({
  page,
}, testInfo) => {
  await instrumentFirstPaint(page)
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/drum-night', { waitUntil: 'domcontentloaded' })
  await openDrumGrooveRack(page)
  await saveCurrentDrumProject(page, 'Scoped Erase Pocket')
  await seedScopedEraseSentinels(page)
  expect(await readScopedDrumStorageProbe(page)).toEqual({
    projects: 1,
    takes: 1,
    unrelatedSettingPresent: true,
  })

  const library = page.getByTestId('drum-project-library')
  const erase = library.getByRole('button', {
    name: 'Erase Drum projects and takes',
  })
  await clickWithRealMouse(page, erase)
  const eraseDialog = library.getByRole('alertdialog', {
    name: 'Erase Drum projects and take history?',
  })
  await expect(eraseDialog).toBeVisible()
  await expect(
    eraseDialog.getByRole('button', { name: 'Erase Drum data' }),
  ).toBeFocused()
  await clickWithRealMouse(
    page,
    eraseDialog.getByRole('button', { name: 'Keep Drum data' }),
  )
  await expect(eraseDialog).toHaveCount(0)
  await expect(erase).toBeFocused()
  expect(await readScopedDrumStorageProbe(page)).toEqual({
    projects: 1,
    takes: 1,
    unrelatedSettingPresent: true,
  })

  await clickWithRealMouse(page, erase)
  await clickWithRealMouse(
    page,
    eraseDialog.getByRole('button', { name: 'Erase Drum data' }),
  )
  await expect(library.getByText('No saved grooves yet')).toBeVisible()
  await expect(erase).toBeFocused()
  await expect
    .poll(async () => readScopedDrumStorageProbe(page))
    .toEqual({
      projects: 0,
      takes: 0,
      unrelatedSettingPresent: true,
    })
  expect(
    await page.evaluate(() => ({
      background: localStorage.getItem('pitchperfect_drum_background'),
      kit: localStorage.getItem('mp.drumNight.kit.v1'),
      midiMap: localStorage.getItem('mp.drumNight.midiMapping.v2'),
    })),
  ).toEqual({
    background: 'drum-tape-room',
    kit: 'classic-gm',
    midiMap: JSON.stringify({ version: 2, profiles: [] }),
  })
  expect((await boundaryCounts(page)).audio).toBe(0)
  await page.screenshot({
    path: testInfo.outputPath('drum-project-scoped-erase-1440x900.png'),
  })
})

test('keeps imported MIDI outside the prepared-project boundary @smoke', async ({
  page,
}, testInfo) => {
  await instrumentFirstPaint(page)
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/drum-night?view=score', {
    waitUntil: 'domcontentloaded',
  })
  await clickWithRealMouse(
    page,
    page
      .getByRole('button', { name: 'Songs', exact: true })
      .filter({ visible: true })
      .first(),
  )
  const songs = page.getByRole('region', { name: 'Bring a song' })
  await songs.getByTestId('drum-play-along-file-drop-input').setInputFiles({
    name: 'ephemeral-drums.mid',
    mimeType: 'audio/midi',
    buffer: DRUM_SESSION_MIDI,
  })
  await expect(page.getByTestId('drum-night-shell')).toHaveAttribute(
    'data-import-status',
    'ready',
  )

  await clickWithRealMouse(
    page,
    page
      .getByRole('button', { name: 'Groove', exact: true })
      .filter({ visible: true })
      .first(),
  )
  const workbench = page.locator('#drum-workbench')
  await expect(workbench.getByText('Read-only imported part')).toBeVisible()
  await expect(page.getByTestId('drum-groove-editor')).toHaveCount(0)
  await expect(
    workbench.getByRole('button', { name: 'Save project', exact: true }),
  ).toHaveCount(0)
  await expect(
    workbench.getByRole('button', { name: 'Projects', exact: true }),
  ).toHaveCount(0)
  await expect(page).toHaveURL(/drawer=groove/)
  const counts = await boundaryCounts(page)
  // Songs intentionally initializes the shared, DB-backed source library.
  // The imported-part guard must not cross the separate Drum project/take
  // controllers merely because an authored source became active.
  expect(
    (await loadedDrumPersistenceAssets(page)).filter(
      (asset) => !/\/vendor-db-/.test(asset),
    ),
  ).toEqual([])
  expect(counts.audio).toBe(0)
  await page.screenshot({
    path: testInfo.outputPath('drum-project-import-guard-1440x900.png'),
  })
})

test('retains failed take evidence through retry and clears only a confirmed discard @smoke', async ({
  page,
}, testInfo) => {
  await instrumentTakeWriteFailure(page)
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/drum-night', { waitUntil: 'domcontentloaded' })
  await openDrumGrooveRack(page)
  await saveCurrentDrumProject(page, 'Take Recovery Pocket')
  await clickWithRealMouse(
    page,
    page.getByRole('button', { name: 'Rack controls' }),
  )
  await clickWithRealMouse(
    page,
    page.getByRole('button', { name: 'Close rack drawer' }),
  )
  await expect(page.locator('#drum-workbench')).toHaveAttribute(
    'aria-hidden',
    'true',
  )
  await clickWithRealMouse(
    page,
    page.getByRole('button', { name: 'Count-in: 4 audible beats' }),
  )

  const shell = page.getByTestId('drum-night-shell')
  const photoSnare = page
    .locator('[aria-label="Pocket Console drum kit"]')
    .getByRole('button', { name: /^Acoustic snare, key/i })
  const play = page
    .getByRole('button', { name: /^Play First Pocket take clock$/ })
    .filter({ visible: true })
  await clickWithRealMouse(page, play)
  await expect(shell).toHaveAttribute('data-playing', 'true')
  await clickWithRealMouse(page, photoSnare)
  await clickWithRealMouse(
    page,
    page
      .getByRole('button', { name: /^Pause First Pocket take clock$/ })
      .filter({ visible: true }),
  )

  const compactHistory = page
    .getByTestId('drum-take-history')
    .filter({ visible: true })
    .first()
  await expect(
    compactHistory.getByRole('button', { name: 'Finish take' }),
  ).toBeVisible()
  await failNextTakeWrite(page)
  await clickWithRealMouse(
    page,
    compactHistory.getByRole('button', { name: 'Finish take' }),
  )
  await expect(compactHistory.getByText('TAKE NOT SAVED')).toBeVisible()
  await expect(
    compactHistory.getByText('Your captured evidence is still here.'),
  ).toBeVisible()
  await expect(
    compactHistory.getByRole('button', { name: 'Try again' }),
  ).toBeVisible()

  await clickWithRealMouse(
    page,
    compactHistory.getByRole('button', { name: 'Try again' }),
  )
  await expect(
    compactHistory.getByText('TAKE SAVED', { exact: true }),
  ).toBeVisible()
  await expect(
    compactHistory.getByRole('heading', {
      name: 'Take saved on this device.',
    }),
  ).toBeVisible()

  await clickWithRealMouse(
    page,
    page
      .getByRole('button', { name: /^Play First Pocket take clock$/ })
      .filter({ visible: true }),
  )
  await clickWithRealMouse(page, photoSnare)
  await clickWithRealMouse(
    page,
    page
      .getByRole('button', { name: /^Pause First Pocket take clock$/ })
      .filter({ visible: true }),
  )
  await expect(
    compactHistory.getByRole('button', { name: 'Finish take' }),
  ).toBeVisible()
  await failNextTakeWrite(page)
  await clickWithRealMouse(
    page,
    compactHistory.getByRole('button', { name: 'Finish take' }),
  )
  await expect(compactHistory.getByText('TAKE NOT SAVED')).toBeVisible()
  await clickWithRealMouse(
    page,
    compactHistory.getByRole('button', { name: 'Discard take' }),
  )
  await expect(
    compactHistory.getByText('Discard this unsaved take?'),
  ).toBeVisible()
  await clickWithRealMouse(
    page,
    compactHistory.getByRole('button', { name: 'Yes, discard' }),
  )
  await expect(compactHistory).toHaveCount(0)
  await expect(page.locator('#drum-workbench')).toHaveAttribute(
    'aria-hidden',
    'true',
  )

  await clickWithRealMouse(
    page,
    page.getByRole('button', { name: 'Open take history' }),
  )
  const expandedHistory = page
    .getByTestId('drum-take-history')
    .filter({ visible: true })
    .last()
  await expect(
    expandedHistory.getByText('No take waiting to finish'),
  ).toBeVisible()
  const recentTakes = expandedHistory.getByRole('list', {
    name: 'Recent finished drum takes',
  })
  await expect(recentTakes).toBeVisible()
  await expect(recentTakes.getByRole('listitem')).toHaveCount(1)
  await recentTakes.scrollIntoViewIfNeeded()
  await page.screenshot({
    path: testInfo.outputPath('drum-take-retry-discard-1440x900.png'),
  })
})

test('keeps Projects pointer-safe, focused, and URL-synced across room sizes @smoke', async ({
  page,
}, testInfo) => {
  await instrumentFirstPaint(page)
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/drum-night', { waitUntil: 'domcontentloaded' })
  await openDrumGrooveRack(page)
  await saveCurrentDrumProject(page, 'Responsive Pocket')

  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
    { width: 844, height: 390 },
    { width: 320, height: 568 },
  ]) {
    await page.setViewportSize(viewport)
    await page.goto('/drum-night', { waitUntil: 'domcontentloaded' })
    const editor = await openDrumGrooveRack(page)
    await clickWithRealMouse(
      page,
      editor.getByRole('button', { name: 'Projects', exact: true }),
    )

    const drawer = page.locator('#drum-workbench')
    const library = page.getByTestId('drum-project-library')
    const back = page.getByRole('button', { name: 'Rack controls' })
    await expect(library).toBeVisible()
    await expect(page).toHaveURL(/drawer=projects/)
    await expect(back).toBeFocused()
    await expect(
      library.getByRole('heading', { name: 'Responsive Pocket' }),
    ).toBeVisible()
    const openSavedProject = library.getByRole('button', {
      name: 'Open',
      exact: true,
    })
    await openSavedProject.scrollIntoViewIfNeeded()
    const openBounds = await openSavedProject.boundingBox()
    if (openBounds === null) {
      throw new Error(
        `Saved-project action is unreachable at ${JSON.stringify(viewport)}`,
      )
    }
    expect(
      Math.round(openBounds.width),
      JSON.stringify(viewport),
    ).toBeGreaterThanOrEqual(44)
    expect(
      Math.round(openBounds.height),
      JSON.stringify(viewport),
    ).toBeGreaterThanOrEqual(44)
    expect(openBounds.y, JSON.stringify(viewport)).toBeGreaterThanOrEqual(0)
    expect(
      openBounds.y + openBounds.height,
      JSON.stringify(viewport),
    ).toBeLessThanOrEqual(viewport.height)

    await drawer.evaluate(async (element) => {
      await Promise.all(
        element
          .getAnimations()
          .map((animation) => animation.finished.catch(() => undefined)),
      )
    })
    const geometry = await library.evaluate((element) => {
      const drawer = element.closest<HTMLElement>('#drum-workbench')
      const drawerBounds = drawer?.getBoundingClientRect()
      const visibleButtons = [...element.querySelectorAll('button')].filter(
        (button) => {
          const bounds = button.getBoundingClientRect()
          const style = window.getComputedStyle(button)
          return (
            bounds.width > 0 &&
            bounds.height > 0 &&
            bounds.bottom > 0 &&
            bounds.right > 0 &&
            bounds.top < window.innerHeight &&
            bounds.left < window.innerWidth &&
            style.display !== 'none' &&
            style.visibility !== 'hidden'
          )
        },
      )
      return {
        documentClientWidth: document.documentElement.clientWidth,
        documentScrollWidth: document.documentElement.scrollWidth,
        drawerBottom: drawerBounds?.bottom ?? Number.POSITIVE_INFINITY,
        drawerLeft: drawerBounds?.left ?? Number.NEGATIVE_INFINITY,
        drawerRight: drawerBounds?.right ?? Number.POSITIVE_INFINITY,
        drawerTop: drawerBounds?.top ?? Number.NEGATIVE_INFINITY,
        libraryClientWidth: element.clientWidth,
        libraryScrollWidth: element.scrollWidth,
        undersizedButtons: visibleButtons.filter((button) => {
          const bounds = button.getBoundingClientRect()
          return Math.round(bounds.width) < 44 || Math.round(bounds.height) < 44
        }).length,
      }
    })
    expect(geometry.documentScrollWidth, JSON.stringify(viewport)).toBe(
      geometry.documentClientWidth,
    )
    expect(geometry.libraryScrollWidth, JSON.stringify(viewport)).toBe(
      geometry.libraryClientWidth,
    )
    expect(geometry.drawerTop, JSON.stringify(viewport)).toBeGreaterThanOrEqual(
      0,
    )
    expect(
      geometry.drawerLeft,
      JSON.stringify(viewport),
    ).toBeGreaterThanOrEqual(0)
    expect(geometry.drawerRight, JSON.stringify(viewport)).toBeLessThanOrEqual(
      viewport.width,
    )
    expect(geometry.drawerBottom, JSON.stringify(viewport)).toBeLessThanOrEqual(
      viewport.height,
    )
    expect(geometry.undersizedButtons, JSON.stringify(viewport)).toBe(0)
    expect((await boundaryCounts(page)).audio).toBe(0)

    await page.screenshot({
      path: testInfo.outputPath(
        `drum-projects-${viewport.width}x${viewport.height}.png`,
      ),
    })
    await clickWithRealMouse(page, back)
    const grooveTab = drawer.getByRole('tab', { name: 'Groove' })
    await expect(page).toHaveURL(/drawer=groove/)
    await expect(grooveTab).toHaveAttribute('aria-selected', 'true')
    await expect(grooveTab).toBeFocused()
  }
})
