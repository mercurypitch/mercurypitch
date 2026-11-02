// ============================================================
// The singer sheet's flow — its panes, and what each button does
// ============================================================
//
// SingerSheet.tsx draws; this decides. Each open starts afresh on the pane
// the singer can use: the account pane without a registered account
// (reports and blocks are theirs alone, decision 8 of the plan), the choice
// otherwise. A report or a block that fails says why in the service's words
// (singer-sheet-copy.ts), and a session the server refused is asked to sign
// in again, as every other refused read is; a suspended account is told
// so, and never asked to sign in.
//
// One request at a time: while a report or a block is out, a second tap on
// Send, Block or Try again does nothing (`busy`). A request belongs to the
// open it was made in: once the sheet has closed, or opened again, its
// answer moves no pane and frees nothing, though a block that landed still
// has its board read again.

import { batch, createComputed, createSignal, on } from 'solid-js'
import { accountHeld, handleCloudSessionRejected, } from '@/db/services/auth-service'
import type { ModerationProblem, ReportReason, } from '@/db/services/moderation-service'
import { reportContent } from '@/db/services/moderation-service'
import { blockSingerAndHide } from '@/stores/blocked-singers-store'
import type { SingerSheetSubject } from '@/stores/singer-sheet-store'
import { singerSheetSubject } from '@/stores/singer-sheet-store'
import type { SheetAction, SheetPane, SheetProblem } from './singer-sheet-copy'

export interface SingerSheetFlow {
  subject: () => SingerSheetSubject | null
  pane: () => SheetPane
  /** Move to a pane; the sheet moves the focus to its title. */
  go: (pane: SheetPane) => void
  reason: () => ReportReason | null
  setReason: (reason: ReportReason) => void
  note: () => string
  setNote: (note: string) => void
  /** A request is out. */
  busy: () => boolean
  failed: () => SheetProblem | null
  sendReport: () => Promise<void>
  block: () => Promise<void>
  /** Try the failed request again, or go back to the report to change it. */
  retry: () => void
}

/** The pane an open starts on. */
export function firstPane(registered: boolean): SheetPane {
  return registered ? 'choose' : 'account'
}

/** What a report names: the subject's share, or the singer themself. */
function reportTarget(subject: SingerSheetSubject) {
  return subject.report ?? { kind: 'user' as const, id: subject.userId }
}

export function createSingerSheetFlow(
  onPane: (pane: SheetPane) => void,
): SingerSheetFlow {
  const [pane, setPane] = createSignal<SheetPane>('choose')
  const [reason, setReason] = createSignal<ReportReason | null>(null)
  const [note, setNote] = createSignal('')
  const [busy, setBusy] = createSignal(false)
  const [failed, setFailed] = createSignal<SheetProblem | null>(null)

  // Before the sheet draws, so an open never shows the last one's pane.
  createComputed(
    on(singerSheetSubject, (subject) => {
      if (subject === null) return
      batch(() => {
        setReason(null)
        setNote('')
        setBusy(false)
        setFailed(null)
        setPane(firstPane(accountHeld()))
      })
    }),
  )

  const go = (next: SheetPane): void => {
    setPane(next)
    onPane(next)
  }

  /** Still open on the singer the request was for. */
  const stillOn = (subject: SingerSheetSubject): boolean =>
    singerSheetSubject() === subject

  function fail(action: SheetAction, problem: ModerationProblem): void {
    // A suspension was signed out by the service, and says so on its pane.
    if (problem === 'refused') handleCloudSessionRejected()
    if (problem === 'account') {
      go('account')
      return
    }
    setFailed({ action, problem })
    go('problem')
  }

  async function sendReport(): Promise<void> {
    const subject = singerSheetSubject()
    const chosen = reason()
    if (subject === null || chosen === null || busy()) return
    const target = reportTarget(subject)
    const words = note()
    setBusy(true)
    const outcome = await reportContent({
      targetKind: target.kind,
      targetId: target.id,
      reason: chosen,
      note: words,
    })
    if (!stillOn(subject)) return
    setBusy(false)
    if (outcome.status === 'sent') go('sent')
    else if (outcome.status === 'already-open') go('already')
    else fail('report', outcome.status)
  }

  async function block(): Promise<void> {
    const subject = singerSheetSubject()
    if (subject === null || busy()) return
    setBusy(true)
    const outcome = await blockSingerAndHide(subject.userId)
    // The board reads again whether or not the sheet is still up: the
    // block stands either way.
    if (outcome.status === 'blocked') subject.onBlocked?.()
    if (!stillOn(subject)) return
    setBusy(false)
    if (outcome.status === 'blocked') go('blocked')
    else fail('block', outcome.status)
  }

  /** Each request it makes again turns a second tap away itself. */
  function retry(): void {
    const last = failed()
    if (last === null) return
    if (last.problem === 'invalid') {
      go('report')
      return
    }
    void (last.action === 'report' ? sendReport() : block())
  }

  return {
    subject: singerSheetSubject,
    pane,
    go,
    reason,
    setReason,
    note,
    setNote,
    busy,
    failed,
    sendReport,
    block,
    retry,
  }
}
