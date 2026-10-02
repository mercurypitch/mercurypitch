// ============================================================
// Stem mixer key controller — the karaoke key, remembered
// ============================================================
//
// Owns the singer's key for the song on stage.
//
// Which key a song opens in: the current playlist entry's key, else the key
// the song itself was last moved to, else the original key.
//
// Where a change goes: back to whichever of those is in effect — the entry
// when it already carries a key or is a single-song entry, otherwise the
// song. So one singer's key for a whole group entry stays with that entry,
// and a song moved outside any entry keeps its own key.
//
// "Find my key" fits the melody to the singer's range (see singer-range.ts).
// A suggestion is only ever applied when asked for. With no range yet it
// opens the voice-type picker; with no melody yet it runs Pitch Studio's
// detection once and fits when that is done. The range is read again whenever
// the tab is shown, so one measured in Voice Mirror's own tab counts as soon
// as the singer comes back.
//
// What it says goes on one channel, so each notice replaces the last: "finding
// the melody first" gives way to the outcome, and the singer is left with one
// message. A failed detection says only what went wrong.
//
// useStemMixerKeyView is what the mixer shows of it. The notes, the MIDI
// track, the offline contour and the word glyphs move with the key being
// heard, which is 0 in Pitch Studio (it edits the song's own notes) and 0
// without the engine. The live reference contour needs none of this: it is
// detected from the audio, which has already moved.

import type { Accessor } from 'solid-js'
import { createMemo, createSignal, onCleanup } from 'solid-js'
import type { KeyShiftBinding } from '@/components/key-shift/KeyShiftControl'
import { clampKeyShift, formatKeyShift, transposeKeyName, transposeNamedNotes, transposeNotes, transposePitchReadings, } from '@/lib/key-shift/key-shift'
import type { KeySuggestion, TimedNote } from '@/lib/key-shift/key-suggest'
import { suggestKeyShift } from '@/lib/key-shift/key-suggest'
import { setSongKeyShift, songKeyShift } from '@/stores/karaoke-key-store'
import type { QueueEntry } from '@/stores/karaoke-playlist-store'
import { setItemKeyShift } from '@/stores/karaoke-playlist-store'
import type { VocalRangePreset } from '@/stores/settings-store'
import { setVocalRangePreset } from '@/stores/settings-store'
import type { ResolvedSingerRange } from './singer-range'
import { resolveSingerRange, voiceTypeRange } from './singer-range'
import type { PitchAnalysisOutcome } from './useStemMixerPitchAnalysisController'

/**
 * 'unchanged': the song is in the key that fits already, so nothing moved.
 * 'detecting': the melody is being found first; the fit follows on its own.
 * 'no-melody': there is none and it cannot be detected here.
 */
export type FindMyKeyResult =
  | 'applied'
  | 'unchanged'
  | 'needs-range'
  | 'detecting'
  | 'no-melody'

/** Every "find my key" notice goes here, so each one replaces the last. */
export const FIND_MY_KEY_CHANNEL = 'stem-mixer-find-my-key'

type NoticeType = 'info' | 'success' | 'warning' | 'error'

/** What "find my key" says once it has fitted the key. */
function fitMessage(result: 'applied' | 'unchanged', keyShift: number): string {
  if (result === 'applied')
    return `Key ${formatKeyShift(keyShift)} fits your voice.`
  return keyShift === 0
    ? "The song's own key already fits your voice."
    : `Key ${formatKeyShift(keyShift)} already fits your voice.`
}

export interface StemMixerKeyController {
  keyShift: Accessor<number>
  /** Clamps to ±6 and writes back to the entry or the song, as above. */
  setKeyShift: (keyShift: number) => void
  suggestion: Accessor<KeySuggestion | null>
  rangeKnown: Accessor<boolean>
  findMyKey: () => FindMyKeyResult
  /** Picks the voice type (Settings' own), then fits as `findMyKey` does. */
  applyVoiceType: (preset: VocalRangePreset) => FindMyKeyResult
  voiceTypePickerOpen: Accessor<boolean>
  closeVoiceTypePicker: () => void
}

export interface StemMixerKeyDeps {
  sessionId: () => string
  /** Null outside a playlist. */
  queueEntry: () => QueueEntry | null
  playlistId: () => string | null
  melody: () => readonly TimedNote[]
  /**
   * Finds the melody, saying nothing itself; null when that cannot run here
   * (a streamed vocal).
   */
  detectMelody?: () => Promise<PitchAnalysisOutcome> | null
  /** For the outcome of a detection, which nobody is waiting on. */
  notify?: (
    message: string,
    type: NoticeType,
    options: { channel: string },
  ) => void
  /** Clears a channel: the wait, when the analysis has said why it failed. */
  dismiss?: (channel: string) => void
}

export function useStemMixerKeyController(
  deps: StemMixerKeyDeps,
): StemMixerKeyController {
  const [range, setRange] = createSignal<ResolvedSingerRange | null>(null)
  const [pickerOpen, setPickerOpen] = createSignal(false)
  let detecting = false
  let disposed = false
  onCleanup(() => {
    disposed = true
  })
  // A pick made while the takes were still being read must win.
  let rangeRequest = 0
  const readRange = () => {
    const request = ++rangeRequest
    void resolveSingerRange().then((resolved) => {
      if (request === rangeRequest) setRange(resolved)
    })
  }
  readRange()
  const onVisibility = () => {
    if (document.visibilityState === 'visible') readRange()
  }
  document.addEventListener('visibilitychange', onVisibility)
  onCleanup(() =>
    document.removeEventListener('visibilitychange', onVisibility),
  )

  const keyShift = createMemo(() => {
    const entryKey = deps.queueEntry()?.keyShift
    if (entryKey !== undefined) return clampKeyShift(entryKey)
    return songKeyShift(deps.sessionId()) ?? 0
  })

  const setKeyShift = (value: number) => {
    const next = clampKeyShift(value)
    const entry = deps.queueEntry()
    const playlistId = deps.playlistId()
    const entryOwnsKey =
      entry !== null &&
      (entry.keyShift !== undefined || entry.itemKind === 'session')
    if (entry !== null && playlistId !== null && entryOwnsKey) {
      void setItemKeyShift(playlistId, entry.itemId, next)
      return
    }
    setSongKeyShift(deps.sessionId(), next)
  }

  const suggestion = createMemo(() => {
    const resolved = range()
    return resolved === null
      ? null
      : suggestKeyShift(deps.melody(), resolved.range)
  })

  const rangeKnown = () => range() !== null

  const notify = (message: string, type: NoticeType) =>
    deps.notify?.(message, type, { channel: FIND_MY_KEY_CHANNEL })

  /** Moves to the fit; null when there is none to move to. */
  const applyFit = (): 'applied' | 'unchanged' | null => {
    const fit = suggestion()
    if (fit === null) return null
    if (fit.keyShift === keyShift()) return 'unchanged'
    setKeyShift(fit.keyShift)
    return 'applied'
  }

  const fitAfterDetection = (outcome: PitchAnalysisOutcome) => {
    detecting = false
    if (disposed) return
    if (!outcome.ok) {
      // Said once: here, or already by an analysis someone else started.
      if (outcome.shown) deps.dismiss?.(FIND_MY_KEY_CHANNEL)
      else notify(outcome.message, 'error')
      return
    }
    const result = applyFit()
    if (result === null) {
      notify(
        'No melody was found in the vocal, so the song keeps its key.',
        'warning',
      )
      return
    }
    notify(
      fitMessage(result, keyShift()),
      result === 'applied' ? 'success' : 'info',
    )
  }

  const fitOrDetect = (): FindMyKeyResult => {
    const fitted = applyFit()
    if (fitted !== null) return fitted
    if (detecting) return 'detecting'
    const detection = deps.detectMelody?.() ?? null
    if (detection === null) return 'no-melody'
    detecting = true
    detection.then(fitAfterDetection, () => {
      detecting = false
    })
    return 'detecting'
  }

  const findMyKey = (): FindMyKeyResult => {
    if (!rangeKnown()) {
      setPickerOpen(true)
      return 'needs-range'
    }
    return fitOrDetect()
  }

  const applyVoiceType = (preset: VocalRangePreset): FindMyKeyResult => {
    setVocalRangePreset(preset)
    rangeRequest++
    setRange(voiceTypeRange())
    setPickerOpen(false)
    return fitOrDetect()
  }

  return {
    keyShift,
    setKeyShift,
    suggestion,
    rangeKnown,
    findMyKey,
    applyVoiceType,
    voiceTypePickerOpen: pickerOpen,
    closeVoiceTypePicker: () => setPickerOpen(false),
  }
}

/**
 * The melody "find my key" fits: Pitch Studio's sung notes when it has
 * them, else the MIDI guide's. Durations only weigh the notes, so ticks
 * serve as well as seconds.
 */
export function songMelody(
  sung: readonly { midi: number; startBeat: number; endBeat: number }[],
  guide: readonly { midi: number; tickOn: number; tickOff: number }[],
): TimedNote[] {
  if (sung.length > 0)
    return sung.map((note) => ({
      midi: note.midi,
      startTime: note.startBeat,
      endTime: note.endBeat,
    }))
  return guide.map((note) => ({
    midi: note.midi,
    startTime: note.tickOn,
    endTime: note.tickOff,
  }))
}

export interface StemMixerKeyViewDeps {
  key: Pick<
    StemMixerKeyController,
    'keyShift' | 'setKeyShift' | 'suggestion' | 'findMyKey' | 'applyVoiceType'
  >
  /** The key being heard: 0 in Pitch Studio, and 0 without the engine. */
  heardShift: Accessor<number>
  engineAvailable: Accessor<boolean>
  editMode: Accessor<boolean>
  /** The vocal take's own key, as Pitch Studio detected it. */
  detectedKey: Accessor<{ keyName: string; scaleType: string } | null>
  /** On FIND_MY_KEY_CHANNEL, shared with the controller's own notices. */
  notify: (message: string, type: 'info', options: { channel: string }) => void
}

export interface StemMixerKeyView {
  /** A memo of these notes moved into the key being heard. */
  createShownNotes: <T extends { midi: number }>(
    notes: Accessor<T[]>,
  ) => Accessor<T[]>
  createShownReadings: <
    T extends { frequency: number; noteName: string; octave: number },
  >(
    readings: Accessor<T[]>,
  ) => Accessor<T[]>
  createShownWords: <
    T extends { midi: number | null; noteName: string | null },
  >(
    words: Accessor<T[]>,
  ) => Accessor<T[]>
  /** For the key controls: the transport's and the phone stage's. */
  binding: KeyShiftBinding
  /** The voice-type picker's answer, fitted as "find my key" fits. */
  pickVoiceType: (preset: VocalRangePreset) => void
}

export function useStemMixerKeyView(
  deps: StemMixerKeyViewDeps,
): StemMixerKeyView {
  // A fit that is applied shows on the stepper; the rest would not.
  const say = (message: string) =>
    deps.notify(message, 'info', { channel: FIND_MY_KEY_CHANNEL })
  const announce = (result: FindMyKeyResult) => {
    if (result === 'detecting')
      say('Finding the melody first. This takes a moment.')
    else if (result === 'no-melody')
      say(
        "Find my key needs the song's melody, and it cannot be found on this device. Set the key with − and + instead.",
      )
    else if (result === 'unchanged')
      say(fitMessage('unchanged', deps.key.keyShift()))
  }

  return {
    createShownNotes: (notes) => {
      const shown = createMemo(() => transposeNotes(notes(), deps.heardShift()))
      return shown
    },
    createShownReadings: (readings) => {
      const shown = createMemo(() =>
        transposePitchReadings(readings(), deps.heardShift()),
      )
      return shown
    },
    createShownWords: (words) => {
      const shown = createMemo(() =>
        transposeNamedNotes(words(), deps.heardShift()),
      )
      return shown
    },
    binding: {
      value: deps.key.keyShift,
      heard: deps.heardShift,
      onChange: deps.key.setKeyShift,
      // The key being played. While Pitch Studio plays the original, or the
      // engine is missing, the stepper keeps the singer's key for later and
      // the label names the song's own.
      keyLabel: () => {
        const detected = deps.detectedKey()
        if (detected === null) return undefined
        const scale = detected.scaleType === 'major' ? 'major' : 'minor'
        return `${transposeKeyName(detected.keyName, deps.heardShift(), scale)} ${scale}`
      },
      suggestion: deps.key.suggestion,
      onFindKey: () => announce(deps.key.findMyKey()),
      disabledReason: () => {
        if (!deps.engineAvailable())
          return 'Changing the key is not available right now'
        if (deps.editMode()) return 'Pitch Studio plays the song in its own key'
        return undefined
      },
    },
    pickVoiceType: (preset) => announce(deps.key.applyVoiceType(preset)),
  }
}
