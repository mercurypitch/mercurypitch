// ============================================================
// Sheet Music Renderer — MelodyItem[] → VexFlow notation
// ============================================================

import { Formatter, Renderer, Stave, StaveNote, Voice } from 'vexflow'
import { KEY_SIGNATURES, midiToNote } from '@/lib/scale-data'
import type { MelodyItem } from '@/types'

// ---------------------------------------------------------------------------
// Duration quantisation
// ---------------------------------------------------------------------------

interface DurOpt {
  code: string
  dots: number
}

const DUR_BUCKETS: Array<DurOpt & { beats: number }> = [
  { code: 'w', beats: 4, dots: 0 },
  { code: 'h', beats: 2, dots: 0 },
  { code: 'q', beats: 1, dots: 0 },
  { code: '8', beats: 0.5, dots: 0 },
  { code: '16', beats: 0.25, dots: 0 },
  { code: '32', beats: 0.125, dots: 0 },
]

function quantizeDuration(beats: number): DurOpt[] {
  if (beats <= 0) return [{ code: '16', dots: 0 }]
  const results: DurOpt[] = []
  let remaining = beats
  while (remaining > 0.005) {
    let bestCode = 'q'
    let bestDots = 0
    let bestErr = Infinity
    for (const b of DUR_BUCKETS) {
      for (const d of [0, 1, 2]) {
        const v = b.beats * (1 + d * 0.5)
        if (v > remaining + 0.02) continue
        const err = Math.abs(remaining - v)
        if (err < bestErr) {
          bestCode = b.code
          bestDots = d
          bestErr = err
        }
      }
    }
    const bucket =
      DUR_BUCKETS.find((b) => b.code === bestCode) ?? DUR_BUCKETS[2]
    results.push({ code: bestCode, dots: bestDots })
    remaining -= bucket.beats * (1 + bestDots * 0.5)
  }
  return results.length > 0 ? results : [{ code: 'q', dots: 0 }]
}

// ---------------------------------------------------------------------------
// MIDI → VexFlow key (reuses scale-data's midiToNote)
// ---------------------------------------------------------------------------

/** Lowercase VexFlow note name from the app's uppercase NoteName. */
function midiToVFKey(midi: number): string {
  const { name, octave } = midiToNote(midi)
  return `${name.toLowerCase()}/${octave}`
}

// ---------------------------------------------------------------------------
// Key signature (reuses scale-data's KEY_SIGNATURES)
// ---------------------------------------------------------------------------

const RELATIVE_MAJOR: Record<string, string> = {
  A: 'C',
  E: 'G',
  B: 'D',
  'F#': 'A',
  'C#': 'E',
  'G#': 'B',
  D: 'F',
  G: 'Bb',
  C: 'Eb',
  F: 'Ab',
  Bb: 'Db',
  Eb: 'Gb',
}

function keySigSpec(key: string, scaleType: string): string {
  const nk = key.charAt(0).toUpperCase() + key.slice(1).toLowerCase()
  const isMinor = scaleType.toLowerCase().includes('minor')
  const lookup = isMinor ? (RELATIVE_MAJOR[nk] ?? nk) : nk
  const sig = KEY_SIGNATURES[lookup]
  if (sig === undefined) return 'C'
  const n = sig.sharps - sig.flats
  if (n > 0) return Array(n).fill('#').join('')
  if (n < 0) return Array(-n).fill('b').join('')
  return 'C'
}

// ---------------------------------------------------------------------------
// Clef
// ---------------------------------------------------------------------------

function chooseClef(midis: number[]): 'treble' | 'bass' {
  if (midis.length === 0) return 'treble'
  return midis.reduce((a, b) => a + b, 0) / midis.length < 55
    ? 'bass'
    : 'treble'
}

// ---------------------------------------------------------------------------
// Melody → notation
// ---------------------------------------------------------------------------

interface RNote {
  key: string
  duration: string
  dots: number
  isRest: boolean
}

function melodyToRNotes(melody: MelodyItem[]): RNote[] {
  if (!melody.length) return []
  const sorted = [...melody].sort((a, b) => a.startBeat - b.startBeat)
  const result: RNote[] = []
  let cursor = 0
  for (const item of sorted) {
    const gap = item.startBeat - cursor
    if (gap > 0.01) {
      for (const r of quantizeDuration(gap)) {
        result.push({
          key: 'b/4',
          duration: r.code,
          dots: r.dots,
          isRest: true,
        })
      }
    }
    for (const d of quantizeDuration(item.duration)) {
      result.push({
        key: midiToVFKey(item.note.midi),
        duration: d.code,
        dots: d.dots,
        isRest: false,
      })
    }
    cursor = Math.max(cursor, item.startBeat + item.duration)
  }
  return result
}

// ---------------------------------------------------------------------------
// Public interface
// ---------------------------------------------------------------------------

export interface SheetMusicRenderInput {
  container: HTMLElement
  melody: MelodyItem[]
  key: string
  scaleType: string
  beatsPerBar?: number
}

const STAVE_W = 960
const MARGIN = 50
const Y_STEP = 145
const PER_SYSTEM = 4

function durBeats(code: string, dots: number): number {
  const b = DUR_BUCKETS.find((d) => d.code === code)
  let v = b?.beats ?? 1
  for (let i = 0; i < dots; i++) v *= 1.5
  return v
}

export function renderSheetMusic(input: SheetMusicRenderInput): void {
  const { container, melody, key, scaleType, beatsPerBar } = input
  container.innerHTML = ''

  if (!melody.length) {
    container.textContent = '(empty)'
    return
  }

  const rnotes = melodyToRNotes(melody)
  if (!rnotes.length) {
    container.textContent = '(empty)'
    return
  }

  const clef = chooseClef(melody.map((m) => m.note.midi))
  const keySig = keySigSpec(key, scaleType)
  const bpbar = beatsPerBar ?? 4
  const bps = PER_SYSTEM * bpbar

  // Partition into systems
  const systems: RNote[][] = []
  let cur: RNote[] = []
  let acc = 0
  for (const rn of rnotes) {
    const nb = durBeats(rn.duration, rn.dots)
    if (acc + nb > bps + 0.01 && cur.length > 0) {
      systems.push(cur)
      cur = []
      acc = 0
    }
    cur.push(rn)
    acc += nb
  }
  if (cur.length > 0) systems.push(cur)

  // Renderer — single SVG context for all staves
  const renderer = new Renderer(
    container as HTMLDivElement,
    Renderer.Backends.SVG,
  )
  const totalH = systems.length * Y_STEP + 60
  renderer.resize(STAVE_W + MARGIN * 2, totalH)
  const ctx = renderer.getContext()

  let isFirst = true
  for (let i = 0; i < systems.length; i++) {
    const sysNotes = systems[i]
    const y = i * Y_STEP + 10

    const stave = new Stave(MARGIN, y, STAVE_W)
    if (isFirst) {
      stave.addClef(clef)
      if (keySig !== 'C') stave.addKeySignature(keySig)
      stave.addTimeSignature(`${bpbar}/4`)
      isFirst = false
    }
    if (i === systems.length - 1) stave.setEndBarType(3)

    const notes: StaveNote[] = []
    for (const rn of sysNotes) {
      const dur = `${rn.duration}${rn.dots > 0 ? 'd'.repeat(rn.dots) : ''}`
      notes.push(
        rn.isRest
          ? new StaveNote({ type: 'r', duration: dur, keys: ['b/4'] })
          : new StaveNote({
              keys: [rn.key],
              duration: dur,
              clef,
              autoStem: true,
            }),
      )
    }

    const voice = new Voice({ numBeats: bps, beatValue: 4 })
    voice.addTickables(notes)
    new Formatter().joinVoices([voice]).format([voice], STAVE_W)

    stave.setContext(ctx).draw()
    voice.draw(ctx, stave)
  }

  // Ensure SVG fills container width responsively
  const svg = container.querySelector('svg')
  if (svg) {
    svg.setAttribute('width', '100%')
    svg.style.maxWidth = `${STAVE_W + MARGIN * 2}px`
  }
}
