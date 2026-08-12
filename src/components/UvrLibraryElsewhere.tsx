// ── UvrLibraryElsewhere ───────────────────────────────────────────────
// The songs this account has that this device cannot play.
//
// Signing in on a phone used to show an empty library, which is a true
// statement about the device and a false one about the person: they have
// twenty songs, all of them on the desktop that separated them. This
// lists those, named and sized, greyed out.
//
// It deliberately offers no download button. Audio does not sync yet
// (docs/plans/device-sync.md — the transports are Phases 4 and 5), and a
// button that cannot do the thing it names is worse than the honest
// sentence underneath. What it does is make the library legible before a
// single byte moves, and give every later transport a list to diff.

import type { Component } from 'solid-js'
import { createSignal, For, onMount, Show } from 'solid-js'
import type { SongManifest } from '@/db/entities'
import { manifestBytes, syncLibraryList, } from '@/db/services/song-manifest-service'
import { getAllUvrSessions } from '@/stores/uvr-store'
import { Cloud } from './icons'

/** "8.4 MB", or nothing when the manifest did not say. */
function sizeLabel(manifest: SongManifest): string | null {
  const bytes = manifestBytes(manifest)
  if (bytes === undefined || bytes <= 0) return null
  const mb = bytes / (1024 * 1024)
  return mb >= 10 ? `${Math.round(mb)} MB` : `${mb.toFixed(1)} MB`
}

/** "3:47", or nothing when the manifest did not say. */
function durationLabel(manifest: SongManifest): string | null {
  // `?? undefined` collapses D1's NULL onto the absent case: the column is
  // nullable, so "the manifest did not say" arrives both ways.
  const total = manifest.durationSec ?? undefined
  if (total === undefined || !Number.isFinite(total) || total <= 0) return null
  const minutes = Math.floor(total / 60)
  const seconds = Math.round(total % 60)
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

/**
 * What a singer needs to know about a copy that is not the original.
 *
 * A song that arrived as a portable bundle is lossy, and saying so is the
 * difference between "this is the quality I chose" and "the separation is
 * broken". Nothing is said about a lossless one — the absence of a note is
 * the note.
 */
function qualityNote(manifest: SongManifest): string | null {
  switch (manifest.quality) {
    case 'portable-128':
      return 'synced copy, standard quality'
    case 'portable-192':
      return 'synced copy, high quality'
    default:
      return null
  }
}

export const UvrLibraryElsewhere: Component = () => {
  const [missing, setMissing] = createSignal<SongManifest[]>([])

  onMount(() => {
    // Publishing is part of looking: opening the library is the moment
    // this device's list is worth telling the account about, and it is the
    // only moment we can be sure the sessions are loaded.
    void syncLibraryList(getAllUvrSessions()).then(setMissing)
  })

  return (
    <Show when={missing().length > 0}>
      <section class="uvr-elsewhere">
        <header class="uvr-elsewhere-head">
          <Cloud size={18} />
          <h4>
            {missing().length} {missing().length === 1 ? 'song' : 'songs'} on
            your other devices
          </h4>
        </header>
        <p class="uvr-elsewhere-sub">
          Separated somewhere else and listed here, but the audio has not moved
          yet. Export and import them, or share one from a jam room.
        </p>
        <ul class="uvr-elsewhere-list">
          <For each={missing()}>
            {(manifest) => (
              <li class="uvr-elsewhere-item">
                <span class="uvr-elsewhere-title" title={manifest.title}>
                  {manifest.title}
                </span>
                <span class="uvr-elsewhere-meta">
                  <Show when={durationLabel(manifest)}>
                    {(label) => <span>{label()}</span>}
                  </Show>
                  <Show when={sizeLabel(manifest)}>
                    {(label) => <span>{label()}</span>}
                  </Show>
                  <Show when={manifest.hasLyrics === true}>
                    <span>lyrics</span>
                  </Show>
                  <Show when={qualityNote(manifest)}>
                    {(note) => (
                      <span class="uvr-elsewhere-quality">{note()}</span>
                    )}
                  </Show>
                </span>
              </li>
            )}
          </For>
        </ul>
      </section>
    </Show>
  )
}
