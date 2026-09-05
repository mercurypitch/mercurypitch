// ============================================================
// Home pressing — one plan, two sides, the BC-000 companion label
// ============================================================
// THESIS: The saved plan is a tangible two-sided companion pressing.
// OWN-WORLD: BC-000's turquoise grooves, gold label and punched Corky mark.
// STORY: Recognise Side A, turn to the chosen Side B, then Cue me now.
// FIRST VIEWPORT: One record and its primary action fit a small phone.
// FORM: A finite accessible A/B flip; readable copy outside decorative vinyl.
// Keeps the landing research's turquoise grooves and Corky cutout. A bounded
// CSS flip does not create another rendering loop or a second audio owner.
// Plan text stays stationary, selectable HTML outside the decorative vinyl.

import { createSignal, createUniqueId, For } from 'solid-js'
import { useCopy } from '@/i18n/ui-copy'
import { NoSelect, Selectable } from '@/interaction/selection'
import styles from './HomePressing.module.css'

interface HomePressingProps {
  readonly sideA: string
  readonly sideB: string
  readonly paused: boolean
}

const GROOVES = Array.from({ length: 26 }, (_, index) => 84 + index * 4)
const STRIPES = [100, 116, 132, 148, 163, 177, 188]

export function HomePressing(props: HomePressingProps) {
  const copy = useCopy()
  const [side, setSide] = createSignal<'A' | 'B'>('A')
  const id = createUniqueId()

  function face(letter: 'A' | 'B') {
    return (
      <svg
        viewBox="0 0 400 400"
        aria-hidden="true"
        class={letter === 'B' ? styles.back : styles.front}
      >
        <defs>
          <path
            id={`${id}-${letter}-title`}
            d="M148 200 A52 52 0 0 1 252 200"
          />
        </defs>
        <circle cx="200" cy="200" r="194" fill="#0f0c0a" />
        <circle
          cx="200"
          cy="200"
          r="189"
          fill="none"
          stroke="#fff5dd"
          stroke-opacity=".18"
        />
        <For each={GROOVES}>
          {(radius) => (
            <circle
              cx="200"
              cy="200"
              r={radius}
              fill="none"
              stroke="#fff5dd"
              stroke-opacity=".08"
            />
          )}
        </For>
        <For each={STRIPES}>
          {(radius, index) => (
            <circle
              cx="200"
              cy="200"
              r={radius}
              fill="none"
              pathLength="360"
              stroke="#1b8482"
              stroke-width={2.2 + index() * 0.75}
              stroke-dasharray="175 185"
              stroke-dashoffset="-130"
              stroke-linecap="round"
            />
          )}
        </For>
        <circle
          cx="200"
          cy="200"
          r="70"
          fill={letter === 'A' ? '#efc13b' : '#83c5bb'}
        />
        <circle
          cx="200"
          cy="200"
          r="63"
          fill="none"
          stroke="#241913"
          stroke-opacity=".3"
        />
        <text
          fill="#241913"
          font-size="11"
          letter-spacing="1.5"
          text-anchor="middle"
        >
          <textPath href={`#${id}-${letter}-title`} startOffset="50%">
            BESIDE CUE · SIDE {letter}
          </textPath>
        </text>
        <g transform="translate(200 200) scale(.73)">
          <path
            fill="#00777d"
            d="M0-52C22-18 34 0 34 14A34 34 0 1 1-34 14C-34 0-22-18 0-52Z"
          />
          <path
            fill="#fff5dd"
            opacity=".6"
            d="M-16 2C-20-8-12-20-4-24C-2-16-10-6-12 6Z"
          />
          <circle cx="14" cy="22" r="5" fill="#c93513" />
        </g>
        <text
          x="200"
          y="248"
          text-anchor="middle"
          fill="#241913"
          font-size="10"
          letter-spacing="1.5"
        >
          CORKY · BC-000
        </text>
        <circle cx="200" cy="200" r="4.5" fill="#fff5dd" />
      </svg>
    )
  }
  return (
    <section class={styles.pressing} aria-label={copy.t('Your current plan')}>
      <div class={styles.topline}>
        <span>COMPANION PRESSING · BC-000</span>
        <span>{copy.t(props.paused ? 'Paused' : 'Ready')}</span>
      </div>
      <div class={styles.record} {...NoSelect} data-callout="none">
        <div
          class={styles.flip}
          classList={{ [styles.flipped]: side() === 'B' }}
        >
          {face('A')}
          {face('B')}
        </div>
      </div>
      <div class={styles.sides} role="group" aria-label={copy.t('Record side')}>
        <button
          type="button"
          aria-pressed={side() === 'A'}
          onClick={() => setSide('A')}
        >
          {copy.t('Side A · The Pull')}
        </button>
        <button
          type="button"
          aria-pressed={side() === 'B'}
          onClick={() => setSide('B')}
        >
          {copy.t('Side B · My choice')}
        </button>
      </div>
      <p class={styles.plan} {...Selectable}>
        {side() === 'A' ? props.sideA : props.sideB}
      </p>
    </section>
  )
}
