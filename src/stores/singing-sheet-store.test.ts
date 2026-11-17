import { beforeEach, describe, expect, it } from 'vitest'
import { keyName, scaleType, setKeyName, setScaleType, } from '@/stores/app-store'
import { melodyStore } from '@/stores/melody-store'
import { openSingingSheet, resetAddressedSheetKey, takeAddressedSheetKey, } from '@/stores/singing-sheet-store'
import { setSingingSheetView, singingSheetView } from '@/stores/ui-store'
import type { MelodyData } from '@/types'

/** The do of the roll's grid: the scale is built high to low, do last. */
const gridDo = (): string => {
  const scale = melodyStore.currentScale()
  return scale[scale.length - 1].name
}

/** The app's first melody, as the seed gives it: a C major scale from C3. */
function seedMelody(): MelodyData {
  melodyStore.seedDefaultSession()
  const melody = melodyStore.currentMelody()
  if (melody === null) throw new Error('the seed set no melody')
  return melody
}

/** What App does when a melody is in: mirror its key, then hand an address's on. */
function mirrorMelody(melody: MelodyData): void {
  setKeyName(melody.key)
  setScaleType(melody.scaleType)
  takeAddressedSheetKey()
}

beforeEach(() => {
  melodyStore.setCurrentMelody(null)
  setKeyName('C')
  setScaleType('major')
  melodyStore.refreshScale('C', 3, 'major')
  setSingingSheetView(false)
  resetAddressedSheetKey()
})

describe('openSingingSheet in a running app', () => {
  it('shows the sheet and reads the tab in the key the address names', () => {
    mirrorMelody(seedMelody())

    openSingingSheet('Bb', null)

    expect(singingSheetView()).toBe(true)
    expect([keyName(), scaleType()]).toEqual(['Bb', 'major'])
    expect(gridDo()).toBe('A#')
  })

  it('leaves the melody where it was, as the key picker does on this tab', () => {
    const melody = seedMelody()
    mirrorMelody(melody)
    const before = melody.items.map((item) => item.note.midi)

    openSingingSheet('G', null)

    expect(melodyStore.getCurrentItems().map((item) => item.note.midi)).toEqual(
      before,
    )
  })

  it('reads a minor key by its own do', () => {
    mirrorMelody(seedMelody())

    openSingingSheet('A', 'harmonic-minor')

    expect([keyName(), scaleType()]).toEqual(['A', 'harmonic-minor'])
    expect(gridDo()).toBe('A')
  })

  it('shows the sheet in the key the tab has when the address names none', () => {
    mirrorMelody(seedMelody())
    setKeyName('D')

    openSingingSheet(null, null)

    expect(singingSheetView()).toBe(true)
    expect([keyName(), scaleType()]).toEqual(['D', 'major'])
  })

  it('shows the sheet and keeps the key when the address misspells one', () => {
    mirrorMelody(seedMelody())
    setKeyName('D')

    openSingingSheet('H', null)

    expect(singingSheetView()).toBe(true)
    expect(keyName()).toBe('D')
  })

  it('lets the melody the singer loads next keep its own key', () => {
    const melody = seedMelody()
    mirrorMelody(melody)
    openSingingSheet('G', null)

    mirrorMelody({ ...melody, key: 'A' })

    expect(keyName()).toBe('A')
  })
})

describe('openSingingSheet while the page boots', () => {
  it('outlasts the first melody, seeded after the address was read', () => {
    // A first visit: the route is read with no melody in.
    openSingingSheet('G', null)
    expect(singingSheetView()).toBe(true)

    mirrorMelody(seedMelody())

    expect([keyName(), scaleType()]).toEqual(['G', 'major'])
    expect(gridDo()).toBe('G')
  })

  it('outlasts the first melody, restored before the address was read', () => {
    // A later visit: the last melody is back before the route is read, and
    // App mirrors its key in the same pass, after the route.
    const melody = seedMelody()
    openSingingSheet('D', null)
    expect(keyName()).toBe('D')

    mirrorMelody({ ...melody, key: 'G' })

    expect([keyName(), scaleType()]).toEqual(['D', 'major'])
    expect(gridDo()).toBe('D')
  })

  it('hands the key on once: a melody loaded later keeps its own', () => {
    const melody = seedMelody()
    openSingingSheet('G', null)
    mirrorMelody(melody)

    mirrorMelody({ ...melody, key: 'A' })

    expect(keyName()).toBe('A')
  })
})
