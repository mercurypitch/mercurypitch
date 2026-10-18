// ============================================================
// Lesson 1 blueprint — the episode's beats and the plan files
// ============================================================
//
// For the team: the 7:30 beat sheet drawn to scale (each beat's flex grow is
// its length in seconds), the same beats as a list, and links to the plan
// files on main.

import { q } from '@/features/lessons/kit/dom'

/** [start, name, seconds, class]; 'pr' marks the predict beat. */
const BEATS: readonly (readonly [string, string, number, string?])[] = [
  ['0:00', 'Cold open', 30],
  ['0:30', 'Title sting', 4],
  ['0:34', 'Promise', 26],
  ['1:00', 'Act 1: the concrete model', 90],
  ['2:30', 'Predict', 20, 'pr'],
  ['2:50', 'Act 2: the twist', 100],
  ['4:30', 'Act 3: name it', 60],
  ['5:30', 'Act 4: sing it', 60],
  ['6:30', 'Recap', 35],
  ['7:05', 'Next and end screen', 25],
]

/** [path under docs/plans/find-your-pitch/, what it holds]; a trailing slash is a folder. */
const FILES: readonly (readonly [string, string])[] = [
  ['MASTER-PLAN.md', 'Vision, decisions, formats, phases, risks'],
  ['CURRICULUM.md', 'Season 1 cards, the topic graph, Seasons 2 and 3'],
  ['TEACHING-PLAYBOOK.md', 'The 25 rules and their evidence'],
  ['MERC-BIBLE.md', 'The hosts: roles, looks, voices'],
  ['PRODUCTION-PIPELINE.md', 'Step by step, tool by tool'],
  [
    'lessons/01-what-is-a-note/',
    "Lesson 1: facts, script, storyboard, this page's copy",
  ],
]

const REPO = 'https://github.com/mercurypitch/mercurypitch'

export function createBlueprint(): void {
  const bar = q('#beatbar')
  const ol = q('#beatlist')
  BEATS.forEach(([t, name, s, cls], i) => {
    const seg = document.createElement('i')
    seg.style.flex = `${s} 1 0`
    // alternate beats shade apart, and the four acts stand out
    const o = 0.16 + (i % 2) * 0.12 + (name.startsWith('Act') ? 0.14 : 0)
    seg.style.setProperty('--o', o.toFixed(2))
    if (cls !== undefined) seg.className = cls
    seg.title = `${t} ${name}`
    bar.appendChild(seg)
    const li = document.createElement('li')
    if (cls !== undefined) li.className = cls
    li.innerHTML = `<time>${t}</time><span>${name}</span>`
    ol.appendChild(li)
  })

  const host = q('#files')
  for (const [f, d] of FILES) {
    const a = document.createElement('a')
    const kind = f.endsWith('/') ? 'tree' : 'blob'
    a.href = `${REPO}/${kind}/main/docs/plans/find-your-pitch/${f}`
    a.target = '_blank'
    a.rel = 'noopener'
    a.innerHTML = `<b><svg class="ico" aria-hidden="true"><use href="#i-file"/></svg>${f}</b><span>${d}</span>`
    host.appendChild(a)
  }
}
