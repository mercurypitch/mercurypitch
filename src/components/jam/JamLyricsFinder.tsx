// ── JamLyricsFinder ───────────────────────────────────────────────────
// Fills the empty half of a song room: find the words, or paste them.
//
// Sits where the lyrics would be, because that is where somebody notices
// they are missing. Search is prefilled with the song's title, so the
// common case -- a separated track whose filename is roughly "artist -
// title" -- is one tap.
//
// Deliberately thin. It searches, it takes a match, it saves. Everything
// the stem mixer's lyrics panel does beyond that (block marking, tap
// timing, edit layers, version history) belongs to an editor, and a room
// where someone else is driving playback is not one.

import type { Component } from 'solid-js'
import { createSignal, For, onMount, Show } from 'solid-js'
import { canAttachLyrics, linesFromLrc, persistSongLyrics, sessionIdOfSong, } from '@/lib/jam/jam-lyrics-attach'
import type { LyricsSearchMatch } from '@/lib/lyrics-service'
import { fetchLyricsById, searchLyricsMulti } from '@/lib/lyrics-service'
import { attachJamSongLyrics, jamSong } from '@/stores/jam-store'
import styles from './JamLyricsFinder.module.css'

/**
 * The title the automatic search has already been spent on.
 *
 * Module-level rather than per-instance because the finder is mounted and
 * unmounted as the room's panels come and go, and LRCLIB is a free service
 * somebody else pays for: once per song, not once per render.
 */
let autoSearched: string | null = null

export const JamLyricsFinder: Component = () => {
  const [query, setQuery] = createSignal(jamSong()?.title ?? '')
  const [results, setResults] = createSignal<LyricsSearchMatch[]>([])
  const [searching, setSearching] = createSignal(false)
  const [searched, setSearched] = createSignal(false)
  const [pasting, setPasting] = createSignal(false)
  const [paste, setPaste] = createSignal('')
  const [error, setError] = createSignal<string | null>(null)

  const search = async () => {
    const q = query().trim()
    if (q === '' || searching()) return
    setSearching(true)
    setError(null)
    try {
      setResults(await searchLyricsMulti(q))
      setSearched(true)
    } catch {
      setError('Could not reach the lyrics service. Try again, or paste them.')
    } finally {
      setSearching(false)
    }
  }

  /**
   * Ask before being asked.
   *
   * The box arrives prefilled with the song's title, and then showed
   * nothing until somebody pressed Search -- so the panel that exists to
   * say "here are the lyrics" opened saying nothing at all, which reads as
   * "there are none". The prefilled query is the one they would have sent
   * anyway. Pressing Search on a corrected query still works, and Paste
   * stays reachable while this runs.
   */
  onMount(() => {
    // The panel below is gated on this, and onMount is not: without the
    // same check a song that already HAS its words would spend a search on
    // a finder nobody can see.
    if (!canAttachLyrics(jamSong())) return
    const title = query().trim()
    if (title === '' || autoSearched === title) return
    autoSearched = title
    void search()
  })

  /**
   * Take a match, and refuse the ones that cannot be sung along to.
   *
   * LRCLib returns plenty of entries with plain lyrics and no timings.
   * They are real lyrics, and useless here: nothing to scroll by. Saying
   * so is better than attaching them and letting the singer discover the
   * column never moves.
   */
  const choose = async (match: LyricsSearchMatch) => {
    const song = jamSong()
    const sessionId = sessionIdOfSong(song)
    if (song === null || sessionId === null) return
    setError(null)
    try {
      const found = await fetchLyricsById(match.id)
      if (found === null || found.format !== 'lrc') {
        setError(
          'That version has no timings, so it cannot scroll with the song.',
        )
        return
      }
      const lines = linesFromLrc(found.text)
      if (lines.length === 0) {
        setError(
          'That version has no timings, so it cannot scroll with the song.',
        )
        return
      }
      attachJamSongLyrics(lines)
      await persistSongLyrics(
        sessionId,
        found.text,
        `${match.artist} - ${match.title}.lrc`,
      )
    } catch {
      setError('Could not load that one. Try another, or paste the words.')
    }
  }

  const usePasted = async () => {
    const song = jamSong()
    const sessionId = sessionIdOfSong(song)
    if (song === null || sessionId === null) return
    const text = paste().trim()
    const lines = linesFromLrc(text)
    if (lines.length === 0) {
      setError(
        'Those lyrics have no timings. Paste LRC — lines starting [00:12.34] — so the words can follow the song.',
      )
      return
    }
    setError(null)
    attachJamSongLyrics(lines)
    await persistSongLyrics(sessionId, text, `${song.title}.lrc`)
  }

  return (
    <Show when={canAttachLyrics(jamSong())}>
      <div class={styles.finder}>
        <p class={styles.lead}>
          No words saved for this one yet. Find them and everyone in the room
          gets them.
        </p>

        <Show
          when={!pasting()}
          fallback={
            <>
              <textarea
                class={styles.paste}
                rows={8}
                placeholder={'[00:12.34] First line\n[00:16.80] Second line'}
                value={paste()}
                onInput={(e) => setPaste(e.currentTarget.value)}
              />
              <div class={styles.row}>
                <button
                  type="button"
                  class={styles.primary}
                  onClick={() => void usePasted()}
                >
                  Use these
                </button>
                <button
                  type="button"
                  class={styles.link}
                  onClick={() => setPasting(false)}
                >
                  Search instead
                </button>
              </div>
            </>
          }
        >
          <form
            class={styles.row}
            onSubmit={(e) => {
              e.preventDefault()
              void search()
            }}
          >
            <input
              class={styles.input}
              type="search"
              value={query()}
              placeholder="Artist - title"
              onInput={(e) => setQuery(e.currentTarget.value)}
            />
            <button
              type="submit"
              class={styles.primary}
              disabled={searching() || query().trim() === ''}
            >
              {searching() ? 'Searching…' : 'Search'}
            </button>
          </form>

          <Show when={searched() && results().length === 0 && !searching()}>
            <p class={styles.none}>
              Nothing found. Try just the title, or paste the words.
            </p>
          </Show>

          <ul class={styles.results}>
            <For each={results()}>
              {(match) => (
                <li>
                  <button
                    type="button"
                    class={styles.result}
                    onClick={() => void choose(match)}
                  >
                    <span class={styles.resultTitle}>{match.title}</span>
                    <span class={styles.resultArtist}>{match.artist}</span>
                    {/* Says up front which ones can actually scroll, so
                        nobody picks a dead end to find out. */}
                    <Show
                      when={
                        match.syncedLyrics !== undefined &&
                        match.syncedLyrics !== ''
                      }
                      fallback={
                        <span class={styles.badgePlain}>no timings</span>
                      }
                    >
                      <span class={styles.badgeSynced}>synced</span>
                    </Show>
                  </button>
                </li>
              )}
            </For>
          </ul>

          <button
            type="button"
            class={styles.link}
            onClick={() => setPasting(true)}
          >
            Paste lyrics instead
          </button>
        </Show>

        <Show when={error()}>
          {(msg) => (
            <p class={styles.error} role="alert">
              {msg()}
            </p>
          )}
        </Show>
      </div>
    </Show>
  )
}
