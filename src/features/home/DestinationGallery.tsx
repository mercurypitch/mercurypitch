import type { Component, JSX } from 'solid-js'
import { For, Match, Switch } from 'solid-js'
import { Mascot } from '@/components/Mascot'
import type { ActiveTab } from '@/features/tabs/constants'
import { TAB_ANALYSIS, TAB_EXERCISES, TAB_KARAOKE, TAB_SINGING, } from '@/features/tabs/constants'
import { setActiveTab } from '@/stores/ui-store'
import styles from './DestinationGallery.module.css'

type DestinationVisual = 'practice' | 'karaoke' | 'exercises' | 'analysis'

export interface HomeDestination {
  tab: ActiveTab
  visual: DestinationVisual
  eyebrow: string
  title: string
  description: string
  action: string
}

export const HOME_DESTINATIONS: readonly HomeDestination[] = [
  {
    tab: TAB_SINGING,
    visual: 'practice',
    eyebrow: 'Live workspace',
    title: 'Practice Engine',
    description:
      'Shape every note with live pitch guidance and an instrument-grade practice stage.',
    action: 'Open live practice',
  },
  {
    tab: TAB_KARAOKE,
    visual: 'karaoke',
    eyebrow: 'Your song, your stage',
    title: 'Karaoke',
    description:
      'Load a song, separate the vocal, and perform with lyrics and scoring.',
    action: 'Enter Karaoke',
  },
  {
    tab: TAB_EXERCISES,
    visual: 'exercises',
    eyebrow: 'Pitch, ear and timing',
    title: 'Exercises',
    description:
      'Train intervals, range, agility and control with focused musical drills.',
    action: 'Browse exercises',
  },
  {
    tab: TAB_ANALYSIS,
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
      <svg class={styles.practiceInstruments} viewBox="0 0 520 250" fill="none">
        <defs>
          <linearGradient id="practice-chrome" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="#f4f8fd" />
            <stop offset=".42" stop-color="#8a97a6" />
            <stop offset=".72" stop-color="#f4f8fd" />
            <stop offset="1" stop-color="#4b5969" />
          </linearGradient>
          <linearGradient id="practice-spectrum" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stop-color="#58a6ff" />
            <stop offset=".5" stop-color="#2dd4bf" />
            <stop offset="1" stop-color="#bc8cff" />
          </linearGradient>
        </defs>

        <path
          class={styles.practicePitchLine}
          d="M12 146 C62 146 70 112 108 112 S154 174 196 174 245 76 292 76 342 141 390 141 438 111 508 111"
          stroke="url(#practice-spectrum)"
          stroke-width="3"
          stroke-linecap="round"
        />

        <g class={styles.guitar} transform="translate(58 108) rotate(-15)">
          <path
            d="M38 26c15-8 29 2 27 16-2 10 4 15 11 22 12 12 3 37-20 37S24 76 36 64c7-7 13-12 11-22-1-6-5-12-9-16Z"
            fill="rgba(188,140,255,.22)"
            stroke="#c9b4ff"
            stroke-width="2"
          />
          <circle cx="55" cy="70" r="9" stroke="#c9b4ff" stroke-width="2" />
          <path
            d="M50 41 24 6M55 37 29 2M22 7l8-6"
            stroke="url(#practice-chrome)"
            stroke-width="4"
            stroke-linecap="round"
          />
        </g>

        <g class={styles.microphone} transform="translate(236 27)">
          <rect
            x="21"
            y="0"
            width="50"
            height="73"
            rx="25"
            fill="url(#practice-chrome)"
          />
          <path
            d="M31 14h30M27 27h38M26 40h40M30 53h32"
            stroke="#17202b"
            stroke-width="3"
            opacity=".72"
          />
          <path
            d="M18 59v8c0 17 12 29 28 29s28-12 28-29v-8M46 96v65M23 161h46"
            stroke="url(#practice-chrome)"
            stroke-width="7"
            stroke-linecap="round"
          />
        </g>

        <g class={styles.piano} transform="translate(358 133)">
          <path
            d="M2 3h136v63H2z"
            fill="rgba(88,166,255,.16)"
            stroke="#a8ceff"
            stroke-width="2"
          />
          <path
            d="M18 3v63M36 3v63M54 3v63M72 3v63M90 3v63M108 3v63M126 3v63"
            stroke="#a8ceff"
            stroke-width="1.4"
            opacity=".75"
          />
          <path
            d="M12 3h11v36H12zM42 3h11v36H42zM72 3h11v36H72zM102 3h11v36H102z"
            fill="#111722"
          />
          <path
            d="M13 66 6 93M126 66l7 27"
            stroke="url(#practice-chrome)"
            stroke-width="5"
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
        {(destination) => (
          <button
            type="button"
            class={`${styles.cover} ${styles[destination.visual]}`}
            data-destination={destination.visual}
            aria-label={`${destination.action}: ${destination.title}`}
            onClick={() => setActiveTab(destination.tab)}
          >
            <DestinationArtwork visual={destination.visual} />
            <span class={styles.coverShade} aria-hidden="true" />
            <span class={styles.coverCopy}>
              <span class={styles.coverEyebrow}>{destination.eyebrow}</span>
              <span class={styles.coverTitle}>{destination.title}</span>
              <span class={styles.coverDescription}>
                {destination.description}
              </span>
              <span class={styles.coverAction}>
                {destination.action}
                <Arrow />
              </span>
            </span>
          </button>
        )}
      </For>
    </div>
  </section>
)

export default DestinationGallery
