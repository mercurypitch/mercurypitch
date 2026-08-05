// ============================================================
// Voice Constellation Surface — saved matches across the full legend map.
// ============================================================
//
// This is deliberately a reveal map, not a celebrity browser. Every legend's
// name and broad voice band are visible, but an unmatched position renders a
// CSS mystery scene with no image element or portrait URL. Saved voiceprints
// are the only source of current and past reveals.

import type { Component } from 'solid-js'
import { createEffect, createMemo, createResource, createSignal, For, Show, } from 'solid-js'
import { Portal } from 'solid-js/web'
import { Sparkles, Voice, X } from '@/components/icons'
import { authVersion } from '@/db/services/user-service'
import { listVoiceprints } from '@/db/services/voiceprint-service'
import { legendArt, legendTierSrc } from '@/features/mirror/LegendCaricature'
import { WEBSITE_URL } from '@/lib/legal-links'
import type { VoiceTypeBand } from '@/lib/mirror/legend-catalog'
import { VOICE_TYPE_BANDS } from '@/lib/mirror/legend-catalog'
import type { VoiceConstellationLegend } from '@/lib/mirror/voice-constellation'
import { buildVoiceConstellation } from '@/lib/mirror/voice-constellation'
import { midiToNoteNameOctave } from '@/lib/note-utils'
import { useFocusTrap } from '@/lib/use-focus-trap'
import styles from './VoiceConstellationSurface.module.css'

const VOICE_LEGENDS_URL = `${WEBSITE_URL}/voice-legends/`

type HistoryMode = 'ready' | 'loading' | 'error'

export interface VoiceConstellationSurfaceProps {
  onClose: () => void
}

function formatDate(iso: string | undefined): string {
  if (iso === undefined) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function joinLabels(labels: readonly string[]): string {
  return new Intl.ListFormat(undefined, {
    style: 'long',
    type: 'conjunction',
  }).format(labels)
}

const MysteryPortrait: Component = () => (
  <div class={styles.mystery} aria-hidden="true">
    <span class={styles.mysteryOrbit} />
    <span class={styles.mysteryFigure} />
  </div>
)

const LegendCardBody: Component<{
  legend: VoiceConstellationLegend
  mode: HistoryMode
}> = (props) => {
  const portraitSrc = (): string | undefined => {
    if (props.mode !== 'ready' || props.legend.state === 'unmatched') {
      return undefined
    }
    // Resolve a grid-sized asset only after saved history has opened this
    // position. Mystery cards never call the asset resolver at all.
    return legendTierSrc(props.legend.name, 'mid')
  }

  const stateLabel = (): string => {
    if (props.mode === 'loading') return 'Checking history'
    if (props.mode === 'error') return 'History unavailable'
    if (props.legend.state === 'current') return 'Current match'
    if (props.legend.state === 'past') return 'Past match'
    return 'Mystery portrait'
  }

  return (
    <>
      <div class={styles.portraitFrame}>
        <Show when={portraitSrc()} fallback={<MysteryPortrait />}>
          {(src) => (
            <img
              class={styles.portrait}
              src={src()}
              width="928"
              height="1152"
              loading="lazy"
              decoding="async"
              alt={`${props.legend.name}, ${stateLabel().toLowerCase()}`}
            />
          )}
        </Show>
        <span class={styles.statePill}>{stateLabel()}</span>
      </div>
      <div class={styles.legendCopy}>
        <span class={styles.legendBand}>{props.legend.band}</span>
        <h3>{props.legend.name}</h3>
        <Show
          when={props.mode === 'ready' && props.legend.state !== 'unmatched'}
          fallback={
            <p>
              {props.mode === 'ready'
                ? 'Reveal through a saved Voice Mirror match.'
                : props.mode === 'loading'
                  ? 'Your saved matches are being checked.'
                  : 'Saved history is unavailable.'}
            </p>
          }
        >
          <p>Matched {formatDate(props.legend.matchedAt)}</p>
        </Show>
      </div>
    </>
  )
}

const LegendCard: Component<{
  legend: VoiceConstellationLegend
  mode: HistoryMode
  onOpen: (legend: VoiceConstellationLegend) => void
}> = (props) => {
  const isRevealed = (): boolean =>
    props.mode === 'ready' && props.legend.state !== 'unmatched'

  return (
    <li
      class={styles.legendCard}
      classList={{
        [styles.legendCurrent]:
          props.mode === 'ready' && props.legend.state === 'current',
        [styles.legendPast]:
          props.mode === 'ready' && props.legend.state === 'past',
        [styles.legendPending]: props.mode !== 'ready',
        [styles.legendInteractive]: isRevealed(),
      }}
      data-legend-card={props.legend.id}
      data-legend-state={
        props.mode === 'ready' ? props.legend.state : props.mode
      }
    >
      <Show
        when={isRevealed()}
        fallback={<LegendCardBody legend={props.legend} mode={props.mode} />}
      >
        <button
          type="button"
          class={styles.legendCardButton}
          aria-haspopup="dialog"
          aria-label={`Open ${props.legend.name} portrait details`}
          onClick={() => props.onOpen(props.legend)}
        >
          <LegendCardBody legend={props.legend} mode={props.mode} />
        </button>
      </Show>
    </li>
  )
}

const DetailPortrait: Component<{ src: string; name: string }> = (props) => {
  const [loaded, setLoaded] = createSignal(false)

  return (
    <img
      class={styles.detailPortrait}
      classList={{ [styles.detailPortraitLoaded]: loaded() }}
      src={props.src}
      width="928"
      height="1152"
      loading="eager"
      decoding="async"
      alt={`Illustrated caricature of ${props.name} in the MercuryPitch starfield style`}
      onLoad={() => setLoaded(true)}
    />
  )
}

const LegendDetailDialog: Component<{
  legend: VoiceConstellationLegend
  position: number
  total: number
  onClose: () => void
  onPrevious: () => void
  onNext: () => void
}> = (props) => {
  let dialog: HTMLElement | undefined
  let closeButton: HTMLButtonElement | undefined

  const imageSrc = (): string | undefined =>
    legendTierSrc(props.legend.name, 'full')
  const band = () =>
    VOICE_TYPE_BANDS.find((candidate) => candidate.id === props.legend.band)
  const stateLabel = (): string =>
    props.legend.state === 'current' ? 'Current match' : 'Past match'
  const matchStory = (): string =>
    props.legend.state === 'current'
      ? 'This is your latest saved Voice Mirror match.'
      : 'This portrait remains revealed from an earlier saved Voice Mirror match.'

  useFocusTrap(() => dialog, {
    isOpen: () => true,
    onClose: () => props.onClose(),
    initialFocus: () => closeButton,
  })

  return (
    <Portal>
      <section
        ref={dialog}
        class={styles.detailBackdrop}
        role="dialog"
        aria-modal="true"
        aria-labelledby="voice-legend-detail-name"
        aria-describedby="voice-legend-detail-note"
        tabindex="-1"
        onClick={(event) => {
          if (event.target === event.currentTarget) props.onClose()
        }}
        onKeyDown={(event) => {
          if (props.total < 2) return
          if (event.key === 'ArrowLeft') {
            event.preventDefault()
            props.onPrevious()
          } else if (event.key === 'ArrowRight') {
            event.preventDefault()
            props.onNext()
          }
        }}
      >
        <div class={styles.detailPanel}>
          <button
            ref={closeButton}
            type="button"
            class={styles.detailClose}
            onClick={() => props.onClose()}
            aria-label="Close portrait details"
            title="Close portrait details"
          >
            <X />
          </button>

          <div class={styles.detailArt}>
            <Show when={imageSrc()} keyed>
              {(src) => <DetailPortrait src={src} name={props.legend.name} />}
            </Show>
            <span class={styles.detailState}>{stateLabel()}</span>
          </div>

          <div class={styles.detailCopy}>
            <div>
              <span class={styles.detailBand}>{props.legend.band}</span>
              <h2 id="voice-legend-detail-name">{props.legend.name}</h2>
              <p class={styles.detailEpithet}>
                {legendArt(props.legend.name).epithet}
              </p>
            </div>

            <p class={styles.detailMatchStory}>{matchStory()}</p>

            <dl class={styles.detailFacts}>
              <div>
                <dt>Voice neighborhood</dt>
                <dd>{props.legend.band}</dd>
              </div>
              <div>
                <dt>Reference band</dt>
                <dd>{band()?.rangeLabel ?? 'Broad guide'}</dd>
              </div>
              <div>
                <dt>Revealed</dt>
                <dd>{formatDate(props.legend.matchedAt)}</dd>
              </div>
            </dl>

            <p id="voice-legend-detail-note" class={styles.detailNote}>
              MercuryPitch places this legend in a broad{' '}
              {props.legend.band.toLowerCase()} neighborhood. The band is a
              playful point of reference, not a measured range for this artist.
            </p>

            <div class={styles.detailActions}>
              <div
                class={styles.detailNav}
                aria-label="Browse revealed portraits"
              >
                <button
                  type="button"
                  disabled={props.total < 2}
                  onClick={() => props.onPrevious()}
                >
                  Previous
                </button>
                <span>
                  {props.position} of {props.total} revealed
                </span>
                <button
                  type="button"
                  disabled={props.total < 2}
                  onClick={() => props.onNext()}
                >
                  Next
                </button>
              </div>
              <a href="/mirror">Make another voiceprint</a>
            </div>
          </div>
        </div>
      </section>
    </Portal>
  )
}

export const VoiceConstellationSurface: Component<
  VoiceConstellationSurfaceProps
> = (props) => {
  let dialog: HTMLElement | undefined
  let closeButton: HTMLButtonElement | undefined

  const [prints, { refetch }] = createResource(authVersion, listVoiceprints)
  const [selectedLegendId, setSelectedLegendId] = createSignal<string | null>(
    null,
  )

  createEffect(() => {
    if (prints.loading) setSelectedLegendId(null)
  })

  const mode = (): HistoryMode => {
    if (prints.error !== undefined) return 'error'
    // Hide any previous resource value during an identity-key refresh. Solid
    // keeps stale data while refreshing by default; showing it here could
    // briefly expose the last account's revealed portraits after sign-out.
    if (prints.loading) return 'loading'
    return 'ready'
  }

  const records = () => (mode() === 'ready' ? (prints() ?? []) : [])
  const constellation = createMemo(() => buildVoiceConstellation(records()))
  const revealedLegends = createMemo(() =>
    constellation().legends.filter((legend) => legend.state !== 'unmatched'),
  )
  const savedMatchCount = () =>
    revealedLegends().length + constellation().legacyMatches.length
  const selectedLegend = createMemo(() =>
    revealedLegends().find((legend) => legend.id === selectedLegendId()),
  )
  const selectedPosition = (): number => {
    const selected = selectedLegend()
    if (selected === undefined) return 0
    return (
      revealedLegends().findIndex((legend) => legend.id === selected.id) + 1
    )
  }

  const stepSelectedLegend = (offset: -1 | 1): void => {
    const legends = revealedLegends()
    if (legends.length < 2) return
    const selected = selectedLegend()
    if (selected === undefined) return
    const index = legends.findIndex((legend) => legend.id === selected.id)
    const nextIndex = (index + offset + legends.length) % legends.length
    setSelectedLegendId(legends[nextIndex]?.id ?? null)
  }

  const bandGroups = createMemo(() =>
    VOICE_TYPE_BANDS.map((band) => ({
      band,
      legends: constellation().legends.filter(
        (legend) => legend.band === band.id,
      ),
    })),
  )

  const measuredRange = (): string | null => {
    const summary = constellation().currentVoiceprint?.summary
    if (summary?.lowMidi == null || summary.highMidi == null) return null
    return `${midiToNoteNameOctave(summary.lowMidi)}–${midiToNoteNameOctave(
      summary.highMidi,
    )}`
  }

  const overlappingBands = (): readonly VoiceTypeBand[] => {
    const summary = constellation().currentVoiceprint?.summary
    if (summary?.lowMidi == null || summary.highMidi == null) return []
    return VOICE_TYPE_BANDS.filter(
      (band) =>
        band.lowMidi <= (summary.highMidi as number) &&
        band.highMidi >= (summary.lowMidi as number),
    )
  }

  const rangeStory = (): string => {
    const range = measuredRange()
    const bands = overlappingBands()
    if (range === null || bands.length === 0) {
      return 'The bands below are broad discovery guides, not a diagnosis or a ranking.'
    }
    return `Your latest measured range, ${range}, overlaps the broad ${joinLabels(
      bands.map((band) => band.label),
    )} bands. They are discovery guides, not a diagnosis or a ranking.`
  }

  useFocusTrap(() => dialog, {
    isOpen: () => true,
    onClose: () => props.onClose(),
    initialFocus: () => closeButton,
  })

  return (
    <Portal>
      <section
        ref={dialog}
        class={styles.surface}
        role="dialog"
        aria-modal="true"
        aria-labelledby="voice-constellation-title"
        aria-describedby="voice-constellation-intro"
        aria-busy={prints.loading}
        tabindex="-1"
        data-voice-constellation
      >
        <div class={styles.sky} aria-hidden="true" />

        <div class={styles.topbar}>
          <button
            type="button"
            class={styles.brand}
            onClick={() => props.onClose()}
            aria-label="Back to MercuryPitch"
            title="Back to MercuryPitch"
          >
            <span class={styles.brandMark} aria-hidden="true">
              <img src="/favicon.svg" width="38" height="38" alt="" />
            </span>
            <span>
              <b>MercuryPitch</b>
              <small>Voice Mirror</small>
            </span>
          </button>
          <div class={styles.topbarActions}>
            <a
              class={styles.publicLink}
              href={VOICE_LEGENDS_URL}
              target="_blank"
              rel="noreferrer"
            >
              Explore every portrait
            </a>
            <button
              ref={closeButton}
              type="button"
              class={styles.closeButton}
              onClick={() => props.onClose()}
              aria-label="Close voice constellation"
              title="Close voice constellation"
            >
              <X />
            </button>
          </div>
        </div>

        <main class={styles.content}>
          <div class={styles.intro}>
            <div class={styles.introCopy}>
              <p class={styles.eyebrow}>
                <Sparkles /> Your saved voice journey
              </p>
              <h1 id="voice-constellation-title">
                See where your voice has landed
              </h1>
              <p id="voice-constellation-intro" class={styles.lede}>
                Every voiceprint can reveal a personal legend. Your newest saved
                match glows now; earlier matches stay in your path. Everyone
                else remains a mystery here.
              </p>
            </div>

            <aside
              class={styles.readout}
              aria-label="Your constellation status"
            >
              <span class={styles.readoutLabel}>Latest voiceprint</span>
              <Show
                when={mode() === 'ready'}
                fallback={
                  <>
                    <strong>
                      {mode() === 'loading'
                        ? 'Checking saved history…'
                        : 'History unavailable'}
                    </strong>
                    <p>
                      {mode() === 'loading'
                        ? 'Your revealed portraits will appear when this account’s history is ready.'
                        : 'No portrait is revealed while saved history cannot be verified.'}
                    </p>
                  </>
                }
              >
                <strong>
                  {constellation().currentTwin ?? 'No legend match recorded'}
                </strong>
                <p>{rangeStory()}</p>
                <div class={styles.revealCount}>
                  <span>{savedMatchCount()}</span>{' '}
                  <small>
                    {savedMatchCount() === 1 ? 'saved match' : 'saved matches'}
                  </small>
                </div>
              </Show>
            </aside>
          </div>

          <Show when={prints.loading}>
            <p class={styles.status} role="status">
              Restoring your saved matches…
            </p>
          </Show>
          <Show when={prints.error !== undefined}>
            <div class={styles.error} role="alert">
              <div>
                <strong>Your saved matches could not be loaded.</strong>
                <p>
                  The full map is still here, with every portrait kept hidden
                  until your history is available.
                </p>
              </div>
              <button type="button" onClick={() => void refetch()}>
                Try again
              </button>
            </div>
          </Show>

          <Show when={mode() === 'ready' && records().length === 0}>
            <div class={styles.emptyState}>
              <span aria-hidden="true">
                <Voice />
              </span>
              <div>
                <strong>Your constellation is waiting.</strong>
                <p>
                  Make a Voice Mirror print to reveal your first personal twin.
                </p>
              </div>
              <a href="/mirror">Make a voiceprint</a>
            </div>
          </Show>

          <div class={styles.mapHeading}>
            <div>
              <p class={styles.eyebrow}>Low to high</p>
              <h2>Your voice constellation</h2>
            </div>
            <div class={styles.key} aria-label="Map key">
              <span class={styles.keyCurrent}>Current</span>
              <span class={styles.keyPast}>Past</span>
              <span class={styles.keyMystery}>Mystery</span>
            </div>
          </div>

          <div class={styles.bandMap}>
            <For each={bandGroups()}>
              {(group) => (
                <section class={styles.bandSection}>
                  <div class={styles.bandHeader}>
                    <span class={styles.bandIndex} aria-hidden="true" />
                    <div>
                      <h2>{group.band.label}</h2>
                      <p>{group.band.rangeLabel} · broad guide</p>
                    </div>
                  </div>
                  <ul class={styles.legendGrid}>
                    <For each={group.legends}>
                      {(legend) => (
                        <LegendCard
                          legend={legend}
                          mode={mode()}
                          onOpen={(revealed) =>
                            setSelectedLegendId(revealed.id)
                          }
                        />
                      )}
                    </For>
                  </ul>
                </section>
              )}
            </For>
          </div>

          <Show when={constellation().legacyMatches.length > 0}>
            <section class={styles.legacySection}>
              <p class={styles.eyebrow}>Saved beyond this edition</p>
              <h2>Earlier constellation matches</h2>
              <p>
                These names are part of your saved history but are not in the
                current 21-legend map.
              </p>
              <ul>
                <For each={constellation().legacyMatches}>
                  {(match) => (
                    <li>
                      <strong>{match.name}</strong>
                      <span>
                        {match.state === 'current'
                          ? 'Current saved match'
                          : 'Past saved match'}{' '}
                        · {formatDate(match.matchedAt)}
                      </span>
                    </li>
                  )}
                </For>
              </ul>
            </section>
          </Show>

          <div class={styles.publicCta}>
            <div>
              <p class={styles.eyebrow}>The public legend gallery</p>
              <h2>Curious about the faces still in shadow?</h2>
              <p>
                Explore the full portrait collection and learn how Voice Mirror
                turns a measured range into a playful point of reference.
              </p>
            </div>
            <a href={VOICE_LEGENDS_URL} target="_blank" rel="noreferrer">
              Reveal the full gallery
            </a>
          </div>

          <p class={styles.privacyNote}>
            Unmatched portraits are not loaded in this view. Your saved Voice
            Mirror history—not a new guess—decides what is revealed.
          </p>
        </main>

        <Show when={selectedLegend()}>
          {(legend) => (
            <LegendDetailDialog
              legend={legend()}
              position={selectedPosition()}
              total={revealedLegends().length}
              onClose={() => setSelectedLegendId(null)}
              onPrevious={() => stepSelectedLegend(-1)}
              onNext={() => stepSelectedLegend(1)}
            />
          )}
        </Show>
      </section>
    </Portal>
  )
}
