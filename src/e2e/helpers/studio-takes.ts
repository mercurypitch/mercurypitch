// Studio takes for browser tests — a kept take read back from the page's database: its audio's loudest sample and first sound, how strong each asked-for tone is in it, and the notes kept beside it.
import { expect, type Page } from '@playwright/test'

/** Which take: by the name its file was kept under, or by its asset's id. */
export type StudioTakeMatch =
  | { readonly title: string }
  | { readonly assetId: string }

export interface StudioTakeRead {
  /** The tones to measure, in hertz. */
  readonly hz: readonly number[]
  /** Where to measure them: the second in the middle of the take, or half a second from its first sound. */
  readonly over: 'middle' | 'onset'
}

export interface StudioStoredTake {
  readonly assetId: string
  /** Its loudest sample, and the first frame anything sounds. */
  readonly peak: number
  readonly onset: number
  /** Each asked tone's amplitude where it was measured, in the order asked. */
  readonly tones: readonly number[]
  readonly notes: readonly {
    midi: number
    velocity: number
    startFrame: number
    endFrame: number
  }[]
}

/** The take `match` names, read once its copy is in the database. */
export async function storedTake(
  page: Page,
  match: StudioTakeMatch,
  read: StudioTakeRead,
): Promise<StudioStoredTake> {
  let take: StudioStoredTake | null = null
  await expect(async () => {
    take = await readTake(page, match, read)
  }).toPass({ timeout: 30_000 })
  return take!
}

function readTake(
  page: Page,
  match: StudioTakeMatch,
  read: StudioTakeRead,
): Promise<StudioStoredTake> {
  return page.evaluate(
    async ({ match, hz, over }) => {
      const database = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open('MercuryPitchDB')
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      })
      const get = <T>(store: string, key?: string) =>
        new Promise<T>((resolve, reject) => {
          const objects = database
            .transaction(store, 'readonly')
            .objectStore(store)
          const request =
            key === undefined ? objects.getAll() : objects.get(key)
          request.onsuccess = () => resolve(request.result as T)
          request.onerror = () => reject(request.error)
        })
      try {
        const assets = await get<
          {
            asset: {
              id: string
              originalName?: string
              canonicalPcmId: string
              canonicalPcmFormat?: 'int16'
              normalizedFrameCount: number
            }
          }[]
        >('studioAssets')
        const take = assets
          .map((row) => row.asset)
          .find((asset) =>
            'title' in match
              ? asset.originalName?.startsWith(match.title)
              : asset.id === match.assetId,
          )
        if (take === undefined)
          throw new Error(`No take ${JSON.stringify(match)}.`)
        const blobs =
          await get<{ id: string; data: ArrayBuffer }[]>('studioAssetBlobs')
        const data = blobs.find((row) => row.id === take.canonicalPcmId)!.data
        const frames = take.normalizedFrameCount
        // Planar after a 32-byte header: a recorded take's one channel.
        const samples =
          take.canonicalPcmFormat === 'int16'
            ? Float32Array.from(
                new Int16Array(data, 32, frames),
                (value) => value / 32768,
              )
            : new Float32Array(data, 32, frames)
        const row = await get<{ notes: StudioStoredTake['notes'] } | undefined>(
          'studioTakeNotes',
          take.id,
        )
        let peak = 0
        let onset = -1
        samples.forEach((value, frame) => {
          peak = Math.max(peak, Math.abs(value))
          if (onset < 0 && Math.abs(value) > 0.01) onset = frame
        })
        const from =
          over === 'onset'
            ? Math.max(0, onset)
            : Math.max(0, Math.floor(frames / 2) - 24_000)
        const length = over === 'onset' ? 24_000 : 48_000
        const window = samples.subarray(from, Math.min(frames, from + length))
        // A Goertzel filter at each tone.
        const amplitude = (tone: number) => {
          const w = (2 * Math.PI * tone) / 48_000
          const k = 2 * Math.cos(w)
          let s1 = 0
          let s2 = 0
          for (const x of window) {
            const s0 = x + k * s1 - s2
            s2 = s1
            s1 = s0
          }
          const re = s1 - s2 * Math.cos(w)
          const im = s2 * Math.sin(w)
          return (2 * Math.sqrt(re * re + im * im)) / window.length
        }
        return {
          assetId: take.id,
          peak,
          onset,
          tones: hz.map(amplitude),
          notes: row?.notes ?? [],
        }
      } finally {
        database.close()
      }
    },
    { match, hz: read.hz, over: read.over },
  )
}
