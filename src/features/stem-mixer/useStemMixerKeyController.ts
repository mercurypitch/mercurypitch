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

/**
 * 'detecting': the melody is being found first; the fit follows on its own.
 * 'no-melody': there is none and it cannot be detected here.
 */
export type FindMyKeyResult =
  | 'applied'
  | 'needs-range'
  | 'detecting'
  | 'no-melody'

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
  /** Finds the melody; null when that cannot run here (a streamed vocal). */
  detectMelody?: () => Promise<void> | null
  /** For the outcome of a detection, which nobody is waiting on. */
  notify?: (message: string, type: 'info' | 'success' | 'warning') => void
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

  const fitAfterDetection = () => {
    detecting = false
    if (disposed) return
    const fit = suggestion()
    if (fit === null) {
      deps.notify?.(
        'No melody was found in the vocal, so the song keeps its key.',
        'warning',
      )
      return
    }
    setKeyShift(fit.keyShift)
    deps.notify?.(
      `Key ${formatKeyShift(fit.keyShift)} fits your voice.`,
      'success',
    )
  }

  const fitOrDetect = (): FindMyKeyResult => {
    const fit = suggestion()
    if (fit !== null) {
      setKeyShift(fit.keyShift)
      return 'applied'
    }
    if (detecting) return 'detecting'
    const detection = deps.detectMelody?.() ?? null
    if (detection === null) return 'no-melody'
    detecting = true
    // A failed detection has said why already; only a finished one reports.
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
  notify: (message: string, type: 'info') => void
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
  // A fit that is applied shows on the stepper; these two would not.
  const announce = (result: FindMyKeyResult) => {
    if (result === 'detecting')
      deps.notify('Finding the melody first. This takes a moment.', 'info')
    else if (result === 'no-melody')
      deps.notify(
        "Find my key needs the song's melody, and it cannot be found on this device. Set the key with − and + instead.",
        'info',
      )
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
      onChange: deps.key.setKeyShift,
      // Where the stepper lands, so it follows the stepper and not the ear.
      keyLabel: () => {
        const detected = deps.detectedKey()
        if (detected === null) return undefined
        const scale = detected.scaleType === 'major' ? 'major' : 'minor'
        return `${transposeKeyName(detected.keyName, deps.key.keyShift())} ${scale}`
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
