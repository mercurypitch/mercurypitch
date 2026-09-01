// ============================================================
// Percussion Identity — explicit General MIDI keys and source folds
// ============================================================
//
// A percussion number is an articulation, never a pitched note. This module
// owns the source-specific boundaries that may interpret a percussion number.
// Raw MIDI keys stay on the bounded General MIDI map. Only legacy Guitar Pro
// articulation ids may use the documented folds below; unknown values stay
// unknown instead of becoming a plausible but false snare hit.

export const GM_PERCUSSION_MIN = 35
export const GM_PERCUSSION_MAX = 81

const GM_PERCUSSION_CHOKE_TARGETS: ReadonlySet<number> = new Set([
  49, 51, 52, 55, 57, 59,
])

/** Chokes may stop only the six bounded GM cymbal lanes Guitar Pro maps. */
export function isGeneralMidiPercussionChokeTarget(gmKey: number): boolean {
  return GM_PERCUSSION_CHOKE_TARGETS.has(gmKey)
}

const GENERAL_MIDI_PERCUSSION_NAMES: Readonly<Record<number, string>> = {
  35: 'Acoustic Bass Drum',
  36: 'Bass Drum 1',
  37: 'Side Stick',
  38: 'Acoustic Snare',
  39: 'Hand Clap',
  40: 'Electric Snare',
  41: 'Low Floor Tom',
  42: 'Closed Hi-Hat',
  43: 'High Floor Tom',
  44: 'Pedal Hi-Hat',
  45: 'Low Tom',
  46: 'Open Hi-Hat',
  47: 'Low-Mid Tom',
  48: 'Hi-Mid Tom',
  49: 'Crash Cymbal 1',
  50: 'High Tom',
  51: 'Ride Cymbal 1',
  52: 'Chinese Cymbal',
  53: 'Ride Bell',
  54: 'Tambourine',
  55: 'Splash Cymbal',
  56: 'Cowbell',
  57: 'Crash Cymbal 2',
  58: 'Vibraslap',
  59: 'Ride Cymbal 2',
  60: 'Hi Bongo',
  61: 'Low Bongo',
  62: 'Mute Hi Conga',
  63: 'Open Hi Conga',
  64: 'Low Conga',
  65: 'High Timbale',
  66: 'Low Timbale',
  67: 'High Agogo',
  68: 'Low Agogo',
  69: 'Cabasa',
  70: 'Maracas',
  71: 'Short Whistle',
  72: 'Long Whistle',
  73: 'Short Guiro',
  74: 'Long Guiro',
  75: 'Claves',
  76: 'Hi Wood Block',
  77: 'Low Wood Block',
  78: 'Mute Cuica',
  79: 'Open Cuica',
  80: 'Mute Triangle',
  81: 'Open Triangle',
}

/**
 * Guitar Pro extends its articulation ids past General MIDI. These folds are
 * deliberate acoustic-family choices copied into app-owned data so a library
 * update cannot silently change what an imported score means.
 */
const EXTENDED_PERCUSSION_FOLDS: Readonly<Record<number, number>> = {
  29: 59,
  30: 49,
  31: 40,
  33: 37,
  34: 38,
  82: 70,
  83: 53,
  84: 53,
  85: 75,
  86: 41,
  87: 43,
  91: 38,
  92: 46,
  93: 51,
  94: 51,
  95: 55,
  96: 52,
  97: 49,
  98: 57,
  99: 56,
  100: 56,
  101: 56,
  102: 56,
  103: 56,
  104: 60,
  105: 60,
  106: 61,
  107: 61,
  108: 64,
  109: 64,
  110: 63,
  111: 54,
  112: 54,
  113: 54,
  114: 43,
  115: 49,
  116: 49,
  117: 69,
  118: 70,
  119: 70,
  120: 70,
  122: 70,
  123: 53,
  124: 62,
  125: 62,
  126: 59,
  127: 59,
}

/** Accept a raw Standard MIDI percussion key only when it is already GM. */
export function normalizeGeneralMidiPercussionKey(
  sourceValue: number,
): number | null {
  if (!Number.isInteger(sourceValue)) return null
  if (sourceValue >= GM_PERCUSSION_MIN && sourceValue <= GM_PERCUSSION_MAX) {
    return sourceValue
  }
  return null
}

/** Resolve a Guitar Pro articulation/output value onto the bounded GM map. */
export function normalizeGuitarProPercussionKey(
  sourceValue: number,
): number | null {
  const generalMidiKey = normalizeGeneralMidiPercussionKey(sourceValue)
  if (generalMidiKey !== null) return generalMidiKey
  if (!Number.isInteger(sourceValue)) return null
  return EXTENDED_PERCUSSION_FOLDS[sourceValue] ?? null
}

export function generalMidiPercussionName(gmKey: number): string {
  return GENERAL_MIDI_PERCUSSION_NAMES[gmKey] ?? `Percussion ${gmKey}`
}
