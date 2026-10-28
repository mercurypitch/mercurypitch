// ============================================================
// The notes over the lyrics: offered for every song, read on the tap
// ============================================================
//
// The Karaoke room offers the notes over the lyrics for every song that has
// them or can have them read (owner, 28 Oct 2026), in its options and on
// the chip beside the gear. A song with none yet has them read from its
// vocal on the tap, as turning the mic on does: the switch goes on, the
// mixer's read starts (its findNotes), and the stage says how far it has
// got. A song still loading is read once it can be. Only a loaded song
// whose vocal cannot be read has no switch (K1: absent, never dead).
//
// The switch reads on while the notes are on screen or on their way, as
// the stage's own switch reads: a saved "on" for a song without notes reads
// off, and a tap on it is what asks for them.

import type { Accessor } from 'solid-js'
import { createEffect, createSignal, untrack } from 'solid-js'
import type { HostedMixerControls } from '@/components/stem-mixer-hosting'
import { karaokeNoteGlyphs, setKaraokeNoteGlyphs } from './karaoke-room-store'
import type { KaraokeNotesOption } from './KaraokeRoomOptions'

export interface KaraokeNotesOptionDeps {
  /** The song's mixer, once it has handed its controls over. */
  readonly mixer: Accessor<HostedMixerControls | null>
  /** The cue on the stage: its key, or null while there is none. */
  readonly cueKey: Accessor<number | null>
}

/** The notes option for the song on the stage. Call in the room's owner. */
export function createKaraokeNotesOption(
  deps: KaraokeNotesOptionDeps,
): KaraokeNotesOption {
  const has = (): boolean => deps.mixer()?.hasNotes() === true
  const finding = (): boolean => deps.mixer()?.findingNotes() === true
  const progress = (): number => deps.mixer()?.notesProgress() ?? 0
  /** The cue whose notes were asked for before the read could start. */
  const [readAsked, setReadAsked] = createSignal<number | null>(null)

  const offered = (): boolean => {
    const controls = deps.mixer()
    if (controls === null) return deps.cueKey() !== null
    return (
      controls.hasNotes() ||
      controls.canFindNotes() ||
      controls.findingNotes() ||
      controls.loading()
    )
  }
  const on = (): boolean =>
    karaokeNoteGlyphs() && (has() || finding() || readAsked() === deps.cueKey())
  const toggle = (): void => {
    if (on()) {
      setKaraokeNoteGlyphs(false)
      setReadAsked(null)
      return
    }
    setKaraokeNoteGlyphs(true)
    if (has()) return
    const controls = deps.mixer()
    if (controls?.canFindNotes() === true) controls.findNotes()
    else setReadAsked(deps.cueKey())
  }

  // A read asked for while the song loaded starts as soon as it can, and
  // only for the song it was asked for.
  createEffect(() => {
    const asked = readAsked()
    if (asked === null) return
    if (asked !== deps.cueKey()) {
      setReadAsked(null)
      return
    }
    const controls = deps.mixer()
    if (controls === null || !controls.canFindNotes()) return
    setReadAsked(null)
    untrack(() => controls.findNotes())
  })

  return { offered, on, has, finding, progress, toggle }
}
