// ============================================================
// AdminDemoSongPage — the Karaoke Night demo songs, editable
// ============================================================
//
// THESIS: the songs a first-time visitor can sing are content, not a
// constant.
// FIRST VIEWPORT: the songs that exist, which one is live, and the control
// that adds another.
// FORM: one form, pointed at whichever song is selected, with the shipped
// manifest reachable beside it — the studio row is an override, and an
// author should be able to see what they are overriding and get back to it.
//
// Three behaviours worth knowing before editing this file:
//
//   1. A row is only offered by the live page when BOTH stem URLs are set.
//      A half-filled row is skipped rather than presented as an unplayable
//      demo, so saving a title before pasting the stems is safe.
//   2. The lyrics revision is owned by the server and only moves when the
//      lyrics actually change. It is what lets an authored correction
//      reach a visitor who already has the old copy seeded locally —
//      without ever clobbering a copy they edited themselves.
//   3. The link id (slug) is fixed after the first save. It is what the
//      local session id and the `?session=` link are built from, so
//      changing it would orphan every take recorded against the old one.

import type { Component } from 'solid-js'
import { createMemo, createSignal, For, onMount, Show } from 'solid-js'
import { AlertTriangle, CheckCircle, FileUpload, LinkChain, Plus, RotateCcw, } from '@/components/icons'
import { showNotification } from '@/stores/notifications-store'
import styles from './AdminDemoSongPage.module.css'
import type { DemoSongDraft, DemoSongRecord } from './demo-song-admin-service'
import { blankDemoSongDraft, DEFAULT_DEMO_SLUG, loadDemoSongs, loadShippedManifest, normalizeDemoSlug, readLyricsFile, recordToDraft, saveDemoSong, } from './demo-song-admin-service'

interface AdminDemoSongPageProps {
  adminKey: string
  onDirtyChange?: (dirty: boolean) => void
}

type LoadState = 'loading' | 'ready' | 'failed'

/** What the song bar says about a row, in the live page's own terms. */
function rowStatus(song: DemoSongRecord): string {
  if (song.active === false) return 'Parked'
  return (song.stems.vocal ?? '') !== '' &&
    (song.stems.instrumental ?? '') !== ''
    ? 'Live'
    : 'Draft'
}

export const AdminDemoSongPage: Component<AdminDemoSongPageProps> = (props) => {
  const [songs, setSongs] = createSignal<DemoSongRecord[]>([])
  // Which row the form is editing. A slug that is not in `songs()` is a new
  // song being authored — that is the whole "add" state, so there is no
  // separate mode flag that can fall out of step with it.
  const [slug, setSlug] = createSignal(DEFAULT_DEMO_SLUG)
  const [draft, setDraft] = createSignal<DemoSongDraft>(blankDemoSongDraft())
  const [saved, setSaved] = createSignal<DemoSongRecord | null>(null)
  const [shipped, setShipped] = createSignal<DemoSongRecord | null>(null)
  const [state, setState] = createSignal<LoadState>('loading')
  const [loadError, setLoadError] = createSignal('')
  const [saving, setSaving] = createSignal(false)
  // The baseline the dirty check compares against — the last thing that
  // round-tripped through the server, not the initial draft. It doubles as
  // what "discard" restores.
  const [baseline, setBaseline] = createSignal(
    JSON.stringify(blankDemoSongDraft()),
  )

  const dirty = createMemo(() => JSON.stringify(draft()) !== baseline())
  const isNew = createMemo(() => !songs().some((s) => s.slug === slug()))

  const settle = (next: DemoSongDraft): void => {
    setDraft(next)
    setBaseline(JSON.stringify(next))
    props.onDirtyChange?.(false)
  }

  const edit = <K extends keyof DemoSongDraft>(
    key: K,
    value: DemoSongDraft[K],
  ): void => {
    setDraft((prev) => ({ ...prev, [key]: value }))
    props.onDirtyChange?.(dirty())
  }

  // ── Which song the form is pointed at ───────────────────────────
  const [fileNote, setFileNote] = createSignal('')
  const [fileError, setFileError] = createSignal('')

  const select = (next: string, list = songs()): void => {
    setSlug(next)
    const row = list.find((s) => s.slug === next) ?? null
    setSaved(row)
    setFileNote('')
    setFileError('')
    settle(row !== null ? recordToDraft(row) : blankDemoSongDraft())
  }

  /** Refresh the bar. Deliberately leaves the form alone. */
  const refreshList = async (): Promise<DemoSongRecord[]> => {
    const list = await loadDemoSongs(props.adminKey)
    if (!list.ok) {
      setState('failed')
      setLoadError(list.error)
      return []
    }
    setState('ready')
    setSongs(list.songs)
    return list.songs
  }

  onMount(() => {
    void (async () => {
      const [list, manifest] = await Promise.all([
        refreshList(),
        loadShippedManifest(),
      ])
      setShipped(manifest)
      if (state() === 'failed') return
      const first = list[0]
      if (first !== undefined) {
        select(first.slug, list)
        return
      }
      // No rows yet: start from the shipped demo rather than an empty
      // form, so the first save is a promotion of something real.
      setSlug(DEFAULT_DEMO_SLUG)
      setSaved(null)
      settle(manifest !== null ? recordToDraft(manifest) : blankDemoSongDraft())
    })()
  })

  const addSong = (): void => {
    setSaved(null)
    setFileNote('')
    setFileError('')
    setSlug('')
    settle(blankDemoSongDraft())
  }

  /** Back to the last settled state — which is exactly what `baseline` is. */
  const discard = (): void => {
    setFileNote('')
    setFileError('')
    settle(JSON.parse(baseline()) as DemoSongDraft)
  }

  const playable = createMemo(
    () =>
      draft().vocalUrl.trim() !== '' && draft().instrumentalUrl.trim() !== '',
  )

  const lyricsChanged = createMemo(() => {
    const current = saved()
    if (current === null) return true
    return (
      (current.lyrics ?? '') !== draft().lyricsUrl.trim() ||
      (current.lyricsText ?? '') !== draft().lyricsText
    )
  })

  // ── Dropping a lyrics file ──────────────────────────────────────
  // The file is read into the pasted-lyrics field, not uploaded. That is
  // the whole trick: an .lrc reaches a singer with no R2 round trip,
  // because the text travels in the row and the server infers "synced"
  // from the timestamps it carries.
  const [dragOver, setDragOver] = createSignal(false)

  const takeFile = async (file: File | undefined): Promise<void> => {
    if (file === undefined) return
    setFileNote('')
    setFileError('')
    const read = await readLyricsFile(file)
    if (!read.ok) {
      setFileError(read.error)
      return
    }
    edit('lyricsText', read.text)
    const lines = read.text.trim().split('\n').length
    setFileNote(
      `Loaded ${file.name} — ${lines} ${lines === 1 ? 'line' : 'lines'}, ${
        read.format === 'lrc' ? 'timed' : 'plain text'
      }. Save to publish it.`,
    )
  }

  const revertToShipped = (): void => {
    const manifest = shipped()
    if (manifest === null) return
    setDraft(recordToDraft(manifest))
    props.onDirtyChange?.(true)
  }

  const save = async (): Promise<void> => {
    if (saving()) return
    const target = normalizeDemoSlug(slug())
    if (target === null) {
      showNotification(
        'Give the song a link id — lowercase letters, numbers and hyphens.',
        'error',
      )
      return
    }
    // A PUT is an upsert, so a colliding id on a new song would overwrite
    // a song that already exists rather than fail.
    if (isNew() && songs().some((s) => s.slug === target)) {
      showNotification(
        `"${target}" already exists — pick it from the bar above to edit it.`,
        'error',
      )
      return
    }
    if (draft().title.trim() === '' || draft().artist.trim() === '') {
      showNotification('A title and an artist are required.', 'error')
      return
    }
    setSaving(true)
    const result = await saveDemoSong(target, draft(), props.adminKey)
    setSaving(false)
    if (!result.ok) {
      showNotification(`Could not save the demo song: ${result.error}`, 'error')
      return
    }
    setSlug(target)
    setSaved(result.song)
    settle(result.song !== null ? recordToDraft(result.song) : draft())
    showNotification(
      result.song !== null && result.song.lyricsRevision > 0
        ? `Demo song saved (lyrics revision ${result.song.lyricsRevision}).`
        : 'Demo song saved.',
      'success',
    )
    // A new row has to appear in the bar, and an edited title has to
    // change there too.
    void refreshList()
  }

  const field = (
    label: string,
    key: keyof DemoSongDraft,
    hint?: string,
    placeholder?: string,
  ) => (
    <label class={styles.field}>
      <span class={styles.fieldLabel}>{label}</span>
      <input
        type="text"
        value={String(draft()[key] ?? '')}
        placeholder={placeholder}
        onInput={(e) =>
          edit(key, e.currentTarget.value as DemoSongDraft[typeof key])
        }
      />
      <Show when={hint !== undefined}>
        <span class={styles.hint}>{hint}</span>
      </Show>
    </label>
  )

  return (
    <div class={styles.page}>
      <header class={styles.header}>
        <div>
          <h2>Karaoke demo songs</h2>
          <p>
            The songs a first-time visitor can sing on Karaoke Night. Saved
            here, they override the single song that ships with the build —
            which stays the fallback, so a half-finished row can never break the
            page.
          </p>
        </div>
      </header>

      <Show when={state() === 'failed'}>
        <p class={styles.state} role="alert">
          <AlertTriangle />
          Could not reach the content API ({loadError()}). The live page is
          still serving the demo that ships with the build.
        </p>
      </Show>

      <Show when={state() === 'loading'}>
        <p class={styles.state}>Loading the demo songs…</p>
      </Show>

      <Show when={state() === 'ready'}>
        <nav class={styles.songBar} aria-label="Demo songs">
          <For each={songs()}>
            {(song) => (
              <button
                type="button"
                class={styles.songTab}
                classList={{ [styles.songTabOn!]: song.slug === slug() }}
                aria-current={song.slug === slug() ? 'true' : undefined}
                disabled={dirty() && song.slug !== slug()}
                title={
                  dirty() && song.slug !== slug()
                    ? 'Save or discard your changes first'
                    : undefined
                }
                onClick={() => select(song.slug)}
              >
                <span class={styles.songTabTitle}>
                  {song.title.trim() === '' ? song.slug : song.title}
                </span>
                <span class={styles.songTabMeta}>{rowStatus(song)}</span>
              </button>
            )}
          </For>

          <Show when={isNew()}>
            <span class={`${styles.songTab} ${styles.songTabOn}`}>
              <span class={styles.songTabTitle}>
                {draft().title.trim() === '' ? 'New song' : draft().title}
              </span>
              <span class={styles.songTabMeta}>Unsaved</span>
            </span>
          </Show>

          <button
            type="button"
            class={styles.addButton}
            disabled={isNew() || dirty()}
            title={
              isNew()
                ? 'Save this one first'
                : dirty()
                  ? 'Save or discard your changes first'
                  : undefined
            }
            onClick={addSong}
          >
            <Plus />
            Add a song
          </button>
        </nav>

        <div class={styles.statusRow}>
          <span
            class={`${styles.badge} ${playable() ? styles.badgeLive : styles.badgeIdle}`}
          >
            <Show when={playable()} fallback={<AlertTriangle />}>
              <CheckCircle />
            </Show>
            {playable()
              ? 'Playable — visitors get this song'
              : 'Not playable yet — both stems are needed first'}
          </span>
          <Show when={saved() !== null}>
            <span class={styles.meta}>
              Lyrics revision {saved()!.lyricsRevision}
            </span>
          </Show>
          <Show when={dirty()}>
            <button type="button" class={styles.ghostButton} onClick={discard}>
              <RotateCcw />
              Discard changes
            </button>
          </Show>
          <Show when={shipped() !== null && !dirty()}>
            <button
              type="button"
              class={styles.ghostButton}
              onClick={revertToShipped}
            >
              <RotateCcw />
              Start from the shipped demo
            </button>
          </Show>
        </div>

        <form
          class={styles.form}
          onSubmit={(e) => {
            e.preventDefault()
            void save()
          }}
        >
          <fieldset class={styles.group}>
            <legend>The song</legend>
            <Show
              when={isNew()}
              fallback={
                <p class={styles.slugLine}>
                  <LinkChain />
                  <code>{slug()}</code>
                  <span class={styles.hint}>
                    The link id. Fixed once saved — changing it would orphan
                    every take already recorded against it.
                  </span>
                </p>
              }
            >
              <label class={styles.field}>
                <span class={styles.fieldLabel}>Link id</span>
                <input
                  type="text"
                  value={slug()}
                  placeholder="second-song"
                  onInput={(e) => setSlug(e.currentTarget.value)}
                />
                <span class={styles.hint}>
                  Lowercase letters, numbers and hyphens. It goes in the
                  shareable link, and cannot be changed after the first save.
                </span>
              </label>
            </Show>
            <div class={styles.row}>
              {field('Title', 'title')}
              {field('Artist', 'artist')}
            </div>
            <label class={styles.field}>
              <span class={styles.fieldLabel}>Duration (seconds)</span>
              <input
                type="number"
                min="0"
                value={draft().durationSec ?? ''}
                onInput={(e) => {
                  const parsed = Number(e.currentTarget.value)
                  edit(
                    'durationSec',
                    e.currentTarget.value === '' || !Number.isFinite(parsed)
                      ? null
                      : parsed,
                  )
                }}
              />
              <span class={styles.hint}>
                Used for the timeline before the audio has loaded. Optional.
              </span>
            </label>
          </fieldset>

          <fieldset class={styles.group}>
            <legend>Stems</legend>
            <p class={styles.groupNote}>
              Both are required before this song is offered. Host them on R2 —
              the bucket already serves the current demo.
            </p>
            {field('Vocal URL', 'vocalUrl', undefined, 'https://…/vocal.m4a')}
            {field(
              'Instrumental URL',
              'instrumentalUrl',
              undefined,
              'https://…/instrumental.m4a',
            )}
          </fieldset>

          <fieldset class={styles.group}>
            <legend>Lyrics</legend>
            <p class={styles.groupNote}>
              Paste the words to change them without touching R2 — pasted lyrics
              win over the URL. Timestamps in <code>[mm:ss.xx]</code> form make
              them synced; without any, they are treated as plain text.
            </p>
            {field(
              'Lyrics URL',
              'lyricsUrl',
              undefined,
              'https://…/lyrics.lrc',
            )}
            <label
              class={styles.drop}
              classList={{ [styles.dropOver!]: dragOver() }}
              onDragOver={(e) => {
                e.preventDefault()
                setDragOver(true)
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault()
                setDragOver(false)
                void takeFile(e.dataTransfer?.files?.[0])
              }}
            >
              <input
                type="file"
                accept=".lrc,.txt"
                hidden
                onChange={(e) => {
                  void takeFile(e.currentTarget.files?.[0])
                  // Let the same file be picked twice in a row.
                  e.currentTarget.value = ''
                }}
              />
              <FileUpload />
              <span>Drop a .lrc or .txt here, or browse</span>
              <span class={styles.hint}>
                It fills the box below — nothing is uploaded until you save.
              </span>
            </label>

            <Show when={fileNote() !== ''}>
              <p class={styles.fileNote}>{fileNote()}</p>
            </Show>
            <Show when={fileError() !== ''}>
              <p class={styles.fileError} role="alert">
                <AlertTriangle />
                {fileError()}
              </p>
            </Show>

            <label class={styles.field}>
              <span class={styles.fieldLabel}>Pasted lyrics</span>
              <textarea
                rows="10"
                value={draft().lyricsText}
                spellcheck={false}
                onInput={(e) => {
                  edit('lyricsText', e.currentTarget.value)
                  // Typing supersedes whatever the file note claimed.
                  setFileNote('')
                }}
              />
            </label>
            <Show when={lyricsChanged() && saved() !== null}>
              <p class={styles.hint}>
                Saving will bump the lyrics revision, so visitors who have not
                edited their own copy pick this up. Anyone who has edited theirs
                keeps it.
              </p>
            </Show>
          </fieldset>

          <fieldset class={styles.group}>
            <legend>Attribution</legend>
            <p class={styles.groupNote}>
              Shown under the player. Required by most open licences, and the
              reason the current demo can be used at all.
            </p>
            {field('Credit line', 'attributionText')}
            {field('Source URL', 'attributionUrl')}
            <div class={styles.row}>
              {field('Licence', 'licenseName', undefined, 'CC BY 4.0')}
              {field('Licence URL', 'licenseUrl')}
            </div>
          </fieldset>

          <div class={styles.actions}>
            <label class={styles.toggle}>
              <input
                type="checkbox"
                checked={draft().active}
                onChange={(e) => edit('active', e.currentTarget.checked)}
              />
              <span>
                Live. Turn this off to park the song — it stops being offered,
                and if it was the only one, visitors fall back to the demo that
                ships with the build.
              </span>
            </label>
            <button
              type="submit"
              class={styles.primaryButton}
              disabled={saving() || (!dirty() && saved() !== null)}
            >
              {saving()
                ? 'Saving…'
                : saved() === null
                  ? 'Save new song'
                  : dirty()
                    ? 'Save changes'
                    : 'Saved'}
            </button>
          </div>
        </form>
      </Show>
    </div>
  )
}
