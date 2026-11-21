// ============================================================
// Stage notice — what pops out of Merc's bubble, whoever says it
// ============================================================
//
// The drill stage speaks in one place, Merc's bubble, and a notice lies over
// it (StageNotice.tsx draws it). Two things say one: the voice take's
// question after a run (take-notice.ts), and, in the web build, the app's
// own notices, achievements among them, which the stage presents in place
// of the toasts (notifications-store.ts, `presentNoticesOnStage`). This is
// the banner both are drawn as, each turned into one, and the order the
// bubble gives them.

import { badgeArtSrc } from '@/lib/badge-art'
import { unlockHeading, unlockNames } from '@/lib/unlock-copy'
import type { Notification } from '@/stores/notifications-store'
import type { TakeNotice } from './take-notice'

/** The hairline and the mark's colour. */
export type StageNoticeTone =
  | 'ask'
  | 'info'
  | 'success'
  | 'warning'
  | 'error'
  | 'unlock'

/** What stands before the words: the type's mark, or a badge's medallion. */
export type StageNoticeMark =
  | { readonly kind: 'type'; readonly type: Notification['type'] }
  | { readonly kind: 'art'; readonly src: string }

export interface StageNoticeAction {
  readonly label: string
  /** On show, but something it started is under way, so it does nothing. */
  readonly busy: boolean
  readonly press: () => void
}

export interface StageNoticeModel {
  /** The same key is the same notice with new words; a new key pops anew. */
  readonly key: string
  /** The take's notice, or one of the app's. */
  readonly source: 'take' | 'app'
  readonly testId: string
  /** Its state or type, for styles and tests (`data-kind`). */
  readonly kind: string
  readonly tone: StageNoticeTone
  readonly mark: StageNoticeMark | null
  /** A check before the title: done. */
  readonly checked: boolean
  /** A heading over the line. */
  readonly title: string | null
  /** A subject in the tone's colour at the head of the line, as the
   *  toasts and the native pill set a notice's title ("Microphone"). */
  readonly subject: string | null
  readonly line: string | null
  /** Capsules: the first filled, a second quieter. Two at most. */
  readonly actions: readonly StageNoticeAction[]
  /** The close: its accessible name and what it does. */
  readonly close: { readonly label: string; readonly press: () => void } | null
  /** A tap on the words, or an upward swipe, dismisses it; null where it
   *  may not (the take's close throws the take away). */
  readonly dismiss: (() => void) | null
  /** Read at once, as an alert, rather than politely. */
  readonly alert: boolean
}

/** The close every app notice has, as the toasts' has its name. */
export const DISMISS_NOTICE_LABEL = 'Dismiss notification'

/** The test id of an app notice on the stage. */
export const STAGE_NOTICE_TEST_ID = 'exercise-stage-notice'

/**
 * One of the app's notices as the stage draws it. `remove` takes it off the
 * screen (the store's `removeNotification`), after an action as after a
 * dismiss, as the toasts do.
 */
export function noticeFromNotification(
  notif: Notification,
  remove: (id: number) => void,
): StageNoticeModel {
  const gone = (): void => remove(notif.id)
  const unlocks = notif.unlocks ?? []
  const unlock = unlocks.length > 0
  const art = unlock ? badgeArtSrc(unlocks[0]!.icon) : undefined
  // An unlock is a heading and its names; anything else its message, with
  // its title, if it has one, as the message's subject.
  const title = unlock ? unlockHeading(unlocks) : null
  const subject = unlock ? null : (notif.title ?? null)
  const line = unlock ? unlockNames(unlocks) : notif.message
  const actions: StageNoticeAction[] = []
  for (const action of [notif.action, notif.secondaryAction]) {
    if (action === undefined) continue
    actions.push({
      label: action.label,
      busy: false,
      press: () => {
        action.onClick()
        gone()
      },
    })
  }
  return {
    key: `notice-${notif.id}`,
    source: 'app',
    testId: STAGE_NOTICE_TEST_ID,
    kind: unlock ? 'unlock' : notif.type,
    tone: unlock ? 'unlock' : notif.type,
    mark:
      art === undefined
        ? { kind: 'type', type: notif.type }
        : { kind: 'art', src: art },
    checked: false,
    title,
    subject,
    line,
    actions,
    close: { label: DISMISS_NOTICE_LABEL, press: gone },
    dismiss: gone,
    alert: notif.type === 'error',
  }
}

/** The voice take's notice as the stage draws it; its words are its own. */
export function noticeFromTake(
  notice: TakeNotice,
  handlers: { keep: () => void; close: () => void },
): StageNoticeModel {
  return {
    key: 'take',
    source: 'take',
    testId: 'exercise-take-notice',
    kind: notice.kind,
    tone: notice.tone,
    mark: null,
    checked: notice.kind === 'kept',
    title: notice.title,
    subject: null,
    line: notice.line,
    actions:
      notice.primary === null
        ? []
        : [
            {
              label: notice.primary,
              busy: notice.primaryBusy,
              press: handlers.keep,
            },
          ],
    close:
      notice.close === null
        ? null
        : { label: notice.close, press: handlers.close },
    dismiss: null,
    alert: false,
  }
}

/** A warning or an error: the bubble's first word, and its only one in a run. */
export function isUrgentNotice(notice: StageNoticeModel): boolean {
  return notice.tone === 'warning' || notice.tone === 'error'
}

export interface BubbleNoticeInput {
  /** The app's notice the store has on screen for the stage, if any. */
  app: StageNoticeModel | null
  /** "Hear it first": the example's line is in the bubble. */
  example: boolean
  /** The voice take's notice, if it has something to say. */
  take: StageNoticeModel | null
}

/**
 * The notice Merc's bubble shows, or null where it shows its own words. The
 * first that applies: a warning or an error; then the example's line (no
 * notice); then any other of the app's notices; then the take's notice;
 * then nothing, and the bubble says the run's instruction or the brief.
 * While a run is under way, and while the take has the bubble (its
 * question, a keep, "Take kept"), the store keeps the calmer notices back,
 * so the take's comes before an achievement the run earned.
 */
export function bubbleNotice(
  input: BubbleNoticeInput,
): StageNoticeModel | null {
  if (input.app !== null && isUrgentNotice(input.app)) return input.app
  if (input.example) return null
  return input.app ?? input.take
}

/** The least room kept between a notice and a control under it, px. */
export const NOTICE_CONTROL_GAP_PX = 4

export interface NoticeFitInput {
  /** The notice's height with its whole message. */
  height: number
  /** From its top edge to the first control under it, less the gap. */
  room: number
  /** The message's line height, and how many lines it takes whole. */
  lineHeight: number
  lines: number
}

/**
 * How many lines of its message a notice keeps so that it ends above the
 * first control under it, or null where it fits whole. Never fewer than
 * one: a phone's drill has a control a little under Merc's row (Start, at
 * the head of the sheet), and a notice with a capsule shows the head of its
 * message there rather than lie over the button. A screen reader still
 * reads all of it.
 */
export function linesThatFit(input: NoticeFitInput): number | null {
  if (input.height <= input.room) return null
  const cut = Math.ceil((input.height - input.room) / input.lineHeight)
  return Math.max(1, input.lines - cut)
}
