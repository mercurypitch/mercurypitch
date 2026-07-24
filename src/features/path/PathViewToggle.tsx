import type { Component } from 'solid-js'
import { pathView, setPathView } from '@/features/path/path-view'
import styles from './PathViewToggle.module.css'

export const PathViewToggle: Component = () => (
  <div class={styles.wrap}>
    <span class={styles.label}>View</span>
    <div class={styles.control} role="group" aria-label="Choose Path view">
      <button
        type="button"
        class={pathView() === 'ascent' ? styles.selected : ''}
        aria-pressed={pathView() === 'ascent'}
        onClick={() => setPathView('ascent')}
      >
        <svg
          viewBox="0 0 20 20"
          width="15"
          height="15"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          aria-hidden="true"
        >
          <path d="M4 16c2-5 8-7 12-12M5 13l3 3M9 9l3 3M13 5l3 3" />
          <circle cx="4" cy="16" r="1.8" />
          <circle cx="16" cy="4" r="1.8" />
        </svg>
        Ascent
      </button>
      <button
        type="button"
        class={pathView() === 'path' ? styles.selected : ''}
        aria-pressed={pathView() === 'path'}
        onClick={() => setPathView('path')}
      >
        <svg
          viewBox="0 0 20 20"
          width="15"
          height="15"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          aria-hidden="true"
        >
          <path d="M3 5h14M3 10h14M3 15h14" />
          <circle cx="6" cy="5" r="1.8" fill="currentColor" stroke="none" />
          <circle cx="10" cy="10" r="1.8" fill="currentColor" stroke="none" />
          <circle cx="14" cy="15" r="1.8" fill="currentColor" stroke="none" />
        </svg>
        Path
      </button>
    </div>
  </div>
)

export default PathViewToggle
