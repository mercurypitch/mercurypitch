// ============================================================
// LegendsShowcase — the Leaderboard's Legends view
// ============================================================
// The live Legend with its board, then every closed one with its frozen
// podium and the medal each place earned. Two components that already
// existed, put on the page where competition lives.
//
// The hero is the same card as Home, without its "See past challenges" link
// — the past challenges are the next thing down. Home's copy of the card
// keeps the link and points it here.

import type { Component } from 'solid-js'
import styles from './LegendsShowcase.module.css'
import { PastWeeklyChallenges } from './PastWeeklyChallenges'
import { WeeklyLegendHero } from './WeeklyLegendHero'

export const LegendsShowcase: Component = () => (
  <section
    class={styles.showcase}
    aria-labelledby="legends-title"
    data-testid="legends-showcase"
  >
    <div class={styles.intro}>
      <h3 id="legends-title" class={styles.title}>
        Legends
      </h3>
      <p class={styles.lede}>
        One shared melody at a time, sung at written pitch by everyone who takes
        it on. The board freezes when a Legend closes, and the first three
        places keep their medals.
      </p>
    </div>

    <div class={styles.live}>
      <WeeklyLegendHero showPastLink={false} />
    </div>

    <PastWeeklyChallenges />
  </section>
)
