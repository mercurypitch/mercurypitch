// Glassworks tutorial — two skippable pages teaching movement before voice.
import { createSignal, Show } from 'solid-js'
import type { LevelTutorialDefinition } from '../contracts'
import { focusDialog, trapDialogKeys } from './dialog-focus'
import styles from './GlassAdventure.module.css'

interface TutorialProps {
  content?: LevelTutorialDefinition
  autoRun?: boolean
  onClose(): void
}
export function Tutorial(props: TutorialProps) {
  const [page, setPage] = createSignal(0)
  return (
    <div class={styles.scrim}>
      <section
        class={styles.tutorial}
        ref={focusDialog}
        onKeyDown={trapDialogKeys}
        role="dialog"
        aria-modal="true"
        aria-labelledby="glass-tutorial-title"
      >
        <button
          class={styles.skip}
          type="button"
          onClick={() => props.onClose()}
        >
          Skip tutorial
        </button>
        <svg
          class={styles.tutorialDrawing}
          viewBox="0 0 420 180"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="tutorial-glass" x2="0.7" y2="1">
              <stop stop-color="#effcf6" />
              <stop offset="0.5" stop-color="#76b9bd" />
              <stop offset="1" stop-color="#276475" />
            </linearGradient>
          </defs>
          <path
            d="M30 144 135 119l80 23-100 25Z M237 142l81-22 75 19-83 25Z"
            fill="#e6ddc8"
            stroke="#b48d42"
            stroke-width="2"
          />
          <Show
            when={page() === 0}
            fallback={
              <>
                <path
                  d="M289 56c-30 0-37 49-11 61l11 4v18m-16 0h32m-40-79h48"
                  fill="url(#tutorial-glass)"
                  stroke="#629e9f"
                  stroke-width="3"
                />
                <path
                  d="M173 93q22-32 44 0t44 0M173 106q22-32 44 0t44 0"
                  fill="none"
                  stroke="#c69e53"
                  stroke-width="3"
                />
                <path
                  d="m293 62-9 20 14 8-13 16"
                  fill="none"
                  stroke="#fff6d5"
                  stroke-width="3"
                />
              </>
            }
          >
            <path
              d="M152 104Q218 8 281 98"
              fill="none"
              stroke="#b48d42"
              stroke-width="2"
              stroke-dasharray="5 7"
            />
            <path
              d="m270 95 13 6 1-15"
              fill="none"
              stroke="#b48d42"
              stroke-width="2"
            />
          </Show>
          <path
            d="M100 61c-4 25-24 28-24 53a31 31 0 0 0 62 0c0-23-21-32-23-57-6 7-12 7-15 4Z"
            fill="url(#tutorial-glass)"
            stroke="#7aa5a9"
            stroke-width="2"
          />
          <ellipse cx="98" cy="106" rx="4" ry="7" fill="#173b48" />
          <ellipse cx="119" cy="106" rx="4" ry="7" fill="#173b48" />
          <path
            d="M103 120q6 5 11-1"
            fill="none"
            stroke="#173b48"
            stroke-width="2"
          />
        </svg>
        <h2 id="glass-tutorial-title">
          {props.content?.pages[page()].title ??
            (page() === 0
              ? 'A little room to wander.'
              : 'A little note can break glass.')}
        </h2>
        <p>
          {props.content?.pages[page()].body ??
            (page() === 0
              ? 'Move Merc with WASD or the arrows. Press Space to jump. Drag the view to look around. On a phone, use the thumbstick and Jump.'
              : 'Walk onto a glowing circle and choose Sing. Hum a comfortable note; the glass learns it. Listen, hold that note gently, and watch the cracks bloom.')}
        </p>
        <p class={styles.tutorialAside}>
          {props.content?.pages[page()].aside ??
            (page() === 0
              ? props.autoRun === true
                ? 'Keep moving to ease into a run; small thumbstick moves stay gentle. Falls return you to safety.'
                : 'Miss a jump? You return to a safe spot. Your broken glass stays broken.'
              : 'No shouting and no rush. Cancel whenever you want to take a breath.')}
        </p>
        <div class={styles.tutorialBottom}>
          <span>{page() + 1} of 2</span>
          <button
            type="button"
            class={styles.primary}
            onClick={() => (page() === 0 ? setPage(1) : props.onClose())}
          >
            {page() === 0 ? 'Next' : 'Enter the museum'}
          </button>
        </div>
      </section>
    </div>
  )
}
