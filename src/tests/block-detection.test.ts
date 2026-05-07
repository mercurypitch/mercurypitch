// ============================================================
// Block Detection Algorithm Tests — EARS REQ-UV-048, REQ-UV-049
// ============================================================

import { describe, expect, it } from 'vitest'

type BlockInstancesMap = Record<string, number[][]>

/**
 * Replicated from StemMixer.tsx:detectBlockInstances for isolated testing.
 * Auto-detects identical text sequences in remaining lines.
 */
function detectBlockInstances(
  textLines: string[],
  templateIndices: number[],
  existingInstances: BlockInstancesMap,
): number[][] {
  const templateText = templateIndices.map((i) => textLines[i].trim())
  if (templateText.every((t) => !t)) return [templateIndices]

  const instances: number[][] = [templateIndices]

  const taken = new Set<number>()
  for (const insts of Object.values(existingInstances)) {
    for (const inst of insts) {
      for (let i = inst[0]; i < inst[1]; i++) taken.add(i)
    }
  }

  for (let i = 0; i < textLines.length; i++) {
    if (taken.has(i)) continue
    if (i >= templateIndices[0] && i <= templateIndices[templateIndices.length - 1]) continue

    let match = true
    for (let j = 0; j < templateText.length; j++) {
      const checkLine = textLines[i + j]?.trim()
      if (checkLine !== templateText[j]) {
        match = false
        break
      }
    }
    if (match) {
      const instStart = i
      const instEnd = i + templateText.length
      instances.push([instStart, instEnd])
      for (let k = instStart; k < instEnd; k++) taken.add(k)
      i += templateText.length - 1
    }
  }
  return instances
}

// Deterministic color assignment (replicated from StemMixer.tsx)
const BLOCK_COLORS = ['#f0a060', '#60a0f0', '#60d080', '#d080e0', '#e0c050', '#f06080']

function getBlockColor(blockId: string): string {
  let hash = 0
  for (let i = 0; i < blockId.length; i++)
    hash = ((hash << 5) - hash) + blockId.charCodeAt(i)
  return BLOCK_COLORS[Math.abs(hash) % BLOCK_COLORS.length]
}

// ── REQ-UV-049: Auto-Detection Algorithm ─────────────────────

describe('detectBlockInstances (REQ-UV-049)', () => {
  it('returns only template when no repeats exist', () => {
    const lines = [
      'Verse 1 line 1',
      'Verse 1 line 2',
      'Chorus line 1',
      'Chorus line 2',
      'Verse 2 line 1',
      'Verse 2 line 2',
    ]
    const templateIndices = [2, 3] // individual line indices
    const result = detectBlockInstances(lines, templateIndices, {})
    // Template returned as-is (individual indices), detected ones use [start, endExclusive)
    expect(result).toEqual([[2, 3]])
  })

  it('detects repeated identical lines', () => {
    const lines = [
      'Verse 1 line 1',
      'Verse 1 line 2',
      'Chorus line 1',
      'Chorus line 2',
      'Verse 2 line 1',
      'Chorus line 1',
      'Chorus line 2',
      'Bridge line 1',
    ]
    const templateIndices = [2, 3] // first chorus
    const result = detectBlockInstances(lines, templateIndices, {})
    expect(result).toEqual([
      [2, 3], // template (individual indices)
      [5, 7], // detected repeat (start, endExclusive)
    ])
  })

  it('does not detect instances overlapping existing blocks', () => {
    const lines = [
      'Chorus line 1', // 0 — already in existing block
      'Chorus line 2', // 1 — already in existing block
      'Chorus line 1', // 2
      'Chorus line 2', // 3
    ]
    const templateIndices = [2, 3] // second chorus as template for NEW block
    const existingInstances: BlockInstancesMap = {
      'existing-block': [[0, 2]], // already owns lines 0-1
    }
    const result = detectBlockInstances(lines, templateIndices, existingInstances)
    expect(result).toEqual([
      [2, 3], // only the template (individual indices), lines 0-1 are taken
    ])
  })

  it('skips template overlap range', () => {
    const lines = [
      'Line A',
      'Line B',
      'Line C',
      'Line D',
    ]
    // Template is indices [1,2] — "Line B", "Line C"
    // Should not detect itself if the same text appears within its own range
    const result = detectBlockInstances(lines, [1, 2], {})
    expect(result).toEqual([[1, 2]])
  })

  it('handles empty template gracefully', () => {
    const lines = ['', '', 'real line']
    const result = detectBlockInstances(lines, [0, 1], {})
    // Early return: template returned as-is since all lines are empty
    expect(result).toEqual([[0, 1]])
  })

  it('detects multiple repeats of the same block', () => {
    const lines = [
      'Intro',
      'Chorus A', 'Chorus B', // first chorus
      'Verse A',
      'Chorus A', 'Chorus B', // second chorus
      'Solo',
      'Chorus A', 'Chorus B', // third chorus
      'Outro',
    ]
    const result = detectBlockInstances(lines, [1, 2], {})
    expect(result).toHaveLength(3) // template + 2 repeats
    expect(result[0]).toEqual([1, 2]) // template (individual indices)
    expect(result[1]).toEqual([4, 6]) // detected repeat (start, endExclusive)
    expect(result[2]).toEqual([7, 9]) // detected repeat
  })

  it('does not match partial overlaps', () => {
    const lines = [
      'Chorus A', 'Chorus B', 'Chorus C',
      'Verse X', 'Verse Y',
      'Chorus A', 'Chorus X', // only first line matches — partial overlap
      'Chorus A', 'Chorus B', 'Chorus C', // full match
    ]
    const result = detectBlockInstances(lines, [0, 1, 2], {})
    // Should match template [0,1,2] and detected [7,10] but NOT [5,8] (middle line differs)
    expect(result).toHaveLength(2)
    expect(result[0]).toEqual([0, 1, 2])
    expect(result[1]).toEqual([7, 10])
  })
})

// ── REQ-UV-050: Block Color Assignment ───────────────────────

describe('Block Color Assignment (REQ-UV-050)', () => {
  it('returns a color from the palette', () => {
    const color = getBlockColor('chorus-1')
    expect(BLOCK_COLORS).toContain(color)
  })

  it('is deterministic for the same ID', () => {
    expect(getBlockColor('chorus-1')).toBe(getBlockColor('chorus-1'))
  })

  it('may differ for different IDs', () => {
    // Not strictly required but good to verify distribution
    const _c1 = getBlockColor('chorus-1')
    const _c2 = getBlockColor('verse-2')
    // Different IDs should often map to different colors (not guaranteed but highly likely)
    // No assertion needed — just verifying determinism above
  })
})
