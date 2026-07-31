import type { Component } from 'solid-js'
import { createSignal } from 'solid-js'
import type { MascotProps } from '@/components/Mascot'
import { Mascot } from '@/components/Mascot'
import type { DragGestureOptions } from '@/components/shared/drag-gesture'
import { dragGesture } from '@/components/shared/drag-gesture'
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

  const dockDrag: DragGestureOptions = {
    onStart: (event) => {
      if (el === undefined) return
      const rect = el.getBoundingClientRect()
      grabX = event.clientX - rect.left
      grabY = event.clientY - rect.top
      setDrag({ x: rect.left, y: rect.top })
    },
    onMove: (event) => {
      if (drag() === null || el === undefined) return
      const margin = 6
      const x = Math.min(
        Math.max(margin, event.clientX - grabX),
        window.innerWidth - el.offsetWidth - margin,
      )
      const y = Math.min(
        Math.max(margin, event.clientY - grabY),
        window.innerHeight - el.offsetHeight - margin,
      )
      setDrag({ x, y })
    },
    onEnd: (_event, reason) => {
      const currentDrag = drag()
      if (currentDrag === null || el === undefined) return
      if (reason === 'pointerup') {
        place(
          nearestCorner(
            currentDrag.x + el.offsetWidth / 2,
            currentDrag.y + el.offsetHeight / 2,
            window.innerWidth,
            window.innerHeight,
          ),
        )
      }
      setDrag(null)
    },
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
      ref={(element) => {
        el = element
        dragGesture(element, () => dockDrag)
      }}
      class={`${styles.dock} ${styles[corner()]} ${
        drag() !== null ? styles.dragging : ''
      }`}
      style={dockStyle()}
      role="button"
      tabindex="0"
      aria-label="Merc — drag to reposition, or press Enter to move to the next corner"
      title="Drag Merc anywhere"
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
