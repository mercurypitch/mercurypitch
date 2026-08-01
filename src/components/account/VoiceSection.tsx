// ============================================================
// VoiceSection — your voiceprints, and how they've moved
// ============================================================
//
// The other half of the promise beat 7 makes. Onboarding says "keep
// your twin and watch your range grow"; this is where that turns out
// to be true.
//
// The growth line is `computeDelta`, which already existed — it was
// just anchored to one local baseline. Given a history it becomes a
// real timeline, which is the difference between a novelty and a
// reason to come back in March.
//
// Signed out this still works, on whatever the device holds. The
// difference an account makes is stated rather than hidden behind a
// locked panel.

import type { Component } from 'solid-js'
import { createResource, createSignal, For, onCleanup, Show } from 'solid-js'
import type { VoiceprintRecord } from '@/db/services/voiceprint-service'
import { listVoiceprints } from '@/db/services/voiceprint-service'
import { legendArt, LegendCaricature } from '@/features/mirror/LegendCaricature'
import { renderVoiceprintCard, shareVoiceprintRecord, } from '@/features/mirror/voiceprint-share'
import { computeDelta } from '@/lib/mirror/metrics'
import { midiToNoteNameOctave } from '@/lib/note-utils'
import { showNotification } from '@/stores/notifications-store'
import styles from './VoiceSection.module.css'

function formatDate(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

/** "+3 semitones", "−2 steadiness" — sign always shown, zero omitted. */
function formatDelta(value: number | null, unit: string): string | null {
  if (value === null || Math.round(value) === 0) return null
  const rounded = Math.round(value)
  return `${rounded > 0 ? '+' : '−'}${Math.abs(rounded)} ${unit}`
}

export interface VoiceSectionProps {
  /** True when signed in — changes what we say about durability. */
  signedIn: boolean
}

export const VoiceSection: Component<VoiceSectionProps> = (props) => {
  const [prints] = createResource(listVoiceprints)
  const [zoomed, setZoomed] = createSignal(false)
  // In the zoom overlay a click on the card flips it (portrait <-> the
  // record's numbers); a click outside closes. Reset on every open.
  const [flipped, setFlipped] = createSignal(false)
  const [sharing, setSharing] = createSignal(false)

  const shareLatest = async (variant: 'face' | 'stats') => {
    const record = latest()
    if (record == null || sharing()) return
    setSharing(true)
    try {
      const outcome = await shareVoiceprintRecord(record, variant)
      if (outcome === 'unavailable')
        showNotification('This voiceprint has no twin card to share.', 'info')
    } finally {
      setSharing(false)
    }
  }

  /** The raster portrait for the current twin, if one has been drawn. */
  const portraitSrc = (): string | undefined => {
    const twin = latest()?.twin
    if (twin == null || twin === '') return undefined
    return legendArt(twin).imageSrc
  }

  /** Small twin portrait for a history chip, when that take has one. */
  const historyThumbSrc = (print: VoiceprintRecord): string | undefined => {
    if (print.twin == null || print.twin === '') return undefined
    const src = legendArt(print.twin).imageSrc
    return src == null || src === '' ? undefined : src
  }

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') setZoomed(false)
  }
  window.addEventListener('keydown', onKeyDown)
  onCleanup(() => window.removeEventListener('keydown', onKeyDown))

  const latest = (): VoiceprintRecord | null => prints()?.[0] ?? null

  // The flip side is the real stats card — the same art the Share
  // button exports — rendered on first flip and cached per record.
  // While it renders, the plain-text back stands in.
  const [statsCard] = createResource(
    () => (flipped() ? (latest() ?? undefined) : undefined),
    async (record) => {
      const canvas = await renderVoiceprintCard(record, 'stats')
      return canvas?.toDataURL('image/png') ?? null
    },
  )
  const first = (): VoiceprintRecord | null => {
    const all = prints()
    return all !== undefined && all.length > 1 ? all[all.length - 1] : null
  }

  // Growth is measured against the FIRST take, not the previous one:
  // "since you started" is the story, and take-to-take noise would
  // otherwise swamp it.
  const growth = () => {
    const from = first()
    const to = latest()
    if (from === null || to === null) return null
    return computeDelta(from.summary, to.summary)
  }

  return (
    <div class={styles.section}>
      <h3 class={styles.heading}>Your voice</h3>

      <Show
        when={latest() !== null}
        fallback={
          <p class={styles.empty}>
            No voiceprint yet. Take the guided voice map from the home screen
            and your range, steadiness and twin will show up here.
          </p>
        }
      >
        <div class={styles.latest}>
          <Show when={latest()?.twin != null && latest()?.twin !== ''}>
            <Show
              when={portraitSrc() !== undefined}
              fallback={
                <span class={styles.twin} aria-hidden="true">
                  <LegendCaricature legend={latest()?.twin ?? ''} />
                </span>
              }
            >
              {/* A plain <img>, not the SVG the reveal uses. These portraits
                  are 928×1152; an SVG <image> scaled into a thumbnail box
                  gets a cheap resample and the face turns to mush. <img>
                  takes the browser's high-quality downscale path, and the
                  intrinsic width/height let it pick the right mip. */}
              <button
                type="button"
                class={styles.twinBtn}
                onClick={() => setZoomed(true)}
                title={`See ${latest()?.twin ?? ''} full size`}
                aria-label={`See ${latest()?.twin ?? ''} full size`}
              >
                <img
                  class={styles.twinImg}
                  src={portraitSrc()}
                  width="928"
                  height="1152"
                  alt=""
                  decoding="async"
                />
              </button>
            </Show>
          </Show>
          <div class={styles.latestBody}>
            <Show when={latest()?.twin != null && latest()?.twin !== ''}>
              <p class={styles.twinName}>
                {latest()?.twin}
                <button
                  type="button"
                  class={styles.shareBtn}
                  disabled={sharing()}
                  onClick={() => void shareLatest('stats')}
                  title="Share this voiceprint card (twin + your numbers)"
                >
                  Share
                </button>
              </p>
            </Show>
            <div class={styles.stats}>
              <Show when={latest()?.summary.lowMidi != null}>
                <span>
                  <b>
                    {midiToNoteNameOctave(latest()?.summary.lowMidi ?? 0)}–
                    {midiToNoteNameOctave(latest()?.summary.highMidi ?? 0)}
                  </b>{' '}
                  range
                </span>
              </Show>
              <Show when={latest()?.summary.steadiness != null}>
                <span>
                  <b>{latest()?.summary.steadiness}</b> steadiness
                </span>
              </Show>
              <Show when={latest()?.summary.accuracy != null}>
                <span>
                  <b>{Math.round(latest()?.summary.accuracy ?? 0)}</b> accuracy
                </span>
              </Show>
            </div>

            <Show when={growth() !== null && first() !== null}>
              <p class={styles.growth}>
                Since {formatDate(first()?.takenAt ?? '')}:{' '}
                <For
                  each={[
                    formatDelta(growth()?.semitones ?? null, 'semitones'),
                    formatDelta(growth()?.steadiness ?? null, 'steadiness'),
                    formatDelta(growth()?.accuracy ?? null, 'accuracy'),
                  ].filter((line): line is string => line !== null)}
                  fallback={
                    <span class={styles.growthFlat}>holding steady</span>
                  }
                >
                  {(line, i) => (
                    <>
                      {i() > 0 ? ', ' : ''}
                      <b>{line}</b>
                    </>
                  )}
                </For>
              </p>
            </Show>
          </div>
        </div>

        <Show when={(prints()?.length ?? 0) > 1}>
          <ol class={styles.history}>
            <For each={prints()?.slice(0, 8)}>
              {(print) => (
                <li class={styles.historyRow}>
                  <Show when={historyThumbSrc(print) !== undefined}>
                    <img
                      class={styles.historyThumb}
                      src={historyThumbSrc(print)}
                      width="928"
                      height="1152"
                      alt=""
                      loading="lazy"
                      decoding="async"
                    />
                  </Show>
                  <span class={styles.historyBody}>
                    <span class={styles.historyDate}>
                      {formatDate(print.takenAt)}
                    </span>
                    <span class={styles.historyMeta}>
                      <Show when={print.summary.semitones != null}>
                        {print.summary.semitones} semitones
                      </Show>
                    </span>
                  </span>
                </li>
              )}
            </For>
          </ol>
        </Show>

        <p class={styles.note}>
          <Show
            when={props.signedIn}
            fallback={
              <>
                These are saved on this device. Create an account above to make
                as many as you like, keep them all, and have them follow you to
                any device you sing on.
              </>
            }
          >
            Kept on your account — every one, on every device you sing on.
          </Show>
        </p>
      </Show>

      {/* Full-size portrait. The thumbnail is deliberately small — this is
          a settings panel, not a gallery — so there has to be a way to
          actually look at the thing you were given. */}
      <Show when={zoomed() && portraitSrc() !== undefined}>
        <div
          class={styles.zoomOverlay}
          role="dialog"
          aria-modal="true"
          aria-label={`${latest()?.twin ?? ''} portrait`}
          onClick={() => {
            setZoomed(false)
            setFlipped(false)
          }}
        >
          {/* Click the card to flip portrait <-> numbers; the backdrop
              closes. stopPropagation keeps the flip from also closing. */}
          <figure
            class={styles.zoomFigure}
            onClick={(event) => {
              event.stopPropagation()
              setFlipped((f) => !f)
            }}
          >
            <Show
              when={!flipped()}
              fallback={
                <Show
                  when={statsCard() != null}
                  fallback={
                    <div class={styles.zoomBack}>
                      <p class={styles.zoomBackTwin}>{latest()?.twin}</p>
                      <p class={styles.zoomBackRange}>
                        {midiToNoteNameOctave(latest()?.summary.lowMidi ?? 0)}–
                        {midiToNoteNameOctave(latest()?.summary.highMidi ?? 0)}
                      </p>
                      <p class={styles.zoomBackMeta}>
                        {latest()?.summary.semitones ?? 0} semitones ·{' '}
                        {latest()?.summary.steadiness ?? 0} steadiness ·{' '}
                        {Math.round(latest()?.summary.accuracy ?? 0)} accuracy
                      </p>
                      <p class={styles.zoomBackDate}>
                        {new Date(latest()?.takenAt ?? '').toLocaleDateString()}
                      </p>
                    </div>
                  }
                >
                  {/* The data side is the actual stats card — twin plus
                      the record's numbers — so flipping previews exactly
                      what Share exports. */}
                  <img
                    class={styles.zoomImg}
                    src={statsCard() ?? ''}
                    alt={`${latest()?.twin ?? ''} — your voiceprint card`}
                  />
                </Show>
              }
            >
              <img
                class={styles.zoomImg}
                src={portraitSrc()}
                width="928"
                height="1152"
                alt={`${latest()?.twin ?? ''} — your voice twin`}
              />
            </Show>
            <figcaption class={styles.zoomCaption}>
              {latest()?.twin}
              <span class={styles.zoomHint}> — click card to flip</span>
              {/* Shares the side being looked at: portrait card on the
                  front, the data card on the back. */}
              <button
                type="button"
                class={styles.shareBtn}
                disabled={sharing()}
                title={
                  flipped()
                    ? 'Share this card (twin + your numbers)'
                    : 'Share your twin portrait card'
                }
                onClick={(event) => {
                  event.stopPropagation()
                  void shareLatest(flipped() ? 'stats' : 'face')
                }}
              >
                Share
              </button>
            </figcaption>
          </figure>
        </div>
      </Show>
    </div>
  )
}

export default VoiceSection
