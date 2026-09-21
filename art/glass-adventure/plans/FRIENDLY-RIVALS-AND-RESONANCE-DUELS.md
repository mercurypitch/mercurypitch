# Friendly rivals and resonance duels

Status: brainstorming only, 2026-09-21. The owner requested enemies, projectiles
and singing contests as possible sources of light pressure. No combat, multiplayer,
new judge or asset production is part of the current camera/instruction polish.

## Design direction

Merc meets mischievous museum inhabitants: a glass songbird guarding a window,
a clockwork curator trying to restore an exhibit, or a tiny opaline rival with
its own collection. They provide anticipation and playful competition. They do
not change the main museum into a survival game. Ordinary lessons stay accessible;
optional rival rooms and Cloudway side paths can carry these experiments.

Recommended first prototype: **The Echo Curator**, a short, turn-based singing
duel on a safe platform. A visible rival sings a familiar phrase; the player
answers, their glass lights up, and both characters react. Introduce the rival
without pressure first, then offer an optional race against its visible progress.
Use an existing held-note or low/high judge before inventing a new skill.

## Three concepts to audition

| Concept        | What the player does                                                                                             | Source of pressure                                                        | Main question to resolve                                                         |
| -------------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Echo Curator   | Hear the rival, then answer a learned note or pair to crack its display shield                                   | Optional rounds or a slow, visible rival progress ring                    | Does a friendly contest encourage another attempt without making beginners rush? |
| Bubble sentry  | Move between cover while a sculpture launches slow visible glass bubbles; reach a safe singing pad to silence it | Telegraph → projectile → safe recovery, with simple movement first        | Can camera and touch controls keep every relevant hazard visible?                |
| Resonance race | Player and rival each try to break their own row of glass; player sings during clearly separated answer windows  | Rival advances on an authored schedule; the remaining glass shows the gap | Can it feel like a race without rival audio contaminating the microphone?        |

These are original design proposals, not implemented or playtested mechanics.
Start with the Echo Curator; projectile movement needs extra collision and camera
work, while a simultaneous singing race adds microphone fairness problems.

## Fair microphone contract

- Rival demonstrations and player capture use separate windows. During capture,
  the rival may animate silently; its audible song must not pass the player's judge.
  Headphones can allow optional background presentation later, but are not required.
- Permission, calibration, examples, instructions, loading, cinematic setup and
  application interruptions never consume contest time. A clear Ready action
  starts each timed round; the rival uses the same attempt clock as the player.
- Beginner duels happen on safe, static support. Movement is currently locked
  during a voice challenge, so incoming projectiles must stop or resolve before
  that phase. A later combined mode needs an explicit new input/camera design.
- Assess the skill, not microphone loudness. Keep comfortable calibration,
  freshness/confidence checks and the chosen difficulty profile. The rival never
  secretly speeds up because the user is close to winning.
- A valid success before the deadline latches before timeout or a hazard effect.
  The shatter celebration cannot turn that success into a loss.
- Failure is a quick local retry and a playful reaction. Keep existing portraits,
  coins, unlocked routes and best results. Avoid compulsory lives, lost currency
  and taunts about the user's voice.
- Projectiles need visible anticipation and direction, forgiving contact bounds,
  brief protection after a hit and a safe return. Audio or color alone cannot be
  the only warning. Beginner versions can disable the deadline or rival pressure.

## Shared architecture proposal

Keep the existing encounter judge authoritative. Add a small optional rival
controller around it rather than a separate singing engine:

1. A `RivalDefinition` selects an art/animation recipe, demonstration, ordered
   rounds, pressure profile and reactions. A placement assigns stable IDs and a
   safe encounter zone. The level still uses ordinary content definitions.
2. A `DuelAttempt` moves through introduction → demonstration → ready → capture
   → result → next round. It consumes existing voice results and owns one clock.
   Rival progress is explicit state, not a render animation deciding who won.
3. A later `HazardSystem` owns projectile spawn, motion, contacts and reset at
   the same fixed step as Merc. Cosmetic bubbles and particles do not decide hits.
   Integrate with the Cloudway support/hazard proposal, not duplicate it.
4. Presentation frames Merc, target, rival and any active hazard. Voice sessions
   borrow the existing audio/microphone lifecycle and cinematic safe-area budget.
5. Saves record completed rival challenges separately from gallery completion,
   exact replay-tier evidence and finite collectible ownership. Decide bonuses
   only after the first prototype; never award duplicate coins on repeated resets.

Begin single-player with an authored NPC. Actual multiplayer, latency compensation,
networked microphone audio and opponent recordings are separate proposals. No
player voice recording or sharing is implied by these concepts.

## Brainstorming and approval checkpoint

- [x] Preserve the three requested directions and microphone/camera constraints.
- [ ] Choose friendly rival personality, encounter placement and preferred pressure.
- [ ] Decide whether the first trial is purely turn-based or has an optional timer.
- [ ] Audition original character/arena images before Meshy production.
- [ ] Whitebox one safe three-round contest using an existing judge and local NPC.
- [ ] Compare untimed and gentle timed versions with actual desktop/tablet singing.
- [ ] Approve production art, rewards and any projectile follow-up from that evidence.

Related plans: [Cloudway platforms](./CLOUDWAY-PLATFORM-TRIALS.md),
[replay difficulty](./REPLAY-DIFFICULTY-AND-LEVEL-STARS.md) and
[portrait/recording finales](./OPTIONAL-EXHIBITS-REWARDS-PORTRAIT-FINALES.md).
