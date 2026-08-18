// ============================================================
// Badge art — the earned object, not a toolbar glyph
// ============================================================
//
// Badges used to render with the same SVG set as buttons and menu items,
// so an achievement someone worked for looked like an affordance. These
// are enamel medallions instead: one ring in the tier's metal (bronze /
// silver / gold) around an emblem that says which badge it is.
//
// Keyed by the row's `icon` string, NOT its id. Badge ids are UUIDs
// minted per database, so dev and prod disagree about the same badge;
// `icon` is authored in the seed and is the same everywhere.
//
// Any icon without art falls back to the SVG glyph, so seeding a new
// badge is never blocked on generating a picture for it.

/**
 * Icons with a drawn medallion in `public/badges/`.
 *
 * Sixteen badges plus twenty-seven achievement icons. Achievements share
 * icons — the 27 here cover all 46 achievements that had none — so this list
 * is shorter than the seed's row count and always will be.
 */
const BADGE_ART_ICONS = new Set([
  'leaf',
  'rocket',
  'guitar',
  'music',
  'fire',
  'star',
  'refresh',
  'volume',
  'piano',
  'mic',
  'trending',
  'target',
  'bolt',
  'sparkle',
  'crown',
  'chart',

  // Achievements. Drawn later and to the same recipe, but with no tier —
  // the seed gives achievements no tier at all, so every one of these is
  // gold where a badge would vary its metal.
  'calendarcheck',
  'century',
  'checkbadge',
  'coffee',
  'diamond',
  'dumbbell',
  'eagle',
  'flag',
  'flame2',
  'handshake',
  'layersplit',
  'listmusic',
  'medal',
  'microstand',
  'moon',
  'moonstars',
  'mountain',
  'notecluster',
  'paper',
  'quill',
  'share',
  'shelf',
  'stack',
  'sun',
  'sunrise',
  'trophy',
  'waveform',
])

/**
 * The medallion for a badge icon, or undefined when none is drawn yet.
 *
 * The asset is 192px square: three times the 64px box it renders in, so
 * a hi-DPI screen or a zoomed page still downscales rather than
 * stretching (see the image-sharpness playbook).
 */
export function badgeArtSrc(icon: string | undefined): string | undefined {
  if (icon === undefined || !BADGE_ART_ICONS.has(icon)) return undefined
  return `/badges/${icon}.webp`
}

/** True when every listed icon has art — used by the coverage test. */
export function badgeArtIcons(): readonly string[] {
  return [...BADGE_ART_ICONS]
}
