// ── What a room can sing, and the act of picking it ──────────────────
// The picker used to live inside JamPanel: its shelves, the fetches that
// fill them, the row being loaded and the reason the last pick failed were
// all component state. That was fine while one popup showed them.
//
// Two places show them now -- the popup over the transport and the room's
// section of the sidebar -- and a list rendered twice has to be ONE list.
// Two copies would each fetch the examples, each show a different spinner,
// and disagree about why a song would not load. So the state lives here and
// both surfaces are views of it.

import { createEffect, createMemo, createRoot, createSignal } from 'solid-js'
import type { WeeklyChallenge } from '@/features/challenges/weekly-service'
import { getActiveWeekly } from '@/features/challenges/weekly-service'
import type { DemoSongManifest } from '@/features/karaoke-night/demo-song'
import { loadDemoSongs } from '@/features/karaoke-night/demo-song'
import { activePathWeek } from '@/features/path/path-progress'
import type { JamCatalogEntry } from '@/lib/jam/jam-catalog'
import { jamAscentEntries, jamExampleRowEntries, jamExerciseEntries, jamMelodyEntries, jamSessionRowEntries, jamWeeklyEntry, } from '@/lib/jam/jam-catalog'
import { exampleSong, ownSongRows, sessionSong, } from '@/lib/jam/jam-session-songs'
import { exampleSongId, isExampleSongId } from '@/lib/jam/jam-song-sources'
import { jamError, jamExerciseMelody, jamSong, jamState, selectJamExercise, selectJamSong, } from '@/stores/jam-store'
import { getMelodyLibrarySignal } from '@/stores/melody-store'
import { VOCAL_RANGES, vocalRangePreset } from '@/stores/settings-store'
import { getAllUvrSessionsReactive } from '@/stores/uvr-store'

/** One group of the picker. `id` is stable: the sidebar remembers which
 *  groups a visitor folded away by it. */
export interface JamPickerShelf {
  id: 'examples' | 'own-songs' | 'weekly' | 'ascent' | 'exercises' | 'melodies'
  label: string
  entries: JamCatalogEntry[]
}

/** Where the example songs have got to. */
export type JamExamplesState = 'loading' | 'ready' | 'unavailable'

const [examples, setExamples] = createSignal<DemoSongManifest[]>([])
const [examplesState, setExamplesState] =
  createSignal<JamExamplesState>('loading')
// Null covers both "no API configured" and "no challenge running" -- the
// shelf just does not render, which is why the fetch needs no error branch.
const [weekly, setWeekly] = createSignal<WeeklyChallenge | null>(null)
const [pickerError, setPickerError] = createSignal('')
const [pickingEntryId, setPickingEntryId] = createSignal<string | null>(null)
// Counts the picks the room accepted. The popup closes on every one of
// them, not only its own: a host who opens it and then taps a row in the
// sidebar has made their choice, and a list left floating over the stage
// after that is a list in the way.
const [acceptedPicks, setAcceptedPicks] = createSignal(0)

export {
  acceptedPicks as jamPickerAcceptedPicks,
  examplesState as jamExamplesState,
  pickerError as jamPickerError,
  pickingEntryId as jamPickingEntryId,
}

/** Forget why the last pick failed -- a list that is opened afresh should
 *  not greet the host with an old complaint. */
export function clearJamPickerError(): void {
  setPickerError('')
}

/** Guards a fetch that finishes after the room it was for has gone. */
let sourcesRun = 0

function resetSources(): void {
  sourcesRun++
  setExamples([])
  setExamplesState('loading')
  setWeekly(null)
  setPickerError('')
  setPickingEntryId(null)
}

/**
 * Fetch what the shelves cannot work out from this device alone.
 *
 * Every example, not the one Karaoke Night opens on. They are the songs a
 * room is best at: the stems are public, so every peer fetches the same
 * addresses and nothing has to be transferred.
 */
function loadSources(): void {
  const run = ++sourcesRun
  setExamplesState('loading')
  void loadDemoSongs()
    .then((songs) => {
      if (run !== sourcesRun) return
      setExamples(songs)
      setExamplesState(songs.length > 0 ? 'ready' : 'unavailable')
    })
    .catch(() => {
      // The picker still has drills and saved melodies. Keep those usable
      // and say only that the example songs are unavailable.
      if (run !== sourcesRun) return
      setExamples([])
      setExamplesState('unavailable')
    })
  void getActiveWeekly()
    .then((challenge) => {
      if (run === sourcesRun) setWeekly(challenge)
    })
    .catch(() => {
      if (run === sourcesRun) setWeekly(null)
    })
}

// Resolved when the room goes live, and thrown away when it ends: the next
// room may be days later, and a list of examples from last week is a list
// of songs the studio may have parked since.
createRoot(() => {
  createEffect(() => {
    if (jamState() === 'active') loadSources()
    else resetSources()
  })
})

/**
 * What the room can sing, grouped by where it came from.
 *
 * Songs first -- they are what people open a room for -- then the drills.
 * Exercises, the weekly challenge and the Ascent week all resolve to the
 * same thing a saved melody does, a target contour on a beat grid, so the
 * picker treats them identically and selectJamExercise broadcasts the
 * result.
 *
 * "Your karaoke songs" resolves again whenever the session list changes,
 * because a separation that finishes while you are sitting in a room should
 * appear without making you leave and come back. Examples already on the
 * shelf above it are dropped -- see `ownSongRows`.
 */
export const jamPickerShelves = createRoot(() => {
  const shelves = createMemo<JamPickerShelf[]>(() => {
    if (jamState() !== 'active') return []
    const octave = VOCAL_RANGES[vocalRangePreset()].defaultOctave
    const week = activePathWeek()
    const weeklyEntry = jamWeeklyEntry(weekly())
    const shelved = new Set(examples().map((m) => exampleSongId(m.slug)))
    const melodies = Object.values(getMelodyLibrarySignal()().melodies)
    return [
      {
        id: 'examples',
        label: 'Example songs',
        entries: jamExampleRowEntries(examples(), exampleSong),
      },
      {
        id: 'own-songs',
        label: 'Your karaoke songs',
        entries: jamSessionRowEntries(
          ownSongRows(getAllUvrSessionsReactive(), shelved),
          (row) => sessionSong(row.session),
        ),
      },
      {
        id: 'weekly',
        label: "This week's challenge",
        entries: weeklyEntry === null ? [] : [weeklyEntry],
      },
      {
        id: 'ascent',
        label: week === null ? 'Your Ascent' : `Ascent · week ${week.order}`,
        entries: jamAscentEntries(week, octave),
      },
      {
        id: 'exercises',
        label: 'Exercises',
        entries: jamExerciseEntries(octave),
      },
      {
        id: 'melodies',
        label: 'Your melodies',
        entries: jamMelodyEntries(melodies),
      },
    ]
  })
  return shelves
})

/**
 * The `targetId` of whatever the room is running, or null in an empty room.
 * A room runs a song or a drill, never both, so the first one found is it.
 */
export const jamPickerActiveTargetId = createRoot(() => {
  const running = createMemo<string | null>(
    () => jamSong()?.id ?? jamExerciseMelody()?.id ?? null,
  )
  return running
})

/** Why a song that came back empty could not be loaded, in the host's words. */
function missingSongReason(entry: JamCatalogEntry): string {
  // An example has nothing on this device to be missing -- it is sung from
  // its public address -- so the only thing that can have failed is the
  // fetch, and "open it in Karaoke" would send the host on an errand that
  // cannot help.
  return isExampleSongId(entry.targetId)
    ? `${entry.name} could not be loaded. Check the connection and try again.`
    : `${entry.name} is missing its backing track on this device. Open it in Karaoke and try again.`
}

/**
 * Load an entry into the room. Resolves true once the room has accepted it,
 * which is the caller's cue to get out of the way -- close the popup, fold
 * the phone's drawer.
 *
 * A separated song is hydrated only after it is chosen, and that is two
 * multi-megabyte reads, so the row stays marked as working until the room
 * truly has the song. A failure leaves the list open with the reason on it:
 * closing first made a missing stem look exactly like a picker that had
 * ignored the tap.
 */
export async function chooseJamPickerEntry(
  entry: JamCatalogEntry,
): Promise<boolean> {
  if (pickingEntryId() !== null) return false
  setPickerError('')
  if (entry.kind !== 'song') {
    selectJamExercise(entry.build())
    setAcceptedPicks((n) => n + 1)
    return true
  }

  setPickingEntryId(entry.id)
  try {
    const song = await entry.buildSong()
    if (song === null) {
      setPickerError(missingSongReason(entry))
      return false
    }
    if (!selectJamSong(song)) {
      const reason = jamError()?.trim() ?? ''
      setPickerError(
        reason !== ''
          ? reason
          : `${entry.name} cannot be loaded into this room.`,
      )
      return false
    }
    setAcceptedPicks((n) => n + 1)
    return true
  } catch {
    setPickerError(
      isExampleSongId(entry.targetId)
        ? `${entry.name} could not be loaded. Check the connection and try again.`
        : `${entry.name} could not be read from this device. Try opening it in Karaoke first.`,
    )
    return false
  } finally {
    setPickingEntryId(null)
  }
}
