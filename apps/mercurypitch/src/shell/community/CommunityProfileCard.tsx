// ============================================================
// CommunityProfileCard — your own figures, at the top of Community
// ============================================================
//
// ProfileView's figures (src/features/community/ProfileView.tsx), redrawn
// for the phone: the name, how long the singer has been here, how many runs,
// the best, the recent average and the streak, and what they have shared.
// Only the singer's own: there is no public profile of another singer
// anywhere, and this adds none. With no runs it says so plainly, rather
// than showing a confident zero.
//
// Signed out it asks for a sign-in, as the Leagues screen's card does, and
// the lists under it still show: anyone may read what singers shared.

import type { JSX } from 'solid-js'
import { createMemo, For, Show } from 'solid-js'
import { PeopleIcon } from '../icons'
import { accountDisplayName, accountSignedIn } from '../settings/account-state'
import { openSignIn } from '../settings/sign-in-state'
import { memberSince, PROFILE_EMPTY, PROFILE_SIGNED_OUT, profileFigures, publishedLine, } from './community-lines'
import type { CommunityProfile } from './community-store'
import { communityProfile } from './community-store'

function SignedOut(): JSX.Element {
  return (
    <section
      class="mp-community-invite"
      aria-labelledby="community-invite-title"
      data-testid="community-signed-out"
    >
      <span class="mp-community-invite__icon" aria-hidden="true">
        <PeopleIcon size={24} />
      </span>
      <h2
        id="community-invite-title"
        class="mp-community-invite__title"
        data-community-focus=""
        tabindex="-1"
      >
        {PROFILE_SIGNED_OUT.title}
      </h2>
      <p class="mp-community-invite__body">{PROFILE_SIGNED_OUT.body}</p>
      <button
        type="button"
        class="mp-set-button"
        data-testid="community-sign-in"
        onClick={() => openSignIn()}
      >
        Sign in
      </button>
    </section>
  )
}

function Figures(props: { profile: CommunityProfile }): JSX.Element {
  const figures = createMemo(() =>
    profileFigures(
      props.profile.runs,
      props.profile.totalRuns,
      props.profile.streak,
    ),
  )
  return (
    <>
      <Show
        when={figures().length > 0}
        fallback={<p class="mp-set__caption">{PROFILE_EMPTY}</p>}
      >
        <ul class="mp-community-figures" aria-label="Your figures">
          <For each={figures()}>
            {(figure) => (
              <li class="mp-community-figure" data-figure={figure.id}>
                <span class="mp-community-figure__value">{figure.value}</span>
                <span class="mp-community-figure__label">{figure.label}</span>
              </li>
            )}
          </For>
        </ul>
      </Show>
      <Show when={publishedLine(props.profile.published)}>
        {(line) => <p class="mp-community-profile__published">{line()}</p>}
      </Show>
    </>
  )
}

/**
 * The signed-in singer's card, once their figures are read: before that a
 * card would name nobody yet, and a failed read already says so above it.
 */
function SignedIn(props: { profile: CommunityProfile }): JSX.Element {
  const name = (): string => {
    const own = props.profile.name
    return own !== '' ? own : accountDisplayName()
  }
  return (
    <section
      class="mp-community-profile"
      aria-labelledby="community-profile-name"
      data-testid="community-profile"
    >
      <div class="mp-community-profile__head">
        <span class="mp-community-profile__mark" aria-hidden="true">
          {name().trim().charAt(0).toUpperCase()}
        </span>
        <div class="mp-community-profile__who">
          <p class="mp-community-profile__eyebrow">Your profile</p>
          <h2
            id="community-profile-name"
            class="mp-community-profile__name"
            data-community-focus=""
            tabindex="-1"
          >
            {name()}
          </h2>
          <Show when={memberSince(props.profile.joinedAt)}>
            {(since) => <p class="mp-community-profile__since">{since()}</p>}
          </Show>
        </div>
      </div>
      <Figures profile={props.profile} />
    </section>
  )
}

export function CommunityProfileCard(): JSX.Element {
  return (
    <Show when={accountSignedIn()} fallback={<SignedOut />}>
      <Show when={communityProfile()}>
        {(profile) => <SignedIn profile={profile()} />}
      </Show>
    </Show>
  )
}
