// ============================================================
// Guitar Pro Percussion — source articulation to bounded GM identity
// ============================================================
//
// Modern GP files store an index into track.percussionArticulations. Legacy
// GP/GPX files store a direct articulation id in the same Note property. Zero
// is a valid modern index, so truthiness is never used to distinguish them.

import type { MidiSongPercussionAccent, MidiSongPercussionArticulation, MidiSongPercussionSource, } from '@/lib/midi-song'
import { generalMidiPercussionName, isGeneralMidiPercussionChokeTarget, normalizeGuitarProPercussionKey, } from '@/lib/percussion'

export interface GuitarProInstrumentArticulationLike {
  id: number
  elementType: string
  staffLine: number
  outputMidiNumber: number
  noteHeadDefault: number
  techniqueSymbol: number
}

export interface GuitarProPercussionTrackLike {
  percussionArticulations: readonly GuitarProInstrumentArticulationLike[]
}

export interface ResolvedGuitarProPercussion {
  gmKey: number
  articulation?: MidiSongPercussionArticulation
  source: MidiSongPercussionSource
}

const GUITAR_PRO_CHOKE_IDENTITIES: ReadonlySet<number> = new Set([
  29, 94, 95, 96, 97, 98,
])

function isGuitarProChokeIdentity(value: number): boolean {
  return GUITAR_PRO_CHOKE_IDENTITIES.has(value)
}

const LEGACY_ARTICULATION_LABELS: Readonly<Record<number, string>> = {
  29: 'Ride choke',
  30: 'Reverse cymbal',
  31: 'Sticks',
  33: 'Metronome click',
  34: 'Metronome bell',
  82: 'Shaker',
  83: 'Jingle bell',
  84: 'Bell tree',
  85: 'Castanets',
  86: 'Surdo',
  87: 'Muted surdo',
  91: 'Snare rim shot',
  92: 'Half-open hi-hat',
  93: 'Ride edge',
  94: 'Ride choke',
  95: 'Splash choke',
  96: 'China choke',
  97: 'High crash choke',
  98: 'Medium crash choke',
  99: 'Low cowbell',
  100: 'Low cowbell tip',
  101: 'Medium cowbell tip',
  102: 'High cowbell',
  103: 'High cowbell tip',
  104: 'High hand drum mute',
  105: 'High hand drum slap',
  106: 'Low hand drum mute',
  107: 'Low hand drum slap',
  108: 'Low conga slap',
  109: 'Low conga mute',
  110: 'High conga slap',
  111: 'Tambourine return',
  112: 'Tambourine roll',
  113: 'Tambourine hand',
  114: 'Grancassa',
  115: 'Piatti hit',
  116: 'Piatti hand',
  117: 'Cabasa return',
  118: 'Left maraca return',
  119: 'Right maraca',
  120: 'Right maraca return',
  122: 'Shaker return',
  123: 'Bell tree return',
  124: 'Golpe thumb',
  125: 'Golpe finger',
  126: 'Ride 2 middle',
  127: 'Ride 2 bell',
}

function directLegacyArticulation(
  articulationId: number,
): ResolvedGuitarProPercussion | null {
  const gmKey = normalizeGuitarProPercussionKey(articulationId)
  if (gmKey === null) return null
  return {
    gmKey,
    ...(isGuitarProChokeIdentity(articulationId)
      ? { articulation: 'choke' as const }
      : {}),
    source: {
      format: 'guitar-pro',
      articulationId,
      label:
        LEGACY_ARTICULATION_LABELS[articulationId] ??
        generalMidiPercussionName(gmKey),
    },
  }
}

/** Resolve one alphaTab percussion value without ever reading realValue. */
export function resolveGuitarProPercussion(
  track: GuitarProPercussionTrackLike,
  articulationValue: number,
): ResolvedGuitarProPercussion | null {
  if (!Number.isInteger(articulationValue) || articulationValue < 0) {
    return null
  }

  // Legacy GP/GPX stores a direct articulation id and exposes no modern
  // articulation table. Once a table exists, the authored value is strictly
  // an index: an out-of-range index is corrupt/unsupported, never a legacy id.
  if (track.percussionArticulations.length === 0) {
    return directLegacyArticulation(articulationValue)
  }
  const articulation = track.percussionArticulations[articulationValue]
  if (articulation === undefined) return null

  const gmKey = normalizeGuitarProPercussionKey(articulation.outputMidiNumber)
  if (gmKey === null) return null
  const label = articulation.elementType.trim()
  return {
    gmKey,
    ...(isGeneralMidiPercussionChokeTarget(gmKey) &&
    (isGuitarProChokeIdentity(articulation.id) ||
      isGuitarProChokeIdentity(articulation.outputMidiNumber))
      ? { articulation: 'choke' as const }
      : {}),
    source: {
      format: 'guitar-pro',
      articulationId: articulation.id,
      articulationIndex: articulationValue,
      midiKey: articulation.outputMidiNumber,
      label: label === '' ? generalMidiPercussionName(gmKey) : label,
      staffLine: articulation.staffLine,
      noteHead: articulation.noteHeadDefault,
      technique: articulation.techniqueSymbol,
    },
  }
}

/** Preserve the three authored alphaTab accent identities without inference. */
export function guitarProAccent(
  accentuation: number,
): MidiSongPercussionAccent | undefined {
  if (accentuation === 1) return 'normal'
  if (accentuation === 2) return 'heavy'
  if (accentuation === 3) return 'tenuto'
  return undefined
}

/** alphaTab's authored dynamic and accent converted to its playback velocity. */
export function guitarProDynamicVelocity(
  dynamic: number,
  accent?: MidiSongPercussionAccent,
): number {
  const direct: Readonly<Record<number, number>> = {
    0: 15,
    1: 31,
    2: 47,
    3: 63,
    4: 79,
    5: 95,
    6: 111,
    7: 127,
    8: 10,
    9: 5,
    10: 3,
    11: 127,
    12: 127,
    13: 127,
    14: 111,
    15: 111,
    16: 111,
    17: 95,
    18: 95,
    19: 95,
    20: 111,
    21: 95,
    22: 111,
    23: 1,
    24: 87,
    25: 111,
  }
  const adjustment = accent === 'normal' ? 16 : accent === 'heavy' ? 32 : 0
  return Math.min(127, Math.max(1, (direct[dynamic] ?? 79) + adjustment))
}
