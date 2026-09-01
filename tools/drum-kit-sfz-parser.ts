// ============================================================
// Drum kit SFZ parser — bounded syntax for offline sample-map ingestion
// ============================================================
//
// This parser deliberately recognizes only the opcodes the Drum Night
// normalizer can preserve. Unknown musical semantics fail at their source
// line instead of being ignored and changing how a kit plays.

export const DRUM_KIT_SFZ_OPCODES = Object.freeze([
  'sample',
  'key',
  'lokey',
  'hikey',
  'lovel',
  'hivel',
  'seq_position',
  'seq_length',
  'group',
  'off_by',
  'lorand',
  'hirand',
  'volume',
  'tune',
  'offset',
  'end',
] as const)

export type DrumKitSfzOpcodeName = (typeof DRUM_KIT_SFZ_OPCODES)[number]
export type DrumKitSfzSectionKind = 'global' | 'group' | 'region'

export interface DrumKitSfzOpcode {
  readonly name: DrumKitSfzOpcodeName
  readonly value: string
  readonly line: number
}

export interface DrumKitSfzSection {
  readonly kind: DrumKitSfzSectionKind
  readonly line: number
  readonly opcodes: readonly DrumKitSfzOpcode[]
}

const MAXIMUM_SFZ_CHARACTERS = 4 * 1024 * 1024
const MAXIMUM_SFZ_SECTIONS = 65_536
const MAXIMUM_SFZ_OPCODES = 262_144
const SUPPORTED_HEADERS: ReadonlySet<string> = new Set([
  'global',
  'group',
  'region',
])
const SUPPORTED_OPCODES: ReadonlySet<string> = new Set(DRUM_KIT_SFZ_OPCODES)

function stripComments(source: string): string {
  let output = ''
  let quote: '"' | "'" | null = null
  let lineComment = false
  let blockComment = false
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index]
    const next = source[index + 1]
    if (lineComment) {
      if (character === '\n') {
        lineComment = false
        output += '\n'
      } else {
        output += ' '
      }
      continue
    }
    if (blockComment) {
      if (character === '*' && next === '/') {
        output += '  '
        blockComment = false
        index += 1
      } else {
        output += character === '\n' ? '\n' : ' '
      }
      continue
    }
    if (quote !== null) {
      output += character
      if (character === '\\' && next !== undefined) {
        output += next
        index += 1
      } else if (character === quote) {
        quote = null
      }
      continue
    }
    if (character === '"' || character === "'") {
      quote = character
      output += character
      continue
    }
    if (character === '/' && next === '/') {
      output += '  '
      lineComment = true
      index += 1
      continue
    }
    if (character === '/' && next === '*') {
      output += '  '
      blockComment = true
      index += 1
      continue
    }
    output += character
  }
  if (blockComment) throw new Error('Unterminated SFZ block comment')
  if (quote !== null) throw new Error('Unterminated SFZ quoted value')
  return output
}

function lineStartsFor(source: string): readonly number[] {
  const starts = [0]
  for (let index = 0; index < source.length; index += 1) {
    if (source[index] === '\n') starts.push(index + 1)
  }
  return starts
}

function lineAt(lineStarts: readonly number[], offset: number): number {
  let low = 0
  let high = lineStarts.length
  while (low + 1 < high) {
    const middle = Math.floor((low + high) / 2)
    if (lineStarts[middle] <= offset) low = middle
    else high = middle
  }
  return low + 1
}

function parseOpcodeSegment(
  segment: string,
  absoluteOffset: number,
  lineStarts: readonly number[],
): readonly DrumKitSfzOpcode[] {
  const pattern = /(?:^|\s)([A-Za-z_][A-Za-z\d_]*)\s*=/g
  const matches = [...segment.matchAll(pattern)]
  if (matches.length === 0) {
    if (segment.trim() !== '') {
      throw new Error(
        `Unexpected SFZ text at line ${lineAt(lineStarts, absoluteOffset)}`,
      )
    }
    return Object.freeze([])
  }
  const prefix = segment.slice(0, matches[0].index)
  if (prefix.trim() !== '') {
    throw new Error(
      `Unexpected SFZ text at line ${lineAt(lineStarts, absoluteOffset)}`,
    )
  }

  const opcodes: DrumKitSfzOpcode[] = []
  for (let index = 0; index < matches.length; index += 1) {
    const match = matches[index]
    const rawName = match[1]
    const name = rawName.toLowerCase()
    const line = lineAt(
      lineStarts,
      absoluteOffset + (match.index ?? 0) + match[0].indexOf(rawName),
    )
    if (!SUPPORTED_OPCODES.has(name)) {
      throw new Error(`Unsupported SFZ opcode "${rawName}" at line ${line}`)
    }
    const valueStart = (match.index ?? 0) + match[0].length
    const valueEnd = matches[index + 1]?.index ?? segment.length
    const value = segment.slice(valueStart, valueEnd).trim()
    if (value === '') {
      throw new Error(`Empty SFZ opcode "${rawName}" at line ${line}`)
    }
    opcodes.push(
      Object.freeze({
        name: name as DrumKitSfzOpcodeName,
        value,
        line,
      }),
    )
  }
  return Object.freeze(opcodes)
}

/** Parse headers/opcodes without performing kit-specific normalization. */
export function parseDrumKitSfz(source: string): readonly DrumKitSfzSection[] {
  if (source.includes('\0')) throw new Error('SFZ source contains a NUL byte')
  if (source.length > MAXIMUM_SFZ_CHARACTERS) {
    throw new Error('SFZ source exceeds the offline ingestion limit')
  }
  const clean = stripComments(source)
  const lineStarts = lineStartsFor(clean)
  const headerPattern = /<\s*([A-Za-z_][A-Za-z\d_-]*)\s*>/g
  const headers = [...clean.matchAll(headerPattern)]
  if (headers.length === 0) throw new Error('SFZ source has no sections')
  if (headers.length > MAXIMUM_SFZ_SECTIONS) {
    throw new Error('SFZ source has too many sections')
  }
  const leading = clean.slice(0, headers[0].index)
  if (leading.trim() !== '') {
    throw new Error('SFZ source contains text before its first section')
  }

  const sections: DrumKitSfzSection[] = []
  let opcodeCount = 0
  for (let index = 0; index < headers.length; index += 1) {
    const header = headers[index]
    const rawKind = header[1]
    const kind = rawKind.toLowerCase()
    const line = lineAt(lineStarts, header.index ?? 0)
    if (!SUPPORTED_HEADERS.has(kind)) {
      throw new Error(`Unsupported SFZ section <${rawKind}> at line ${line}`)
    }
    const segmentStart = (header.index ?? 0) + header[0].length
    const segmentEnd = headers[index + 1]?.index ?? clean.length
    const opcodes = parseOpcodeSegment(
      clean.slice(segmentStart, segmentEnd),
      segmentStart,
      lineStarts,
    )
    opcodeCount += opcodes.length
    if (opcodeCount > MAXIMUM_SFZ_OPCODES) {
      throw new Error('SFZ source has too many opcodes')
    }
    sections.push(
      Object.freeze({
        kind: kind as DrumKitSfzSectionKind,
        line,
        opcodes,
      }),
    )
  }
  return Object.freeze(sections)
}
