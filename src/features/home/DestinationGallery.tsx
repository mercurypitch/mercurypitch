import type { Component, JSX } from 'solid-js'
import { For, Match, Show, Switch } from 'solid-js'
import { Mascot } from '@/components/Mascot'
import type { ActiveTab } from '@/features/tabs/constants'
import { TAB_ANALYSIS, TAB_EXERCISES, TAB_SINGING, } from '@/features/tabs/constants'
import { setActiveTab } from '@/stores/ui-store'
import styles from './DestinationGallery.module.css'

type DestinationVisual = 'practice' | 'karaoke' | 'exercises' | 'analysis'

type DestinationTarget =
  | { kind: 'tab'; tab: ActiveTab }
  | { kind: 'page'; href: string }

export interface HomeDestination {
  target: DestinationTarget
  visual: DestinationVisual
  eyebrow: string
  title: string
  description: string
  action: string
}

export const HOME_DESTINATIONS: readonly HomeDestination[] = [
  {
    target: { kind: 'tab', tab: TAB_SINGING },
    visual: 'practice',
    eyebrow: 'Live workspace',
    title: 'Practice Engine',
    description:
      'Shape every note with live pitch guidance and an instrument-grade practice stage.',
    action: 'Open live practice',
  },
  {
    target: { kind: 'page', href: '/karaoke' },
    visual: 'karaoke',
    eyebrow: 'Your song, your stage',
    title: 'Karaoke',
    description:
      'Load a song, separate the vocal, and perform with lyrics and scoring.',
    action: 'Enter Karaoke',
  },
  {
    target: { kind: 'tab', tab: TAB_EXERCISES },
    visual: 'exercises',
    eyebrow: 'Pitch, ear and timing',
    title: 'Exercises',
    description:
      'Train intervals, range, agility and control with focused musical drills.',
    action: 'Browse exercises',
  },
  {
    target: { kind: 'tab', tab: TAB_ANALYSIS },
    visual: 'analysis',
    eyebrow: 'Voice lab',
    title: 'Advanced Vocal Analysis',
    description:
      'Inspect pitch traces, harmonics, range and consistency in plain language.',
    action: 'Open analysis lab',
  },
]

function Arrow(): JSX.Element {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.8"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <path d="M5 12h14M14 7l5 5-5 5" />
    </svg>
  )
}

function PracticeVisual(): JSX.Element {
  return (
    <div class={styles.practiceVisual} aria-hidden="true">
      <div class={styles.practiceHalo} />
      <svg class={styles.practiceInstruments} viewBox="0 0 720 280" fill="none">
        <defs>
          <linearGradient id="practice-chrome" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="#f8fbff" />
            <stop offset=".24" stop-color="#7d8a99" />
            <stop offset=".48" stop-color="#edf3f8" />
            <stop offset=".72" stop-color="#596778" />
            <stop offset="1" stop-color="#cbd5df" />
          </linearGradient>
          <linearGradient id="practice-guitar-body" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="#7152a6" />
            <stop offset=".46" stop-color="#352a55" />
            <stop offset="1" stop-color="#16192a" />
          </linearGradient>
          <linearGradient id="practice-piano-shell" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#536273" />
            <stop offset=".2" stop-color="#202b38" />
            <stop offset="1" stop-color="#0d131c" />
          </linearGradient>
          <linearGradient id="practice-spectrum" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stop-color="#58a6ff" />
            <stop offset=".5" stop-color="#2dd4bf" />
            <stop offset="1" stop-color="#bc8cff" />
          </linearGradient>
          <pattern
            id="practice-grille"
            width="7"
            height="7"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <path d="M0 0v7M3.5 0v7" stroke="#24303c" stroke-width="1.2" />
          </pattern>
          <filter
            id="practice-instrument-shadow"
            x="-30%"
            y="-30%"
            width="160%"
            height="170%"
          >
            <feDropShadow
              dx="0"
              dy="10"
              stdDeviation="8"
              flood-color="#02050a"
              flood-opacity=".7"
            />
          </filter>
        </defs>

        <path
          class={styles.practicePitchLine}
          d="M-8 112 C56 112 81 79 130 79 S204 140 258 140 323 55 384 55 448 121 510 121 586 79 730 79"
          stroke="url(#practice-spectrum)"
          stroke-width="3"
          stroke-linecap="round"
        />

        <g
          class={styles.guitar}
          transform="translate(90 38) scale(.75) translate(66 12) rotate(-10 66 118)"
          filter="url(#practice-instrument-shadow)"
        >
          <ellipse
            cx="66"
            cy="225"
            rx="53"
            ry="8"
            fill="#03070c"
            opacity=".48"
          />

          {/* A proper six-tuner headstock and fretted neck. */}
          <path
            d="M52 5Q66-3 80 5l-4 25H56L52 5Z"
            fill="url(#practice-chrome)"
            stroke="#e5edf5"
            stroke-width="1.6"
          />
          <path
            d="m57 28 18 .2 4 81H53l4-81Z"
            fill="#242536"
            stroke="#9daaba"
            stroke-width="1.4"
          />
          <path
            d="M57 42h19M56 55h21M55 69h22M55 84h23M54 99h24"
            stroke="#9daaba"
            stroke-width="1"
            opacity=".72"
          />
          <g fill="#e3ebf2" stroke="#5d6a78" stroke-width=".9">
            <circle cx="48" cy="9" r="3.5" />
            <circle cx="47" cy="17" r="3.5" />
            <circle cx="49" cy="25" r="3.5" />
            <circle cx="84" cy="9" r="3.5" />
            <circle cx="85" cy="17" r="3.5" />
            <circle cx="83" cy="25" r="3.5" />
          </g>
          <path
            d="M51 9h-3M52 17h-5M53 25h-4M81 9h3M80 17h5M79 25h4"
            stroke="#c9d3dc"
            stroke-width="2"
            stroke-linecap="round"
          />

          {/* Waisted acoustic body with sound hole, bridge and strings. */}
          <path
            d="M65 91c-25-9-43 7-39 27 2 10 0 17-8 28-18 24-8 62 20 73 9 4 18 6 28 6s19-2 28-6c28-11 38-49 20-73-8-11-10-18-8-28 4-20-14-36-41-27Z"
            fill="url(#practice-guitar-body)"
            stroke="#d5c7ee"
            stroke-width="2.4"
          />
          <path
            d="M65 99c-20-7-33 5-30 20 3 14-5 23-11 34-10 19-2 45 18 55 8 4 16 6 24 6 9 0 17-2 25-6 20-10 28-36 18-55-6-11-14-20-11-34 3-15-10-27-33-20Z"
            stroke="#bc8cff"
            stroke-opacity=".34"
            stroke-width="1.4"
          />
          <circle
            cx="66"
            cy="143"
            r="18"
            fill="#090d15"
            stroke="#c8b7e5"
            stroke-width="2.2"
          />
          <circle
            cx="66"
            cy="143"
            r="22.5"
            stroke="#2dd4bf"
            stroke-opacity=".35"
          />
          <path
            d="M48 177Q66 172 84 177l-2 8H50l-2-8Z"
            fill="#c7b4e5"
            stroke="#f0e8fa"
            stroke-width="1"
          />
          <path
            d="M61 10 61 179M63.5 8 63.5 179M66 7 66 179M68.5 8 68.5 179M71 10 71 179"
            stroke="#f2f5f7"
            stroke-width=".7"
            opacity=".72"
          />
        </g>

        <g
          class={styles.microphone}
          transform="translate(90 38) scale(.75) translate(302 10)"
          filter="url(#practice-instrument-shadow)"
        >
          <ellipse
            cx="57"
            cy="250"
            rx="52"
            ry="8"
            fill="#03070c"
            opacity=".52"
          />
          <path
            d="M17 65v31c0 27 17 43 40 43s40-16 40-43V65"
            stroke="url(#practice-chrome)"
            stroke-width="7"
            stroke-linecap="round"
          />
          <path
            d="M28 21C28 8 40 0 57 0s29 8 29 21v70c0 19-12 31-29 31S28 110 28 91V21Z"
            fill="url(#practice-chrome)"
            stroke="#f5f8fb"
            stroke-width="1.8"
          />
          <path
            d="M36 25c0-10 8-16 21-16s21 6 21 16v60c0 17-8 26-21 26s-21-9-21-26V25Z"
            fill="url(#practice-grille)"
            stroke="#344251"
            stroke-width="1.4"
          />
          <path
            d="M38 30h38M36 45h42M36 60h42M36 75h42M38 90h38"
            stroke="#e6edf3"
            stroke-width="1.1"
            opacity=".48"
          />
          <path
            d="M57 139v88M22 236c16-9 54-9 70 0l7 9H15l7-9Z"
            stroke="url(#practice-chrome)"
            stroke-width="8"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
          <path d="M57 17v84" stroke="#f8fbff" stroke-width="2" opacity=".55" />
        </g>

        <g
          class={styles.piano}
          transform="translate(90 38) scale(.75) translate(445 100)"
          filter="url(#practice-instrument-shadow)"
        >
          <ellipse
            cx="119"
            cy="158"
            rx="105"
            ry="9"
            fill="#03070c"
            opacity=".5"
          />
          <path
            d="M6 24 224 8q8-1 8 7v95L7 126Q0 127 0 119V34q0-9 6-10Z"
            fill="url(#practice-piano-shell)"
            stroke="#d9e4ed"
            stroke-width="2.2"
          />
          <path
            d="m10 66 212-10v50L10 119V66Z"
            fill="#eef3f7"
            stroke="#9aa8b6"
            stroke-width="1.5"
          />
          <path
            d="M10 65 222 55M27 65v53M45 63v54M63 62v54M81 61v54M99 60v53M117 59v53M135 58v53M153 57v52M171 57v51M189 56v51M207 55v51"
            stroke="#718090"
            stroke-width="1.15"
          />
          <path
            d="m21 65 13-.7v28l-13 .8V65Zm36-2.5 13-.7v28l-13 .8V62.5Zm18-1.2 13-.7v28l-13 .8V61.3Zm36-2.2 13-.7v27.8l-13 .8V59.1Zm36-1.8 13-.7v27.5l-13 .8V57.3Zm18-.9 13-.7v27.2l-13 .8V56.4Zm36-1.8 13-.7v27l-13 .8V54.6Z"
            fill="#111822"
            stroke="#273442"
            stroke-width=".8"
          />
          <path
            d="m22 39 96-7M141 30l64-5"
            stroke="#7f92a5"
            stroke-width="2"
            stroke-linecap="round"
          />
          <g fill="#2dd4bf">
            <circle cx="133" cy="31" r="2.5" />
            <circle cx="215" cy="23" r="2.5" />
          </g>
          <path
            d="M32 124 24 156M202 112l9 34"
            stroke="url(#practice-chrome)"
            stroke-width="7"
            stroke-linecap="round"
          />
        </g>
      </svg>
      <div class={styles.practiceMascot}>
        <Mascot state="singing" size={54} title="" />
      </div>
      <span class={`${styles.visualNugget} ${styles.practiceNugget}`}>
        Voice · guitar · keys
      </span>
    </div>
  )
}

function KaraokeVisual(): JSX.Element {
  return (
    <div class={styles.karaokeVisual} aria-hidden="true">
      <div class={styles.karaokeNuggets}>
        <span>Live lyrics</span>
        <span>Pitch score</span>
        <span>Stem-ready</span>
      </div>
      <div class={styles.karaokeLight} />
    </div>
  )
}

function ExercisesVisual(): JSX.Element {
  return (
    <div class={styles.exercisesVisual} aria-hidden="true">
      <svg viewBox="0 0 430 220" fill="none">
        <defs>
          <linearGradient id="exercise-spectrum" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stop-color="#58a6ff" />
            <stop offset=".5" stop-color="#2dd4bf" />
            <stop offset="1" stop-color="#bc8cff" />
          </linearGradient>
          <filter
            id="exercise-glow"
            x="-30%"
            y="-30%"
            width="160%"
            height="160%"
          >
            <feGaussianBlur stdDeviation="4" />
          </filter>
        </defs>
        <g class={styles.staff} opacity=".3">
          <path d="M18 54h394M18 82h394M18 110h394M18 138h394M18 166h394" />
        </g>
        <path
          d="M27 153 C69 153 71 125 108 125 S150 82 190 82 232 139 274 139 317 64 405 64"
          stroke="url(#exercise-spectrum)"
          stroke-width="12"
          opacity=".16"
          filter="url(#exercise-glow)"
        />
        <path
          class={styles.exerciseCurve}
          d="M27 153 C69 153 71 125 108 125 S150 82 190 82 232 139 274 139 317 64 405 64"
          stroke="url(#exercise-spectrum)"
          stroke-width="4"
          stroke-linecap="round"
        />
        <g class={styles.exerciseNotes} fill="#e6edf3">
          <circle cx="27" cy="153" r="7" />
          <circle cx="108" cy="125" r="7" />
          <circle cx="190" cy="82" r="7" />
          <circle cx="274" cy="139" r="7" />
          <circle cx="405" cy="64" r="7" />
        </g>
        <g class={styles.timingTicks}>
          <path d="M27 181v12M81 181v7M135 181v12M189 181v7M243 181v12M297 181v7M351 181v12M405 181v7" />
        </g>
        <path
          d="M108 104q41-34 82-34"
          stroke="#bc8cff"
          stroke-width="1.5"
          stroke-dasharray="4 5"
        />
        <text x="132" y="60" class={styles.intervalText}>
          perfect 5th
        </text>
      </svg>
      <span class={`${styles.visualNugget} ${styles.exerciseNugget}`}>
        Hear it · match it · own it
      </span>
    </div>
  )
}

function AnalysisVisual(): JSX.Element {
  return (
    <div class={styles.analysisVisual} aria-hidden="true">
      <div class={styles.analysisGrid} />
      <svg viewBox="0 0 560 250" fill="none">
        <defs>
          <linearGradient id="analysis-spectrum" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stop-color="#58a6ff" />
            <stop offset=".5" stop-color="#2dd4bf" />
            <stop offset="1" stop-color="#bc8cff" />
          </linearGradient>
        </defs>
        <g class={styles.harmonics}>
          <path d="M16 62 C86 50 126 75 192 58 S307 46 371 66 474 48 544 54" />
          <path d="M16 99 C90 110 132 87 199 102 S309 113 379 92 470 110 544 97" />
          <path d="M16 137 C82 123 138 151 201 134 S311 124 377 143 476 127 544 135" />
        </g>
        <path
          class={styles.analysisTrace}
          d="M16 185 C54 184 62 171 96 174 S138 142 174 149 225 109 264 118 316 91 349 103 399 69 436 78 489 49 544 62"
          stroke="url(#analysis-spectrum)"
          stroke-width="4"
          stroke-linecap="round"
        />
        <path
          d="M16 199h528"
          stroke="#e6edf3"
          stroke-opacity=".22"
          stroke-dasharray="3 8"
        />
        <circle cx="349" cy="103" r="6" fill="#e6edf3" />
        <circle cx="349" cy="103" r="14" stroke="#2dd4bf" stroke-opacity=".5" />
      </svg>
      <div class={styles.analysisMetrics}>
        <span>
          <b>A4</b> 440.0 Hz
        </span>
        <span>
          <b>+6</b> cents
        </span>
        <span>
          <b>H2</b> 0.48
        </span>
      </div>
    </div>
  )
}

function DestinationArtwork(props: { visual: DestinationVisual }): JSX.Element {
  return (
    <Switch>
      <Match when={props.visual === 'practice'}>
        <PracticeVisual />
      </Match>
      <Match when={props.visual === 'karaoke'}>
        <KaraokeVisual />
      </Match>
      <Match when={props.visual === 'exercises'}>
        <ExercisesVisual />
      </Match>
      <Match when={props.visual === 'analysis'}>
        <AnalysisVisual />
      </Match>
    </Switch>
  )
}

function DestinationCover(props: {
  destination: HomeDestination
}): JSX.Element {
  const content = () => (
    <>
      <DestinationArtwork visual={props.destination.visual} />
      <span class={styles.coverShade} aria-hidden="true" />
      <span class={styles.coverCopy}>
        <span class={styles.coverEyebrow}>{props.destination.eyebrow}</span>
        <span class={styles.coverTitle}>{props.destination.title}</span>
        <span class={styles.coverDescription}>
          {props.destination.description}
        </span>
        <span class={styles.coverAction}>
          {props.destination.action}
          <Arrow />
        </span>
      </span>
    </>
  )

  return (
    <Show
      when={props.destination.target.kind === 'page'}
      fallback={
        <button
          type="button"
          class={`${styles.cover} ${styles[props.destination.visual]}`}
          data-destination={props.destination.visual}
          aria-label={`${props.destination.action}: ${props.destination.title}`}
          onClick={() => {
            const target = props.destination.target
            if (target.kind === 'tab') setActiveTab(target.tab)
          }}
        >
          {content()}
        </button>
      }
    >
      <a
        href={
          props.destination.target.kind === 'page'
            ? props.destination.target.href
            : undefined
        }
        class={`${styles.cover} ${styles[props.destination.visual]}`}
        data-destination={props.destination.visual}
        aria-label={`${props.destination.action}: ${props.destination.title}`}
      >
        {content()}
      </a>
    </Show>
  )
}

export const DestinationGallery: Component = () => (
  <section class={styles.section} aria-labelledby="destination-heading">
    <div class={styles.heading}>
      <div>
        <p class={styles.headingEyebrow}>Explore MercuryPitch</p>
        <h2 id="destination-heading">Choose your next room</h2>
      </div>
      <p class={styles.headingCopy}>
        Move from daily practice into performance, focused drills, or a deeper
        look at your voice.
      </p>
    </div>

    <div class={styles.gallery}>
      <svg
        class={styles.mercuryRail}
        viewBox="0 0 1000 620"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path d="M-30 116 C108 25 205 224 332 142 S533 43 634 164 831 244 1034 102 M-16 514 C141 415 231 596 368 486 S565 394 689 510 874 558 1024 462" />
      </svg>

      <For each={HOME_DESTINATIONS}>
        {(destination) => <DestinationCover destination={destination} />}
      </For>
    </div>
  </section>
)

export default DestinationGallery
