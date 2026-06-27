import { cellKey, cellNoteName, isFretMarker, } from '@/features/guitar-tab-3d/renderer/canvas2d/FretboardStrip'

describe('cellNoteName', () => {
  it('names the note at open-string MIDI + fret', () => {
    expect(cellNoteName(40, 0)).toBe('E') // low E open
    expect(cellNoteName(40, 5)).toBe('A') // 5th fret of low E
    expect(cellNoteName(64, 1)).toBe('F') // high e, 1st fret
  })
})

describe('isFretMarker', () => {
  it('marks the standard inlay positions', () => {
    expect(isFretMarker(3)).toBe(true)
    expect(isFretMarker(12)).toBe(true)
    expect(isFretMarker(4)).toBe(false)
    expect(isFretMarker(0)).toBe(false)
  })
})

describe('cellKey', () => {
  it('is unique per string/fret', () => {
    expect(cellKey(2, 5)).toBe('2:5')
    expect(cellKey(2, 5)).not.toBe(cellKey(5, 2))
  })
})
