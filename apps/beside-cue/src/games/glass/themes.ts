// ============================================================
// Stage themes — the skin layer of the art pass.
//
// One game, several looks: each theme is an asset directory (backdrop
// parallax layers + slab material tiles, fixed file names) plus a
// palette for every color the stage draws with meaning. Merc himself
// never changes — he is the brand; the world dresses around him.
// Direction per 2026 mobile rhythm-game practice: a painterly
// atmospheric default, a neon retro arcade, a clean light minimal, and
// an elegant ink wash — the player picks under "Stage look".
// ============================================================

export interface StagePalette {
  /** Canvas base fill behind the parallax layers. */
  base: string
  /** rgb triple for the bottom "seat" gradient (alpha applied in code). */
  seatRgb: string
  /** Slab body fills. */
  slabStone: string
  slabGlass: string
  /** Lit accents. */
  accentStone: string
  accentGlass: string
  /** Unlit top-edge rgb triples (alpha applied in code). */
  edgeStoneRgb: string
  edgeGlassRgb: string
  /** Faint underside outline (full rgba). */
  undersideStone: string
  undersideGlass: string
  /** The active slab's top edge. */
  activeEdge: string
  /** Note-name labels (rgb; alpha from code). */
  labelRgb: string
  /** Karaoke syllables, their underline, and the melody ribbon (rgb). */
  syllableRgb: string
  /** Objective guide line and its note text (rgb). */
  guideRgb: string
  guideTextRgb: string
  /** Rhythm approach ring (rgb). */
  ringRgb: string
}

export interface StageTheme {
  id: string
  /** Button label on the games list. */
  name: string
  /** Asset directory under public/ holding sky-far / nebula-mid /
   * dust-near / stone-tex / crystal-tex (webp, fixed names). */
  dir: string
  /** Optional per-theme blend strengths (default JOURNEY_CONFIG.art). */
  art?: { nebulaAlpha?: number; dustAlpha?: number }
  palette: StagePalette
}

const COSMOS: StageTheme = {
  id: 'cosmos',
  name: 'Cosmos',
  dir: 'games/journey',
  palette: {
    base: '#05060b',
    seatRgb: '5,6,11',
    slabStone: 'rgba(27,32,48,0.97)',
    slabGlass: 'rgba(16,34,52,0.92)',
    accentStone: '#2dd4bf',
    accentGlass: '#7ee7ff',
    edgeStoneRgb: '88,166,255',
    edgeGlassRgb: '126,231,255',
    undersideStone: 'rgba(45,212,191,0.2)',
    undersideGlass: 'rgba(126,231,255,0.22)',
    activeEdge: 'rgba(88,166,255,0.95)',
    labelRgb: '230,237,243',
    syllableRgb: '45,212,191',
    guideRgb: '88,166,255',
    guideTextRgb: '148,197,255',
    ringRgb: '255,209,102',
  },
}

const NEON: StageTheme = {
  id: 'neon',
  name: 'Neon',
  dir: 'games/journey/themes/neon',
  art: { nebulaAlpha: 0.5, dustAlpha: 0.6 },
  palette: {
    base: '#0a0514',
    seatRgb: '10,5,20',
    slabStone: 'rgba(24,16,38,0.97)',
    slabGlass: 'rgba(34,10,44,0.92)',
    accentStone: '#22d3ee',
    accentGlass: '#ff4fd8',
    edgeStoneRgb: '34,211,238',
    edgeGlassRgb: '255,79,216',
    undersideStone: 'rgba(34,211,238,0.2)',
    undersideGlass: 'rgba(255,79,216,0.25)',
    activeEdge: 'rgba(34,211,238,0.95)',
    labelRgb: '240,235,255',
    syllableRgb: '255,110,199',
    guideRgb: '34,211,238',
    guideTextRgb: '150,230,255',
    ringRgb: '255,238,88',
  },
}

const DAYLIGHT: StageTheme = {
  id: 'daylight',
  name: 'Daylight',
  dir: 'games/journey/themes/daylight',
  art: { nebulaAlpha: 0.3, dustAlpha: 0.35 },
  palette: {
    base: '#f6f1e7',
    seatRgb: '222,213,196',
    slabStone: 'rgba(31,41,55,0.96)',
    slabGlass: 'rgba(140,205,200,0.95)',
    accentStone: '#0d9488',
    accentGlass: '#0ea5b7',
    edgeStoneRgb: '13,116,128',
    edgeGlassRgb: '14,140,150',
    undersideStone: 'rgba(31,41,55,0.35)',
    undersideGlass: 'rgba(14,140,150,0.3)',
    activeEdge: 'rgba(37,99,235,0.95)',
    labelRgb: '31,41,55',
    syllableRgb: '13,148,136',
    guideRgb: '37,99,235',
    guideTextRgb: '30,64,175',
    ringRgb: '217,119,6',
  },
}

const INKWASH: StageTheme = {
  id: 'inkwash',
  name: 'Inkwash',
  dir: 'games/journey/themes/inkwash',
  palette: {
    base: '#0b0e1a',
    seatRgb: '11,14,26',
    slabStone: 'rgba(22,26,44,0.97)',
    slabGlass: 'rgba(30,42,38,0.92)',
    accentStone: '#d4af37',
    accentGlass: '#a8e6cf',
    edgeStoneRgb: '212,175,55',
    edgeGlassRgb: '168,230,207',
    undersideStone: 'rgba(212,175,55,0.22)',
    undersideGlass: 'rgba(168,230,207,0.25)',
    activeEdge: 'rgba(212,175,55,0.95)',
    labelRgb: '226,222,210',
    syllableRgb: '212,175,55',
    guideRgb: '140,150,190',
    guideTextRgb: '170,180,215',
    ringRgb: '212,175,55',
  },
}

export const STAGE_THEMES: StageTheme[] = [COSMOS, NEON, DAYLIGHT, INKWASH]

export const THEME_KEY = 'beside-cue:games:stage-theme'

export const resolveTheme = (id?: string | null): StageTheme =>
  STAGE_THEMES.find((t) => t.id === id) ?? COSMOS

export const readStoredTheme = (): string => {
  try {
    return resolveTheme(window.localStorage.getItem(THEME_KEY)).id
  } catch {
    return COSMOS.id
  }
}
