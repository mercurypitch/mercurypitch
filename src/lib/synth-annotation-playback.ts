// ============================================================
// Synthesized Annotation Playback — Play reference tones at annotation times
// ============================================================

/**
 * Schedule synthesized reference tones at each annotation instant time.
 * Each tone is a short sine wave burst (100ms) at the specified pitch.
 *
 * @param ctx - The Web Audio AudioContext
 * @param instants - Array of { time, label? } where label may contain a MIDI note number or frequency
 * @param options - Configuration
 */
export function scheduleAnnotationTones(
  ctx: AudioContext,
  instants: Array<{ time: number; label?: string }>,
  options?: { toneDuration?: number; gain?: number; defaultHz?: number },
): { stop: () => void } {
  const duration = options?.toneDuration ?? 0.1
  const gain = options?.gain ?? 0.15
  const defaultHz = options?.defaultHz ?? 440
  const now = ctx.currentTime

  const oscillators: OscillatorNode[] = []
  const gains: GainNode[] = []

  for (const instant of instants) {
    const freq = parseLabelToHz(instant.label) ?? defaultHz
    const startTime = now + instant.time

    if (startTime < now) continue

    const osc = ctx.createOscillator()
    const gainNode = ctx.createGain()

    osc.type = 'sine'
    osc.frequency.value = freq
    gainNode.gain.setValueAtTime(gain, startTime)
    gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + duration)

    osc.connect(gainNode)
    gainNode.connect(ctx.destination)

    osc.start(startTime)
    osc.stop(startTime + duration + 0.01)

    oscillators.push(osc)
    gains.push(gainNode)
  }

  return {
    stop: () => {
      for (const osc of oscillators) {
        try {
          osc.stop()
        } catch {
          /* already stopped */
        }
      }
      for (const g of gains) {
        try {
          g.disconnect()
        } catch {
          /* already disconnected */
        }
      }
    },
  }
}

/**
 * Parse a label string for a frequency hint.
 * Accepts formats: "MIDI:60", "C4", "440Hz", "A4", or just plain numbers.
 */
function parseLabelToHz(label: string | undefined): number | null {
  if (label === undefined || label.length === 0) return null

  // "MIDI:60" or "midi:72"
  const midiMatch = label.match(/^MIDI:\s*(\d+)/i)
  if (midiMatch !== null) {
    const midi = parseInt(midiMatch[1], 10)
    return 440 * Math.pow(2, (midi - 69) / 12)
  }

  // "440Hz" or "440 Hz" or just "440"
  const hzMatch = label.match(/^(\d+(?:\.\d+)?)\s*Hz/i)
  if (hzMatch !== null) {
    return parseFloat(hzMatch[1])
  }

  // Note name: "C4", "A#3", "Bb5"
  const noteMatch = label.match(/^([A-G][#b]?)(\d)$/i)
  if (noteMatch !== null) {
    // Normalize: keep letter upper-case, but preserve a trailing flat 'b'.
    const raw = noteMatch[1]
    const noteName =
      raw[0].toUpperCase() + (raw.length > 1 ? raw[1].toLowerCase() : '')
    const octave = parseInt(noteMatch[2], 10)
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
    ]
    // Map flats to their enharmonic sharp equivalents.
    const FLAT_TO_SHARP: Record<string, string> = {
      Db: 'C#',
      Eb: 'D#',
      Gb: 'F#',
      Ab: 'G#',
      Bb: 'A#',
      Cb: 'B',
      Fb: 'E',
    }
    const normalized = FLAT_TO_SHARP[noteName] ?? noteName
    const idx = NOTE_NAMES.indexOf(normalized)
    if (idx >= 0) {
      const midi = idx + (octave + 1) * 12
      return 440 * Math.pow(2, (midi - 69) / 12)
    }
  }

  return null
}
