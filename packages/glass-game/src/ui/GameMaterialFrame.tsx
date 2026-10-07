// Generated glass materials — clipped source artwork with fixed-size corners at every viewport.
import { createMemo, createUniqueId, For } from 'solid-js'
import { GAME_MATERIAL_ART } from './game-material-art'
import styles from './GameUI.module.css'

export type GameSurfaceKind = 'panel' | 'plaque' | 'tile' | 'lens' | 'pill'
export type GamePanelShape = 'console' | 'settings'

function patchAxis(
  start: number,
  length: number,
  before: number,
  after: number,
  scale: number,
  size: number,
) {
  // Fractional viewport edges antialias each translucent patch independently.
  // Move both destination and source cuts together to keep corner paint isotropic.
  const first = Math.min(size, Math.round(before * scale))
  const last = Math.max(first, Math.min(size, Math.round(size - after * scale)))
  return {
    source: [
      start,
      start + first / scale,
      start + length - (size - last) / scale,
      start + length,
    ],
    target: [0, first, last, size],
  }
}

export function GameMaterialFrame(props: {
  width: number
  height: number
  corner: number
  kind: GameSurfaceKind
  shape?: GamePanelShape
  theme: 'light' | 'dark'
}) {
  const id = `game-frame-${createUniqueId()}`
  const art = createMemo(() => {
    const theme = props.theme === 'dark' ? 'c3' : 'b1'
    if (props.kind === 'lens') return GAME_MATERIAL_ART[`${theme}-note-lens`]
    if (props.kind === 'pill') return GAME_MATERIAL_ART[`${theme}-action-pill`]
    if (props.kind === 'tile' || (props.kind === 'plaque' && theme === 'c3'))
      return GAME_MATERIAL_ART[`${theme}-museum-tile`]
    if (props.kind === 'plaque') return GAME_MATERIAL_ART['b1-museum-plaque']
    const shape =
      props.shape ?? (props.width / props.height > 2.7 ? 'console' : 'settings')
    if (shape === 'settings' && props.width / props.height < 1.5)
      return GAME_MATERIAL_ART[`${theme}-portrait-master`]
    return GAME_MATERIAL_ART[`${theme}-${shape}-master`]
  })
  const patches = createMemo(() => {
    const source = art()
    const { bounds, slice } = source
    if (props.kind === 'lens' || props.kind === 'tile')
      return [
        {
          x: 0,
          y: 0,
          width: props.width,
          height: props.height,
          viewBox: `${bounds.x} ${bounds.y} ${bounds.width} ${bounds.height}`,
        },
      ]
    // Pills preserve the complete vertical paint. Only the center stretches sideways.
    if (props.kind === 'pill') {
      const scale = Math.min(
        props.height / bounds.height,
        props.width / (slice.left + slice.right),
      )
      const { source: sourceX, target: targetX } = patchAxis(
        bounds.x,
        bounds.width,
        slice.left,
        slice.right,
        scale,
        props.width,
      )
      return [0, 1, 2]
        .map((column) => ({
          x: targetX[column]!,
          y: 0,
          width: targetX[column + 1]! - targetX[column]!,
          height: props.height,
          viewBox: `${sourceX[column]} ${bounds.y} ${sourceX[column + 1]! - sourceX[column]!} ${bounds.height}`,
        }))
        .filter((patch) => patch.width > 0 && patch.height > 0)
    }
    // Keep painted corner facets at one scale; only straight center strips stretch.
    // The console's flowing lower corners need their full height, not a small
    // settings-style radius. The shared corner control still scales the artwork.
    const consoleEdge =
      props.width < 600
        ? Math.min(65, props.corner * 2.2)
        : Math.min(135, props.corner * 4.8)
    const edge =
      props.kind === 'plaque'
        ? 12
        : source.id === 'c3-console-master'
          ? consoleEdge
          : props.corner * 1.8
    const scale = Math.min(
      edge / Math.max(slice.left, slice.right, slice.top, slice.bottom),
      props.width / (slice.left + slice.right),
      props.height / (slice.top + slice.bottom),
    )
    const { source: sx, target: dx } = patchAxis(
      bounds.x,
      bounds.width,
      slice.left,
      slice.right,
      scale,
      props.width,
    )
    const { source: sy, target: dy } = patchAxis(
      bounds.y,
      bounds.height,
      slice.top,
      slice.bottom,
      scale,
      props.height,
    )
    return [0, 1, 2]
      .flatMap((row) =>
        [0, 1, 2].map((column) => ({
          x: dx[column]!,
          y: dy[row]!,
          width: dx[column + 1]! - dx[column]!,
          height: dy[row + 1]! - dy[row]!,
          viewBox: `${sx[column]} ${sy[row]} ${sx[column + 1]! - sx[column]!} ${sy[row + 1]! - sy[row]!}`,
        })),
      )
      .filter((patch) => patch.width > 0 && patch.height > 0)
  })
  return (
    <svg
      class={styles.materialFrame}
      data-game-frame={props.kind}
      data-frame-finish={
        props.kind === 'panel' && props.theme === 'dark' ? 'enamel' : 'facet'
      }
      data-material-art={art().id}
      viewBox={`0 0 ${props.width} ${props.height}`}
      preserveAspectRatio="none"
      aria-hidden="true"
      tabIndex={-1}
    >
      <defs>
        <clipPath id={`${id}-outline`}>
          <path d={art().silhouettePath} />
        </clipPath>
        <mask
          id={`${id}-rim`}
          maskUnits="userSpaceOnUse"
          x="0"
          y="0"
          width={art().sourceWidth}
          height={art().sourceHeight}
        >
          <path
            d={art().silhouettePath}
            fill="none"
            stroke="white"
            stroke-width={
              Math.min(art().bounds.width, art().bounds.height) * 0.15
            }
          />
        </mask>
      </defs>
      <For each={patches()}>
        {(patch) => (
          <svg
            x={patch.x}
            y={patch.y}
            width={patch.width}
            height={patch.height}
            style={{ width: `${patch.width}px`, height: `${patch.height}px` }}
            viewBox={patch.viewBox}
            preserveAspectRatio="none"
            overflow="hidden"
          >
            <g clip-path={`url(#${id}-outline)`}>
              <path class={styles.materialBacking} d={art().silhouettePath} />
              <image
                class={styles.materialArtwork}
                href={art().url}
                preserveAspectRatio="none"
                width={art().sourceWidth}
                height={art().sourceHeight}
              />
              <image
                class={styles.materialArtworkRim}
                mask={`url(#${id}-rim)`}
                href={art().url}
                preserveAspectRatio="none"
                width={art().sourceWidth}
                height={art().sourceHeight}
              />
            </g>
          </svg>
        )}
      </For>
    </svg>
  )
}
