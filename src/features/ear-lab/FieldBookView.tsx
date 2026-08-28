// ============================================================
// FieldBookView — one song's page in the Field Book.
//
// Opening a page reads the song once (wild-analysis, through the
// store so the card sees the same state), then offers its three
// drills: Home, Echo and Bassline in the Wild. The page is a stage
// like any instrument's — the reading's progress on the instrument,
// the three drills as play pads on the console — and each drill
// mounts in its place with a back link to the page.
// ============================================================

import type { JSX } from 'solid-js'
import { createEffect, createMemo, createSignal, For, Show } from 'solid-js'
import { useEngines } from '@/contexts/EngineContext'
import type { WildKind, WildTrack } from '@/lib/ear/wild'
import { keyLabel } from '@/lib/ear/wild'
import { earPlayerRating } from '@/stores/ear-lab-store'
import { getUvrSession } from '@/stores/uvr-store'
import { IconBassLine, IconChain, IconFork } from './ear-icons'
import { ConsoleNote, ConsoleStack, ConsoleWarning, EarStage, PlayPad, } from './EarStage'
import { FieldBookPage } from './FieldBookPage'
import type { WildProgress } from './wild-analysis'
import { defaultDeps } from './wild-analysis'
import { ensureWildReading, fieldBookSessionId, songName, UNREAD_STATE, wildReadingState, } from './wild-store'
import { WildBasslineDrill } from './WildBasslineDrill'
import { WildEchoDrill } from './WildEchoDrill'
import { WildHomeDrill } from './WildHomeDrill'

interface FieldBookViewProps {
  onBack: () => void
}

const DRILLS: {
  kind: WildKind
  track: WildTrack
  label: string
  keycap: string
  icon: (p: { size?: number }) => JSX.Element
  count: (counts: { home: number; echo: number; bassline: number }) => number
  unit: string
}[] = [
  {
    kind: 'home',
    track: 'wild-home',
    label: 'Home in the Wild',
    keycap: '1',
    icon: IconFork,
    count: (counts) => counts.home,
    unit: 'landings',
  },
  {
    kind: 'echo',
    track: 'wild-echo',
    label: 'Echo in the Wild',
    keycap: '2',
    icon: IconChain,
    count: (counts) => counts.echo,
    unit: 'phrases',
  },
  {
    kind: 'bassline',
    track: 'wild-bassline',
    label: 'Bassline in the Wild',
    keycap: '3',
    icon: IconBassLine,
    count: (counts) => counts.bassline,
    unit: 'root motions',
  },
]

function phaseWord(progress: WildProgress | null): string {
  switch (progress?.phase) {
    case 'notes':
      return 'listening to the vocal'
    case 'chords':
      return 'reading the chords'
    default:
      return 'opening the stems'
  }
}

export function FieldBookView(props: FieldBookViewProps): JSX.Element {
  const { audioEngine } = useEngines()
  const [drill, setDrill] = createSignal<WildKind | null>(null)
  const session = createMemo(() => {
    const id = fieldBookSessionId()
    return id === null ? undefined : getUvrSession(id)
  })
  const state = createMemo(() => {
    const id = fieldBookSessionId()
    return id === null ? UNREAD_STATE : wildReadingState(id)
  })
  const title = () => {
    const current = session()
    return current ? songName(current) : 'The Field Book'
  }
  const keyWord = () => {
    const key = state().reading?.book.key
    return key ? keyLabel(key) : null
  }
  const counts = () => {
    const book = state().reading?.book
    return book
      ? {
          home: book.home.length,
          echo: book.echo.length,
          bassline: book.bassline.length,
        }
      : null
  }

  // Read the song when the page opens; the store shares one reading.
  createEffect(() => {
    const current = session()
    if (!current || state().status !== 'unread') return
    void (async () => {
      await audioEngine.init()
      const ctx = audioEngine.getAudioContext()
      if (!ctx) return
      await ensureWildReading(current, defaultDeps(ctx)).catch(() => undefined)
    })()
  })

  const status = () => {
    if (!session()) {
      return 'No song is open — choose one from the Field Book on the bench.'
    }
    const current = state()
    switch (current.status) {
      case 'unread':
        return 'Opening the song…'
      case 'reading':
        return `Reading the song — ${phaseWord(current.progress)}…`
      case 'error':
        return current.error
      case 'ready': {
        const book = current.reading?.book
        const tally = counts()
        return book && tally
          ? `${keyLabel(book.key)} — ${tally.home} landings, ${tally.echo} phrases, ${tally.bassline} root motions.`
          : 'Read.'
      }
    }
  }

  const ratingWord = (track: WildTrack) => {
    const rating = earPlayerRating(track)
    return rating.attempts > 0
      ? `rating ${Math.round(rating.rating)}`
      : 'unrated'
  }

  const open = (kind: WildKind) => {
    const tally = counts()
    if (
      !tally ||
      DRILLS.find((entry) => entry.kind === kind)?.count(tally) === 0
    ) {
      return
    }
    setDrill(kind)
  }

  return (
    <Show
      when={drill() === null || !state().reading}
      fallback={
        <Show when={state().reading}>
          {(reading) => (
            <Show
              when={drill() === 'home'}
              fallback={
                <Show
                  when={drill() === 'echo'}
                  fallback={
                    <WildBasslineDrill
                      reading={reading()}
                      onBack={() => setDrill(null)}
                    />
                  }
                >
                  <WildEchoDrill
                    reading={reading()}
                    onBack={() => setDrill(null)}
                  />
                </Show>
              }
            >
              <WildHomeDrill
                reading={reading()}
                onBack={() => setDrill(null)}
              />
            </Show>
          )}
        </Show>
      }
    >
      <EarStage
        drillId="field-book"
        name={title()}
        mode="the Field Book"
        progress={keyWord() ?? 'reading'}
        status={status()}
        instrument={() => (
          <FieldBookPage
            pct={
              state().status === 'reading' ? (state().progress?.pct ?? 0) : null
            }
            keyName={keyWord()}
            counts={counts()}
          />
        )}
        console={() => (
          <ConsoleStack>
            <For each={DRILLS}>
              {(entry) => {
                const Icon = entry.icon
                // Read inside the attributes: the pads are created while
                // the song is still being read and must wake when it is.
                const count = () => {
                  const tally = counts()
                  return tally ? entry.count(tally) : null
                }
                return (
                  <PlayPad
                    label={entry.label}
                    sub={
                      count() === null
                        ? 'once the song is read'
                        : count() === 0
                          ? `none found · ${ratingWord(entry.track)}`
                          : `${count()} ${entry.unit} · ${ratingWord(entry.track)}`
                    }
                    keycap={entry.keycap}
                    icon={<Icon size={20} />}
                    disabled={(count() ?? 0) === 0}
                    onClick={() => open(entry.kind)}
                  />
                )
              }}
            </For>
            <Show when={state().status === 'error'}>
              <ConsoleWarning>{state().error}</ConsoleWarning>
            </Show>
            <ConsoleNote>
              Three drills on this song: the degree the voice lands on, a phrase
              it sings tapped back, and where the root moves under it. Each
              rates on the Field Book's own track.
            </ConsoleNote>
          </ConsoleStack>
        )}
        onBack={props.onBack}
        keys={() =>
          DRILLS.map((entry) => ({
            key: entry.keycap,
            action: () => open(entry.kind),
          }))
        }
      />
    </Show>
  )
}
