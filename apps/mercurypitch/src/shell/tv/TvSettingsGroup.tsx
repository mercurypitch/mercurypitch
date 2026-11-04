// ============================================================
// Settings, Karaoke, TV: the TVs this phone remembers
// ============================================================
//
// What the TV chooser kept (tv-memory.ts), one card per TV: its name, a
// Forget, and the three things it can show, the one in force checked. A
// change shows at once on that TV if it is the one connected
// (`changeTvChoice`); Forget makes the next connection ask again. Before any
// TV is remembered, one line says what happens when one connects.
//
// Only on a phone with the TV plugin (`tvChoiceAvailable`): on Android and
// the web there is no group at all, as there is no sheet.
//
// The cards are keyed by the TV's name, not by the kept entry: a change of
// choice makes a new entry, and a card made again would drop the focus from
// the answer just pressed (CONVENTIONS.md, "<For> recreates rows").

import type { JSX } from 'solid-js'
import { createMemo, For, Show } from 'solid-js'
import './tv.css'
import { TvIcon } from '../icons'
import { SettingsChoice, SettingsGroup, SettingsRow, } from '../settings/SettingsList'
import { changeTvChoice, tvChoiceAvailable } from './tv-choice'
import { tvChoiceWords, tvNoneYetLine, tvSettingsName } from './tv-copy'
import { forgetTv, rememberedChoice, rememberedTvs, TV_CHOICES, } from './tv-memory'

interface RememberedTvCardProps {
  /** The TV's name, or null for the TV whose name never came. */
  name: string | null
}

function RememberedTvCard(props: RememberedTvCardProps): JSX.Element {
  const label = (): string => tvSettingsName(props.name)
  return (
    <div class="mp-set-list" data-tv={props.name ?? ''}>
      <SettingsRow
        id="tv-name"
        icon={<TvIcon />}
        label={label()}
        accessory={
          <button
            type="button"
            class="mp-set-button mp-set-button--secondary mp-set-button--small"
            data-testid="tv-forget"
            aria-label={`Forget ${label()}`}
            onClick={() => {
              forgetTv(props.name)
            }}
          >
            Forget
          </button>
        }
      />
      <div role="radiogroup" aria-label={`What ${label()} shows`}>
        <For each={TV_CHOICES}>
          {(choice) => (
            <SettingsChoice
              id={choice}
              label={tvChoiceWords(choice).name}
              sub={tvChoiceWords(choice).line}
              checked={rememberedChoice(props.name) === choice}
              onChoose={() => {
                changeTvChoice(props.name, choice)
              }}
            />
          )}
        </For>
      </div>
    </div>
  )
}

/** The TV group, on a phone that can put the room on a TV. */
export function TvSettingsGroup(): JSX.Element {
  const names = createMemo(() => rememberedTvs().map((tv) => tv.name))
  return (
    <Show when={tvChoiceAvailable()}>
      <Show
        when={names().length > 0}
        fallback={
          <SettingsGroup title="TV">
            <SettingsRow
              id="tv-none"
              icon={<TvIcon />}
              label={tvNoneYetLine()}
            />
          </SettingsGroup>
        }
      >
        <section class="mp-set-group" aria-label="TV">
          <h2 class="mp-set-group__title">TV</h2>
          <div class="mp-tv-set">
            <For each={names()}>
              {(name) => <RememberedTvCard name={name} />}
            </For>
          </div>
        </section>
      </Show>
    </Show>
  )
}
