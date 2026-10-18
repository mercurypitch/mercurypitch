// Museum brand keeps the reference crest, lettering, and tagline legible above the live map.

import wordmarkUrl from './brand/glassworks-wordmark.svg'
import styles from './MuseumBrand.module.css'

export function MuseumBrand() {
  return (
    <div class={styles.brand} data-museum-brand>
      <svg class={styles.crest} viewBox="0 0 180 100" aria-hidden="true">
        <g class={styles.crestLines}>
          <path d="M3 49h41m92 0h41M90 3v3m0 86v5" />
          <path d="M90.00 28.00l0.00 -22.00 M94.68 25.46l0.98 -4.90 M98.04 29.60l5.74 -13.86 M103.33 29.04l2.78 -4.16 M104.85 34.15l15.56 -15.56 M109.96 35.67l4.16 -2.78 M109.40 40.96l13.86 -5.74 M113.54 44.32l4.90 -0.98 M111.00 49.00l22.00 0.00 M113.54 53.68l4.90 0.98 M109.40 57.04l13.86 5.74 M109.96 62.33l4.16 2.78 M104.85 63.85l15.56 15.56 M103.33 68.96l2.78 4.16 M98.04 68.40l5.74 13.86 M94.68 72.54l0.98 4.90 M90.00 70.00l0.00 22.00 M85.32 72.54l-0.98 4.90 M81.96 68.40l-5.74 13.86 M76.67 68.96l-2.78 4.16 M75.15 63.85l-15.56 15.56 M70.04 62.33l-4.16 2.78 M70.60 57.04l-13.86 5.74 M66.46 53.68l-4.90 0.98 M69.00 49.00l-22.00 0.00 M66.46 44.32l-4.90 -0.98 M70.60 40.96l-13.86 -5.74 M70.04 35.67l-4.16 -2.78 M75.15 34.15l-15.56 -15.56 M76.67 29.04l-2.78 -4.16 M81.96 29.60l-5.74 -13.86 M85.32 25.46l-0.98 -4.90" />
          <circle cx="90" cy="49" r="17" />
          <path d="m90 31 3.7 13.2L106 49l-12.3 4.8L90 67l-3.7-13.2L74 49l12.3-4.8Z" />
        </g>
        <g class={styles.crestPoints}>
          <path d="m1 49 3-1.8L7 49l-3 1.8Zm172 0 3-1.8 3 1.8-3 1.8ZM90 0l1.7 3L90 6l-1.7-3Z" />
          <circle cx="90" cy="49" r="1.65" />
        </g>
      </svg>
      <h1 id="glass-campaign-title" class={styles.wordmark}>
        <img src={wordmarkUrl} width="380" height="68.17" alt="Glassworks" />
      </h1>
      <svg class={styles.divider} viewBox="0 0 240 22" aria-hidden="true">
        <path class={styles.dividerLines} d="M2 11h102m32 0h102" />
        <path
          class={styles.crestPoints}
          d="m120 1 2.4 7.2 5.8-3.4-3.4 5.2L132 12l-7.2 1.2 3.4 5.8-5.8-3.4L120 22l-2.4-6.4-5.8 3.4 3.4-5.8L108 12l7.2-2-3.4-5.2 5.8 3.4Z"
        />
        <circle class={styles.crestPoints} cx="2" cy="11" r="1" />
        <circle class={styles.crestPoints} cx="238" cy="11" r="1" />
      </svg>
      <p class={styles.tagline}>
        Find your voice <span>in a brighter world.</span>
      </p>
    </div>
  )
}
