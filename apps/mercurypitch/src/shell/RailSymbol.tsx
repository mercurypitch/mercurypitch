// ============================================================
// RailSymbol — one rail item's glyph, outline or filled
// ============================================================
//
// The selected state is never colour alone: the symbol fills in as well, so
// the mark survives a colour-blind reading and a monochrome screenshot.

import type { Component } from 'solid-js'
import { Match, Switch } from 'solid-js'
import { EarFillIcon, EarIcon, GuitarIcon, MicFillIcon, MicIcon, MoreIcon, PianoIcon, ProgressFillIcon, ProgressIcon, RoomsFillIcon, RoomsIcon, } from './icons'
import type { RailItemId } from './shell-navigation'

export interface RailSymbolProps {
  id: RailItemId
  selected?: boolean
  /** The scope's instrument, so slot two draws what the room actually is. */
  stage?: 'sing' | 'guitar' | 'piano'
  size?: number
}

export const RailSymbol: Component<RailSymbolProps> = (props) => (
  <Switch fallback={<MoreIcon size={props.size} />}>
    <Match when={props.id === 'rooms'}>
      {props.selected === true ? (
        <RoomsFillIcon size={props.size} />
      ) : (
        <RoomsIcon size={props.size} />
      )}
    </Match>
    <Match when={props.id === 'stage'}>
      <Switch
        fallback={
          props.selected === true ? (
            <MicFillIcon size={props.size} />
          ) : (
            <MicIcon size={props.size} />
          )
        }
      >
        <Match when={props.stage === 'guitar'}>
          <GuitarIcon size={props.size} />
        </Match>
        <Match when={props.stage === 'piano'}>
          <PianoIcon size={props.size} />
        </Match>
      </Switch>
    </Match>
    <Match when={props.id === 'ear'}>
      {props.selected === true ? (
        <EarFillIcon size={props.size} />
      ) : (
        <EarIcon size={props.size} />
      )}
    </Match>
    <Match when={props.id === 'progress'}>
      {props.selected === true ? (
        <ProgressFillIcon size={props.size} />
      ) : (
        <ProgressIcon size={props.size} />
      )}
    </Match>
  </Switch>
)
