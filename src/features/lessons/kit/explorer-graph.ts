// ============================================================
// Lesson explorer map — the graph's lanes, arcs, edges and node labels
// ============================================================
//
// The pieces of the wide-screen season map that hold no state: the lane
// bands and arc captions behind it, an SVG path per prerequisite, a label
// placed beside each node (on a map under 1100 px wide, no wider than its
// share of its lane, so a long name wraps instead of touching the next),
// and the painters that restyle a node, a label or a list row when the
// selection or the lane filter changes. explorer.ts owns the selection, the
// filter and every event.

import { q, svg } from './dom'
import type { Lane, Lesson } from './season'
import { EDGES, LESSONS } from './season'

/** Each lane's line across the map, px from its top. */
export const LANE_Y: Record<Lane, number> = {
  theory: 128,
  both: 210,
  voice: 292,
}
const LANE_BANDS: readonly (readonly [Lane, string, string])[] = [
  ['theory', 'Theory', '7 lessons'],
  ['voice', 'Voice', '6 lessons + 14'],
]
/** The season's two arcs: each one's name, its span in words, and its first and last lesson. */
export const ARCS: readonly (readonly [string, string, number, number])[] = [
  ['Hear it', 'Lessons 1 to 7', 1, 7],
  ['Shape it', 'Lessons 8 to 14', 8, 14],
]

/** A lane label's width, px, on a map wide enough to give it. */
const LABEL_W = 150
/** Below this map width, px, each label keeps to its share of its lane. */
const SHARES_BELOW = 1100
/** The least air between two labels' shares along a lane, px. */
const LABEL_GAP = 12
/** How far a leaning label starts behind its node's centre, px. */
const LEAN_BACK = 18

const check = (px: number): string =>
  `<svg class="ico" style="width:${px}px;height:${px}px" aria-hidden="true"><use href="#i-check"/></svg>`

/** A node's centre on the map, px. */
export interface Pos {
  x: number
  y: number
}

/** A label that hangs off its node's right edge ('ar') or left edge ('al'). */
type Lean = 'ar' | 'al'

/** How a lesson shows on the map and in the list. */
export interface Look {
  done: boolean
  /** '', ' ready' or ' done'. */
  stClass: string
  /** Kept by the lane filter. */
  on: boolean
  selected: boolean
}

/** The two lane bands behind the map, each with its name. */
export function addLaneBands(graph: HTMLElement): void {
  for (const [k, name, sub] of LANE_BANDS) {
    const band = document.createElement('div')
    band.className = 'lane'
    band.style.top = `${LANE_Y[k] - 37}px`
    graph.appendChild(band)
    const l = document.createElement('div')
    l.className = 'lane-lbl'
    l.style.top = `${LANE_Y[k] - 18}px`
    l.innerHTML = `<b>${name}</b>${sub}`
    graph.appendChild(l)
  }
}

/** The arc over each half of the season; `X` is a lesson's column centre. */
export function addArcs(
  graph: HTMLElement,
  X: (n: number) => number,
  colW: number,
): void {
  for (const [t, s, a, b] of ARCS) {
    const arc = document.createElement('div')
    arc.className = 'arc'
    arc.style.left = `${X(a) - colW * 0.42}px`
    arc.style.width = `${X(b) - X(a) + colW * 0.84}px`
    arc.innerHTML = `<span>${t}<small>${s}</small></span>`
    graph.appendChild(arc)
  }
}

/**
 * Every edge runs in the gutter between the lanes: a lane's own edges bow
 * into it (theory down, voice up, deeper for longer spans), and an edge
 * between lanes leaves and arrives vertically, so none crosses a label.
 */
function edgePath(a: number, b: number, p: Pos, to: Pos, colW: number): string {
  const la = LESSONS[a].lane
  if (la === LESSONS[b].lane && la !== 'both') {
    const hh = Math.min(84, 36 + 8 * (b - a)) * (la === 'theory' ? 1 : -1)
    return `M${p.x} ${p.y} C${p.x + colW * 0.35} ${p.y + hh} ${to.x - colW * 0.35} ${to.y + hh} ${to.x} ${to.y}`
  }
  const my = (p.y + to.y) / 2
  return `M${p.x} ${p.y} C${p.x} ${my} ${to.x} ${my} ${to.x} ${to.y}`
}

/** One path per prerequisite, in EDGES order (the painter matches them by index). */
export function addEdges(
  edgesSvg: SVGSVGElement,
  pos: (n: number) => Pos,
  colW: number,
): SVGPathElement[] {
  return EDGES.map(([a, b]) =>
    svg(
      'path',
      { class: 'edge', d: edgePath(a, b, pos(a), pos(b), colW) },
      edgesSvg,
    ),
  )
}

/** A lane's lessons in season order. */
const laneLessons = (k: Exclude<Lane, 'both'>): number[] =>
  LESSONS.filter((L) => L.lane === k)
    .map((L) => L.n)
    .sort((a, b) => a - b)

/**
 * Labels sit outside the gutter: theory above, voice below, the trailer and
 * Lesson 14 beside their nodes. Neighbours a column apart (1 and 2) lean
 * away from each other instead of wrapping into one another.
 */
export function labelLeans(): Map<number, Lean> {
  const lean = new Map<number, Lean>()
  for (const k of ['theory', 'voice'] as const) {
    const ns = laneLessons(k)
    for (let i = 1; i < ns.length; i++) {
      if (ns[i] - ns[i - 1] < 2) {
        lean.set(ns[i - 1], 'ar')
        lean.set(ns[i], 'al')
      }
    }
  }
  return lean
}

/**
 * Each lane label's width, px. On a map 1100 px wide or more every label is
 * LABEL_W. On a narrower one a label keeps to its share of its lane, which
 * ends LABEL_GAP / 2 short of halfway to the next label along it, so a long
 * name wraps onto a second line instead of running into its neighbour's: a
 * centred label's share lies either side of its node, a leaning label's
 * runs from LEAN_BACK behind its node towards the side it leans.
 */
export function labelWidths(
  mapW: number,
  colW: number,
  leans: ReadonlyMap<number, Lean>,
): Map<number, number> {
  const widths = new Map<number, number>()
  const half = (cols: number): number => (cols * colW - LABEL_GAP) / 2
  for (const k of ['theory', 'voice'] as const) {
    const ns = laneLessons(k)
    ns.forEach((n, i) => {
      const before = i === 0 ? Infinity : half(n - ns[i - 1])
      const after = i === ns.length - 1 ? Infinity : half(ns[i + 1] - n)
      const lean = leans.get(n)
      const share =
        lean === 'al'
          ? LEAN_BACK + after
          : lean === 'ar'
            ? LEAN_BACK + before
            : 2 * Math.min(before, after)
      widths.set(n, mapW >= SHARES_BELOW ? LABEL_W : Math.min(LABEL_W, share))
    })
  }
  return widths
}

/** A node's short name, placed by its lane and its lean, `w` px wide. */
export function nodeLabel(
  L: Lesson,
  p: Pos,
  leans: Lean | undefined,
  w = LABEL_W,
): HTMLDivElement {
  const lab = document.createElement('div')
  lab.className = `nlabel${L.lane === 'theory' ? ' up' : ''}${leans === undefined ? '' : ` ${leans}`}`
  lab.style.width = `${w}px`
  if (L.lane === 'both') placeSideLabel(lab, L.n, p)
  else placeLaneLabel(lab, L.lane, p, leans, w)
  lab.textContent = L.short
  return lab
}

/** The trailer's label reads to the right of its node, Lesson 14's to the left. */
function placeSideLabel(lab: HTMLDivElement, n: number, p: Pos): void {
  lab.style.top = `${p.y - 9}px`
  lab.style.width = '110px'
  lab.style.left = `${n === 0 ? p.x + 30 : p.x - 30 - 110}px`
  lab.style.marginLeft = '0'
  lab.classList.add(n === 0 ? 'al' : 'ar')
}

/** Theory above its node, voice below; a leaning label hangs off one side. */
function placeLaneLabel(
  lab: HTMLDivElement,
  lane: Lane,
  p: Pos,
  leans: Lean | undefined,
  w: number,
): void {
  lab.style.top = `${lane === 'theory' ? p.y - 34 : p.y + 34}px`
  if (leans === 'ar') {
    lab.style.left = `${p.x + LEAN_BACK - w}px`
    lab.style.marginLeft = '0'
  } else if (leans === 'al') {
    lab.style.left = `${p.x - LEAN_BACK}px`
    lab.style.marginLeft = '0'
  } else {
    lab.style.left = `${p.x}px`
    lab.style.marginLeft = `${-w / 2}px`
  }
}

/** A map node: status, selection, path and filter as classes, and a tick once done. */
export function paintNode(
  node: HTMLButtonElement | undefined,
  n: number,
  look: Look,
  onPath: boolean,
): void {
  if (node === undefined) return
  node.className = `node${look.stClass}${look.selected ? ' sel' : ''}${onPath ? ' anc' : ''}${look.on ? '' : ' dim'}`
  node.setAttribute('aria-pressed', String(look.selected))
  // one tab stop for the map: the selected node; the arrows reach the rest
  node.tabIndex = look.selected ? 0 : -1
  if (look.done) node.innerHTML = check(18)
  else node.textContent = String(n)
}

export function paintLabel(
  label: HTMLDivElement | undefined,
  look: Look,
): void {
  if (label === undefined) return
  label.classList.remove('sel', 'dim')
  if (look.selected) label.classList.add('sel')
  if (!look.on) label.classList.add('dim')
}

/** A phone list row; its button says whether its card is the open one. */
export function paintRow(
  row: Element | null,
  n: number,
  look: Look,
  open: boolean,
): void {
  if (row === null) return
  row.className = `it${look.stClass}${look.on ? '' : ' dim'}`
  row.setAttribute('aria-expanded', String(look.selected && open))
  q('.nb', row).innerHTML = look.done ? check(16) : String(n)
}
