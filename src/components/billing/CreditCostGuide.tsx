// ============================================================
// How credits are spent — a chip that opens the cost guide
// ============================================================
//
// Sits under the processing cards in Settings › Credits. Closed, it is one
// small chip; open, it lists what a song costs, from the live pricing
// (credit-cost-model.ts).

import type { Component } from 'solid-js'
import { createMemo, createSignal, createUniqueId, Show } from 'solid-js'
import { ChevronDown, Info } from '@/components/icons'
import type { Pricing } from '@/db/services/billing-service'
import { creditCosts, creditCount } from './credit-cost-model'
import styles from './CreditCostGuide.module.css'

export const CreditCostGuide: Component<{ pricing: Pricing }> = (props) => {
  const [open, setOpen] = createSignal(false)
  const panelId = createUniqueId()
  const costs = createMemo(() => creditCosts(props.pricing))

  return (
    <Show when={costs()}>
      {(c) => (
        <div class={styles.guide}>
          <button
            type="button"
            class={styles.chip}
            aria-expanded={open()}
            aria-controls={panelId}
            onClick={() => setOpen(!open())}
            data-testid="credit-cost-chip"
          >
            {/* The glyph is drawn for a round button; the ring keeps it from
                reading as a letter. */}
            <span class={styles.infoMark} aria-hidden="true">
              <Info size={10} />
            </span>
            <span>How credits are spent</span>
            <span
              class={styles.chevron}
              classList={{ [styles.chevronOpen]: open() }}
              aria-hidden="true"
            >
              <ChevronDown size={14} />
            </span>
          </button>

          <Show when={open()}>
            <div
              id={panelId}
              class={styles.panel}
              data-testid="credit-cost-guide"
            >
              <p class={styles.lead}>What one song costs</p>
              <ul class={styles.rows}>
                <li class={styles.row}>
                  <div class={styles.rowHead}>
                    <span class={styles.rowLabel}>2&nbsp;stems</span>
                    <span class={styles.price}>
                      {creditCount(c().twoStems)}
                    </span>
                  </div>
                  <p class={styles.rowDesc}>Your voice and the band, apart.</p>
                </li>
                <Show when={c().fullBand}>
                  {(band) => (
                    <li class={styles.row}>
                      <div class={styles.rowHead}>
                        <span class={styles.rowLabel}>Full band</span>
                        <span class={styles.price}>{creditCount(band())}</span>
                      </div>
                      <p class={styles.rowDesc}>
                        Voice, drums, bass, guitar, piano and the rest, each on
                        its own.
                      </p>
                    </li>
                  )}
                </Show>
                <li class={styles.row}>
                  <div class={styles.rowHead}>
                    <span class={styles.rowLabel}>Long songs</span>
                  </div>
                  <p class={styles.rowDesc}>
                    Up to {c().includedMinutes}&nbsp;minutes, a song counts
                    once. Every&nbsp;{c().extraBlockMinutes}&nbsp;minutes past
                    that, even part of it, counts again.
                  </p>
                  <p class={styles.example} data-testid="credit-cost-example">
                    A {c().example.minutes}-minute song counts{' '}
                    {c().example.times === 2
                      ? 'twice'
                      : `${c().example.times} times`}
                    : {creditCount(c().example.twoStems)} as 2&nbsp;stems
                    <Show when={c().example.fullBand}>
                      {(band) => <>, {band()} as the full band</>}
                    </Show>
                    .
                  </p>
                </li>
                <li class={styles.row}>
                  <div class={styles.rowHead}>
                    <span class={styles.rowLabel}>On this device</span>
                    <span class={styles.price}>Free</span>
                  </div>
                  <p class={styles.rowDesc}>
                    A split your own device runs never uses credits.
                  </p>
                </li>
              </ul>
              <p class={styles.note}>
                If a Cloud GPU split fails, or you cancel it before it starts,
                the credits come back.
              </p>
            </div>
          </Show>
        </div>
      )}
    </Show>
  )
}
