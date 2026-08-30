// ============================================================
// Stem Storage Bench — dev-only measurement surface for the Blob migration
// ============================================================
//
// The UI is a thin shell over stem-storage-bench.ts: pick sizes, run each
// driver, read the table, copy the markdown into the plan. Dev builds only —
// LabSurface never registers this tool in production.

import { createMemo, createSignal, For, Show } from 'solid-js'
import type { StemBenchRun, StemStorageBenchConfig, StemStorageDriver, } from './stem-storage-bench'
import { formatBenchRun, runStemStorageBench, sampleBenchMemory, STEM_STORAGE_DRIVERS, } from './stem-storage-bench'
import styles from './StemStorageBench.module.css'

const MIB = 1024 * 1024

function ms(value: number | null): string {
  return value === null ? '—' : `${value.toFixed(1)}`
}

function mib(value: number | null): string {
  return value === null ? 'n/a' : `${(value / MIB).toFixed(1)} MiB`
}

export function StemStorageBench() {
  const [stemMib, setStemMib] = createSignal(60)
  const [stemCount, setStemCount] = createSignal(3)
  const [decode, setDecode] = createSignal(false)
  const [running, setRunning] = createSignal<string | null>(null)
  const [progress, setProgress] = createSignal('')
  const [runs, setRuns] = createSignal<readonly StemBenchRun[]>([])
  const [error, setError] = createSignal<string | null>(null)
  const [isolated] = createSignal(
    typeof crossOriginIsolated !== 'undefined' && crossOriginIsolated,
  )

  const config = createMemo(
    (): StemStorageBenchConfig => ({
      stemBytes: Math.max(1, Math.round(stemMib())) * MIB,
      stemCount: Math.min(12, Math.max(1, Math.round(stemCount()))),
      decode: decode(),
    }),
  )

  const runDriver = async (driver: StemStorageDriver): Promise<void> => {
    if (running() !== null) return
    setError(null)
    setRunning(driver.id)
    try {
      const run = await runStemStorageBench(driver, config(), {
        onProgress: setProgress,
      })
      setRuns((current) => [...current, run])
    } catch (cause) {
      setError(
        `${driver.label}: ${cause instanceof Error ? cause.message : String(cause)}`,
      )
    } finally {
      setRunning(null)
      setProgress('')
    }
  }

  const runAll = async (): Promise<void> => {
    for (const driver of STEM_STORAGE_DRIVERS) {
      if (driver.available()) await runDriver(driver)
    }
  }

  const cleanUp = async (): Promise<void> => {
    if (running() !== null) return
    setRunning('cleanup')
    try {
      for (const driver of STEM_STORAGE_DRIVERS) {
        if (driver.available()) await driver.clear()
      }
      setRuns([])
      setError(null)
    } finally {
      setRunning(null)
    }
  }

  const copySummary = async (): Promise<void> => {
    const summary = [
      `## Stem storage bench — ${new Date().toISOString()}`,
      `Browser: ${navigator.userAgent}`,
      `crossOriginIsolated: ${String(isolated())}`,
      '',
      ...runs().map(formatBenchRun),
    ].join('\n')
    await navigator.clipboard.writeText(summary)
  }

  const sampleNow = async (): Promise<void> => {
    const sample = await sampleBenchMemory()
    setProgress(
      `page ${mib(sample.pageBytes)} · JS heap ${mib(sample.jsHeapBytes)}`,
    )
  }

  return (
    <section class={styles.bench} aria-label="Stem storage bench">
      <header class={styles.head}>
        <h2>Stem storage bench</h2>
        <p>
          Phase 0 of the Blob migration plan. Writes synthetic WAV stems as
          ArrayBuffer rows, Blob rows, and OPFS files, then walks the production
          read path — row read, URL mint, fetch, optional decode — timing each
          step and checking round-trip integrity.
        </p>
        <p class={styles.memoryNote} data-ok={isolated()}>
          {isolated()
            ? 'Cross-origin isolated: page-wide memory sampling is live.'
            : 'Not cross-origin isolated: page memory reads n/a. JS heap still shown, but it misses blob storage — use the browser task manager beside it.'}
        </p>
      </header>

      <div class={styles.controls}>
        <label>
          <span>Stem size (MiB)</span>
          <input
            type="number"
            min="1"
            max="200"
            value={stemMib()}
            disabled={running() !== null}
            onInput={(event) =>
              setStemMib(Number(event.currentTarget.value) || 1)
            }
          />
        </label>
        <label>
          <span>Stem count</span>
          <input
            type="number"
            min="1"
            max="12"
            value={stemCount()}
            disabled={running() !== null}
            onInput={(event) =>
              setStemCount(Number(event.currentTarget.value) || 1)
            }
          />
        </label>
        <label class={styles.toggle}>
          <input
            type="checkbox"
            checked={decode()}
            disabled={running() !== null}
            onChange={(event) => setDecode(event.currentTarget.checked)}
          />
          <span>Decode each stem (slow, allocates PCM)</span>
        </label>
      </div>

      <div class={styles.actions}>
        <For each={STEM_STORAGE_DRIVERS}>
          {(driver) => (
            <button
              type="button"
              disabled={running() !== null || !driver.available()}
              onClick={() => void runDriver(driver)}
            >
              {driver.available()
                ? `Run ${driver.label}`
                : `${driver.label} unavailable`}
            </button>
          )}
        </For>
        <button
          type="button"
          class={styles.primary}
          disabled={running() !== null}
          onClick={() => void runAll()}
        >
          Run all
        </button>
        <button
          type="button"
          disabled={running() !== null}
          onClick={() => void sampleNow()}
        >
          Sample memory now
        </button>
        <button
          type="button"
          disabled={running() !== null || runs().length === 0}
          onClick={() => void copySummary()}
        >
          Copy markdown summary
        </button>
        <button
          type="button"
          disabled={running() !== null}
          onClick={() => void cleanUp()}
        >
          Delete bench data
        </button>
      </div>

      <Show when={running()}>
        <p class={styles.progress} role="status">
          Running {running()}… {progress()}
        </p>
      </Show>
      <Show when={running() === null && progress() !== ''}>
        <p class={styles.progress} role="status">
          {progress()}
        </p>
      </Show>
      <Show when={error()}>
        <p class={styles.error} role="alert">
          {error()}
        </p>
      </Show>

      <For each={runs()}>
        {(run) => (
          <article class={styles.run}>
            <h3>
              {run.driver} — {run.config.stemCount} ×{' '}
              {(run.config.stemBytes / MIB).toFixed(0)} MiB, total{' '}
              {ms(run.totalMs)} ms
            </h3>
            <div class={styles.tableScroll}>
              <table>
                <thead>
                  <tr>
                    <th>stem</th>
                    <th>write ms</th>
                    <th>read row ms</th>
                    <th>mint URL ms</th>
                    <th>fetch ms</th>
                    <th>decode ms</th>
                    <th>integrity</th>
                  </tr>
                </thead>
                <tbody>
                  <For each={run.stems}>
                    {(stem) => (
                      <tr data-corrupt={!stem.hashOk}>
                        <td>{stem.name}</td>
                        <td>{ms(stem.writeMs)}</td>
                        <td>{ms(stem.readMs)}</td>
                        <td>{ms(stem.urlMs)}</td>
                        <td>{ms(stem.fetchMs)}</td>
                        <td>{ms(stem.decodeMs)}</td>
                        <td>{stem.hashOk ? 'ok' : 'CORRUPT'}</td>
                      </tr>
                    )}
                  </For>
                </tbody>
              </table>
            </div>
            <div class={styles.tableScroll}>
              <table>
                <thead>
                  <tr>
                    <th>checkpoint</th>
                    <th>page memory</th>
                    <th>JS heap</th>
                  </tr>
                </thead>
                <tbody>
                  <For each={run.checkpoints}>
                    {(point) => (
                      <tr>
                        <td>{point.label}</td>
                        <td>{mib(point.memory.pageBytes)}</td>
                        <td>{mib(point.memory.jsHeapBytes)}</td>
                      </tr>
                    )}
                  </For>
                </tbody>
              </table>
            </div>
          </article>
        )}
      </For>
    </section>
  )
}
