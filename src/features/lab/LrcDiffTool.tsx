// ============================================================
// LrcDiffTool — measure one mapping against another
// ============================================================
//
// Load two enhanced-LRC mappings of the same song and see how far apart they
// are: the headline numbers, then a line-by-line table so a single bad line
// is findable rather than averaged away.
//
// The arithmetic is src/lib/lrc-compare.ts, shared with `pnpm lyrics:compare`
// so the numbers on screen and the numbers in a terminal cannot disagree.
//
// Plan: docs/plans/lrc-mapper-studio-plan.md (Phase 5).

import type { Component } from 'solid-js'
import { createMemo, createSignal, For, Show } from 'solid-js'
import { Split } from '@/components/icons'
import { compareLrcText, shareWithin } from '@/lib/lrc-compare'
import labStyles from './Lab.module.css'
import styles from './LrcDiffTool.module.css'

/** Tolerances worth reporting: a tight one, a usable one, a loose one. */
const TOLERANCES_MS = [50, 100, 250] as const

/** Where a bias bar saturates. Beyond a second the line is simply wrong. */
const BIAS_SCALE_SEC = 1

const fmtSec = (value: number) => `${value.toFixed(3)} s`
const fmtSigned = (value: number) =>
  `${value >= 0 ? '+' : ''}${value.toFixed(3)} s`
const fmtPct = (value: number) => `${(value * 100).toFixed(1)}%`

interface SlotProps {
  label: string
  hint: string
  text: () => string
  setText: (text: string) => void
}

const Slot: Component<SlotProps> = (props) => (
  <div class={styles.slot}>
    <div class={styles.slotHead}>
      <span class={styles.slotLabel}>{props.label}</span>
      <span class={styles.slotHint}>{props.hint}</span>
    </div>
    <input
      accept=".lrc,.txt,text/plain"
      class={styles.file}
      onChange={(e) => {
        const file = e.currentTarget.files?.[0]
        if (file === undefined) return
        // Resolved out here rather than inside .then: reading props in a
        // callback that outlives the handler is what solid/reactivity warns
        // about, and the setter is what we actually need to carry across.
        const apply = props.setText
        void file.text().then(apply)
      }}
      type="file"
    />
    <textarea
      aria-label={`${props.label} enhanced LRC`}
      class={styles.paste}
      onInput={(e) => props.setText(e.currentTarget.value)}
      placeholder="[00:10.00]word [00:10.42]by [00:10.90]word"
      spellcheck={false}
      value={props.text()}
    />
  </div>
)

export const LrcDiffTool: Component = () => {
  const [referenceText, setReferenceText] = createSignal('')
  const [candidateText, setCandidateText] = createSignal('')

  const comparison = createMemo(() => {
    const reference = referenceText().trim()
    const candidate = candidateText().trim()
    if (reference === '' || candidate === '') return null
    return compareLrcText(reference, candidate)
  })

  /** Worst lines first — the table is for finding them, not for reading. */
  const rankedLines = createMemo(() => {
    const result = comparison()
    if (result === null) return []
    return [...result.lines].sort((a, b) => {
      if (a.status !== b.status) return a.status === 'text-mismatch' ? -1 : 1
      return b.meanAbsolute - a.meanAbsolute
    })
  })

  const biasWidth = (bias: number) =>
    `${Math.min(50, (Math.abs(bias) / BIAS_SCALE_SEC) * 50)}%`

  return (
    <div>
      <p class={labStyles.hint}>
        Both files must be enhanced LRC — a timestamp in front of every word —
        and must be the same lyrics. Lines are matched by position and by text;
        a line whose words differ is reported rather than realigned, because
        guessing an alignment would invent agreement that is not there.
      </p>

      <div class={styles.inputs}>
        <Slot
          hint="the mapping you trust"
          label="Reference"
          setText={setReferenceText}
          text={referenceText}
        />
        <Slot
          hint="the one being measured"
          label="Candidate"
          setText={setCandidateText}
          text={candidateText}
        />
      </div>

      <Show
        fallback={
          <div class={labStyles.empty}>
            <span class={labStyles.emptyGlyph} aria-hidden="true">
              <Split />
            </span>
            <h3 class={labStyles.emptyTitle}>Nothing to compare yet</h3>
            <p class={labStyles.emptyBody}>
              Load or paste both mappings above. The headline numbers and the
              per-line table appear as soon as each side has content.
            </p>
          </div>
        }
        when={comparison()}
      >
        {(result) => (
          <>
            <div class={styles.summary}>
              <div class={styles.stat}>
                <span class={styles.statLabel}>Words compared</span>
                <span class={styles.statValue}>{result().comparedWords}</span>
              </div>
              <div class={styles.stat}>
                <span class={styles.statLabel}>Median error</span>
                <span class={styles.statValue}>
                  {fmtSec(result().medianAbsolute)}
                </span>
              </div>
              <div class={styles.stat}>
                <span class={styles.statLabel}>Mean error</span>
                <span class={styles.statValue}>
                  {fmtSec(result().meanAbsolute)}
                </span>
              </div>
              <div class={styles.stat}>
                <span class={styles.statLabel}>95th percentile</span>
                <span class={styles.statValue}>
                  {fmtSec(result().p95Absolute)}
                </span>
              </div>
              <div class={styles.stat}>
                <span class={styles.statLabel}>Worst word</span>
                <span class={styles.statValue}>
                  {fmtSec(result().maxAbsolute)}
                </span>
              </div>
              <div class={styles.stat}>
                <span class={styles.statLabel}>Bias</span>
                <span class={styles.statValue}>
                  {fmtSigned(result().medianBias)}
                </span>
              </div>
              <For each={TOLERANCES_MS}>
                {(ms) => (
                  <div class={styles.stat}>
                    <span class={styles.statLabel}>Within {ms} ms</span>
                    <span class={styles.statValue}>
                      {fmtPct(shareWithin(result().deltas, ms / 1000))}
                    </span>
                  </div>
                )}
              </For>
            </div>

            <Show
              when={result().medianBias !== 0 && result().comparedWords > 0}
            >
              <p class={styles.warn}>
                A bias this uniform is usually one setting, not many bad taps:
                the candidate runs {fmtSigned(result().medianBias)} against the
                reference, so Shift all in the mapper would close most of the
                gap.
              </p>
            </Show>

            <Show when={result().mismatchedLines.length > 0}>
              <p class={styles.warn}>
                {result().mismatchedLines.length} line
                {result().mismatchedLines.length === 1 ? '' : 's'} could not be
                compared — the words differ between the two files. Lines{' '}
                {result().mismatchedLines.slice(0, 12).join(', ')}
                {result().mismatchedLines.length > 12 ? ' …' : ''}.
              </p>
            </Show>

            <div class={styles.tableWrap}>
              <table class={styles.table}>
                <thead>
                  <tr>
                    <th>Line</th>
                    <th>Text</th>
                    <th class={styles.num}>Words</th>
                    <th class={styles.num}>Mean error</th>
                    <th class={styles.num}>Bias</th>
                    <th>Early / late</th>
                  </tr>
                </thead>
                <tbody>
                  <For each={rankedLines()}>
                    {(line) => (
                      <tr
                        classList={{
                          [styles.mismatch]: line.status === 'text-mismatch',
                        }}
                      >
                        <td class={styles.num}>{line.lineIdx + 1}</td>
                        <td class={styles.lineText}>{line.text}</td>
                        <td class={styles.num}>
                          {line.status === 'text-mismatch'
                            ? 'text differs'
                            : line.words.length}
                        </td>
                        <td class={styles.num}>
                          {line.status === 'text-mismatch'
                            ? '—'
                            : fmtSec(line.meanAbsolute)}
                        </td>
                        <td class={styles.num}>
                          {line.status === 'text-mismatch'
                            ? '—'
                            : fmtSigned(line.medianBias)}
                        </td>
                        <td>
                          <Show when={line.status === 'compared'}>
                            <span class={styles.biasBar}>
                              <span
                                class={styles.biasFill}
                                classList={{
                                  [styles.biasFillLate]: line.medianBias > 0,
                                }}
                                style={{
                                  left:
                                    line.medianBias >= 0
                                      ? '50%'
                                      : `calc(50% - ${biasWidth(line.medianBias)})`,
                                  width: biasWidth(line.medianBias),
                                }}
                              />
                            </span>
                          </Show>
                        </td>
                      </tr>
                    )}
                  </For>
                </tbody>
              </table>
            </div>
          </>
        )}
      </Show>
    </div>
  )
}
