// ============================================================
// Lesson 5 wrap — the practise card the checkpoint picks, and free play
// ============================================================
//
// The practise card comes in two versions (WEB-SPEC, Toys 6): the Voice
// Mirror card, one link, with "Ten minutes, gently, most days", or, after
// "Uncomfortable" or "Just listen today", the rest card, which links
// nowhere and names Voice Mirror for another day (kit/comfort.ts
// `mountPractiseCard`). The checkpoint's ending is held in memory for the visit
// (kit/comfort.ts `VisitEnding`), never stored, so a new visit opens on the
// Voice Mirror card.
//
// Free play unlocks after the lesson (playbook rule 17): Push, the breath
// gauge and the three starts, one at a time on one stage.

import { mountPractiseCard } from '@/features/lessons/kit/comfort'
import { q, qa } from '@/features/lessons/kit/dom'
import { watch } from '@/features/lessons/kit/frame-loop'
import { mountGauge } from './toy-gauge'
import { mountPush } from './toy-push'
import { mountStarts } from './toy-starts'

function initPractiseCard(): void {
  mountPractiseCard(q('#practiseCard'))
}

function initFreePlay(): void {
  const root = q('#freePlay')
  const tabs = qa<HTMLButtonElement>('[data-free]', root)
  const stages = qa('[data-free-toy]', root)
  let shown = 'push'
  // a toy draws while it is the one shown and its stage is on screen
  const isShown = (name: string, el: HTMLElement): (() => boolean) => {
    const seen = watch(el)
    return () => shown === name && seen()
  }
  const toys = [
    mountPush(q('#freePush'), { active: isShown('push', q('#freePush')) }),
    mountGauge(q('#freeGauge'), { active: isShown('gauge', q('#freeGauge')) }),
    mountStarts(q('#freeStarts'), {
      active: isShown('starts', q('#freeStarts')),
    }),
  ]
  for (const tab of tabs) {
    tab.addEventListener('click', () => {
      shown = tab.dataset.free ?? 'push'
      tabs.forEach((t) => t.setAttribute('aria-pressed', String(t === tab)))
      stages.forEach((s) => {
        s.hidden = s.dataset.freeToy !== shown
      })
      toys.forEach((t) => t.stop())
    })
  }
}

export function initWrap(): void {
  initPractiseCard()
  initFreePlay()
}
