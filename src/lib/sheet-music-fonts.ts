// VexFlow 5 draws SMuFL symbols as private-use text glyphs. Its bundled
// FontFace registrations load asynchronously, so the first SVG must wait for
// those faces on browsers that do not repaint already-created SVG text.

interface SheetMusicFontSet {
  load(font: string, text?: string): Promise<FontFace[]>
}

const REQUIRED_FONTS = [
  { css: '30pt Bravura', sample: '\uE0A4', name: 'Bravura' },
  { css: '10pt Academico', sample: '0123456789', name: 'Academico' },
] as const

/** Load and verify the two faces used by VexFlow's default engraving stack. */
export async function loadSheetMusicFonts(
  fonts: SheetMusicFontSet,
): Promise<void> {
  const loadedFaces = await Promise.all(
    REQUIRED_FONTS.map((font) => fonts.load(font.css, font.sample)),
  )
  const missing = REQUIRED_FONTS.filter(
    (_, index) => loadedFaces[index].length === 0,
  ).map((font) => font.name)

  if (missing.length > 0) {
    throw new Error(`Notation font unavailable: ${missing.join(', ')}`)
  }
}

let fontReadiness: Promise<void> | undefined

/**
 * Share one font-load operation across every mounted score. A failed load is
 * not cached, so navigating away and reopening notation can retry it.
 */
export function ensureSheetMusicFonts(): Promise<void> {
  if (typeof document === 'undefined' || document.fonts === undefined) {
    return Promise.resolve()
  }

  fontReadiness ??= loadSheetMusicFonts(document.fonts).catch(
    (error: unknown) => {
      fontReadiness = undefined
      throw error
    },
  )
  return fontReadiness
}
