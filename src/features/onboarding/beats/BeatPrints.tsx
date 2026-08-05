// ============================================================
// Beat — your voiceprints, at full size
// ============================================================
//
// Offered instead of the 90-second measurement to someone who has
// already done it. Before this beat existed, a returning visitor was
// asked to "map my whole voice" as if the app had never met them, and
// the only place their takes appeared at all was a row of 31px chips
// in Settings → account.
//
// The card here is the SAME art the Share button exports
// (`renderVoiceprintCard`), so what they are looking at is exactly
// what they can post. Oldest to newest along the rail reads as a
// timeline of a voice changing, which is the whole reason to keep more
// than one.
//
// Rendering is per-record and lazy: each card is a canvas built from a
// 928x1152 portrait, and a singer with a dozen takes must not pay for
// twelve of them on mount.

import type { Component } from 'solid-js'
import { createMemo, createResource, createSignal, For, onCleanup, onMount, Show, } from 'solid-js'
import type { VoiceprintRecord } from '@/db/services/voiceprint-service'
import { renderVoiceprintCard } from '@/features/mirror/voiceprint-share'
import { midiToNoteNameOctave } from '@/lib/note-utils'
import styles from '../onboarding.module.css'

export interface BeatPrintsProps {
  /** Newest first — the order `listVoiceprints` returns. */
  records: readonly VoiceprintRecord[]
  /** On to the Map. */
  onContinue: () => void
  /** Leave the flow for the Voice Mirror and take a fresh one. */
  onAnother: () => void
  /** Open the saved match map without leaving this returning-user beat. */
  onExplore: () => void
}

function formatDate(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

/** "G2 to E5", or null when the take never captured a range. */
function formatRange(record: VoiceprintRecord): string | null {
  const low = record.summary.lowMidi
  const high = record.summary.highMidi
  if (low == null || high == null) return null
  return `${midiToNoteNameOctave(low)} to ${midiToNoteNameOctave(high)}`
}

/**
 * One card. It renders only once it has been scrolled anywhere near
 * the viewport — see the file header for why that matters.
 */
const PrintCard: Component<{
  record: VoiceprintRecord
  hero?: boolean
}> = (props) => {
  const [near, setNear] = createSignal(false)
  let host: HTMLDivElement | undefined

  onMount(() => {
    // The hero is on screen by definition; everything else waits.
    if (props.hero === true || host === undefined) {
      setNear(true)
      return
    }
    if (typeof IntersectionObserver === 'undefined') {
      setNear(true)
      return
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return
        setNear(true)
        observer.disconnect()
      },
      { rootMargin: '200px' },
    )
    observer.observe(host)
    onCleanup(() => observer.disconnect())
  })

  const [art] = createResource(
    () => (near() ? props.record : undefined),
    async (record) => {
      const canvas = await renderVoiceprintCard(record, 'face')
      return canvas?.toDataURL('image/png') ?? null
    },
  )

  const range = () => formatRange(props.record)

  return (
    <div
      ref={host}
      class={`${styles.printCard} ${props.hero === true ? styles.printHero : ''}`}
    >
      <Show
        when={art() != null}
        fallback={
          // No twin portrait was ever drawn for this take (or the art
          // failed to load). Say what the record actually holds rather
          // than showing a broken frame.
          <div class={styles.printFallback}>
            <span class={styles.printFallbackRange}>
              {range() ?? 'Voiceprint'}
            </span>
          </div>
        }
      >
        <img
          class={styles.printImg}
          src={art() as string}
          alt={`Voiceprint from ${formatDate(props.record.takenAt)}`}
        />
      </Show>
      <p class={styles.printMeta}>
        <Show when={props.record.twin != null && props.record.twin !== ''}>
          <span class={styles.printTwin}>{props.record.twin}</span>
        </Show>
        <span class={styles.printDate}>{formatDate(props.record.takenAt)}</span>
        <Show when={range() !== null}>
          <span class={styles.printRange}>{range()}</span>
        </Show>
      </p>
    </div>
  )
}

export const BeatPrints: Component<BeatPrintsProps> = (props) => {
  const latest = createMemo<VoiceprintRecord | null>(
    () => props.records[0] ?? null,
  )
  // Oldest first along the rail: a timeline reads left to right, and
  // the newest one is already the hero above it.
  const rest = createMemo<VoiceprintRecord[]>(() =>
    props.records.slice(1).reverse(),
  )

  const count = () => props.records.length

  return (
    <div class={`${styles.beat} ${styles.beatWide}`} data-beat="prints">
      <p class={styles.eyebrow}>
        {count() === 1 ? 'One voiceprint' : `${count()} voiceprints`}
      </p>
      <h1 class={styles.headline}>Your voice, so far</h1>
      <p class={styles.sub}>
        <Show
          when={count() > 1}
          fallback="This is the take we have on record. Make another whenever you like — a voice moves."
        >
          Newest first, then every take before it. Watching them change is the
          point of keeping more than one.
        </Show>
      </p>

      <Show when={latest() !== null}>
        <PrintCard record={latest() as VoiceprintRecord} hero />
      </Show>

      <Show when={rest().length > 0}>
        <p class={styles.sideLabel}>Earlier takes</p>
        <div class={styles.printRail}>
          <For each={rest()}>{(record) => <PrintCard record={record} />}</For>
        </div>
      </Show>

      <div class={styles.actions}>
        <button
          type="button"
          class={styles.primary}
          onClick={() => props.onContinue()}
        >
          See my map
        </button>
        <button
          type="button"
          class={styles.secondary}
          onClick={() => props.onAnother()}
        >
          Make another
        </button>
        <button
          type="button"
          class={styles.secondary}
          onClick={() => props.onExplore()}
        >
          Explore your voice constellation
        </button>
      </div>
    </div>
  )
}

export default BeatPrints
