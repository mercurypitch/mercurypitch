// ============================================================
// Mic check copy — the words for inputs, holders and changes
// ============================================================
//
// Kept apart from the controller so the timeline, the device list and the
// tests all read one source, and so a change of wording is a change to one
// file.

import type { InputKind, RosterChange, RosterInput } from './mic-roster'

export type CheckTone = 'info' | 'good' | 'warn' | 'bad'

export interface CheckLine {
  tone: CheckTone
  text: string
}

/** A short tag for each kind of input. `other` says nothing rather than guess. */
export const INPUT_KIND_LABEL: Record<InputKind, string> = {
  'built-in': 'Built-in',
  usb: 'USB',
  bluetooth: 'Bluetooth',
  headset: 'Headset',
  camera: 'Webcam',
  display: 'Display',
  virtual: 'Virtual',
  loopback: 'Loopback',
  other: '',
}

/**
 * What to know about the kinds that explain a bad check on their own. Shown
 * beside the input being heard, and beside the system default, because those
 * are the two that decide what MercuryPitch hears.
 */
export const INPUT_KIND_HINT: Partial<Record<InputKind, string>> = {
  bluetooth:
    'Bluetooth headsets drop into a low-quality call mode while their microphone is open, which makes pitch noisier. A wired or built-in mic hears more.',
  camera:
    'A webcam microphone usually sits far from your mouth, so it hears the room more than you.',
  display:
    'Monitors and TVs rarely have a real microphone, so this input may carry nothing at all.',
  virtual:
    'A virtual input is made by an app (meeting, streaming or voice software) and passes on only what that app sends it, which is often nothing.',
  loopback: 'This input records what your computer plays, not your voice.',
}

/**
 * Surfaces in this tab that hold the shared microphone, by consumer id. A
 * prefix match, because several surfaces add a suffix of their own per run.
 */
const HOLDER_NAMES: ReadonlyArray<readonly [prefix: string, name: string]> = [
  ['practice-engine', 'Singing practice'],
  ['audio-engine', 'The singing stage'],
  ['stem-mixer', 'Karaoke'],
  ['voice-control', 'Voice control'],
  ['routine', 'Your routine, between exercises'],
  ['mic-latency-wizard', 'The latency check'],
  ['guitar', 'Guitar'],
  ['voice-history', 'Hear Yourself'],
  ['voice-mirror', 'Voice Mirror'],
  ['glass', 'Glass'],
  ['first-light', 'First Light'],
]

export function holderName(id: string): string {
  for (const [prefix, name] of HOLDER_NAMES) {
    if (id === prefix || id.startsWith(`${prefix}-`)) return name
  }
  // An id nobody named still reads as words: 'exercise-capture' becomes
  // 'Exercise capture'.
  const words = id.replace(/[-_:]+/g, ' ').trim()
  return words === ''
    ? 'Another part of MercuryPitch'
    : words.charAt(0).toUpperCase() + words.slice(1)
}

/** A device's name for a sentence, before permission has named it. */
export const inputName = (input: RosterInput | null): string =>
  input === null || input.name === '' ? 'an unnamed input' : input.name

export function describeRosterChange(change: RosterChange): CheckLine {
  switch (change.type) {
    case 'connected':
      return { tone: 'info', text: `${inputName(change.input)} connected` }
    case 'disconnected':
      return {
        tone: change.input.isListening ? 'bad' : 'info',
        text: `${inputName(change.input)} disconnected`,
      }
    case 'default-changed':
      return {
        tone: 'warn',
        text:
          change.from === null
            ? `${inputName(change.to)} is now the system default`
            : `System default moved from ${inputName(change.from)} to ${inputName(change.to)}`,
      }
    case 'calls-changed':
      return {
        tone: 'info',
        text: `${inputName(change.to)} is now the default for calls`,
      }
  }
}

/**
 * What a switch of input came to. `asked` is the input that was picked, or
 * null for the system default; `pinned` is whether the check ended up on a
 * particular input. An input that will not open sends the shared manager
 * back to the default by itself, and that must not read as success.
 */
export function describeSwitch(
  asked: RosterInput | null,
  pinned: boolean,
  hearing: string,
): CheckLine {
  if (asked === null) {
    return { tone: 'info', text: `Back on the system default, ${hearing}` }
  }
  if (!pinned) {
    return {
      tone: 'warn',
      text: `${inputName(asked)} would not open, so MercuryPitch went back to the system default, ${hearing}`,
    }
  }
  return { tone: 'info', text: `Switched to ${hearing}` }
}

/** The voice processing the browser applied although we asked for none. */
export function processingNames(settings: MediaTrackSettings): string[] {
  const on: string[] = []
  if (settings.echoCancellation === true) on.push('echo cancellation')
  if (settings.noiseSuppression === true) on.push('noise suppression')
  if (settings.autoGainControl === true) on.push('automatic gain')
  return on
}

/**
 * Below this a capture is a call-grade route — typically a Bluetooth
 * headset in its hands-free mode — not a music microphone.
 */
export const CALL_GRADE_SAMPLE_RATE = 24000

/**
 * What the track's format says against it as a singing input: processing
 * the browser applied, or a call-grade route. Empty when nothing does.
 */
export function formatWarnings(
  settings: MediaTrackSettings | null | undefined,
): string[] {
  if (settings === null || settings === undefined) return []
  const warnings: string[] = []
  const processing = processingNames(settings)
  if (processing.length > 0) {
    warnings.push(
      `The browser is processing this input (${processing.join(', ')}), which smooths a voice for calls and blurs its pitch.`,
    )
  }
  if (
    typeof settings.sampleRate === 'number' &&
    settings.sampleRate > 0 &&
    settings.sampleRate < CALL_GRADE_SAMPLE_RATE
  ) {
    warnings.push(
      'This input runs at call quality. A Bluetooth headset does that while its microphone is open.',
    )
  }
  return warnings
}

/** "48 kHz · mono · no processing", from what the track reports. */
export function describeFormat(settings: MediaTrackSettings): string {
  const parts: string[] = []
  if (typeof settings.sampleRate === 'number' && settings.sampleRate > 0) {
    const khz = settings.sampleRate / 1000
    parts.push(`${Number.isInteger(khz) ? khz : khz.toFixed(1)} kHz`)
  }
  if (typeof settings.channelCount === 'number' && settings.channelCount > 0) {
    parts.push(
      settings.channelCount === 1
        ? 'mono'
        : settings.channelCount === 2
          ? 'stereo'
          : `${settings.channelCount} channels`,
    )
  }
  const processing = processingNames(settings)
  parts.push(
    processing.length === 0 ? 'no processing' : `${processing.join(', ')} on`,
  )
  return parts.join(' · ')
}

const PERMISSION_WORDS: Record<PermissionState, string> = {
  granted: 'allowed',
  denied: 'blocked',
  prompt: 'set to ask',
}

export const permissionWords = (state: PermissionState | 'unknown'): string =>
  state === 'unknown' ? 'not reported by this browser' : PERMISSION_WORDS[state]
