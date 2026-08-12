// Guitar Night Learn audio schedules only references the player explicitly requests.
// ============================================================

import type { GuitarRoomBand } from '@/features/guitar/backing/guitar-room-band'
import type { GuitarVariant } from '@/lib/guitar/guitar-synth'

interface GuitarNightLearnGuideOptions {
  tempoBpm?: number
  noteBeats?: number
  gapBeats?: number
  variant?: GuitarVariant
  onComplete?(): void
}

/**
 * Play a single note or short phrase through the room's guide bus. There is no
 * click, count-in, microphone start, or hidden follow-up action.
 */
export async function playGuitarNightLearnGuide(
  band: GuitarRoomBand,
  midiNotes: readonly number[],
  options: GuitarNightLearnGuideOptions = {},
): Promise<boolean> {
  const notes = midiNotes.filter(
    (midi) => Number.isFinite(midi) && midi >= 0 && midi <= 127,
  )
  if (notes.length === 0) return false
  const noteBeats = Math.max(0.2, options.noteBeats ?? 0.72)
  const gapBeats = Math.max(0, options.gapBeats ?? 0.18)
  const stride = noteBeats + gapBeats
  const durationBeats = (notes.length - 1) * stride + noteBeats

  try {
    await band.start({
      tempoBpm: options.tempoBpm ?? 84,
      countInBeats: 0,
      exerciseBeats: Math.max(1, Math.ceil(durationBeats)),
      durationBeats,
      feel: 'click',
      exercisePulse: false,
      melodyVariant: options.variant ?? 'electric',
      melody: notes.map((midi, index) => ({
        midi,
        startBeat: index * stride,
        durationBeats: noteBeats,
      })),
      onComplete: options.onComplete,
    })
    return true
  } catch {
    return false
  }
}
