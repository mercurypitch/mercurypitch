// ============================================================
// Creator preview cards — entries for bounded creator studies on the games list.
// ============================================================

import { For } from 'solid-js'

export type CreatorPreviewPick = 'creator-gallery' | 'echo-curator'

interface CreatorPreviewCardsProps {
  onOpen: (preview: CreatorPreviewPick) => void
}

const CREATOR_PREVIEWS: readonly {
  id: CreatorPreviewPick
  name: string
  blurb: string
}[] = [
  {
    id: 'creator-gallery',
    name: 'Little discoveries',
    blurb:
      'An optional pearl alcove and three living crystal studies to explore.',
  },
  {
    id: 'echo-curator',
    name: 'Echo Curator',
    blurb:
      'Merc offers a little melody. Echo it back, at your own pace, through three friendly rounds.',
  },
]

export function CreatorPreviewCards(props: CreatorPreviewCardsProps) {
  return (
    <For each={CREATOR_PREVIEWS}>
      {(preview) => (
        <button
          class="game-card"
          type="button"
          onClick={() => props.onOpen(preview.id)}
        >
          <img
            class="game-card__art"
            src="games/merc.webp"
            alt=""
            width="64"
            height="64"
          />
          <span class="game-card__body">
            <span class="game-card__name">
              {preview.name}
              <span class="game-card__chip">Preview</span>
            </span>
            <span class="game-card__blurb">{preview.blurb}</span>
          </span>
          <svg class="game-card__go" viewBox="0 0 24 24" aria-hidden="true">
            <path d="m9 5 7 7-7 7" />
          </svg>
        </button>
      )}
    </For>
  )
}
