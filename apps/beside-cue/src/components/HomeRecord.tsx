// ============================================================
// Home record — the brand's record on the deck, the plan's Pull on its label
// ============================================================
//
// The disc is the app icon's record as the landing's `mark.svg` draws it:
// five wide turquoise grooves that leave two dark wedges, the label ring and
// the spindle. The mark paints its disc at radius 170; here it is scaled to
// the landing Plate's 194 so the seat geometry measured for that Plate
// (`HomeScene.module.css`) holds unchanged.
//
// Side A wears the gold label with the plan's Pull centred and cropped by the
// label, the way the landing's Plate shows a Pull edition. A custom Pull has
// no creature, so its label carries the app's ink-drop mark instead; the
// person's own words are never handed a face from the cast. Side B is always
// the pale turquoise, the app's convention (PunchedTimeDial, Plate.astro), so
// a turned record reads at a glance.
//
// The SVG is decorative: the plan is stationary, selectable HTML beside the
// scene, and the label text is far too small to read on a phone anyway. No
// grain filter: feTurbulence under a CSS rotation is the one treatment the
// plan of record asked to keep off the phone until it is profiled.

import { createEffect, createUniqueId, For, onCleanup } from 'solid-js'
import type { ContentPack } from '@/content'
import { DEFAULT_CONTENT_PACK, findPullCharacter } from '@/content'
import { PREMIUM_PULL_IDS } from '@/content/premium-pulls'
import styles from './HomeRecord.module.css'

export type RecordSide = 'A' | 'B'

/**
 * `still` at rest, `spin` while a cue is on its way (the landing's 2 s per
 * revolution), `settle` for the one slowing revolution after a recorded
 * Side B. Reduced motion turns both into cuts through the stylesheet.
 */
export type RecordMotion = 'still' | 'spin' | 'settle'

interface HomeRecordProps {
  side: RecordSide
  motion?: RecordMotion
  /** The plan's Pull. Absent for a self-named Pull, which shows no creature. */
  pullId?: string
  pack?: ContentPack
  /** The settle has finished, or could not run. Called once per settle. */
  onSettled?: () => void
}

const PAPER = '#fff5dd'
const INK = '#241913'
const DISC = '#1c0e07'
const GROOVE = '#027b79'
const LABEL: Readonly<Record<RecordSide, { ring: string; face: string }>> = {
  A: { ring: '#f6d772', face: '#efc13b' },
  B: { ring: '#a9d8d0', face: '#83c5bb' },
}

// mark.svg draws the disc at r 170 in a 400 box; the seat expects r 194.
const MARK_SCALE = 194 / 170
const MARK_SHIFT = 200 - 200 * MARK_SCALE
const RING_RADIUS = 66.15 * MARK_SCALE
const FACE_RADIUS = 58.53 * MARK_SCALE

// The five grooves of mark.svg, verbatim: each is two tapered arcs.
const GROOVES = [
  'M250.4 119.4C224.4 102.9 190.2 100.4 162.1 112.8C134 124.8 112.7 151.1 106.9 181C100.6 211.1 110.4 243.9 132.4 265.3C114.5 242.1 106.7 211.1 113.1 182.3C119.4 154.5 137.8 129 163.8 116.8C190.8 103.4 224.1 105 250.4 119.4ZM149.6 280.6C175.6 297.1 209.8 299.6 237.9 287.2C266 275.2 287.3 248.9 293.1 219C299.4 188.9 289.6 156.1 267.6 134.7C285.5 157.9 293.3 188.9 286.9 217.7C280.6 245.5 262.2 271 236.2 283.2C209.2 296.6 175.9 295 149.6 280.6Z',
  'M259.2 105.3C228.6 85.9 188.5 82.9 155.5 97.5C122.5 111.6 97.4 142.5 90.5 177.7C83.2 213 94.7 251.6 120.6 276.7C99.6 249.4 90.6 213 98.1 179.3C105.4 146.7 127 116.7 157.5 102.3C189.3 86.5 228.3 88.4 259.2 105.3ZM140.8 294.7C171.4 314.1 211.5 317.1 244.5 302.5C277.5 288.4 302.6 257.5 309.5 222.3C316.8 187 305.3 148.4 279.4 123.3C300.4 150.6 309.4 187 301.9 220.7C294.6 253.3 273 283.3 242.5 297.7C210.7 313.5 171.7 311.6 140.8 294.7Z',
  'M268.2 90.8C233 68.4 186.8 64.9 148.6 81.8C110.6 98.1 81.6 133.7 73.8 174.3C65.3 215 78.5 259.5 108.3 288.5C84 257.1 73.5 215 82.1 176C90.6 138.3 115.6 103.7 150.9 87.1C187.6 69 232.6 71.2 268.2 90.8ZM131.8 309.2C167 331.6 213.2 335.1 251.4 318.2C289.4 301.9 318.4 266.3 326.2 225.7C334.7 185 321.5 140.5 291.7 111.5C316 142.9 326.5 185 317.9 224C309.4 261.7 284.4 296.3 249.1 312.9C212.4 331 167.4 328.8 131.8 309.2Z',
  'M276.3 77.9C236.9 52.9 185.2 49 142.6 67.9C100.1 86 67.7 125.9 58.9 171.3C49.3 216.8 64.1 266.5 97.3 299.1C69.1 264.3 56.8 216.8 66.5 172.8C75.8 130.1 104.6 91.2 144.6 72.7C186 52.7 236.5 55.4 276.3 77.9ZM123.7 322.1C163.1 347.1 214.8 351 257.4 332.1C299.9 314 332.3 274.1 341.1 228.7C350.7 183.2 335.9 133.5 302.7 100.9C330.9 135.7 343.2 183.2 333.5 227.2C324.2 269.9 295.4 308.8 255.4 327.3C214 347.3 163.5 344.6 123.7 322.1Z',
  'M285.3 63.5C241.3 35.5 183.5 31.2 135.8 52.3C88.2 72.6 52 117.1 42.2 167.9C31.5 218.8 48.1 274.4 85.2 310.8C53.9 271.8 40.2 218.8 51 169.7C61.5 122 93.5 78.6 138.2 57.8C184.3 35.4 240.8 38.4 285.3 63.5ZM114.7 336.5C158.7 364.5 216.5 368.8 264.2 347.7C311.8 327.4 348 282.9 357.8 232.1C368.5 181.2 351.9 125.6 314.8 89.2C346.1 128.2 359.8 181.2 349 230.3C338.5 278 306.5 321.4 261.8 342.2C215.7 364.6 159.2 361.6 114.7 336.5Z',
]

/**
 * The free cast's files keep the render's transparent margin, the premium
 * cast is cropped to the silhouette (see `pack.ts`), so the same box would
 * draw one cast half the size of the other. Both land whole and centred
 * inside the label's 40-unit clip; a tall or wide creature is cropped by the
 * circle, as on the landing.
 */
function labelArtBox(pullId: string): { offset: number; size: number } {
  const tight = (PREMIUM_PULL_IDS as readonly string[]).includes(pullId)
  return tight ? { offset: 158, size: 84 } : { offset: 152, size: 96 }
}

// The settle is 2 s; if `animationend` never arrives (an animation cut short
// by a hidden tab, a stylesheet that disabled it), the record still reports
// itself settled so the shell can clear the flag.
const SETTLE_FALLBACK_MS = 2600

export function HomeRecord(props: HomeRecordProps) {
  const id = createUniqueId()
  const motion = () => props.motion ?? 'still'
  const label = () => LABEL[props.side]
  const pull = () =>
    findPullCharacter(props.pack ?? DEFAULT_CONTENT_PACK, props.pullId)

  let settleReported = false

  function reportSettled(): void {
    if (settleReported) return
    settleReported = true
    props.onSettled?.()
  }

  createEffect(() => {
    if (motion() !== 'settle') {
      settleReported = false
      return
    }
    const timer = setTimeout(reportSettled, SETTLE_FALLBACK_MS)
    onCleanup(() => clearTimeout(timer))
  })

  return (
    <svg
      class={styles.record}
      classList={{
        [styles.spin]: motion() === 'spin',
        [styles.settle]: motion() === 'settle',
      }}
      viewBox="0 0 400 400"
      aria-hidden="true"
      data-side={props.side}
      data-motion={motion()}
      data-label={pull() === undefined ? 'mark' : pull()?.id}
    >
      <defs>
        <path id={`${id}-t`} d="M148 200 A52 52 0 0 1 252 200" />
        <clipPath id={`${id}-c`}>
          <circle cx="200" cy="200" r="40" />
        </clipPath>
      </defs>
      <g
        class={styles.disc}
        onAnimationEnd={() => {
          if (motion() === 'settle') reportSettled()
        }}
      >
        <circle cx="200" cy="200" r="194" fill="#0f0c0a" />
        <circle cx="200" cy="200" r="192" fill={DISC} />
        <circle
          cx="200"
          cy="200"
          r="189"
          fill="none"
          stroke={PAPER}
          stroke-opacity=".14"
          stroke-width="1.5"
        />
        <g
          fill={GROOVE}
          transform={`matrix(${MARK_SCALE} 0 0 ${MARK_SCALE} ${MARK_SHIFT} ${MARK_SHIFT})`}
        >
          <For each={GROOVES}>{(d) => <path d={d} />}</For>
        </g>
        <circle cx="200" cy="200" r={RING_RADIUS} fill={label().ring} />
        <circle
          cx="200"
          cy="200"
          r={RING_RADIUS}
          fill="none"
          stroke="rgba(0,0,0,0.28)"
          stroke-width="1"
        />
        <circle cx="200" cy="200" r={FACE_RADIUS} fill={label().face} />
        <circle
          cx="200"
          cy="200"
          r={FACE_RADIUS}
          fill="none"
          stroke="rgba(0,0,0,0.14)"
          stroke-width=".8"
        />
        <text
          class={styles.text}
          font-size="11.5"
          letter-spacing="1.6"
          fill={INK}
        >
          <textPath href={`#${id}-t`} startOffset="50%" text-anchor="middle">
            BESIDE CUE · SIDE {props.side}
          </textPath>
        </text>
        {(() => {
          const character = pull()
          if (character === undefined) {
            // The drop of the app icon, in the icon's inks: the label of a
            // record with nobody on it.
            return (
              <g transform="translate(200 200) scale(.72)">
                <path
                  fill={DISC}
                  d="M0-52C22-18 34 0 34 14A34 34 0 1 1-34 14C-34 0-22-18 0-52Z"
                />
                <path
                  fill="#fef7db"
                  d="M-16 2C-20-8-12-20-4-24C-2-16-10-6-12 6Z"
                />
                <circle cx="14" cy="22" r="5" fill="#e42403" />
              </g>
            )
          }
          const box = labelArtBox(character.id)
          return (
            <image
              href={character.token.still}
              x={box.offset}
              y={box.offset}
              width={box.size}
              height={box.size}
              preserveAspectRatio="xMidYMid meet"
              clip-path={`url(#${id}-c)`}
            />
          )
        })()}
        <circle
          cx="200"
          cy="200"
          r="4.5"
          fill={PAPER}
          stroke="rgba(0,0,0,0.45)"
        />
      </g>
    </svg>
  )
}
