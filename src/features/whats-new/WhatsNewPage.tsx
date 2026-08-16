// ============================================================
// What's New — one page per release, shown once and then on request
// ============================================================
//
// A full-screen overlay rather than a tab: it is something you read once
// and leave, and a tab that is only interesting for a week is a tab that
// is dead for the rest of the year. It is reachable at #/whats-new and
// from the sidebar, so "where was that thing about Piano Night" has an
// answer after the announcement is gone.
//
// The content is data (whats-new-content.tsx). This file is the renderer;
// adding a release should never mean editing it.

import type { Component } from 'solid-js'
import { For, onCleanup, onMount } from 'solid-js'
import { Sparkles, X } from '@/components/icons'
import type { Release } from './whats-new-content'
import styles from './WhatsNewPage.module.css'

export interface WhatsNewPageProps {
  release: Release
  onClose: () => void
}

export const WhatsNewPage: Component<WhatsNewPageProps> = (props) => {
  let closeRef: HTMLButtonElement | undefined

  onMount(() => {
    // The overlay is the whole screen; the keyboard needs to start inside
    // it, and Escape has to work the way every other overlay here does.
    closeRef?.focus()
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') props.onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    onCleanup(() => window.removeEventListener('keydown', onKeyDown))
  })

  return (
    <div
      class={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby="whats-new-title"
      data-testid="whats-new"
    >
      <div class={styles.page}>
        <header class={styles.header}>
          <div>
            <p class={styles.eyebrow}>
              <Sparkles />
              New in {props.release.version}
            </p>
            <h1 class={styles.title} id="whats-new-title">
              What's new
            </h1>
          </div>
          <button
            ref={closeRef}
            type="button"
            class={styles.closeBtn}
            onClick={() => props.onClose()}
            aria-label="Close what's new"
            data-testid="whats-new-close"
          >
            <X />
          </button>
          <p class={styles.headline}>{props.release.headline}</p>
        </header>

        <div class={styles.highlights}>
          <For each={props.release.highlights}>
            {(item) => (
              <section
                class={styles.highlight}
                data-testid={`whats-new-${item.id}`}
              >
                <div class={styles.highlightHead}>
                  <span class={styles.highlightIcon}>{item.icon()}</span>
                  <h2 class={styles.highlightTitle}>{item.title}</h2>
                </div>
                <p class={styles.highlightBody}>{item.body}</p>
                <p class={styles.tryIt}>
                  <span class={styles.tryItLabel}>Try it: </span>
                  {item.tryIt}
                </p>
              </section>
            )}
          </For>
        </div>

        <section class={styles.alsoCard}>
          <h2 class={styles.alsoTitle}>Also in this release</h2>
          <ul class={styles.alsoList}>
            <For each={props.release.alsoIn}>{(line) => <li>{line}</li>}</For>
          </ul>
        </section>

        <div class={styles.footer}>
          <button
            type="button"
            class={styles.primaryBtn}
            onClick={() => props.onClose()}
            data-testid="whats-new-done"
          >
            Start singing
          </button>
          <p class={styles.footNote}>
            {props.release.date} · this page is in the sidebar whenever you want
            it again.
          </p>
        </div>
      </div>
    </div>
  )
}
