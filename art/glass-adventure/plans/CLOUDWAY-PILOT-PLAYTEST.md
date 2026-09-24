# Cloudway pilot acceptance

The Glass Ribbon is an optional first-island outing. Its route combines eleven
platforms, three familiar comfortable-note challenges, five safe checkpoints,
one raft and two individual crackling steps. New voice judges and difficulty
tiers are outside this pilot.

## Enter and explore

- Development shortcut: `/glass-game/?layout=cloudway` on the new LAN development
  preview. It selects the trial without altering the island's earned stars.
- Normal entry: `/glass-game/?campaign=1`, then the Cloudway Trials card below
  the gallery list. Complete First Light and finish Glassworks Journey with
  three saved pitch stars to unlock it. These are the existing portrait singing
  grades, not the proposed easy/medium/legend replay modes.
- Browser saves belong to their URL origin. A different preview port has its
  own saves; use the development shortcut to test without repeating galleries.
- Use the existing movement and jump controls. Stop on marble to sing. The raft
  pauses at both docks; watch it arrive before boarding. The tutorial can be
  skipped and opened again through the existing help control.

## Acceptance route

1. Open the trial on desktop and tablet. Check that the loader completes, all
   platform materials appear, and the sky is pale with clouds.
2. Sing to the arrival goblet. The usual side camera should frame Merc and the
   glass clearly. Platform timers remain frozen during setup and singing.
3. Cross the frost slabs. Releasing movement should slide a little farther than
   marble, while turning and stopping remain manageable. Check each visible
   gap from the normal camera; no decorative border should hide the jump.
4. Deliberately miss a jump. Merc should return to a safe checkpoint with the
   opened goblet retained. A reset restores the raft and crackle phases.
5. Board the raft, release movement and ride it to the far dock. Merc should
   stay planted on its surface. Jump away and confirm the raft no longer carries
   him in the air. Pause during a ride, then resume without a time jump.
6. Sing on the next marble perch. Observe the raft while requesting microphone
   access, hearing the example and singing; hazards should not consume time.
7. Cross the crackle ribbon normally, then try waiting on a tile. It should show
   a readable warning, release into falling pieces and later reform. Falling
   returns to the last safe landing, without spending stars or lives.
8. Break the final portrait and cross the gold exit. Return to the museum and
   replay the trial. The ordinary galleries and their saved stars remain intact.

The most useful feedback is the tablet feel: jump timing, readable edges,
frost stopping distance, raft boarding, warning duration and sustained frame
rate/heat. Software-rendered browser proofs cannot establish physical-device
performance or microphone fairness.

## Stable LAN server

The new preview uses port 5300, TLS from the repository certificate, no file
watching and no hot reload. Changes require a server restart. Its command works
from any directory and expires after three hours:

```bash
rtk proxy timeout 10800 /home/maff/.nvm/versions/node/v22.22.2/bin/node /home/maff/.codex/worktrees/00ad/mercurypitch-agent/apps/beside-cue/scripts/glass-playtest.ts --https --host 0.0.0.0 --port 5300
```

The script enforces a strict port. Stop it with Ctrl-C in its terminal before
restarting. Server started 2026-09-21 at 21:20 UTC (expires about 00:20 UTC). The direct
LAN URL returned HTTP 200:

- [The Glass Ribbon](https://192.168.178.33:5300/glass-game/?layout=cloudway)
- [Museum campaign](https://192.168.178.33:5300/glass-game/?campaign=1)

The existing compiled port 5298 preview was left running. The new server is a
development host without hot reload; production rendering is checked separately
on a compiled static snapshot. Device playtesting remains owner acceptance.
