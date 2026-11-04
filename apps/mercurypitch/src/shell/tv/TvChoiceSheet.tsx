// ============================================================
// The TV chooser, drawn: a small sheet as a TV connects
// ============================================================
//
// The voiceprint ask's shape: Not now at the top right, the question, then
// the two answers, the stage first and recommended (the owner's pick, 3 Nov
// 2026), the box that keeps the answer for this TV, ticked, and the quiet
// third answer, the plain mirror. A tap on an answer is the answer: there
// is no second step. Not now, Back, the backdrop and a swipe are the mirror
// for this connection, kept for nothing (tv-choice.ts); the mirror's own
// button is kept for the TV while the box is ticked.
//
// While the sheet is up the TV mirrors the phone, so it shows the question
// too. When and whether it opens is tv-choice.ts; every word is tv-copy.ts.

import type { JSX } from 'solid-js'
import { createEffect, createSignal, on, Show } from 'solid-js'
import '../settings/settings.css'
import './tv.css'
import { Sheet } from '@/components/mobile/Sheet'
import { TvLyricsIcon, TvStageIcon } from '../icons'
import { chooseTv, notNowTv, tvChoiceAsking, tvChoiceUp } from './tv-choice'
import { TV_SHEET, tvChoiceWords, tvConnectedLine, tvKeepMirroringLabel, tvRememberLabel, } from './tv-copy'
import type { TvChoice } from './tv-memory'

interface TvOptionProps {
  choice: TvChoice
  icon: JSX.Element
  recommended?: boolean
  onPick: (choice: TvChoice) => void
}

/** One answer: a row with its picture, its name and what it shows. */
function TvOption(props: TvOptionProps): JSX.Element {
  const words = (): { name: string; line: string } =>
    tvChoiceWords(props.choice)
  return (
    <button
      type="button"
      class="mp-tv-option"
      data-tv-choice={props.choice}
      onClick={() => {
        props.onPick(props.choice)
      }}
    >
      <span class="mp-tv-option__icon" aria-hidden="true">
        {props.icon}
      </span>
      <span class="mp-tv-option__text">
        <span class="mp-tv-option__head">
          <span class="mp-tv-option__name">{words().name}</span>
          <Show when={props.recommended === true}>
            <span class="mp-tv-option__chip">{TV_SHEET.recommended}</span>
          </Show>
        </span>
        <span class="mp-tv-option__line">{words().line}</span>
      </span>
    </button>
  )
}

/** The question, over whatever the singer was doing as the TV connected. */
export function TvChoiceSheet(): JSX.Element {
  const [remember, setRemember] = createSignal(true)
  // Every question starts ticked: a TV asked about once is the usual wish.
  createEffect(
    on(tvChoiceAsking, (ask) => {
      if (ask !== null) setRemember(true)
    }),
  )
  const name = (): string | null => tvChoiceAsking()?.name ?? null
  const answer = (choice: TvChoice): void => {
    chooseTv(choice, remember())
  }

  return (
    <Sheet
      isOpen={tvChoiceUp()}
      close={notNowTv}
      ariaLabel={TV_SHEET.title}
      class="mp-offer-sheet mp-tv-sheet"
    >
      <div class="mp-offer mp-offer--sheet mp-tv" data-testid="tv-choice">
        <div class="mp-keep__top">
          <button
            type="button"
            class="mp-keep__not-now"
            data-testid="tv-choice-not-now"
            onClick={notNowTv}
          >
            {TV_SHEET.notNow}
          </button>
        </div>
        <h2 class="mp-offer__title">{TV_SHEET.title}</h2>
        <p class="mp-keep__fact">{tvConnectedLine(name())}</p>
        <div class="mp-tv-options" role="group" aria-label="What the TV shows">
          <TvOption
            choice="stage"
            icon={<TvStageIcon />}
            recommended
            onPick={answer}
          />
          <TvOption choice="lyrics" icon={<TvLyricsIcon />} onPick={answer} />
        </div>
        <label class="mp-tv-remember">
          <input
            type="checkbox"
            data-testid="tv-choice-remember"
            checked={remember()}
            onChange={(event) => {
              setRemember(event.currentTarget.checked)
            }}
          />
          <span>{tvRememberLabel(name())}</span>
        </label>
        <button
          type="button"
          class="mp-tv-mirror"
          data-tv-choice="mirror"
          onClick={() => {
            answer('mirror')
          }}
        >
          {tvKeepMirroringLabel()}
        </button>
      </div>
    </Sheet>
  )
}
