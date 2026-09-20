// ── JamNowSinging ─────────────────────────────────────────────────────
// What the room is singing, in the room's header.
//
// The song's name used to lead a row of its own under the playback
// controls. It is a fact about the ROOM -- like its code and who is in it
// -- so it sits with those now, and the row it led is gone.
//
// A header has no room for a long title, so it shows as much as fits and
// the rest is one gesture away: hovering shows all of it (the title
// attribute), and a tap opens the chip out to its full length where it
// stands. No popover: the strip this lives in scrolls sideways on a phone
// and would clip one, and a name that simply gets longer needs no
// positioning, no layer and nothing to dismiss.

import type { Component } from 'solid-js'
import { createEffect, createMemo, createSignal, on, Show } from 'solid-js'
import { jamSong } from '@/stores/jam-store'
import styles from './JamNowSinging.module.css'

export const JamNowSinging: Component = () => {
  const [open, setOpen] = createSignal(false)

  // A memo, because the song OBJECT is replaced far more often than the
  // song is: the pitch guide arriving and the words being edited both do
  // it. Only a memo stays quiet through those -- a bare `jamSong()?.id`
  // re-fires for every one of them, and snapped the name shut under the
  // finger that had just opened it.
  const songId = createMemo(() => jamSong()?.id)

  // What was opened was the OLD name. A new song starts closed.
  createEffect(on(songId, () => setOpen(false), { defer: true }))

  const full = (): string => {
    const song = jamSong()
    if (song === null) return ''
    const artist = song.artist ?? ''
    return artist === '' ? song.title : `${song.title} · ${artist}`
  }

  return (
    <Show when={jamSong()}>
      {(song) => (
        <button
          type="button"
          class={styles.chip}
          classList={{ [styles.open]: open() }}
          data-testid="jam-now-singing"
          aria-expanded={open()}
          aria-label={`Now singing: ${full()}`}
          title={full()}
          onClick={() => setOpen((was) => !was)}
        >
          <svg
            class={styles.note}
            viewBox="0 0 24 24"
            width="13"
            height="13"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="M9 18V5l12-2v13" />
            <circle cx="6" cy="18" r="3" />
            <circle cx="18" cy="16" r="3" />
          </svg>
          <span class={styles.name}>
            {song().title}
            <Show when={(song().artist ?? '') !== ''}>
              <span class={styles.artist}> · {song().artist}</span>
            </Show>
          </span>
        </button>
      )}
    </Show>
  )
}
