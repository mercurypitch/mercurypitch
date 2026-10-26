// Studio retained audio — reserve staged immutable bytes until their owner releases them.
import { reserveStudioMemory } from '@/lib/studio/memory-budget'
import type { StudioAssetData } from '@/lib/studio/model/types'

export function createRetainedStudioAudio() {
  const entries = new Map<
    string,
    { data: StudioAssetData; release: () => void }
  >()

  function release(inputs: readonly StudioAssetData[]): void {
    for (const data of inputs) {
      const entry = entries.get(data.asset.id)
      if (entry?.data !== data) continue
      entry.release()
      entries.delete(data.asset.id)
    }
  }

  function retain(inputs: readonly StudioAssetData[]): void {
    const added: StudioAssetData[] = []
    try {
      for (const data of inputs) {
        const existing = entries.get(data.asset.id)
        if (existing?.data === data) continue
        if (existing !== undefined)
          throw new Error('Studio audio identity cannot change.')
        const unreserve = reserveStudioMemory(
          data.original.size + data.canonicalPcm.size,
        )
        entries.set(data.asset.id, { data, release: unreserve })
        added.push(data)
      }
    } catch (error) {
      release(added)
      throw error
    }
  }

  return {
    retain,
    release,
    values: () => [...entries.values()].map((entry) => entry.data),
    clear: () => release([...entries.values()].map((entry) => entry.data)),
  }
}
