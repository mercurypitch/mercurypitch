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
// Cards are markup strings, which is safe only because every value they
// interpolate is defined in season.ts or here; the poster URL, which comes
// from the page, is set as a property instead.

import { clamp, q, qa, svg } from './dom'
import type { PlateFigure } from './explorer-figures'
import { cardFigure, plateFigure, pluckString } from './explorer-figures'
import { addDrawer, watch } from './frame-loop'
import { reducedMotion } from './motion-switch'
import { Done } from './progress'
import type { Lane, Lesson, Practise } from './season'
import { EDGES, lessonPath, LESSONS, PREREQ, TOPICS, unlocks } from './season'

export interface ExplorerOptions {
  /** The episode poster, for Lesson 1's card. */
  readonly poster: string
}

export interface Explorer {
  /** Repaints the map and rebuilds the open card (after a lesson is marked done). */
  refresh(): void
  /** Selects lesson `n`; `scrollCard` brings its card into view if it is off screen. */
  select(n: number, scrollCard: boolean): void
  /** Lesson `n`'s real running time, once its film's metadata has loaded. */
  setLength(n: number, len: string): void
}

type Status = 'done' | 'ready' | 'planned'
type LaneFilter = 'all' | Exclude<Lane, 'both'>

const LANE_Y: Record<Lane, number> = { theory: 128, both: 210, voice: 292 }
const LANE_BANDS: readonly (readonly [Lane, string, string])[] = [
  ['theory', 'Theory', '7 lessons'],
  ['voice', 'Voice', '6 lessons + 14'],
]
const ARCS: readonly (readonly [string, string, number, number])[] = [
  ['Hear it', 'Lessons 1 to 7', 1, 7],
  ['Shape it', 'Lessons 8 to 14', 8, 14],
]

const pad = (n: number): string => String(n).padStart(2, '0')
const check = (px: number): string =>
  `<svg class="ico" style="width:${px}px;height:${px}px" aria-hidden="true"><use href="#i-check"/></svg>`

function laneName(L: Lesson): string {
  if (L.lane === 'both') return L.n === 0 ? 'Trailer' : 'Voice and theory'
  return L.lane === 'theory' ? 'Theory' : 'Voice'
}

function practiseMarkup(pr: Practise): string {
  let html = ''
  if (pr.link !== undefined) {
    const { href, addr, label, note } = pr.link
    html += `<a class="addr" href="${href}" target="_blank" rel="noopener">${addr}<svg class="ico" aria-hidden="true"><use href="#i-out"/></svg></a> <span>${label}${note === undefined ? '' : `, ${note}`}</span>`
  }
  if (pr.needs !== undefined)
    html += `<span class="needs">Needs a deep link: ${pr.needs}.</span>`
  if (pr.none !== undefined) html += `<span>${pr.none}</span>`
  return html
}

function cardMarkup(L: Lesson, st: Status, len: string | undefined): string {
  const pre = PREREQ[L.n] ?? []
  const un = unlocks(L.n)
  const chipCol =
    st === 'ready'
      ? 'var(--aqua)'
      : st === 'done'
        ? 'var(--ink)'
        : 'var(--chrome)'
  const stLabel =
    st === 'ready'
      ? 'Ready · watch and read'
      : st === 'done'
        ? 'Done'
        : 'Planned'
  const links = (ns: readonly number[]): string =>
    ns
      .map(
        (p) =>
          `<button class="lk" type="button" data-go="${p}">${pad(p)} · ${LESSONS[p].short}</button>`,
      )
      .join('')
  const topics = L.topics
    .map((t) => `<span class="topic"><b>${t}</b>${TOPICS[t]}</span>`)
    .join('')
  const done =
    st === 'done'
      ? '<svg class="ico" aria-hidden="true"><use href="#i-check"/></svg>Done'
      : 'Mark as done'
  return `<div class="main">
      <p class="eyebrow"><span class="fig">${L.n === 0 ? 'Trailer' : `Lesson ${pad(L.n)}`}</span> ${laneName(L)} <span class="chip" style="letter-spacing:0;text-transform:none"><i style="--c:${chipCol}"></i>${stLabel}</span></p>
      <h3>${L.title}</h3>
      <svg class="string" viewBox="0 0 1000 24" preserveAspectRatio="none" aria-hidden="true"><path d="M0 12 L1000 12"/></svg>
      <p class="hookq">${L.hook}</p>
      <dl class="ex-rows">
        ${L.topics.length > 0 ? `<dt>Topics</dt><dd>${topics}</dd>` : ''}
        <dt>Builds on</dt><dd>${pre.length > 0 ? links(pre) : '<span>Nothing: start here</span>'}</dd>
        ${un.length > 0 ? `<dt>Opens</dt><dd>${links(un)}</dd>` : ''}
        <dt>Practise</dt><dd>${practiseMarkup(L.pr)}</dd>
        <dt>Signature</dt><dd><span>${L.sig}</span></dd>
        <dt>Length</dt><dd><span>${len ?? 'Planned, 6 to 9 minutes'}</span></dd>
      </dl>
      ${L.ready === true ? `<div class="ex-actions"><a class="btn primary" href="#watch"><svg class="ico" aria-hidden="true"><use href="#i-play"/></svg>Watch the episode</a><a class="btn" href="#lesson"><svg class="ico" aria-hidden="true"><use href="#i-book"/></svg>Read the lesson</a><button class="btn" type="button" data-done="${L.n}" aria-pressed="${st === 'done'}">${done}</button></div>` : ''}
    </div>`
}

export function createExplorer(opts: ExplorerOptions): Explorer {
  const graph = q('#graph')
  const list = q('#exList')
  const cardHost = q('#exCardHost')
  const narrow = window.matchMedia('(max-width: 860px)')
  const lengths = new Map<number, string>()
  let sel = 1
  let lane: LaneFilter = 'all'
  let nodes = new Map<number, HTMLButtonElement>()
  let labels = new Map<number, HTMLDivElement>()
  let edgeEls: SVGPathElement[] = []
  let plate: PlateFigure | null = null

  const status = (L: Lesson): Status =>
    Done.has(L.n) ? 'done' : L.ready === true ? 'ready' : 'planned'
  const matches = (L: Lesson): boolean =>
    lane === 'all' || L.lane === lane || L.lane === 'both'
  const behavior = (): ScrollBehavior => (reducedMotion() ? 'auto' : 'smooth')

  function card(L: Lesson): HTMLElement {
    const el = document.createElement('article')
    el.className = 'card ex-card'
    el.innerHTML = cardMarkup(L, status(L), lengths.get(L.n) ?? L.len)
    if (L.fig !== undefined) el.appendChild(cardFigure(L.fig, opts.poster))
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
    for (const [t, s, a, b] of ARCS) {
      const arc = document.createElement('div')
      arc.className = 'arc'
      arc.style.left = `${X(a) - colW * 0.42}px`
      arc.style.width = `${X(b) - X(a) + colW * 0.84}px`
      arc.innerHTML = `<span>${t}<small>${s}</small></span>`
      graph.appendChild(arc)
    }
    const pos = (n: number): { x: number; y: number } => ({
      x: X(n),
      y: LANE_Y[LESSONS[n].lane],
    })
    // every edge runs in the gutter between the lanes: a lane's own edges bow
    // into it (theory down, voice up, deeper for longer spans), and an edge
    // between lanes leaves and arrives vertically, so none crosses a label
    edgeEls = EDGES.map(([a, b]) => {
      const p = pos(a)
      const to = pos(b)
      const la = LESSONS[a].lane
      let d: string
      if (la === LESSONS[b].lane && la !== 'both') {
        const hh = Math.min(84, 36 + 8 * (b - a)) * (la === 'theory' ? 1 : -1)
        d = `M${p.x} ${p.y} C${p.x + colW * 0.35} ${p.y + hh} ${to.x - colW * 0.35} ${to.y + hh} ${to.x} ${to.y}`
      } else {
        const my = (p.y + to.y) / 2
        d = `M${p.x} ${p.y} C${p.x} ${my} ${to.x} ${my} ${to.x} ${to.y}`
      }
      return svg('path', { class: 'edge', d }, edgesSvg)
    })
    nodes = new Map()
    labels = new Map()
    // labels sit outside the gutter: theory above, voice below, the trailer
    // and Lesson 14 beside their nodes; neighbours a column apart (1 and 2)
    // lean away from each other instead of wrapping into one another
    const lean = new Map<number, 'ar' | 'al'>()
    for (const k of ['theory', 'voice'] as const) {
      const ns = LESSONS.filter((L) => L.lane === k)
        .map((L) => L.n)
        .sort((a, b) => a - b)
      for (let i = 1; i < ns.length; i++) {
        if (ns[i] - ns[i - 1] < 2) {
          lean.set(ns[i - 1], 'ar')
          lean.set(ns[i], 'al')
        }
      }
    }
    for (const L of LESSONS) {
      const p = pos(L.n)
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
      const lab = document.createElement('div')
      const w = 150
      const leans = lean.get(L.n)
      lab.className = `nlabel${L.lane === 'theory' ? ' up' : ''}${leans === undefined ? '' : ` ${leans}`}`
      lab.style.width = `${w}px`
      if (L.lane === 'both') {
        lab.style.top = `${p.y - 9}px`
        lab.style.width = '110px'
        lab.style.marginLeft = '0'
        if (L.n === 0) {
          lab.style.left = `${p.x + 30}px`
          lab.classList.add('al')
        } else {
          lab.style.left = `${p.x - 30 - 110}px`
          lab.classList.add('ar')
        }
      } else {
        lab.style.top = `${L.lane === 'theory' ? p.y - 34 : p.y + 34}px`
        if (leans === 'ar') {
          lab.style.left = `${p.x + 18 - w}px`
          lab.style.marginLeft = '0'
        } else if (leans === 'al') {
          lab.style.left = `${p.x - 18}px`
          lab.style.marginLeft = '0'
        } else {
          lab.style.left = `${p.x}px`
          lab.style.marginLeft = `${-w / 2}px`
        }
      }
      lab.textContent = L.short
      graph.appendChild(lab)
      labels.set(L.n, lab)
    }
    paint()
  }

  function renderList(): void {
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
      const pre = PREREQ[L.n] ?? []
      const st = status(L)
      li.innerHTML = `<button type="button" class="it" aria-expanded="false"><span class="nb">${L.n}</span><span>${L.short}</span><small>${st === 'ready' ? 'Ready' : st === 'done' ? 'Done' : 'Planned'}${pre.length > 0 ? ` · after ${pre.join(', ')}` : ''}</small></button>`
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
    for (const L of LESSONS) {
      const st = status(L)
      const on = matches(L)
      const stClass = st === 'planned' ? '' : ` ${st}`
      const node = nodes.get(L.n)
      if (node !== undefined) {
        node.className = `node${stClass}${L.n === sel ? ' sel' : ''}${ancestors.has(L.n) ? ' anc' : ''}${on ? '' : ' dim'}`
        node.setAttribute('aria-pressed', String(L.n === sel))
        if (st === 'done') node.innerHTML = check(18)
        else node.textContent = String(L.n)
      }
      const label = labels.get(L.n)
      if (label !== undefined) {
        label.classList.remove('sel', 'dim')
        if (L.n === sel) label.classList.add('sel')
        if (!on) label.classList.add('dim')
      }
      const row = list.querySelector(`[data-n="${L.n}"] .it`)
      if (row !== null) {
        row.className = `it${stClass}${on ? '' : ' dim'}`
        row.setAttribute('aria-expanded', String(L.n === sel && open))
        q('.nb', row).innerHTML = st === 'done' ? check(16) : String(L.n)
      }
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

  return {
    refresh,
    select,
    setLength(n, len) {
      lengths.set(n, len)
      refresh()
    },
  }
}
