// ============================================================
// AlleyDoor — one of the six doors on the stage, in its own box
// ============================================================
//
// What a picked door draws over the plate: the plate's own pixels clipped to
// its quad, which the Ear Lab drifts; the Sing door's loop mapped through the
// quad's homography; the rim, and the room's light on the cobbles. alley.css
// shows each from the classes and custom properties set here. At rest none
// of it shows, and the plate under it is the door.
//
// RoomsAlley decides every state behind the flags. The Sing door's <video>
// is handed up through `clipRef`: the tap gives it its source and plays it,
// and the open carries it into the clone.

import type { JSX } from 'solid-js'
import { createMemo, Show } from 'solid-js'
import type { CoverFit, DoorLayout } from './alley-geometry'
import { artBox, doorBox, matrix3d, quadIn, rectToQuad, spillAt, } from './alley-geometry'
import type { DoorSpec, Quad } from './alley-plate'

export interface AlleyDoorProps {
  spec: DoorSpec
  layout: () => DoorLayout
  /** The plate as the alley draws it: the paint is a copy in the same place. */
  fit: () => CoverFit
  plateSrc: () => string
  plateStyle: () => Record<string, string>
  lifted: () => boolean
  selected: () => boolean
  alive: () => boolean
  settling: () => boolean
  /** The Sing door's clip, for the tap that plays it. */
  clipRef: (element: HTMLVideoElement) => void
}

const quadCss = (quad: Quad): string =>
  `polygon(${quad.map((p) => `${p[0]}px ${p[1]}px`).join(', ')})`

export function AlleyDoor(props: AlleyDoorProps): JSX.Element {
  const door = (): DoorLayout => props.layout()
  const artW = (): number => artBox(door()).w
  const artH = (): number => artBox(door()).h
  // The door is its own box, not the screen: what it draws is
  // placed in that box's coordinates (doorBox says why).
  const box = createMemo(() => doorBox(door()))
  const quad = (): Quad => quadIn(door().quad, box().x, box().y)
  const spill = (): { x: number; y: number; w: number } => spillAt(door())
  const points = (): string =>
    quad()
      .map((p) => `${p[0]},${p[1]}`)
      .join(' ')
  return (
    <div
      class="mp-alley__door"
      data-door={props.spec.key}
      data-locked={props.spec.tab === null ? 'yes' : 'no'}
      classList={{
        'is-lifted': props.lifted(),
        'is-selected': props.selected(),
        'is-alive': props.alive(),
        'is-settling': props.settling(),
        'is-drifting': props.spec.drift,
      }}
      style={{
        left: `${box().x}px`,
        top: `${box().y}px`,
        width: `${box().w}px`,
        height: `${box().h}px`,
        '--cx': `${door().cx - box().x}px`,
        '--cy': `${door().cy - box().y}px`,
        // The same centre in the paint <img>'s own box, which starts
        // at (-ox, -oy) on screen: where the Ear Lab's drift pivots.
        '--px': `${door().cx + props.fit().ox}px`,
        '--py': `${door().cy + props.fit().oy}px`,
        '--sx': `${spill().x - box().x}px`,
        '--sy': `${spill().y - box().y}px`,
        '--sw': `${spill().w}px`,
        '--spill': props.spec.spill,
      }}
    >
      <div class="mp-alley__paint" style={{ 'clip-path': quadCss(quad()) }}>
        <img
          src={props.plateSrc()}
          alt=""
          style={{
            ...props.plateStyle(),
            left: `${-props.fit().ox - box().x}px`,
            top: `${-props.fit().oy - box().y}px`,
          }}
        />
      </div>
      <Show when={props.spec.clip !== null}>
        <div
          class="mp-alley__art"
          style={{
            width: `${artW()}px`,
            height: `${artH()}px`,
            transform: matrix3d(rectToQuad(artW(), artH(), quad())),
          }}
        >
          <video
            ref={(element) => {
              props.clipRef(element)
              element.muted = true
              element.defaultMuted = true
            }}
            class="mp-alley__clip"
            muted
            loop
            playsinline
            preload="auto"
            disablepictureinpicture
            tabIndex={-1}
            data-testid="alley-clip"
          />
        </div>
      </Show>
      <svg class="mp-alley__rim" viewBox={`0 0 ${box().w} ${box().h}`}>
        <polygon class="mp-alley__rim-halo" points={points()} />
        <polygon class="mp-alley__rim-line" points={points()} />
      </svg>
      <div class="mp-alley__spill" />
    </div>
  )
}
