// ============================================================
// Percussion Notation — neutral GM voices for every reading surface
// ============================================================
//
// General MIDI percussion numbers identify articulations, never pitches. This
// pure projector gives score and compact-reference renderers one shared staff,
// notehead, family, and physical-seat vocabulary without inventing frets.

import { generalMidiPercussionName } from './percussion'

export type PercussionVoiceFamily =
  | 'kick'
  | 'snare'
  | 'hi-hat'
  | 'tom'
  | 'cymbal'
  | 'auxiliary'

export type PercussionSeatAnchor =
  | 'kick'
  | 'snare'
  | 'hi-hat'
  | 'tom-left'
  | 'tom-centre'
  | 'tom-right'
  | 'ride'
  | 'crash'
  | 'auxiliary'

export type PercussionNotehead = 'normal' | 'cross' | 'diamond'

export interface PercussionNotationVoice {
  readonly id: string
  readonly gmKey: number
  readonly label: string
  readonly shortLabel: string
  readonly family: PercussionVoiceFamily
  readonly seatAnchor: PercussionSeatAnchor
  /** Percussion staff steps, where zero is the middle line. */
  readonly staffStep: number
  readonly notehead: PercussionNotehead
  readonly stemDirection: 'up' | 'down'
}

function isOneOf(gmKey: number, values: readonly number[]): boolean {
  return values.includes(gmKey)
}

function shortVoiceLabel(gmKey: number, family: PercussionVoiceFamily): string {
  if (family === 'hi-hat') return 'HH'
  if (family === 'kick') return 'K'
  if (family === 'snare') return 'SN'
  if (family === 'tom') return `T${gmKey}`
  if (family === 'cymbal') return isOneOf(gmKey, [49, 55, 57]) ? 'CR' : 'CYM'
  return `P${gmKey}`
}

/** Stable notation and seat placement for one canonical GM articulation. */
export function percussionNotationForGmKey(
  gmKey: number,
): PercussionNotationVoice {
  let family: PercussionVoiceFamily = 'auxiliary'
  let seatAnchor: PercussionSeatAnchor = 'auxiliary'
  let staffStep = 3
  let notehead: PercussionNotehead = 'diamond'

  if (isOneOf(gmKey, [35, 36])) {
    family = 'kick'
    seatAnchor = 'kick'
    staffStep = -4
    notehead = 'normal'
  } else if (isOneOf(gmKey, [37, 38, 39, 40])) {
    family = 'snare'
    seatAnchor = 'snare'
    staffStep = 0
    notehead = gmKey === 37 ? 'cross' : 'normal'
  } else if (isOneOf(gmKey, [42, 44, 46])) {
    family = 'hi-hat'
    seatAnchor = 'hi-hat'
    staffStep = 5
    notehead = 'cross'
  } else if (isOneOf(gmKey, [41, 43, 45, 47, 48, 50])) {
    family = 'tom'
    notehead = 'normal'
    if (gmKey <= 43) {
      seatAnchor = 'tom-right'
      staffStep = -2
    } else if (gmKey <= 47) {
      seatAnchor = 'tom-centre'
      staffStep = 1
    } else {
      seatAnchor = 'tom-left'
      staffStep = 3
    }
  } else if (isOneOf(gmKey, [49, 51, 52, 53, 55, 57, 59])) {
    family = 'cymbal'
    seatAnchor = isOneOf(gmKey, [49, 55, 57]) ? 'crash' : 'ride'
    staffStep = seatAnchor === 'crash' ? 6 : 4
    notehead = 'cross'
  }

  return {
    id: `gm-${gmKey}`,
    gmKey,
    label: generalMidiPercussionName(gmKey),
    shortLabel: shortVoiceLabel(gmKey, family),
    family,
    seatAnchor,
    staffStep,
    notehead,
    stemDirection: staffStep >= 0 ? 'down' : 'up',
  }
}
