// ============================================================
// NavGizmo — corner camera controller for the 3D tab view
// ============================================================
//
// A small overlay in the corner of the 3D view: a draggable axis cross that
// shows the current orientation and orbits the camera, plus pan/zoom/reset
// buttons. Mirrors the direct drag/wheel interaction on the main canvas.

import type { Accessor, JSX } from 'solid-js'
import { createMemo, createSignal, For } from 'solid-js'
import type { CameraState } from '../renderer/camera'
import { cameraBasis } from '../renderer/camera'

export type GizmoAxis = 'X' | 'Y' | 'Z'

export interface NavGizmoProps {
  camera: Accessor<CameraState>
  onOrbit: (dx: number, dy: number) => void
  onPan: (dx: number, dy: number) => void
  /** deltaY semantics match a wheel event: positive zooms out. */
  onZoom: (deltaY: number) => void
  onReset: () => void
  /** Clicking an axis ball reorients the camera to look along that axis. */
  onSnapAxis: (axis: GizmoAxis) => void
}

const AXES: { key: GizmoAxis; vec: [number, number, number]; color: string }[] =
  [
    { key: 'X', vec: [1, 0, 0], color: '#ff5d5d' },
    { key: 'Y', vec: [0, 1, 0], color: '#5dff8f' },
    { key: 'Z', vec: [0, 0, 1], color: '#4dd2ff' },
  ]
const R = 30 // axis length in the gizmo's SVG units
/** SVG-unit radius around a ball's center that counts as hitting it. */
const HIT_RADIUS = 12
/** Max pointer travel (px) for a press to count as a tap, not a drag. */
const TAP_SLOP_PX = 8
/** The viewBox is "-46 -46 92 92" — used to map client px → SVG units. */
const VIEWBOX_MIN = -46
const VIEWBOX_SIZE = 92

export function NavGizmo(props: NavGizmoProps) {
  const [panMode, setPanMode] = createSignal(false)
  const [dragging, setDragging] = createSignal(false)

  // Project each world axis onto the gizmo using the live camera basis.
  const axes = createMemo(() => {
    const { right, up, forward } = cameraBasis(props.camera())
    const dot = (a: readonly number[], b: readonly number[]) =>
      a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
    return AXES.map((a) => ({
      ...a,
      x: dot(a.vec, right) * R,
      y: -dot(a.vec, up) * R, // SVG y points down
      depth: -dot(a.vec, forward), // larger = nearer the viewer
    })).sort((p, q) => p.depth - q.depth) // far first, near drawn on top
  })

  let lastX = 0
  let lastY = 0
  // Tap-to-snap bookkeeping. The snap is decided entirely in the pointer
  // stream (down position + ball hit-test, resolved on pointerup) because a
  // synthesized `click` never reaches the axis balls on touch devices: the
  // dial's pointerdown calls preventDefault (suppressing compatibility
  // events) and pointer capture retargets the stream to the SVG.
  let downX = 0
  let downY = 0
  let pendingSnap: GizmoAxis | null = null

  /** The axis ball (if any) under the pointer, nearest-to-viewer first. */
  const axisAtPointer = (e: PointerEvent): GizmoAxis | null => {
    const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect()
    const x =
      ((e.clientX - rect.left) / rect.width) * VIEWBOX_SIZE + VIEWBOX_MIN
    const y =
      ((e.clientY - rect.top) / rect.height) * VIEWBOX_SIZE + VIEWBOX_MIN
    const projected = axes() // sorted far → near, so scan from the end
    for (let i = projected.length - 1; i >= 0; i--) {
      const a = projected[i]
      if (Math.hypot(x - a.x, y - a.y) <= HIT_RADIUS) return a.key
    }
    return null
  }

  const onDown = (e: PointerEvent) => {
    setDragging(true)
    lastX = e.clientX
    lastY = e.clientY
    downX = e.clientX
    downY = e.clientY
    pendingSnap = axisAtPointer(e)
    try {
      ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
    } catch {
      /* stale/foreign pointerId — drag still works uncaptured */
    }
    e.preventDefault()
  }
  const onMove = (e: PointerEvent) => {
    if (!dragging()) return
    const dx = e.clientX - lastX
    const dy = e.clientY - lastY
    lastX = e.clientX
    lastY = e.clientY
    if (panMode()) props.onPan(dx, dy)
    else props.onOrbit(dx, dy)
  }
  const onUp = (e: PointerEvent) => {
    setDragging(false)
    try {
      ;(e.currentTarget as Element).releasePointerCapture?.(e.pointerId)
    } catch {
      /* invalid pointerId (e.g. pointercancel on some Android browsers)
         must not abort the handler — the tap-snap below still applies */
    }
    // A press that started on a ball and barely moved is a tap → snap.
    // pointercancel means the gesture was aborted, never snap on it.
    const travel = Math.hypot(e.clientX - downX, e.clientY - downY)
    if (
      e.type !== 'pointercancel' &&
      pendingSnap !== null &&
      travel < TAP_SLOP_PX
    ) {
      props.onSnapAxis(pendingSnap)
    }
    pendingSnap = null
  }

  return (
    <div
      class="gp-tab3d-gizmo"
      style={{
        position: 'absolute',
        right: '10px',
        bottom: '10px',
        'z-index': '5',
        display: 'flex',
        'flex-direction': 'column',
        'align-items': 'center',
        gap: '6px',
        padding: '8px',
        'border-radius': '12px',
        background: 'rgba(8,8,14,0.55)',
        'backdrop-filter': 'blur(6px)',
        border: '1px solid rgba(255,255,255,0.1)',
        'user-select': 'none',
        'touch-action': 'none',
      }}
    >
      <svg
        width="84"
        height="84"
        viewBox="-46 -46 92 92"
        style={{
          cursor: dragging() ? 'grabbing' : panMode() ? 'move' : 'grab',
        }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
      >
        <title>{panMode() ? 'Drag to pan' : 'Drag to rotate'}</title>
        <circle
          cx="0"
          cy="0"
          r={R + 9}
          fill="rgba(255,255,255,0.03)"
          stroke="rgba(255,255,255,0.12)"
        />
        <For each={axes()}>
          {(a) => {
            const op = () => 0.4 + 0.6 * ((a.depth + 1) / 2)
            return (
              <g opacity={op()}>
                <line
                  x1="0"
                  y1="0"
                  x2={a.x}
                  y2={a.y}
                  stroke={a.color}
                  stroke-width="2.5"
                  stroke-linecap="round"
                />
                <circle cx={a.x} cy={a.y} r="8" fill={a.color} />
                <text
                  x={a.x}
                  y={a.y}
                  text-anchor="middle"
                  dominant-baseline="central"
                  font-size="10"
                  font-weight="700"
                  fill="#0a0a12"
                >
                  {a.key}
                </text>
                {/* Desktop affordance only (cursor + tooltip). The tap→snap
                    logic lives in the dial's own pointer handlers via
                    hit-testing — element-level click handlers never fire on
                    touch here (preventDefault + pointer capture suppress the
                    synthesized click). */}
                <circle
                  cx={a.x}
                  cy={a.y}
                  r={HIT_RADIUS}
                  fill="transparent"
                  style={{ cursor: 'pointer' }}
                >
                  <title>{`View along the ${a.key} axis`}</title>
                </circle>
              </g>
            )
          }}
        </For>
        <circle cx="0" cy="0" r="2.5" fill="rgba(255,255,255,0.6)" />
      </svg>

      <div style={{ display: 'flex', gap: '4px' }}>
        <GizmoBtn
          label="Pan (drag the dial to move)"
          active={panMode()}
          onClick={() => setPanMode((v) => !v)}
        >
          <Icon
            d={[
              'M12 2v20M2 12h20',
              'M12 2l-3 3M12 2l3 3',
              'M12 22l-3-3M12 22l3-3',
              'M2 12l3-3M2 12l3 3',
              'M22 12l-3-3M22 12l-3 3',
            ]}
          />
        </GizmoBtn>
        <GizmoBtn label="Zoom out" onClick={() => props.onZoom(150)}>
          <Icon d="M5 12h14" />
        </GizmoBtn>
        <GizmoBtn label="Zoom in" onClick={() => props.onZoom(-150)}>
          <Icon d={['M12 5v14', 'M5 12h14']} />
        </GizmoBtn>
        <GizmoBtn label="Reset view" onClick={() => props.onReset()}>
          <Icon d={['M21 12a9 9 0 1 1-2.64-6.36', 'M21 3v5h-5']} />
        </GizmoBtn>
      </div>
    </div>
  )
}

function GizmoBtn(props: {
  label: string
  active?: boolean
  onClick: () => void
  children: JSX.Element
}) {
  return (
    <button
      class="gp-btn"
      title={props.label}
      aria-label={props.label}
      aria-pressed={props.active}
      onClick={(e) => {
        props.onClick()
        e.currentTarget.blur()
      }}
      style={{
        display: 'flex',
        'align-items': 'center',
        'justify-content': 'center',
        padding: '5px',
        color: props.active === true ? '#4dd2ff' : 'inherit',
        'border-color': props.active === true ? '#4dd2ff' : undefined,
      }}
    >
      {props.children}
    </button>
  )
}

function Icon(props: { d: string | string[] }) {
  const paths = () => (Array.isArray(props.d) ? props.d : [props.d])
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <For each={paths()}>{(d) => <path d={d} />}</For>
    </svg>
  )
}
