// ============================================================
// Lesson 3 wrap — the practise card the checkpoint picks, and free play
// ============================================================
//
// The practise card comes in two versions (WEB-SPEC, Toys 7): the Voice
// Mirror card, one link, with "Ten minutes, gently, most days", or, after
// "Uncomfortable" or "Just listen today", the rest card, which links
// nowhere and names Voice Mirror for another day (kit/comfort.ts
// `mountPractiseCard`). The checkpoint's ending is held in memory for the visit
// (kit/comfort.ts `VisitEnding`), never stored, so a new visit opens on the
// Voice Mirror card.
//
// Free play unlocks after the lesson (playbook rule 17): the folds, the
// slider match with rounds on A3, C4 and F3, and the band chart in drag
// mode, one at a time on one stage.

import { mountPractiseCard } from '@/features/lessons/kit/comfort'
import { q, qa } from '@/features/lessons/kit/dom'
import { watch } from '@/features/lessons/kit/frame-loop'
import type { BandToy } from './toy-band'
import { mountBandToy } from './toy-band'
import type { Folds } from './toy-folds'
import { mountFolds } from './toy-folds'
import type { Match } from './toy-match'
import { mountMatch } from './toy-match'

function initPractiseCard(): void {
  mountPractiseCard(q('#practiseCard'))
}

function initFreePlay(): void {
  const root = q('#freePlay')
  const tabs = qa<HTMLButtonElement>('[data-free]', root)
  const stages = qa('[data-free-toy]', root)
  let shown = 'folds'
  // a toy draws while it is the one shown and its stage is on screen
  const isShown = (name: string, el: HTMLElement): (() => boolean) => {
    const seen = watch(el)
    return () => shown === name && seen()
  }
  const folds: Folds = mountFolds(q('#freeFolds'), {
    active: isShown('folds', q('#freeFolds')),
  })
  const match: Match = mountMatch(q('#freeMatch'), {
    active: isShown('match', q('#freeMatch')),
  })
  const band: BandToy = mountBandToy(q('#freeBand'), {
    chase: false,
    active: isShown('band', q('#freeBand')),
  })
  for (const tab of tabs) {
    tab.addEventListener('click', () => {
      shown = tab.dataset.free ?? 'folds'
      tabs.forEach((t) => t.setAttribute('aria-pressed', String(t === tab)))
      stages.forEach((s) => {
        s.hidden = s.dataset.freeToy !== shown
      })
      folds.stop()
      match.stop()
      band.stop()
    })
  }
}

export function initWrap(): void {
  initPractiseCard()
  initFreePlay()
}
