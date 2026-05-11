// ============================================================
// Mock Session Data Generator — demo data for Vocal Analysis
// ============================================================

import type { MelodyItem, MelodyNote, NoteResult, PracticeResult, SessionResult, } from '@/types'

// ── Helpers ──────────────────────────────────────────────────

let _idCounter = 1000

function nextId(): number {
  return _idCounter++
}

const NOTE_NAMES = [
  'C',
  'C#',
  'D',
  'D#',
  'E',
  'F',
  'F#',
  'G',
  'G#',
  'A',
  'A#',
  'B',
] as const

function makeMelodyNote(midi: number): MelodyNote {
  const name = NOTE_NAMES[midi % 12]
  const octave = Math.floor(midi / 12) - 1
  const freq = 440 * Math.pow(2, (midi - 69) / 12)
  return { midi, name, octave, freq }
}

function makeMelodyItem(midi: number, duration = 1, startBeat = 0): MelodyItem {
  return {
    id: nextId(),
    note: makeMelodyNote(midi),
    duration,
    startBeat,
    velocity: 100,
  }
}

function randomAround(base: number, spread: number): number {
  return base + (Math.random() - 0.5) * spread * 2
}

// ── Melody Templates ─────────────────────────────────────────

const MELODY_TEMPLATES: Array<{ name: string; midis: number[] }> = [
  { name: 'Major Scale Warmup', midis: [60, 62, 64, 65, 67, 69, 71, 72] },
  {
    name: 'Arpeggio Exercise',
    midis: [60, 64, 67, 72, 67, 64, 60, 55, 60],
  },
  {
    name: 'Descending Run',
    midis: [72, 71, 69, 67, 65, 64, 62, 60, 59, 57],
  },
  { name: 'Interval Jumps', midis: [60, 67, 62, 69, 64, 71, 65, 72] },
  { name: 'Pentatonic Flow', midis: [60, 62, 64, 67, 69, 72, 69, 67, 64, 62] },
]

// ── Mock Generators ──────────────────────────────────────────

function generateNoteResults(items: MelodyItem[]): NoteResult[] {
  return items.map((item, i) => {
    const avgCents = randomAround(i % 3 === 0 ? 15 : 8, 20)
    let rating: NoteResult['rating']
    const abs = Math.abs(avgCents)
    if (abs < 15) rating = 'perfect'
    else if (abs < 25) rating = 'excellent'
    else if (abs < 40) rating = 'good'
    else if (abs < 60) rating = 'okay'
    else rating = 'off'
    return {
      item,
      pitchFreq: item.note.freq * (1 + avgCents / 1200),
      pitchCents: avgCents,
      time: randomAround(300, 80),
      rating,
      avgCents,
      targetNote: `${item.note.name}${item.note.octave}`,
    }
  })
}

function generatePracticeResult(
  name: string,
  midis: number[],
  score: number,
  completedAt: number,
): PracticeResult {
  const items = midis.map((m, i) => makeMelodyItem(m, 1, i))
  const noteResults = generateNoteResults(items)
  return {
    score,
    noteCount: items.length,
    avgCents:
      noteResults.reduce((s, r) => s + Math.abs(r.avgCents), 0) /
      noteResults.length,
    itemsCompleted: items.length,
    totalItems: items.length,
    name,
    mode: 'session',
    completedAt,
    noteResult: noteResults,
  }
}

// ── Public API ────────────────────────────────────────────────

export function generateMockSessions(): SessionResult[] {
  _idCounter = 1000 // reset for deterministic output
  const now = Date.now()
  const DAY = 86400000

  return MELODY_TEMPLATES.map((template, idx) => {
    const completedAt = now - (4 - idx) * DAY - randomAround(3600000, 1800000)
    const score = Math.round(randomAround(72 + idx * 5, 10))
    const practiceResults = [
      generatePracticeResult(template.name, template.midis, score, completedAt),
    ]

    return {
      sessionId: `mock-session-${idx + 1}`,
      name: template.name,
      score,
      totalItems: template.midis.length,
      practiceItemResult: practiceResults,
      itemsCompleted: template.midis.length,
      sessionName: template.name,
      completedAt,
      avgCents: practiceResults[0].avgCents,
    }
  })
}
