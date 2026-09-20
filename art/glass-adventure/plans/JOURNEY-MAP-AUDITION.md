# Museum journey map — visual audition and backlog

Status: three concepts ready for owner audition; not implemented. Updated 2026-09-21.

## Owner brief

Make the journey feel like a game world: Merc travels along a museum-inspired
path; stage medallions lead into galleries of levels. It must grow from the
present prologue/three galleries to 10, 20 or 50 levels. Upright portrait
milestones can appear every two or three stages, initially mysterious and
revealed when earned. The first stage enters the introductory gallery; later
stages group related journeys such as Glassworks and Twin Galleries.

The existing welcome screen remains. This is a later campaign navigation layer.
Do not replace it during the current four-stage implementation.

## Three directions to audition

| Direction               | Main idea                                                                              | Question for the visual choice                                      |
| ----------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| A. Floating Museum      | Miniature marble museum islands, arched bridges, clouds and upright portrait monuments | Does a place Merc can travel through best express the museum?       |
| B. Resonant Relief      | A tactile sculpted landscape with gold trails and gallery landmarks                    | Does the classic terrain-map sense of discovery feel more engaging? |
| C. Living Gallery Atlas | An intimate architectural atlas unfolding into miniature rooms and garden wings        | Does a collectible storybook suit the journey better?               |

References: the project's floating-museum direction image and MercuryPitch's
Ascent progress/orb concepts. The owner's external reference is
[Dungeon Keeper 2](https://www.ea.com/games/dungeon-keeper/dungeon-keeper-2);
borrow only the broad idea of a memorable game campaign landscape, not its
artwork, geography, interface or combat theme. All three images are original
concept proposals using our marble, gold, jade, glass and Merc vocabulary.

## Constraints to carry into later planning

- Stage/wing and playable-level identities remain separate and stable.
- Show a few nearby chapters clearly, with further chapters beyond mist or a
  scroll boundary. Do not squeeze fifty nodes into one tablet screen.
- Portrait reveal and optional mastery stars are distinct; lower singing scores
  must not hide an earned portrait or block the ordinary route.
- The illustrated map needs accessible equivalent navigation and a clear
  Continue action. Touch selection must not depend on tiny decorative targets.
- Preserve the current campaign's saves; this later view reads progression.
- Decide grouping, reveal cadence, motion and mobile rendering only after the
  owner chooses a visual direction. These are backlog constraints, not a final
  map architecture or implementation commitment.

## Audition checklist

- [x] Save three built-in imagegen outputs and exact prompts under
      `art/glass-adventure/journey-map/v1/`.
- [x] Inspect all three and provide a local comparison page/inline previews.
- [x] Notify owner that the map audition is ready while stages 1–4 continue.
- [ ] Record visual choice or requested combination.
- [ ] Later: detailed navigation/progression design, performance prototype and
      implementation as a separate follow-up.

Audition: [local comparison page](../journey-map/v1/review.html). Initial
recommendation is A, Floating Museum, because it most directly continues the
existing world. B emphasizes terrain exploration; C emphasizes the collectible
atlas. The generated microcopy/star placement is illustrative, not approved UI.
