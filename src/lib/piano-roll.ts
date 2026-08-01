// ============================================================
// Piano Roll Editor — Canvas-based note editor
// ============================================================

import type { BallPhysicsConfig, BallPhysicsState, NoteBounds, } from '@/features/playback/yousician-ball-physics'
import { createBallPhysics, getBallPhysics, } from '@/features/playback/yousician-ball-physics'
import { drawAbLoopOverlay, hitTestAbLoopMarker } from '@/lib/ab-loop-canvas'
import type { AudioEngine, InstrumentType } from '@/lib/audio-engine'
import { DRUM_LANE_BY_MIDI, DRUM_LANE_SCALE } from '@/lib/drum-lanes'
import { CHORD_FILL, CHORD_STROKE, drawChordShape, drawEffectBadge, drawSlideProgress, drawStaccatoShape, drawTrillProgress, SLIDE_FILL, SLIDE_STROKE, slideShapePath, STACCATO_FILL, STACCATO_STROKE, TREMOLO_FILL, TREMOLO_STROKE, TRILL_FILL, TRILL_STROKE, trillShapePath, VIBRATO_FILL, VIBRATO_STROKE, vibratoShapePath, } from '@/lib/effect-renderer'
import { eventBus } from '@/lib/event-bus'
import { PitchDetector } from '@/lib/pitch-detector'
import { buildMultiOctaveScale, melodyMidiRange, midiToFreq, midiToNote, } from '@/lib/scale-data'
import { showNotification } from '@/stores/notifications-store'
import type { ChordType, MelodyItem, MelodyKind, NoteName, PianoRollConfig, ScaleDegree, } from '@/types'
import { CHORD_INTERVALS } from '@/types'

const PIANO_ROLL_CONFIG: PianoRollConfig = {
  rowHeight: 22,
  beatWidth: 48,
  pianoWidth: 62,
  rulerHeight: 28,
  beatsPerBar: 4,
  minDuration: 0.25,
  noteColors: {
    normal: 'rgba(88, 166, 255, 0.75)',
    selected: 'rgba(88, 166, 255, 1.0)',
    active: 'rgba(63, 185, 80, 0.85)',
    ghost: 'rgba(88, 166, 255, 0.35)',
  },
}

/** Hard ceiling for a canvas's backing store in device px. Browsers cap canvas
 *  dimensions (Chrome 65,535; Safari lower) and silently fail to allocate past
 *  it. The grid is viewport-sized so this is only a safety net. */
const MAX_CANVAS_PX = 16384

/** Canvas colors/fonts, resolved from CSS custom properties on the editor's
 *  container (with the historical dark values as fallbacks) so the canvases
 *  follow the app theme instead of hardcoding hex values in draw calls. */
interface RollPalette {
  bg: string
  surface: string
  gridLine: string
  border: string
  tickStrong: string
  text: string
  accent: string
  accentGlow: string
  active: string
  activeGlow: string
  blackRow: string
  fontSmall: string
  fontLabel: string
  fontMono: string
}

// ============================================================
// Placement quantization
// ============================================================

/**
 * Snap a click's beat position to the slot the cursor is in when PLACING a new
 * note.
 *
 * Placement FLOORS into the current slot: a click at any fraction f in [0, 1)
 * of a slot lands in THAT slot, never the next one. This is deliberately
 * different from drag-move and resize, which round to the nearest slot — those
 * paths do their own `Math.round` snapping in `onGridMouseMove` and must stay
 * unchanged. Using round-to-nearest here caused a click past a slot's half-way
 * mark to jump the note into the next slot (see
 * `docs/specs/compose-note-placement.ears.md`, PLACE-*).
 *
 * The slot width (snap unit) is one whole beat for notes at least one beat long
 * (so bar-length notes line up cleanly with the bar ruler), one half-beat for
 * eighth notes, and one quarter-beat for sixteenths — without the last step a
 * 1/16 note could only ever land on the 1/8 grid.
 *
 * @param beat     Raw beat position of the click (`x / beatWidth`).
 * @param duration Duration of the note being placed, in beats.
 * @returns The floored start beat for the new note.
 */
export function snapPlacementBeat(beat: number, duration: number): number {
  const snapUnit = duration >= 1 ? 1 : duration >= 0.5 ? 0.5 : 0.25
  return Math.floor(beat / snapUnit) * snapUnit
}

// ============================================================
// MIDI Export
// ============================================================

/** Encode a melody as a Standard MIDI File (Format 1).
 *  `channel` is the zero-based MIDI channel for all note events —
 *  pass 9 (channel 10) for percussion so DAWs load the file as a drum track. */
export function exportMelodyToMIDI(
  melody: MelodyItem[],
  bpm: number,
  channel: number = 0,
): Uint8Array | null {
  if (melody == null || melody.length === 0) return null

  const TICKS_PER_BEAT = 480

  function writeVarLen(value: number): number[] {
    const bytes: number[] = []
    let v = Math.floor(value)
    bytes.push(v & 0x7f)
    while ((v >>= 7) > 0) {
      bytes.push((v & 0x7f) | 0x80)
    }
    bytes.reverse()
    return bytes
  }

  // Build absolute event list
  const absEvents: Array<{
    tick: number
    delta: number
    type: number
    subtype?: number
    note?: number
    velocity?: number
    data?: number[]
  }> = []

  // Tempo meta event (0xFF 0x51)
  const microsecondsPerBeat = Math.round(60000000 / bpm)
  absEvents.push({
    tick: 0,
    delta: 0,
    type: 0xff,
    subtype: 0x51,
    data: [
      (microsecondsPerBeat >> 16) & 0xff,
      (microsecondsPerBeat >> 8) & 0xff,
      microsecondsPerBeat & 0xff,
    ],
  })

  // Time signature (0xFF 0x58)
  absEvents.push({
    tick: 0,
    delta: 0,
    type: 0xff,
    subtype: 0x58,
    data: [0x04, 0x02, 0x18, 0x08],
  })

  // Note events
  melody.forEach((item) => {
    const midi = item.note?.midi ?? 60
    const tickOn = Math.round(item.startBeat * TICKS_PER_BEAT)
    const tickOff = Math.round(
      (item.startBeat + item.duration) * TICKS_PER_BEAT,
    )
    absEvents.push({
      tick: tickOn,
      delta: 0,
      type: 0x90 | (channel & 0x0f),
      note: midi,
      velocity: 80,
    })
    absEvents.push({
      tick: tickOff,
      delta: 0,
      type: 0x80 | (channel & 0x0f),
      note: midi,
      velocity: 0,
    })
  })

  // Sort by tick
  absEvents.sort((a, b) => a.tick - b.tick)

  // Recompute deltas
  let prevTick = 0
  absEvents.forEach((e) => {
    const d = e.tick - prevTick
    e.delta = d
    prevTick = e.tick
  })

  // Serialize track
  const trackData: number[] = []
  absEvents.forEach((e) => {
    trackData.push(...writeVarLen(e.delta))
    if (e.type === 0xff) {
      trackData.push(e.subtype!)
      if (e.data) {
        trackData.push(e.data.length)
        trackData.push(...e.data)
      } else {
        trackData.push(0)
      }
    } else {
      trackData.push(e.type, e.note!, e.velocity!)
    }
  })

  // End of track (0xFF 0x2F 0x00)
  trackData.push(0xff, 0x2f, 0x00)

  // Header chunk
  const header = [
    0x4d,
    0x54,
    0x68,
    0x64, // MThd
    0x00,
    0x00,
    0x00,
    0x06, // length 6
    0x00,
    0x01, // format 1
    0x00,
    0x01, // 1 track
    0x01,
    0xe0, // 480 ticks/beat
  ]

  // Track chunk
  const trackLen = trackData.length
  const track = [
    0x4d,
    0x54,
    0x72,
    0x6b, // MTrk
    (trackLen >> 24) & 0xff,
    (trackLen >> 16) & 0xff,
    (trackLen >> 8) & 0xff,
    trackLen & 0xff,
    ...trackData,
  ]

  const midiData = new Uint8Array(header.length + track.length)
  midiData.set(header, 0)
  midiData.set(track, header.length)
  return midiData
}

/** Trigger a browser download of a MIDI file. */
export function downloadMIDI(
  melody: MelodyItem[],
  bpm: number,
  filename?: string,
  channel: number = 0,
): boolean {
  const data = exportMelodyToMIDI(melody, bpm, channel)
  if (!data) {
    showNotification('No melody to export. Add some notes first.', 'warning')
    return false
  }
  const blob = new Blob([new Uint8Array(data)], { type: 'audio/midi' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download =
    filename != null && filename !== '' ? filename : 'pitchperfect-melody.mid'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
  return true
}

/** Import a melody from a Standard MIDI File (Format 0 or 1).
 *  Parses Note On/Off events and converts them to MelodyItems.
 *  Returns null on parse error.
 */
export function importMelodyFromMIDI(data: Uint8Array): MelodyItem[] | null {
  try {
    // Validate MIDI header
    if (data.length < 14) return null
    if (
      data[0] !== 0x4d ||
      data[1] !== 0x54 ||
      data[2] !== 0x68 ||
      data[3] !== 0x64
    ) {
      return null
    }

    const format = (data[8] << 8) | data[9]
    // Support format 0 (single track) and format 1 (multi-track)
    if (format !== 0 && format !== 1) return null

    const ticksPerBeat = (data[12] << 8) | data[13]
    if (ticksPerBeat === 0) return null

    let offset = 14 // After header chunk

    // Collect all note events across tracks
    interface MidiNoteEvent {
      tick: number
      type: 'on' | 'off'
      channel: number
      note: number
      velocity: number
    }
    const allEvents: MidiNoteEvent[] = []

    // Read tracks
    while (offset < data.length) {
      if (offset + 8 > data.length) break
      if (
        data[offset] !== 0x4d ||
        data[offset + 1] !== 0x54 ||
        data[offset + 2] !== 0x72 ||
        data[offset + 3] !== 0x6b
      ) {
        break // Not a track chunk
      }
      const trackLen =
        (data[offset + 4] << 24) |
        (data[offset + 5] << 16) |
        (data[offset + 6] << 8) |
        data[offset + 7]
      offset += 8

      let tick = 0
      const trackEnd = offset + trackLen
      while (offset < trackEnd && offset < data.length) {
        // Read variable-length delta time (MIDI variable-length quantity)
        // Each byte: high bit=1 means continuation, high bit=0 means final byte.
        // The 7 low bits contribute to the value. Max 4 bytes per VLQ.
        let delta = 0
        let vlqBytes = 0
        while (offset < data.length && vlqBytes < 4) {
          const b = data[offset++]
          vlqBytes++
          delta = (delta << 7) | (b & 0x7f)
          if (!(b & 0x80)) break // High bit clear = final byte
        }
        // Safety: if we consumed 4 bytes and the last still had high bit set, the
        // VLQ is malformed (or hit a status byte like 0x80). Back up by 1 and use
        // what we have so far. This handles the edge case where a delta value's
        // final byte happens to have MSB=1 (e.g., delta 480 encodes as 0x83 0x60
        // and the 0x60's MSB=0 so it terminates correctly).
        // In practice, legitimate deltas in this test suite always terminate properly.

        tick += delta

        if (offset >= data.length) break
        const status = data[offset++]

        // End of track
        if (status === 0xff && offset < data.length && data[offset] === 0x2f) {
          offset++ // consume the 0x2F byte
          break
        }

        // Skip meta events (0xFF)
        if (status === 0xff) {
          if (offset >= data.length) break
          offset++ // skip meta type byte
          if (offset >= data.length) break
          const len = data[offset++]
          offset += len
          continue
        }

        // Skip sysex events (0xF0, 0xF7)
        if (status === 0xf0 || status === 0xf7) {
          if (offset >= data.length) break
          const len = data[offset++]
          offset += len
          continue
        }

        // Running status: if high bit not set, status = last status byte
        const channel = status & 0x0f
        const msgType = status & 0xf0

        if (msgType === 0x80) {
          // Note Off: read note + velocity
          if (offset + 2 > data.length) break
          const note = data[offset++]
          const velocity = data[offset++]
          allEvents.push({ tick, type: 'off', channel, note, velocity })
        } else if (msgType === 0x90) {
          // Note On: read note + velocity
          if (offset + 2 > data.length) break
          const note = data[offset++]
          const velocity = data[offset++]
          if (velocity === 0) {
            allEvents.push({ tick, type: 'off', channel, note, velocity })
          } else {
            allEvents.push({ tick, type: 'on', channel, note, velocity })
          }
        } else if (msgType === 0xa0 || msgType === 0xb0 || msgType === 0xe0) {
          // Aftertouch, Control Change, Pitch Bend — 2 data bytes
          if (offset + 2 > data.length) break
          offset += 2
        } else if (msgType === 0xc0 || msgType === 0xd0) {
          // Program Change, Channel Pressure — 1 data byte
          if (offset + 1 > data.length) break
          offset += 1
        } else {
          // Unknown — skip variable-length based on type
          let skipBytes = 0
          if (msgType >= 0x80 && msgType <= 0xe0) skipBytes = 2
          else if (status < 0x80) {
            // Running status, adjust back
            offset--
            continue
          }
          if (skipBytes > 0 && offset + skipBytes > data.length) break
          offset += skipBytes
        }
      }
      // Advance to the end of this track chunk, accounting for cases where
      // the inner loop exited early (e.g. end-of-track event consumed fewer bytes
      // than the declared length, or data ran out mid-track).
      offset = Math.max(offset, trackEnd)
    }

    // Build note-on map: for each (channel, note), track start tick
    interface NoteOnInfo {
      tick: number
      velocity: number
    }
    const activeNotes = new Map<string, NoteOnInfo>()
    interface NoteOnOff {
      startBeat: number
      duration: number
      midi: number
      velocity: number
    }
    const noteItems: NoteOnOff[] = []

    for (const ev of allEvents) {
      const key = `${ev.channel}:${ev.note}`
      if (ev.type === 'on') {
        activeNotes.set(key, { tick: ev.tick, velocity: ev.velocity })
      } else {
        const onInfo = activeNotes.get(key)
        if (onInfo) {
          const startBeat = onInfo.tick / ticksPerBeat
          const duration = Math.max(
            0.25,
            (ev.tick - onInfo.tick) / ticksPerBeat,
          )
          noteItems.push({
            startBeat,
            duration,
            midi: ev.note,
            velocity: onInfo.velocity,
          })
          activeNotes.delete(key)
        }
      }
    }

    if (noteItems.length === 0) return null

    // Sort by start time, deduplicate overlapping same-pitch notes on same channel
    noteItems.sort((a, b) => a.startBeat - b.startBeat)

    // Assign IDs and convert to MelodyItems
    let nextId = 1
    return noteItems.map((n) => {
      const { name, octave } = midiToNote(n.midi)
      return {
        id: nextId++,
        note: {
          name,
          octave,
          midi: n.midi,
          freq: midiToFreq(n.midi),
        },
        startBeat: n.startBeat,
        duration: n.duration,
      }
    })
  } catch {
    return null
  }
}

// ============================================================
// Note ID generation
// ============================================================
// Piano Roll Editor
// ============================================================

export interface PianoRollOptions {
  container: HTMLElement
  scale?: ScaleDegree[]
  bpm?: number
  totalBeats?: number
  onMelodyChange?: (melody: MelodyItem[]) => void
  onNoteSelect?: (note: MelodyItem | null) => void
  onInstrumentChange?: (instrument: InstrumentType) => void
  /** Called when the editor's internal playback state changes */
  onPlaybackStateChange?: (state: PlaybackState) => void
  onMoveLoopA?: (beat: number) => void
  onMoveLoopB?: (beat: number) => void
  onConfirm?: (message: string, onAccept: () => void) => void
  /** Toolbar grid button pressed. The host owns grid visibility (persisted
   *  setting) and round-trips it back via setShowGrid, so the toolbar and the
   *  settings panel can never disagree. Absent → editor toggles locally. */
  onGridToggle?: () => void
  /** Toolbar hints button pressed. Same host-owned round-trip contract as
   *  onGridToggle, but for the hover-hint tooltip (setHoverHints). */
  onHoverHintsToggle?: () => void
  /** A MIDI file was imported from the roll's own toolbar. The host stores it
   *  as a melody NAMED after the file rather than overwriting whatever melody
   *  was current under its old name. */
  onMelodyImport?: (melody: MelodyItem[], name: string) => void
}

export type PlaybackState = 'stopped' | 'playing' | 'paused'
const MAX_OCTAVE_ROWS = 11
export type ActiveTool = 'place' | 'erase' | 'select' | 'browse'
export type EffectType =
  | 'slide-up'
  | 'slide-down'
  | 'ease-in'
  | 'ease-out'
  | 'vibrato'
  | 'tremolo'
  | 'trill'
  | 'staccato'
  | 'chord'

export class PianoRollEditor {
  private container: HTMLElement
  private scale: ScaleDegree[] = []
  private melody: MelodyItem[] = []
  private bpm: number
  private totalBeats: number

  // DOM elements
  private pianoCanvas: HTMLCanvasElement | null = null
  private gridCanvas: HTMLCanvasElement | null = null
  private rulerCanvas: HTMLCanvasElement | null = null
  private pianoCtx: CanvasRenderingContext2D | null = null
  private gridCtx: CanvasRenderingContext2D | null = null
  private rulerCtx: CanvasRenderingContext2D | null = null
  private gridContainer: HTMLElement | null = null
  private hintEl: HTMLElement | null = null
  private timelineInfoEl: HTMLElement | null = null
  private beatInfoEl: HTMLElement | null = null
  private pitchTrackCanvas: HTMLCanvasElement | null = null
  private pitchTrackVisible = false
  private pitchDetector: PitchDetector | null = null

  // Dimensions
  private readonly config = PIANO_ROLL_CONFIG
  private rowHeight: number
  private beatWidth: number
  private zoomLevel: number
  private pianoWidth: number
  private rulerHeight: number
  private totalRows = 0
  /** Full content width in CSS px (totalBeats * beatWidth, at least a viewport). */
  private stretchedWidth = 0
  /** Visible width of the grid viewport in CSS px — the canvas is sized to THIS,
   *  never to the content, so a long song can't exceed the browser's canvas
   *  dimension limit (a 267-bar song is ~51k CSS px = ~102k device px at DPR 2,
   *  well past Chrome's 65,535 cap, which silently yields a blank canvas). */
  private viewportWidth = 0
  /** Horizontal scroll offset in content px. Content x = canvas x + scrollX. */
  private scrollX = 0

  // Playback
  private playbackState: PlaybackState = 'stopped'
  private isCountingIn = false
  private _countInBeats = 0
  // Playhead beat. Fed by PlaybackRuntime events during playback and by
  // ruler scrubbing while stopped/paused — the single playhead source.
  private remoteBeat = 0
  // Ball physics state for Yousician-like ball jumping through notes
  private ballCanvas: HTMLCanvasElement | null = null
  private ballCtx: CanvasRenderingContext2D | null = null
  private ballState: BallPhysicsState | null = null
  private ballNotes: NoteBounds[] = []
  private ballSpeed = 0.05
  private ballGravity = 0.003
  private ballBounce = 0.8
  private ballRadius = 8
  private ballPadding = { top: 5, bottom: 5, left: 0, right: 0 }
  private useBallPhysics = false // Toggle between vertical dot and ball physics
  // Track whether playback is external (from Practice tab) vs local (Editor tab)
  private isExternalPlayback = false
  // A-B loop region (beats; 0 = unset), pushed from App so the Compose editor
  // shows the same loop as the other tabs — labelled markers on the ruler and
  // span lines through the grid.
  private loopA = 0
  private loopB = 0
  private loopEnabled = false
  // Which A/B marker the pointer is dragging on the ruler (null = seeking).
  private loopDragTarget: 'A' | 'B' | null = null
  private onMoveLoopA?: (beat: number) => void
  private onMoveLoopB?: (beat: number) => void
  private onConfirm?: (message: string, onAccept: () => void) => void
  private isSeeking = false
  private _lastScrubNoteId = -1
  private _activeScrubNoteId: number | null = null
  // Waveform props for recording visualization
  private isRecording: (() => boolean) | null = null
  private getWaveform: (() => Float32Array | null) | null = null
  // Live recording preview: provisional notes (drawn dashed) + smoothed-pitch
  // needle. These never enter `this.melody` / undo history.
  private previewNotes: MelodyItem[] = []
  private liveMidi: number | null = null

  // Interaction
  private selectedNoteIds: Set<number> = new Set()
  private selectedNotesCache: MelodyItem[] = []
  private activeTool: ActiveTool = 'place'
  private previewMode = false
  private isDragging = false
  private isResizing = false
  private resizeHandle: 'left' | 'right' | null = null
  private dragStartX = 0
  private dragStartY = 0
  private dragStartBeat = 0
  /** Per-note offset from dragStartBeat/Row, populated at drag start. */
  private dragOffsets: { beat: number; row: number }[] = []
  private selectedDuration = 1
  private nextNoteId = 1
  private clipboard: MelodyItem[] = []
  private isBoxSelecting = false
  private boxStartX = 0
  private boxStartY = 0
  private dragDidPushHistory = false
  private boxEndX = 0
  private boxEndY = 0
  private dragStartRow = 0
  /** Original start/duration per selected note at resize start — resize
   *  applies the anchor's delta to each, so multi-note resize preserves
   *  the notes' individual lengths instead of collapsing to a shared end. */
  private resizeOrigins: { startBeat: number; duration: number }[] = []
  private resizeAnchorId = -1
  /** Aborts every document/window listener registered by this instance —
   *  destroy() must sever them or editors stack up across tab switches. */
  private readonly listenerAbort = new AbortController()

  // Scale/Octave state. Key + octave re-sync from every setScale call (the
  // scale's lowest row is the key root), so toolbar-driven rebuilds
  // (_rebuildScale) can never silently fall back to C at octave 3 while the
  // store holds the user's actual key/vocal range.
  private key = 'C'
  private octave = 3
  // Default to 2 to match the store default (`melodyStore._numOctaves = 2`).
  // Previously this was 1, which caused the on-screen counter ("Rows: 1") to
  // disagree with the actually-rendered scale (2 octaves' worth of rows).
  // The +/- buttons then stepped from 1 → 2 (no visual change) → 3 (jump),
  // which the user perceived as "things get messy".
  private numOctaves = 2

  private mode = 'major'

  // Grid visibility
  private showGrid = true

  // Theme palette for canvas drawing (see _readPalette)
  private palette!: RollPalette

  // Editor preset: pitched rows ('melody') or GM drum lanes ('drums').
  // Never mutates this.melody — toggling is non-destructive both ways.
  private kind: MelodyKind = 'melody'
  // Left keyboard interaction state
  private pressedKeyRow = -1
  private _activeKeyNoteId: number | null = null
  /** Monotonic id per key press, so an async voice id can tell whether its
   *  press is still the current one (see _pressKeyRow). */
  private _keyPressSeq = 0
  private _lastKeyHoverRow = -1
  // Hover hints (tooltip near the cursor over placed notes)
  private hoverHintsEnabled = true
  private hoverTipEl: HTMLElement | null = null
  private _lastHoverNoteId = -1
  // Lazily-built Path2D per GM midi for drawing lane icons on canvas
  private drumIconCache: Map<number, Path2D> | null = null

  // Scrollable mode — when true, render all octaves (C1–C7) with vertical scroll
  private scrollableMode = false

  // Effect state
  private selectedEffect: EffectType | null = null
  private vibratoAmplitude = 0.5
  private tremoloRate = 8
  private tremoloDepth = 0.5
  private trillRate = 10
  private trillInterval = 2
  private staccatoRatio = 0.4
  private chordType: ChordType = 'major'
  private _intervalModalEl: HTMLElement | null = null
  private _intervalResolve: ((value: number | null) => void) | null = null
  private _intervalBtns: Map<number, HTMLButtonElement> = new Map()

  // Undo/redo history
  private historyStack: MelodyItem[][] = []
  private redoStack: MelodyItem[][] = []
  private readonly maxHistorySize = 50

  // Callbacks
  private onMelodyChange?: (melody: MelodyItem[]) => void
  private onNoteSelect?: (note: MelodyItem | null) => void
  private onInstrumentChange?: (instrument: InstrumentType) => void
  private onPlaybackStateChange?: (state: PlaybackState) => void
  private onGridToggle?: () => void
  private onHoverHintsToggle?: () => void
  private onMelodyImport?: (melody: MelodyItem[], name: string) => void

  constructor(options: PianoRollOptions) {
    this.container = options.container
    this.scale = options.scale ?? []
    this.bpm = options.bpm ?? 120
    this.totalBeats = options.totalBeats ?? 16
    this.onMelodyChange = options.onMelodyChange
    this.onNoteSelect = options.onNoteSelect
    this.onInstrumentChange = options.onInstrumentChange
    this.onPlaybackStateChange = options.onPlaybackStateChange
    this.onMoveLoopA = options.onMoveLoopA
    this.onMoveLoopB = options.onMoveLoopB
    this.onConfirm = options.onConfirm
    this.onGridToggle = options.onGridToggle
    this.onHoverHintsToggle = options.onHoverHintsToggle
    this.onMelodyImport = options.onMelodyImport

    this.rowHeight = this.config.rowHeight
    this.zoomLevel = 1.0
    this.beatWidth = this.config.beatWidth
    this.pianoWidth = this.config.pianoWidth
    this.rulerHeight = this.config.rulerHeight
    this.totalRows = this.scale.length
    this._syncKeyFromScale()

    this._readPalette()
    this.buildDOM()
    this.attachEventListeners()
    this._updateSelectionControls()
    this.updateUndoRedoButtons()
    this.draw()
  }

  /** Resolve the drawing palette from CSS custom properties (themeable),
   *  falling back to the long-standing dark values. Re-read on resize so a
   *  theme change is picked up on the next layout pass. */
  private _readPalette(): void {
    const cs = window.getComputedStyle(this.container)
    const v = (name: string, fallback: string): string => {
      const val = cs.getPropertyValue(name).trim()
      return val !== '' ? val : fallback
    }
    this.palette = {
      bg: v('--roll-bg', '#0d1117'),
      surface: v('--roll-surface', '#161b22'),
      gridLine: v('--roll-grid-line', '#21262d'),
      border: v('--roll-border', '#30363d'),
      tickStrong: v('--roll-tick-strong', '#484f58'),
      text: v('--roll-text', '#8b949e'),
      accent: v('--roll-accent', '#58a6ff'),
      accentGlow: v('--roll-accent-glow', 'rgba(88, 166, 255, 0.5)'),
      active: v('--roll-active', '#3fb950'),
      activeGlow: v('--roll-active-glow', 'rgba(63, 185, 80, 0.9)'),
      blackRow: v('--roll-black-row', 'rgba(26, 31, 39, 0.5)'),
      fontSmall: v('--roll-font-small', '9px sans-serif'),
      fontLabel: v('--roll-font-label', '10px sans-serif'),
      fontMono: v('--roll-font-mono', '11px monospace'),
    }
  }

  /** Derive key root + start octave from the scale's lowest row (the scale is
   *  ordered high→low, so the last entry is the key root at the start octave).
   *  Keeps toolbar-driven rebuilds aligned with the store-provided scale. */
  private _syncKeyFromScale(): void {
    const root = this.scale[this.scale.length - 1]
    if (root == null) return
    this.key = root.name
    this.octave = root.octave
  }

  // ============================================================
  // Public API
  // ============================================================

  setMelody(melody: MelodyItem[]): void {
    // Skip if the incoming melody is structurally identical to the current
    // one. This prevents the reactive re-sync loop from wiping the
    // undo/redo history every time the editor itself emits a change:
    //   user edit -> pushHistory -> emit -> melodyStore.setMelody
    //              -> createEffect fires -> editor.setMelody(same data)
    //              -> clearHistory (BUG)
    // Without this guard, undo always sees an empty history stack.
    if (this.melodyEquals(melody)) {
      return
    }
    this.clearHistory()
    this.installMelody(melody)
    this.draw()
  }

  /**
   * Replace the melody as a SINGLE undoable step. Unlike setMelody (an external
   * sync that resets history), this snapshots the current melody onto the undo
   * stack first, so one undo restores the pre-replacement state — used when a
   * recorded take is committed over an existing melody. Emits the change so the
   * store/autosave stay in sync; the resulting setMelody round-trip is a no-op
   * (melodyEquals matches by value), so history is not re-cleared.
   */
  applyMelody(melody: MelodyItem[]): void {
    if (this.melodyEquals(melody)) {
      return
    }
    this.pushHistory()
    this.installMelody(melody)
    this.draw()
    this.emitMelodyChange()
    this.updateUndoRedoButtons()
  }

  /**
   * Install a new melody body: regenerate IDs (incoming IDs are discarded so
   * external sources — MIDI import, recording, copy-paste — can't introduce
   * collisions), re-seed ball physics, and GROW the octave row count to fit the
   * MIDI span (never shrink). Shared by setMelody (history-clearing) and
   * applyMelody (undoable).
   */
  private installMelody(melody: MelodyItem[]): void {
    this.melody = melody.map((item) => ({
      ...item,
      id: this.nextNoteId++,
    }))

    this.initializeBallPhysics()

    // Drum mode has a fixed 12-lane grid — never auto-fit octave rows.
    if (melody.length > 0 && this.kind !== 'drums') {
      this._fitRowsToMelody(melody)
    }
    this.updateBeatInfo()
  }

  /**
   * Size AND position the visible rows to cover a melody's pitch range.
   *
   * The old version only ever grew the octave COUNT, never moved the window's
   * bottom octave, so importing a song reaching below the current start
   * octave left its low notes rendered hatched off-grid (the "N notes are
   * outside the visible rows" case) with a mostly-empty grid above them.
   * Both ends have to move.
   */
  private _fitRowsToMelody(melody: MelodyItem[]): void {
    const range = melodyMidiRange(melody)

    // Only re-frame when something would actually be off-grid. Melodies that
    // already fit keep the user's chosen window — loading a one-note sketch
    // should not yank the rows around, and the manual Rows +/- controls stay
    // in charge of everything else.
    const top = this.scale[0]
    const bottom = this.scale[this.scale.length - 1]
    if (
      top !== undefined &&
      bottom !== undefined &&
      range.min >= bottom.midi &&
      range.max <= top.midi
    ) {
      return
    }

    // C4 = MIDI 60 → octave 4, matching midiToNote's numbering.
    const lowOct = Math.floor(range.min / 12) - 1
    const highOct = Math.floor(range.max / 12) - 1
    const needed = Math.min(MAX_OCTAVE_ROWS, Math.max(2, highOct - lowOct + 1))
    // Anchor the window on the lowest note, then pull it back down if the
    // clamped count would push the top above the highest note.
    let start = Math.max(1, lowOct)
    if (highOct - start + 1 > needed) start = Math.max(1, highOct - needed + 1)

    if (start === this.octave && needed === this.numOctaves) return
    this.octave = start
    // setNumOctaves early-returns when the count is unchanged, so rebuild
    // explicitly for the octave-only move.
    if (needed !== this.numOctaves) {
      this.setNumOctaves(needed)
    } else {
      this._rebuildScale()
      this.buildCanvases()
      this.draw()
      eventBus.dispatch('pitchperfect:octaveChange', {
        octave: this.octave,
        numOctaves: this.numOctaves,
      })
    }
  }

  /**
   * Initialize ball physics with current melody data
   * Converts melody items to NoteBounds for physics collision
   */
  private async initializeBallPhysics(): Promise<void> {
    const midiNotes = this.melody
      .filter((item) => item.note?.midi !== undefined)
      .map((item) => ({
        startBeat: item.startBeat,
        endBeat: item.startBeat + item.duration,
        midi: item.note!.midi,
        duration: item.duration,
        freq: item.note!.freq,
      }))

    if (midiNotes.length > 0) {
      this.ballNotes = midiNotes
      this.ballState = createBallPhysics({
        speed: this.ballSpeed,
        gravity: this.ballGravity,
        bounce: this.ballBounce,
        radius: this.ballRadius,
        padding: this.ballPadding,
      })
      this.useBallPhysics = true
    } else {
      this.useBallPhysics = false
    }
  }

  /**
   * Recreate ball physics when BPM changes
   * Called when user changes the BPM in the editor
   */
  private recreateBallPhysics(): void {
    if (this.useBallPhysics && this.ballState && this.ballNotes.length > 0) {
      this.ballState = createBallPhysics({
        speed: this.ballSpeed,
        gravity: this.ballGravity,
        bounce: this.ballBounce,
        radius: this.ballRadius,
        padding: this.ballPadding,
      })
    }
  }

  /**
   * Shallow-equality check for melody arrays. Compares length and the
   * stable identity-bearing fields per item. Used to guard setMelody
   * against reactive self-sync loops (see setMelody comment).
   */
  private melodyEquals(other: MelodyItem[]): boolean {
    if (other.length !== this.melody.length) return false
    for (let i = 0; i < other.length; i++) {
      const a = this.melody[i]
      const b = other[i]
      if (
        a.startBeat !== b.startBeat ||
        a.duration !== b.duration ||
        a.note?.midi !== b.note?.midi ||
        a.note?.freq !== b.note?.freq
      ) {
        return false
      }
    }
    return true
  }

  getMelody(): MelodyItem[] {
    return [...this.melody]
  }

  // ============================================================
  // Undo/Redo
  // ============================================================

  /** Push current state to history stack before making changes */
  private pushHistory(): void {
    // Save a deep copy of current melody
    this.historyStack.push(JSON.parse(JSON.stringify(this.melody)))
    // Limit history size
    if (this.historyStack.length > this.maxHistorySize) {
      this.historyStack.shift()
    }
    // Clear redo stack on new action
    this.redoStack = []
  }

  /** Undo the last action */
  undo(): boolean {
    if (this.historyStack.length === 0) return false
    // Save current state to redo stack
    this.redoStack.push(JSON.parse(JSON.stringify(this.melody)))
    // Restore previous state
    this.melody = this.historyStack.pop()!
    this.emitMelodyChange()
    this.draw()
    this.updateUndoRedoButtons()
    return true
  }

  /** Redo the last undone action */
  redo(): boolean {
    if (this.redoStack.length === 0) return false
    // Save current state to history stack
    this.historyStack.push(JSON.parse(JSON.stringify(this.melody)))
    // Restore next state
    this.melody = this.redoStack.pop()!
    this.emitMelodyChange()
    this.draw()
    this.updateUndoRedoButtons()
    return true
  }

  /** Check if undo is available */
  canUndo(): boolean {
    return this.historyStack.length > 0
  }

  /** Check if redo is available */
  canRedo(): boolean {
    return this.redoStack.length > 0
  }

  /** Whether scrollable mode is active (all 7 octaves visible) */
  isScrollable(): boolean {
    return this.scrollableMode
  }

  /** Clear all history (call on preset load or melody clear) */
  clearHistory(): void {
    this.historyStack = []
    this.redoStack = []
    this.updateUndoRedoButtons()
  }

  /** Update undo/redo button disabled states */
  private updateUndoRedoButtons(): void {
    const undoBtn = this.container.querySelector(
      '#roll-undo-btn',
    ) as HTMLButtonElement
    const redoBtn = this.container.querySelector(
      '#roll-redo-btn',
    ) as HTMLButtonElement
    if (undoBtn != null) undoBtn.disabled = !this.canUndo()
    if (redoBtn != null) redoBtn.disabled = !this.canRedo()
  }

  setScale(scale: ScaleDegree[]): void {
    if (this.scrollableMode) return
    // Drum lanes are fixed — a store-scale change (key/vocal-range edits)
    // must not clobber them. this.key/octave stay as last synced; toggling
    // back to melody re-pulls the store scale via the wrapper.
    if (this.kind === 'drums') return
    this.scale = scale
    this._syncKeyFromScale()
    // Ensure minimum 2 rows (one octave) to prevent 0-height canvas
    this.totalRows = Math.max(scale.length, 2)
    this.buildCanvases()
    this.draw()
    this._announceOffScaleNotes()
  }

  /** Row changes (scale type, rows, octave) never move notes — but they can
   *  push notes off the visible grid, where they render hatched at their
   *  interpolated pitch. Say so, so the change never reads as data loss. */
  private _announceOffScaleNotes(): void {
    if (!this.hintEl || this.melody.length === 0) return
    let off = 0
    for (const n of this.melody) {
      if (this.midiToRow(n.note.midi) < 0) off++
    }
    if (off > 0) {
      this.hintEl.textContent = `${off} note${off === 1 ? ' is' : 's are'} outside the visible rows (shown hatched at true pitch) — notes are unchanged; adjust Scale or Rows to bring them back`
    }
  }

  setBPM(bpm: number): void {
    this.bpm = bpm
    this.recreateBallPhysics()
  }

  setInstrument(instrument: InstrumentType): void {
    this.onInstrumentChange?.(instrument)
  }

  setTotalBeats(beats: number): void {
    this.totalBeats = beats
    this.buildCanvases()
    this.draw()
    this.updateBeatInfo()
  }

  zoomIn(): void {
    this.zoomLevel = Math.min(3.0, this.zoomLevel + 0.2)
    this.beatWidth = this.config.beatWidth * this.zoomLevel
    this.buildCanvases()
    this.draw()
  }

  zoomOut(): void {
    this.zoomLevel = Math.max(0.3, this.zoomLevel - 0.2)
    this.beatWidth = this.config.beatWidth * this.zoomLevel
    this.buildCanvases()
    this.draw()
  }

  setZoom(level: number): void {
    this.zoomLevel = Math.max(0.3, Math.min(3.0, level))
    this.beatWidth = this.config.beatWidth * this.zoomLevel
    this.buildCanvases()
    this.draw()
  }

  updateZoomDisplay(): void {
    const el = this.container.querySelector('#roll-zoom-value')
    if (el) el.textContent = `${Math.round(this.zoomLevel * 100)}%`
  }

  fitToView(): void {
    if (!this.gridContainer) return
    // The grid container sits NEXT to the piano column (they're siblings in
    // .roll-grid-body), so its clientWidth is already the available grid
    // viewport — subtracting pianoWidth again undershot the fit.
    const containerWidth = this.gridContainer.clientWidth
    const minWidth = this.totalBeats * this.config.beatWidth
    if (containerWidth > 0 && minWidth > 0) {
      this.setZoom(containerWidth / minWidth)
    }
  }

  setCurrentNote(index: number): void {
    if (index >= 0) {
      const item = this.melody[index]
      if (item != null) {
        this.remoteBeat = item.startBeat
      }
    }
    // NOTE: Do NOT reset remoteBeat to 0 when index < 0.
    // The playhead position is driven by the playback controller, not by
    // note selection state. Resetting here causes the playhead to teleport
    // to beat 0 when the SolidJS effect fires setCurrentNote(-1) after
    // handleBeatUpdate has already positioned it at the melody end.
    this.drawWithPlayhead()
  }

  setWaveformProps(
    isRecording: (() => boolean) | null,
    getWaveform: (() => Float32Array | null) | null,
  ): void {
    this.isRecording = isRecording
    this.getWaveform = getWaveform
  }

  /** Provisional notes captured live during recording, or the candidate take
   *  during review (drawn dashed). Never enters the melody / undo history.
   *  During playback the beat loop repaints; when stopped (review) we repaint
   *  here so the cleanup slider updates immediately. */
  setPreviewNotes(notes: MelodyItem[]): void {
    this.previewNotes = notes
    if (!this.isExternalPlayback) this.draw()
  }

  /** Smoothed live pitch (fractional MIDI) for the recording needle, or null. */
  setLiveMidi(midi: number | null): void {
    this.liveMidi = midi
  }

  /** Called by App to sync the editor's playhead animation to the melody engine's timeline.
   *  When Practice tab playback is active, this ensures the editor's playhead moves
   *  in lockstep with the melody engine. */
  setRemoteBeat(beat: number): void {
    // Don't update during count-in - wait for count-in to complete first
    // This prevents notes from playing before the user presses Play
    if (this.isCountingIn) return

    if (this.playbackState === 'stopped') return
    this.remoteBeat = beat
    this.handleBeatUpdate(beat)
  }

  /** Called by App when external playback starts - indicates we should use event-based updates */
  setExternalPlayback(active: boolean): void {
    this.isExternalPlayback = active
  }

  /** Set count-in beats for precount visualization.
   *  During count-in, the playhead is offset so it sweeps from the left
   *  edge to countInBeats*beatWidth pixels into the grid. */
  setCountInBeats(beats: number): void {
    this._countInBeats = Math.max(0, beats)
  }

  /** Set the A-B loop region (beats; 0 = unset) and redraw so the markers
   *  update immediately whether the editor is playing or stopped. */
  setLoop(a: number, b: number, enabled: boolean): void {
    if (a === this.loopA && b === this.loopB && enabled === this.loopEnabled) {
      return
    }
    this.loopA = a
    this.loopB = b
    this.loopEnabled = enabled
    if (this.isExternalPlayback) this.drawWithPlayhead()
    else this.draw()
  }

  /** A-B loop span on the grid canvas — a shaded region between A and B plus
   *  full-height boundary lines (shared overlay helper). Ruler carries labels. */
  private drawGridLoop(
    ctx: CanvasRenderingContext2D,
    countInOffset: number,
    totalHeight: number,
  ): void {
    drawAbLoopOverlay(ctx, {
      a: this.loopA,
      b: this.loopB,
      enabled: this.loopEnabled,
      posOf: (beat) => countInOffset + beat * this.beatWidth,
      orientation: 'vertical',
      crossExtent: totalHeight,
      clipMin: 0,
      clipMax: this.stretchedWidth,
      flag: 'none',
    })
  }

  /** A-B loop markers on the ruler — a boundary tick plus a labelled flag,
   *  A-right / B-left so adjacent markers don't overlap (shared helper). */
  private drawRulerLoop(
    ctx: CanvasRenderingContext2D,
    countInOffset: number,
  ): void {
    drawAbLoopOverlay(ctx, {
      a: this.loopA,
      b: this.loopB,
      enabled: this.loopEnabled,
      posOf: (beat) => this.pianoWidth + countInOffset + beat * this.beatWidth,
      orientation: 'vertical',
      crossExtent: this.rulerHeight,
      clipMin: 0,
      clipMax: this.pianoWidth + this.stretchedWidth,
      flag: 'ruler',
      region: false,
    })
  }

  setPlaybackState(state: PlaybackState): void {
    // When handleBeatUpdate detects melody-end it sets playbackState='stopped'
    // and preserves remoteBeat at melodyEnd.  The SolidJS effect in
    // PianoRollCanvas then re-fires setPlaybackState('stopped'), which would
    // reset remoteBeat to 0 and cause the playhead to teleport.  Skip the
    // re-entry so the first (correct) stop wins.
    if (this.playbackState === state) {
      return
    }
    this.playbackState = state

    if (state === 'playing') {
      if (this.isCountingIn) {
        this.isCountingIn = false
      }
      // Re-seed the ball for this run — stopPlayback tears it down, and
      // without this the ball only ever existed for the first play.
      if (this.ballState === null && this.melody.length > 0) {
        void this.initializeBallPhysics()
      }
    } else if (state === 'paused') {
      this.stopPlayback()
    } else if (state === 'stopped') {
      this.stopPlayback()
      this.remoteBeat = 0
      this._countInBeats = 0
      this.playbackState = 'stopped'
      // Also reset external playback mode to ensure clean slate on tab switch
      this.isExternalPlayback = false
      this.draw()
    }
  }

  /** Update playback position from a beat value */
  updatePlaybackPosition(beat: number): void {
    this.handleBeatUpdate(beat)
  }

  addBeats(count: number): void {
    this.pushHistory()
    this.totalBeats += count
    this.buildCanvases()
    this.draw()
    this.updateUndoRedoButtons()
  }

  removeBeats(count: number): void {
    const newTotal = Math.max(4, this.totalBeats - count)
    // Check if any notes would be trimmed
    const wouldTrim = this.melody.some(
      (n) => n.startBeat + n.duration > newTotal,
    )

    const applyTrim = () => {
      // Trim notes that extend beyond the new total
      this.pushHistory()
      this.melody = this.melody
        .filter((n) => n.startBeat < newTotal)
        .map((n) =>
          n.startBeat + n.duration > newTotal
            ? { ...n, duration: newTotal - n.startBeat }
            : n,
        )
      this.totalBeats = newTotal
      this.buildCanvases()
      this.draw()
      // BUGFIX: trimming bars deletes notes silently — emit so the
      // app-level debouncedAutoSave persists the change. Without this
      // fanout, "remove 4 bars" would visually shrink the timeline but
      // leave stale full-length data in localStorage until another edit.
      this.emitMelodyChange()
      this.updateUndoRedoButtons()
    }

    if (wouldTrim) {
      if (this.onConfirm) {
        this.onConfirm(
          `Reducing the song to ${newTotal} beats will shorten or remove notes after that point.`,
          applyTrim,
        )
      } else {
        showNotification(
          'Could not open the trim confirmation. Your notes were not changed.',
          'warning',
        )
      }
    } else {
      applyTrim()
    }
  }

  clearMelody(): void {
    this.pushHistory()
    this.melody = []
    this.selectedNoteIds.clear()
    this.onNoteSelect?.(null)
    this.draw()
    // Same reason as removeBeats — internal callers (e.g. tests, future
    // refactors) need clear-emits-onMelodyChange to keep autosave in sync.
    this.emitMelodyChange()
    this.updateUndoRedoButtons()
  }

  private updateBeatInfo(): void {
    if (this.beatInfoEl) {
      this.beatInfoEl.textContent = `${this.totalBeats} beats | ${Math.ceil(this.totalBeats / PIANO_ROLL_CONFIG.beatsPerBar)} bars | ${this.melody.length} notes`
    }
  }

  private _updateHint(): void {
    if (!this.hintEl) return
    this._updateEffectSliders()
    this.hintEl.parentElement?.classList.remove('has-warning')
    if (this.selectedNoteIds.size > 0) {
      if (this.selectedNoteIds.size === 1) {
        const id = [...this.selectedNoteIds][0]
        const note = this.melody.find((n) => n.id === id)
        if (note) {
          const lane =
            this.kind === 'drums'
              ? DRUM_LANE_BY_MIDI.get(note.note.midi)
              : undefined
          const info = this.scale.find((s) => s.midi === note.note.midi)
          const name =
            lane?.label ?? (info ? `${info.name}${info.octave}` : '?')
          const startBar =
            Math.floor(note.startBeat / PIANO_ROLL_CONFIG.beatsPerBar) + 1
          const startBeat =
            Math.floor(note.startBeat % PIANO_ROLL_CONFIG.beatsPerBar) + 1
          this.hintEl.textContent = `Selected: ${name} | Duration: ${note.duration}b | Bar ${startBar}/${startBeat} — Right-click or Del to delete`
        }
      } else {
        const copyHint =
          this.clipboard.length > 0
            ? ' | Ctrl+C to copy, Ctrl+V to paste'
            : ' | Ctrl+C to copy'
        this.hintEl.textContent = `${this.selectedNoteIds.size} notes selected | Shift+click to toggle | Drag to multi-move | Del to delete${copyHint}`
      }
    } else if (this.activeTool === 'place') {
      let msg = `Click to place a ${this.selectedDuration}b note`
      if (this.selectedEffect) {
        msg += ` [Effect: ${this.selectedEffect}]`
      }
      msg += ' | Right-click to delete'
      if (this.clipboard.length > 0) {
        msg += ` | Ctrl+V to paste ${this.clipboard.length} note${this.clipboard.length > 1 ? 's' : ''}`
      }
      this.hintEl.textContent = msg
    } else if (this.activeTool === 'erase') {
      let msg = 'Click on a note to erase it'
      if (this.clipboard.length > 0) {
        msg += ` | Ctrl+V to paste ${this.clipboard.length} note${this.clipboard.length > 1 ? 's' : ''}`
      }
      this.hintEl.textContent = msg
    } else if (this.activeTool === 'browse') {
      let msg =
        'Click notes to select and edit effects | Shift+click to multi-select'
      if (this.clipboard.length > 0) {
        msg += ` | Ctrl+V to paste ${this.clipboard.length} note${this.clipboard.length > 1 ? 's' : ''}`
      }
      this.hintEl.textContent = msg
    } else {
      let msg = 'Click and drag note edges to resize | Del to delete selected'
      if (this.clipboard.length > 0) {
        msg += ` | Ctrl+V to paste ${this.clipboard.length} note${this.clipboard.length > 1 ? 's' : ''}`
      }
      this.hintEl.textContent = msg
    }
  }

  private _showEffectHoverHint(effect: EffectType): void {
    if (!this.hintEl) return
    const n = this.selectedNoteIds.size
    if (n === 0) {
      const hints: Record<string, string> = {
        vibrato: 'Select a note first, then press V for vibrato',
        tremolo: 'Select a note first, then press T for tremolo',
        trill: 'Select a note first, then press Shift+T for trill',
        staccato: 'Select a note first, then press Shift+K for staccato',
        'slide-up': 'Select a note first to apply slide/ease',
        'slide-down': 'Select a note first to apply slide/ease',
        'ease-in': 'Select a note first to apply slide/ease',
        'ease-out': 'Select a note first to apply slide/ease',
      }
      if (hints[effect]) this.hintEl.textContent = hints[effect]
    }
  }

  private _updateSelectionControls(): void {
    const modeGroup = this.container.querySelector(
      '.roll-mode-group',
    ) as HTMLElement | null
    const instrGroup = this.container.querySelector(
      '.roll-instrument-group',
    ) as HTMLElement | null
    const show = this.activeTool === 'select' || this.activeTool === 'browse'
    if (modeGroup) modeGroup.classList.toggle('disabled', !show)
    if (instrGroup) instrGroup.classList.toggle('disabled', !show)
  }

  private _updatePreviewModeUI(): void {
    const editGroup = this.container.querySelector(
      '.roll-group[data-name="Edit"]',
    ) as HTMLElement | null
    const effectsGroup = this.container.querySelector(
      '.roll-group[data-name="Effects"]',
    ) as HTMLElement | null
    const ioGroup = this.container.querySelector(
      '.roll-group[data-name="I/O"]',
    ) as HTMLElement | null
    if (editGroup)
      editGroup.classList.toggle('roll-toolbar-disabled', this.previewMode)
    if (effectsGroup)
      effectsGroup.classList.toggle('roll-toolbar-disabled', this.previewMode)
    if (ioGroup)
      ioGroup.classList.toggle('roll-toolbar-disabled', this.previewMode)
  }

  private _updateTimelineInfo(beat: number): void {
    if (!this.timelineInfoEl) return
    const totalBars = Math.ceil(this.totalBeats / PIANO_ROLL_CONFIG.beatsPerBar)
    const currentBar = Math.floor(beat / PIANO_ROLL_CONFIG.beatsPerBar) + 1
    const currentBeat = Math.floor(beat % PIANO_ROLL_CONFIG.beatsPerBar) + 1
    this.timelineInfoEl.textContent = `Bar ${currentBar}/${totalBars} | Beat ${currentBeat}`
  }

  // ============================================================
  // Pitch Track
  // ============================================================

  private _togglePitchTrack(): void {
    this.pitchTrackVisible = !this.pitchTrackVisible
    const btn = this.container.querySelector('#roll-pitch-track-btn')
    if (btn) {
      btn.classList.toggle('active', this.pitchTrackVisible)
      btn.setAttribute('aria-pressed', String(this.pitchTrackVisible))
    }
    if (this.pitchTrackCanvas) {
      this.pitchTrackCanvas.style.display = this.pitchTrackVisible
        ? 'block'
        : 'none'
    }
    if (this.pitchTrackVisible) {
      this._initPitchTrack()
    }
  }

  private _initPitchTrack(): void {
    if (!this.pitchTrackCanvas) return

    const win = window as Window & {
      pianoRollAudioEngine?: {
        init?: () => Promise<void>
        getPlaybackTimeData?: () => Float32Array
      }
    }

    if (win.pianoRollAudioEngine) {
      const engine = win.pianoRollAudioEngine
      if (engine.init) {
        engine.init().then(() => {
          if (!this.pitchDetector) {
            this.pitchDetector = new PitchDetector({
              sampleRate: 44100,
              bufferSize: 2048,
              threshold: 0.1,
              sensitivity: 5,
            })
          }
          this._resizePitchTrackCanvas()
        })
      } else {
        if (!this.pitchDetector) {
          this.pitchDetector = new PitchDetector({
            sampleRate: 44100,
            bufferSize: 2048,
            threshold: 0.1,
            sensitivity: 5,
          })
        }
        this._resizePitchTrackCanvas()
      }
    } else {
      if (!this.pitchDetector) {
        this.pitchDetector = new PitchDetector({
          sampleRate: 44100,
          bufferSize: 2048,
          threshold: 0.1,
          sensitivity: 5,
        })
      }
      this._resizePitchTrackCanvas()
    }
  }

  private _resizePitchTrackCanvas(): void {
    if (!this.pitchTrackCanvas) return
    const dpr = window.devicePixelRatio || 1
    const w = this.gridContainer?.clientWidth ?? 300
    const h = 80
    this.pitchTrackCanvas.width = w * dpr
    this.pitchTrackCanvas.height = h * dpr
    this.pitchTrackCanvas.style.width = `${w}px`
    this.pitchTrackCanvas.style.height = `${h}px`
    // Draw empty state
    const ctx = this.pitchTrackCanvas.getContext('2d')
    if (ctx) {
      // setTransform, not scale(): scale() compounds across repeated
      // resizes on the same context and blows the transform up.
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.fillStyle = this.palette.bg
      ctx.fillRect(0, 0, w, h)
      ctx.fillStyle = 'rgba(88, 166, 255, 0.3)'
      ctx.font = this.palette.fontMono
      ctx.textAlign = 'center'
      ctx.fillText('Pitch Track — press Play to start', w / 2, h / 2 + 4)
    }
  }

  private _updatePitchTrack(): void {
    if (!this.pitchTrackCanvas || !this.pitchDetector) return

    const win = window as Window & {
      pianoRollAudioEngine?: {
        getPlaybackTimeData?: () => Float32Array
      }
    }

    const engine = win.pianoRollAudioEngine
    if (!engine?.getPlaybackTimeData) return

    const timeData = engine.getPlaybackTimeData()
    const result = this.pitchDetector.detect(timeData)

    const ctx = this.pitchTrackCanvas.getContext('2d')
    if (!ctx) return

    const w = this.pitchTrackCanvas.clientWidth
    const h = this.pitchTrackCanvas.clientHeight

    // Scroll left for rolling display
    ctx.fillStyle = 'rgba(13, 17, 23, 0.15)'
    ctx.fillRect(0, 0, w - 2, h)

    // Draw center line
    ctx.strokeStyle = 'rgba(88, 166, 255, 0.2)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(0, h / 2)
    ctx.lineTo(w, h / 2)
    ctx.stroke()

    if (result.frequency > 0 && result.clarity > 0.5) {
      // Map frequency to Y position (invert: higher freq = lower Y)
      const minFreq = 65
      const maxFreq = 2100
      const y =
        h -
        ((Math.log(result.frequency) - Math.log(minFreq)) /
          (Math.log(maxFreq) - Math.log(minFreq))) *
          h

      // Draw a point at the current pitch
      ctx.fillStyle = 'rgba(63, 185, 80, 0.9)'
      ctx.beginPath()
      ctx.arc(w - 2, y, 2.5, 0, Math.PI * 2)
      ctx.fill()

      // Draw the waveform across the canvas width (rolling)
      const waveformData = engine.getPlaybackTimeData()
      if (
        waveformData !== null &&
        waveformData !== undefined &&
        waveformData.length > 0
      ) {
        ctx.beginPath()
        ctx.moveTo(0, h / 2)
        const step = Math.floor(waveformData.length / w)
        for (let x = 0; x < w; x++) {
          const sampleIdx = x * step
          const sample = waveformData[sampleIdx] || 0
          const waveY = h / 2 + sample * h * 4
          ctx.lineTo(x, waveY)
        }
        ctx.strokeStyle = 'rgba(88, 166, 255, 0.6)'
        ctx.lineWidth = 1
        ctx.stroke()
      }

      // Draw frequency label
      ctx.fillStyle = this.palette.accent
      ctx.font = '10px monospace'
      ctx.textAlign = 'right'
      ctx.fillText(`${Math.round(result.frequency)} Hz`, w - 4, 12)
    }
  }

  public setShowGrid(visible: boolean): void {
    if (this.showGrid !== visible) {
      this.showGrid = visible
      const btn = this.container.querySelector('#roll-grid-toggle')
      if (btn) {
        btn.classList.toggle('active', visible)
        btn.setAttribute('aria-pressed', String(visible))
      }
      this.draw()
    }
  }

  public setHoverHints(visible: boolean): void {
    if (this.hoverHintsEnabled === visible) return
    this.hoverHintsEnabled = visible
    const btn = this.container.querySelector('#roll-hint-toggle')
    if (btn) {
      btn.classList.toggle('active', visible)
      btn.setAttribute('aria-pressed', String(visible))
    }
    if (!visible) this._hideHoverTip()
  }

  getKind(): MelodyKind {
    return this.kind
  }

  /** The rows currently rendered (drum lanes in drum mode). */
  getScale(): ScaleDegree[] {
    return [...this.scale]
  }

  /** Switch the editor preset. Non-destructive: this.melody is never touched,
   *  so pitched notes survive a round-trip through drum mode (they render via
   *  the off-scale interpolation path while the lanes don't contain them). */
  setKind(kind: MelodyKind): void {
    if (kind === this.kind) return
    this.kind = kind
    this.pressedKeyRow = -1
    this._releaseKeyNote()
    this._hideHoverTip()
    if (kind === 'drums') {
      // Fixed 12-lane GM kit: scrollable mode makes no sense here.
      if (this.scrollableMode) this._setScrollableMode(false)
      this.scale = DRUM_LANE_SCALE.slice()
      this.totalRows = this.scale.length
    } else {
      // Rebuild pitched rows from the synced key/octave/mode; the wrapper
      // follows up with setScale(store scale), which wins if they differ.
      this._rebuildScale()
    }
    this._updateKindUI()
    this.buildCanvases()
    this.draw()
    this._updateHint()
  }

  /** Enable/disable scrollable (all-octaves) mode — shared by the toolbar
   *  toggle and setKind (drum mode force-exits it). */
  private _setScrollableMode(enabled: boolean): void {
    if (this.scrollableMode === enabled) return
    this.scrollableMode = enabled
    const scrollToggle = this.container.querySelector('#roll-scroll-toggle')
    if (scrollToggle) {
      scrollToggle.classList.toggle('active', enabled)
      scrollToggle.setAttribute('aria-pressed', String(enabled))
    }
    const rowsGroup = this.container.querySelector('.roll-octaves-group')
    const gridContainer = this.container.querySelector('.roll-grid-container')
    if (enabled) {
      // Prevent wrapper scroll — only grid canvas scrolls
      this.container.classList.add('piano-roll-scrollable-container')
      // Disable rows controls — all octaves are always visible
      if (rowsGroup) rowsGroup.classList.add('disabled')
      if (gridContainer) gridContainer.classList.add('piano-roll-scrollable')
    } else {
      this.container.classList.remove('piano-roll-scrollable-container')
      if (rowsGroup) rowsGroup.classList.remove('disabled')
      if (gridContainer) {
        gridContainer.classList.remove('piano-roll-scrollable')
      }
    }
  }

  /** Gray out the toolbar controls that only make sense for pitched rows
   *  while the drum kit is active (scale/instrument/effects/rows/shift/
   *  scroll/pitch-track). Same disabled treatment browse mode uses. */
  private _updateKindUI(): void {
    const drums = this.kind === 'drums'
    const selectors = [
      '.roll-group[data-name="Effects"]',
      '.roll-group[data-name="Instrument"]',
      '.roll-mode-group',
      '.roll-octaves-group',
      '.roll-octave-group',
      '#roll-scroll-toggle',
      '#roll-pitch-track-btn',
    ]
    for (const sel of selectors) {
      const el = this.container.querySelector(sel)
      if (el) el.classList.toggle('roll-toolbar-disabled', drums)
    }
  }

  private _engine(): AudioEngine | undefined {
    return (window as Window & { pianoRollAudioEngine?: AudioEngine })
      .pianoRollAudioEngine
  }

  // ── Left keyboard interaction ──────────────────────────────

  private _pianoRowFromEvent(e: PointerEvent): number {
    if (!this.pianoCanvas) return -1
    const rect = this.pianoCanvas.getBoundingClientRect()
    const row = Math.floor((e.clientY - rect.top) / this.rowHeight)
    return row >= 0 && row < this.scale.length ? row : -1
  }

  private onPianoPointerDown(e: PointerEvent): void {
    const row = this._pianoRowFromEvent(e)
    if (row < 0) return
    e.preventDefault()
    try {
      this.pianoCanvas?.setPointerCapture(e.pointerId)
    } catch {
      // Pointer capture is unavailable in some test environments.
    }
    this._pressKeyRow(row)
  }

  /** Sound + highlight a key lane. Called on press and, while held, on every
   *  lane change (glissando: melodic preview retargets, drums retrigger). */
  private _pressKeyRow(row: number): void {
    if (row === this.pressedKeyRow) return
    this._releaseKeyNote()
    this.pressedKeyRow = row
    // Identify THIS press, not just its row: re-pressing the same key
    // before the previous voice id resolved would otherwise let the stale
    // promise claim _activeKeyNoteId, orphaning a voice until it timed out.
    const press = ++this._keyPressSeq
    const scaleNote = this.scale[row]
    const engine = this._engine()
    if (scaleNote != null && engine !== undefined) {
      if (this.kind === 'drums') {
        const lane = DRUM_LANE_BY_MIDI.get(scaleNote.midi)
        if (lane) void engine.playDrum(lane.voice)
      } else {
        void engine.previewNote(scaleNote.freq, 2000, 0.45).then((id) => {
          if (id === undefined) return
          if (this._keyPressSeq === press && this.pressedKeyRow === row) {
            this._activeKeyNoteId = id
          } else {
            // Released (or moved on) before the async voice id arrived.
            engine.stopNote(id)
          }
        })
      }
    }
    this._updateKeyHint(row)
    this.drawPiano()
  }

  private _releaseKeyNote(): void {
    if (this._activeKeyNoteId !== null) {
      this._engine()?.stopNote(this._activeKeyNoteId)
      this._activeKeyNoteId = null
    }
  }

  private onPianoPointerMove(e: PointerEvent): void {
    const row = this._pianoRowFromEvent(e)
    if (this.pressedKeyRow >= 0) {
      if (row >= 0 && row !== this.pressedKeyRow) this._pressKeyRow(row)
      return
    }
    if (row !== this._lastKeyHoverRow) {
      this._lastKeyHoverRow = row
      if (row >= 0) this._updateKeyHint(row)
      else this._updateHint()
    }
  }

  private onPianoPointerUp(): void {
    this._releaseKeyNote()
    if (this.pressedKeyRow >= 0) {
      this.pressedKeyRow = -1
      this.drawPiano()
    }
  }

  /** Status-bar hint for the hovered/pressed key lane (the 62px column has
   *  no room for full names — "Closed Hat" etc. live here and in the tip). */
  private _updateKeyHint(row: number): void {
    if (!this.hintEl) return
    const scaleNote = this.scale[row]
    if (scaleNote == null) return
    if (this.kind === 'drums') {
      const lane = DRUM_LANE_BY_MIDI.get(scaleNote.midi)
      if (lane) {
        this.hintEl.textContent = `${lane.label} — press to audition, drag across lanes to try the kit`
        return
      }
    }
    this.hintEl.textContent = `${scaleNote.name}${scaleNote.octave} — hold to audition, drag for glissando`
  }

  // ── Hover hints (tooltip near the cursor over placed notes) ─

  private _hideHoverTip(): void {
    if (this.hoverTipEl) this.hoverTipEl.style.display = 'none'
    this._lastHoverNoteId = -1
  }

  /** Show the floating hint for the hovered note (name in melody mode, icon +
   *  drum name in drum mode; drum mode also auditions the hit once per
   *  note-enter while stopped). x/y are grid-canvas coordinates — the tip
   *  lives in the same positioned layer. */
  private _updateHoverTip(note: MelodyItem | null, x: number, y: number): void {
    if (!this.hoverTipEl) return
    if (
      !this.hoverHintsEnabled ||
      note == null ||
      this.isDragging ||
      this.isResizing ||
      this.isBoxSelecting
    ) {
      this._hideHoverTip()
      return
    }
    const tip = this.hoverTipEl
    if (note.id !== this._lastHoverNoteId) {
      this._lastHoverNoteId = note.id
      if (this.kind === 'drums') {
        const lane = DRUM_LANE_BY_MIDI.get(note.note.midi)
        if (lane) {
          tip.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${lane.iconPath}"/></svg><span>${lane.label}</span>`
          // Audition once per note-enter — never during playback.
          if (this.playbackState === 'stopped') {
            void this._engine()?.playDrum(lane.voice)
          }
        } else {
          tip.textContent = `${note.note.name}${note.note.octave}`
        }
      } else {
        tip.textContent = `${note.note.name}${note.note.octave} · ${note.duration}b`
      }
    }
    tip.style.display = 'flex'
    const maxLeft = Math.max(0, this.stretchedWidth - 110)
    tip.style.left = `${Math.min(Math.max(0, x + 14), maxLeft)}px`
    tip.style.top = `${Math.max(0, y - 32)}px`
  }

  destroy(): void {
    // Sever every document/window listener this instance registered —
    // without this, each Compose visit stacked another live editor whose
    // keyboard/mouse handlers kept firing against the dead instance.
    this.listenerAbort.abort()
    this.container.innerHTML = ''
  }

  // ============================================================
  // DOM Construction
  // ============================================================

  private buildDOM(): void {
    this.container.innerHTML = `
      <button class="roll-toolbar-toggle" aria-label="Toggle Toolbar" title="Toggle Toolbar">
        <svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z"/></svg>
      </button>
     <div class="roll-toolbar">

  <!-- TOOLS -->
  <div class="roll-group" data-name="Edit">
              <button class="roll-tool-btn active" data-tool="place" title="Place notes" aria-label="Place notes" aria-pressed="true">
                <svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
              </button>
              <button class="roll-tool-btn" data-tool="erase" title="Erase notes" aria-label="Erase notes" aria-pressed="false">
                <svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
              </button>
              <button class="roll-tool-btn" data-tool="select" title="Select notes" aria-label="Select notes" aria-pressed="false">
                <svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z"/></svg>
              </button>
  <!-- EDIT -->
    <div class="roll-undo-group">
              <button id="roll-undo-btn" class="roll-undo-btn" title="Undo (Ctrl+Z)" aria-label="Undo" disabled>
                <svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M12.5 8c-2.65 0-5.05.99-6.9 2.6L2 7v9h9l-3.62-3.62c1.39-1.16 3.16-1.88 5.12-1.88 3.54 0 6.55 2.31 7.6 5.5l2.37-.78C21.08 11.03 17.15 8 12.5 8z"/></svg>
              </button>
              <button id="roll-redo-btn" class="roll-redo-btn" title="Redo (Ctrl+Y)" aria-label="Redo" disabled>
                <svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M18.4 10.6C16.55 8.99 14.15 8 11.5 8c-4.65 0-8.58 3.03-9.96 7.22L3.9 16c1.05-3.19 4.05-5.5 7.6-5.5 1.95 0 3.73.72 5.12 1.88L13 16h9V7l-3.6 3.6z"/></svg>
              </button>
              </div>
    <button id="roll-clear-all" class="roll-ctrl-btn danger" title="Clear all notes" aria-label="Clear all notes">
      <svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M15 16h4v2h-4zm0-8h7v2h-7zm0 4h6v2h-6zM3 18c0 1.1.9 2 2 2h6c1.1 0 2-.9 2-2V8H3v10zM14 5h-3l-1-1H6L5 5H2v2h12z"/></svg>
    <!--  <span>Clear</span>-->
              </button>
  </div>

  <!-- VIEW -->
  <div class="roll-group" data-name="View">
     <button id="roll-grid-toggle" class="roll-grid-toggle-btn active" title="Toggle grid lines" aria-label="Toggle grid lines" aria-pressed="true">
       <svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M20 2H4c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM8 20H4v-4h4v4zm0-6H4v-4h4v4zm0-6H4V4h4v4zm6 12h-4v-4h4v4zm0-6h-4v-4h4v4zm0-6h-4V4h4v4zm6 12h-4v-4h4v4zm0-6h-4v-4h4v4zm0-6h-4V4h4v4z"/></svg>
       <span>Grid</span>
              </button>
    <button id="roll-pitch-track-btn" class="roll-pitch-track-btn" title="Toggle pitch track" aria-label="Toggle pitch track" aria-pressed="false">
      <svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M16 6l2.29 2.29-4.88 4.88-4-4L2 16.59 3.41 18l6-6 4 4 6.3-6.29L22 12V6z"/></svg>
      <span>Pitch Track</span>
              </button>
    <button id="roll-hint-toggle" class="roll-hint-btn active" title="Toggle hover hints (note / drum name at the cursor)" aria-label="Toggle hover hints" aria-pressed="true">
      <svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M4 3h16c1.1 0 2 .9 2 2v10c0 1.1-.9 2-2 2h-6l-4 4v-4H4c-1.1 0-2-.9-2-2V5c0-1.1.9-2 2-2zm7 3v2h2V6h-2zm0 4v5h2v-5h-2z"/></svg>
      <span>Hints</span>
              </button>
    
    <div class="roll-zoom-inline">
      <button id="roll-zoom-out" class="roll-zoom-btn" title="Zoom out" aria-label="Zoom out">
        <svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
              </button>
      <span id="roll-zoom-value" class="zoom-value">100%</span>
      <button id="roll-zoom-in" class="roll-zoom-btn" title="Zoom in" aria-label="Zoom in">
          <svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M19 13H5v-2h14v2z"/></svg>
              </button>
            </div>
    
    <!-- Zoom Fit -->
    <div class="roll-zoom-group">
      <button id="roll-zoom-fit" class="roll-zoom-btn" title="Fit to screen">
        <svg viewBox="0 0 24 24" width="12" height="12"><path fill="currentColor" d="M15 3l2.3 2.3-2.89 2.87 1.42 1.42L18.7 6.7 21 9V3zM3 9l2.3-2.3 2.87 2.89 1.42-1.42L6.7 5.3 9 3H3zm6 12l-2.3-2.3 2.89-2.87-1.42-1.42L5.3 17.3 3 15v6zm12-6l-2.3 2.3-2.87-2.89-1.42 1.42 2.89 2.87L15 21h6z"/></svg>
        <span>Fit</span>
      </button>
      <button id="roll-scroll-toggle" class="roll-scroll-btn" title="Toggle scrollable view" aria-label="Toggle scrollable view" aria-pressed="false">
        <svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M12 5.83L15.17 9l1.41-1.41L12 3 7.41 7.59 8.83 9 12 5.83zm0 12.34L8.83 15l-1.41 1.41L12 21l4.59-4.59L15.17 15 12 18.17z"/></svg>
        <span>Scroll</span>
      </button>
      <button id="roll-bar-prev" class="roll-zoom-btn" title="Previous page" aria-label="Previous page">
        <svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>
      </button>
      <label class="roll-bar-jump" title="Go to bar">
        <span class="roll-bar-label">Bar</span>
        <input id="roll-bar-input" class="roll-bar-input" type="number" min="1" value="1" aria-label="Go to bar" />
        <span id="roll-bar-total" class="roll-bar-total">/ 1</span>
      </label>
      <button id="roll-bar-next" class="roll-zoom-btn" title="Next page" aria-label="Next page">
        <svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>
      </button>
      <button id="roll-browse-toggle" class="roll-browse-btn" title="Browse mode (read-only, touch-scroll friendly)" aria-label="Browse mode" aria-pressed="false">
        <svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>
        <span>Browse</span>
      </button>
          </div>
    </div>

  <!-- MUSICAL (2 COL) -->
  <div class="roll-group roll-group-2col" data-name="Notes">

    <!-- Duration -->
    <div class="roll-durations" role="radiogroup" aria-label="Note duration">
            <button class="dur-btn" data-dur="0.25" role="radio" aria-checked="false">1/16</button>
            <button class="dur-btn" data-dur="0.5" role="radio" aria-checked="false">1/8</button>
            <button class="dur-btn active" data-dur="1" role="radio" aria-checked="true">1/4</button>
            <button class="dur-btn" data-dur="2" role="radio" aria-checked="false">1/2</button>
            <button class="dur-btn" data-dur="3" role="radio" aria-checked="false">3/4</button>
            <button class="dur-btn" data-dur="4" role="radio" aria-checked="false">1</button>
          </div>

    <!-- Rows -->
    <div class="roll-octaves-group">
      <span class="roll-group-label">Rows</span>
       <button id="roll-octaves-minus" class="octave-btn" title="Fewer octave rows" aria-label="Fewer octave rows">
        <svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M19 13H5v-2h14v2z"/></svg>
       </button>
       <span id="roll-octaves-value" class="octave-value">${this.numOctaves}</span>
       <button id="roll-octaves-plus" class="octave-btn" title="More octave rows" aria-label="More octave rows">
          <svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
       </button>
    </div>

    <!-- Shift -->
    <div class="roll-octave-group">
      <span class="roll-group-label">Shift</span>
      <button id="roll-octave-up" class="octave-btn" title="Shift melody up one octave" aria-label="Shift melody up one octave">
        <svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
      </button>
      <button id="roll-octave-down" class="octave-btn" title="Shift melody down one octave" aria-label="Shift melody down one octave">
        <svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M19 13H5v-2h14v2z"/></svg>
      </button>
    </div>

    <!-- Bars -->
    <div class="roll-bars-group">
      <button id="roll-bars-down" class="roll-bars-btn" title="Remove 4 bars" aria-label="Remove 4 bars">
        <svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>
      </button>

      <button id="roll-bars-up" class="roll-bars-btn" title="Add 4 bars" aria-label="Add 4 bars">
        <svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>
      </button>
    </div>

    <!-- Scale -->
    <div class="roll-mode-group">
        <label class="mode-label">
      <svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>
    </label>
            <select id="roll-mode-select" class="roll-mode-select" aria-label="Scale mode">
              <option value="major">Major</option>
              <option value="natural-minor">Natural Minor</option>
              <option value="harmonic-minor">Harmonic Minor</option>
              <option value="melodic-minor">Melodic Minor</option>
              <option value="dorian">Dorian</option>
              <option value="mixolydian">Mixolydian</option>
              <option value="phrygian">Phrygian</option>
              <option value="lydian">Lydian</option>
              <option value="pentatonic-major">Pentatonic</option>
              <option value="pentatonic-minor">Minor Pentatonic</option>
              <option value="blues">Blues</option>
              <option value="chromatic">Chromatic</option>
            </select>
          </div>

  </div>

  <!-- INSTRUMENT -->
  <div class="roll-group" data-name="Instrument">
    <div class="roll-instrument-group">
        <label class="instrument-label">
          <svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M20 3H4c-1.1 0-1.99.9-1.99 2L2 19c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H4V5h16v14zm-1-7h-2V7h-2v5h-2V7h-2v5H9V7H7v5H5V7h14v5z"/></svg>
        </label>
        <select id="roll-instrument-select" class="roll-instrument-select" aria-label="Instrument">
        <option value="sine">Sine</option>
        <option value="piano">Piano</option>
        <option value="organ">Organ</option>
        <option value="strings">Strings</option>
        <option value="synth">Synth</option>
      </select>
          </div>
          </div>

  <!-- EFFECTS -->
  <div class="roll-group roll-group-2col" data-name="Effects">
    <button id="roll-action-slide-up" class="roll-action-btn slide-up" title="Create ascending slide between selected notes (S)">
      <span>↑Slide</span>
    </button>
    <button id="roll-action-slide-down" class="roll-action-btn slide-down" title="Create descending slide between selected notes (Shift+S)">
      <span>↓Slide</span>
    </button>
    <button id="roll-action-ease-in" class="roll-action-btn ease-in" title="Create ease-in slide (starts level, slides down) (E)">
      <svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M4 12h4l4-6 8 10z"/></svg>
      <span>Ease In</span>
    </button>
    <button id="roll-action-ease-out" class="roll-action-btn ease-out" title="Create ease-out slide (slides up, eases to level) (Shift+E)">
      <svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M4 12l4-6 4 6h12z"/></svg>
      <span>Ease Out</span>
    </button>
    <button id="roll-action-vibrato" class="roll-action-btn vibrato" title="Create vibrato on selected note (V)">
      <svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M3 12c3-4 6 4 9 0s6 4 9 0"/></svg>
      <span>Vibrato</span>
    </button>
    <button id="roll-action-tremolo" class="roll-action-btn tremolo" title="Apply tremolo amplitude modulation (T)">
      <svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M3 8h2v8H3zm4-4h2v16H7zm4 2h2v12h-2zm4-2h2v16h-2zm4 4h2v8h-2z"/></svg>
      <span>Tremolo</span>
    </button>
    <button id="roll-action-trill" class="roll-action-btn trill" title="Apply trill pitch alternation (Shift+T)">
      <svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M3 4l4 8-4 8h6l4-8-4-8zm7 0l4 8-4 8h6l4-8-4-8z"/></svg>
      <span>Trill</span>
    </button>
    <button id="roll-action-staccato" class="roll-action-btn staccato" title="Apply staccato shortened note (Shift+K)">
      <svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M6 6h12v12H6z"/></svg>
      <span>Staccato</span>
    </button>
    <button id="roll-action-chord" class="roll-action-btn chord" title="Apply chord to note (C)">
      <svg viewBox="0 0 24 24" width="14" height="14"><circle cx="6" cy="18" r="2" fill="currentColor"/><circle cx="12" cy="10" r="2" fill="currentColor"/><circle cx="18" cy="6" r="2" fill="currentColor"/></svg>
      <span>Chord</span>
    </button>
          </div>

  <!-- IO -->
  <div class="roll-group roll-group-2col" data-name="I/O">
    <button id="roll-import-midi" class="roll-export-btn" title="Import melody from MIDI file">
      <svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M9 16h6v-6h4l-7-7-7 7h4v6zm-4 2h14v2H5z"/></svg>
      <span>Import MIDI</span>
    </button>
    <button id="roll-export-midi" class="roll-export-btn" title="Export melody as MIDI file">
      <svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
      <span>Export MIDI</span>
    </button>

    <button id="roll-export-wav" class="roll-export-btn" title="Export melody as WAV file">
      <svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
      <span>Export WAV</span>
    </button>
        </div>
</div>

  <!-- EFFECT POPOVER (floats below toolbar) -->
  <div class="roll-effect-popover" id="roll-effect-popover" style="display:none">
    <div class="roll-effect-popover-inner" id="roll-popover-vibrato" style="display:none">
      <label for="roll-vibrato-amp-slider" title="Vibrato depth in semitones">Amp:</label>
      <input type="range" id="roll-vibrato-amp-slider" min="0.1" max="3" step="0.1" value="0.5">
      <span class="roll-popover-val" id="roll-vibrato-amp-value">0.5</span>
    </div>
    <div class="roll-effect-popover-inner" id="roll-popover-tremolo" style="display:none">
      <label for="roll-tremolo-rate-slider" title="Tremolo rate in Hz">Rate:</label>
      <input type="range" id="roll-tremolo-rate-slider" min="2" max="20" step="0.5" value="8">
      <span class="roll-popover-val" id="roll-tremolo-rate-value">8</span>
      <label for="roll-tremolo-depth-slider" title="Tremolo depth (0.1-1.0)">Depth:</label>
      <input type="range" id="roll-tremolo-depth-slider" min="0.1" max="1" step="0.05" value="0.5">
      <span class="roll-popover-val" id="roll-tremolo-depth-value">0.5</span>
    </div>
    <div class="roll-effect-popover-inner" id="roll-popover-trill" style="display:none">
      <label for="roll-trill-rate-slider" title="Trill rate in Hz">Rate:</label>
      <input type="range" id="roll-trill-rate-slider" min="4" max="20" step="0.5" value="10">
      <span class="roll-popover-val" id="roll-trill-rate-value">10</span>
    </div>
    <div class="roll-effect-popover-inner" id="roll-popover-staccato" style="display:none">
      <label for="roll-staccato-ratio-slider" title="Staccato duration ratio (0.1-0.8)">Ratio:</label>
      <input type="range" id="roll-staccato-ratio-slider" min="0.1" max="0.8" step="0.05" value="0.4">
      <span class="roll-popover-val" id="roll-staccato-ratio-value">0.4</span>
    </div>
    <div class="roll-effect-popover-inner" id="roll-popover-chord" style="display:none">
      <label for="roll-chord-type-select" title="Chord type">Type:</label>
      <select id="roll-chord-type-select">
        <option value="power">Power (5)</option>
        <option value="major" selected>Major (Maj)</option>
        <option value="minor">Minor (min)</option>
        <option value="diminished">Diminished (dim)</option>
        <option value="augmented">Augmented (aug)</option>
        <option value="sus2">Sus2</option>
        <option value="sus4">Sus4</option>
        <option value="octave">Octave (8va)</option>
      </select>
    </div>
  </div>

  <!-- INTERVAL MODAL -->
  <div class="roll-interval-modal" id="roll-interval-modal" style="display:none">
    <div class="roll-interval-content">
      <h3 id="roll-interval-title">Slide Interval</h3>
      <div class="roll-interval-grid" id="roll-interval-grid"></div>
      <div class="roll-interval-actions">
        <button class="roll-interval-cancel" id="roll-interval-cancel">Cancel</button>
        <button class="roll-interval-remove" id="roll-interval-remove" style="display:none">Remove effect</button>
      </div>
    </div>
  </div>

      <div class="roll-main-area">
        <div class="roll-grid-wrapper">
          <div class="roll-ruler-container">
            <canvas class="roll-ruler"></canvas>
          </div>
          <div class="roll-grid-body">
            <canvas class="roll-piano" aria-label="Piano keys"></canvas>
            <div class="roll-grid-container">
              <div class="roll-grid-layer" style="position:relative">
                <canvas class="roll-grid" role="img" aria-label="Piano roll note grid"></canvas>
                <canvas id="roll-ball-canvas" class="roll-ball" style="display:none;position:absolute;top:0;left:0;pointer-events:none;z-index:3"></canvas>
                <div id="roll-hover-tip" class="roll-hover-tip" style="display:none" aria-hidden="true"></div>
              </div>
            </div>
          </div>
          <canvas id="roll-pitch-track-canvas" class="roll-pitch-track" style="display:none"></canvas>
          <div class="roll-status">
            <span id="roll-note-info" aria-live="polite">Click on the grid to place notes</span>
            <span id="roll-timeline-info">Bar 1/${Math.ceil(this.totalBeats / PIANO_ROLL_CONFIG.beatsPerBar)} | Beat 1</span>
            <span id="roll-beat-info">${this.totalBeats} beats</span>
          </div>
        </div>
      </div>
    `

    this.pianoCanvas = this.container.querySelector(
      '.roll-piano',
    ) as HTMLCanvasElement
    this.gridCanvas = this.container.querySelector(
      '.roll-grid',
    ) as HTMLCanvasElement
    this.rulerCanvas = this.container.querySelector(
      '.roll-ruler',
    ) as HTMLCanvasElement
    this.gridContainer = this.container.querySelector(
      '.roll-grid-container',
    ) as HTMLElement
    this.pitchTrackCanvas = this.container.querySelector(
      '#roll-pitch-track-canvas',
    ) as HTMLCanvasElement
    this.ballCanvas = this.container.querySelector(
      '#roll-ball-canvas',
    ) as HTMLCanvasElement

    this.pianoCtx = this.pianoCanvas.getContext('2d')
    this.gridCtx = this.gridCanvas.getContext('2d')
    this.rulerCtx = this.rulerCanvas.getContext('2d')

    this.buildCanvases()
  }

  /** Keep scrollX inside the scrollable range (content minus one viewport). */
  private _clampScroll(): void {
    const max = Math.max(0, this.stretchedWidth - this.viewportWidth)
    this.scrollX = Math.max(0, Math.min(this.scrollX, max))
  }

  /** Park the viewport-sized canvases at the current scroll offset inside the
   *  full-width spacer, so they always cover exactly what the user can see. */
  private _positionViewportCanvases(): void {
    const left = `${this.scrollX}px`
    if (this.gridCanvas) this.gridCanvas.style.left = left
    if (this.ballCanvas) this.ballCanvas.style.left = left
  }

  /** Move the viewport without repainting. Safe to call from inside a draw
   *  pass (the follow-the-playhead path does) — the next frame paints at the
   *  new offset, so there is no re-entrant draw. */
  private _setScroll(x: number): void {
    this.scrollX = x
    this._clampScroll()
    if (this.gridContainer && this.gridContainer.scrollLeft !== this.scrollX) {
      this.gridContainer.scrollLeft = this.scrollX
    }
    this._positionViewportCanvases()
  }

  /** Scroll so a content-x is visible, then redraw. For user-driven jumps
   *  (bar navigator, seek) — never call from inside a draw pass. */
  scrollToContentX(x: number, align: 'start' | 'center' = 'center'): void {
    this._setScroll(
      align === 'center'
        ? x - this.viewportWidth / 2
        : x - this.viewportWidth * 0.1,
    )
    if (this.isExternalPlayback) this.drawWithPlayhead()
    else this.draw()
  }

  /** Jump to a bar (1-based), as used by the toolbar's bar navigator. */
  goToBar(bar: number): void {
    const beatsPerBar = this.config.beatsPerBar
    const totalBars = Math.max(1, Math.ceil(this.totalBeats / beatsPerBar))
    const clamped = Math.max(1, Math.min(Math.round(bar), totalBars))
    this.scrollToContentX((clamped - 1) * beatsPerBar * this.beatWidth, 'start')
    this._updateBarNavigator()
  }

  /** Page the view by whole viewports. */
  pageView(direction: -1 | 1): void {
    this.scrollToContentX(
      this.scrollX +
        this.viewportWidth * 0.9 * direction +
        this.viewportWidth * 0.1,
      'start',
    )
    this._updateBarNavigator()
  }

  /** Sync the bar navigator input + total to the current scroll position. */
  private _updateBarNavigator(): void {
    const beatsPerBar = this.config.beatsPerBar
    const totalBars = Math.max(1, Math.ceil(this.totalBeats / beatsPerBar))
    const input = this.container.querySelector(
      '#roll-bar-input',
    ) as HTMLInputElement | null
    const totalEl = this.container.querySelector('#roll-bar-total')
    if (input) {
      input.max = String(totalBars)
      if (document.activeElement !== input) {
        const bar = Math.floor(this.scrollX / this.beatWidth / beatsPerBar) + 1
        input.value = String(Math.min(bar, totalBars))
      }
    }
    if (totalEl) totalEl.textContent = `/ ${totalBars}`
  }

  /** Device-pixel ratio, clamped so a canvas can never exceed MAX_CANVAS_PX. */
  private _safeDpr(cssWidth: number, cssHeight: number): number {
    const dpr = window.devicePixelRatio || 1
    const longest = Math.max(cssWidth, cssHeight, 1)
    return Math.min(dpr, Math.max(1, MAX_CANVAS_PX / longest))
  }

  private buildCanvases(): void {
    const dpr = window.devicePixelRatio || 1
    const totalHeight = this.totalRows * this.rowHeight

    // beatWidth already carries the zoom factor (setZoom/zoomIn/zoomOut all
    // assign config.beatWidth * zoomLevel) — multiplying by zoomLevel again
    // here inflated the canvas quadratically, leaving a dead scroll region
    // to the right of the content and breaking Fit.
    const minWidth = this.totalBeats * this.beatWidth
    const containerWidth = this.gridContainer?.clientWidth ?? 0
    // Content width (what you can scroll through) vs viewport width (what the
    // canvas actually rasterises). Keeping these separate is what lets an
    // arbitrarily long song render at all.
    this.stretchedWidth =
      containerWidth > 0 ? Math.max(minWidth, containerWidth) : minWidth
    this.viewportWidth =
      containerWidth > 0 ? containerWidth : this.stretchedWidth

    // The layer is the scroll spacer: it carries the full content width so the
    // container shows a native horizontal scrollbar, while the canvases stay
    // viewport-sized and are repositioned to the scroll offset on every scroll.
    const gridLayer = this.container.querySelector(
      '.roll-grid-layer',
    ) as HTMLElement | null
    if (gridLayer) {
      gridLayer.style.width = `${this.stretchedWidth}px`
      gridLayer.style.height = `${totalHeight}px`
    }
    this._clampScroll()

    // Piano canvas — style.width must be pinned like every other canvas or
    // HiDPI displays lay the column out at width*dpr CSS px (labels at half
    // scale, column twice as wide).
    if (this.pianoCanvas) {
      this.pianoCanvas.width = this.pianoWidth * dpr
      this.pianoCanvas.height = totalHeight * dpr
      this.pianoCanvas.style.width = `${this.pianoWidth}px`
      this.pianoCanvas.style.height = `${totalHeight}px`
      this.pianoCtx = this.pianoCanvas.getContext('2d')
      if (this.pianoCtx) this.pianoCtx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    // Ruler canvas spans the piano column plus ONE viewport of grid; the beat
    // marks inside it are drawn at the scroll offset (see drawRuler).
    const rulerWidth = this.pianoWidth + this.viewportWidth
    if (this.rulerCanvas) {
      const rDpr = this._safeDpr(rulerWidth, this.rulerHeight)
      this.rulerCanvas.width = rulerWidth * rDpr
      this.rulerCanvas.height = this.rulerHeight * rDpr
      this.rulerCanvas.style.width = `${rulerWidth}px`
      this.rulerCanvas.style.height = `${this.rulerHeight}px`
      this.rulerCtx = this.rulerCanvas.getContext('2d')
      if (this.rulerCtx) this.rulerCtx.setTransform(rDpr, 0, 0, rDpr, 0, 0)
    }

    // Grid canvas — viewport-sized, parked at the current scroll offset.
    if (this.gridCanvas) {
      const gDpr = this._safeDpr(this.viewportWidth, totalHeight)
      this.gridCanvas.width = this.viewportWidth * gDpr
      this.gridCanvas.height = totalHeight * gDpr
      this.gridCanvas.style.width = `${this.viewportWidth}px`
      this.gridCanvas.style.height = `${totalHeight}px`
      this.gridCtx = this.gridCanvas.getContext('2d')
      if (this.gridCtx) this.gridCtx.setTransform(gDpr, 0, 0, gDpr, 0, 0)
    }

    // Ball canvas (for Yousician-style ball jumping through notes)
    if (this.ballCanvas) {
      const bDpr = this._safeDpr(this.viewportWidth, totalHeight)
      this.ballCanvas.width = this.viewportWidth * bDpr
      this.ballCanvas.height = totalHeight * bDpr
      this.ballCanvas.style.width = `${this.viewportWidth}px`
      this.ballCanvas.style.height = `${totalHeight}px`
      this.ballCtx = this.ballCanvas.getContext('2d') ?? null
      if (this.ballCtx) this.ballCtx.setTransform(bDpr, 0, 0, bDpr, 0, 0)
    }

    this._positionViewportCanvases()

    // Cache status bar elements
    this.hintEl = this.container.querySelector('#roll-note-info')
    this.timelineInfoEl = this.container.querySelector('#roll-timeline-info')
    this.beatInfoEl = this.container.querySelector('#roll-beat-info')
    this.hoverTipEl = this.container.querySelector('#roll-hover-tip')

    // In normal mode, pin the grid body to the exact canvas height so
    // .roll-status sits immediately below the last row with no gap.
    // In scrollable mode, clear the inline style and let flex:1 fill the
    // wrapper so the body has a constrained height for overflow-y:auto.
    const gridBody = this.container.querySelector(
      '.roll-grid-body',
    ) as HTMLElement | null
    if (gridBody) {
      gridBody.style.height = this.scrollableMode ? '' : `${totalHeight}px`
    }
  }

  // ============================================================
  // Event Listeners
  // ============================================================

  private attachEventListeners(): void {
    const container = this.container

    // Toolbar toggle
    const toggleBtn = container.querySelector('.roll-toolbar-toggle')
    const toolbar = container.querySelector('.roll-toolbar')
    if (toggleBtn && toolbar) {
      toggleBtn.addEventListener('click', () => {
        toolbar.classList.toggle('collapsed')
        toggleBtn.classList.toggle('collapsed')
      })
    }

    // Tool buttons
    container.querySelectorAll('.roll-tool-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const tool = (btn as HTMLElement).dataset.tool as ActiveTool
        this.activeTool = tool
        container.querySelectorAll('.roll-tool-btn').forEach((b) => {
          b.classList.remove('active')
          b.setAttribute('aria-pressed', 'false')
        })
        btn.classList.add('active')
        btn.setAttribute('aria-pressed', 'true')
        this.selectedNoteIds.clear()
        this._updateSelectionControls()
        this.draw()
        this._updateHint()
      })
    })

    // Duration buttons
    container.querySelectorAll('.dur-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.selectedDuration = parseFloat(
          (btn as HTMLElement).dataset.dur ?? '1',
        )
        container.querySelectorAll('.dur-btn').forEach((b) => {
          b.classList.remove('active')
          b.setAttribute('aria-checked', 'false')
        })
        btn.classList.add('active')
        btn.setAttribute('aria-checked', 'true')
        this._updateHint()
      })
    })

    // Effect action buttons — apply to selected notes, or pre-select for
    // the next placed note when nothing is selected.
    const setupEffectBtn = (id: string, effect: EffectType) => {
      const btn = container.querySelector(id)
      btn?.addEventListener('click', () => {
        if (this.selectedNoteIds.size === 0) {
          if (this.selectedEffect === effect) {
            this.selectedEffect = null
          } else {
            this.selectedEffect = effect
          }
          this._updateEffectBtnStates(container)
          this._updateHint()
          return
        }
        this.selectedEffect = null
        this._updateEffectBtnStates(container)
        this._applyEffect(effect)
      })
      btn?.addEventListener('mouseenter', () => {
        this._showEffectHoverHint(effect)
      })
      btn?.addEventListener('mouseleave', () => {
        this._updateHint()
      })
    }
    setupEffectBtn('#roll-action-slide-up', 'slide-up')
    setupEffectBtn('#roll-action-slide-down', 'slide-down')
    setupEffectBtn('#roll-action-ease-in', 'ease-in')
    setupEffectBtn('#roll-action-ease-out', 'ease-out')
    setupEffectBtn('#roll-action-vibrato', 'vibrato')
    setupEffectBtn('#roll-action-tremolo', 'tremolo')
    setupEffectBtn('#roll-action-trill', 'trill')
    setupEffectBtn('#roll-action-staccato', 'staccato')
    setupEffectBtn('#roll-action-chord', 'chord')

    // Effect parameter sliders — DRY helper avoids repeating the
    // query → parse → iterate → mutate → emit/draw pipeline.
    this._bindEffectSlider(
      'roll-vibrato-amp-slider',
      'roll-vibrato-amp-value',
      'vibrato',
      (n, v) => {
        this.vibratoAmplitude = v
        n.vibratoAmplitude = v
      },
    )
    this._bindEffectSlider(
      'roll-tremolo-rate-slider',
      'roll-tremolo-rate-value',
      'tremolo',
      (n, v) => {
        this.tremoloRate = v
        n.tremoloRate = v
      },
    )
    this._bindEffectSlider(
      'roll-tremolo-depth-slider',
      'roll-tremolo-depth-value',
      'tremolo',
      (n, v) => {
        this.tremoloDepth = v
        n.tremoloDepth = v
      },
    )
    this._bindEffectSlider(
      'roll-trill-rate-slider',
      'roll-trill-rate-value',
      'trill',
      (n, v) => {
        this.trillRate = v
        n.trillRate = v
      },
    )
    this._bindEffectSlider(
      'roll-staccato-ratio-slider',
      'roll-staccato-ratio-value',
      'staccato',
      (n, v) => {
        this.staccatoRatio = v
        n.staccatoRatio = v
      },
    )

    // Chord type select (not a slider — kept inline)
    const chordTypeSelect = container.querySelector(
      '#roll-chord-type-select',
    ) as HTMLSelectElement
    chordTypeSelect?.addEventListener('change', () => {
      this.chordType = chordTypeSelect.value as ChordType
      const sel = this._getSelectedNotes()
      let changed = false
      for (const n of sel) {
        if (n.effectType === 'chord') {
          n.chordType = this.chordType
          changed = true
        }
      }
      if (changed) {
        this.emitMelodyChange()
        this.draw()
      }
    })

    // Interval modal — build preset grid and wire close events
    const intervalModal = container.querySelector(
      '#roll-interval-modal',
    ) as HTMLElement
    const intervalGrid = container.querySelector(
      '#roll-interval-grid',
    ) as HTMLElement
    const intervalCancel = container.querySelector(
      '#roll-interval-cancel',
    ) as HTMLElement
    this._intervalModalEl = intervalModal
    // Build preset buttons: two rows of 7
    const intervals = [12, 7, 5, 4, 3, 2, 1, -1, -2, -3, -4, -5, -7, -12]
    this._intervalBtns = new Map<number, HTMLButtonElement>()
    for (const iv of intervals) {
      const btn = document.createElement('button')
      btn.className = 'roll-interval-btn'
      btn.textContent = iv > 0 ? `+${iv}` : `${iv}`
      btn.dataset.interval = String(iv)
      btn.addEventListener('click', () => {
        if (this._intervalResolve) {
          this._intervalResolve(iv)
          this._intervalResolve = null
        }
        intervalModal.style.display = 'none'
      })
      intervalGrid.appendChild(btn)
      this._intervalBtns.set(iv, btn)
    }
    const intervalRemove = container.querySelector(
      '#roll-interval-remove',
    ) as HTMLElement
    intervalCancel.addEventListener('click', () => {
      if (this._intervalResolve) {
        this._intervalResolve(null)
        this._intervalResolve = null
      }
      intervalModal.style.display = 'none'
    })
    intervalRemove.addEventListener('click', () => {
      if (this._intervalResolve) {
        this._intervalResolve(NaN) // sentinel: remove effect
        this._intervalResolve = null
      }
      intervalModal.style.display = 'none'
    })
    intervalModal.addEventListener('click', (e) => {
      if (e.target === intervalModal) {
        if (this._intervalResolve) {
          this._intervalResolve(null)
          this._intervalResolve = null
        }
        intervalModal.style.display = 'none'
      }
    })

    // Reposition effect popover on scroll
    const repositionPopover = () => {
      const popover = container.querySelector(
        '#roll-effect-popover',
      ) as HTMLElement | null
      if (!popover || popover.style.display === 'none') return
      const effectsGroup = container.querySelector(
        '.roll-group[data-name="Effects"]',
      )
      if (effectsGroup instanceof HTMLElement) {
        const groupRect = effectsGroup.getBoundingClientRect()
        const containerRect = container.getBoundingClientRect()
        popover.style.top = `${groupRect.bottom - containerRect.top + 2}px`
        popover.style.left = `${groupRect.left - containerRect.left}px`
      }
    }
    // All document/window/container listeners register against listenerAbort
    // so destroy() can sever them in one shot (the container element outlives
    // the editor, and document/window obviously do).
    const signal = this.listenerAbort.signal
    container.addEventListener('scroll', repositionPopover, {
      passive: true,
      signal,
    })
    // Toolbar has overflow-x: auto — listen on it too
    const toolbarEl = container.querySelector('.roll-toolbar')
    toolbarEl?.addEventListener('scroll', repositionPopover, { passive: true })
    window.addEventListener('scroll', repositionPopover, {
      passive: true,
      signal,
    })
    // Also reposition on resize
    window.addEventListener('resize', repositionPopover, {
      passive: true,
      signal,
    })

    // Clear
    container
      .querySelector('#roll-clear-all')
      ?.addEventListener('click', () => {
        this.clearMelody()
        this.onMelodyChange?.([])
      })

    // Instrument selection
    container
      .querySelector('#roll-instrument-select')
      ?.addEventListener('change', (e) => {
        const target = e.target as HTMLSelectElement
        this.setInstrument(target.value as InstrumentType)
      })

    // Hover-hints toggle. Host-owned like the grid toggle: the callback flips
    // the persisted setting, which round-trips back via setHoverHints.
    container
      .querySelector('#roll-hint-toggle')
      ?.addEventListener('click', () => {
        if (this.onHoverHintsToggle) {
          this.onHoverHintsToggle()
        } else {
          this.setHoverHints(!this.hoverHintsEnabled)
        }
      })

    // Left keyboard — press a key to audition its lane, drag for glissando.
    this.pianoCanvas?.addEventListener('pointerdown', (e) => {
      this.onPianoPointerDown(e)
    })
    this.pianoCanvas?.addEventListener('pointermove', (e) => {
      this.onPianoPointerMove(e)
    })
    this.pianoCanvas?.addEventListener('pointerup', () => {
      this.onPianoPointerUp()
    })
    this.pianoCanvas?.addEventListener('pointercancel', () => {
      this.onPianoPointerUp()
    })
    this.pianoCanvas?.addEventListener('pointerleave', () => {
      this._lastKeyHoverRow = -1
      if (this.pressedKeyRow < 0) this._updateHint()
    })

    // Grid mouse events
    this.gridCanvas?.addEventListener('mousedown', (e) => {
      this.onGridMouseDown(e)
    })
    this.gridCanvas?.addEventListener('mousemove', (e) => {
      this.onGridMouseMove(e)
    })
    this.gridCanvas?.addEventListener('mouseup', (e) => {
      this.onGridMouseUp(e)
    })
    this.gridCanvas?.addEventListener('mouseleave', (e) => {
      this.onGridMouseLeave(e)
    })
    this.gridCanvas?.addEventListener('contextmenu', (e) => {
      e.preventDefault()
      this.onRightClick(e)
    })

    // Touch events (mobile support — delegates to mouse handlers;
    // in preview mode, let events pass through for native touch-scroll).
    this.gridCanvas?.addEventListener(
      'touchstart',
      (e) => {
        if (this.previewMode) return
        e.preventDefault()
        const touch = e.touches[0]
        this.onGridMouseDown({
          clientX: touch.clientX,
          clientY: touch.clientY,
          target: e.target,
        } as MouseEvent)
      },
      { passive: false },
    )
    this.gridCanvas?.addEventListener(
      'touchmove',
      (e) => {
        if (this.previewMode) return
        e.preventDefault()
        const touch = e.touches[0]
        this.onGridMouseMove({
          clientX: touch.clientX,
          clientY: touch.clientY,
          target: e.target,
        } as MouseEvent)
      },
      { passive: false },
    )
    this.gridCanvas?.addEventListener(
      'touchend',
      (e) => {
        if (this.previewMode) return
        e.preventDefault()
        this.onGridMouseUp({} as MouseEvent)
      },
      { passive: false },
    )

    // Ruler drag-to-seek (click and drag on ruler to scrub playback position),
    // or drag an A/B loop marker if the press lands on one.
    this.rulerCanvas?.addEventListener('mousedown', (e) => {
      const hit = this.hitTestRulerLoop(e.clientX)
      if (hit !== null) {
        this.loopDragTarget = hit
        return
      }
      this.isSeeking = true
      this.seekToRulerPosition(e)
    })

    document.addEventListener(
      'mousemove',
      (e) => {
        if (this.loopDragTarget !== null) {
          const beat = this.rulerBeatFromClientX(e.clientX)
          if (this.loopDragTarget === 'A') this.onMoveLoopA?.(beat)
          else this.onMoveLoopB?.(beat)
          return
        }
        if (this.isSeeking) {
          this.seekToRulerPosition(e)
        }
      },
      { signal },
    )

    // Touch support for seeking - track touch move outside canvas
    document.addEventListener(
      'touchmove',
      (e) => {
        if (this.isSeeking && e.touches.length > 0) {
          const touch = e.touches[0]
          this.seekToRulerPosition({ clientX: touch.clientX } as MouseEvent)
        }
      },
      { passive: false, signal },
    )

    document.addEventListener(
      'mouseup',
      () => {
        this.loopDragTarget = null
        this.isSeeking = false
        this._lastScrubNoteId = -1
        if (this._activeScrubNoteId !== null) {
          ;(
            window as Window & {
              pianoRollAudioEngine?: { stopNote: (id: number) => void }
            }
          ).pianoRollAudioEngine?.stopNote(this._activeScrubNoteId)
          this._activeScrubNoteId = null
        }
        // Always finalize box selection regardless of where mouse was released
        if (this.isBoxSelecting) {
          const boxX1 = Math.min(this.boxStartX, this.boxEndX)
          const boxY1 = Math.min(this.boxStartY, this.boxEndY)
          const boxX2 = Math.max(this.boxStartX, this.boxEndX)
          const boxY2 = Math.max(this.boxStartY, this.boxEndY)
          if (boxX2 - boxX1 > 3 && boxY2 - boxY1 > 3) {
            this.selectNotesInBox(boxX1, boxY1, boxX2, boxY2)
          }
          this.isBoxSelecting = false
          this.isDragging = false
          this.selectedNotesCache = []
        }
        // Also handle dragging/resizing that started on the canvas
        this.isDragging = false
        this.isResizing = false
        this.selectedNotesCache = []
        this.resizeHandle = null
        this.resizeOrigins = []
        this.resizeAnchorId = -1
      },
      { signal },
    )

    // Touch support - finalize dragging/resizing when touch ends outside canvas
    document.addEventListener(
      'touchend',
      () => {
        this.isSeeking = false
        this._lastScrubNoteId = -1
        if (this._activeScrubNoteId !== null) {
          ;(
            window as Window & {
              pianoRollAudioEngine?: { stopNote: (id: number) => void }
            }
          ).pianoRollAudioEngine?.stopNote(this._activeScrubNoteId)
          this._activeScrubNoteId = null
        }
        if (this.isBoxSelecting) {
          const boxX1 = Math.min(this.boxStartX, this.boxEndX)
          const boxY1 = Math.min(this.boxStartY, this.boxEndY)
          const boxX2 = Math.max(this.boxStartX, this.boxEndX)
          const boxY2 = Math.max(this.boxStartY, this.boxEndY)
          if (boxX2 - boxX1 > 3 && boxY2 - boxY1 > 3) {
            this.selectNotesInBox(boxX1, boxY1, boxX2, boxY2)
          }
          this.isBoxSelecting = false
          this.isDragging = false
          this.selectedNotesCache = []
        }
        this.isDragging = false
        this.isResizing = false
        this.selectedNotesCache = []
        this.resizeHandle = null
        this.resizeOrigins = []
        this.resizeAnchorId = -1
      },
      { signal },
    )

    // Horizontal scroll: move the viewport canvases to the new offset and
    // repaint. The ruler is redrawn at the same offset rather than being
    // transform-shifted (it is viewport-sized now, not content-sized).
    this.gridContainer?.addEventListener(
      'scroll',
      () => {
        if (!this.gridContainer) return
        const next = this.gridContainer.scrollLeft
        if (next === this.scrollX) return
        this.scrollX = next
        this._clampScroll()
        this._positionViewportCanvases()
        this._updateBarNavigator()
        if (this.isExternalPlayback) this.drawWithPlayhead()
        else this.draw()
      },
      { passive: true },
    )

    // Keyboard
    document.addEventListener(
      'keydown',
      (e) => {
        this.onKeyDown(e)
      },
      { signal },
    )

    // Window resize
    window.addEventListener(
      'resize',
      () => {
        this._readPalette()
        this.buildCanvases()
        this.draw()
        if (this.pitchTrackVisible) {
          this._resizePitchTrackCanvas()
        }
      },
      { signal },
    )

    // Octave controls
    container
      .querySelector('#roll-octave-up')
      ?.addEventListener('click', () => {
        this._shiftOctave(1)
      })
    container
      .querySelector('#roll-octave-down')
      ?.addEventListener('click', () => {
        this._shiftOctave(-1)
      })

    // Rows (numOctaves) controls — add rows on top, remove from bottom
    container
      .querySelector('#roll-octaves-plus')
      ?.addEventListener('click', () => {
        if (this.numOctaves >= MAX_OCTAVE_ROWS) return
        if (this.octave > 1) this.octave -= 1
        this.setNumOctaves(this.numOctaves + 1)
      })
    container
      .querySelector('#roll-octaves-minus')
      ?.addEventListener('click', () => {
        if (this.numOctaves <= 1) return
        const newCount = this.numOctaves - 1

        // Smart reduction: trim empty octaves from top first (higher
        // octaves above the melody), then from bottom, so notes stay
        // visible as long as they fit within the reduced row count.
        const melody = this.melody
        if (melody.length > 0) {
          let minOct = Infinity
          let maxOct = -Infinity
          for (const item of melody) {
            const midi = item.note?.midi
            if (typeof midi !== 'number') continue
            // C4 = MIDI 60 → octave = floor(60/12) - 1 = 4
            const oct = Math.floor(midi / 12) - 1
            if (oct < minOct) minOct = oct
            if (oct > maxOct) maxOct = oct
          }
          if (Number.isFinite(minOct) && Number.isFinite(maxOct)) {
            // Align window so max-note octave sits at the top row,
            // trimming empty octaves from above first.
            let newStartOct = maxOct - newCount + 1
            if (newStartOct > minOct) newStartOct = minOct
            newStartOct = Math.max(1, newStartOct)
            this.octave = newStartOct
          } else {
            this.octave += 1
          }
        } else {
          this.octave += 1
        }

        this.setNumOctaves(newCount)
      })

    // Scroll toggle
    const scrollToggle = container.querySelector('#roll-scroll-toggle')
    scrollToggle?.addEventListener('click', () => {
      if (this.kind === 'drums') return
      this._setScrollableMode(!this.scrollableMode)
      this._rebuildScale()
      this.buildCanvases()
      this.draw()
    })

    // Bar navigation — paging and jump-to-bar for long imported songs.
    container.querySelector('#roll-bar-prev')?.addEventListener('click', () => {
      this.pageView(-1)
    })
    container.querySelector('#roll-bar-next')?.addEventListener('click', () => {
      this.pageView(1)
    })
    const barInput = container.querySelector(
      '#roll-bar-input',
    ) as HTMLInputElement | null
    barInput?.addEventListener('change', () => {
      this.goToBar(parseInt(barInput.value, 10) || 1)
    })
    barInput?.addEventListener('keydown', (e) => {
      // Enter commits without waiting for blur; the editor's global shortcuts
      // already stand down while a form control has focus.
      if ((e as KeyboardEvent).key === 'Enter') {
        this.goToBar(parseInt(barInput.value, 10) || 1)
        barInput.blur()
      }
    })

    // Browse / preview mode toggle
    const browseToggle = container.querySelector('#roll-browse-toggle')
    browseToggle?.addEventListener('click', () => {
      this.previewMode = !this.previewMode
      browseToggle.classList.toggle('active', this.previewMode)
      browseToggle.setAttribute('aria-pressed', String(this.previewMode))
      this._updatePreviewModeUI()
      this._updateHint()
    })

    // Scale mode select
    container
      .querySelector('#roll-mode-select')
      ?.addEventListener('change', (e) => {
        const target = e.target as HTMLSelectElement
        this.setMode(target.value)
      })

    // Import MIDI button
    const importMidiInput = document.createElement('input')
    importMidiInput.type = 'file'
    importMidiInput.accept = '.mid,.midi,audio/midi,audio/x-midi'
    importMidiInput.style.display = 'none'
    container.querySelector('.roll-toolbar')?.appendChild(importMidiInput)

    container
      .querySelector('#roll-import-midi')
      ?.addEventListener('click', () => {
        importMidiInput.click()
      })

    importMidiInput.addEventListener('change', () => {
      void (async () => {
        const file = importMidiInput.files?.[0]
        if (!file) return
        try {
          const buffer = await file.arrayBuffer()
          const data = new Uint8Array(buffer)
          const melody = importMelodyFromMIDI(data)
          if (melody && melody.length > 0) {
            const name = file.name.replace(/\.(mid|midi)$/i, '')
            this.setMelody(melody)
            // Prefer the naming import so the library records what was loaded;
            // fall back to a plain change when the host doesn't handle it.
            if (this.onMelodyImport) this.onMelodyImport(melody, name)
            else this.onMelodyChange?.(melody)
            if (this.hintEl)
              this.hintEl.textContent = `Imported ${melody.length} note(s) from ${name}`
          } else {
            if (this.hintEl)
              this.hintEl.textContent = 'Could not parse MIDI file'
          }
        } catch {
          if (this.hintEl) this.hintEl.textContent = 'Error reading MIDI file'
        }
        importMidiInput.value = ''
      })()
    })

    // Export MIDI button
    container
      .querySelector('#roll-export-midi')
      ?.addEventListener('click', () => {
        const melody = this.getMelody()
        const timestamp = new Date()
          .toISOString()
          .replace(/[:.]/g, '-')
          .slice(0, 19)
        // Drums export on MIDI channel 10 (index 9) so DAWs read a drum track
        void downloadMIDI(
          melody,
          this.bpm,
          `pitchperfect-${timestamp}.mid`,
          this.kind === 'drums' ? 9 : 0,
        )
      })

    // Export WAV button
    container
      .querySelector('#roll-export-wav')
      ?.addEventListener('click', () => {
        const melody = this.getMelody()
        if (!melody.length) {
          showNotification(
            'No melody to export. Add some notes first.',
            'warning',
          )
          return
        }
        const timestamp = new Date()
          .toISOString()
          .replace(/[:.]/g, '-')
          .slice(0, 19)
        const engine = (
          window as Window & { pianoRollAudioEngine?: AudioEngine }
        ).pianoRollAudioEngine
        if (!engine) {
          showNotification('Audio engine not ready. Please try again.', 'error')
          return
        }
        const instrumentSelect = container.querySelector(
          '#roll-instrument-select',
        ) as HTMLSelectElement | null
        const instrument = (instrumentSelect?.value as InstrumentType) || 'sine'
        void engine.downloadMelodyAsWAV(
          melody,
          this.bpm,
          `pitchperfect-${timestamp}.wav`,
          instrument,
          this.kind,
        )
      })

    // Pitch track toggle
    container
      .querySelector('#roll-pitch-track-btn')
      ?.addEventListener('click', () => {
        this._togglePitchTrack()
      })

    // Bar controls
    container.querySelector('#roll-bars-up')?.addEventListener('click', () => {
      this.addBeats(4)
      this.updateBeatInfo()
    })

    container
      .querySelector('#roll-bars-down')
      ?.addEventListener('click', () => {
        this.removeBeats(4)
        this.updateBeatInfo()
      })

    // Zoom controls
    container.querySelector('#roll-zoom-in')?.addEventListener('click', () => {
      this.zoomIn()
      this.updateZoomDisplay()
    })
    container.querySelector('#roll-zoom-out')?.addEventListener('click', () => {
      this.zoomOut()
      this.updateZoomDisplay()
    })
    container.querySelector('#roll-zoom-fit')?.addEventListener('click', () => {
      this.fitToView()
      this.updateZoomDisplay()
    })

    // Grid toggle button. When the host provides onGridToggle it owns the
    // persisted setting and round-trips the new value back via setShowGrid
    // (which also updates this button's state) — mutating this.showGrid
    // locally here left the toolbar and the settings panel disagreeing.
    container
      .querySelector('#roll-grid-toggle')
      ?.addEventListener('click', () => {
        if (this.onGridToggle) {
          this.onGridToggle()
        } else {
          this.setShowGrid(!this.showGrid)
        }
      })

    // Undo/redo buttons
    container.querySelector('#roll-undo-btn')?.addEventListener('click', () => {
      this.undo()
    })

    container.querySelector('#roll-redo-btn')?.addEventListener('click', () => {
      this.redo()
    })

    // Initialize zoom display
    this.updateZoomDisplay()
  }

  private onGridMouseDown(e: MouseEvent): void {
    if (!this.gridCanvas) return
    const rect = this.gridCanvas.getBoundingClientRect()
    const x = e.clientX - rect.left + this.scrollX
    const y = e.clientY - rect.top
    const beat = x / this.beatWidth
    const row = Math.floor(y / this.rowHeight)

    // Playhead seeking: if the click is near the blue playhead line, enter
    // seeking mode so the user can drag the playhead to scrub audio. Only
    // when the playhead is actually meaningful — while stopped at beat 0 it
    // sits on x=0 and would swallow every click in the first 10px of the
    // grid (turning "place a note on the first row/beat" into a seek).
    const currentBeat = this.getCurrentBeat()
    const countInOffset =
      this._countInBeats > 0 && currentBeat <= 0
        ? this._countInBeats * this.beatWidth
        : 0
    const playheadX = countInOffset + currentBeat * this.beatWidth
    const playheadActive = this.playbackState !== 'stopped' || currentBeat > 0
    if (playheadActive && Math.abs(x - playheadX) < 10) {
      this.isSeeking = true
      this.seekToRulerPosition(e)
      return
    }

    // In preview mode, only allow selecting existing notes — no editing.
    if (this.previewMode) {
      const note = this.findNoteAt(beat, row)
      if (note) {
        this.selectedNoteIds.clear()
        this.selectedNoteIds.add(note.id)
        this.onNoteSelect?.(note)
      } else if (!e.shiftKey) {
        this.selectedNoteIds.clear()
        this.onNoteSelect?.(null)
      }
      this.draw()
      return
    }

    // Defer history push to first modification (mousemove) so a click
    // without dragging doesn't waste an undo level.
    this.dragDidPushHistory = false
    if (
      this.activeTool === 'place' ||
      this.activeTool === 'select' ||
      this.activeTool === 'browse'
    ) {
      const existingNote = this.findNoteAtExtended(beat, row, x)
      if (existingNote) {
        // Clear pre-selected effect when interacting with existing notes.
        if (this.selectedEffect) {
          this.selectedEffect = null
          this._updateEffectBtnStates()
        }
      }
    }

    if (this.activeTool === 'place') {
      // Place new note on empty space; clicking existing notes switches to select behavior for resize/drag
      const existingNote = this.findNoteAtExtended(beat, row, x)
      if (existingNote) {
        // Select the note and enable drag/resize — do NOT enter box-select mode
        const noteId = existingNote.id
        this.selectedNoteIds.clear()
        this.selectedNoteIds.add(noteId)
        this.onNoteSelect?.(existingNote)
        this.dragStartX = x
        this.dragStartY = y
        this.dragStartBeat = existingNote.startBeat
        this.dragStartRow = this.midiToRow(existingNote.note.midi)
        const noteX = existingNote.startBeat * this.beatWidth
        const noteW = existingNote.duration * this.beatWidth
        if (x - noteX < 8) {
          this.isResizing = true
          this.isDragging = false
          this.resizeHandle = 'left'
        } else if (noteX + noteW - x < 8) {
          this.isResizing = true
          this.isDragging = false
          this.resizeHandle = 'right'
        } else {
          this.isResizing = false
          this.isDragging = true
        }

        // Initialize cache for all selected notes (drag or resize)
        this.selectedNotesCache = this.melody.filter(
          (n) => n.id === noteId || this.selectedNoteIds.has(n.id),
        )
        // Store per-note offsets so multi-note drag preserves relative positions.
        this.dragOffsets = this.selectedNotesCache.map((n) => ({
          beat: n.startBeat - this.dragStartBeat,
          row: this.midiToRow(n.note.midi) - this.dragStartRow,
        }))
        // Resize applies the grabbed note's delta to every selected note, so
        // each note's original geometry has to be captured up front.
        this.resizeAnchorId = noteId
        this.resizeOrigins = this.selectedNotesCache.map((n) => ({
          startBeat: n.startBeat,
          duration: n.duration,
        }))
        this._updateEffectBtnStates()
      } else {
        // Empty space — start box selection for area-select, or place note on
        // click. Snap with the same duration-aware unit placeNote uses so a
        // 1/16 note can land on the quarter-beat grid (the old hardcoded
        // half-beat floor made 1/16 placement impossible).
        this.isBoxSelecting = true
        this.boxStartX = x
        this.boxStartY = y
        this.boxEndX = x
        this.boxEndY = y
        this.dragStartBeat = snapPlacementBeat(beat, this.selectedDuration)
        this.dragStartRow = row
      }
    } else if (this.activeTool === 'erase') {
      const note = this.findNoteAt(beat, row)
      if (note) {
        this.eraseNote(note)
      }
    } else if (this.activeTool === 'select') {
      const note = this.findNoteAtExtended(beat, row, x)
      if (note) {
        const noteId = note.id
        if (e.shiftKey) {
          if (this.selectedNoteIds.has(noteId)) {
            this.selectedNoteIds.delete(noteId)
          } else {
            this.selectedNoteIds.add(noteId)
          }
        } else {
          this.selectedNoteIds.clear()
          this.selectedNoteIds.add(noteId)
        }
        // Enable drag for selected notes
        this.dragStartX = x
        this.dragStartY = y
        this.dragStartBeat = note.startBeat
        this.dragStartRow = this.midiToRow(note.note.midi)
        const noteX = note.startBeat * this.beatWidth
        const noteW = note.duration * this.beatWidth
        if (x - noteX < 8) {
          this.isResizing = true
          this.isDragging = false
          this.resizeHandle = 'left'
        } else if (noteX + noteW - x < 8) {
          this.isResizing = true
          this.isDragging = false
          this.resizeHandle = 'right'
        } else {
          this.isResizing = false
          this.isDragging = true
        }

        // Initialize cache for all selected notes (drag or resize)
        this.selectedNotesCache = this.melody.filter(
          (n) => n.id === noteId || this.selectedNoteIds.has(n.id),
        )
        // Store per-note offsets so multi-note drag preserves relative positions.
        this.dragOffsets = this.selectedNotesCache.map((n) => ({
          beat: n.startBeat - this.dragStartBeat,
          row: this.midiToRow(n.note.midi) - this.dragStartRow,
        }))
        // Resize applies the grabbed note's delta to every selected note, so
        // each note's original geometry has to be captured up front.
        this.resizeAnchorId = noteId
        this.resizeOrigins = this.selectedNotesCache.map((n) => ({
          startBeat: n.startBeat,
          duration: n.duration,
        }))
        const first = this.melody.find((n) => this.selectedNoteIds.has(n.id))
        this.onNoteSelect?.(first ?? null)
        this._updateEffectBtnStates()
      } else {
        if (!e.shiftKey) {
          this.selectedNoteIds.clear()
          this.onNoteSelect?.(null)
        }
        // Start box selection on empty space in select tool
        this.isBoxSelecting = true
        this.boxStartX = x
        this.boxStartY = y
        this.boxEndX = x
        this.boxEndY = y
      }
    } else if (this.activeTool === 'browse') {
      const note = this.findNoteAtExtended(beat, row, x)
      if (note) {
        const noteId = note.id
        if (e.shiftKey) {
          if (this.selectedNoteIds.has(noteId)) {
            this.selectedNoteIds.delete(noteId)
          } else {
            this.selectedNoteIds.add(noteId)
          }
        } else {
          this.selectedNoteIds.clear()
          this.selectedNoteIds.add(noteId)
        }
        const first = this.melody.find((n) => this.selectedNoteIds.has(n.id))
        this.onNoteSelect?.(first ?? null)
      } else {
        if (!e.shiftKey) {
          this.selectedNoteIds.clear()
          this.onNoteSelect?.(null)
        }
      }
    }

    this.draw()
  }

  private onGridMouseMove(e: MouseEvent): void {
    if (!this.gridCanvas) return
    const rect = this.gridCanvas.getBoundingClientRect()
    const x = e.clientX - rect.left + this.scrollX
    const y = e.clientY - rect.top

    if (this.isBoxSelecting) {
      this.boxEndX = x
      this.boxEndY = y
      this.draw()
      return
    }

    // GH #136: Cursor feedback — show resize/move cursor when hovering over note edges/body
    if (!this.isDragging && !this.isResizing) {
      const beat = x / this.beatWidth
      const row = Math.floor(y / this.rowHeight)
      const note = this.findNoteAtExtended(beat, row, x)
      this._updateHoverTip(note, x, y)
      if (note && this.selectedNoteIds.has(note.id)) {
        const noteX = note.startBeat * this.beatWidth
        const noteW = note.duration * this.beatWidth
        if (x - noteX < 8) {
          this.gridCanvas.style.cursor = 'ew-resize'
        } else if (noteX + noteW - x < 8) {
          this.gridCanvas.style.cursor = 'ew-resize'
        } else {
          this.gridCanvas.style.cursor = 'move'
        }
      } else if (note) {
        this.gridCanvas.style.cursor = 'pointer'
      } else {
        this.gridCanvas.style.cursor =
          this.activeTool === 'place'
            ? 'crosshair'
            : this.activeTool === 'browse'
              ? 'pointer'
              : 'default'
      }
    }

    if (this.isDragging || this.isResizing) {
      this._hideHoverTip()
    }

    if (this.isDragging && this.selectedNotesCache.length > 0) {
      // Drag snap follows the note length: whole beat for notes ≥ 1 beat,
      // half-beat for eighths, quarter-beat for sixteenths.
      const draggedDuration = this.selectedNotesCache[0]?.duration ?? 1
      const dragSnapUnit =
        draggedDuration >= 1 ? 1 : draggedDuration >= 0.5 ? 0.5 : 0.25
      const deltaBeat =
        Math.round((x - this.dragStartX) / (this.beatWidth * dragSnapUnit)) *
        dragSnapUnit
      const deltaRow = Math.round((y - this.dragStartY) / this.rowHeight)
      if (deltaBeat !== 0 || deltaRow !== 0) {
        if (!this.dragDidPushHistory) {
          this.pushHistory()
          this.dragDidPushHistory = true
        }
        for (let i = 0; i < this.selectedNotesCache.length; i++) {
          const note = this.selectedNotesCache[i]
          const offset = this.dragOffsets[i]
          if (offset == null) continue
          const newStartBeat = Math.max(
            0,
            this.dragStartBeat + deltaBeat + offset.beat,
          )
          const newRow = Math.max(
            0,
            Math.min(
              this.totalRows - 1,
              this.dragStartRow + deltaRow + offset.row,
            ),
          )
          const newScaleNote = this.scale[newRow]
          if (newScaleNote == null) continue
          note.startBeat = newStartBeat
          note.note.midi = newScaleNote.midi
          note.note.name = newScaleNote.name as NoteName
          note.note.octave = newScaleNote.octave
          note.note.freq = newScaleNote.freq
        }
        this.emitMelodyChange()
        this.draw()
      }
    } else if (this.isResizing && this.selectedNotesCache.length > 0) {
      if (!this.dragDidPushHistory) {
        this.pushHistory()
        this.dragDidPushHistory = true
      }
      // Edges snap to the minimum duration grid (0.25) so 1/16 and 1/8 notes
      // are resizable at all — whole-beat rounding froze anything shorter
      // than a beat at its placed length.
      const snap = this.config.minDuration
      const snappedEdge = Math.round(x / this.beatWidth / snap) * snap
      // The grabbed note is the anchor; its edge delta is applied to every
      // selected note's ORIGINAL geometry, so a multi-select resize shifts
      // each note's edge by the same amount instead of collapsing them all
      // onto one shared end beat.
      const anchorIdx = this.selectedNotesCache.findIndex(
        (n) => n.id === this.resizeAnchorId,
      )
      const anchorOrig = this.resizeOrigins[anchorIdx >= 0 ? anchorIdx : 0]
      if (anchorOrig == null) return
      if (this.resizeHandle === 'right') {
        const delta = snappedEdge - (anchorOrig.startBeat + anchorOrig.duration)
        for (let i = 0; i < this.selectedNotesCache.length; i++) {
          const note = this.selectedNotesCache[i]
          const orig = this.resizeOrigins[i]
          if (orig == null) continue
          note.duration = Math.max(
            this.config.minDuration,
            orig.duration + delta,
          )
          // Vertical drag on slide note right handle → change slideInterval
          if (
            note.effectType &&
            note.slideInterval !== undefined &&
            (note.effectType === 'slide-up' ||
              note.effectType === 'slide-down' ||
              note.effectType === 'ease-in' ||
              note.effectType === 'ease-out')
          ) {
            const row = Math.round(y / this.rowHeight)
            const clamped = Math.max(0, Math.min(this.scale.length - 1, row))
            note.slideInterval = this.scale[clamped].midi - note.note.midi
          }
        }
      } else if (this.resizeHandle === 'left') {
        const delta = snappedEdge - anchorOrig.startBeat
        for (let i = 0; i < this.selectedNotesCache.length; i++) {
          const note = this.selectedNotesCache[i]
          const orig = this.resizeOrigins[i]
          if (orig == null) continue
          const origEnd = orig.startBeat + orig.duration
          note.startBeat = Math.max(
            0,
            Math.min(orig.startBeat + delta, origEnd - this.config.minDuration),
          )
          note.duration = origEnd - note.startBeat
        }
      }
      this.emitMelodyChange()
      this.draw()
    }
  }

  private onGridMouseUp(_e: MouseEvent): void {
    if (this.isBoxSelecting) {
      // Finalize box selection
      const boxX1 = Math.min(this.boxStartX, this.boxEndX)
      const boxY1 = Math.min(this.boxStartY, this.boxEndY)
      const boxX2 = Math.max(this.boxStartX, this.boxEndX)
      const boxY2 = Math.max(this.boxStartY, this.boxEndY)
      if (boxX2 - boxX1 > 3 && boxY2 - boxY1 > 3) {
        this.selectNotesInBox(boxX1, boxY1, boxX2, boxY2)
      } else if (this.activeTool === 'place') {
        // Click on empty space (not a box drag) — place the note
        this.placeNote(
          this.dragStartBeat,
          this.dragStartRow,
          this.selectedDuration,
        )
      }
      this.isBoxSelecting = false
    }
    this.isDragging = false
    this.isResizing = false
    this.selectedNotesCache = []
    this.resizeHandle = null
    this.dragDidPushHistory = false
    this.resizeOrigins = []
    this.resizeAnchorId = -1
  }

  private onGridMouseLeave(_e: MouseEvent): void {
    this.isDragging = false
    this.isResizing = false
    this.selectedNotesCache = []
    this.resizeHandle = null
    this.dragDidPushHistory = false
    this.resizeOrigins = []
    this.resizeAnchorId = -1
    this._hideHoverTip()
    // Do NOT clear isBoxSelecting here — the document-level mouseup
    // handler finalizes box selection when the mouse is released
    // outside the canvas.
    // Reset cursor
    if (this.gridCanvas) {
      this.gridCanvas.style.cursor =
        this.activeTool === 'place'
          ? 'crosshair'
          : this.activeTool === 'browse'
            ? 'pointer'
            : 'default'
    }
  }

  /** Select all notes whose blocks intersect the given pixel box */
  private selectNotesInBox(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
  ): void {
    const startRow = Math.floor(y1 / this.rowHeight)
    const endRow = Math.floor(y2 / this.rowHeight)
    const r1 = Math.min(startRow, endRow)
    const r2 = Math.max(startRow, endRow)
    for (const note of this.melody) {
      const noteRow = this.midiToRow(note.note.midi)
      if (noteRow < r1 || noteRow > r2) continue
      const noteX1 = note.startBeat * this.beatWidth
      const noteX2 = (note.startBeat + note.duration) * this.beatWidth
      if (noteX2 < x1 || noteX1 > x2) continue
      this.selectedNoteIds.add(note.id)
    }
    const first =
      this.melody.find((n) => this.selectedNoteIds.has(n.id)) ?? null
    this.onNoteSelect?.(first)
  }

  private onRightClick(e: MouseEvent): void {
    if (!this.gridCanvas) return
    const rect = this.gridCanvas.getBoundingClientRect()
    const x = e.clientX - rect.left + this.scrollX
    const y = e.clientY - rect.top
    const beat = x / this.beatWidth
    const row = Math.floor(y / this.rowHeight)
    const note = this.findNoteAt(beat, row)
    if (note) {
      this.eraseNote(note)
    }
  }

  private onKeyDown(e: KeyboardEvent): void {
    // Never intercept keys while the user types in ANY form control — this
    // guard must run before every shortcut branch. It used to sit below the
    // zoom/undo/select-all handlers, so Ctrl+A in an unrelated text input
    // selected piano-roll notes instead of the input's text, app-wide.
    // e.target can be the Document itself (events dispatched on document,
    // e.g. from tests), which has no closest() — only Elements can be typed
    // into, so anything else counts as not typing.
    const target = e.target
    const isTyping =
      target instanceof Element &&
      target.closest('input,textarea,select,[contenteditable]') !== null
    if (isTyping) return

    // Zoom: Ctrl++ / Ctrl+- (or Ctrl+scroll)
    if ((e.ctrlKey || e.metaKey) && (e.key === '+' || e.key === '=')) {
      e.preventDefault()
      this.zoomIn()
      this.updateZoomDisplay()
      return
    }
    if ((e.ctrlKey || e.metaKey) && (e.key === '-' || e.key === '_')) {
      e.preventDefault()
      this.zoomOut()
      this.updateZoomDisplay()
      return
    }

    // Undo: Ctrl+Z (or Cmd+Z on Mac)
    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
      e.preventDefault()
      if (this.undo()) return
    }
    // Redo: Ctrl+Shift+Z or Ctrl+Y
    if (
      (e.ctrlKey || e.metaKey) &&
      ((e.key === 'z' && e.shiftKey) || e.key === 'y')
    ) {
      e.preventDefault()
      if (this.redo()) return
    }
    // Select all: Ctrl+A
    if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
      e.preventDefault()
      this.selectedNoteIds.clear()
      for (const note of this.melody) {
        this.selectedNoteIds.add(note.id)
      }
      const first = this.melody[0] ?? null
      this.onNoteSelect?.(first)
      this.draw()
      this._updateHint()
      return
    }

    // Copy: Ctrl+C — store selected notes in clipboard
    if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
      if (this.selectedNoteIds.size === 0) return
      e.preventDefault()
      const selected = this._getSelectedNotes()
      // Deep-clone and strip IDs — fresh IDs are assigned on paste
      this.clipboard = selected.map((n) => {
        const { id: _id, ...rest } = n
        return JSON.parse(JSON.stringify(rest)) as MelodyItem
      })
      this._updateHint()
      return
    }

    // Paste: Ctrl+V — insert clipboard notes at melody end
    if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
      if (this.clipboard.length === 0) return
      e.preventDefault()
      this.pushHistory()

      // Calculate the offset so notes paste after the current melody
      const minBeat = Math.min(...this.clipboard.map((n) => n.startBeat))
      const melodyEnd =
        this.melody.length > 0
          ? Math.max(...this.melody.map((n) => n.startBeat + n.duration))
          : 0
      const offset = melodyEnd - minBeat

      const pastedIds: number[] = []
      for (const item of this.clipboard) {
        let id = this.nextNoteId++
        while (this.melody.some((n) => n.id === id)) {
          id = this.nextNoteId++
        }
        const clone: MelodyItem = {
          ...item,
          id,
          startBeat: item.startBeat + offset,
        }
        this.melody.push(clone)
        pastedIds.push(id)
      }

      // Select the newly pasted notes
      this.selectedNoteIds.clear()
      for (const pid of pastedIds) {
        this.selectedNoteIds.add(pid)
      }
      this.onNoteSelect?.(
        this.melody.find((n) => n.id === pastedIds[0]) ?? null,
      )

      // Auto-expand canvas if needed
      const pasteEnd = Math.max(
        ...this.clipboard.map((n) => n.startBeat + offset + n.duration),
      )
      if (pasteEnd > this.totalBeats) {
        const barBeats = this.config.beatsPerBar
        this.totalBeats = Math.ceil(pasteEnd / barBeats) * barBeats
        this.buildCanvases()
      }

      this.emitMelodyChange()
      this.draw()
      this._updateHint()
      this.updateUndoRedoButtons()
      return
    }

    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (this.selectedNoteIds.size > 0) {
        this.pushHistory()
        for (const noteId of this.selectedNoteIds) {
          const note = this.melody.find((n) => n.id === noteId)
          if (note) this.eraseNoteInternal(note)
        }
        this.selectedNoteIds.clear()
        this.onNoteSelect?.(null)
        // BUGFIX: also emit so the autosave path runs. eraseNoteInternal
        // is the silent "no notify" variant — the bulk-delete-by-key path
        // was relying on it but forgetting to fire onMelodyChange after.
        this.emitMelodyChange()
        this.draw()
        this._updateHint()
        this.updateUndoRedoButtons()
      }
    } else if (e.key === 'Escape') {
      this.selectedNoteIds.clear()
      this.selectedEffect = null
      this._updateEffectBtnStates()
      this.onNoteSelect?.(null)
      this.draw()
      this._updateHint()
    } else if (e.key === 's' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
      e.preventDefault()
      this._keyboardEffect('slide-up')
    } else if (e.key === 'S' && e.shiftKey && !e.ctrlKey && !e.metaKey) {
      e.preventDefault()
      this._keyboardEffect('slide-down')
    } else if (e.key === 'e' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
      e.preventDefault()
      this._keyboardEffect('ease-in')
    } else if (e.key === 'E' && e.shiftKey && !e.ctrlKey && !e.metaKey) {
      e.preventDefault()
      this._keyboardEffect('ease-out')
    } else if (e.key === 'v' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
      e.preventDefault()
      this._keyboardEffect('vibrato')
    } else if (e.key === 't' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
      e.preventDefault()
      this._keyboardEffect('tremolo')
    } else if (e.key === 'T' && e.shiftKey && !e.ctrlKey && !e.metaKey) {
      e.preventDefault()
      this._keyboardEffect('trill')
    } else if (e.key === 'c' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
      e.preventDefault()
      this._keyboardEffect('chord')
    } else if (e.key === 'K' && e.shiftKey && !e.ctrlKey && !e.metaKey) {
      e.preventDefault()
      this._keyboardEffect('staccato')
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault()
      const sortedNotes = [...this.melody].sort(
        (a, b) => a.startBeat - b.startBeat,
      )
      if (sortedNotes.length === 0) return

      const firstSelectedId = [...this.selectedNoteIds][0] ?? -1
      const currentIdx =
        this.selectedNoteIds.size > 0
          ? sortedNotes.findIndex((n) => n.id === firstSelectedId)
          : -1

      let newIdx: number
      if (e.key === 'ArrowUp') {
        newIdx = currentIdx <= 0 ? sortedNotes.length - 1 : currentIdx - 1
      } else {
        newIdx = currentIdx >= sortedNotes.length - 1 ? 0 : currentIdx + 1
      }
      const noteToSelect = sortedNotes[newIdx]
      this.selectedNoteIds.clear()
      this.selectedNoteIds.add(noteToSelect.id)
      this.onNoteSelect?.(noteToSelect)
      this.draw()
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault()
      if (this.selectedNoteIds.size > 0) {
        this.pushHistory()
        const delta = e.key === 'ArrowLeft' ? -0.5 : 0.5
        for (const noteId of this.selectedNoteIds) {
          const note = this.melody.find((n) => n.id === noteId)
          if (note) {
            note.startBeat = Math.max(0, note.startBeat + delta)
          }
        }
        this.emitMelodyChange()
        this.draw()
      }
    }
  }

  // ============================================================
  // Note Operations
  // ============================================================

  private placeNote(beat: number, row: number, duration: number): void {
    const scaleNote = this.scale[row]
    if (scaleNote == null) return

    this.pushHistory()
    this.updateUndoRedoButtons()

    // Snap placement into the slot the cursor is in: half-beat grid for short
    // notes, whole-beat grid for notes at least one full beat long (so bar-
    // length notes line up cleanly with the bar ruler). We FLOOR rather than
    // round-to-nearest so a click anywhere inside a slot — including past its
    // half-way point — lands in THAT slot instead of jumping to the next one.
    // Drag-move and resize keep their own nearest-rounding in onGridMouseMove.
    const snappedBeat = snapPlacementBeat(beat, duration)
    let id = this.nextNoteId++
    // Belt-and-suspenders: if the counter somehow produces a duplicate ID
    // (e.g. after a setMelody that didn't resync), skip past all existing IDs.
    while (this.melody.some((n) => n.id === id)) {
      console.warn(
        `[PianoRollEditor] ID collision for ${id} — skipping to next available`,
      )
      id = this.nextNoteId++
    }

    const item: MelodyItem = {
      id,
      note: {
        midi: scaleNote.midi,
        name: scaleNote.name as MelodyItem['note']['name'],
        octave: scaleNote.octave,
        freq: scaleNote.freq,
      },
      duration,
      startBeat: snappedBeat,
    }

    // Apply effect if one is selected
    if (this.selectedEffect) {
      item.effectType = this.selectedEffect
      if (this.selectedEffect === 'vibrato') {
        item.vibratoAmplitude = this.vibratoAmplitude
      } else if (this.selectedEffect === 'tremolo') {
        item.tremoloRate = this.tremoloRate
        item.tremoloDepth = this.tremoloDepth
      } else if (this.selectedEffect === 'trill') {
        item.trillRate = this.trillRate
        item.trillInterval = this.trillInterval
      } else if (this.selectedEffect === 'staccato') {
        item.staccatoRatio = this.staccatoRatio
      } else if (this.selectedEffect === 'chord') {
        item.chordType = this.chordType
      }
    }

    this.melody.push(item)
    this.selectedNoteIds.add(id)
    this.onNoteSelect?.(item)

    // Auto-expand canvas if the note lands beyond the current beat range so the
    // user sees the note immediately instead of waiting for the reactive loop.
    const noteEnd = snappedBeat + duration
    if (noteEnd > this.totalBeats) {
      const barBeats = this.config.beatsPerBar
      this.totalBeats = Math.ceil(noteEnd / barBeats) * barBeats
      this.buildCanvases()
    }

    this.emitMelodyChange()
    this.draw()
    this._updateHint()
    this.updateUndoRedoButtons()
  }

  private eraseNote(note: MelodyItem): void {
    this.pushHistory()
    const noteId = note.id
    if (noteId === undefined) return
    const idx = this.melody.indexOf(note)
    if (idx !== -1) {
      this.melody.splice(idx, 1)
      if (this.selectedNoteIds.has(noteId)) {
        this.selectedNoteIds.delete(noteId)
      }
      this.emitMelodyChange()
      this.draw()
      this._updateHint()
    }
  }

  /** Internal erase — no history push, no selection clear (caller handles both) */
  private eraseNoteInternal(note: MelodyItem): void {
    const noteId = note.id
    if (noteId === undefined) return
    const idx = this.melody.indexOf(note)
    if (idx !== -1) {
      this.melody.splice(idx, 1)
    }
  }

  private findNoteAt(beat: number, row: number): MelodyItem | null {
    for (const note of this.melody) {
      // Use the displayed row (via midiToY) so off-scale notes are hittable at
      // the position they're actually drawn. For in-scale notes this equals
      // midiToRow, so behaviour is unchanged.
      const noteRow = Math.floor(this.midiToY(note.note.midi) / this.rowHeight)
      if (
        noteRow === row &&
        beat >= note.startBeat &&
        beat < note.startBeat + note.duration
      ) {
        return note
      }
    }
    return null
  }

  /** Like findNoteAt but also finds slide notes anywhere along their S-shape
   *  (between source and target rows), and at the right handle on the target row. */
  private findNoteAtExtended(
    beat: number,
    row: number,
    _x: number,
  ): MelodyItem | null {
    const note = this.findNoteAt(beat, row)
    if (note) return note
    for (const n of this.melody) {
      if (!n.effectType) continue
      const interval =
        n.slideInterval !== undefined
          ? n.slideInterval
          : n.trillInterval !== undefined
            ? n.trillInterval
            : undefined
      if (interval === undefined) continue
      if (beat < n.startBeat || beat >= n.startBeat + n.duration) continue
      // Check whether the click row lies between source and target rows (inclusive)
      const srcRow = this.midiToRow(n.note.midi)
      const targetMidi = n.note.midi + interval
      const targetY = this.midiToY(targetMidi)
      const targetRow = Math.floor(targetY / this.rowHeight)
      const rMin = Math.min(srcRow, targetRow)
      const rMax = Math.max(srcRow, targetRow)
      if (row >= rMin && row <= rMax) return n
    }
    return null
  }

  private midiToRow(midi: number): number {
    for (let i = 0; i < this.scale.length; i++) {
      if (this.scale[i].midi === midi) return i
    }
    return -1
  }

  /** Map any MIDI note to a Y pixel coordinate (center of its row).
   *  Scale is ordered HIGH-to-LOW: index 0 = highest pitch (top of
   *  canvas), index N-1 = lowest pitch (bottom).  Interpolates between
   *  adjacent scale degrees for MIDI values not in the current scale. */
  private midiToY(midi: number): number {
    if (this.scale.length === 0) return this.rowHeight / 2
    // Above the highest scale note → clamp to top
    if (midi >= this.scale[0].midi) return this.rowHeight / 2
    // Below the lowest scale note → clamp to bottom
    const last = this.scale.length - 1
    if (midi <= this.scale[last].midi)
      return last * this.rowHeight + this.rowHeight / 2
    // Find the gap: scale[i].midi > targetMidi > scale[i+1].midi
    for (let i = 0; i < last; i++) {
      if (this.scale[i].midi === midi)
        return i * this.rowHeight + this.rowHeight / 2
      if (this.scale[i].midi > midi && this.scale[i + 1].midi < midi) {
        const hiMidi = this.scale[i].midi
        const loMidi = this.scale[i + 1].midi
        const hiY = i * this.rowHeight + this.rowHeight / 2
        const loY = (i + 1) * this.rowHeight + this.rowHeight / 2
        const frac = (midi - loMidi) / (hiMidi - loMidi)
        return loY - frac * (loY - hiY)
      }
    }
    return last * this.rowHeight + this.rowHeight / 2
  }

  private emitMelodyChange(): void {
    // Every melody mutation funnels through here — keep the status-bar
    // note count honest (it used to refresh only on the Bars ± buttons).
    this.updateBeatInfo()
    this.onMelodyChange?.([...this.melody])
  }

  // ============================================================
  // Playback
  // ============================================================
  // The editor has no internal playback clock: PlaybackRuntime (via the
  // wrapper's setExternalPlayback + updatePlaybackPosition) is the only
  // driver. The old local rAF animation loop was unreachable in production
  // and has been removed.

  /**
   * Called when a beat update event arrives from PlaybackRuntime
   * Updates playhead and all related state
   */
  private handleBeatUpdate(beat: number): void {
    this.remoteBeat = beat

    // Show ball canvas during playback
    if (this.ballCanvas) {
      this.ballCanvas.style.display = 'block'
    }

    // Ball physics update for external playback
    if (this.useBallPhysics && this.ballState && this.ballCtx) {
      const ballCtx = this.ballCtx
      const totalHeightForBall = this.totalRows * this.rowHeight
      const countInOffset =
        this._countInBeats > 0 && beat <= 0
          ? this._countInBeats * this.beatWidth
          : 0

      const ballConfig: BallPhysicsConfig = {
        notes: this.ballNotes,
        rowHeight: this.rowHeight,
        radius: this.ballRadius,
        padding: this.ballPadding,
        bpm: this.bpm,
      }

      const result = getBallPhysics(this.ballState, ballConfig)
      this.ballState.x = result.x
      this.ballState.y = result.y
      this.ballState.lastEndBeat = result.note
        ? result.note.endBeat
        : this.ballState.lastEndBeat
      this.ballState.lastNote = result.note
      this.ballState.progress = result.progress

      // Convert to pixel coordinates for drawing
      const pixelY =
        this.ballState.y * this.rowHeight +
        this.rowHeight / 2 +
        this.rowHeight / 2
      const ballPixelX = countInOffset + this.ballState.x * this.beatWidth

      // Draw ball with glowing effect. The ball canvas is viewport-sized but
      // the ball's x is in song space, so it needs the same content-space
      // shift as the grid — without it the ball vanished past the first
      // viewport of a long song. (clearRect uses CSS px: the context carries
      // a DPR transform, so backing-store dimensions would clear 2x too much.)
      ballCtx.clearRect(0, 0, this.viewportWidth, totalHeightForBall)
      ballCtx.save()
      ballCtx.translate(-this.scrollX, 0)
      ballCtx.shadowColor = this.palette.activeGlow
      ballCtx.shadowBlur = 12
      ballCtx.fillStyle = this.palette.active
      ballCtx.beginPath()
      ballCtx.arc(ballPixelX, pixelY, this.ballRadius, 0, Math.PI * 2)
      ballCtx.fill()
      // White core for extra glow
      ballCtx.fillStyle = 'rgba(255, 255, 255, 0.7)'
      ballCtx.beginPath()
      ballCtx.arc(ballPixelX, pixelY, this.ballRadius * 0.5, 0, Math.PI * 2)
      ballCtx.fill()
      ballCtx.restore()
    }

    // GH #129: Track the current note row for vertical glow dot (deprecated)
    // Keep this for backward compatibility
    this.drawWithPlayhead()

    // Update timeline info during playback
    this._updateTimelineInfo(beat)

    // Update pitch track visualization during playback
    if (this.pitchTrackVisible) {
      this._updatePitchTrack()
    }

    // Check if playback is done — only during active playback.
    // When paused or stopped, beat updates come from seeking/scrubbing
    // and should NOT trigger an auto-stop (which resets remoteBeat=0,
    // causing the playhead to teleport).
    if (this.playbackState === 'playing' && this.melody.length > 0) {
      // Find the maximum end beat — a note that starts earlier but has a
      // longer duration (e.g. a slide/vibrato effect note) can extend
      // past the note with the latest startBeat.
      let melodyEnd = 0
      for (const item of this.melody) {
        const end = item.startBeat + item.duration
        if (end > melodyEnd) melodyEnd = end
      }
      if (beat >= melodyEnd) {
        this.stopPlayback()
        this.remoteBeat = melodyEnd
        this.playbackState = 'stopped'
        this.onPlaybackStateChange?.('stopped')
        this.draw()
        return
      }
    }
  }

  private stopPlayback(): void {
    // GH #130: Stop all active audio notes
    const win = window as Window & {
      pianoRollAudioEngine?: {
        stopAllNotes: () => void
        stopNote: (noteId: number) => void
        playNote: (
          freq: number,
          durationMs: number,
          effectType?: string,
        ) => void
      }
    }
    win.pianoRollAudioEngine?.stopAllNotes()
    if (!this.isExternalPlayback) {
      this.remoteBeat = 0
    }
    // Reset ball state
    this.useBallPhysics = false
    this.ballState = null
    this.ballNotes = []
    if (this.ballCanvas) {
      this.ballCanvas.style.display = 'none'
    }
    if (this.ballCtx && this.ballCanvas) {
      this.ballCtx.clearRect(
        0,
        0,
        this.ballCanvas.width,
        this.ballCanvas.height,
      )
    }
  }

  /** Ruler x (canvas-content px) of a loop beat — matches drawRulerLoop's map
   *  and seekToRulerPosition's inverse (the ruler canvas's rect already carries
   *  the scroll translate, so no scrollLeft term is needed). */
  private rulerXOfBeat(beat: number): number {
    return this.pianoWidth + beat * this.beatWidth
  }

  /** The A/B loop marker under a ruler press, if any. */
  private hitTestRulerLoop(clientX: number): 'A' | 'B' | null {
    if (!this.rulerCanvas || (this.loopA <= 0 && this.loopB <= 0)) return null
    const rect = this.rulerCanvas.getBoundingClientRect()
    return hitTestAbLoopMarker(
      // The ruler is viewport-sized and drawn shifted by scrollX, so a screen
      // x has to be moved back into content space before it can be compared
      // with rulerXOfBeat's content-space marker positions.
      clientX - rect.left + this.scrollX,
      this.loopA,
      this.loopB,
      (b) => this.rulerXOfBeat(b),
    )
  }

  /** Invert the ruler map: clientX → beat (clamped ≥ 0). Mirrors the seek math. */
  private rulerBeatFromClientX(clientX: number): number {
    if (!this.rulerCanvas) return 0
    const rect = this.rulerCanvas.getBoundingClientRect()
    return Math.max(
      0,
      (clientX - rect.left - this.pianoWidth + this.scrollX) / this.beatWidth,
    )
  }

  private seekToRulerPosition(e: MouseEvent): void {
    const rect = this.rulerCanvas?.getBoundingClientRect()
    if (!rect || !this.gridContainer) return

    // BUGFIX: the ruler canvas starts with the piano column, and its beat
    // markers are drawn at `pianoWidth + b * beatWidth` shifted by scrollX —
    // so undo both to get a content-space x.
    const x = e.clientX - rect.left - this.pianoWidth + this.scrollX

    // Clamp upper bound to the LAST NOTE END rather than the full grid
    // width. The grid often extends past the end of the melody (empty
    // bars at the right) — letting the playhead wander into that region
    // is misleading because there's nothing to play. Falling back to
    // `this.totalBeats` when the melody is empty so the user can still
    // pick a starting point in a fresh editor.
    let melodyEnd = 0
    for (const item of this.melody) {
      const end = item.startBeat + item.duration
      if (end > melodyEnd) melodyEnd = end
    }
    const upperBound = melodyEnd > 0 ? melodyEnd : this.totalBeats
    const beat = Math.max(0, Math.min(upperBound, x / this.beatWidth))

    // Update local playhead immediately for visual feedback, keeping the
    // seeked position on screen.
    this.remoteBeat = beat
    const playheadX = beat * this.beatWidth
    if (playheadX < this._viewLeft || playheadX > this._viewRight) {
      this._setScroll(playheadX - this.viewportWidth / 2)
    }
    this.drawGridWithPlayhead()

    // Audio scrubbing: play a short preview of the note at the seeked
    // position so the user can hear what they're scrubbing over.
    this._scrubPreview(beat)

    // Notify the global PlaybackRuntime so its currentBeat / playStartTime
    // get rebased too. Without this, clicking the editor ruler while
    // paused would visually move the playhead but Resume would jump
    // back to the pre-seek beat (the runtime's internal clock was
    // never updated). The runtime's seekTo is state-aware and handles
    // playing / paused / stopped correctly.
    try {
      eventBus.dispatch('pitchperfect:seekToBeat', { beat })
    } catch {
      // Non-browser environments — ignore.
    }
  }

  /** Play a short preview of the note at the given scrub position.
   *  Debounced by melody note ID to avoid retriggering on every pixel
   *  of mouse movement over the same note.  Each new scrub note stops
   *  the previous one so overlapping notes don't pile up and create
   *  pops/crackles. */
  private _scrubPreview(beat: number): void {
    const note = this._findNoteAtBeat(beat)
    const noteId = note?.id ?? -1
    if (noteId === this._lastScrubNoteId) return
    this._lastScrubNoteId = noteId

    const win = window as Window & {
      pianoRollAudioEngine?: {
        playNote: (
          freq: number,
          durationMs: number,
          effectType?: string,
          targetFreq?: number,
          vibratoAmplitude?: number,
        ) => Promise<number | undefined>
        stopNote: (noteId: number) => void
      }
    }

    // Stop the previous scrub note so notes don't overlap during fast drags
    if (this._activeScrubNoteId !== null) {
      win.pianoRollAudioEngine?.stopNote(this._activeScrubNoteId)
      this._activeScrubNoteId = null
    }

    // Drum kit: scrubbing auditions the hit itself (one-shot, no note to hold)
    if (this.kind === 'drums') {
      if (note) {
        const lane = DRUM_LANE_BY_MIDI.get(note.note.midi)
        if (lane) void this._engine()?.playDrum(lane.voice)
      }
      return
    }

    if (note && note.note?.freq) {
      let targetFreq: number | undefined
      if (note.slideInterval !== undefined) {
        targetFreq = note.note.freq * Math.pow(2, note.slideInterval / 12)
      } else if (note.trillInterval !== undefined) {
        targetFreq = note.note.freq * Math.pow(2, note.trillInterval / 12)
      }

      // 250 ms gives the attack envelope time to settle so the ear can
      // recognize the pitch.  At 120 ms most instruments are still in
      // their attack transient — that's why the old code sounded like
      // pops instead of musical notes.
      win.pianoRollAudioEngine
        ?.playNote(
          note.note.freq,
          250,
          note.effectType,
          targetFreq,
          note.vibratoAmplitude,
        )
        .then((audioNoteId) => {
          if (audioNoteId !== undefined) {
            this._activeScrubNoteId = audioNoteId
          }
        })
    }
  }

  /** Find the melody item that spans the given beat, or null. */
  private _findNoteAtBeat(beat: number): MelodyItem | null {
    for (const item of this.melody) {
      if (beat >= item.startBeat && beat < item.startBeat + item.duration) {
        return item
      }
    }
    return null
  }

  /**
   * Current beat for drawing/playhead. remoteBeat is the single source:
   * PlaybackRuntime events feed it during (external) playback, ruler
   * scrubbing parks it while stopped/paused, and stop() resets it to 0 —
   * there is no internal playback clock anymore.
   */
  private getCurrentBeat(): number {
    return this.remoteBeat
  }

  // ============================================================
  // Drawing
  // ============================================================

  draw(): void {
    this.drawPiano()
    this.drawRuler()
    this.drawGrid()
  }

  private drawWithPlayhead(): void {
    this.drawPiano()
    // drawGridWithPlayhead draws the ruler itself — calling it here too made
    // the most expensive routine in the file run twice per frame.
    this.drawGridWithPlayhead()
  }

  private drawPiano(): void {
    if (!this.pianoCtx) return
    const ctx = this.pianoCtx
    const totalHeight = this.totalRows * this.rowHeight

    ctx.clearRect(0, 0, this.pianoWidth, totalHeight)
    ctx.fillStyle = this.palette.surface
    ctx.fillRect(0, 0, this.pianoWidth, totalHeight)

    if (this.kind === 'drums') {
      this._drawDrumKeys(ctx)
    } else {
      this._drawPianoKeys(ctx)
    }

    // Right border
    ctx.strokeStyle = this.palette.border
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(this.pianoWidth - 1, 0)
    ctx.lineTo(this.pianoWidth - 1, totalHeight)
    ctx.stroke()
  }

  /** Melody mode: real black/white piano-key lanes (highest note at top).
   *  Gradient palette lifted from the falling-notes keyboard so the two
   *  keyboards match. The pressed lane gets an accent wash. */
  private _drawPianoKeys(ctx: CanvasRenderingContext2D): void {
    const w = this.pianoWidth
    for (let i = 0; i < this.totalRows; i++) {
      const y = i * this.rowHeight
      const scaleNote = this.scale[i]
      if (scaleNote == null) continue
      const isBlack = scaleNote.name.includes('#')
      const pressed = i === this.pressedKeyRow

      if (isBlack) {
        // Dark backing strip with a black-key stub over the left ~62%.
        ctx.fillStyle = '#20242c'
        ctx.fillRect(0, y, w, this.rowHeight)
        const stubW = w * 0.62
        const grad = ctx.createLinearGradient(0, y, stubW, y)
        grad.addColorStop(0, '#3a3e45')
        grad.addColorStop(0.55, '#1a1c22')
        grad.addColorStop(1, '#0d0e14')
        ctx.fillStyle = grad
        ctx.fillRect(0, y + 1, stubW, this.rowHeight - 2)
      } else {
        const grad = ctx.createLinearGradient(0, y, w, y)
        grad.addColorStop(0, '#fafbfc')
        grad.addColorStop(0.5, '#d4d8de')
        grad.addColorStop(1, '#b0b5bd')
        ctx.fillStyle = grad
        ctx.fillRect(0, y, w, this.rowHeight)
      }
      if (pressed) {
        ctx.fillStyle = this.palette.accentGlow
        ctx.fillRect(0, y, w, this.rowHeight)
      }

      // Label at the right edge (clear of the black-key stub). C rows are
      // bold — the octave anchors, like a real keyboard's middle-C dot.
      ctx.fillStyle = isBlack ? '#c9d1d9' : '#30363d'
      ctx.font =
        scaleNote.name === 'C'
          ? `bold ${this.palette.fontSmall}`
          : this.palette.fontSmall
      ctx.textAlign = 'right'
      ctx.textBaseline = 'middle'
      ctx.fillText(
        `${scaleNote.name}${scaleNote.octave}`,
        w - 5,
        y + this.rowHeight / 2,
      )

      // Row separator
      ctx.strokeStyle = this.palette.gridLine
      ctx.lineWidth = 0.5
      ctx.beginPath()
      ctx.moveTo(0, y + this.rowHeight)
      ctx.lineTo(w, y + this.rowHeight)
      ctx.stroke()
    }
  }

  /** Drum mode: one chip per GM kit piece — icon + short label; the full
   *  name lives in the status-bar hint and the hover tip. */
  private _drawDrumKeys(ctx: CanvasRenderingContext2D): void {
    const w = this.pianoWidth
    // Path2D is absent in some test DOMs — icons just don't render there.
    if (this.drumIconCache === null && typeof Path2D !== 'undefined') {
      const cache = new Map<number, Path2D>()
      for (const [midi, lane] of DRUM_LANE_BY_MIDI) {
        cache.set(midi, new Path2D(lane.iconPath))
      }
      this.drumIconCache = cache
    }
    for (let i = 0; i < this.totalRows; i++) {
      const y = i * this.rowHeight
      const scaleNote = this.scale[i]
      if (scaleNote == null) continue
      const lane = DRUM_LANE_BY_MIDI.get(scaleNote.midi)
      const pressed = i === this.pressedKeyRow

      // Alternate lane tint for scanability
      if (i % 2 === 1) {
        ctx.fillStyle = this.palette.blackRow
        ctx.fillRect(0, y, w, this.rowHeight)
      }
      if (pressed) {
        ctx.fillStyle = this.palette.accentGlow
        ctx.fillRect(0, y, w, this.rowHeight)
      }

      if (lane) {
        const icon = this.drumIconCache?.get(scaleNote.midi)
        if (icon) {
          const size = 14
          ctx.save()
          ctx.translate(5, y + (this.rowHeight - size) / 2)
          ctx.scale(size / 24, size / 24)
          ctx.fillStyle = pressed ? '#ffffff' : this.palette.text
          ctx.fill(icon)
          ctx.restore()
        }
        ctx.fillStyle = pressed ? '#ffffff' : '#c9d1d9'
        ctx.font = this.palette.fontSmall
        ctx.textAlign = 'left'
        ctx.textBaseline = 'middle'
        ctx.fillText(lane.shortLabel, 24, y + this.rowHeight / 2)
      } else {
        ctx.fillStyle = this.palette.text
        ctx.font = this.palette.fontSmall
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(
          `${scaleNote.name}${scaleNote.octave}`,
          w / 2,
          y + this.rowHeight / 2,
        )
      }

      // Row separator
      ctx.strokeStyle = this.palette.gridLine
      ctx.lineWidth = 0.5
      ctx.beginPath()
      ctx.moveTo(0, y + this.rowHeight)
      ctx.lineTo(w, y + this.rowHeight)
      ctx.stroke()
    }
  }

  /** Clip the ruler to its grid region and shift into content space, so beat
   *  marks scroll with the grid and never bleed over the piano column. */
  private _beginRulerContentSpace(ctx: CanvasRenderingContext2D): void {
    ctx.save()
    ctx.beginPath()
    ctx.rect(this.pianoWidth, 0, this.viewportWidth, this.rulerHeight)
    ctx.clip()
    ctx.translate(-this.scrollX, 0)
  }

  private drawRuler(): void {
    if (!this.rulerCtx) return
    const ctx = this.rulerCtx
    const rulerWidth = this.pianoWidth + this.viewportWidth

    ctx.clearRect(0, 0, rulerWidth, this.rulerHeight)
    ctx.fillStyle = this.palette.surface
    ctx.fillRect(0, 0, rulerWidth, this.rulerHeight)

    // Beat markers (offset by piano width), visible range only
    this._beginRulerContentSpace(ctx)
    const { from, to } = this._visibleBeats(this.pianoWidth)
    for (let b = from; b <= to; b++) {
      const x = this.pianoWidth + b * this.beatWidth
      const isBar = b % this.config.beatsPerBar === 0

      ctx.strokeStyle = isBar ? this.palette.tickStrong : this.palette.border
      ctx.lineWidth = isBar ? 1 : 0.5
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, this.rulerHeight)
      ctx.stroke()

      if (isBar) {
        const barNum = Math.floor(b / this.config.beatsPerBar) + 1
        ctx.fillStyle = this.palette.text
        ctx.font = this.palette.fontLabel
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(
          `${barNum}`,
          x + (this.beatWidth * this.config.beatsPerBar) / 2,
          this.rulerHeight / 2,
        )
        ctx.textBaseline = 'alphabetic'
      }
    }
    ctx.restore()

    // Bottom border
    ctx.strokeStyle = this.palette.border
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(0, this.rulerHeight - 1)
    ctx.lineTo(rulerWidth, this.rulerHeight - 1)
    ctx.stroke()

    // A-B loop markers (stopped state; no count-in offset)
    this.drawRulerLoop(ctx, 0)
  }

  private drawRulerWithPlayhead(): void {
    if (!this.rulerCtx) return
    const ctx = this.rulerCtx
    const rulerWidth = this.pianoWidth + this.viewportWidth

    ctx.clearRect(0, 0, rulerWidth, this.rulerHeight)
    ctx.fillStyle = this.palette.surface
    ctx.fillRect(0, 0, rulerWidth, this.rulerHeight)

    // GH #198 / #31: Count-in offset for ruler beat lines and playhead
    const currentBeat = this.getCurrentBeat()
    const countInOffset =
      this._countInBeats > 0 && currentBeat <= 0
        ? this._countInBeats * this.beatWidth
        : 0

    this._beginRulerContentSpace(ctx)
    const { from, to } = this._visibleBeats(this.pianoWidth + countInOffset)
    for (let b = from; b <= to; b++) {
      const x = this.pianoWidth + countInOffset + b * this.beatWidth
      const isBar = b % this.config.beatsPerBar === 0

      ctx.strokeStyle = isBar ? this.palette.tickStrong : this.palette.border
      ctx.lineWidth = isBar ? 1 : 0.5
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, this.rulerHeight)
      ctx.stroke()

      if (isBar) {
        const barNum = Math.floor(b / this.config.beatsPerBar) + 1
        ctx.fillStyle = this.palette.text
        ctx.font = this.palette.fontLabel
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(
          `${barNum}`,
          x + (this.beatWidth * this.config.beatsPerBar) / 2,
          this.rulerHeight / 2,
        )
        ctx.textBaseline = 'alphabetic'
      }
    }
    ctx.restore()

    ctx.strokeStyle = this.palette.border
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(0, this.rulerHeight - 1)
    ctx.lineTo(rulerWidth, this.rulerHeight - 1)
    ctx.stroke()

    // A-B loop markers + playhead live in content space too.
    this._beginRulerContentSpace(ctx)
    this.drawRulerLoop(ctx, countInOffset)

    // Playhead triangle — offset during count-in so it's visible
    const playheadX =
      this.pianoWidth + countInOffset + currentBeat * this.beatWidth
    ctx.save()
    ctx.fillStyle = this.palette.accent
    ctx.shadowColor = this.palette.accentGlow
    ctx.shadowBlur = 4
    const triSize = 6
    ctx.beginPath()
    ctx.moveTo(playheadX, this.rulerHeight - 1)
    ctx.lineTo(playheadX - triSize, this.rulerHeight - triSize - 1)
    ctx.lineTo(playheadX + triSize, this.rulerHeight - triSize - 1)
    ctx.closePath()
    ctx.fill()
    ctx.restore()
    // close _beginRulerContentSpace
    ctx.restore()
  }

  /** Left/right edges of the visible content window, in content px. */
  private get _viewLeft(): number {
    return this.scrollX
  }

  private get _viewRight(): number {
    return this.scrollX + this.viewportWidth
  }

  /** Whether a note's span intersects the viewport. Note drawing is by far the
   *  most expensive per-item work (shadows, rounded paths, effect shapes, plus
   *  two linear scale scans), so off-screen notes must not pay it — this is
   *  what keeps a 500-note import at full frame rate. */
  private _noteVisible(
    startBeat: number,
    duration: number,
    offset = 0,
  ): boolean {
    const x1 = offset + startBeat * this.beatWidth
    const x2 = x1 + duration * this.beatWidth
    // Generous margin so slide/trill shapes and badges that overhang their
    // note box are never clipped at the edges.
    return x2 >= this._viewLeft - 80 && x1 <= this._viewRight + 80
  }

  /** Inclusive beat indices intersecting the viewport, so grid loops cost the
   *  same on a 4-bar sketch and a 267-bar import. `offset` is the count-in
   *  shift applied to content x. */
  private _visibleBeats(offset = 0): { from: number; to: number } {
    const from = Math.max(
      0,
      Math.floor((this._viewLeft - offset) / this.beatWidth) - 1,
    )
    const to = Math.min(
      this.totalBeats,
      Math.ceil((this._viewRight - offset) / this.beatWidth) + 1,
    )
    return { from, to }
  }

  /** Prepare a viewport canvas: clear, paint the background, then shift into
   *  content space so every existing `beat * beatWidth` calculation is
   *  unchanged. Callers must ctx.restore() when done. */
  private _beginContentSpace(
    ctx: CanvasRenderingContext2D,
    height: number,
  ): void {
    ctx.clearRect(0, 0, this.viewportWidth, height)
    ctx.fillStyle = this.palette.bg
    ctx.fillRect(0, 0, this.viewportWidth, height)
    ctx.save()
    ctx.translate(-this.scrollX, 0)
  }

  private drawGrid(): void {
    if (!this.gridCtx) return
    const ctx = this.gridCtx
    const totalHeight = this.totalRows * this.rowHeight

    this._beginContentSpace(ctx, totalHeight)

    // Horizontal lines — only across the visible window.
    const left = this._viewLeft
    const right = this._viewRight
    for (let i = 0; i <= this.totalRows; i++) {
      const y = i * this.rowHeight
      const note = i < this.totalRows ? this.scale[i] : null
      const isBlack = note != null && note.name.includes('#')

      if (isBlack != null && isBlack) {
        ctx.fillStyle = this.palette.blackRow
        ctx.fillRect(left, y, this.viewportWidth, this.rowHeight)
      }

      if (this.showGrid) {
        ctx.strokeStyle = this.palette.gridLine
        ctx.lineWidth = 0.5
        ctx.beginPath()
        ctx.moveTo(left, y)
        ctx.lineTo(right, y)
        ctx.stroke()
      }
    }

    // Vertical lines (only when grid is visible)
    if (this.showGrid) {
      const { from, to } = this._visibleBeats()
      for (let b = from; b <= to; b++) {
        const x = b * this.beatWidth
        const isBar = b % this.config.beatsPerBar === 0
        ctx.strokeStyle = isBar ? this.palette.border : this.palette.gridLine
        ctx.lineWidth = isBar ? 1 : 0.5
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x, totalHeight)
        ctx.stroke()
      }
    }

    // Note blocks
    this.drawNoteBlocks(ctx, false)

    // Live recording / take-review preview (provisional notes).
    this.drawPreviewNotes(ctx, 0)

    // A-B loop span (stopped state; no count-in offset)
    this.drawGridLoop(ctx, 0, totalHeight)

    ctx.restore()

    // Box selection rectangle — its corners are stored in content space.
    if (this.isBoxSelecting) {
      const bx = Math.min(this.boxStartX, this.boxEndX)
      const by = Math.min(this.boxStartY, this.boxEndY)
      const bw = Math.abs(this.boxEndX - this.boxStartX)
      const bh = Math.abs(this.boxEndY - this.boxStartY)
      ctx.save()
      ctx.translate(-this.scrollX, 0)
      ctx.fillStyle = 'rgba(88, 166, 255, 0.15)'
      ctx.fillRect(bx, by, bw, bh)
      ctx.strokeStyle = 'rgba(88, 166, 255, 0.7)'
      ctx.lineWidth = 1.5
      ctx.setLineDash([4, 3])
      ctx.strokeRect(bx, by, bw, bh)
      ctx.restore()
    }
  }

  private drawGridWithPlayhead(): void {
    if (!this.gridCtx) return
    const ctx = this.gridCtx
    const totalHeight = this.totalRows * this.rowHeight

    this._beginContentSpace(ctx, totalHeight)

    // GH #122: Waveform background during mic recording
    this.drawWaveformBackground(ctx, this.viewportWidth, totalHeight)

    // Horizontal lines — only across the visible window.
    const left = this._viewLeft
    const right = this._viewRight
    for (let i = 0; i <= this.totalRows; i++) {
      const y = i * this.rowHeight
      const note = i < this.totalRows ? this.scale[i] : null
      const isBlack = note != null && note.name.includes('#')

      if (isBlack != null && isBlack) {
        ctx.fillStyle = this.palette.blackRow
        ctx.fillRect(left, y, this.viewportWidth, this.rowHeight)
      }

      if (this.showGrid) {
        ctx.strokeStyle = this.palette.gridLine
        ctx.lineWidth = 0.5
        ctx.beginPath()
        ctx.moveTo(left, y)
        ctx.lineTo(right, y)
        ctx.stroke()
      }
    }

    // GH #198 / #31: During count-in, shift the entire grid right so the
    // playhead sweeps through empty runway space before the first note.
    const currentBeat = this.getCurrentBeat()
    const countInOffset =
      this._countInBeats > 0 && currentBeat <= 0
        ? this._countInBeats * this.beatWidth
        : 0

    // Vertical lines (only when grid is visible) — offset during count-in
    if (this.showGrid) {
      const { from, to } = this._visibleBeats(countInOffset)
      for (let b = from; b <= to; b++) {
        const x = countInOffset + b * this.beatWidth
        const isBar = b % this.config.beatsPerBar === 0
        ctx.strokeStyle = isBar ? this.palette.border : this.palette.gridLine
        ctx.lineWidth = isBar ? 1 : 0.5
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x, totalHeight)
        ctx.stroke()
      }
    }

    // Note blocks with active highlight
    this.drawNoteBlocks(ctx, true)

    // Live recording preview — provisional notes captured this take.
    this.drawPreviewNotes(ctx, countInOffset)

    // A-B loop span (below the playhead so the playhead stays on top)
    this.drawGridLoop(ctx, countInOffset, totalHeight)

    const playheadX = countInOffset + currentBeat * this.beatWidth

    // Playhead line — always drawn during playback (including count-in)
    ctx.save()
    ctx.strokeStyle = this.palette.accent
    ctx.lineWidth = 2
    ctx.shadowColor = this.palette.accentGlow
    ctx.shadowBlur = 4
    ctx.beginPath()
    ctx.moveTo(playheadX, 0)
    ctx.lineTo(playheadX, totalHeight)
    ctx.stroke()
    ctx.restore()

    // Live pitch needle — where the singer is right now.
    this.drawLiveNeedle(ctx, playheadX)

    ctx.restore()

    // Keep the advancing playhead in view (recording, and long songs where the
    // playhead would otherwise run off the right edge).
    this.followPlayhead(playheadX)

    // Draw ruler with playhead triangle (always show during playback)
    this.drawRulerWithPlayhead()

    // GH #198: During count-in, still show ruler even if playhead is hidden
    // (The playhead is always visible now, so this is just for completeness)
    if (currentBeat < 0) {
      this.drawRuler()
    }
  }

  /** Draw the provisional notes captured live during recording — dashed,
   *  translucent blocks so they read as "in flight" vs committed notes. */
  private drawPreviewNotes(
    ctx: CanvasRenderingContext2D,
    countInOffset: number,
  ): void {
    if (this.previewNotes.length === 0) return
    ctx.save()
    ctx.setLineDash([4, 3])
    ctx.lineWidth = 1.5
    for (const note of this.previewNotes) {
      if (!this._noteVisible(note.startBeat, note.duration, countInOffset)) {
        continue
      }
      const rowIdx = this.midiToRow(note.note.midi)
      const h = this.rowHeight - 2
      const x = countInOffset + note.startBeat * this.beatWidth
      // Off-scale (accidental) notes sit at their true interpolated pitch, not
      // pinned to the top row — matches drawNoteBlocks.
      const y =
        (rowIdx < 0
          ? this.midiToY(note.note.midi) - this.rowHeight / 2
          : rowIdx * this.rowHeight) + 1
      const w = note.duration * this.beatWidth
      if (w < 1) continue
      ctx.fillStyle = 'rgba(219,112,219,0.20)'
      ctx.strokeStyle = 'rgba(219,112,219,0.85)'
      ctx.fillRect(x, y, w, h)
      ctx.strokeRect(x, y, w, h)
    }
    ctx.restore()
  }

  /** Draw the live-pitch needle: a dot at the playhead at the current
   *  (smoothed, fractional) pitch height. */
  private drawLiveNeedle(
    ctx: CanvasRenderingContext2D,
    playheadX: number,
  ): void {
    if (this.liveMidi === null) return
    const y = this.midiToY(this.liveMidi)
    ctx.save()
    ctx.fillStyle = this.palette.active
    ctx.shadowColor = 'rgba(63,185,80,0.7)'
    ctx.shadowBlur = 6
    ctx.beginPath()
    ctx.arc(playheadX, y, 5, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }

  /** Keep the advancing playhead within view. While recording the view only
   *  moves forward (a take shouldn't jump backwards); during normal playback
   *  it re-centres whenever the playhead leaves the comfortable middle band,
   *  which is what makes a long imported song watchable. */
  private followPlayhead(playheadX: number): void {
    if (!this.gridContainer) return
    if (this.stretchedWidth <= this.viewportWidth) return
    const recording = this.isRecording?.() === true
    const playing = this.playbackState === 'playing'
    if (!recording && !playing) return

    if (recording) {
      const target = playheadX - this.viewportWidth * 0.5
      if (target > this.scrollX) this._setScroll(target)
      return
    }
    const margin = this.viewportWidth * 0.15
    if (
      playheadX < this._viewLeft + margin ||
      playheadX > this._viewRight - margin
    ) {
      this._setScroll(playheadX - this.viewportWidth / 2)
    }
  }

  /** GH #122: Draw waveform visualization during mic recording */
  private drawWaveformBackground(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
  ): void {
    if (!this.getWaveform) return
    const wf = this.getWaveform()
    if (!wf || wf.length === 0) return
    const isRec = this.isRecording?.()
    if (isRec == null || !isRec) return

    ctx.save()
    ctx.strokeStyle = 'rgba(219,112,219,0.55)'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    const step = Math.max(1, Math.floor(wf.length / w))
    for (let i = 0; i < w; i++) {
      const sampleIdx = i * step
      const sample = wf[sampleIdx] ?? 0
      const y = h / 2 + sample * (h / 2) * 0.7
      if (i === 0) ctx.moveTo(i, y)
      else ctx.lineTo(i, y)
    }
    ctx.stroke()

    // Filled area
    ctx.fillStyle = 'rgba(219,112,219,0.06)'
    ctx.beginPath()
    for (let i = 0; i < w; i++) {
      const sampleIdx = i * step
      const sample = wf[sampleIdx] ?? 0
      const y = h / 2 + sample * (h / 2) * 0.7
      if (i === 0) ctx.moveTo(i, h / 2)
      else ctx.lineTo(i, y)
    }
    for (let i = w - 1; i >= 0; i--) {
      const sampleIdx = i * step
      const sample = wf[sampleIdx] ?? 0
      const y = h / 2 - sample * (h / 2) * 0.7
      ctx.lineTo(i, y)
    }
    ctx.closePath()
    ctx.fill()
    ctx.restore()
  }

  private drawNoteBlocks(
    ctx: CanvasRenderingContext2D,
    highlightActive: boolean,
  ): void {
    const countInOffset =
      this._countInBeats > 0 && this.getCurrentBeat() <= 0
        ? this._countInBeats * this.beatWidth
        : 0
    for (const note of this.melody) {
      // Off-screen cull first — before the two linear scale scans below.
      if (!this._noteVisible(note.startBeat, note.duration, countInOffset)) {
        continue
      }
      const rowIdx = this.midiToRow(note.note.midi)
      const offScale = rowIdx < 0

      const x = countInOffset + note.startBeat * this.beatWidth
      const h = this.rowHeight - 2
      // Off-scale notes (accidentals not present as a scale-degree row) are
      // positioned at their true interpolated pitch via midiToY — interpolated
      // between adjacent degrees when in range, clamped only when genuinely
      // above/below the grid. (Previously they were pinned to row 0, which made
      // e.g. a slightly-sharp A#3 look like a high C6.)
      const y = offScale
        ? this.midiToY(note.note.midi) - this.rowHeight / 2
        : rowIdx * this.rowHeight
      const w = note.duration * this.beatWidth
      const ry = y + 1

      if (w < 2) continue

      const isSelected = this.selectedNoteIds.has(note.id)
      const isActive =
        highlightActive &&
        this.getCurrentBeat() >= note.startBeat &&
        this.getCurrentBeat() < note.startBeat + note.duration
      const cornerRadius = 4

      // Shape rendering flags for effect notes
      let drawSlide = false
      let drawVibrato = false
      let drawTremolo = false
      let drawTrill = false
      let drawStaccato = false
      let drawChord = false
      let tgtCY = 0
      let srcCY = 0
      let halfH = 0
      if (!offScale && note.effectType) {
        srcCY = rowIdx * this.rowHeight + this.rowHeight / 2
        halfH = h / 2
        if (
          note.slideInterval !== undefined &&
          (note.effectType === 'slide-up' ||
            note.effectType === 'slide-down' ||
            note.effectType === 'ease-in' ||
            note.effectType === 'ease-out')
        ) {
          const targetMidi = note.note.midi + note.slideInterval
          tgtCY = this.midiToY(targetMidi)
          drawSlide = true
        } else if (note.effectType === 'vibrato') {
          drawVibrato = true
        } else if (note.effectType === 'tremolo') {
          drawTremolo = true
        } else if (note.effectType === 'trill') {
          const trillIv = note.trillInterval ?? 2
          const targetMidi = note.note.midi + trillIv
          tgtCY = this.midiToY(targetMidi)
          drawTrill = true
        } else if (note.effectType === 'staccato') {
          drawStaccato = true
        } else if (note.effectType === 'chord') {
          drawChord = true
        }
      }

      // Shadow for active vs normal notes
      if (isActive) {
        ctx.shadowColor = 'rgba(63,185,80,0.6)'
        ctx.shadowBlur = 8
        ctx.shadowOffsetX = 0
        ctx.shadowOffsetY = 0
      } else {
        ctx.shadowColor = 'rgba(0,0,0,0.3)'
        ctx.shadowBlur = 3
        ctx.shadowOffsetX = 0
        ctx.shadowOffsetY = 1
      }

      // Determine colors before path drawing (needed by staccato inline call)
      let fillColor = this.config.noteColors.normal
      let strokeColor = 'rgba(88,166,255,0.5)'
      let strokeWidth = 1

      if (isActive) {
        fillColor = this.config.noteColors.active
        strokeColor = 'rgba(63,185,80,0.9)'
        strokeWidth = 1.5
      } else if (drawSlide) {
        fillColor = SLIDE_FILL
        strokeColor = SLIDE_STROKE
        strokeWidth = 1.25
      } else if (drawVibrato) {
        fillColor = VIBRATO_FILL
        strokeColor = VIBRATO_STROKE
        strokeWidth = 1.25
      } else if (drawTremolo) {
        fillColor = TREMOLO_FILL
        strokeColor = TREMOLO_STROKE
        strokeWidth = 1.25
      } else if (drawTrill) {
        fillColor = TRILL_FILL
        strokeColor = TRILL_STROKE
        strokeWidth = 1.25
      } else if (drawStaccato) {
        fillColor = STACCATO_FILL
        strokeColor = STACCATO_STROKE
        strokeWidth = 1.25
      } else if (drawChord) {
        fillColor = CHORD_FILL
        strokeColor = CHORD_STROKE
        strokeWidth = 1.25
      } else if (isSelected) {
        fillColor = this.config.noteColors.selected
        strokeColor = '#8fc9ff'
        strokeWidth = 1.5
      }

      if (offScale) {
        fillColor = fillColor.replace('0.85', '0.4').replace('1)', '0.4)')
        if (fillColor === this.config.noteColors.normal) {
          fillColor = 'rgba(120,120,120,0.4)'
        }
      }

      // Draw note block path + fill/stroke
      if (drawStaccato && !offScale) {
        // Staccato draws its own shortened path with fill/stroke inline
        drawStaccatoShape({
          ctx,
          x,
          y: srcCY,
          w,
          halfH,
          ratio: note.staccatoRatio ?? 0.4,
          fillColor,
          strokeColor,
          strokeWidth,
        })
      } else {
        // Transparent bounding box behind zigzag/vibrato for easier grab/hover
        if (drawTrill) {
          const minY = Math.min(srcCY, tgtCY) - halfH - 2
          const maxY = Math.max(srcCY, tgtCY) + halfH + 2
          ctx.fillStyle = 'rgba(0,0,0,0)'
          ctx.fillRect(x, minY, w, maxY - minY)
        }

        ctx.beginPath()
        if (drawSlide) {
          slideShapePath(ctx, x, w, srcCY, tgtCY, halfH)
        } else if (drawVibrato) {
          const vibAmp = (note.vibratoAmplitude ?? 0.5) * 1.3 // scale to visible range
          vibratoShapePath(ctx, x, srcCY, w, halfH, vibAmp)
        } else if (drawTrill) {
          trillShapePath(ctx, x, w, srcCY, tgtCY, halfH)
        } else if (w < 2 * cornerRadius) {
          ctx.roundRect(x, ry, 2 * cornerRadius, h, [
            cornerRadius,
            cornerRadius,
            cornerRadius,
            cornerRadius,
          ])
        } else {
          ctx.roundRect(x, ry, w, h, cornerRadius)
        }

        ctx.fillStyle = fillColor
        ctx.strokeStyle = strokeColor
        ctx.lineWidth = strokeWidth
        ctx.fill()
        ctx.stroke()

        // Tremolo: draw horizontal opacity bands reflecting rate & depth
        if (drawTremolo) {
          const rate = note.tremoloRate ?? 8
          const depth = note.tremoloDepth ?? 0.5
          // More bands at higher rates, fewer at lower rates
          const bandCount = Math.max(2, Math.round((w * rate) / 60))
          const bandW = w / bandCount
          const alpha = Math.max(0.05, Math.min(0.45, depth * 0.6))
          ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`
          for (let i = 0; i < bandCount; i += 2) {
            ctx.fillRect(x + i * bandW, srcCY - halfH + 2, bandW, halfH * 2 - 4)
          }
        }

        // Chord: draw small circles for chord member pitches above the note
        if (drawChord) {
          drawChordShape({
            ctx,
            x: x + w / 2,
            y: srcCY,
            w,
            halfH,
            intervals: CHORD_INTERVALS[note.chordType ?? 'major'],
            rootMidi: note.note.midi,
            midiToY: (m: number) => this.midiToY(m),
          })
        }
      }

      // Progress fill overlay for active slide/trill notes
      if (isActive && (drawSlide || drawTrill)) {
        const progress = Math.max(
          0,
          Math.min(1, (this.getCurrentBeat() - note.startBeat) / note.duration),
        )
        if (drawSlide) {
          drawSlideProgress({
            ctx,
            x,
            srcCY,
            tgtCY,
            w,
            halfH,
            progress,
            clipHeight: this.totalRows * this.rowHeight,
          })
        } else if (drawTrill) {
          drawTrillProgress({
            ctx,
            x,
            srcCY,
            tgtCY,
            w,
            halfH,
            progress,
            clipHeight: this.totalRows * this.rowHeight,
          })
        }
      }

      // Hatch pattern for off-scale notes
      if (offScale && w > 10) {
        ctx.save()
        ctx.beginPath()
        ctx.rect(x, ry, w, h)
        ctx.clip()
        ctx.strokeStyle = 'rgba(255,255,255,0.3)'
        ctx.lineWidth = 1
        for (let hx = x; hx < x + w + h; hx += 6) {
          ctx.beginPath()
          ctx.moveTo(hx, ry)
          ctx.lineTo(hx - h, ry + h)
          ctx.stroke()
        }
        ctx.restore()
      }

      // Reset shadow
      ctx.shadowColor = 'transparent'
      ctx.shadowBlur = 0
      ctx.shadowOffsetY = 0

      // Effect badge on top-right
      if (
        w > 18 &&
        note.effectType &&
        !offScale &&
        (note.effectType === 'vibrato' ||
          note.effectType === 'tremolo' ||
          note.effectType === 'staccato')
      ) {
        drawEffectBadge({
          ctx,
          x: x + w,
          y: ry,
          effectType: note.effectType,
        })
      }

      // Note name text — for slide/trill notes show source/target at edges
      if ((drawSlide || drawTrill) && w > 28) {
        let tgtName: string
        if (drawSlide) {
          const targetMidi = note.note.midi + note.slideInterval!
          tgtName = midiToNote(targetMidi).name
        } else {
          const targetMidi = note.note.midi + (note.trillInterval ?? 2)
          tgtName = midiToNote(targetMidi).name
        }
        ctx.fillStyle = 'rgba(255,255,255,0.85)'
        ctx.font = 'bold 9px sans-serif'
        ctx.textAlign = 'left'
        ctx.textBaseline = 'middle'
        ctx.fillText(note.note.name, x + 10, srcCY)
        ctx.textAlign = 'right'
        ctx.fillText(tgtName, x + w - 10, tgtCY)
        ctx.textBaseline = 'alphabetic'
      } else if (!drawSlide && !drawTrill && w > 18) {
        const blockLabel =
          this.kind === 'drums'
            ? (DRUM_LANE_BY_MIDI.get(note.note.midi)?.shortLabel ??
              note.note.name)
            : note.note.name
        ctx.fillStyle = 'rgba(255,255,255,0.85)'
        ctx.font = 'bold 9px sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(blockLabel, x + w / 2, ry + h / 2)
        ctx.textBaseline = 'alphabetic'
      }

      // Resize handles on selected notes
      if (isSelected && w > 12) {
        const handleW = 6
        ctx.fillStyle = 'rgba(255,255,255,0.5)'
        ctx.fillRect(x + 1, ry + h / 2 - 4, handleW, 8)
        const rightHandleY = drawSlide || drawTrill ? tgtCY - 4 : ry + h / 2 - 4
        ctx.fillRect(x + w - handleW - 1, rightHandleY, handleW, 8)
      }
    }
  }

  // ============================================================
  // Octave / Scale methods (matching old app interface)
  // ============================================================

  /**
   * Shift all notes by an octave without changing the view.
   * The visible scale stays fixed — notes outside the range are
   * rendered as dimmed indicators at the nearest edge.
   */
  private _shiftOctave(delta: number): void {
    // Push history before transposing notes
    this.pushHistory()

    // Transpose all notes by the octave delta
    const MIDI_OCTAVE_SHIFT = 12
    for (const note of this.melody) {
      note.note.midi += delta * MIDI_OCTAVE_SHIFT
      const { name, octave } = midiToNote(note.note.midi)
      note.note.name = name
      note.note.octave = octave
      note.note.freq = midiToFreq(note.note.midi)
    }

    // Redraw — the view (which octaves are visible) stays fixed.
    // Notes that move outside the visible range are rendered as
    // gray indicators at the edge (existing off-scale rendering).
    this.buildCanvases()
    this.draw()
    this.onMelodyChange?.(this.melody)
  }

  /**
   * Set the number of octave rows displayed (1-7).
   */
  setNumOctaves(n: number): void {
    n = Math.max(1, Math.min(MAX_OCTAVE_ROWS, Math.round(n)))
    if (n === this.numOctaves) return
    this.numOctaves = n

    // Keep the toolbar counter in sync. The +/- click handlers also
    // write this DOM node, but auto-fit (called from setMelody) and any
    // future programmatic callers route through here directly, so we
    // need to update unconditionally.
    const display = this.container.querySelector('#roll-octaves-value')
    if (display) display.textContent = String(this.numOctaves)

    // Rebuild scale with new row count and redraw.
    this._rebuildScale()
    this.buildCanvases()
    this.draw()
    this._announceOffScaleNotes()

    eventBus.dispatch('pitchperfect:octaveChange', {
      octave: this.octave,
      numOctaves: this.numOctaves,
    })
  }

  /** Rebuild this.scale / this.totalRows from current octave/numOctaves/mode/key.
   *  this.key is synced from the store-provided scale in setScale — the old
   *  code read `window.pitchPerfectApp?.key`, which nothing ever assigned, so
   *  every toolbar-driven rebuild silently reverted the user's key to C. */
  private _rebuildScale(): void {
    const startOctave = this.scrollableMode ? 1 : this.octave
    const octaves = this.scrollableMode ? 7 : this.numOctaves
    const newScale = buildMultiOctaveScale(
      this.key,
      startOctave,
      octaves,
      this.mode,
    )
    this.scale = newScale
    this.totalRows = newScale.length
  }

  /**
   * Set the scale mode (major, minor, etc.) and rebuild scale.
   */
  setMode(mode: string): void {
    if (mode === this.mode) return
    this.mode = mode

    this._rebuildScale()
    this.draw()

    eventBus.dispatch('pitchperfect:modeChange', { mode })
  }

  /**
   * Adopt the store's scale type WITHOUT dispatching or rebuilding — the
   * accompanying setScale push carries the actual rows. Keeps the editor's
   * optimistic local rebuilds (Rows +/-, scroll toggle) building the same
   * scale the store would, and keeps the toolbar select honest when the
   * type was chosen elsewhere (sidebar, scale builder, loaded melody).
   */
  syncScaleType(mode: string): void {
    if (mode === this.mode) return
    this.mode = mode
    const select = this.container.querySelector(
      '#roll-mode-select',
    ) as HTMLSelectElement | null
    if (select && select.value !== mode) select.value = mode
  }

  // ============================================================
  // Effect application
  // ============================================================

  private _getSelectedNotes(): MelodyItem[] {
    if (this.selectedNoteIds.size === 0) return []
    return this.melody.filter((n) => this.selectedNoteIds.has(n.id))
  }

  /** Show the interval selector modal and return the chosen semitone offset.
   *  Pass `sourceMidi` to label each button with the resulting note name
   *  (e.g. "E4 (+2)"). Pass `currentInterval` to highlight the active choice. */
  private _showIntervalModal(
    effect: EffectType,
    sourceMidi?: number,
    currentInterval?: number,
  ): Promise<number | null> {
    return new Promise((resolve) => {
      this._intervalResolve = resolve
      const modal = this._intervalModalEl
      if (!modal) {
        resolve(null)
        return
      }
      const title = modal.querySelector('#roll-interval-title')!
      const effectLabels: Record<string, string> = {
        'slide-up': 'Slide Up Interval',
        'slide-down': 'Slide Down Interval',
        'ease-in': 'Ease In Interval',
        'ease-out': 'Ease Out Interval',
        trill: 'Trill Interval',
      }
      title.textContent = effectLabels[effect] ?? 'Interval'

      // Trim interval presets for trill (only ±1, ±2 are musically relevant)
      const trillRelevant = effect === 'trill' ? new Set([1, 2, -1, -2]) : null
      for (const [iv, btn] of this._intervalBtns) {
        btn.classList.remove('current')
        if (trillRelevant) {
          btn.style.display = trillRelevant.has(iv) ? '' : 'none'
        } else {
          btn.style.display = ''
        }
        if (sourceMidi !== undefined) {
          const { name, octave } = midiToNote(sourceMidi + iv)
          btn.innerHTML = `${name}${octave}&nbsp;<small>(${iv > 0 ? '+' : ''}${iv})</small>`
        } else {
          btn.textContent = iv > 0 ? `+${iv}` : `${iv}`
        }
        if (currentInterval !== undefined && iv === currentInterval) {
          btn.classList.add('current')
        }
      }
      // Show Remove button only when changing an existing slide
      const removeBtn = modal.querySelector('#roll-interval-remove')
      if (removeBtn instanceof HTMLElement) {
        removeBtn.style.display = currentInterval !== undefined ? '' : 'none'
      }
      modal.style.display = 'flex'
    })
  }

  private _applyEffect(type: EffectType): void {
    const selected = this._getSelectedNotes()
    if (selected.length === 0) return

    // Vibrato: toggle if same, apply immediately otherwise (no modal)
    if (type === 'vibrato') {
      this.pushHistory()
      if (selected.length === 1 && selected[0].effectType === 'vibrato') {
        selected[0].effectType = undefined
        selected[0].vibratoAmplitude = undefined
      } else {
        selected.forEach((n: MelodyItem) => {
          n.effectType = 'vibrato'
          n.slideInterval = undefined
          n.vibratoAmplitude = this.vibratoAmplitude
        })
      }
      this.emitMelodyChange()
      this.draw()
      return
    }

    // Tremolo: toggle if same, apply immediately otherwise (no modal)
    if (type === 'tremolo') {
      this.pushHistory()
      if (selected.length === 1 && selected[0].effectType === 'tremolo') {
        selected[0].effectType = undefined
        selected[0].tremoloRate = undefined
        selected[0].tremoloDepth = undefined
      } else {
        selected.forEach((n: MelodyItem) => {
          n.effectType = 'tremolo'
          n.slideInterval = undefined
          n.vibratoAmplitude = undefined
          n.tremoloRate = this.tremoloRate
          n.tremoloDepth = this.tremoloDepth
        })
      }
      this.emitMelodyChange()
      this.draw()
      return
    }

    // Chord: toggle if same, apply immediately otherwise (no modal)
    if (type === 'chord') {
      this.pushHistory()
      if (selected.length === 1 && selected[0].effectType === 'chord') {
        selected[0].effectType = undefined
        selected[0].chordType = undefined
      } else {
        selected.forEach((n: MelodyItem) => {
          n.effectType = 'chord'
          n.slideInterval = undefined
          n.vibratoAmplitude = undefined
          n.tremoloRate = undefined
          n.tremoloDepth = undefined
          n.trillRate = undefined
          n.trillInterval = undefined
          n.staccatoRatio = undefined
          n.chordType = this.chordType
        })
      }
      this.emitMelodyChange()
      this.draw()
      return
    }

    // Staccato: toggle if same, apply immediately otherwise (no modal)
    if (type === 'staccato') {
      this.pushHistory()
      if (selected.length === 1 && selected[0].effectType === 'staccato') {
        selected[0].effectType = undefined
        selected[0].staccatoRatio = undefined
      } else {
        selected.forEach((n: MelodyItem) => {
          n.effectType = 'staccato'
          n.slideInterval = undefined
          n.vibratoAmplitude = undefined
          n.staccatoRatio = this.staccatoRatio
        })
      }
      this.emitMelodyChange()
      this.draw()
      return
    }

    // Trill: works on first selected note, needs interval modal
    if (type === 'trill') {
      const target = selected[0]
      const isSameTrill = target.effectType === 'trill'

      if (isSameTrill) {
        void this._showIntervalModal(
          type,
          target.note.midi,
          target.trillInterval,
        ).then((iv) => {
          if (iv === null) return
          this.pushHistory()
          if (Number.isNaN(iv)) {
            target.effectType = undefined
            target.trillInterval = undefined
            target.trillRate = undefined
          } else {
            target.trillInterval = iv
            target.trillRate = this.trillRate
          }
          this._updateEffectBtnStates()
          this.emitMelodyChange()
          this.draw()
        })
        return
      }

      void this._showIntervalModal(type, target.note.midi).then((iv) => {
        if (iv === null) return
        this.pushHistory()
        target.effectType = type
        target.trillInterval = iv
        target.trillRate = this.trillRate
        target.vibratoAmplitude = undefined
        target.slideInterval = undefined
        this._updateEffectBtnStates()
        this.emitMelodyChange()
        this.draw()
      })
      return
    }

    // Slide/ease: work on the first selected note
    const target = selected[0]
    const isSameEffect = target.effectType === type

    // If the note already has this effect, re-open modal for change/removal
    if (isSameEffect) {
      void this._showIntervalModal(
        type,
        target.note.midi,
        target.slideInterval,
      ).then((iv) => {
        if (iv === null) return // cancelled — keep existing
        this.pushHistory()
        if (Number.isNaN(iv)) {
          // Remove effect
          target.effectType = undefined
          target.slideInterval = undefined
        } else {
          target.slideInterval = iv
        }
        this._updateEffectBtnStates()
        this.emitMelodyChange()
        this.draw()
      })
      return
    }

    // New effect on a note without this type — open modal for fresh interval
    void this._showIntervalModal(type, target.note.midi).then((iv) => {
      if (iv === null) return // cancelled
      this.pushHistory()
      target.effectType = type
      target.slideInterval = iv
      target.vibratoAmplitude = undefined
      this._updateEffectBtnStates()
      this.emitMelodyChange()
      this.draw()
    })
  }

  /** Update effect button active states. Also checks the selected note's effectType. */
  private _updateEffectBtnStates(
    container: HTMLElement = this.container,
  ): void {
    const ids = [
      'roll-action-slide-up',
      'roll-action-slide-down',
      'roll-action-ease-in',
      'roll-action-ease-out',
      'roll-action-vibrato',
      'roll-action-tremolo',
      'roll-action-trill',
      'roll-action-staccato',
      'roll-action-chord',
    ]
    for (const id of ids) {
      container.querySelector(`#${id}`)?.classList.remove('active')
    }
    const selected = this._getSelectedNotes()
    // Single note: show its effectType. Multiple notes: show if ALL share the same effectType.
    let activeEffect: EffectType | null = null
    if (selected.length === 1) {
      activeEffect = selected[0].effectType ?? null
    } else if (selected.length > 1) {
      const first = selected[0].effectType
      if (first && selected.every((n) => n.effectType === first)) {
        activeEffect = first
      }
    }
    const highlight = this.selectedEffect ?? activeEffect
    if (highlight) {
      const map: Record<EffectType, string> = {
        'slide-up': 'roll-action-slide-up',
        'slide-down': 'roll-action-slide-down',
        'ease-in': 'roll-action-ease-in',
        'ease-out': 'roll-action-ease-out',
        vibrato: 'roll-action-vibrato',
        tremolo: 'roll-action-tremolo',
        trill: 'roll-action-trill',
        staccato: 'roll-action-staccato',
        chord: 'roll-action-chord',
      }
      const activeId = map[highlight]
      if (activeId)
        container.querySelector(`#${activeId}`)?.classList.add('active')
    }
    this._updateEffectSliders(container)
  }

  /**
   * Bind a single effect parameter slider with the standard pipeline:
   * read → update label → set instance state → propagate to selected notes
   * of the given effect type → emit change + redraw.
   *
   * @param sliderId   DOM id of the `<input type="range">`
   * @param valueId    DOM id of the display `<span>`
   * @param effectType Only notes with this effect are updated
   * @param apply      Called with (note, parsedValue) — should set both
   *                   the instance-level default AND the note-level field
   */
  private _bindEffectSlider(
    sliderId: string,
    valueId: string,
    effectType: EffectType,
    apply: (note: MelodyItem, value: number) => void,
  ): void {
    const slider = this.container.querySelector(
      `#${sliderId}`,
    ) as HTMLInputElement | null
    const valueEl = this.container.querySelector(
      `#${valueId}`,
    ) as HTMLSpanElement | null
    if (!slider) return

    slider.addEventListener('input', () => {
      if (valueEl) valueEl.textContent = slider.value
      const parsed = parseFloat(slider.value)

      const sel = this._getSelectedNotes()
      let changed = false
      for (const n of sel) {
        if (n.effectType === effectType) {
          apply(n, parsed)
          changed = true
        }
      }
      if (changed) {
        this.emitMelodyChange()
        this.draw()
      }
    })
  }

  /** Show/hide effect parameter sliders based on selected effect context. */
  private _updateEffectSliders(container: HTMLElement = this.container): void {
    const hasEffectType = (type: EffectType): boolean =>
      this.selectedEffect === type ||
      [...this.selectedNoteIds].some((id) => {
        const note = this.melody.find((n) => n.id === id)
        return note?.effectType === type
      })

    const popover = container.querySelector(
      '#roll-effect-popover',
    ) as HTMLElement | null
    const types: [EffectType, string][] = [
      ['vibrato', 'roll-popover-vibrato'],
      ['tremolo', 'roll-popover-tremolo'],
      ['trill', 'roll-popover-trill'],
      ['staccato', 'roll-popover-staccato'],
      ['chord', 'roll-popover-chord'],
    ]

    let activeType: EffectType | null = null
    for (const [type, innerId] of types) {
      const show = hasEffectType(type)
      const el = container.querySelector(`#${innerId}`)
      if (el instanceof HTMLElement) el.style.display = show ? 'flex' : 'none'
      if (show) activeType = type
    }

    // Sync slider values to first selected note with the active effect
    if (activeType && this.selectedNoteIds.size > 0) {
      const firstId = [...this.selectedNoteIds][0]
      const note = this.melody.find((n) => n.id === firstId)
      if (note?.effectType === activeType) {
        const setSlider = (
          id: string,
          val: number | undefined,
          fallback: number,
        ) => {
          const input = container.querySelector(
            `#${id}`,
          ) as HTMLInputElement | null
          if (input) input.value = String(val ?? fallback)
        }
        const setSpan = (
          id: string,
          val: number | undefined,
          fallback: number,
        ) => {
          const span = container.querySelector(
            `#${id}`,
          ) as HTMLSpanElement | null
          if (span) span.textContent = String(val ?? fallback)
        }
        if (activeType === 'vibrato') {
          setSlider('roll-vibrato-amp-slider', note.vibratoAmplitude, 0.5)
          setSpan('roll-vibrato-amp-value', note.vibratoAmplitude, 0.5)
          this.vibratoAmplitude = note.vibratoAmplitude ?? 0.5
        } else if (activeType === 'tremolo') {
          setSlider('roll-tremolo-rate-slider', note.tremoloRate, 8)
          setSpan('roll-tremolo-rate-value', note.tremoloRate, 8)
          setSlider('roll-tremolo-depth-slider', note.tremoloDepth, 0.5)
          setSpan('roll-tremolo-depth-value', note.tremoloDepth, 0.5)
          this.tremoloRate = note.tremoloRate ?? 8
          this.tremoloDepth = note.tremoloDepth ?? 0.5
        } else if (activeType === 'trill') {
          setSlider('roll-trill-rate-slider', note.trillRate, 10)
          setSpan('roll-trill-rate-value', note.trillRate, 10)
          this.trillRate = note.trillRate ?? 10
        } else if (activeType === 'staccato') {
          setSlider('roll-staccato-ratio-slider', note.staccatoRatio, 0.4)
          setSpan('roll-staccato-ratio-value', note.staccatoRatio, 0.4)
          this.staccatoRatio = note.staccatoRatio ?? 0.4
        } else if (activeType === 'chord') {
          const chordType = note.chordType ?? 'major'
          const select = container.querySelector(
            '#roll-chord-type-select',
          ) as HTMLSelectElement | null
          if (select) select.value = chordType
          this.chordType = chordType
        }
      }
    }

    if (popover) {
      popover.style.display = activeType ? 'flex' : 'none'
      // Position below the Effects toolbar group
      if (activeType) {
        const effectsGroup = container.querySelector(
          '.roll-group[data-name="Effects"]',
        )
        if (effectsGroup instanceof HTMLElement) {
          const groupRect = effectsGroup.getBoundingClientRect()
          const containerRect = container.getBoundingClientRect()
          popover.style.top = `${groupRect.bottom - containerRect.top + 2}px`
          popover.style.left = `${groupRect.left - containerRect.left}px`
        }
      }
    }
  }

  /** Apply an effect via keyboard shortcut. Mirrors button-click logic. */
  private _keyboardEffect(effect: EffectType): void {
    // Pitch effects (slides, vibrato, chords...) are meaningless on drums.
    if (this.previewMode || this.kind === 'drums') return
    if (this.selectedNoteIds.size === 0) {
      if (this.selectedEffect === effect) {
        this.selectedEffect = null
      } else {
        this.selectedEffect = effect
      }
      this._updateEffectBtnStates()
      this._updateHint()
      return
    }
    this.selectedEffect = null
    this._updateEffectBtnStates()
    this._applyEffect(effect)
  }
}
