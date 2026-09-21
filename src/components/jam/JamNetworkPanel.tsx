// ── JamNetworkPanel ──────────────────────────────────────────────────
// What the connection is actually doing, while two people are in a room
// on two real devices in two real places.
//
// This exists because every previous answer to "why does the jam feel
// laggy" has been a guess. The room showed one number -- an ICE round
// trip measured once, at the least representative moment of the session
// (see measureLatency in lib/jam/service.ts) -- and that number is not
// the latency a musician feels, it is one term in it, usually not the
// largest. The panel shows the whole budget, says which parts are
// measured and which are platform constants, and exports the run so a
// number from a Zagreb-to-Vienna test can be compared with one from
// Zagreb-to-London a week later.
//
// NOT A PRODUCTION SURFACE. Gated on IS_DIAGNOSTIC_BUILD, which is true
// on the local dev server, a PR preview and the dev domain, and false in
// production. It is on the dev domain deliberately: a two-phone latency
// test needs a real HTTPS origin the phones can both reach, and a build
// that only exists under `pnpm dev` is the one build that cannot be run
// on the device worth measuring.
//
// The sampler only runs while the panel is expanded. getStats() walks
// every stats object on every peer connection, and a diagnostics surface
// that slows down the thing it measures is worse than none.

import type { Component } from 'solid-js'
import { createMemo, createSignal, For, onCleanup, onMount, Show, } from 'solid-js'
import { Copy, RotateCcw } from '@/components/icons'
import { IS_DIAGNOSTIC_BUILD } from '@/lib/defaults'
import type { JamBudgetTerm } from '@/lib/jam/jam-latency-budget'
import { buildLatencyBudget, VERDICT_COPY } from '@/lib/jam/jam-latency-budget'
import type { JamRollingStats } from '@/lib/jam/jam-net-stats'
import type { JamPeerDiagnostics } from '@/stores/jam-diagnostics-store'
import { exportCsv, jamDiagnostics, jamDiagnosticsEnabled, jamDiagnosticsLabel, resetJamDiagnostics, setJamDiagnosticsEnabled, setJamDiagnosticsLabel, startJamDiagnostics, stopJamDiagnostics, summariseRun, } from '@/stores/jam-diagnostics-store'
import { jamDiagnosticsSources, jamPeers, jamRoomId } from '@/stores/jam-store'
import { micLatencyMs } from '@/stores/mic-latency-store'
import styles from './JamNetworkPanel.module.css'

/** Whether this build may show the panel at all. */
export function jamNetworkPanelAvailable(): boolean {
  return IS_DIAGNOSTIC_BUILD
}

export const JamNetworkPanel: Component = () => {
  const [copied, setCopied] = createSignal<string | null>(null)
  let copiedTimer: ReturnType<typeof setTimeout> | undefined

  const running = () => jamDiagnosticsEnabled()

  const toggle = (): void => {
    const next = !running()
    setJamDiagnosticsEnabled(next)
    if (next) startJamDiagnostics(jamDiagnosticsSources)
    else stopJamDiagnostics()
  }

  // Resume a run that was enabled before a reload. A two-device test is
  // full of reloads, and having to re-arm the panel on a phone each time
  // is how a run ends up with a hole in the middle of it.
  onMount(() => {
    if (jamDiagnosticsEnabled()) startJamDiagnostics(jamDiagnosticsSources)
  })

  onCleanup(() => {
    stopJamDiagnostics()
    clearTimeout(copiedTimer)
  })

  const announce = (what: string): void => {
    setCopied(what)
    clearTimeout(copiedTimer)
    copiedTimer = setTimeout(() => setCopied(null), 1800)
  }

  const copy = (text: string, what: string): void => {
    void navigator.clipboard
      ?.writeText(text)
      .then(() => announce(what))
      // A phone without clipboard permission still needs the numbers out,
      // and a silent failure here wastes a whole test run.
      .catch(() => announce('clipboard refused — see console'))
    console.info(`[jam:diagnostics]\n${text}`)
  }

  const meta = () => ({
    label: jamDiagnosticsLabel(),
    roomId: jamRoomId(),
    userAgent: navigator.userAgent,
    deviceRoundTripMs: micLatencyMs() > 0 ? micLatencyMs() : null,
  })

  return (
    <Show when={jamNetworkPanelAvailable()}>
      <section class={styles.panel} aria-label="Jam network diagnostics">
        <header class={styles.head}>
          <h3 class={styles.title}>Network</h3>
          <button
            type="button"
            class={styles.toggle}
            classList={{ [styles.toggleOn!]: running() }}
            aria-pressed={running()}
            onClick={toggle}
          >
            {running() ? 'Sampling' : 'Start sampling'}
          </button>
        </header>

        <Show
          when={running()}
          fallback={
            <p class={styles.hint}>
              Off by default — reading the stats on every peer every second is
              not free. Start it when you are measuring, stop it when you are
              playing.
            </p>
          }
        >
          <label class={styles.labelRow}>
            <span class={styles.labelText}>Run label</span>
            <input
              class={styles.input}
              type="text"
              placeholder="Zagreb - Vienna, 5 GHz, wired headphones"
              value={jamDiagnosticsLabel()}
              onInput={(e) => setJamDiagnosticsLabel(e.currentTarget.value)}
            />
          </label>

          <div class={styles.actions}>
            <button
              type="button"
              class={styles.action}
              onClick={() => {
                resetJamDiagnostics()
                announce('window cleared')
              }}
            >
              <RotateCcw />
              <span>New run</span>
            </button>
            <button
              type="button"
              class={styles.action}
              onClick={() =>
                copy(summariseRun(jamDiagnostics(), meta()), 'summary copied')
              }
            >
              <Copy />
              <span>Copy summary</span>
            </button>
            <button
              type="button"
              class={styles.action}
              onClick={() => copy(exportCsv(jamDiagnostics()), 'CSV copied')}
            >
              <Copy />
              <span>Copy CSV</span>
            </button>
          </div>

          <Show when={copied()}>
            {(what) => (
              <p class={styles.copied} role="status">
                {what()}
              </p>
            )}
          </Show>

          <Show
            when={jamDiagnostics().length > 0}
            fallback={
              <p class={styles.hint}>
                Waiting for a connected peer. Nothing to measure in an empty
                room.
              </p>
            }
          >
            <For each={jamDiagnostics()}>
              {(peer) => <PeerCard peer={peer} />}
            </For>
          </Show>
        </Show>
      </section>
    </Show>
  )
}

const PeerCard: Component<{ peer: JamPeerDiagnostics }> = (props) => {
  const displayName = createMemo(
    () =>
      jamPeers().find((p) => p.id === props.peer.peerId)?.displayName ??
      props.peer.peerId.slice(0, 8),
  )

  /**
   * The budget is built from the DataChannel ping where there is one.
   *
   * ICE's `currentRoundTripTime` measures the STUN leg of the candidate
   * pair; on a relayed path that is the leg to the TURN server, not the
   * route. The application ping crosses everything a real message
   * crosses, so it is the better input where it exists -- and where it
   * does not (a channel still opening), the ICE figure is right enough.
   */
  const budget = createMemo(() =>
    buildLatencyBudget({
      rttMs: props.peer.channelPingMs ?? props.peer.reading.latest.rttMs,
      jitterBufferMs: props.peer.reading.jitterBufferMs,
      deviceRoundTripMs: micLatencyMs() > 0 ? micLatencyMs() : null,
    }),
  )

  const latest = () => props.peer.reading.latest

  return (
    <article class={styles.peer}>
      <header class={styles.peerHead}>
        <span class={styles.peerName}>{displayName()}</span>
        <span
          class={styles.path}
          data-path={latest().path}
          title={`local ${latest().localCandidateType ?? '?'} / remote ${latest().remoteCandidateType ?? '?'}`}
        >
          {latest().path}
        </span>
      </header>

      <div class={styles.verdict} data-verdict={budget().verdict}>
        <strong class={styles.total}>
          {budget().totalMs.toFixed(0)}
          <span class={styles.unit}>ms</span>
        </strong>
        <span class={styles.verdictCopy}>
          {VERDICT_COPY[budget().verdict]}
          {budget().partial ? ' (some terms unmeasured — this is a floor)' : ''}
        </span>
      </div>

      <dl class={styles.budget}>
        <For each={budget().terms}>{(term) => <BudgetRow term={term} />}</For>
      </dl>

      <table class={styles.stats}>
        <caption class={styles.caption}>
          Over the window. p95 is what sizes a jitter buffer; the mean is what
          makes a bad connection look fine.
        </caption>
        <thead>
          <tr>
            <th scope="col">&nbsp;</th>
            <th scope="col">now</th>
            <th scope="col">p50</th>
            <th scope="col">p95</th>
            <th scope="col">p99</th>
            <th scope="col">max</th>
          </tr>
        </thead>
        <tbody>
          <StatRow
            label="ICE RTT"
            now={latest().rttMs}
            stats={props.peer.rttStats}
          />
          <StatRow
            label="Channel ping"
            now={props.peer.channelPingMs}
            stats={props.peer.pingStats}
          />
          <StatRow
            label="Jitter buffer"
            now={props.peer.reading.jitterBufferMs}
            stats={props.peer.bufferStats}
          />
        </tbody>
      </table>

      <dl class={styles.extras}>
        <Extra
          label="Buffer target"
          value={fmtMs(props.peer.reading.jitterBufferTargetMs)}
        />
        <Extra
          label="Buffer average"
          value={fmtMs(props.peer.reading.jitterBufferAvgMs)}
        />
        <Extra label="Interarrival jitter" value={fmtMs(latest().jitterMs)} />
        <Extra
          label="Packet loss"
          value={fmtPct(props.peer.reading.lossFraction)}
        />
        <Extra
          label="Concealed audio"
          value={fmtPct(props.peer.reading.concealedFraction)}
        />
        <Extra
          label="Buffer adjust"
          value={
            props.peer.reading.netBufferAdjustmentSamples === null
              ? '—'
              : `${props.peer.reading.netBufferAdjustmentSamples > 0 ? '+' : ''}${props.peer.reading.netBufferAdjustmentSamples} samples`
          }
        />
        <Extra label="In" value={fmtKbps(props.peer.reading.inboundKbps)} />
        <Extra label="Out" value={fmtKbps(props.peer.reading.outboundKbps)} />
        <Extra
          label="Codec"
          value={
            latest().codec === null
              ? '—'
              : `${latest().codec} ${latest().codecClockRate ?? '?'} Hz ${latest().codecChannels ?? '?'}ch`
          }
        />
      </dl>
    </article>
  )
}

const BudgetRow: Component<{ term: JamBudgetTerm }> = (props) => (
  <div class={styles.budgetRow} data-source={props.term.source}>
    <dt class={styles.budgetLabel} title={props.term.note}>
      {props.term.label}
      <span class={styles.source}>{props.term.source}</span>
    </dt>
    <dd class={styles.budgetValue}>{fmtMs(props.term.ms)}</dd>
  </div>
)

const StatRow: Component<{
  label: string
  now: number | null
  stats: JamRollingStats | null
}> = (props) => (
  <tr>
    <th scope="row">{props.label}</th>
    <td>{fmtNum(props.now)}</td>
    <td>{fmtNum(props.stats?.p50 ?? null)}</td>
    <td>{fmtNum(props.stats?.p95 ?? null)}</td>
    <td>{fmtNum(props.stats?.p99 ?? null)}</td>
    <td>{fmtNum(props.stats?.max ?? null)}</td>
  </tr>
)

const Extra: Component<{ label: string; value: string }> = (props) => (
  <div class={styles.extra}>
    <dt>{props.label}</dt>
    <dd>{props.value}</dd>
  </div>
)

/** A missing measurement reads as a dash, never as zero. */
function fmtMs(v: number | null): string {
  return v === null ? '—' : `${v.toFixed(1)} ms`
}

function fmtNum(v: number | null): string {
  return v === null ? '—' : v.toFixed(1)
}

function fmtPct(v: number | null): string {
  return v === null ? '—' : `${(v * 100).toFixed(2)}%`
}

function fmtKbps(v: number | null): string {
  return v === null ? '—' : `${v.toFixed(0)} kbps`
}
