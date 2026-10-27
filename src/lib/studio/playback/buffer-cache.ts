// Studio PCM cache — immutable shared buffers with pinned ownership and admitted transient copies.
import { CANONICAL_PCM_HEADER_BYTES, readCanonicalPcmBytes, } from '../audio/canonical-pcm'
import { importCheckpoint } from '../audio/import-limits'
import { registerStudioMemoryReclaimer, reserveStudioMemory, } from '../memory-budget'
import type { StudioAsset } from '../model/types'

const CACHE_BYTES = 384 * 1024 * 1024
const LITTLE_ENDIAN = new Uint8Array(new Uint32Array([1]).buffer)[0] === 1
interface Entry {
  buffer: AudioBuffer
  bytes: number
  pins: number
  release: () => void
}
export interface StudioBufferLease {
  buffers: ReadonlyMap<string, AudioBuffer>
  release(): void
}

async function copyCanonicalSamples(
  pcm: DataView<ArrayBuffer>,
  buffer: AudioBuffer,
  signal: AbortSignal,
): Promise<void> {
  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    if (LITTLE_ENDIAN) {
      buffer.copyToChannel(
        new Float32Array(
          pcm.buffer,
          pcm.byteOffset +
            CANONICAL_PCM_HEADER_BYTES +
            channel * buffer.length * 4,
          buffer.length,
        ),
        channel,
      )
      await importCheckpoint(signal)
      continue
    }
    const output = buffer.getChannelData(channel)
    for (let from = 0; from < output.length; from += 65536) {
      for (
        let frame = from;
        frame < Math.min(output.length, from + 65536);
        frame++
      ) {
        output[frame] = pcm.getFloat32(
          CANONICAL_PCM_HEADER_BYTES + (channel * output.length + frame) * 4,
          true,
        )
      }
      await importCheckpoint(signal)
    }
  }
}

export function createStudioBufferCache() {
  const entries = new Map<string, Entry>()
  let bytes = 0
  let disposed = false
  let loading = false
  let clearPending = false
  // Buffers no run is playing are the first memory an import or save may take.
  const unregister = registerStudioMemoryReclaimer(() => evict(true))
  const key = (asset: StudioAsset) =>
    `${asset.canonicalPcmSha256}:${asset.channels}:${asset.normalizedFrameCount}`

  function evict(all = false, keep?: ReadonlySet<string>): void {
    for (const [id, entry] of entries) {
      if (
        entry.pins ||
        keep?.has(id) === true ||
        (!all && bytes <= CACHE_BYTES)
      )
        continue
      entries.delete(id)
      bytes -= entry.bytes
      entry.release()
    }
  }

  async function loadEntry(
    asset: StudioAsset,
    ctx: BaseAudioContext,
    read: (id: string) => Promise<Blob>,
    signal: AbortSignal,
  ): Promise<Entry> {
    const size = asset.normalizedFrameCount * asset.channels * 4
    const release = reserveStudioMemory(size)
    let releaseTransient: (() => void) | undefined
    try {
      releaseTransient = reserveStudioMemory(asset.canonicalPcmByteLength * 2)
      const blob = await read(asset.id)
      signal.throwIfAborted()
      const pcm = new DataView(
        await readCanonicalPcmBytes(blob, asset, { signal }),
      )
      signal.throwIfAborted()
      if (disposed) throw new DOMException('Studio closed', 'AbortError')
      const buffer = ctx.createBuffer(
        asset.channels,
        asset.normalizedFrameCount,
        48000,
      )
      await copyCanonicalSamples(pcm, buffer, signal)
      if (disposed) throw new DOMException('Studio closed', 'AbortError')
      const entry = { buffer, bytes: size, pins: 0, release }
      entries.set(key(asset), entry)
      bytes += size
      return entry
    } catch (error) {
      release()
      throw error
    } finally {
      releaseTransient?.()
    }
  }

  async function acquire(
    assets: readonly StudioAsset[],
    ctx: BaseAudioContext,
    read: (id: string) => Promise<Blob>,
    signal: AbortSignal,
  ): Promise<StudioBufferLease> {
    if (disposed || loading)
      throw new Error('Studio audio is still preparing. Try again in a moment.')
    loading = true
    clearPending = false
    const pinned: Entry[] = []
    const buffers = new Map<string, AudioBuffer>()
    try {
      const unique = new Map(assets.map((asset) => [key(asset), asset]))
      evict(true, new Set(unique.keys()))
      const required = [...unique.values()].reduce(
        (total, asset) =>
          total + asset.normalizedFrameCount * asset.channels * 4,
        0,
      )
      if (required > CACHE_BYTES)
        throw new Error(
          'This arrangement needs too much memory to play. Use shorter takes.',
        )
      for (const asset of assets) {
        signal.throwIfAborted()
        const id = key(asset)
        const entry =
          entries.get(id) ?? (await loadEntry(asset, ctx, read, signal))
        entry.pins++
        pinned.push(entry)
        buffers.set(asset.id, entry.buffer)
      }
      let released = false
      return {
        buffers,
        release() {
          if (released) return
          released = true
          for (const entry of pinned) entry.pins--
          evict(disposed || clearPending)
        },
      }
    } catch (error) {
      for (const entry of pinned) entry.pins--
      evict(true)
      throw error
    } finally {
      loading = false
    }
  }

  return {
    acquire,
    clear() {
      clearPending = true
      evict(true)
    },
    dispose() {
      disposed = true
      unregister()
      evict(true)
    },
  }
}

export type StudioBufferCache = ReturnType<typeof createStudioBufferCache>
