// ============================================================
// Drum kit SFZ normalizer — inherited regions into one explicit zone model
// ============================================================
//
// The normalized form retains probability, sequencing, choke and source-edit
// semantics so later source adapters never have to guess what the SFZ meant.

import type * as DrumKitSfz from './drum-kit-sfz-parser'
import { parseDrumKitSfz } from './drum-kit-sfz-parser'

export interface NormalizedDrumKitSfzZone {
  readonly sourceLine: number
  readonly samplePath: string
  readonly gmKeys: readonly number[]
  readonly velocityMin: number
  readonly velocityMax: number
  readonly roundRobin: number
  readonly sequencePosition: number
  readonly sequenceLength: number
  readonly chokeGroup: string | null
  readonly chokes: readonly string[]
  readonly lorand: number
  readonly hirand: number
  readonly volumeDb: number
  readonly tuneCents: number
  readonly offsetFrames: number
  readonly endFrame: number | null
}

interface OpcodeValue {
  readonly value: string
  readonly line: number
}

type OpcodeState = Partial<
  Record<Exclude<DrumKitSfz.DrumKitSfzOpcodeName, 'key'>, OpcodeValue>
>

function applyOpcodes(
  initial: OpcodeState,
  opcodes: readonly DrumKitSfz.DrumKitSfzOpcode[],
): OpcodeState {
  const state = { ...initial }
  for (const opcode of opcodes) {
    const value = Object.freeze({ value: opcode.value, line: opcode.line })
    if (opcode.name === 'key') {
      state.lokey = value
      state.hikey = value
    } else {
      state[opcode.name] = value
    }
  }
  return state
}

function fail(label: string, value: OpcodeValue | undefined): never {
  throw new Error(
    `Invalid SFZ ${label}${value === undefined ? '' : ` at line ${value.line}`}`,
  )
}

function unquote(value: OpcodeValue): string {
  const text = value.value.trim()
  const first = text[0]
  const last = text.at(-1)
  if (first === '"' || first === "'") {
    if (last !== first || text.length < 2) fail('quoted value', value)
    return text.slice(1, -1)
  }
  if (last === '"' || last === "'") fail('quoted value', value)
  return text
}

function samplePath(value: OpcodeValue | undefined): string {
  if (value === undefined) fail('region without sample', value)
  const raw = unquote(value)
  if (
    raw === '' ||
    raw.length > 1_024 ||
    raw.includes('\0') ||
    /[\r\n\t]/.test(raw)
  ) {
    fail('sample path', value)
  }
  if (
    raw.startsWith('/') ||
    raw.startsWith('\\') ||
    /^[A-Za-z]:[\\/]/.test(raw) ||
    /^[A-Za-z][A-Za-z\d+.-]*:/.test(raw)
  ) {
    fail('absolute sample path', value)
  }
  const pieces = raw.replaceAll('\\', '/').split('/')
  if (pieces.includes('..')) fail('sample path traversal', value)
  const normalized = pieces
    .filter((piece) => piece !== '' && piece !== '.')
    .join('/')
  if (normalized === '') fail('sample path', value)
  return normalized
}

function strictInteger(
  value: OpcodeValue | undefined,
  label: string,
  fallback?: number,
): number {
  if (value === undefined) {
    if (fallback !== undefined) return fallback
    fail(label, value)
  }
  if (!/^-?\d+$/.test(value.value.trim())) fail(label, value)
  const parsed = Number(value.value)
  if (!Number.isSafeInteger(parsed)) fail(label, value)
  return parsed
}

function boundedInteger(
  value: OpcodeValue | undefined,
  label: string,
  minimum: number,
  maximum: number,
  fallback?: number,
): number {
  const parsed = strictInteger(value, label, fallback)
  if (parsed < minimum || parsed > maximum) fail(label, value)
  return parsed
}

const NOTE_OFFSETS = Object.freeze({
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
})

function midiKey(value: OpcodeValue | undefined, label: string): number {
  if (value === undefined) fail(label, value)
  if (/^-?\d+$/.test(value.value.trim())) {
    return boundedInteger(value, label, 0, 127)
  }
  const match = /^([A-Ga-g])([#b]?)(-?\d+)$/.exec(value.value.trim())
  if (match === null) fail(label, value)
  const letter = match[1].toUpperCase() as keyof typeof NOTE_OFFSETS
  const accidental = match[2] === '#' ? 1 : match[2] === 'b' ? -1 : 0
  const midi = (Number(match[3]) + 1) * 12 + NOTE_OFFSETS[letter] + accidental
  if (!Number.isInteger(midi) || midi < 0 || midi > 127) fail(label, value)
  return midi
}

function boundedNumber(
  value: OpcodeValue | undefined,
  label: string,
  minimum: number,
  maximum: number,
  fallback: number,
): number {
  if (value === undefined) return fallback
  const parsed = Number(value.value.trim())
  if (!Number.isFinite(parsed) || parsed < minimum || parsed > maximum) {
    fail(label, value)
  }
  return parsed
}

function normalizeZone(
  state: OpcodeState,
  sourceLine: number,
): NormalizedDrumKitSfzZone {
  const lowKey = midiKey(state.lokey, 'lokey/key')
  const highKey = midiKey(state.hikey, 'hikey/key')
  if (lowKey > highKey) fail('key range', state.lokey)
  const velocityMin = boundedInteger(state.lovel, 'lovel', 1, 127, 1)
  const velocityMax = boundedInteger(state.hivel, 'hivel', 1, 127, 127)
  if (velocityMin > velocityMax) fail('velocity range', state.lovel)

  const hasSequencePosition = state.seq_position !== undefined
  const hasSequenceLength = state.seq_length !== undefined
  if (hasSequencePosition !== hasSequenceLength) {
    fail('incomplete sequence', state.seq_position ?? state.seq_length)
  }
  const sequenceLength = boundedInteger(
    state.seq_length,
    'seq_length',
    1,
    4_096,
    1,
  )
  const sequencePosition = boundedInteger(
    state.seq_position,
    'seq_position',
    1,
    sequenceLength,
    1,
  )

  const lorand = boundedNumber(state.lorand, 'lorand', 0, 1, 0)
  const hirand = boundedNumber(state.hirand, 'hirand', 0, 1, 1)
  if (lorand >= hirand) fail('random range', state.lorand ?? state.hirand)

  const group = boundedInteger(state.group, 'group', 0, 2_147_483_647, 0)
  const offBy = boundedInteger(state.off_by, 'off_by', 0, 2_147_483_647, 0)
  const offsetFrames = boundedInteger(
    state.offset,
    'offset',
    0,
    Number.MAX_SAFE_INTEGER,
    0,
  )
  const endFrame =
    state.end === undefined
      ? null
      : boundedInteger(state.end, 'end', 0, Number.MAX_SAFE_INTEGER)
  if (endFrame !== null && endFrame <= offsetFrames) {
    fail('end before offset', state.end)
  }

  return Object.freeze({
    sourceLine,
    samplePath: samplePath(state.sample),
    gmKeys: Object.freeze(
      Array.from(
        { length: highKey - lowKey + 1 },
        (_, index) => lowKey + index,
      ),
    ),
    velocityMin,
    velocityMax,
    roundRobin: sequencePosition,
    sequencePosition,
    sequenceLength,
    // SFZ off_by marks the group which can silence this region. The runtime's
    // active-voice tag is therefore off_by, while a trigger chokes its group.
    chokeGroup: offBy === 0 ? null : String(offBy),
    chokes: Object.freeze(group === 0 ? [] : [String(group)]),
    lorand,
    hirand,
    volumeDb: boundedNumber(state.volume, 'volume', -144, 24, 0),
    tuneCents: boundedNumber(state.tune, 'tune', -2_400, 2_400, 0),
    offsetFrames,
    endFrame,
  })
}

/** Apply global/group inheritance and emit one complete zone per region. */
export function normalizeDrumKitSfz(
  sections: readonly DrumKitSfz.DrumKitSfzSection[],
): readonly NormalizedDrumKitSfzZone[] {
  let globalState: OpcodeState = {}
  let groupState: OpcodeState = {}
  const zones: NormalizedDrumKitSfzZone[] = []
  for (const section of sections) {
    if (section.kind === 'global') {
      globalState = applyOpcodes(globalState, section.opcodes)
      groupState = {}
      continue
    }
    if (section.kind === 'group') {
      groupState = applyOpcodes({}, section.opcodes)
      continue
    }
    const inherited = { ...globalState, ...groupState }
    zones.push(
      normalizeZone(applyOpcodes(inherited, section.opcodes), section.line),
    )
  }
  if (zones.length === 0) throw new Error('SFZ source has no regions')
  return Object.freeze(zones)
}

export function parseAndNormalizeDrumKitSfz(
  source: string,
): readonly NormalizedDrumKitSfzZone[] {
  return normalizeDrumKitSfz(parseDrumKitSfz(source))
}
