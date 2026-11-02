// ============================================================
// SingerSheet — report a singer, or block one
// ============================================================
//
// Slice 4b of docs/plans/native-more-and-community.md: what App Store
// guideline 1.2 and Play's user-generated content policy ask wherever an
// app shows what other singers post. Opened on one singer from a board's
// "..." (singer-sheet-store.ts), it offers Report and Block. Report asks a
// reason from the worker's own list (report-rules.ts) and an optional note;
// Block says what it does before it does it. The contact form sits under
// the report and its answer, for whatever a report cannot say.
//
// Built on the kit's Sheet, so the one sheet serves the web's chrome and
// the phone's shell, in the app's tokens for light and dark. Escape closes
// it (the Sheet's focus trap), and so does the phone's Back
// (shell-navigation.ts). Each pane change hands the focus to its title.
// The flow is singer-sheet-flow.ts; the words are singer-sheet-copy.ts.

import type { JSX } from 'solid-js'
import { For, Match, Show, Switch } from 'solid-js'
import { AlertTriangle, ChevronLeft, X } from '@/components/icons'
import { Sheet } from '@/components/mobile/Sheet'
import { REPORT_NOTE_MAX, REPORT_REASONS, } from '@/db/services/moderation-service'
import type { SingerSheetSubject } from '@/stores/singer-sheet-store'
import { closeSingerSheet } from '@/stores/singer-sheet-store'
import { ALREADY_OPEN_WORDS, BLOCK_WORDS, noteCount, paneTitle, problemWords, REASON_WORDS, reportContactUrl, SENT_WORDS, } from './singer-sheet-copy'
import type { SingerSheetFlow } from './singer-sheet-flow'
import { createSingerSheetFlow } from './singer-sheet-flow'
import styles from './SingerSheet.module.css'

const NOTE_ID = 'singer-report-note'
const COUNT_ID = 'singer-report-count'

export interface SingerSheetProps {
  /** Opens the app's own sign-in, where the host has one to open. */
  onSignIn?: () => void
}

interface PaneProps {
  flow: SingerSheetFlow
  subject: SingerSheetSubject
  onSignIn?: () => void
}

/** "Need to tell us more? Contact us": the contact form, about a report. */
function ContactLine(props: { subject: SingerSheetSubject }): JSX.Element {
  const href = (): string => {
    const target = props.subject.report ?? {
      kind: 'user' as const,
      id: props.subject.userId,
    }
    return reportContactUrl(props.subject.displayName, target.kind, target.id)
  }
  return (
    <p class={styles.contact}>
      <span>Need to tell us more?</span>
      <a
        class={styles.contactLink}
        href={href()}
        target="_blank"
        rel="noopener noreferrer"
        data-testid="singer-contact"
      >
        Contact us
      </a>
    </p>
  )
}

function SignInButton(props: { onSignIn?: () => void }): JSX.Element {
  return (
    <Show when={props.onSignIn}>
      {(signIn) => (
        <button
          type="button"
          class={styles.primary}
          data-testid="singer-sign-in"
          onClick={() => {
            closeSingerSheet()
            signIn()()
          }}
        >
          Sign in
        </button>
      )}
    </Show>
  )
}

function ChoosePane(props: PaneProps): JSX.Element {
  return (
    <div class={styles.options}>
      <button
        type="button"
        class={styles.option}
        data-testid="singer-choose-report"
        onClick={() => props.flow.go('report')}
      >
        <span class={styles.optionText}>
          <span class={styles.optionName}>Report</span>
          <span class={styles.optionSub}>
            Tell us what is wrong. We read every report within a day.
          </span>
        </span>
        <span class={styles.chevron} aria-hidden="true">
          <ChevronLeft />
        </span>
      </button>
      <button
        type="button"
        class={styles.option}
        data-testid="singer-choose-block"
        onClick={() => props.flow.go('block')}
      >
        <span class={styles.optionText}>
          <span class={styles.optionName}>Block</span>
          <span class={styles.optionSub}>
            You will not see each other's names or posts.
          </span>
        </span>
        <span class={styles.chevron} aria-hidden="true">
          <ChevronLeft />
        </span>
      </button>
    </div>
  )
}

function ReportPane(props: PaneProps): JSX.Element {
  return (
    <form
      class={styles.form}
      onSubmit={(event) => {
        event.preventDefault()
        void props.flow.sendReport()
      }}
    >
      <fieldset class={styles.reasons}>
        <legend class={styles.legend}>Why are you reporting this?</legend>
        <For each={REPORT_REASONS}>
          {(value) => (
            <label class={styles.reason}>
              <input
                type="radio"
                name="singer-report-reason"
                value={value}
                checked={props.flow.reason() === value}
                onChange={() => props.flow.setReason(value)}
              />
              <span>{REASON_WORDS[value]}</span>
            </label>
          )}
        </For>
      </fieldset>
      <label class={styles.noteLabel} for={NOTE_ID}>
        Anything else we should know? Optional.
      </label>
      <textarea
        id={NOTE_ID}
        class={styles.note}
        rows={3}
        maxLength={REPORT_NOTE_MAX}
        value={props.flow.note()}
        aria-describedby={COUNT_ID}
        onInput={(event) => props.flow.setNote(event.currentTarget.value)}
      />
      <span id={COUNT_ID} class={styles.count}>
        {noteCount(props.flow.note())}
      </span>
      {/* Not `disabled` while the report is out: a disabled button drops
          the focus it has. */}
      <button
        type="submit"
        class={styles.primary}
        disabled={props.flow.reason() === null}
        aria-disabled={props.flow.busy() ? 'true' : undefined}
        data-testid="singer-report-send"
      >
        {props.flow.busy() ? 'Sending…' : 'Send report'}
      </button>
      <ContactLine subject={props.subject} />
    </form>
  )
}

function SentPane(props: PaneProps): JSX.Element {
  return (
    <>
      <p class={styles.body} data-testid="singer-sent">
        {props.flow.sentBefore() ? ALREADY_OPEN_WORDS : SENT_WORDS}
      </p>
      <ContactLine subject={props.subject} />
      <button type="button" class={styles.primary} onClick={closeSingerSheet}>
        Done
      </button>
    </>
  )
}

function BlockPane(props: PaneProps): JSX.Element {
  return (
    <>
      <p class={styles.body}>{BLOCK_WORDS}</p>
      <button
        type="button"
        class={styles.danger}
        aria-disabled={props.flow.busy() ? 'true' : undefined}
        data-testid="singer-block-confirm"
        onClick={() => void props.flow.block()}
      >
        {props.flow.busy() ? 'Blocking…' : `Block ${props.subject.displayName}`}
      </button>
      <button
        type="button"
        class={styles.secondary}
        onClick={() => props.flow.go('choose')}
      >
        Cancel
      </button>
    </>
  )
}

function BlockedPane(): JSX.Element {
  return (
    <>
      <p class={styles.body} data-testid="singer-blocked">
        {BLOCK_WORDS}
      </p>
      <button type="button" class={styles.primary} onClick={closeSingerSheet}>
        Done
      </button>
    </>
  )
}

function AccountPane(props: PaneProps): JSX.Element {
  return (
    <>
      <p class={styles.body} data-testid="singer-account">
        {problemWords('report', 'account', props.subject.displayName).body}
      </p>
      <SignInButton onSignIn={props.onSignIn} />
      <ContactLine subject={props.subject} />
    </>
  )
}

function ProblemPane(props: PaneProps): JSX.Element {
  const words = () => {
    const last = props.flow.failed()
    return last === null
      ? null
      : problemWords(last.action, last.problem, props.subject.displayName)
  }
  return (
    <Show when={words()}>
      {(said) => (
        <>
          <div class={styles.warn} role="alert" data-testid="singer-problem">
            <AlertTriangle />
            <p>{said().body}</p>
          </div>
          <Show when={said().retry !== null}>
            <button
              type="button"
              class={styles.primary}
              aria-disabled={props.flow.busy() ? 'true' : undefined}
              data-testid="singer-retry"
              onClick={() => props.flow.retry()}
            >
              Try again
            </button>
          </Show>
          <Show when={said().signIn}>
            <SignInButton onSignIn={props.onSignIn} />
          </Show>
          <Show when={props.flow.failed()?.action === 'report'}>
            <ContactLine subject={props.subject} />
          </Show>
          <button
            type="button"
            class={styles.secondary}
            onClick={closeSingerSheet}
          >
            Close
          </button>
        </>
      )}
    </Show>
  )
}

export function SingerSheet(props: SingerSheetProps): JSX.Element {
  let title: HTMLHeadingElement | undefined
  const flow = createSingerSheetFlow(() => {
    // After the pane has drawn: the title is the same element, its words
    // the new pane's, and a screen reader reads them as it takes the focus.
    queueMicrotask(() => title?.focus({ preventScroll: true }))
  })
  const name = (): string => flow.subject()?.displayName ?? ''
  const canGoBack = (): boolean =>
    flow.pane() === 'block' ||
    (flow.pane() === 'report' && flow.subject()?.reportOnly !== true)

  return (
    <Sheet
      isOpen={flow.subject() !== null}
      close={closeSingerSheet}
      ariaLabel={`Report or block ${name()}`}
    >
      <Show when={flow.subject()}>
        {(subject) => (
          <div
            class={styles.sheet}
            data-testid="singer-sheet"
            data-pane={flow.pane()}
          >
            <div class={styles.head}>
              <Show
                when={canGoBack()}
                fallback={<span class={styles.spacer} />}
              >
                <button
                  type="button"
                  class={styles.iconButton}
                  aria-label="Back"
                  data-testid="singer-back"
                  onClick={() => flow.go('choose')}
                >
                  <ChevronLeft />
                </button>
              </Show>
              <h2 ref={title} class={styles.title} tabindex="-1">
                {paneTitle(flow.pane(), name(), flow.failed())}
              </h2>
              <button
                type="button"
                class={styles.iconButton}
                aria-label="Close"
                data-testid="singer-close"
                onClick={closeSingerSheet}
              >
                <X />
              </button>
            </div>
            <Switch>
              <Match when={flow.pane() === 'choose'}>
                <ChoosePane flow={flow} subject={subject()} />
              </Match>
              <Match when={flow.pane() === 'report'}>
                <ReportPane flow={flow} subject={subject()} />
              </Match>
              <Match when={flow.pane() === 'sent'}>
                <SentPane flow={flow} subject={subject()} />
              </Match>
              <Match when={flow.pane() === 'block'}>
                <BlockPane flow={flow} subject={subject()} />
              </Match>
              <Match when={flow.pane() === 'blocked'}>
                <BlockedPane />
              </Match>
              <Match when={flow.pane() === 'account'}>
                <AccountPane
                  flow={flow}
                  subject={subject()}
                  onSignIn={props.onSignIn}
                />
              </Match>
              <Match when={flow.pane() === 'problem'}>
                <ProblemPane
                  flow={flow}
                  subject={subject()}
                  onSignIn={props.onSignIn}
                />
              </Match>
            </Switch>
          </div>
        )}
      </Show>
    </Sheet>
  )
}
