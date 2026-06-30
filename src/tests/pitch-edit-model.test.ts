import { describe, expect, it } from 'vitest'
import type { EditableNote } from '@/features/stem-mixer/pitch-edit-model'
import { applyEditLayer, deleteNote, editNote, emptyEditLayer, isEditLayerEmpty, mergeNotes, splitNote, } from '@/features/stem-mixer/pitch-edit-model'

const n = (
  id: string,
  startBeat: number,
  endBeat: number,
  midi: number,
): EditableNote => ({
  id,
  startBeat,
  endBeat,
  midi,
})

/** A base note list as the algorithm would produce it. */
const base = (): EditableNote[] => [
  n('base-0', 0, 1, 60),
  n('base-1', 1, 2, 62),
  n('base-2', 2, 4, 64),
]

const byTime = (notes: EditableNote[]) =>
  notes.map((x) => [x.startBeat, x.endBeat, x.midi])

describe('pitch-edit-model', () => {
  it('an empty layer passes the base through unchanged', () => {
    const layer = emptyEditLayer()
    expect(isEditLayerEmpty(layer)).toBe(true)
    expect(byTime(applyEditLayer(base(), layer))).toEqual([
      [0, 1, 60],
      [1, 2, 62],
      [2, 4, 64],
    ])
  })

  it('deleteNote suppresses the base note in that region', () => {
    const layer = deleteNote(emptyEditLayer(), n('base-1', 1, 2, 62))
    const eff = applyEditLayer(base(), layer)
    expect(byTime(eff)).toEqual([
      [0, 1, 60],
      [2, 4, 64],
    ])
  })

  it('retune pins the note at the same span with the new pitch', () => {
    const layer = editNote(emptyEditLayer(), n('base-1', 1, 2, 62), {
      midi: 63,
    })
    const eff = applyEditLayer(base(), layer)
    expect(byTime(eff)).toEqual([
      [0, 1, 60],
      [1, 2, 63], // retuned, base 62 suppressed
      [2, 4, 64],
    ])
  })

  it('move leaves no ghost at the original position', () => {
    const layer = editNote(emptyEditLayer(), n('base-0', 0, 1, 60), {
      startBeat: 5,
      endBeat: 6,
    })
    const eff = applyEditLayer(base(), layer)
    // The base note at [0,1] is gone; the moved note sits at [5,6].
    expect(byTime(eff)).toEqual([
      [1, 2, 62],
      [2, 4, 64],
      [5, 6, 60],
    ])
  })

  it('manual edits survive base regeneration (slider change)', () => {
    // Edit a note against one base, then re-run the algorithm (new array/ids).
    const layer = editNote(emptyEditLayer(), n('base-2', 2, 4, 64), {
      midi: 65,
    })
    const regenerated: EditableNote[] = [
      n('base-0', 0, 1, 60),
      n('base-1', 1, 2, 61), // base changed pitch here (cleanup moved it)
      n('base-2', 2, 4, 67), // base changed pitch here too
    ]
    const eff = applyEditLayer(regenerated, layer)
    // The manual [2,4]=65 survives and suppresses the regenerated base there;
    // untouched regions track the new base.
    expect(byTime(eff)).toEqual([
      [0, 1, 60],
      [1, 2, 61],
      [2, 4, 65],
    ])
  })

  it('splitNote produces two pinned halves', () => {
    const layer = splitNote(emptyEditLayer(), n('base-2', 2, 4, 64), 3)
    const eff = applyEditLayer(base(), layer)
    expect(byTime(eff)).toEqual([
      [0, 1, 60],
      [1, 2, 62],
      [2, 3, 64],
      [3, 4, 64],
    ])
  })

  it('mergeNotes joins two notes into one span', () => {
    const layer = mergeNotes(
      emptyEditLayer(),
      n('base-0', 0, 1, 60),
      n('base-1', 1, 2, 62),
    )
    const eff = applyEditLayer(base(), layer)
    expect(byTime(eff)).toEqual([
      [0, 2, 60], // merged, takes the earlier note's pitch
      [2, 4, 64],
    ])
  })

  it('editing a manual note again reuses its id (no duplicate)', () => {
    let layer = editNote(emptyEditLayer(), n('base-1', 1, 2, 62), { midi: 63 })
    const manualId = layer.manual[0].id
    layer = editNote(layer, layer.manual[0], { midi: 65 })
    expect(layer.manual.length).toBe(1)
    expect(layer.manual[0].id).toBe(manualId)
    expect(layer.manual[0].midi).toBe(65)
  })
})
