// ============================================================
// AdminDemoSongPage — the Karaoke Night demo, editable
// ============================================================
//
// THESIS: the song a first-time visitor sings is content, not a constant.
// FIRST VIEWPORT: what is live now, and the one control that changes it.
// FORM: a single form with the shipped manifest visible beside it, because
// the studio row is an override and an author should be able to see what
// they are overriding — and get back to it.
//
// Two behaviours worth knowing before editing this file:
//
//   1. A row is only used by the live page when BOTH stem URLs are set.
//      A half-filled row falls through to the shipped manifest rather than
//      presenting an unplayable demo, so saving a title before pasting the
//      stems is safe.
//   2. The lyrics revision is owned by the server and only moves when the
//      lyrics actually change. It is what lets an authored correction
//      reach a visitor who already has the old copy seeded locally —
//      without ever clobbering a copy they edited themselves.

import type { Component } from 'solid-js'
import { createMemo, createSignal, onMount, Show } from 'solid-js'
import { AlertTriangle, CheckCircle, RotateCcw } from '@/components/icons'
import { showNotification } from '@/stores/notifications-store'
import styles from './AdminDemoSongPage.module.css'
import type { DemoSongDraft, DemoSongRecord } from './demo-song-admin-service'
import { blankDemoSongDraft, loadDemoSong, loadShippedManifest, recordToDraft, saveDemoSong, } from './demo-song-admin-service'

interface AdminDemoSongPageProps {
  adminKey: string
  onDirtyChange?: (dirty: boolean) => void
}

type LoadState = 'loading' | 'ready' | 'failed'

export const AdminDemoSongPage: Component<AdminDemoSongPageProps> = (props) => {
  const [draft, setDraft] = createSignal<DemoSongDraft>(blankDemoSongDraft())
  const [saved, setSaved] = createSignal<DemoSongRecord | null>(null)
  const [shipped, setShipped] = createSignal<DemoSongRecord | null>(null)
  const [state, setState] = createSignal<LoadState>('loading')
  const [loadError, setLoadError] = createSignal('')
  const [saving, setSaving] = createSignal(false)
  // The baseline the dirty check compares against — the last thing that
  // round-tripped through the server, not the initial draft.
  const [baseline, setBaseline] = createSignal(
    JSON.stringify(blankDemoSongDraft()),
  )

  const dirty = createMemo(() => JSON.stringify(draft()) !== baseline())

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

  onMount(() => {
    void (async () => {
      const [row, manifest] = await Promise.all([
        loadDemoSong(),
        loadShippedManifest(),
      ])
      setShipped(manifest)
      if (!row.ok) {
        setState('failed')
        setLoadError(row.error)
        return
      }
      setState('ready')
      setSaved(row.song)
      // No row yet: start from the shipped demo rather than an empty form,
      // so the first save is an edit of something real.
      const start =
        row.song !== null
          ? recordToDraft(row.song)
          : manifest !== null
            ? recordToDraft(manifest)
            : blankDemoSongDraft()
      settle(start)
    })()
  })

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

  const revertToShipped = (): void => {
    const manifest = shipped()
    if (manifest === null) return
    setDraft(recordToDraft(manifest))
    props.onDirtyChange?.(true)
  }

  const save = async (): Promise<void> => {
    if (saving()) return
    if (draft().title.trim() === '' || draft().artist.trim() === '') {
      showNotification('A title and an artist are required.', 'error')
      return
    }
    setSaving(true)
    const result = await saveDemoSong(draft(), props.adminKey)
    setSaving(false)
    if (!result.ok) {
      showNotification(`Could not save the demo song: ${result.error}`, 'error')
      return
    }
    setSaved(result.song)
    settle(result.song !== null ? recordToDraft(result.song) : draft())
    showNotification(
      result.song !== null && result.song.lyricsRevision > 0
        ? `Demo song saved (lyrics revision ${result.song.lyricsRevision}).`
        : 'Demo song saved.',
      'success',
    )
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
          <h2>Karaoke demo song</h2>
          <p>
            The song a first-time visitor sings on Karaoke Night. Saved here, it
            overrides the copy that ships with the build — which stays the
            fallback, so a half-finished row can never break the page.
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
        <p class={styles.state}>Loading the demo song…</p>
      </Show>

      <Show when={state() === 'ready'}>
        <div class={styles.statusRow}>
          <span
            class={`${styles.badge} ${playable() ? styles.badgeLive : styles.badgeIdle}`}
          >
            <Show when={playable()} fallback={<AlertTriangle />}>
              <CheckCircle />
            </Show>
            {playable()
              ? 'Playable — this row is what visitors get'
              : 'Not playable yet — visitors get the shipped demo'}
          </span>
          <Show when={saved() !== null}>
            <span class={styles.meta}>
              Lyrics revision {saved()!.lyricsRevision}
            </span>
          </Show>
          <Show when={shipped() !== null}>
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
              Both are required before this row goes live. Host them on R2 — the
              bucket already serves the current demo.
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
            <label class={styles.field}>
              <span class={styles.fieldLabel}>Pasted lyrics</span>
              <textarea
                rows="10"
                value={draft().lyricsText}
                spellcheck={false}
                onInput={(e) => edit('lyricsText', e.currentTarget.value)}
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
                Live. Turn this off to park the row — visitors fall back to the
                demo that ships with the build.
              </span>
            </label>
            <button
              type="submit"
              class={styles.primaryButton}
              disabled={saving() || !dirty()}
            >
              {saving() ? 'Saving…' : dirty() ? 'Save demo song' : 'Saved'}
            </button>
          </div>
        </form>
      </Show>
    </div>
  )
}
