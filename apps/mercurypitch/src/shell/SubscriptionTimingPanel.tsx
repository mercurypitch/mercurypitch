// ============================================================
// Cloud subscription: how long each step took, read on the phone
// ============================================================
//
// Subscribe took close to a minute on TestFlight build 919 and the build
// could not say where the minute went. This section of the Developer screen
// lists the last Subscribe, Restore purchase and sign-in carries, newest
// first, with every store step's time and how long the songs took to reach
// the server after the store's yes (subscription-timing.ts records them).
// Copy timings hands the lot to the clipboard, or selects it where the
// clipboard is refused.
//
// Registered by the native entry alone, behind VITE_PORTABLE_CONSOLE and
// KARAOKE_IMPORT, through a dynamic import (main.tsx), so a store build
// carries none of it.

import type { Component } from 'solid-js'
import { createSignal, For, Index, onCleanup, Show } from 'solid-js'
import { copyText } from './settings/copy-text'
import type { FlowTiming, SubscriptionTiming } from './subscription-timing'
import { appSubscriptionTiming, FLOW_NAMES, flowLine, formatMs, outcomeLine, serverLine, } from './subscription-timing'

/** Every flow timed, one line each, newest first. */
export function timingsReport(flows: readonly FlowTiming[]): string {
  if (flows.length === 0) return 'Cloud subscription: nothing timed yet.'
  return ['Cloud subscription, newest first:', ...flows.map(flowLine)].join(
    '\n',
  )
}

/** When it started, by the wall clock: "14:02:31". */
const startedAt = (flow: FlowTiming): string =>
  new Date(flow.startedAt).toLocaleTimeString('en-GB')

const FlowReadout: Component<{ flow: FlowTiming }> = (props) => (
  <dl class="mp-dev__readout" data-flow={props.flow.flow}>
    <div class="mp-dev__readout-row" data-timing-row="flow">
      <dt>{FLOW_NAMES[props.flow.flow]}</dt>
      <dd>
        {outcomeLine(props.flow)} · {startedAt(props.flow)}
      </dd>
    </div>
    <Index each={props.flow.steps}>
      {(step) => (
        <div class="mp-dev__readout-row" data-timing-row={step().step}>
          <dt>{step().step}</dt>
          <dd>
            {formatMs(step().ms)}
            {step().failed ? ' (failed)' : ''}
          </dd>
        </div>
      )}
    </Index>
    <Show when={serverLine(props.flow)}>
      {(line) => (
        <div class="mp-dev__readout-row" data-timing-row="server">
          <dt>server</dt>
          <dd>{line()}</dd>
        </div>
      )}
    </Show>
  </dl>
)

export const SubscriptionTimingPanel: Component<{
  /** The app's own unless a test gives one. */
  timing?: SubscriptionTiming
}> = (props) => {
  const flows = (): readonly FlowTiming[] =>
    (props.timing ?? appSubscriptionTiming()).flows()
  const [copied, setCopied] = createSignal(false)
  const [report, setReport] = createSignal('')
  let reportEl: HTMLPreElement | undefined
  let copiedTimer: number | undefined
  onCleanup(() => {
    window.clearTimeout(copiedTimer)
  })

  const copy = async (): Promise<void> => {
    const text = timingsReport(flows())
    setReport(text)
    if (await copyText(text)) {
      setCopied(true)
      window.clearTimeout(copiedTimer)
      copiedTimer = window.setTimeout(() => setCopied(false), 1800)
      return
    }
    // iOS refuses the clipboard often enough: select the report instead,
    // which always works.
    if (reportEl === undefined) return
    const range = document.createRange()
    range.selectNodeContents(reportEl)
    const selection = window.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(range)
  }

  return (
    <div class="mp-dev__timings" data-testid="dev-cloud-timings">
      <Show
        when={flows().length > 0}
        fallback={
          <dl class="mp-dev__readout">
            <div class="mp-dev__readout-row" data-timing-row="none">
              <dt>Timed</dt>
              <dd>
                nothing yet: Subscribe, Restore purchase, or sign in after a
                purchase made signed out
              </dd>
            </div>
          </dl>
        }
      >
        <For each={flows()}>{(flow) => <FlowReadout flow={flow} />}</For>
      </Show>
      <button
        type="button"
        class="mp-dev__row"
        data-testid="dev-cloud-timings-copy"
        onClick={() => void copy()}
      >
        <span class="mp-dev__row-title">
          {copied() ? 'Copied' : 'Copy timings'}
        </span>
        <span class="mp-dev__row-sub">
          Every flow above, one line each, newest first.
        </span>
      </button>
      <Show when={report() !== ''}>
        <pre
          ref={reportEl}
          class="mp-dev__report"
          data-testid="dev-cloud-timings-report"
        >
          {report()}
        </pre>
      </Show>
    </div>
  )
}
