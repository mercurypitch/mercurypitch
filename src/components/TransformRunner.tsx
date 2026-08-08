// ============================================================
// TransformRunner — analysis transform catalogue and launcher
//
// Lab-exclusive: the only mount point is the Spectral workbench tab. All
// styling lives in the sibling module — the panel used to carry ~36 literal
// rgba() values inline, which meant it only looked right in the dark theme.
// ============================================================

import type { Component } from 'solid-js'
import { createMemo, createSignal, For, Show } from 'solid-js'
import { getTransforms, registerBuiltinTransforms, } from '@/lib/transform-registry'
import type { TransformDescriptor } from '@/types'
import { Box, Loader2, MagnifyingGlass, Play } from './icons'
import styles from './TransformRunner.module.css'

export const TransformRunner: Component = () => {
  // Ensure transforms are registered
  registerBuiltinTransforms()

  const [search, setSearch] = createSignal('')
  const [activeCategory, setActiveCategory] = createSignal<string | null>(null)
  const [selectedId, setSelectedId] = createSignal<string | null>(null)
  const [isRunning, setIsRunning] = createSignal(false)

  const categories = createMemo(() => {
    const cats = new Set<string>()
    for (const t of getTransforms()) cats.add(t.category)
    return Array.from(cats).sort()
  })

  const filteredTransforms = createMemo(() => {
    let list = getTransforms()
    const cat = activeCategory()
    if (cat !== null) list = list.filter((t) => t.category === cat)
    const q = search().toLowerCase()
    if (q.length > 0) {
      list = list.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q),
      )
    }
    return list
  })

  const selected = createMemo(() => {
    const id = selectedId()
    if (id === null) return null
    return getTransforms().find((t) => t.id === id) ?? null
  })

  return (
    <div class={styles.panel}>
      <h3 class={styles.title}>
        <span aria-hidden="true">
          <Box />
        </span>
        Transform plug-ins
      </h3>

      {/* Search + category filter */}
      <div class={styles.filters}>
        <div class={styles.searchWrap}>
          <span aria-hidden="true" class={styles.searchIcon}>
            <MagnifyingGlass />
          </span>
          <input
            aria-label="Filter transforms by name or description"
            class={styles.search}
            onInput={(e) => setSearch(e.currentTarget.value)}
            placeholder="Name or description…"
            type="text"
            value={search()}
          />
        </div>
        <div class={styles.chips}>
          <For each={categories()}>
            {(cat) => (
              <button
                aria-pressed={activeCategory() === cat}
                class={styles.chip}
                classList={{ [styles.chipActive]: activeCategory() === cat }}
                onClick={() =>
                  setActiveCategory(activeCategory() === cat ? null : cat)
                }
                type="button"
              >
                {cat}
              </button>
            )}
          </For>
        </div>
      </div>

      {/* Transform list */}
      <Show
        fallback={
          <div class={styles.empty}>
            <span aria-hidden="true" class={styles.emptyGlyph}>
              <MagnifyingGlass />
            </span>
            <h4 class={styles.emptyTitle}>No transforms match</h4>
            <p class={styles.emptyBody}>
              Nothing in the registry matches that filter. Clear the box above,
              or switch the active category off, to see the whole catalogue
              again.
            </p>
          </div>
        }
        when={filteredTransforms().length > 0}
      >
        <div class={styles.grid}>
          <For each={filteredTransforms()}>
            {(t) => (
              // A button rather than a clickable <div>: the card is the only
              // way to open a transform's details, so it has to be reachable
              // by keyboard and has to be able to show a focus ring.
              <button
                aria-pressed={selectedId() === t.id}
                class={styles.card}
                classList={{ [styles.cardActive]: selectedId() === t.id }}
                onClick={() =>
                  setSelectedId(selectedId() === t.id ? null : t.id)
                }
                type="button"
              >
                <span class={styles.cardName}>{t.name}</span>
                <span class={styles.cardDesc}>
                  {t.description.slice(0, 60)}
                  {t.description.length > 60 ? '…' : ''}
                </span>
                <span class={styles.tags}>
                  <span class={styles.tag}>{t.category}</span>
                  <span class={`${styles.tag} ${styles.tagNum}`}>
                    v{t.version}
                  </span>
                  <Show when={t.minDuration !== undefined}>
                    <span class={`${styles.tag} ${styles.tagNum}`}>
                      min {t.minDuration}s
                    </span>
                  </Show>
                </span>
              </button>
            )}
          </For>
        </div>
      </Show>

      {/* Selected transform details */}
      <Show when={selected()}>
        {(t: () => TransformDescriptor) => (
          <div class={styles.detail}>
            <span class={styles.detailName}>{t().name}</span>
            <p class={styles.detailDesc}>{t().description}</p>
            <div class={styles.detailRow}>
              <span class={styles.detailKey}>Outputs</span>
              <span class={styles.detailVal}>
                {t()
                  .outputs.map((o) => `${o.name} (${o.annotationType})`)
                  .join(', ')}
              </span>
            </div>
            <Show when={(t().parameters?.length ?? 0) > 0}>
              <div class={styles.detailRow}>
                <span class={styles.detailKey}>Parameters</span>
                <span class={styles.detailVal}>
                  {t()
                    .parameters?.map((p) => `${p.label} (${p.type})`)
                    .join(', ') ?? ''}
                </span>
              </div>
            </Show>
            <button
              class={styles.runBtn}
              disabled={isRunning()}
              onClick={() => {
                setIsRunning(true)
                setTimeout(() => setIsRunning(false), 1000)
              }}
              type="button"
            >
              <span aria-hidden="true">
                {isRunning() ? <Loader2 /> : <Play />}
              </span>
              <span class={styles.runLabel}>
                {isRunning() ? 'Running…' : `Run ${t().name}`}
              </span>
            </button>
          </div>
        )}
      </Show>
    </div>
  )
}
