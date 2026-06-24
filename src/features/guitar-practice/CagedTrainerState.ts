// ============================================================
// CagedTrainerState — CAGED position trainer state machine
// ============================================================

import type { Accessor } from 'solid-js'
import { createSignal } from 'solid-js'
import type { CagedShapeName, FretNote } from '@/lib/guitar/caged-shapes'
import { CAGED_ORDER, CAGED_SHAPES, computeShapeFrets, findRootForShape, viewRangeForFrets, } from '@/lib/guitar/caged-shapes'
import { KEY_OFFSETS } from '@/lib/scale-data'

export interface CagedTrainerState {
  activeShape: Accessor<CagedShapeName>
  activeChord: Accessor<string>
  highlightedFrets: Accessor<FretNote[]>
  viewFretRange: Accessor<[number, number]>
  setShape: (name: CagedShapeName) => void
  nextShape: () => void
  prevShape: () => void
  setChord: (chordName: string) => void
}

export function createCagedTrainer(): CagedTrainerState {
  const [activeShape, setActiveShape] = createSignal<CagedShapeName>('E')
  const [activeChord, setActiveChord] = createSignal('C')

  const highlightedFrets = (): FretNote[] => {
    const shape = CAGED_SHAPES[activeShape()]
    const chordRoot = activeChord()
    const rootOffset = KEY_OFFSETS[chordRoot] ?? 0
    // C base = 48 (C3)
    const rootMidi = findRootForShape(shape, 48 + rootOffset)
    return computeShapeFrets(shape, rootMidi)
  }

  const viewFretRange = (): [number, number] => {
    const frets = highlightedFrets().map((n) => n.fret)
    return frets.length > 0 ? viewRangeForFrets(frets) : [0, 7]
  }

  const setShape = (name: CagedShapeName) => setActiveShape(name)
  const nextShape = () => {
    const idx = CAGED_ORDER.indexOf(activeShape())
    setActiveShape(CAGED_ORDER[(idx + 1) % 5])
  }
  const prevShape = () => {
    const idx = CAGED_ORDER.indexOf(activeShape())
    setActiveShape(CAGED_ORDER[(idx + 4) % 5])
  }

  return {
    activeShape,
    activeChord,
    highlightedFrets,
    viewFretRange,
    setShape,
    nextShape,
    prevShape,
    setChord: setActiveChord,
  }
}
