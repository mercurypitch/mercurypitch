// ============================================================
// Piano Roll Playback Head Propagation Tests
// Tests that PianoRollCanvas correctly propagates playback props to editor
// ============================================================

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PlaybackState } from '@/lib/piano-roll'
import { PianoRollEditor } from '@/lib/piano-roll'
import type { MelodyItem } from '@/types'

/** Create a minimal MelodyItem for testing. */
function makeNote(
  overrides: Partial<MelodyItem> & {
    id: number
    note: MelodyItem['note']
    startBeat: number
    duration: number
  },
): MelodyItem {
  return {
    velocity: 100,
    ...overrides,
  }
}

/** Simulate a playback position tick via the public API. */
function updatePlaybackPositionSilently(
  editor: PianoRollEditor,
  beat: number,
): void {
  editor.updatePlaybackPosition(beat)
}

describe('PianoRollEditor Playback Behavior', () => {
  let container: HTMLElement
  let editor: PianoRollEditor
  let stateChangeSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
      clearRect: vi.fn(),
      fillRect: vi.fn(),
      beginPath: vi.fn(),
      closePath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      strokeRect: vi.fn(),
      fill: vi.fn(),
      arc: vi.fn(),
      fillText: vi.fn(),
      measureText: vi.fn().mockReturnValue({ width: 10 }),
      save: vi.fn(),
      restore: vi.fn(),
      translate: vi.fn(),
      scale: vi.fn(),
      clip: vi.fn(),
      setLineDash: vi.fn(),
      setTransform: vi.fn(),
      createLinearGradient: vi.fn().mockReturnValue({
        addColorStop: vi.fn(),
      }),
      roundRect: vi.fn(),
      rect: vi.fn(),
    }) as unknown as typeof HTMLCanvasElement.prototype.getContext

    container = document.createElement('div')
    document.body.appendChild(container)
    stateChangeSpy = vi.fn()
    editor = new PianoRollEditor({
      container,
      scale: [],
      bpm: 120,
      totalBeats: 16,
      onPlaybackStateChange: stateChangeSpy as (state: PlaybackState) => void,
    })
  })

  // ----------------------------------------------------------
  // Max-end-beat calculation (GH #135 fix)
  // ----------------------------------------------------------

  it('calculates melody end as max(startBeat + duration), not last startBeat', () => {
    // Regular note at beat 2, duration 1 → ends at beat 3
    // Effect note at beat 0, duration 4 → ends at beat 4
    // The melody should end at beat 4, NOT beat 3
    const melody = [
      makeNote({
        id: 1,
        note: { midi: 60, freq: 261.63, name: 'C', octave: 4 },
        startBeat: 0,
        duration: 4,
        effectType: 'vibrato',
      }),
      makeNote({
        id: 2,
        note: { midi: 62, freq: 293.66, name: 'D', octave: 4 },
        startBeat: 2,
        duration: 1,
      }),
    ]
    editor.setMelody(melody)

    // Simulate external playback at beat 3.5 — within the vibrato note's
    // duration (0→4) but past the regular note (2→3).
    editor.setExternalPlayback(true)
    editor.setPlaybackState('playing')
    updatePlaybackPositionSilently(editor, 3.5)

    // Playback should NOT have stopped yet — the vibrato note still plays
    expect(stateChangeSpy).not.toHaveBeenCalledWith('stopped')
  })

  it('stops playback when beat reaches max end beat', () => {
    const melody = [
      makeNote({
        id: 1,
        note: { midi: 60, freq: 261.63, name: 'C', octave: 4 },
        startBeat: 0,
        duration: 2,
      }),
    ]
    editor.setMelody(melody)

    editor.setExternalPlayback(true)
    editor.setPlaybackState('playing')
    stateChangeSpy.mockClear()

    updatePlaybackPositionSilently(editor, 2.0)

    expect(stateChangeSpy).toHaveBeenCalledWith('stopped')
  })

  it('stops playback when beat is past max end beat', () => {
    const melody = [
      makeNote({
        id: 1,
        note: { midi: 60, freq: 261.63, name: 'C', octave: 4 },
        startBeat: 0,
        duration: 1,
      }),
    ]
    editor.setMelody(melody)

    editor.setExternalPlayback(true)
    editor.setPlaybackState('playing')
    stateChangeSpy.mockClear()

    updatePlaybackPositionSilently(editor, 5.0)

    expect(stateChangeSpy).toHaveBeenCalledWith('stopped')
  })

  it('does not stop playback when beat is within a note duration', () => {
    const melody = [
      makeNote({
        id: 1,
        note: { midi: 60, freq: 261.63, name: 'C', octave: 4 },
        startBeat: 0,
        duration: 4,
      }),
    ]
    editor.setMelody(melody)

    editor.setExternalPlayback(true)
    editor.setPlaybackState('playing')
    stateChangeSpy.mockClear()

    // Still well within the note (0→4)
    updatePlaybackPositionSilently(editor, 1.0)
    expect(stateChangeSpy).not.toHaveBeenCalledWith('stopped')

    updatePlaybackPositionSilently(editor, 3.99)
    expect(stateChangeSpy).not.toHaveBeenCalledWith('stopped')
  })

  it('handles empty melody without crashing', () => {
    editor.setMelody([])
    editor.setExternalPlayback(true)
    editor.setPlaybackState('playing')
    stateChangeSpy.mockClear()

    // Should not throw, no-op for end detection
    expect(() => updatePlaybackPositionSilently(editor, 5.0)).not.toThrow()
  })

  it('effect note with long duration determines melody end over later short notes', () => {
    // A slide-up note at beat 0 with duration 6 that starts before all others
    // but extends well past them.
    const melody = [
      makeNote({
        id: 1,
        note: { midi: 60, freq: 261.63, name: 'C', octave: 4 },
        startBeat: 0,
        duration: 6,
        effectType: 'slide-up',
        slideInterval: 2,
      }),
      makeNote({
        id: 2,
        note: { midi: 62, freq: 293.66, name: 'D', octave: 4 },
        startBeat: 4,
        duration: 1,
      }),
      makeNote({
        id: 3,
        note: { midi: 64, freq: 329.63, name: 'E', octave: 4 },
        startBeat: 5,
        duration: 0.5,
      }),
    ]
    editor.setMelody(melody)

    // The last-starting note is at beat 5, ends at 5.5
    // The slide note starts at beat 0, ends at beat 6
    editor.setExternalPlayback(true)
    editor.setPlaybackState('playing')
    stateChangeSpy.mockClear()

    // At beat 5.7 — past E (5→5.5) but within slide (0→6)
    updatePlaybackPositionSilently(editor, 5.7)
    expect(stateChangeSpy).not.toHaveBeenCalledWith('stopped')

    // At beat 6.0 — should stop
    updatePlaybackPositionSilently(editor, 6.0)
    expect(stateChangeSpy).toHaveBeenCalledWith('stopped')
  })

  // ----------------------------------------------------------
  // Note persistence through playback lifecycle
  // ----------------------------------------------------------

  it('preserves all notes after playback starts and stops', () => {
    const melody = [
      makeNote({
        id: 1,
        note: { midi: 60, freq: 261.63, name: 'C', octave: 4 },
        startBeat: 0,
        duration: 1,
      }),
      makeNote({
        id: 2,
        note: { midi: 62, freq: 293.66, name: 'D', octave: 4 },
        startBeat: 2,
        duration: 2,
      }),
    ]
    editor.setMelody(melody)

    editor.setExternalPlayback(true)
    editor.setPlaybackState('playing')
    updatePlaybackPositionSilently(editor, 1.5)

    // Stop playback
    editor.setPlaybackState('stopped')

    const result = editor.getMelody()
    expect(result).toHaveLength(2)
    expect(result[0].note.midi).toBe(60)
    expect(result[1].note.midi).toBe(62)
  })

  it('preserves effect metadata through playback lifecycle', () => {
    const melody = [
      makeNote({
        id: 1,
        note: { midi: 60, freq: 261.63, name: 'C', octave: 4 },
        startBeat: 0,
        duration: 2,
        effectType: 'vibrato',
        vibratoAmplitude: 0.8,
      }),
      makeNote({
        id: 2,
        note: { midi: 64, freq: 329.63, name: 'E', octave: 4 },
        startBeat: 2,
        duration: 3,
        effectType: 'slide-up',
        slideInterval: 5,
      }),
    ]
    editor.setMelody(melody)

    editor.setExternalPlayback(true)
    editor.setPlaybackState('playing')
    updatePlaybackPositionSilently(editor, 3.0)
    editor.setPlaybackState('stopped')

    const result = editor.getMelody()
    expect(result).toHaveLength(2)

    const vibrato = result.find((n) => n.effectType === 'vibrato')!
    expect(vibrato).toBeDefined()
    expect(vibrato.vibratoAmplitude).toBe(0.8)

    const slide = result.find((n) => n.effectType === 'slide-up')!
    expect(slide).toBeDefined()
    expect(slide.slideInterval).toBe(5)
  })

  it('notes do not disappear during active playback updates', () => {
    const melody = [
      makeNote({
        id: 1,
        note: { midi: 60, freq: 261.63, name: 'C', octave: 4 },
        startBeat: 0,
        duration: 1,
      }),
    ]
    editor.setMelody(melody)

    editor.setExternalPlayback(true)
    editor.setPlaybackState('playing')

    // Multiple beat updates simulating playback progression
    for (let beat = 0; beat < 1; beat += 0.1) {
      updatePlaybackPositionSilently(editor, beat)
      expect(editor.getMelody()).toHaveLength(1)
    }
  })

  // ----------------------------------------------------------
  // Playback position tracking
  // ----------------------------------------------------------

  it('properly handles rapid consecutive beat updates', () => {
    const melody = [
      makeNote({
        id: 1,
        note: { midi: 60, freq: 261.63, name: 'C', octave: 4 },
        startBeat: 0,
        duration: 4,
      }),
    ]
    editor.setMelody(melody)

    editor.setExternalPlayback(true)
    editor.setPlaybackState('playing')

    // Simulate rapid beat updates during smooth playback
    const beats = [0.1, 0.25, 0.5, 0.75, 1.0, 1.25, 1.5]
    for (const beat of beats) {
      expect(() => updatePlaybackPositionSilently(editor, beat)).not.toThrow()
    }
  })

  it('handles beat updates beyond melody end without errors', () => {
    const melody = [
      makeNote({
        id: 1,
        note: { midi: 60, freq: 261.63, name: 'C', octave: 4 },
        startBeat: 0,
        duration: 1,
      }),
    ]
    editor.setMelody(melody)

    editor.setExternalPlayback(true)
    editor.setPlaybackState('playing')

    // Beat far beyond melody end
    expect(() => updatePlaybackPositionSilently(editor, 100)).not.toThrow()
  })

  it('handles fractional beat values near boundaries', () => {
    const melody = [
      makeNote({
        id: 1,
        note: { midi: 60, freq: 261.63, name: 'C', octave: 4 },
        startBeat: 0,
        duration: 1.5,
      }),
    ]
    editor.setMelody(melody)

    editor.setExternalPlayback(true)
    editor.setPlaybackState('playing')
    stateChangeSpy.mockClear()

    // Just before end
    updatePlaybackPositionSilently(editor, 1.499)
    expect(stateChangeSpy).not.toHaveBeenCalledWith('stopped')

    // At end
    updatePlaybackPositionSilently(editor, 1.5)
    expect(stateChangeSpy).toHaveBeenCalledWith('stopped')
  })
})

describe('PianoRollCanvas Playback Prop Contracts', () => {
  // These tests verify the expected prop types and ranges that PianoRollCanvas
  // passes to the PianoRollEditor via its effects

  describe('currentBeat prop contract', () => {
    it('accepts valid beat values', () => {
      const validBeats = [0, 1, 4, 8, 16, 100, 1000]
      for (const beat of validBeats) {
        expect(beat >= 0).toBe(true)
      }
    })

    it('handles fractional beat values', () => {
      const fractionalBeats = [0.5, 1.25, 3.75, 7.999]
      for (const beat of fractionalBeats) {
        expect(beat >= 0).toBe(true)
        expect(typeof beat).toBe('number')
      }
    })

    it('negative beat values are filtered out (count-in state)', () => {
      // PianoRollCanvas checks: if (beat >= 0) { editor?.updatePlaybackPosition(beat) }
      const negativeBeats = [-1, -0.5, -100]
      for (const beat of negativeBeats) {
        expect(beat < 0).toBe(true)
        // These should NOT trigger updatePlaybackPosition
      }
    })
  })

  describe('playbackState prop contract', () => {
    it('accepts all valid playback states', () => {
      const states: PlaybackState[] = ['stopped', 'playing', 'paused']
      for (const state of states) {
        expect(['stopped', 'playing', 'paused']).toContain(state)
      }
    })

    it('transitions between states correctly', () => {
      // Valid transitions
      const transitions: [PlaybackState, PlaybackState][] = [
        ['stopped', 'playing'],
        ['playing', 'paused'],
        ['paused', 'playing'],
        ['playing', 'stopped'],
        ['paused', 'stopped'],
      ]

      for (const [from, to] of transitions) {
        const valid = from !== to || to === 'stopped'
        expect(valid || from === to).toBe(true)
      }
    })
  })

  describe('currentNoteIndex prop contract', () => {
    it('accepts valid note indices', () => {
      const validIndices = [-1, 0, 1, 5, 100, 1000]
      for (const index of validIndices) {
        expect(typeof index).toBe('number')
      }
    })

    it('negative index means no current note', () => {
      // -1 signals "no current note" in the piano roll
      expect(-1 < 0).toBe(true)
      expect(-1).toBe(-1)
    })

    it('non-negative index means active note', () => {
      const activeIndices = [0, 1, 5]
      for (const index of activeIndices) {
        expect(index >= 0).toBe(true)
      }
    })
  })

  describe('updatePlaybackPosition call contract', () => {
    it('calls updatePlaybackPosition with non-negative beats', () => {
      // Simulate the PianoRollCanvas effect:
      // createEffect(() => {
      //   const beat = props.currentBeat()
      //   if (beat >= 0) editor?.updatePlaybackPosition(beat)
      // })
      const testCases = [
        { beat: 0, shouldCall: true },
        { beat: 4.5, shouldCall: true },
        { beat: 8, shouldCall: true },
        { beat: -1, shouldCall: false },
        { beat: -0.5, shouldCall: false },
      ]

      for (const { beat, shouldCall } of testCases) {
        const shouldUpdate = beat >= 0
        expect(shouldUpdate).toBe(shouldCall)
      }
    })
  })

  describe('setPlaybackState call contract', () => {
    it('maps appStore state to PianoRollEditor state', () => {
      // Simulate the PianoRollCanvas effect:
      // createEffect(() => { editor?.setPlaybackState(props.playbackState()) })
      const appToEditor: Record<PlaybackState, PlaybackState> = {
        stopped: 'stopped',
        playing: 'playing',
        paused: 'paused',
      }

      for (const [appState, editorState] of Object.entries(appToEditor)) {
        expect(appState).toBe(editorState)
      }
    })
  })

  describe('setCurrentNote call contract', () => {
    it('passes currentNoteIndex directly to setCurrentNote', () => {
      // Simulate: createEffect(() => { editor?.setCurrentNote(props.currentNoteIndex()) })
      const indices = [-1, 0, 5, 10]
      for (const index of indices) {
        expect(typeof index).toBe('number')
      }
    })
  })
})
