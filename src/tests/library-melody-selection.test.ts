import type { Setter } from 'solid-js'
import { createRoot, createSignal } from 'solid-js'
import { describe, expect, it, vi } from 'vitest'
import { useLibraryMelodySelection } from '@/features/practice/useLibraryMelodySelection'
import type { MelodyData } from '@/types'

function melody(id: string, itemCount = 1): MelodyData {
  return {
    id,
    name: `Melody ${id}`,
    bpm: 120,
    key: 'C',
    scaleType: 'major',
    createdAt: 1,
    updatedAt: 1,
    items: Array.from({ length: itemCount }, (_, index) => ({
      id: index,
      note: { midi: 60, name: 'C', freq: 261.63, octave: 4 },
      startBeat: index,
      duration: 1,
    })),
  }
}

describe('useLibraryMelodySelection', () => {
  it('ignores mount state and forwards later non-empty selections', async () => {
    const onSelection = vi.fn()
    let dispose!: () => void
    let selectMelody!: Setter<MelodyData | null>
    createRoot((rootDispose) => {
      const [current, setMelody] = createSignal<MelodyData | null>(
        melody('initial'),
      )
      dispose = rootDispose
      selectMelody = setMelody
      useLibraryMelodySelection(current, onSelection)
    })

    await Promise.resolve()
    expect(onSelection).not.toHaveBeenCalled()
    selectMelody(melody('selected'))
    expect(onSelection).toHaveBeenCalledTimes(1)
    expect(onSelection).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'selected' }),
    )

    selectMelody(melody('empty', 0))
    expect(onSelection).toHaveBeenCalledTimes(1)
    dispose()
  })
})
