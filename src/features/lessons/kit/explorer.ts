// ============================================================
// Lesson explorer — Season 1 as a map, with a card per lesson
// ============================================================
//
// Wide screens get a graph: theory above, voice below, the trailer and the
// finale between them, every prerequisite an edge. Below 860 px the same
// lessons are a two-lane list whose selected row opens its card inline.
// Selecting a lesson lights its path in (season.ts `lessonPath`): its own
// links lead, the rest of its path glows under them, the map stays faint.
//
// Any lesson page can host it: it opens on that page's own lesson, whose
// card's actions stay within the page, while another live lesson's card
// links to its own page. A live lesson's main action is the one
// lesson-state.ts gives it ("Start lesson", "Continue: step N" or "Read
// again"), right under its hook; "Watch the episode" joins it only once
// its film is published. A card draws only what a learner can use: the
// season's planning fields (season.ts) stay in the data.
//
// Cards are markup strings, which is safe only because every value they
// interpolate is defined in season.ts or here; poster URLs, which come from
// the page, are set as properties instead. The map's stateless pieces
// (lanes, arcs, edges, labels and their painters) are in explorer-graph.ts.

import { clamp, q, qa, svg } from './dom'
import type { PlateFigure } from './explorer-figures'
import { cardFigure, plateFigure, pluckString } from './explorer-figures'
import type { Look, Pos } from './explorer-graph'
import { addArcs, addEdges, addLaneBands, labelLeans, LANE_Y, nodeLabel, paintLabel, paintNode, paintRow, } from './explorer-graph'
import { addDrawer, watch } from './frame-loop'
import type { LessonView } from './lesson-state'
import { lessonViews } from './lesson-state'
import { reducedMotion } from './motion-switch'
import { Positions } from './position'
import { Done } from './progress'
import type { Lane, Lesson, Practise } from './season'
import { EDGES, lessonPath, LESSONS, PREREQ, TOPICS, unlocks } from './season'

export interface ExplorerOptions {
  /** This page's lesson: selected when the page opens, its card's actions within the page. Default 1. */
  readonly current?: number
  /** Episode posters by lesson, for cards whose figure is the poster. */
  readonly posters?: Readonly<Partial<Record<number, string>>>
}

export interface Explorer {
  /** Repaints the map and rebuilds the open card (after a lesson is marked done). */
  refresh(): void
  /** Selects lesson `n`; `scrollCard` brings its card into view if it is off screen. */
  select(n: number, scrollCard: boolean): void
  /** Lesson `n`'s real running time, once its film's metadata has loaded. */
  setLength(n: number, len: string): void
}

type LaneFilter = 'all' | Exclude<Lane, 'both'>

/** A lesson as the legend names it: ready, coming later or done. */
type Availability = 'ready' | 'later' | 'done'

const availability = (v: LessonView): Availability =>
  v.state === 'later' ? 'later' : v.done ? 'done' : 'ready'

/** An availability as the phone list's row says it, and the card chip's colour. */
interface Shown {
  readonly row: string
  readonly colour: string
}

const AVAILABLE: Readonly<Record<Availability, Shown>> = {
  ready: { row: 'Ready', colour: 'var(--aqua)' },
  later: { row: 'Coming later', colour: 'var(--chrome)' },
  done: { row: 'Done', colour: 'var(--ink)' },
}

/** The card's chip: a ready lesson says whether there is a film to watch. */
function chipText(v: LessonView): string {
  const a = availability(v)
  if (a !== 'ready') return AVAILABLE[a].row
  return v.lesson.film === 'published'
    ? 'Ready · watch and read'
    : 'Ready · read'
}

const pad = (n: number): string => String(n).padStart(2, '0')
const icon = (id: string): string =>
  `<svg class="ico" aria-hidden="true"><use href="#${id}"/></svg>`

/** A phone list row's second line: "Coming later · after 2, 3". */
function rowText(L: Lesson, a: Availability): string {
  const pre = PREREQ[L.n] ?? []
  return `${AVAILABLE[a].row}${pre.length > 0 ? ` · after ${pre.join(', ')}` : ''}`
}

function laneName(L: Lesson): string {
  if (L.lane === 'both') return 'Voice and theory'
  return L.lane === 'theory' ? 'Theory' : 'Voice'
}

/** The practise link and its note; empty for a lesson with no drill to link yet. */
function practiseMarkup(pr: Practise): string {
  if (pr.link === undefined) return ''
  const { href, addr, label, note } = pr.link
  return `<a class="addr" href="${href}" target="_blank" rel="noopener">${addr}${icon('i-out')}</a> <span>${label}${note === undefined ? '' : `, ${note}`}</span>`
}

/** A live lesson's reading time, and its film's once the film plays on its page. */
function lengthText(L: Lesson, film: string | undefined): string {
  if (L.minutes === undefined) return ''
  return `${L.minutes} min${film === undefined ? '' : ` · film ${film}`}`
}

/**
 * A live lesson's buttons: its main action (lesson-state.ts), "Watch the
 * episode" once its film is published, and Mark as done. Empty for a
 * lesson coming later.
 */
export function cardActions(v: LessonView, current: number): string {
  const L = v.lesson
  if (L.page === undefined || v.action === null) return ''
  const at = L.n === current ? '' : L.page
  const main = `<a class="btn primary" href="${v.action.href}">${icon(v.action.kind === 'again' ? 'i-redo' : 'i-right')}${v.action.label}</a>`
  const watch =
    L.film === 'published'
      ? `<a class="btn" href="${at}#watch">${icon('i-play')}Watch the episode</a>`
      : ''
  const done = v.done ? `${icon('i-check')}Done` : 'Mark as done'
  return `<div class="ex-actions">${main}${watch}<button class="btn" type="button" data-done="${L.n}" aria-pressed="${v.done}">${done}</button></div>`
}

function cardMarkup(
  v: LessonView,
  film: string | undefined,
  current: number,
): string {
  const L = v.lesson
  const pre = PREREQ[L.n] ?? []
  const un = unlocks(L.n)
  const links = (ns: readonly number[]): string =>
    ns
      .map(
        (p) =>
          `<button class="lk" type="button" data-go="${p}">${pad(p)} · ${LESSONS[p].short}</button>`,
      )
      .join('')
  const topics = L.topics
    .map((t) => `<span class="topic" data-topic="${t}">${TOPICS[t]}</span>`)
    .join('')
  const practise = practiseMarkup(L.pr)
  const length = lengthText(L, film)
  // the trailer is its hook and nothing else until it exists
  const rows =
    L.kind === 'Trailer'
      ? ''
      : `<dl class="ex-rows">
        ${topics === '' ? '' : `<dt>Topics</dt><dd>${topics}</dd>`}
        <dt>Builds on</dt><dd>${pre.length > 0 ? links(pre) : '<span>Nothing: start here</span>'}</dd>
        ${un.length > 0 ? `<dt>Opens</dt><dd>${links(un)}</dd>` : ''}
        ${practise === '' ? '' : `<dt>Practise</dt><dd>${practise}</dd>`}
        ${length === '' ? '' : `<dt>Length</dt><dd><span>${length}</span></dd>`}
      </dl>`
  const kicker =
    L.kind === 'Trailer'
      ? '<span class="fig">Trailer</span>'
      : `<span class="fig">Lesson ${pad(L.n)}</span> ${laneName(L)}`
  return `<div class="main">
      <p class="eyebrow">${kicker} <span class="chip" style="letter-spacing:0;text-transform:none"><i style="--c:${AVAILABLE[availability(v)].colour}"></i>${chipText(v)}</span></p>
      <h3>${L.title}</h3>
      <svg class="string" viewBox="0 0 1000 24" preserveAspectRatio="none" aria-hidden="true"><path d="M0 12 L1000 12"/></svg>
      <p class="hookq">${L.hook}</p>
      ${cardActions(v, current)}
      ${rows}
    </div>`
}

export function createExplorer(opts: ExplorerOptions): Explorer {
  const graph = q('#graph')
  const list = q('#exList')
  const cardHost = q('#exCardHost')
  const narrow = window.matchMedia('(max-width: 860px)')
  const lengths = new Map<number, string>()
  const current = opts.current ?? 1
  let sel = current
  let lane: LaneFilter = 'all'
  let nodes = new Map<number, HTMLButtonElement>()
  let labels = new Map<number, HTMLDivElement>()
  let edgeEls: SVGPathElement[] = []
  let plate: PlateFigure | null = null

  /** Every lesson as this viewer stands with it, read fresh from storage. */
  const views = (): LessonView[] =>
    lessonViews(LESSONS, {
      done: new Set(Done.list()),
      steps: Positions.all(),
      current,
    })
  const matches = (L: Lesson): boolean =>
    lane === 'all' || L.lane === lane || L.lane === 'both'
  const behavior = (): ScrollBehavior => (reducedMotion() ? 'auto' : 'smooth')

  function card(L: Lesson): HTMLElement {
    const el = document.createElement('article')
    el.className = 'card ex-card'
    el.innerHTML = cardMarkup(views()[L.n], lengths.get(L.n), current)
    const fig = cardFigure(L, opts.posters?.[L.n])
    if (fig !== null) el.appendChild(fig)
    el.addEventListener('click', (e) => {
      const target = e.target instanceof Element ? e.target : null
      const go = target?.closest<HTMLElement>('[data-go]')
      if (go) {
        select(Number(go.dataset.go), true)
        return
      }
      const done = target?.closest<HTMLElement>('[data-done]')
      if (done) {
        const n = Number(done.dataset.done)
        Done.set(n, !Done.has(n))
      }
    })
    return el
  }

  // the card sits in the host on a wide screen and inside the list on a phone
  const hostSeen = watch(cardHost)
  const listSeen = watch(list)
  addDrawer({
    active: () => plate !== null && (hostSeen() || listSeen()),
    draw: (_now, dt) => plate?.draw(dt),
  })

  function renderCard(): void {
    const el = card(LESSONS[sel])
    if (narrow.matches) {
      qa('.ex-detail', list).forEach((d) => d.remove())
      const row = list.querySelector(`[data-n="${sel}"]`)
      const li = document.createElement('li')
      li.className = 'ex-detail'
      li.appendChild(el)
      row?.after(li)
      cardHost.textContent = ''
    } else {
      cardHost.textContent = ''
      cardHost.appendChild(el)
    }
    const canvas = el.querySelector<HTMLCanvasElement>('.plate canvas')
    plate = canvas === null ? null : plateFigure(canvas)
    pluckString(el)
  }

  /** A map node: a tap selects its lesson, Left and Right step along the season. */
  function addNode(L: Lesson, p: Pos): void {
    const b = document.createElement('button')
    b.type = 'button'
    b.className = 'node'
    b.style.left = `${p.x}px`
    b.style.top = `${p.y}px`
    b.textContent = String(L.n)
    b.setAttribute(
      'aria-label',
      `${L.n === 0 ? 'Trailer' : `Lesson ${L.n}`}: ${L.title}`,
    )
    b.addEventListener('click', () => select(L.n, true))
    b.addEventListener('keydown', (e) => {
      const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
      if (d === 0) return
      e.preventDefault()
      const next = clamp(L.n + d, 0, LESSONS.length - 1)
      nodes.get(next)?.focus()
      select(next, false)
    })
    graph.appendChild(b)
    nodes.set(L.n, b)
  }

  function layoutGraph(): void {
    if (narrow.matches) return
    graph.textContent = ''
    const W = graph.clientWidth
    const GH = graph.clientHeight || 400
    const gut = 112
    const colW = (W - gut - 14) / 15
    const X = (n: number): number => gut + (n + 0.5) * colW
    const edgesSvg = svg(
      'svg',
      { class: 'edges', viewBox: `0 0 ${W} ${GH}` },
      graph,
    )
    addLaneBands(graph)
    addArcs(graph, X, colW)
    const pos = (n: number): Pos => ({ x: X(n), y: LANE_Y[LESSONS[n].lane] })
    edgeEls = addEdges(edgesSvg, pos, colW)
    nodes = new Map()
    labels = new Map()
    const lean = labelLeans()
    for (const L of LESSONS) {
      const p = pos(L.n)
      addNode(L, p)
      const lab = nodeLabel(L, p, lean.get(L.n))
      graph.appendChild(lab)
      labels.set(L.n, lab)
    }
    paint()
  }

  function renderList(): void {
    const all = views()
    list.textContent = ''
    const head = document.createElement('li')
    head.className = 'ex-lanes-head'
    head.innerHTML = '<span>Theory</span><span>Voice</span>'
    list.appendChild(head)
    for (const L of LESSONS) {
      if (L.n === 1 || L.n === 8) {
        const arc = document.createElement('li')
        arc.className = 'ex-arc'
        arc.innerHTML =
          L.n === 1
            ? 'Hear it <small>Lessons 1 to 7</small>'
            : 'Shape it <small>Lessons 8 to 14</small>'
        list.appendChild(arc)
      }
      const li = document.createElement('li')
      li.className = `ex-row lane-${L.lane}`
      li.dataset.n = String(L.n)
      li.innerHTML = `<button type="button" class="it" aria-expanded="false"><span class="nb">${L.n}</span><span>${L.short}</span><small>${rowText(L, availability(all[L.n]))}</small></button>`
      const row = q('button', li)
      row.addEventListener('click', () => {
        // a second tap on the open row folds its card away
        if (sel === L.n && list.querySelector('.ex-detail') !== null) {
          qa('.ex-detail', list).forEach((d) => d.remove())
          paint()
          row.setAttribute('aria-expanded', 'false')
          return
        }
        select(L.n, false)
      })
      list.appendChild(li)
    }
    paint()
  }

  function paint(): void {
    const { ancestors, roles } = lessonPath(sel)
    const open = list.querySelector('.ex-detail') !== null
    const all = views()
    for (const L of LESSONS) {
      const a = availability(all[L.n])
      const look: Look = {
        done: a === 'done',
        // every live lesson shows as ready on the map: it can be read now
        stClass: a === 'later' ? '' : ` ${a}`,
        on: matches(L),
        selected: L.n === sel,
      }
      paintNode(nodes.get(L.n), L.n, look, ancestors.has(L.n))
      paintLabel(labels.get(L.n), look)
      paintRow(list.querySelector(`[data-n="${L.n}"] .it`), L.n, look, open)
      const says = list.querySelector(`[data-n="${L.n}"] .it small`)
      if (says !== null) says.textContent = rowText(L, a)
    }
    edgeEls.forEach((el, i) => {
      const [a, b] = EDGES[i]
      const on = matches(LESSONS[a]) && matches(LESSONS[b])
      const role = roles[i]
      el.setAttribute(
        'class',
        `edge${role === null ? '' : ` ${role}`}${on ? '' : ' dim'}`,
      )
    })
  }

  // the card first, so the open row's aria-expanded reads the card it opened
  function refresh(): void {
    renderCard()
    paint()
  }

  function select(n: number, scrollCard: boolean): void {
    sel = n
    refresh()
    if (!scrollCard) return
    const target = narrow.matches ? list.querySelector('.ex-detail') : cardHost
    if (target === null) return
    const r = target.getBoundingClientRect()
    if (r.top > window.innerHeight - 120 || r.bottom < 0) {
      target.scrollIntoView({ behavior: behavior(), block: 'nearest' })
    }
  }

  const filters = qa('.filters [data-lane]')
  for (const b of filters) {
    b.addEventListener('click', () => {
      const next = b.dataset.lane
      if (next === 'all' || next === 'theory' || next === 'voice') lane = next
      filters.forEach((x) => x.setAttribute('aria-pressed', String(x === b)))
      paint()
    })
  }

  function rebuild(): void {
    layoutGraph()
    renderList()
    refresh()
  }
  rebuild()
  narrow.addEventListener('change', rebuild)
  let width = graph.clientWidth
  new ResizeObserver(() => {
    if (Math.abs(graph.clientWidth - width) <= 2) return
    width = graph.clientWidth
    layoutGraph()
  }).observe(graph)
  for (const a of qa('[data-select-lesson]')) {
    a.addEventListener('click', () =>
      select(Number(a.dataset.selectLesson), false),
    )
  }
  Done.subscribe(refresh)
  // "Continue: step N" follows the steps this page's deck reaches
  Positions.subscribe(refresh)

  return {
    refresh,
    select,
    setLength(n, len) {
      lengths.set(n, len)
      refresh()
    },
  }
}
