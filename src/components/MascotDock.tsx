import type { Component } from 'solid-js'
import { createSignal } from 'solid-js'
import type { MascotProps } from '@/components/Mascot'
import { Mascot } from '@/components/Mascot'
import styles from './MascotDock.module.css'

/**
 * MascotDock — a floating, draggable Merc that snaps to whichever screen corner
 * you drop it in and remembers the choice. Sits above the canvas HUDs and the
 * control bar (below modals), so it never gets occluded and never pins the
 * score card's layout. Keyboard users cycle corners with Enter/Space.
 */
export type DockCorner = 'tl' | 'tr' | 'bl' | 'br'

const CORNERS: readonly DockCorner[] = ['tl', 'tr', 'bl', 'br']
const STORAGE_KEY = 'merc-dock-corner'

/** Which viewport quadrant a point falls in. */
export function nearestCorner(
  cx: number,
  cy: number,
  vw: number,
  vh: number,
): DockCorner {
  const v = cy < vh / 2 ? 't' : 'b'
  const h = cx < vw / 2 ? 'l' : 'r'
  return `${v}${h}` as DockCorner
}

function loadCorner(fallback: DockCorner): DockCorner {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (v !== null && (CORNERS as readonly string[]).includes(v)) {
      return v as DockCorner
    }
  } catch {
    /* private mode / storage unavailable — use the fallback */
  }
  return fallback
}

function saveCorner(c: DockCorner): void {
  try {
    localStorage.setItem(STORAGE_KEY, c)
  } catch {
    /* ignore */
  }
}

export interface MascotDockProps {
  state?: MascotProps['state']
  energy?: MascotProps['energy']
  /** Rendered Merc size in px. Default 72. */
  size?: number
  /** Corner used until the user drags Merc somewhere. Default 'br'. */
  defaultCorner?: DockCorner
}

export const MascotDock: Component<MascotDockProps> = (props) => {
  const size = () => props.size ?? 72
  const [corner, setCorner] = createSignal<DockCorner>(
    loadCorner(props.defaultCorner ?? 'br'),
  )
  // Non-null while dragging: the live pixel position of the dock's top-left.
  const [drag, setDrag] = createSignal<{ x: number; y: number } | null>(null)

  let el: HTMLDivElement | undefined
  let grabX = 0
  let grabY = 0

  const place = (c: DockCorner) => {
    setCorner(c)
    saveCorner(c)
  }

  const onPointerDown = (e: PointerEvent) => {
    if (el === undefined) return
    const r = el.getBoundingClientRect()
    grabX = e.clientX - r.left
    grabY = e.clientY - r.top
    setDrag({ x: r.left, y: r.top })
    el.setPointerCapture(e.pointerId)
    e.preventDefault()
  }

  const onPointerMove = (e: PointerEvent) => {
    if (drag() === null || el === undefined) return
    const m = 6
    const w = el.offsetWidth
    const h = el.offsetHeight
    const x = Math.min(
      Math.max(m, e.clientX - grabX),
      window.innerWidth - w - m,
    )
    const y = Math.min(
      Math.max(m, e.clientY - grabY),
      window.innerHeight - h - m,
    )
    setDrag({ x, y })
  }

  const onPointerUp = (e: PointerEvent) => {
    const d = drag()
    if (d === null || el === undefined) return
    el.releasePointerCapture(e.pointerId)
    place(
      nearestCorner(
        d.x + el.offsetWidth / 2,
        d.y + el.offsetHeight / 2,
        window.innerWidth,
        window.innerHeight,
      ),
    )
    setDrag(null)
  }

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key !== 'Enter' && e.key !== ' ') return
    e.preventDefault()
    const order: DockCorner[] = ['tl', 'tr', 'br', 'bl']
    place(order[(order.indexOf(corner()) + 1) % order.length])
  }

  const dockStyle = (): Record<string, string> | undefined => {
    const d = drag()
    if (d === null) return undefined
    return { left: `${d.x}px`, top: `${d.y}px`, right: 'auto', bottom: 'auto' }
  }

  return (
    <div
      ref={el}
      class={`${styles.dock} ${styles[corner()]} ${
        drag() !== null ? styles.dragging : ''
      }`}
      style={dockStyle()}
      role="button"
      tabindex="0"
      aria-label="Merc — drag to reposition, or press Enter to move to the next corner"
      title="Drag Merc anywhere"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onKeyDown={onKeyDown}
    >
      <Mascot
        state={props.state}
        energy={props.energy}
        size={size()}
        title=""
      />
    </div>
  )
}

export default MascotDock
