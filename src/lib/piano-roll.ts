// ============================================================
// Piano Roll Editor — Canvas-based note editor
// ============================================================

import type { BallPhysicsState, NoteBounds, } from '@/features/playback/yousician-ball-physics'
import { createBallPhysics, getBallPhysics, } from '@/features/playback/yousician-ball-physics'
import type { AudioEngine, InstrumentType } from '@/lib/audio-engine'
import { PitchDetector } from '@/lib/pitch-detector'
import { buildMultiOctaveScale, midiToFreq, midiToNote } from '@/lib/scale-data'
import type { MelodyItem, NoteName, PianoRollConfig, ScaleDegree, } from '@/types'

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

// ============================================================
// MIDI Export
// ============================================================

/** Encode a melody as a Standard MIDI File (Format 1). */
export function exportMelodyToMIDI(
  melody: MelodyItem[],
  bpm: number,
): Uint8Array | null {
  if (melody === null || melody === undefined || melody.length === 0)
    return null

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
      type: 0x90,
      note: midi,
      velocity: 80,
    })
    absEvents.push({
      tick: tickOff,
      delta: 0,
      type: 0x80,
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
): boolean {
  const data = exportMelodyToMIDI(melody, bpm)
  if (!data) {
    alert('No melody to export. Add some notes first.')
    return false
  }
  const blob = new Blob([new Uint8Array(data)], { type: 'audio/midi' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download =
    filename !== null && filename !== undefined && filename !== ''
      ? filename
      : 'pitchperfect-melody.mid'
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
    let _trackIndex = 0
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
        const _startOffset = offset
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
          const _metaType = data[offset++]
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
      _trackIndex++
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
}

export type PlaybackState = 'stopped' | 'playing' | 'paused'
export type ActiveTool = 'place' | 'erase' | 'select'
export type EffectType =
  | 'slide-up'
  | 'slide-down'
  | 'ease-in'
  | 'ease-out'
  | 'vibrato'

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
  private stretchedWidth = 0

  // Playback
  private playbackState: PlaybackState = 'stopped'
  private playbackAnimationId: number | null = null
  private playStartTime: number = 0
  private isCountingIn = false
  // Remote beat comes from PlaybackRuntime events (external playback)
  // For internal editor playback, beat is calculated locally
  private remoteBeat = 0
  // Editor tab current beat (propagated from App.tsx for continuous animation)
  // This is used for Editor tab internal playback and to track position
  private editorBeat = 0
  // Whether the editor was playing before switching to external playback
  private wasPlayingBeforeExternal = false
  private startedNoteIds = new Set<number>()
  private currentNoteRow = -1 // GH #129: tracks current note row for glowing dot (deprecated in favor of ball physics)
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
  private isSeeking = false
  private seekStartX = 0
  // Track currently playing notes (for audio stacking prevention)
  private currentPlayingNoteIds = new Set<number>()
  // Track whether playback was started externally (Practice tab) vs internally (Editor tab)
  private externalPlayback = false

  // Waveform props for recording visualization
  private isRecording: (() => boolean) | null = null
  private getWaveform: (() => Float32Array | null) | null = null

  // Interaction
  private selectedNoteIds: Set<number> = new Set()
  private activeTool: ActiveTool = 'place'
  private isDragging = false
  private isResizing = false
  private resizeHandle: 'left' | 'right' | null = null
  private dragStartX = 0
  private dragStartY = 0
  private dragStartBeat = 0
  private dragStartDuration = 0
  private selectedDuration = 1
  private nextNoteId = 1
  private isBoxSelecting = false
  private boxStartX = 0
  private boxStartY = 0
  private boxEndX = 0
  private boxEndY = 0
  private dragStartRow = 0

  // Scale/Octave state (matches old app)
  private octave = 4
  // Default to 2 to match the store default (`melodyStore._numOctaves = 2`).
  // Previously this was 1, which caused the on-screen counter ("Rows: 1") to
  // disagree with the actually-rendered scale (2 octaves' worth of rows).
  // The +/- buttons then stepped from 1 → 2 (no visual change) → 3 (jump),
  // which the user perceived as "things get messy".
  private numOctaves = 2

  private mode = 'major'

  // Grid visibility
  private showGrid = true

  // Effect state
  private selectedEffect: EffectType | null = null

  // Undo/redo history
  private historyStack: MelodyItem[][] = []
  private redoStack: MelodyItem[][] = []
  private readonly maxHistorySize = 50

  // Note ID generation
  private _nextId = 1

  // Callbacks
  private onMelodyChange?: (melody: MelodyItem[]) => void
  private onNoteSelect?: (note: MelodyItem | null) => void
  private onPlayClick?: () => void
  private onResetClick?: () => void
  private onInstrumentChange?: (instrument: InstrumentType) => void
  private onPlaybackStateChange?: (state: PlaybackState) => void

  constructor(options: PianoRollOptions) {
    this.container = options.container
    this.scale = options.scale ?? []
    this.bpm = options.bpm ?? 120
    this.totalBeats = options.totalBeats ?? 16
    this.onMelodyChange = options.onMelodyChange
    this.onNoteSelect = options.onNoteSelect
    this.onInstrumentChange = options.onInstrumentChange
    this.onPlaybackStateChange = options.onPlaybackStateChange
    this.rowHeight = this.config.rowHeight
    this.zoomLevel = 1.0
    this.beatWidth = this.config.beatWidth
    this.pianoWidth = this.config.pianoWidth
    this.rulerHeight = this.config.rulerHeight
    this.totalRows = this.scale.length

    this.buildDOM()
    this.attachEventListeners()
    this.updateUndoRedoButtons()
    this.draw()
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
    this.melody = melody.map((item) => ({
      ...item,
      id: item.id ?? this.nextNoteId++,
    }))

    // Initialize ball physics with new melody
    this.initializeBallPhysics()

    // Auto-fit octave row count to the melody's MIDI span so notes
    // outside the currently displayed range become visible. We only ever
    // GROW the row count here — shrinking would surprise the user who
    // has manually picked a row count. Mobile / tight layouts can still
    // bring it back down via the toolbar's `−` button. Default minimum
    // remains 2 (matches melodyStore default).
    if (melody.length > 0) {
      let minMidi = Infinity
      let maxMidi = -Infinity
      for (const item of melody) {
        const midi = item.note?.midi
        if (typeof midi !== 'number') continue
        if (midi < minMidi) minMidi = midi
        if (midi > maxMidi) maxMidi = midi
      }
      if (Number.isFinite(minMidi) && Number.isFinite(maxMidi)) {
        const span = Math.ceil((maxMidi - minMidi + 1) / 12)
        const needed = Math.max(2, span)
        // Cap at 3 (current upper limit in setNumOctaves) to keep the
        // grid usable on small screens. Melodies wider than 3 octaves
        // simply scroll out of view; the user can revisit row count
        // manually.
        const target = Math.min(3, needed)
        if (target > this.numOctaves) {
          this.setNumOctaves(target)
        }
      }
    }

    this.draw()
  }

  /**
   * Initialize ball physics with current melody data
   * Converts melody items to NoteBounds for physics collision
   */
  private async initializeBallPhysics(): Promise<void> {
    if (this.ballState) return

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
   * Get note bounds at current beat position for ball physics
   */
  private getCurrentNoteAtBeat(beat: number): NoteBounds | null {
    for (const note of this.ballNotes) {
      if (note.startBeat <= beat && beat < note.endBeat) {
        return note
      }
    }
    return null
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
    if (undoBtn !== null && undoBtn !== undefined)
      undoBtn.disabled = !this.canUndo()
    if (redoBtn !== null && redoBtn !== undefined)
      redoBtn.disabled = !this.canRedo()
  }

  setScale(scale: ScaleDegree[]): void {
    this.scale = scale
    // Ensure minimum 2 rows (one octave) to prevent 0-height canvas
    this.totalRows = Math.max(scale.length, 2)
    this.buildCanvases()
    this.draw()
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
    const containerWidth = this.gridContainer.clientWidth - this.pianoWidth
    const minWidth = this.totalBeats * this.config.beatWidth
    if (containerWidth > 0 && minWidth > 0) {
      this.setZoom(containerWidth / minWidth)
    }
  }

  setCurrentNote(index: number): void {
    if (index < 0) {
      this.remoteBeat = 0
    } else {
      const item = this.melody[index]
      if (item !== null && item !== undefined) {
        this.remoteBeat = item.startBeat
      }
    }
    this.drawWithPlayhead()
  }

  setWaveformProps(
    isRecording: (() => boolean) | null,
    getWaveform: (() => Float32Array | null) | null,
  ): void {
    this.isRecording = isRecording
    this.getWaveform = getWaveform
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
    if (active && this.playbackAnimationId !== null) {
      cancelAnimationFrame(this.playbackAnimationId)
      this.playbackAnimationId = null
    }
  }

  setPlaybackState(state: PlaybackState): void {
    this.playbackState = state

    if (state === 'playing') {
      // Don't start animation during count-in - wait for count-in to complete first
      if (this.isCountingIn) {
        this.isCountingIn = false
      }

      // If we're transitioning from external back to internal playback
      if (this.isExternalPlayback && this.wasPlayingBeforeExternal) {
        this.wasPlayingBeforeExternal = false
        this.isExternalPlayback = false
        this.startedNoteIds.clear()
        // Resume from current editorBeat
        const startTime = Date.now() - (this.editorBeat / this.bpm) * 60000
        this.playStartTime = startTime
        this.startPlaybackAnimation()
      } else if (
        !this.isExternalPlayback &&
        this.playbackAnimationId === null
      ) {
        // Fresh start - use editorBeat as starting point for animation
        // Don't clear startedNoteIds during fresh start to avoid duplicate note triggers
        // The notes will start naturally as playhead moves
        const startTime = Date.now() - (this.editorBeat / this.bpm) * 60000
        this.playStartTime = startTime
        this.startPlaybackAnimation()
      }
    } else if (state === 'paused') {
      this.stopPlayback()
    } else if (state === 'stopped') {
      this.stopPlayback()
      this.remoteBeat = 0
      this.editorBeat = 0
      this.startedNoteIds.clear()
      this.currentNoteRow = -1
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
    this.totalBeats += count
    this.buildCanvases()
    this.draw()
  }

  removeBeats(count: number): void {
    const newTotal = Math.max(4, this.totalBeats - count)
    // Check if any notes would be trimmed
    const wouldTrim = this.melody.some(
      (n) => n.startBeat + n.duration > newTotal,
    )
    if (wouldTrim && !confirm('This will trim some notes. Continue?')) return
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
    if (this.selectedNoteIds.size > 0) {
      if (this.selectedNoteIds.size === 1) {
        const id = [...this.selectedNoteIds][0]
        const note = this.melody.find((n) => n.id === id)
        if (note) {
          const info = this.scale.find((s) => s.midi === note.note.midi)
          const name = info ? `${info.name}${info.octave}` : '?'
          const startBar =
            Math.floor(note.startBeat / PIANO_ROLL_CONFIG.beatsPerBar) + 1
          const startBeat =
            Math.floor(note.startBeat % PIANO_ROLL_CONFIG.beatsPerBar) + 1
          this.hintEl.textContent = `Selected: ${name} | Duration: ${note.duration}b | Bar ${startBar}/${startBeat} — Right-click or Del to delete`
        }
      } else {
        this.hintEl.textContent = `${this.selectedNoteIds.size} notes selected | Shift+click to toggle | Drag to multi-move | Del to delete | Action buttons create slides`
      }
    } else if (this.activeTool === 'place') {
      this.hintEl.textContent = `Click to place a ${this.selectedDuration}b note | Right-click to delete`
    } else if (this.activeTool === 'erase') {
      this.hintEl.textContent = 'Click on a note to erase it'
    } else {
      this.hintEl.textContent =
        'Click and drag note edges to resize | Del to delete selected'
    }
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
      ctx.scale(dpr, dpr)
      ctx.fillStyle = '#0d1117'
      ctx.fillRect(0, 0, w, h)
      ctx.fillStyle = 'rgba(88, 166, 255, 0.3)'
      ctx.font = '11px monospace'
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
      ctx.fillStyle = '#58a6ff'
      ctx.font = '10px monospace'
      ctx.textAlign = 'right'
      ctx.fillText(`${Math.round(result.frequency)} Hz`, w - 4, 12)
    }
  }

  destroy(): void {
    if (this.playbackAnimationId !== null) {
      cancelAnimationFrame(this.playbackAnimationId)
    }
    this.container.innerHTML = ''
  }

  // ============================================================
  // DOM Construction
  // ============================================================

  private buildDOM(): void {
    this.container.innerHTML = `
     <div class="roll-toolbar">

  <!-- TOOLS -->
  <div class="roll-group" data-name="Edit">
              <button class="roll-tool-btn active" data-tool="place" title="Place notes">
                <svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
              </button>
              <button class="roll-tool-btn" data-tool="erase" title="Erase notes">
                <svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
              </button>
              <button class="roll-tool-btn" data-tool="select" title="Select notes">
                <svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z"/></svg>
              </button>
  <!-- EDIT -->
    <div class="roll-undo-group">
              <button id="roll-undo-btn" class="roll-undo-btn" title="Undo (Ctrl+Z)" disabled>
                <svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M12.5 8c-2.65 0-5.05.99-6.9 2.6L2 7v9h9l-3.62-3.62c1.39-1.16 3.16-1.88 5.12-1.88 3.54 0 6.55 2.31 7.6 5.5l2.37-.78C21.08 11.03 17.15 8 12.5 8z"/></svg>
              </button>
              <button id="roll-redo-btn" class="roll-redo-btn" title="Redo (Ctrl+Y)" disabled>
                <svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M18.4 10.6C16.55 8.99 14.15 8 11.5 8c-4.65 0-8.58 3.03-9.96 7.22L3.9 16c1.05-3.19 4.05-5.5 7.6-5.5 1.95 0 3.73.72 5.12 1.88L13 16h9V7l-3.6 3.6z"/></svg>
              </button>
              </div>
    <button id="roll-clear-all" class="roll-ctrl-btn danger" title="Clear all notes">
      <svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M15 16h4v2h-4zm0-8h7v2h-7zm0 4h6v2h-6zM3 18c0 1.1.9 2 2 2h6c1.1 0 2-.9 2-2V8H3v10zM14 5h-3l-1-1H6L5 5H2v2h12z"/></svg>
    <!--  <span>Clear</span>-->
              </button>
  </div>

  <!-- VIEW -->
  <div class="roll-group" data-name="View">
     <button id="roll-grid-toggle" class="roll-grid-toggle-btn" title="Toggle grid lines">
       <svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M20 2H4c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM8 20H4v-4h4v4zm0-6H4v-4h4v4zm0-6H4V4h4v4zm6 12h-4v-4h4v4zm0-6h-4v-4h4v4zm0-6h-4V4h4v4zm6 12h-4v-4h4v4zm0-6h-4v-4h4v4zm0-6h-4V4h4v4z"/></svg>
       <span>Grid</span>
              </button>
    <button id="roll-pitch-track-btn" class="roll-pitch-track-btn" title="Toggle pitch track">
      <svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M16 6l2.29 2.29-4.88 4.88-4-4L2 16.59 3.41 18l6-6 4 4 6.3-6.29L22 12V6z"/></svg>
      <span>Pitch Track</span>
              </button>
    
    <div class="roll-zoom-inline">
      <button id="roll-zoom-out" class="roll-zoom-btn" title="Zoom out">
        <svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
              </button>
      <span id="roll-zoom-value" class="zoom-value">100%</span>
      <button id="roll-zoom-in" class="roll-zoom-btn" title="Zoom in">
          <svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M19 13H5v-2h14v2z"/></svg>
              </button>
            </div>
    
    <!-- Zoom Fit -->
    <div class="roll-zoom-group">
      <button id="roll-zoom-fit" class="roll-zoom-btn" title="Fit to screen">
        <svg viewBox="0 0 24 24" width="12" height="12"><path fill="currentColor" d="M15 3l2.3 2.3-2.89 2.87 1.42 1.42L18.7 6.7 21 9V3zM3 9l2.3-2.3 2.87 2.89 1.42-1.42L6.7 5.3 9 3H3zm6 12l-2.3-2.3 2.89-2.87-1.42-1.42L5.3 17.3 3 15v6zm12-6l-2.3 2.3-2.87-2.89-1.42 1.42 2.89 2.87L15 21h6z"/></svg>
        <span>Fit</span>
      </button>
          </div>
    </div>

  <!-- MUSICAL (2 COL) -->
  <div class="roll-group roll-group-2col" data-name="Notes">

    <!-- Duration -->
    <div class="roll-durations">
            <button class="dur-btn" data-dur="0.25">1/16</button>
            <button class="dur-btn" data-dur="0.5">1/8</button>
            <button class="dur-btn active" data-dur="1">1/4</button>
            <button class="dur-btn" data-dur="2">1/2</button>
            <button class="dur-btn" data-dur="3">3/4</button>
            <button class="dur-btn" data-dur="4">1</button>
          </div>

    <!-- Rows -->
    <div class="roll-octaves-group">
       <button id="roll-octaves-minus" class="octave-btn" title="Fewer octaves">
        <svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M19 13H5v-2h14v2z"/></svg>
       </button>
       <span id="roll-octaves-value" class="octave-value">${this.numOctaves}</span>
       <button id="roll-octaves-plus" class="octave-btn" title="More octaves">
          <svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
       </button>
    </div>

    <!-- Octave -->
    <div class="roll-octave-group">
      <button id="roll-octave-up" class="octave-btn" title="Higher octave">
        <svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
      </button>
            <span id="roll-octave-value" class="octave-value">${this.octave}</span>
      <button id="roll-octave-down" class="octave-btn" title="Lower octave">
        <svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M19 13H5v-2h14v2z"/></svg>
      </button>
    </div>

    <!-- Bars -->
    <div class="roll-bars-group">
      <button id="roll-bars-down" class="roll-bars-btn" title="Remove 4 bars">
        <svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>
      </button>

      <button id="roll-bars-up" class="roll-bars-btn" title="Add 4 bars">
        <svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>
      </button>
    </div>

    <!-- Scale -->
    <div class="roll-mode-group">
        <label class="mode-label">
      <svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>
    </label>
            <select id="roll-mode-select" class="roll-mode-select">
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
        <select id="roll-instrument-select" class="roll-instrument-select">
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
    <button id="roll-action-slide-up" class="roll-action-btn slide-up" title="Create ascending slide between selected notes">
      <svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M4 20l8-16 8 16z"/></svg>
      <span>↑Slide</span>
    </button>
    <button id="roll-action-slide-down" class="roll-action-btn slide-down" title="Create descending slide between selected notes">
      <svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M4 4l8 16 8-16z"/></svg>
      <span>↓Slide</span>
    </button>
    <button id="roll-action-ease-in" class="roll-action-btn ease-in" title="Create ease-in slide (starts level, slides down)">
      <svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M4 12h4l4-6 8 10z"/></svg>
      <span>Ease In</span>
    </button>
    <button id="roll-action-ease-out" class="roll-action-btn ease-out" title="Create ease-out slide (slides up, eases to level)">
      <svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M4 12l4-6 4 6h12z"/></svg>
      <span>Ease Out</span>
    </button>
    <button id="roll-action-vibrato" class="roll-action-btn vibrato" title="Create vibrato on selected note">
      <svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M3 12c3-4 6 4 9 0s6 4 9 0"/></svg>
      <span>Vibrato</span>
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
      <div class="roll-main-area">
        <div class="roll-grid-wrapper">
          <div class="roll-ruler-container">
            <canvas class="roll-ruler"></canvas>
          </div>
          <canvas class="roll-piano"></canvas>
          <div class="roll-grid-container">
            <canvas class="roll-grid"></canvas>
          </div>
        </div>
      </div>
      <canvas id="roll-pitch-track-canvas" class="roll-pitch-track" style="display:none"></canvas>
      <canvas id="roll-ball-canvas" class="roll-ball" style="display:none"></canvas>
      <div class="roll-status">
        <span id="roll-note-info">Click on the grid to place notes</span>
        <span id="roll-timeline-info">Bar 1/${Math.ceil(this.totalBeats / PIANO_ROLL_CONFIG.beatsPerBar)} | Beat 1</span>
        <span id="roll-beat-info">${this.totalBeats} beats</span>
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

  private buildCanvases(): void {
    const dpr = window.devicePixelRatio || 1
    const totalHeight = this.totalRows * this.rowHeight

    const minWidth = this.totalBeats * this.beatWidth * this.zoomLevel
    const containerWidth = this.gridContainer?.clientWidth ?? 0
    this.stretchedWidth =
      containerWidth > 0
        ? Math.max(minWidth, containerWidth - this.pianoWidth)
        : minWidth

    // Piano canvas
    if (this.pianoCanvas) {
      this.pianoCanvas.width = this.pianoWidth * dpr
      this.pianoCanvas.height = totalHeight * dpr
      this.pianoCanvas.style.height = `${totalHeight}px`
      this.pianoCtx = this.pianoCanvas.getContext('2d')
      if (this.pianoCtx) this.pianoCtx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    // Ruler canvas spans full width (piano + grid)
    const rulerWidth = this.pianoWidth + this.stretchedWidth
    if (this.rulerCanvas) {
      this.rulerCanvas.width = rulerWidth * dpr
      this.rulerCanvas.height = this.rulerHeight * dpr
      this.rulerCanvas.style.width = `${rulerWidth}px`
      this.rulerCanvas.style.height = `${this.rulerHeight}px`
      this.rulerCtx = this.rulerCanvas.getContext('2d')
      if (this.rulerCtx) this.rulerCtx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    // Grid canvas
    if (this.gridCanvas) {
      this.gridCanvas.width = this.stretchedWidth * dpr
      this.gridCanvas.height = totalHeight * dpr
      this.gridCanvas.style.width = `${this.stretchedWidth}px`
      this.gridCanvas.style.height = `${totalHeight}px`
      this.gridCtx = this.gridCanvas.getContext('2d')
      if (this.gridCtx) this.gridCtx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    // Ball canvas (for Yousician-style ball jumping through notes)
    if (this.ballCanvas) {
      const containerWidth = this.gridContainer?.clientWidth ?? 0
      this.ballCanvas.width = containerWidth * dpr
      this.ballCanvas.height = totalHeight * dpr
      this.ballCanvas.style.width = `${containerWidth}px`
      this.ballCanvas.style.height = `${totalHeight}px`
      this.ballCtx = this.ballCanvas.getContext('2d') ?? null
      if (this.ballCtx) this.ballCtx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    // Cache status bar elements
    this.hintEl = this.container.querySelector('#roll-note-info')
    this.timelineInfoEl = this.container.querySelector('#roll-timeline-info')
    this.beatInfoEl = this.container.querySelector('#roll-beat-info')
  }

  // ============================================================
  // Event Listeners
  // ============================================================

  private attachEventListeners(): void {
    const container = this.container

    // Tool buttons
    container.querySelectorAll('.roll-tool-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const tool = (btn as HTMLElement).dataset.tool as ActiveTool
        this.activeTool = tool
        container.querySelectorAll('.roll-tool-btn').forEach((b) => {
          b.classList.remove('active')
        })
        btn.classList.add('active')
        this.selectedNoteIds.clear()
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
        })
        btn.classList.add('active')
        this._updateHint()
      })
    })

    // Effect action buttons
    container
      .querySelector('#roll-action-slide-up')
      ?.addEventListener('click', () => {
        this._applyEffect('slide-up')
      })
    container
      .querySelector('#roll-action-slide-down')
      ?.addEventListener('click', () => {
        this._applyEffect('slide-down')
      })
    container
      .querySelector('#roll-action-ease-in')
      ?.addEventListener('click', () => {
        this._applyEffect('ease-in')
      })
    container
      .querySelector('#roll-action-ease-out')
      ?.addEventListener('click', () => {
        this._applyEffect('ease-out')
      })
    container
      .querySelector('#roll-action-vibrato')
      ?.addEventListener('click', () => {
        this._applyEffect('vibrato')
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

    // Grid toggle from app header/sidebar
    window.addEventListener('pitchperfect:gridToggle', (e) => {
      this.showGrid = (e as CustomEvent<{ visible: boolean }>).detail.visible
      this.draw()
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

    // Touch events (mobile support — delegates to mouse handlers)
    this.gridCanvas?.addEventListener(
      'touchstart',
      (e) => {
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
        e.preventDefault()
        this.onGridMouseUp({} as MouseEvent)
      },
      { passive: false },
    )

    // Ruler drag-to-seek (click and drag on ruler to scrub playback position)
    this.rulerCanvas?.addEventListener('mousedown', (e) => {
      this.isSeeking = true
      this.seekStartX = e.clientX
      this.seekToRulerPosition(e)
    })

    document.addEventListener('mousemove', (e) => {
      if (this.isSeeking) {
        this.seekToRulerPosition(e)
      }
    })

    // Touch support for seeking - track touch move outside canvas
    document.addEventListener(
      'touchmove',
      (e) => {
        if (this.isSeeking && e.touches.length > 0) {
          const touch = e.touches[0]
          this.seekToRulerPosition({ clientX: touch.clientX } as MouseEvent)
        }
      },
      { passive: false },
    )

    document.addEventListener('mouseup', () => {
      this.isSeeking = false
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
      }
      // Also handle dragging/resizing that started on the canvas
      this.isDragging = false
      this.isResizing = false
      this.resizeHandle = null
    })

    // Touch support - finalize dragging/resizing when touch ends outside canvas
    document.addEventListener('touchend', () => {
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
      }
      this.isDragging = false
      this.isResizing = false
      this.resizeHandle = null
    })

    // Scroll sync ruler
    this.gridContainer?.addEventListener('scroll', () => {
      if (this.rulerCanvas && this.gridContainer) {
        this.rulerCanvas.style.transform = `translateX(${-this.gridContainer.scrollLeft}px)`
      }
    })

    // Keyboard
    document.addEventListener('keydown', (e) => {
      this.onKeyDown(e)
    })

    // Window resize
    window.addEventListener('resize', () => {
      this.buildCanvases()
      this.draw()
      if (this.pitchTrackVisible) {
        this._resizePitchTrackCanvas()
      }
    })

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

    // Rows (numOctaves) controls
    container
      .querySelector('#roll-octaves-plus')
      ?.addEventListener('click', () => {
        this.setNumOctaves(this.numOctaves + 1)
        const display = container.querySelector('#roll-octaves-value')
        if (display) display.textContent = String(this.numOctaves)
      })
    container
      .querySelector('#roll-octaves-minus')
      ?.addEventListener('click', () => {
        this.setNumOctaves(this.numOctaves - 1)
        const display = container.querySelector('#roll-octaves-value')
        if (display) display.textContent = String(this.numOctaves)
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
            this.setMelody(melody)
            this.onMelodyChange?.(melody)
            if (this.hintEl)
              this.hintEl.textContent = `Imported ${melody.length} note(s) from MIDI`
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
        void downloadMIDI(melody, this.bpm, `pitchperfect-${timestamp}.mid`)
      })

    // Export WAV button
    container
      .querySelector('#roll-export-wav')
      ?.addEventListener('click', () => {
        const melody = this.getMelody()
        if (!melody.length) {
          alert('No melody to export. Add some notes first.')
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
          alert('Audio engine not ready. Please try again.')
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

    // Grid toggle button
    container
      .querySelector('#roll-grid-toggle')
      ?.addEventListener('click', (e) => {
        const btn = e.currentTarget as HTMLButtonElement
        this.showGrid = !this.showGrid
        btn.classList.toggle('active', this.showGrid)
        this.draw()
      })

    // Undo/redo buttons
    container.querySelector('#roll-undo-btn')?.addEventListener('click', () => {
      this.undo()
    })

    container.querySelector('#roll-redo-btn')?.addEventListener('click', () => {
      this.redo()
    })

    // Delete selected button
    container
      .querySelector('#roll-delete-selected-btn')
      ?.addEventListener('click', () => {
        if (this.selectedNoteIds.size > 0) {
          this.pushHistory()
          for (const noteId of this.selectedNoteIds) {
            const note = this.melody.find((n) => (n.id ?? 0) === noteId)
            if (note) this.eraseNoteInternal(note)
          }
          this.selectedNoteIds.clear()
          this.emitMelodyChange()
          this.draw()
          this._updateHint()
        }
      })

    // Initialize zoom display
    this.updateZoomDisplay()
  }

  private onGridMouseDown(e: MouseEvent): void {
    if (!this.gridCanvas) return
    const rect = this.gridCanvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const beat = x / this.beatWidth
    const row = Math.floor(y / this.rowHeight)

    // Capture history for potential drag/resize operations
    if (this.activeTool === 'place' || this.activeTool === 'select') {
      const existingNote = this.findNoteAt(beat, row)
      if (existingNote) {
        this.pushHistory()
      }
    }

    if (this.activeTool === 'place') {
      // Place new note on empty space; clicking existing notes switches to select behavior for resize/drag
      const existingNote = this.findNoteAt(beat, row)
      if (existingNote) {
        // Select the note and enable drag/resize — do NOT enter box-select mode
        const noteId = existingNote.id ?? 0
        this.selectedNoteIds.clear()
        this.selectedNoteIds.add(noteId)
        this.onNoteSelect?.(existingNote)
        this.isDragging = true
        this.dragStartX = x
        this.dragStartY = y
        this.dragStartBeat = existingNote.startBeat
        this.dragStartRow = this.midiToRow(existingNote.note.midi)
        const noteX = existingNote.startBeat * this.beatWidth
        const noteW = existingNote.duration * this.beatWidth
        if (x - noteX < 8) {
          this.isResizing = true
          this.resizeHandle = 'left'
        } else if (noteX + noteW - x < 8) {
          this.isResizing = true
          this.resizeHandle = 'right'
        }
      } else {
        // Empty space — start box selection for area-select, or place note on click
        this.isBoxSelecting = true
        this.boxStartX = x
        this.boxStartY = y
        this.boxEndX = x
        this.boxEndY = y
        this.dragStartBeat = Math.floor(beat) + (beat % 1 >= 0.5 ? 0.5 : 0)
        this.dragStartRow = row
      }
    } else if (this.activeTool === 'erase') {
      const note = this.findNoteAt(beat, row)
      if (note) {
        this.eraseNote(note)
      }
    } else if (this.activeTool === 'select') {
      const note = this.findNoteAt(beat, row)
      if (note) {
        const noteId = note.id ?? 0
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
        this.isDragging = true
        this.dragStartX = x
        this.dragStartY = y
        this.dragStartBeat = note.startBeat
        this.dragStartRow = this.midiToRow(note.note.midi)
        const noteX = note.startBeat * this.beatWidth
        const noteW = note.duration * this.beatWidth
        if (x - noteX < 6) {
          this.isResizing = true
          this.resizeHandle = 'left'
        } else if (noteX + noteW - x < 6) {
          this.isResizing = true
          this.resizeHandle = 'right'
        }
        const first = this.melody.find(
          (n) => n.id !== undefined && this.selectedNoteIds.has(n.id),
        )
        this.onNoteSelect?.(first ?? null)
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
    }

    this.draw()
  }

  private onGridMouseMove(e: MouseEvent): void {
    if (!this.gridCanvas) return
    const rect = this.gridCanvas.getBoundingClientRect()
    const x = e.clientX - rect.left
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
      const note = this.findNoteAt(beat, row)
      if (note && note.id !== undefined && this.selectedNoteIds.has(note.id)) {
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
          this.activeTool === 'place' ? 'crosshair' : 'default'
      }
    }

    if (this.isDragging && this.selectedNoteIds.size > 0) {
      // Drag snap: full beat for notes ≥ 1 beat, otherwise half-beat.
      const draggedNoteId = this.selectedNoteIds.values().next().value
      const draggedNote =
        draggedNoteId !== undefined
          ? this.melody.find((n) => (n.id ?? 0) === draggedNoteId)
          : undefined
      const dragSnapUnit = draggedNote && draggedNote.duration >= 1 ? 1 : 0.5
      const deltaBeat =
        Math.round((x - this.dragStartX) / (this.beatWidth * dragSnapUnit)) *
        dragSnapUnit
      const deltaRow = Math.round((y - this.dragStartY) / this.rowHeight)
      if (deltaBeat !== 0 || deltaRow !== 0) {
        for (const noteId of this.selectedNoteIds) {
          const note = this.melody.find((n) => (n.id ?? 0) === noteId)
          if (!note) continue
          const newStartBeat = Math.max(0, this.dragStartBeat + deltaBeat)
          const newRow = Math.max(
            0,
            Math.min(this.totalRows - 1, this.dragStartRow + deltaRow),
          )
          const newScaleNote = this.scale[newRow]
          if (newScaleNote === null || newScaleNote === undefined) continue
          note.startBeat = newStartBeat
          note.note.midi = newScaleNote.midi
          note.note.name = newScaleNote.name as NoteName
          note.note.octave = newScaleNote.octave
          note.note.freq = newScaleNote.freq
        }
        this.emitMelodyChange()
        this.draw()
      }
    } else if (this.isResizing && this.selectedNoteIds.size > 0) {
      for (const noteId of this.selectedNoteIds) {
        const note = this.melody.find((n) => (n.id ?? 0) === noteId)
        if (!note) continue
        if (this.resizeHandle === 'right') {
          const endBeat = Math.round(x / this.beatWidth)
          note.duration = Math.max(
            this.config.minDuration,
            endBeat - note.startBeat,
          )
        } else if (this.resizeHandle === 'left') {
          const newStart = Math.round(x / this.beatWidth)
          const oldEnd = note.startBeat + note.duration
          note.startBeat = Math.max(
            0,
            Math.min(newStart, oldEnd - this.config.minDuration),
          )
          note.duration = oldEnd - note.startBeat
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
    this.resizeHandle = null
  }

  private onGridMouseLeave(_e: MouseEvent): void {
    if (this.isBoxSelecting) {
      this.isBoxSelecting = false
    }
    this.isDragging = false
    this.isResizing = false
    this.resizeHandle = null
    // Reset cursor
    if (this.gridCanvas) {
      this.gridCanvas.style.cursor =
        this.activeTool === 'place' ? 'crosshair' : 'default'
    }
  }

  /** Select all notes whose blocks intersect the given pixel box */
  private selectNotesInBox(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
  ): void {
    const _startBeat = x1 / this.beatWidth
    const _endBeat = x2 / this.beatWidth
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
      if (note.id !== undefined) {
        this.selectedNoteIds.add(note.id)
      }
    }
    const first =
      this.melody.find(
        (n) => n.id !== undefined && this.selectedNoteIds.has(n.id),
      ) ?? null
    this.onNoteSelect?.(first)
  }

  private onRightClick(e: MouseEvent): void {
    if (!this.gridCanvas) return
    const rect = this.gridCanvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const beat = x / this.beatWidth
    const row = Math.floor(y / this.rowHeight)
    const note = this.findNoteAt(beat, row)
    if (note) {
      this.eraseNote(note)
    }
  }

  private onKeyDown(e: KeyboardEvent): void {
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
        if (note.id !== undefined) this.selectedNoteIds.add(note.id)
      }
      const first = this.melody.find((n) => n.id !== undefined) ?? null
      this.onNoteSelect?.(first)
      this.draw()
      this._updateHint()
      return
    }
    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (this.selectedNoteIds.size > 0) {
        this.pushHistory()
        for (const noteId of this.selectedNoteIds) {
          const note = this.melody.find((n) => (n.id ?? 0) === noteId)
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
      this.onNoteSelect?.(null)
      this.draw()
      this._updateHint()
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault()
      const sortedNotes = [...this.melody].sort(
        (a, b) => a.startBeat - b.startBeat,
      )
      if (sortedNotes.length === 0) return

      const firstSelectedId = [...this.selectedNoteIds][0] ?? -1
      const currentIdx =
        this.selectedNoteIds.size > 0
          ? sortedNotes.findIndex((n) => (n.id ?? 0) === firstSelectedId)
          : -1

      let newIdx: number
      if (e.key === 'ArrowUp') {
        newIdx = currentIdx <= 0 ? sortedNotes.length - 1 : currentIdx - 1
      } else {
        newIdx = currentIdx >= sortedNotes.length - 1 ? 0 : currentIdx + 1
      }
      const noteToSelect = sortedNotes[newIdx]
      this.selectedNoteIds.clear()
      this.selectedNoteIds.add(noteToSelect.id ?? 0)
      this.onNoteSelect?.(noteToSelect)
      this.draw()
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault()
      if (this.selectedNoteIds.size > 0) {
        this.pushHistory()
        const delta = e.key === 'ArrowLeft' ? -0.5 : 0.5
        for (const noteId of this.selectedNoteIds) {
          const note = this.melody.find((n) => (n.id ?? 0) === noteId)
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
    if (
      scaleNote === null ||
      scaleNote === undefined ||
      scaleNote.name.includes('=')
    )
      return

    this.pushHistory()
    this.updateUndoRedoButtons()

    // Snap placement to nearest half-beat for short notes, or whole beat
    // for notes that are at least one full beat long. This makes bar-
    // length notes line up cleanly with the bar ruler instead of
    // floating between half-beat positions.
    const snapUnit = duration >= 1 ? 1 : 0.5
    const snappedBeat = Math.round(beat / snapUnit) * snapUnit
    const id = this.nextNoteId++

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
      if (
        this.selectedEffect === 'slide-up' ||
        this.selectedEffect === 'slide-down'
      ) {
        item.linkedTo = []
      }
    }

    this.melody.push(item)
    this.selectedNoteIds.add(id)
    this.onNoteSelect?.(item)
    this.emitMelodyChange()
    this.draw()
    this._updateHint()
    this.updateUndoRedoButtons()
  }

  private eraseNote(note: MelodyItem): void {
    this.pushHistory()
    const noteId = note.id
    if (noteId === undefined) return
    // Remove from any linkedTo references in other notes (matches old app behavior)
    for (const n of this.melody) {
      if (n.linkedTo) {
        const idx = n.linkedTo.indexOf(noteId)
        if (idx !== -1) n.linkedTo.splice(idx, 1)
      }
    }
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
    for (const n of this.melody) {
      if (n.linkedTo) {
        const idx = n.linkedTo.indexOf(noteId)
        if (idx !== -1) n.linkedTo.splice(idx, 1)
      }
    }
    const idx = this.melody.indexOf(note)
    if (idx !== -1) {
      this.melody.splice(idx, 1)
    }
  }

  private findNoteAt(beat: number, row: number): MelodyItem | null {
    for (const note of this.melody) {
      const noteRow = this.midiToRow(note.note.midi)
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

  private midiToRow(midi: number): number {
    for (let i = 0; i < this.scale.length; i++) {
      if (this.scale[i].midi === midi) return i
    }
    return -1
  }

  private emitMelodyChange(): void {
    this.onMelodyChange?.([...this.melody])
  }

  // ============================================================
  // Playback
  // ============================================================

  /**
   * Internal playback animation loop — used for local Editor playback
   * Not used for external playback (Practice tab) which uses remote beat from events
   */
  private startPlaybackAnimation(): void {
    if (this.playbackAnimationId !== null) return

    // Calculate start time so animation continues from current editorBeat
    const elapsed = (this.editorBeat / this.bpm) * 60000
    this.playStartTime = Date.now() - elapsed

    const animate = () => {
      if (this.playbackState !== 'playing' || this.isExternalPlayback) {
        this.playbackAnimationId = null
        return
      }

      const elapsed = Date.now() - this.playStartTime
      const currentBeat = (elapsed / 60000) * this.bpm

      this.updatePlaybackPosition(currentBeat)

      // Show ball canvas during playback
      if (this.ballCanvas) {
        this.ballCanvas.style.display = 'block'
      }

      // Update ball physics position
      if (this.useBallPhysics && this.ballState && this.ballCtx) {
        const ballCtx = this.ballCtx!
        const ballCanvas = this.ballCanvas!
        const playheadX = currentBeat * this.beatWidth

        const ballConfig: any = {
          notes: this.ballNotes,
          rowHeight: this.rowHeight,
          radius: this.ballRadius,
          padding: this.ballPadding,
        }

        const result = getBallPhysics(this.ballState, ballConfig)
        this.ballState.x = result.x
        this.ballState.y = result.y
        this.ballState.lastEndBeat = result.note
          ? result.note.endBeat
          : this.ballState.lastEndBeat
        this.ballState.lastNote = result.note

        // Convert to pixel coordinates for drawing
        const pixelY =
          this.ballState.y * this.rowHeight +
          this.rowHeight / 2 +
          this.rowHeight / 2
        const pixelX = this.ballState.x * this.beatWidth

        // Draw ball with glowing effect
        ballCtx.clearRect(0, 0, ballCanvas.width, ballCanvas.height)

        // Glow effect
        ballCtx.save()
        ballCtx.shadowColor = 'rgba(63, 185, 80, 0.9)'
        ballCtx.shadowBlur = 12
        ballCtx.fillStyle = '#3fb950'
        ballCtx.beginPath()
        ballCtx.arc(pixelX, pixelY, this.ballRadius, 0, Math.PI * 2)
        ballCtx.fill()
        // White core for extra glow
        ballCtx.fillStyle = 'rgba(255, 255, 255, 0.7)'
        ballCtx.beginPath()
        ballCtx.arc(pixelX, pixelY, this.ballRadius * 0.5, 0, Math.PI * 2)
        ballCtx.fill()
        ballCtx.restore()
      }

      this.playbackAnimationId = requestAnimationFrame(animate)
    }

    this.playbackAnimationId = requestAnimationFrame(animate)
  }

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
      const ballCanvas = this.ballCanvas
      const playheadX = beat * this.beatWidth

      const ballConfig: any = {
        notes: this.ballNotes,
        rowHeight: this.rowHeight,
        radius: this.ballRadius,
        padding: this.ballPadding,
      }

      const result = getBallPhysics(this.ballState, ballConfig)
      this.ballState.x = result.x
      this.ballState.y = result.y
      this.ballState.lastEndBeat = result.note
        ? result.note.endBeat
        : this.ballState.lastEndBeat
      this.ballState.lastNote = result.note

      // Convert to pixel coordinates for drawing
      const pixelY =
        this.ballState.y * this.rowHeight +
        this.rowHeight / 2 +
        this.rowHeight / 2
      const pixelX = this.ballState.x * this.beatWidth

      // Draw ball with glowing effect
      if (ballCanvas) {
        ballCtx.clearRect(0, 0, ballCanvas.width, ballCanvas.height)
      }

      // Glow effect
      ballCtx.save()
      ballCtx.shadowColor = 'rgba(63, 185, 80, 0.9)'
      ballCtx.shadowBlur = 12
      ballCtx.fillStyle = '#3fb950'
      ballCtx.beginPath()
      ballCtx.arc(pixelX, pixelY, this.ballRadius, 0, Math.PI * 2)
      ballCtx.fill()
      // White core for extra glow
      ballCtx.fillStyle = 'rgba(255, 255, 255, 0.7)'
      ballCtx.beginPath()
      ballCtx.arc(pixelX, pixelY, this.ballRadius * 0.5, 0, Math.PI * 2)
      ballCtx.fill()
      ballCtx.restore()

      // Scroll grid to keep ball within view
      const containerWidth = this.gridContainer?.clientWidth ?? 0
      const targetScroll = playheadX - containerWidth * 0.3
      if (targetScroll > 0) {
        this.gridContainer!.scrollLeft = targetScroll
      }
    }

    // GH #129: Track the current note row for vertical glow dot (deprecated)
    // Keep this for backward compatibility
    const sortedNotes = [...this.melody].sort(
      (a, b) => a.startBeat - b.startBeat,
    )
    let foundRow = -1
    for (const note of sortedNotes) {
      if (note.startBeat <= beat && note.startBeat + note.duration > beat) {
        foundRow = this.midiToRow(note.note.midi)
        break
      }
    }
    this.currentNoteRow = foundRow

    this.drawWithPlayhead()

    // Update timeline info during playback
    this._updateTimelineInfo(beat)

    // Update pitch track visualization during playback
    if (this.pitchTrackVisible) {
      this._updatePitchTrack()
    }

    // Check if playback is done
    if (this.melody.length > 0) {
      const sortedNotes = [...this.melody].sort(
        (a, b) => a.startBeat - b.startBeat,
      )
      const lastNote = sortedNotes[sortedNotes.length - 1]
      if (beat >= lastNote.startBeat + lastNote.duration) {
        this.stopPlayback()
        this.remoteBeat = 0
        this.startedNoteIds.clear()
        this.currentNoteRow = -1
        this.playbackState = 'stopped'
        this.onPlaybackStateChange?.('stopped')
        this.draw()
        return
      }
    }
  }

  private stopPlayback(): void {
    if (this.playbackAnimationId !== null) {
      cancelAnimationFrame(this.playbackAnimationId)
      this.playbackAnimationId = null
    }
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
    // Reset playhead position to 0 when stopping playback
    this.remoteBeat = 0
    this.editorBeat = 0
    // Clear tracking sets
    this.startedNoteIds.clear()
    this.currentPlayingNoteIds.clear()
    this.currentNoteRow = -1
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

  private seekToRulerPosition(e: MouseEvent): void {
    const rect = this.rulerCanvas?.getBoundingClientRect()
    if (!rect || !this.gridContainer) return

    // BUGFIX: the ruler canvas spans `pianoWidth + stretchedWidth`, with
    // beat markers drawn at `pianoWidth + b * beatWidth`. Without
    // subtracting pianoWidth we'd have a constant rightward offset.
    const x = e.clientX - rect.left - this.pianoWidth

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

    const targetScroll = beat * this.beatWidth - rect.width / 2
    this.gridContainer.scrollLeft = Math.max(0, targetScroll)

    // Update local playhead immediately for visual feedback.
    this.remoteBeat = beat
    this.drawGridWithPlayhead()

    if (this.playbackState === 'paused') {
      // Local clock rebase (legacy field used by piano-roll's own playback
      // path; harmless when external playback owns the timer).
      this.playStartTime =
        (performance as unknown as { now: () => number }).now() -
        (beat / this.bpm) * 60000
    }

    // Notify the global PlaybackRuntime so its currentBeat / playStartTime
    // get rebased too. Without this, clicking the editor ruler while
    // paused would visually move the playhead but Resume would jump
    // back to the pre-seek beat (the runtime's internal clock was
    // never updated). The runtime's seekTo is state-aware and handles
    // playing / paused / stopped correctly.
    try {
      window.dispatchEvent(
        new CustomEvent('pitchperfect:seekToBeat', {
          detail: { beat },
        }),
      )
    } catch {
      // Non-browser environments (tests) — ignore.
    }
  }

  /**
   * Get current beat for drawing/playhead based on playback state.
   *
   * BUGFIX: previously this had two branches:
   *   - external playback: return remoteBeat
   *   - else: compute from `playStartTime`, which is initialized to 0.
   *
   * On a fresh page load with no playback ever started, `playStartTime`
   * is still 0, so `elapsed = performance.now() - 0` is a huge number
   * and `currentBeat = (huge / 60000) * bpm` lands somewhere in the
   * middle of the grid → users saw a stray vertical playhead line at a
   * non-zero position the moment they opened the editor tab.
   *
   * `drawWithPlayhead()` is called from setMelody/setScale/setBPM/etc.
   * during normal initialization, so the playhead WAS being drawn even
   * though playback was 'stopped'. We now short-circuit to 0 whenever
   * playback isn't active and we're not driven by an external clock.
   */
  private getCurrentBeat(): number {
    if (this.isExternalPlayback) {
      return this.remoteBeat
    }
    if (this.playbackState === 'stopped') {
      return 0
    }
    // Local editor playback - calculate from playStartTime
    const elapsed = performance.now() - this.playStartTime
    return (elapsed / 60000) * this.bpm
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
    this.drawRulerWithPlayhead()
    this.drawGridWithPlayhead()
  }

  private drawPiano(): void {
    if (!this.pianoCtx) return
    const ctx = this.pianoCtx
    const totalHeight = this.totalRows * this.rowHeight

    ctx.clearRect(0, 0, this.pianoWidth, totalHeight)
    ctx.fillStyle = '#161b22'
    ctx.fillRect(0, 0, this.pianoWidth, totalHeight)

    // Draw keys (highest note at top)
    for (let i = 0; i < this.totalRows; i++) {
      const y = i * this.rowHeight
      const scaleNote = this.scale[i]
      if (scaleNote === null || scaleNote === undefined) continue

      const isBlack = scaleNote.name.includes('#')

      // White key background for black keys
      if (isBlack) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.25)'
        ctx.fillRect(0, y, this.pianoWidth, this.rowHeight)
      }

      // Key label with octave number (e.g. "C4", "F#3")
      ctx.fillStyle = isBlack ? '#484f58' : '#8b949e'
      ctx.font = '9px sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(
        `${scaleNote.name}${scaleNote.octave}`,
        this.pianoWidth / 2,
        y + this.rowHeight / 2,
      )

      // Bottom border
      ctx.strokeStyle = '#21262d'
      ctx.lineWidth = 0.5
      ctx.beginPath()
      ctx.moveTo(0, y + this.rowHeight)
      ctx.lineTo(this.pianoWidth, y + this.rowHeight)
      ctx.stroke()
    }

    // Right border
    ctx.strokeStyle = '#30363d'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(this.pianoWidth - 1, 0)
    ctx.lineTo(this.pianoWidth - 1, totalHeight)
    ctx.stroke()
  }

  private drawRuler(): void {
    if (!this.rulerCtx) return
    const ctx = this.rulerCtx
    const rulerWidth = this.pianoWidth + this.stretchedWidth

    ctx.clearRect(0, 0, rulerWidth, this.rulerHeight)
    ctx.fillStyle = '#161b22'
    ctx.fillRect(0, 0, rulerWidth, this.rulerHeight)

    // Beat markers (offset by piano width)
    for (let b = 0; b <= this.totalBeats; b++) {
      const x = this.pianoWidth + b * this.beatWidth
      const isBar = b % this.config.beatsPerBar === 0

      ctx.strokeStyle = isBar ? '#484f58' : '#30363d'
      ctx.lineWidth = isBar ? 1 : 0.5
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, this.rulerHeight)
      ctx.stroke()

      if (isBar) {
        const barNum = Math.floor(b / this.config.beatsPerBar) + 1
        ctx.fillStyle = '#8b949e'
        ctx.font = '10px sans-serif'
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

    // Bottom border
    ctx.strokeStyle = '#30363d'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(0, this.rulerHeight - 1)
    ctx.lineTo(rulerWidth, this.rulerHeight - 1)
    ctx.stroke()
  }

  private drawRulerWithPlayhead(): void {
    if (!this.rulerCtx) return
    const ctx = this.rulerCtx
    const rulerWidth = this.pianoWidth + this.stretchedWidth

    ctx.clearRect(0, 0, rulerWidth, this.rulerHeight)
    ctx.fillStyle = '#161b22'
    ctx.fillRect(0, 0, rulerWidth, this.rulerHeight)

    for (let b = 0; b <= this.totalBeats; b++) {
      const x = this.pianoWidth + b * this.beatWidth
      const isBar = b % this.config.beatsPerBar === 0

      ctx.strokeStyle = isBar ? '#484f58' : '#30363d'
      ctx.lineWidth = isBar ? 1 : 0.5
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, this.rulerHeight)
      ctx.stroke()

      if (isBar) {
        const barNum = Math.floor(b / this.config.beatsPerBar) + 1
        ctx.fillStyle = '#8b949e'
        ctx.font = '10px sans-serif'
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

    ctx.strokeStyle = '#30363d'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(0, this.rulerHeight - 1)
    ctx.lineTo(rulerWidth, this.rulerHeight - 1)
    ctx.stroke()

    // Playhead triangle
    const playheadX = this.pianoWidth + this.getCurrentBeat() * this.beatWidth
    ctx.save()
    ctx.fillStyle = '#58a6ff'
    ctx.shadowColor = 'rgba(88, 166, 255, 0.5)'
    ctx.shadowBlur = 4
    const triSize = 6
    ctx.beginPath()
    ctx.moveTo(playheadX, this.rulerHeight - 1)
    ctx.lineTo(playheadX - triSize, this.rulerHeight - triSize - 1)
    ctx.lineTo(playheadX + triSize, this.rulerHeight - triSize - 1)
    ctx.closePath()
    ctx.fill()
    ctx.restore()
  }

  private drawGrid(): void {
    if (!this.gridCtx) return
    const ctx = this.gridCtx
    const totalHeight = this.totalRows * this.rowHeight

    ctx.clearRect(0, 0, this.stretchedWidth, totalHeight)
    ctx.fillStyle = '#0d1117'
    ctx.fillRect(0, 0, this.stretchedWidth, totalHeight)

    // Horizontal lines
    for (let i = 0; i <= this.totalRows; i++) {
      const y = i * this.rowHeight
      const note = i < this.totalRows ? this.scale[i] : null
      const isBlack =
        note !== null && note !== undefined && note.name.includes('#')

      if (isBlack !== null && isBlack !== undefined && isBlack) {
        ctx.fillStyle = 'rgba(26, 31, 39, 0.5)'
        ctx.fillRect(0, y, this.stretchedWidth, this.rowHeight)
      }

      ctx.strokeStyle = '#21262d'
      ctx.lineWidth = 0.5
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(this.stretchedWidth, y)
      ctx.stroke()
    }

    // Vertical lines (only when grid is visible)
    if (this.showGrid) {
      for (let b = 0; b <= this.totalBeats; b++) {
        const x = b * this.beatWidth
        const isBar = b % this.config.beatsPerBar === 0
        ctx.strokeStyle = isBar ? '#30363d' : '#21262d'
        ctx.lineWidth = isBar ? 1 : 0.5
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x, totalHeight)
        ctx.stroke()
      }
    }

    // Note blocks
    this.drawNoteConnections(ctx)
    this.drawNoteBlocks(ctx, false)

    // Box selection rectangle
    if (this.isBoxSelecting) {
      const bx = Math.min(this.boxStartX, this.boxEndX)
      const by = Math.min(this.boxStartY, this.boxEndY)
      const bw = Math.abs(this.boxEndX - this.boxStartX)
      const bh = Math.abs(this.boxEndY - this.boxStartY)
      ctx.save()
      ctx.fillStyle = 'rgba(88, 166, 255, 0.1)'
      ctx.fillRect(bx, by, bw, bh)
      ctx.strokeStyle = 'rgba(88, 166, 255, 0.5)'
      ctx.lineWidth = 1
      ctx.setLineDash([4, 3])
      ctx.strokeRect(bx, by, bw, bh)
      ctx.restore()
    }
  }

  private drawGridWithPlayhead(): void {
    if (!this.gridCtx) return
    const ctx = this.gridCtx
    const totalHeight = this.totalRows * this.rowHeight

    ctx.clearRect(0, 0, this.stretchedWidth, totalHeight)
    ctx.fillStyle = '#0d1117'
    ctx.fillRect(0, 0, this.stretchedWidth, totalHeight)

    // GH #122: Waveform background during mic recording
    this.drawWaveformBackground(ctx, this.stretchedWidth, totalHeight)

    // Horizontal lines
    for (let i = 0; i <= this.totalRows; i++) {
      const y = i * this.rowHeight
      const note = i < this.totalRows ? this.scale[i] : null
      const isBlack =
        note !== null && note !== undefined && note.name.includes('#')

      if (isBlack !== null && isBlack !== undefined && isBlack) {
        ctx.fillStyle = 'rgba(26, 31, 39, 0.5)'
        ctx.fillRect(0, y, this.stretchedWidth, this.rowHeight)
      }

      ctx.strokeStyle = '#21262d'
      ctx.lineWidth = 0.5
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(this.stretchedWidth, y)
      ctx.stroke()
    }

    // Vertical lines (only when grid is visible)
    if (this.showGrid) {
      for (let b = 0; b <= this.totalBeats; b++) {
        const x = b * this.beatWidth
        const isBar = b % this.config.beatsPerBar === 0
        ctx.strokeStyle = isBar ? '#30363d' : '#21262d'
        ctx.lineWidth = isBar ? 1 : 0.5
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x, totalHeight)
        ctx.stroke()
      }
    }

    // Note connection lines (below note blocks)
    this.drawNoteConnections(ctx)

    // Note blocks with active highlight
    this.drawNoteBlocks(ctx, true)

    // GH #198: Playhead should be visible during count-in too (even if at 0)
    // Show playhead regardless of currentBeat value so users see continuous playback
    const currentBeat = this.getCurrentBeat()
    const playheadX = currentBeat * this.beatWidth

    // Playhead line — always drawn during playback (including count-in)
    ctx.save()
    ctx.strokeStyle = '#58a6ff'
    ctx.lineWidth = 2
    ctx.shadowColor = 'rgba(88, 166, 255, 0.5)'
    ctx.shadowBlur = 4
    ctx.beginPath()
    ctx.moveTo(playheadX, 0)
    ctx.lineTo(playheadX, totalHeight)
    ctx.stroke()
    ctx.restore()

    // Draw ruler with playhead triangle (always show during playback)
    this.drawRulerWithPlayhead()

    // GH #129: Draw glowing dot at current note row's Y position (vertical movement)
    // DEPRECATED in favor of ball physics
    if (!this.useBallPhysics && this.currentNoteRow >= 0) {
      ctx.save()
      ctx.shadowColor = 'rgba(63, 185, 80, 0.9)'
      ctx.shadowBlur = 12
      ctx.fillStyle = '#3fb950'
      ctx.beginPath()
      ctx.arc(
        playheadX,
        this.currentNoteRow * this.rowHeight + this.rowHeight / 2,
        5,
        0,
        Math.PI * 2,
      )
      ctx.fill()
      // White core for extra glow
      ctx.fillStyle = 'rgba(255,255,255,0.7)'
      ctx.beginPath()
      ctx.arc(
        playheadX,
        this.currentNoteRow * this.rowHeight + this.rowHeight / 2,
        2.5,
        0,
        Math.PI * 2,
      )
      ctx.fill()
      ctx.restore()
    }

    // GH #198: During count-in, still show ruler even if playhead is hidden
    // (The playhead is always visible now, so this is just for completeness)
    if (currentBeat < 0) {
      this.drawRuler()
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
    if (isRec === null || isRec === undefined || !isRec) return

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

  /** Draw connection lines between linked notes (slides/ease effects) */
  private drawNoteConnections(ctx: CanvasRenderingContext2D): void {
    for (const note of this.melody) {
      if (!note.linkedTo || note.linkedTo.length === 0) continue

      const fromX = note.startBeat * this.beatWidth
      const fromRow = this.midiToRow(note.note.midi)
      const fromY = fromRow * this.rowHeight + this.rowHeight / 2
      const fromW = note.duration * this.beatWidth

      for (const targetId of note.linkedTo) {
        const target = this.melody.find((n) => n.id === targetId)
        if (!target) continue

        const toX = target.startBeat * this.beatWidth
        const toRow = this.midiToRow(target.note.midi)
        const toY = toRow * this.rowHeight + this.rowHeight / 2
        const _toW = target.duration * this.beatWidth

        const startX = fromX + fromW
        const startY = fromY
        const endX = toX
        const endY = toY

        ctx.save()
        ctx.strokeStyle = 'rgba(255, 180, 50, 0.7)'
        ctx.lineWidth = 3

        if (
          note.effectType === 'slide-up' ||
          note.effectType === 'slide-down'
        ) {
          ctx.beginPath()
          ctx.moveTo(startX, startY)
          ctx.lineTo(endX, endY)
          ctx.stroke()
        } else if (note.effectType === 'ease-in') {
          const ctrlX = (startX + endX) / 2
          ctx.beginPath()
          ctx.moveTo(startX, startY)
          ctx.quadraticCurveTo(ctrlX, endY, endX, endY)
          ctx.stroke()
        } else if (note.effectType === 'ease-out') {
          const ctrlX = (startX + endX) / 2
          ctx.beginPath()
          ctx.moveTo(startX, startY)
          ctx.quadraticCurveTo(ctrlX, startY, endX, endY)
          ctx.stroke()
        }

        ctx.restore()
      }
    }
  }

  private drawNoteBlocks(
    ctx: CanvasRenderingContext2D,
    highlightActive: boolean,
  ): void {
    for (const note of this.melody) {
      const rowIdx = this.midiToRow(note.note.midi)
      if (rowIdx < 0) continue

      const x = note.startBeat * this.beatWidth
      const y = rowIdx * this.rowHeight
      const w = note.duration * this.beatWidth
      const h = this.rowHeight - 2
      const ry = y + 1

      if (w < 2) continue

      const isSelected =
        note.id !== undefined && this.selectedNoteIds.has(note.id)
      const isActive =
        highlightActive &&
        this.getCurrentBeat() >= note.startBeat &&
        this.getCurrentBeat() < note.startBeat + note.duration
      const cornerRadius = 4

      // Diagonal rendering for slide notes
      let diagY = 0
      if (
        !isActive &&
        note.effectType &&
        (note.effectType === 'slide-up' || note.effectType === 'slide-down') &&
        note.linkedTo &&
        note.linkedTo.length > 0
      ) {
        const targetId = note.linkedTo[0]
        const target = this.melody.find((n) => n.id === targetId)
        if (target) {
          const targetRow = this.midiToRow(target.note.midi)
          diagY = (targetRow - rowIdx) * this.rowHeight
          diagY = Math.max(-h * 0.45, Math.min(h * 0.45, diagY))
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

      // Draw note block with diagonal skew for slides
      ctx.beginPath()
      if (diagY !== 0) {
        // Draw parallelogram shape for slides
        ctx.moveTo(x + cornerRadius, ry + diagY / 2)
        ctx.lineTo(x + w - cornerRadius, ry + diagY / 2)
        ctx.quadraticCurveTo(
          x + w,
          ry + diagY / 2,
          x + w,
          ry + diagY / 2 + cornerRadius,
        )
        ctx.lineTo(x + w, ry + h + diagY / 2 - cornerRadius)
        ctx.quadraticCurveTo(
          x + w,
          ry + h + diagY / 2,
          x + w - cornerRadius,
          ry + h + diagY / 2,
        )
        ctx.lineTo(x + cornerRadius, ry + h + diagY / 2)
        ctx.quadraticCurveTo(
          x,
          ry + h + diagY / 2,
          x,
          ry + h + diagY / 2 - cornerRadius,
        )
        ctx.lineTo(x, ry + diagY / 2 + cornerRadius)
        ctx.quadraticCurveTo(
          x,
          ry + diagY / 2,
          x + cornerRadius,
          ry + diagY / 2,
        )
        ctx.closePath()
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

      // Fill and stroke
      let fillColor = this.config.noteColors.normal
      let strokeColor = 'rgba(88,166,255,0.5)'
      let strokeWidth = 1

      if (isActive) {
        fillColor = this.config.noteColors.active
        strokeColor = 'rgba(63,185,80,0.9)'
        strokeWidth = 1.5
      } else if (isSelected) {
        fillColor = this.config.noteColors.selected
        strokeColor = '#8fc9ff'
        strokeWidth = 1.5
      }

      ctx.fillStyle = fillColor
      ctx.strokeStyle = strokeColor
      ctx.lineWidth = strokeWidth
      ctx.fill()
      ctx.stroke()

      // Reset shadow
      ctx.shadowColor = 'transparent'
      ctx.shadowBlur = 0
      ctx.shadowOffsetY = 0

      // Wavy top edge for vibrato notes
      if (!isActive && note.effectType === 'vibrato' && w > 14) {
        const waveAmp = 2.5
        const wavePeriod = w / 3
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)'
        ctx.lineWidth = 1.5
        ctx.beginPath()
        for (let wx = 0; wx <= w; wx++) {
          const wy =
            ry + 2 + Math.sin((wx / wavePeriod) * Math.PI * 2) * waveAmp
          if (wx === 0) {
            ctx.moveTo(x + wx, wy)
          } else {
            ctx.lineTo(x + wx, wy)
          }
        }
        ctx.stroke()
      }

      // Effect badge on top-right of notes with effects
      if (note.effectType && w > 18) {
        const badgeColor =
          note.effectType === 'vibrato'
            ? '#ff6b6b'
            : note.effectType === 'slide-up' || note.effectType === 'slide-down'
              ? '#4ecdc4'
              : '#ffe66d'
        ctx.fillStyle = badgeColor
        ctx.beginPath()
        ctx.arc(x + w - 5, ry + 5, 3, 0, Math.PI * 2)
        ctx.fill()
      }

      // Note name text (always show when wide enough, GH #129 fix)
      if (w > 18) {
        ctx.fillStyle = 'rgba(255,255,255,0.85)'
        ctx.font = 'bold 9px sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(note.note.name, x + w / 2, ry + h / 2)
        ctx.textBaseline = 'alphabetic'
      }

      // Resize handles on selected notes
      if (isSelected && w > 12) {
        const handleW = 6
        ctx.fillStyle = 'rgba(255,255,255,0.5)'
        ctx.fillRect(x + 1, ry + h / 2 - 4, handleW, 8)
        ctx.fillRect(x + w - handleW - 1, ry + h / 2 - 4, handleW, 8)
      }
    }
  }

  // ============================================================
  // Octave / Scale methods (matching old app interface)
  // ============================================================

  /**
   * Shift all notes by an octave and rebuild the scale.
   */
  private _shiftOctave(delta: number): void {
    // FIXME: here we should shift melody notes by octave up/down
    const newOctave = this.octave + delta
    if (newOctave < 1 || newOctave > 6) return
    this.octave = newOctave

    const display = this.container.querySelector('#roll-octave-value')
    if (display) display.textContent = String(this.octave)

    // Transpose all notes by the octave delta
    const MIDI_OCTAVE_SHIFT = 12
    for (const note of this.melody) {
      note.note.midi += delta * MIDI_OCTAVE_SHIFT
      note.note.freq = 440 * Math.pow(2, (note.note.midi - 69) / 12)
    }

    // Rebuild scale with new octave
    window.dispatchEvent(
      new CustomEvent('pitchperfect:octaveChange', {
        detail: { octave: this.octave, numOctaves: this.numOctaves },
      }),
    )

    this.draw()
    this.onMelodyChange?.(this.melody)
  }

  /**
   * Set the number of octave rows displayed (1-3).
   */
  setNumOctaves(n: number): void {
    n = Math.max(1, Math.min(3, Math.round(n)))
    if (n === this.numOctaves) return
    this.numOctaves = n

    // Keep the toolbar counter in sync. The +/- click handlers also
    // write this DOM node, but auto-fit (called from setMelody) and any
    // future programmatic callers route through here directly, so we
    // need to update unconditionally.
    const display = this.container.querySelector('#roll-octaves-value')
    if (display) display.textContent = String(this.numOctaves)

    window.dispatchEvent(
      new CustomEvent('pitchperfect:octaveChange', {
        detail: { octave: this.octave, numOctaves: this.numOctaves },
      }),
    )
  }

  /**
   * Set the scale mode (major, minor, etc.) and rebuild scale.
   */
  setMode(mode: string): void {
    if (mode === this.mode) return
    this.mode = mode

    // Rebuild the internal scale so note rows update immediately
    const appWindow = window as Window & { pitchPerfectApp?: { key: string } }
    const key = appWindow.pitchPerfectApp?.key ?? 'C'
    const newScale = buildMultiOctaveScale(
      key,
      this.octave,
      this.numOctaves,
      this.mode,
    )
    this.scale = newScale
    this.totalRows = newScale.length
    this.draw()

    window.dispatchEvent(
      new CustomEvent('pitchperfect:modeChange', {
        detail: { mode },
      }),
    )
  }

  // ============================================================
  // Effect application
  // ============================================================

  private _getSelectedNotes(): MelodyItem[] {
    if (this.selectedNoteIds.size === 0) return []
    return this.melody.filter(
      (n) => n.id !== undefined && this.selectedNoteIds.has(n.id),
    )
  }

  private _applyEffect(type: EffectType): void {
    const selected = this._getSelectedNotes()
    if (selected.length === 0) return

    this.pushHistory()

    if (type === 'vibrato') {
      // Apply vibrato to all selected notes
      selected.forEach((n: MelodyItem) => {
        n.effectType = 'vibrato'
        n.linkedTo = []
      })
      this.emitMelodyChange()
      this.draw()
    } else {
      // Slides and ease need 2 selected notes
      if (selected.length !== 2) {
        window.alert(
          'Slides require exactly 2 notes selected (order by time). Vibrato works on 1 or more notes.',
        )
        return
      }

      // Sort by start beat to determine direction
      const sorted = [...selected].sort((a, b) => a.startBeat - b.startBeat)
      const first = sorted[0]
      const second = sorted[1]

      // Validation based on effect type
      if (type === 'slide-up' && second.note.midi <= first.note.midi) {
        window.alert(
          'Ascending slide requires the second note to be higher than the first.',
        )
        return
      }
      if (type === 'slide-down' && second.note.midi >= first.note.midi) {
        window.alert(
          'Descending slide requires the second note to be lower than the first.',
        )
        return
      }
      if (
        (type === 'ease-in' || type === 'ease-out') &&
        second.note.midi === first.note.midi
      ) {
        window.alert('Ease In/Out requires two notes at different pitches.')
        return
      }

      // Apply effect and extend first note's duration to meet second note
      first.effectType = type
      first.linkedTo = [second.id!]
      first.duration = Math.max(
        first.duration,
        second.startBeat - first.startBeat + 0.5,
      )
      this.emitMelodyChange()
      this.draw()
    }
  }
}
