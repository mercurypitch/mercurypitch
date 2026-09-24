// Artwork inspection — a quiet, accessible close-up of the gallery's original paintings.
import type { GalleryArtwork } from '../content/gallery-artworks'
import styles from './ArtworkInspection.module.css'
import { focusDialog, trapDialogKeys } from './dialog-focus'

export function ArtworkOffer(props: { onOpen(): void }) {
  return (
    <button
      class={styles.offer}
      type="button"
      aria-label="View nearby artwork"
      onClick={() => props.onOpen()}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="m4 17 5-6 4 4 3-3 5 6" />
        <circle cx="15" cy="8" r="1" />
      </svg>
      View artwork
    </button>
  )
}

export function ArtworkInspection(props: {
  artwork: GalleryArtwork
  imageUrl: string
  onClose(): void
}) {
  return (
    <div
      class={styles.scrim}
      onClick={(event) => {
        if (event.target === event.currentTarget) props.onClose()
      }}
    >
      <section
        class={styles.panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="glass-artwork-title"
        ref={focusDialog}
        onKeyDown={trapDialogKeys}
      >
        <div class={styles.imageWell}>
          <img src={props.imageUrl} alt={props.artwork.description} />
        </div>
        <div class={styles.label}>
          <span class={styles.eyebrow}>From the museum collection</span>
          <h2 id="glass-artwork-title">{props.artwork.title}</h2>
          <p>{props.artwork.story}</p>
          <p class={styles.invitation}>{props.artwork.invitation}</p>
          <button
            class={styles.returnButton}
            type="button"
            onClick={() => props.onClose()}
          >
            Back to the gallery
          </button>
        </div>
      </section>
    </div>
  )
}
