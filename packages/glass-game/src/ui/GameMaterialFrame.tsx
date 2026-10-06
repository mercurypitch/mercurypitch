// Game material geometry — fixed bevels and flowing enamel edges share one responsive surface boundary.
import { createMemo, createUniqueId, For, Show } from 'solid-js'
import styles from './GameUI.module.css'
import enamel from './materials/c3-enamel.webp'

export type GameSurfaceKind = 'panel' | 'plaque' | 'tile'
type Point = readonly [number, number]
const number = (value: number): number => Math.round(value * 100) / 100
const point = (value: Point): string =>
  `${number(value[0])},${number(value[1])}`
const polygon = (points: readonly Point[]): string =>
  `M${points.map(point).join('L')}Z`

function crystalPoints(
  width: number,
  height: number,
  corner: number,
  inset: number,
): Point[] {
  const cut = Math.max(inset, corner + inset * (Math.SQRT2 - 1))
  return [
    [cut, inset],
    [width - cut, inset],
    [width - inset, cut],
    [width - inset, height - cut],
    [width - cut, height - inset],
    [cut, height - inset],
    [inset, height - cut],
    [inset, cut],
  ]
}

function enamelPath(
  width: number,
  height: number,
  inset: number,
  sculpted: boolean,
  corner: number,
): string {
  const left = inset
  const top = inset
  const right = width - inset
  const bottom = height - inset
  const radius = Math.min(
    corner + 6 - inset * 0.35,
    (bottom - top) / 3,
    (right - left) / 5,
  )
  if (!sculpted)
    return `M${left + radius},${top}H${right - radius}Q${right},${top} ${right},${top + radius}V${bottom - radius}Q${right},${bottom} ${right - radius},${bottom}H${left + radius}Q${left},${bottom} ${left},${bottom - radius}V${top + radius}Q${left},${top} ${left + radius},${top}Z`
  const shoulder = Math.min(10, height * 0.065)
  return `M${left + radius + shoulder},${top}H${right - radius - shoulder}Q${right - shoulder},${top} ${right - shoulder},${top + radius}V${bottom - 38}C${right - shoulder},${bottom - 23} ${right},${bottom - 23} ${right},${bottom - 14}Q${right},${bottom} ${right - 18},${bottom}H${left + 18}Q${left},${bottom} ${left},${bottom - 14}C${left},${bottom - 23} ${left + shoulder},${bottom - 23} ${left + shoulder},${bottom - 38}V${top + radius}Q${left + shoulder},${top} ${left + radius + shoulder},${top}Z`
}

export function GameMaterialFrame(props: {
  width: number
  height: number
  corner: number
  kind: GameSurfaceKind
  theme: 'light' | 'dark'
}) {
  const id = `game-frame-${createUniqueId()}`
  const geometry = createMemo(() => {
    const width = Math.max(20, props.width)
    const height = Math.max(20, props.height)
    const compact = props.kind !== 'panel'
    const corner = Math.min(
      compact ? (props.kind === 'tile' ? 8 : 12) : props.corner,
      width / 5,
      height / 4,
    )
    const bevel = Math.min(compact ? 4.5 : 8, height / 8, width / 8)
    const outer = crystalPoints(width, height, corner, 1)
    const middle = crystalPoints(width, height, corner, 1 + bevel * 0.45)
    const inner = crystalPoints(width, height, corner, 1 + bevel)
    const facets = outer.map((value, index) => {
      const next = (index + 1) % outer.length
      return {
        path: polygon([value, outer[next]!, inner[next]!, inner[index]!]),
        index,
      }
    })
    const sculpted =
      props.kind === 'panel' && width / height > 2.7 && height >= 100
    return {
      width,
      height,
      bevel,
      outer,
      middle,
      inner,
      facets,
      sculpted,
      crystal: polygon(outer),
      crystalMiddle: polygon(middle),
      crystalInner: polygon(inner),
      enamel: enamelPath(width, height, 1, sculpted, corner),
      enamelMiddle: enamelPath(width, height, 3.1, sculpted, corner),
      enamelInner: enamelPath(width, height, 7.1, sculpted, corner),
      isEnamel: props.theme === 'dark' && props.kind === 'panel',
    }
  })
  const boundary = () =>
    geometry().isEnamel ? geometry().enamel : geometry().crystal
  const innerBoundary = () =>
    geometry().isEnamel ? geometry().enamelInner : geometry().crystalInner
  const enamelFlow = (side: 'left' | 'right', offset: number): string => {
    const { width, height } = geometry()
    const x = side === 'left' ? offset : width - offset
    const direction = side === 'left' ? 1 : -1
    const bend = Math.min(23, height * 0.13)
    return `M${x + direction * 26},9C${x - direction * 3},16 ${x - direction * 1},${height * 0.22} ${x + direction * 4},${height * 0.36}C${x + direction * bend},${height * 0.59} ${x - direction * 5},${height * 0.72} ${x + direction * 3},${height - 25}Q${x + direction * 5},${height - 12} ${x + direction * 28},${height - 8}`
  }
  return (
    <svg
      class={styles.materialFrame}
      data-game-frame={props.kind}
      data-frame-finish={geometry().isEnamel ? 'enamel' : 'facet'}
      viewBox={`0 0 ${geometry().width} ${geometry().height}`}
      preserveAspectRatio="none"
      aria-hidden="true"
      tabIndex={-1}
    >
      <defs>
        <clipPath id={`${id}-outline`}>
          <path d={boundary()} />
        </clipPath>
        <clipPath id={`${id}-face`}>
          <path d={innerBoundary()} />
        </clipPath>
        <linearGradient id={`${id}-facet`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="var(--game-facet-bright)" />
          <stop offset=".19" stop-color="var(--game-facet-mid)" />
          <stop offset=".38" stop-color="var(--game-facet-soft)" />
          <stop offset=".57" stop-color="var(--game-facet-deep)" />
          <stop offset=".74" stop-color="#c8efec" />
          <stop offset="1" stop-color="#faffec" />
        </linearGradient>
        <linearGradient id={`${id}-facet-cross`} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stop-color="#246777" />
          <stop offset=".28" stop-color="#e1fff8" />
          <stop offset=".5" stop-color="#69b1b8" />
          <stop offset=".73" stop-color="#fafff2" />
          <stop offset="1" stop-color="#256575" />
        </linearGradient>
        <linearGradient id={`${id}-gold`} x1="0" y1="0" x2=".65" y2="1">
          <stop offset="0" stop-color="#b79543" />
          <stop offset=".18" stop-color="#fff1bd" />
          <stop offset=".42" stop-color="#c3a45d" />
          <stop offset=".64" stop-color="#fff3c5" />
          <stop offset=".85" stop-color="#8e6a25" />
          <stop offset="1" stop-color="#e7cf91" />
        </linearGradient>
        <linearGradient id={`${id}-wash`} x1="0" y1="0" x2=".9" y2="1">
          <stop offset="0" stop-color="#fffef0" stop-opacity=".68" />
          <stop offset=".24" stop-color="#ecfffc" stop-opacity=".08" />
          <stop offset=".48" stop-color="#fff" stop-opacity=".02" />
          <stop offset=".74" stop-color="#c4ece4" stop-opacity=".2" />
          <stop offset="1" stop-color="#efffeb" stop-opacity=".08" />
        </linearGradient>
        <radialGradient
          id={`${id}-glint`}
          cx="0"
          cy="0"
          r="1"
          gradientTransform="translate(.055 .035) scale(.43 .28)"
        >
          <stop offset="0" stop-color="#f6fff8" stop-opacity=".85" />
          <stop offset=".11" stop-color="#bcf0e4" stop-opacity=".44" />
          <stop offset=".48" stop-color="#6fc4bb" stop-opacity=".08" />
          <stop offset="1" stop-color="#5fa79d" stop-opacity="0" />
        </radialGradient>
      </defs>
      <g clip-path={`url(#${id}-outline)`}>
        <path class={styles.materialBacking} d={boundary()} />
        <Show when={props.theme === 'dark'}>
          <image
            class={styles.enamelReflection}
            href={enamel}
            width={geometry().width}
            height={geometry().height}
            preserveAspectRatio="none"
          />
        </Show>
        <path
          class={styles.materialWash}
          d={boundary()}
          fill={`url(#${id}-wash)`}
        />
        <Show
          when={geometry().isEnamel}
          fallback={
            <g class={styles.crystalBevel}>
              <For each={geometry().facets}>
                {(facet) => (
                  <path
                    d={facet.path}
                    fill={`url(#${id}-${facet.index % 2 === 0 ? 'facet' : 'facet-cross'})`}
                  />
                )}
              </For>
              <path
                d={geometry().crystalMiddle}
                fill="none"
                stroke="#f6fff3"
                stroke-width=".8"
              />
              <For each={geometry().outer}>
                {(vertex, index) => (
                  <path
                    d={`M${point(vertex)}L${point(geometry().inner[index()]!)}`}
                    stroke={index() % 2 === 0 ? '#fcfff4' : '#428c94'}
                    stroke-width=".75"
                  />
                )}
              </For>
              <path
                d={geometry().crystal}
                fill="none"
                stroke="#4c969e"
                stroke-width=".8"
              />
              <Show when={props.theme === 'dark'}>
                <path
                  d={geometry().crystal}
                  class={styles.materialGold}
                  fill="none"
                  stroke={`url(#${id}-gold)`}
                  stroke-width="1.5"
                />
              </Show>
              <path
                d={geometry().crystalInner}
                class={styles.materialGold}
                fill="none"
                stroke={`url(#${id}-gold)`}
                stroke-width="1.05"
              />
            </g>
          }
        >
          <path
            d={geometry().enamel}
            fill="none"
            stroke="#193f3d"
            stroke-width="5"
          />
          <path
            d={geometry().enamel}
            class={styles.materialGold}
            fill="none"
            stroke={`url(#${id}-gold)`}
            stroke-width="2.7"
          />
          <path
            d={geometry().enamelMiddle}
            fill="none"
            stroke="#fff3ca"
            stroke-width=".7"
          />
          <path
            d={geometry().enamelInner}
            fill="none"
            stroke="#57a9a7"
            stroke-width="1.2"
            opacity=".68"
          />
          <path
            d={boundary()}
            class={styles.enamelGlint}
            fill={`url(#${id}-glint)`}
          />
          <g class={styles.enamelContours}>
            <For each={['left', 'right'] as const}>
              {(side) => (
                <>
                  <path
                    d={enamelFlow(side, 9)}
                    stroke="#93ded4"
                    stroke-width="1.15"
                  />
                  <path
                    d={enamelFlow(side, 14)}
                    stroke="#153d3d"
                    stroke-width="2.7"
                  />
                  <path
                    d={enamelFlow(side, 17)}
                    stroke="#5bacaa"
                    stroke-width=".8"
                  />
                </>
              )}
            </For>
          </g>
          <path
            d={`M13,${Math.min(38, geometry().height / 3)}Q13,13 39,9C57,6 86,7 117,8`}
            class={styles.enamelSpecular}
          />
        </Show>
      </g>
    </svg>
  )
}
