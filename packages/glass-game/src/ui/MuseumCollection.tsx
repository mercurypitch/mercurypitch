// Museum collection album — inspect earned original portraits, discoveries and challenge stars.
import { createSignal, For, lazy, onCleanup, Show } from 'solid-js'
import type { GalleryEncore } from '../content/encores'
import type { GalleryArtwork } from '../content/gallery-artworks'
import type { CollectionEntry } from '../core/collection'
import { collectionBadges } from '../core/collection'
import type { GlassGameHost } from '../host'
import { ArtworkInspection } from './ArtworkInspection'
import { focusDialog, trapDialogKeys } from './dialog-focus'
import styles from './MuseumCollection.module.css'

const EncoreDialog = lazy(async () => ({
  default: (await import('./EncoreDialog')).EncoreDialog,
}))

export interface CollectionViewEntry extends CollectionEntry {
  artwork?: GalleryArtwork
  encore?: GalleryEncore
}

export function MuseumCollection(props: {
  entries: readonly CollectionViewEntry[]
  assetUrl(id: string): string
  onClose(): void
  onVisit(levelId: string): void
  host?: GlassGameHost
  beforeCapture?(): Promise<void>
  onReleaseVoice?(): void
}) {
  const [inspecting, setInspecting] = createSignal<CollectionViewEntry>()
  const [encoreEntry, setEncoreEntry] = createSignal<CollectionViewEntry>()
  let encoreOpener: HTMLButtonElement | undefined
  const closeEncore = () => {
    setEncoreEntry(undefined)
    queueMicrotask(() => encoreOpener?.focus({ preventScroll: true }))
  }
  const previousFocus = document.activeElement as HTMLElement | null
  let openedFrom: HTMLElement | undefined
  const badges = () => collectionBadges(props.entries)
  const closeArtwork = () => {
    setInspecting(undefined)
    queueMicrotask(() => openedFrom?.focus({ preventScroll: true }))
  }
  const keydown = (event: KeyboardEvent) => {
    if (event.key !== 'Escape' || encoreEntry()) return
    event.preventDefault()
    if (inspecting() !== undefined) closeArtwork()
    else props.onClose()
  }
  document.addEventListener('keydown', keydown)
  onCleanup(() => {
    document.removeEventListener('keydown', keydown)
    queueMicrotask(() => {
      if (previousFocus?.isConnected === true)
        previousFocus.focus({ preventScroll: true })
    })
  })

  return (
    <>
      <div
        class={styles.scrim}
        inert={inspecting() !== undefined || encoreEntry() !== undefined}
        onClick={(event) => {
          if (event.target === event.currentTarget) props.onClose()
        }}
      >
        <section
          class={styles.album}
          role="dialog"
          aria-modal="true"
          aria-labelledby="museum-collection-title"
          ref={focusDialog}
          onKeyDown={trapDialogKeys}
        >
          <header class={styles.header}>
            <div>
              <h2 id="museum-collection-title">Your museum collection</h2>
              <p>
                A little courage. A little music. Something beautiful to keep.
              </p>
            </div>
            <button
              class={styles.close}
              type="button"
              aria-label="Close collection"
              onClick={() => props.onClose()}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="m6 6 12 12M18 6 6 18" />
              </svg>
            </button>
          </header>
          <div class={styles.portraits}>
            <For each={props.entries}>
              {(entry) => (
                <article class={styles.portrait}>
                  <button
                    class={styles.art}
                    type="button"
                    disabled={
                      entry.summary.portrait?.collected !== true ||
                      entry.artwork === undefined
                    }
                    aria-label={
                      entry.summary.portrait?.collected === true
                        ? `Inspect ${entry.summary.portrait.title}`
                        : `Portrait waiting in ${entry.levelTitle}`
                    }
                    onClick={(event) => {
                      openedFrom = event.currentTarget
                      setInspecting(entry)
                    }}
                  >
                    <Show
                      when={entry.summary.portrait?.collected === true}
                      fallback={
                        <div class={styles.veil}>
                          <svg viewBox="0 0 80 100" aria-hidden="true">
                            <path d="M40 12C29 30 16 42 16 58a24 24 0 0 0 48 0c0-16-13-28-24-46Z" />
                            <path d="M40 36v32m-12-16h24" />
                          </svg>
                          <span>A voice yet to awaken</span>
                        </div>
                      }
                    >
                      <img
                        src={props.assetUrl(
                          entry.summary.portrait!.imageAssetId,
                        )}
                        alt={entry.summary.portrait!.title}
                      />
                    </Show>
                  </button>
                  <div class={styles.plaque}>
                    <p>{entry.levelTitle}</p>
                    <h3>
                      {entry.summary.portrait?.collected === true
                        ? entry.summary.portrait.title
                        : 'An undiscovered portrait'}
                    </h3>
                    <div
                      class={styles.stars}
                      aria-label={`${entry.stars} of 3 gallery challenge stars`}
                    >
                      <For each={[1, 2, 3]}>
                        {(star) => (
                          <svg
                            viewBox="0 0 24 24"
                            classList={{ [styles.earned]: star <= entry.stars }}
                            aria-hidden="true"
                          >
                            <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9Z" />
                          </svg>
                        )}
                      </For>
                      <span>
                        {entry.stars === 0
                          ? 'Challenge stars await'
                          : 'Gallery challenge'}
                      </span>
                    </div>
                    <p class={styles.tokens}>
                      {entry.summary.coinsFound} / {entry.summary.coinsTotal}{' '}
                      discovery tokens
                    </p>
                    <Show when={entry.summary.qualityResults[0]}>
                      {(quality) => (
                        <p class={styles.accuracy}>
                          Portrait accuracy:{' '}
                          {quality().grade === 'not-graded'
                            ? 'not graded'
                            : ['C', 'B', 'A'][Number(quality().grade) - 1]}
                        </p>
                      )}
                    </Show>
                    <Show
                      when={
                        entry.summary.portrait?.collected === true &&
                        entry.encore &&
                        props.host?.createMelodyReference
                      }
                    >
                      <button
                        class={styles.visit}
                        type="button"
                        onClick={(event) => {
                          encoreOpener = event.currentTarget
                          setEncoreEntry(entry)
                        }}
                      >
                        Sing or hear your encore
                      </button>
                    </Show>
                    <button
                      class={styles.visit}
                      type="button"
                      onClick={() => props.onVisit(entry.levelId)}
                    >
                      Visit gallery
                    </button>
                  </div>
                </article>
              )}
            </For>
          </div>
          <section class={styles.badges} aria-label="Museum badges">
            <h3>Little honours</h3>
            <ul>
              <For each={badges()}>
                {(badge) => (
                  <li data-earned={badge.earned}>
                    <svg viewBox="0 0 32 40" aria-hidden="true">
                      <path d="m9 24-2 13 9-5 9 5-2-13" />
                      <circle cx="16" cy="15" r="12" />
                      <Show when={badge.earned}>
                        <path d="m10 15 4 4 8-8" />
                      </Show>
                    </svg>
                    <div>
                      <strong>{badge.title}</strong>
                      <p>{badge.description}</p>
                      <span>
                        {badge.earned ? 'Earned' : 'Still to discover'}
                      </span>
                    </div>
                  </li>
                )}
              </For>
            </ul>
          </section>
          <p class={styles.note}>
            Portraits and tokens stay with you. Challenge stars come from
            completing a gallery at its chosen difficulty.
          </p>
        </section>
      </div>
      <Show when={encoreEntry()} keyed>
        {(entry) => (
          <EncoreDialog
            host={props.host!}
            levelId={entry.levelId}
            encore={entry.encore!}
            beforeCapture={() => props.beforeCapture?.() ?? Promise.resolve()}
            onReleaseVoice={() => props.onReleaseVoice?.()}
            onClose={closeEncore}
            returnLabel="Back to collection"
          />
        )}
      </Show>
      <Show when={inspecting()} keyed>
        {(entry) => (
          <Show when={entry.artwork}>
            {(artwork) => (
              <div class={styles.inspection}>
                <ArtworkInspection
                  artwork={artwork()}
                  imageUrl={props.assetUrl(artwork().imageAsset)}
                  onClose={closeArtwork}
                />
              </div>
            )}
          </Show>
        )}
      </Show>
    </>
  )
}
