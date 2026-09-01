// ============================================================
// DeskView — the mixing desk: one source, three drills.
//
// The desk renders its source once — the user's own song when the
// karaoke library has a finished separation, the house loop
// otherwise — then offers Colour, Weight and Critique as play pads.
// Each drill mounts in its place with a back link to the desk. The
// desk's readings live on this page and the strip's tile; the
// Column never moves for them.
// ============================================================

import type { JSX } from 'solid-js'
import { createEffect, createSignal, Show } from 'solid-js'
import { useEngines } from '@/contexts/EngineContext'
import { DESK_BANDS } from '@/lib/ear/desk'
import { DESK_TIMING } from '@/lib/ear/timing'
import { earPlayerRating, latestThresholdReading } from '@/stores/ear-lab-store'
import type { UvrSession } from '@/stores/uvr-store'
import { ColourDrill } from './ColourDrill'
import { CritiqueDrill } from './CritiqueDrill'
import { renderHouseLoop, renderSongMix, songExcerptStart } from './desk-render'
import type { DeskSource } from './desk-store'
import { deskSourceState, ensureDeskSource, reportDeskProgress, } from './desk-store'
import { IconDesk, IconGears, IconLoupe } from './ear-icons'
import { ConsoleNote, ConsoleStack, ConsoleWarning, EarStage, PlayPad, } from './EarStage'
import { MixingDesk } from './MixingDesk'
import { WeightDrill } from './WeightDrill'
import { defaultDeps, loadWildStems, STEM_PHASE_PCT } from './wild-analysis'
import { fieldBookSessions, songName, wildReadingState } from './wild-store'

interface DeskViewProps {
  onBack: () => void
}

type DeskKind = 'colour' | 'weight' | 'critique'

/** The user's newest finished separation as the desk's source, or null. */
export async function songSource(
  ctx: BaseAudioContext,
  session: UvrSession | undefined,
  onProgress?: (pct: number | null, note: string) => void,
): Promise<DeskSource | null> {
  if (!session) return null
  const read = wildReadingState(session.sessionId).reading
  // Opening the stems is nearly all of the desk's wait; the mix render that
  // follows is one offline pass over a short excerpt. So the stems phase —
  // reported by loadWildStems on its own 0..STEM_PHASE_PCT scale — takes the
  // first nine tenths of the bar.
  const stems = read
    ? read.stems
    : await loadWildStems(session, defaultDeps(ctx), (pct, detail) =>
        onProgress?.(
          Math.round((pct / STEM_PHASE_PCT) * 90),
          detail !== undefined ? `opening the ${detail}` : 'opening the stems',
        ),
      )
  if (!stems) return null
  onProgress?.(90, 'rendering the mix')
  const start = songExcerptStart(
    stems.instrumental.duration,
    DESK_TIMING.songExcerptS,
  )
  const lengthS = Math.min(
    DESK_TIMING.songExcerptS,
    stems.instrumental.duration,
  )
  const buffer = await renderSongMix(
    stems.vocal,
    stems.instrumental,
    start,
    lengthS,
  )
  return { buffer, label: songName(session) }
}

export function DeskView(props: DeskViewProps): JSX.Element {
  const { audioEngine } = useEngines()
  const [drill, setDrill] = createSignal<DeskKind | null>(null)
  const state = () => deskSourceState()

  createEffect(() => {
    if (state().status !== 'idle') return
    void (async () => {
      await audioEngine.init()
      const ctx = audioEngine.getAudioContext()
      if (!ctx) return
      await ensureDeskSource({
        song: () => songSource(ctx, fieldBookSessions()[0], reportDeskProgress),
        house: async () => ({
          buffer: await renderHouseLoop(ctx.sampleRate),
          label: 'the house loop',
        }),
      }).catch(() => undefined)
    })()
  })

  const status = () => {
    const current = state()
    switch (current.status) {
      case 'idle':
        return 'Rendering the desk’s source…'
      case 'rendering':
        return current.pct === null
          ? 'Rendering the desk’s source…'
          : `Rendering the desk’s source — ${current.note} · ${current.pct}%`
      case 'error':
        return current.error
      case 'ready':
        return `On ${current.source?.label ?? 'the source'} — three drills, each on its own plate.`
    }
  }

  const dbWord = (id: string) => {
    const reading = latestThresholdReading(id)
    return reading ? `${reading.value.toFixed(1)} dB` : 'unmeasured'
  }
  const ratingWord = () => {
    const rating = earPlayerRating('desk-critique')
    return rating.attempts > 0
      ? `rating ${Math.round(rating.rating)}`
      : 'unrated'
  }
  const open = (kind: DeskKind) => {
    if (state().status === 'ready') setDrill(kind)
  }

  return (
    <Show
      when={drill() === null || !state().source}
      fallback={
        <Show when={state().source}>
          {(source) => (
            <Show
              when={drill() === 'colour'}
              fallback={
                <Show
                  when={drill() === 'weight'}
                  fallback={
                    <CritiqueDrill
                      source={source()}
                      onBack={() => setDrill(null)}
                    />
                  }
                >
                  <WeightDrill
                    source={source()}
                    onBack={() => setDrill(null)}
                  />
                </Show>
              }
            >
              <ColourDrill source={source()} onBack={() => setDrill(null)} />
            </Show>
          )}
        </Show>
      }
    >
      <EarStage
        drillId="desk"
        name="The desk"
        mode="the mixing desk"
        progress={state().source?.label ?? 'rendering'}
        status={status()}
        instrument={() => (
          <MixingDesk
            labels={DESK_BANDS.map((entry) => entry.label)}
            playing={false}
            highlight={0}
            reveal={null}
          />
        )}
        console={() => (
          <ConsoleStack>
            <PlayPad
              label="Colour"
              sub={`which band was boosted · ${dbWord('desk-colour')}`}
              keycap="1"
              icon={<IconLoupe size={20} />}
              disabled={state().status !== 'ready'}
              onClick={() => open('colour')}
            />
            <PlayPad
              label="Weight"
              sub={`which render is heavier · ${dbWord('desk-weight')}`}
              keycap="2"
              icon={<IconGears size={20} />}
              disabled={state().status !== 'ready'}
              onClick={() => open('weight')}
            />
            <PlayPad
              label="Critique"
              sub={`name the fault · ${ratingWord()}`}
              keycap="3"
              icon={<IconDesk size={20} />}
              disabled={state().status !== 'ready'}
              onClick={() => open('critique')}
            />
            <Show when={state().status === 'error'}>
              <ConsoleWarning>{state().error}</ConsoleWarning>
            </Show>
            <ConsoleNote>
              Every trial is a slice of the source rendered through the fault
              under test, in the browser, with nothing bundled. The desk reads
              on its own plate.
            </ConsoleNote>
          </ConsoleStack>
        )}
        onBack={props.onBack}
        keys={() => [
          { key: '1', action: () => open('colour') },
          { key: '2', action: () => open('weight') },
          { key: '3', action: () => open('critique') },
        ]}
      />
    </Show>
  )
}
