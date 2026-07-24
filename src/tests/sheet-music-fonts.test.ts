import { describe, expect, it, vi } from 'vitest'
import { loadSheetMusicFonts } from '@/lib/sheet-music-fonts'

describe('sheet music font loading', () => {
  it('loads the notation and supporting text faces before rendering', async () => {
    const face = {} as FontFace
    const load = vi.fn().mockResolvedValue([face])

    await loadSheetMusicFonts({ load })

    expect(load).toHaveBeenNthCalledWith(1, '30pt Bravura', '\uE0A4')
    expect(load).toHaveBeenNthCalledWith(2, '10pt Academico', '0123456789')
  })

  it('rejects when the required music face is not registered', async () => {
    const load = vi
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{} as FontFace])

    await expect(loadSheetMusicFonts({ load })).rejects.toThrow(
      'Notation font unavailable: Bravura',
    )
  })
})
