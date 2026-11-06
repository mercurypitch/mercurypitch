// ============================================================
// Instrument resolver — the glyph a track draws, from what the track says about itself
// ============================================================
//
// In order: the instrument the singer chose; import evidence (a General MIDI
// percussion key, drum kit or program, or a separated stem); the track's or
// its file's name, when the name's family fits the track's mix role or the
// role is `other`; the role's own glyph; plain audio. An explicit role beats a
// stale file name: a voice lane named "Guitar take 3" keeps the microphone,
// while an `other` lane named "Kick_In.wav" draws the kick. A name that says
// only the family ("Guitar", "Keys", "Vocals") leaves a role its own glyph:
// an electric guitar lane named "Guitar" keeps the electric guitar.
//
// A chosen id this build does not draw (a song saved by a newer Studio with
// more glyphs) is passed over, so the lane draws what the rest says.
import type { TrackRole } from '@/lib/studio-fx/role-chains'
import type { InstrumentFamilyId, InstrumentGlyphId } from './glyph-catalog'
import { instrumentGlyph, isInstrumentGlyph } from './glyph-catalog'
import { GM_DRUM_KIT_GLYPHS, GM_PERCUSSION_KEY_GLYPHS, GM_PROGRAM_GLYPHS, ROLE_GLYPHS, STEM_GLYPHS, } from './import-sources'
import { readInstrumentName } from './name-rules'

/** Where a resolved glyph came from; `unknown` is plain audio, said by nothing more. */
export type InstrumentSource = 'chosen' | 'import' | 'name' | 'role' | 'unknown'

export interface ResolvedInstrument {
  readonly glyph: InstrumentGlyphId
  readonly family: InstrumentFamilyId
  readonly from: InstrumentSource
}

export interface InstrumentEvidence {
  /** The instrument the singer picked. */
  readonly chosen?: string | null
  /** A split kit piece's General MIDI key, 35 to 81. */
  readonly gmPercussionKey?: number | null
  /** A percussion track's kit program. */
  readonly gmDrumKit?: number | null
  /** A melodic track's General MIDI program, 0 to 127. */
  readonly gmProgram?: number | null
  readonly stem?: string | null
  /** The track's name, then its file's: the first a rule speaks for wins. */
  readonly names?: readonly (string | null | undefined)[]
  readonly role?: TrackRole
}

/** The families a role's name may refine; `other` takes any. */
const ROLE_FAMILIES: Readonly<
  Record<TrackRole, readonly InstrumentFamilyId[] | null>
> = {
  voice: ['voice'],
  'backing-vocals': ['voice'],
  'acoustic-guitar': ['plucked'],
  'electric-guitar': ['plucked'],
  bass: ['bass'],
  piano: ['keys'],
  keys: ['keys', 'synth'],
  drums: ['drums', 'percussion', 'pitched-percussion'],
  backing: ['backing'],
  other: null,
}

function own(
  glyph: InstrumentGlyphId,
  from: InstrumentSource,
  family = instrumentGlyph(glyph).family,
): ResolvedInstrument {
  return { glyph, family, from }
}

const inRange = (value: number | null | undefined, low: number, high: number) =>
  typeof value === 'number' &&
  Number.isInteger(value) &&
  value >= low &&
  value <= high

/** What an import's MIDI or stem data says, if anything. */
export function instrumentFromImport(
  evidence: InstrumentEvidence,
): ResolvedInstrument | null {
  const key = evidence.gmPercussionKey
  if (inRange(key, 0, 127))
    return own(GM_PERCUSSION_KEY_GLYPHS.get(key!) ?? 'drums', 'import')
  if (inRange(evidence.gmDrumKit, 0, 127))
    return own(GM_DRUM_KIT_GLYPHS.get(evidence.gmDrumKit!) ?? 'drums', 'import')
  if (inRange(evidence.gmProgram, 0, 127)) {
    const [glyph, family] = GM_PROGRAM_GLYPHS[evidence.gmProgram!]!
    return own(glyph, 'import', family)
  }
  const stem = evidence.stem
  if (typeof stem === 'string' && Object.hasOwn(STEM_GLYPHS, stem))
    return own(STEM_GLYPHS[stem as keyof typeof STEM_GLYPHS], 'import')
  return null
}

/** Whether a name's glyph may stand in for a lane of this role. */
export function instrumentFitsRole(
  glyph: InstrumentGlyphId,
  role: TrackRole,
): boolean {
  const families = ROLE_FAMILIES[role]
  return families === null || families.includes(instrumentGlyph(glyph).family)
}

function fromNames(
  names: readonly (string | null | undefined)[],
  role: TrackRole,
): ResolvedInstrument | null {
  for (const name of names) {
    const read = typeof name === 'string' ? readInstrumentName(name) : null
    if (read === null || (read.familyOnly && role !== 'other')) continue
    if (instrumentFitsRole(read.glyph, role)) return own(read.glyph, 'name')
  }
  return null
}

export function resolveInstrument(
  evidence: InstrumentEvidence,
): ResolvedInstrument {
  if (isInstrumentGlyph(evidence.chosen)) return own(evidence.chosen, 'chosen')
  const role = evidence.role ?? 'other'
  return (
    instrumentFromImport(evidence) ??
    fromNames(evidence.names ?? [], role) ??
    (role === 'other'
      ? own('audio', 'unknown')
      : own(ROLE_GLYPHS[role], 'role'))
  )
}

/** A Studio lane's instrument: its pick, else its name read against its role, else the role's. */
export function studioLaneInstrument(track: {
  readonly instrument?: string
  readonly name: string
  readonly role: TrackRole
}): ResolvedInstrument {
  return resolveInstrument({
    chosen: track.instrument,
    names: [track.name],
    role: track.role,
  })
}
