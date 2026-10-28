**0.9.24 is ready to tag once your dev tests pass**

The coach bubble fix (#1243) merged at 12:25, and dev has served it since 12:31. Dev now runs main `5155a5663`, which is the whole of 0.9.24.

**For you, on dev:**
- Items 1 and 2 are ready now:
  - Show me more on an iPhone, ringer switch on, then off.
  - Play the note on a phone.
- At 320 px the tour bubble's buttons should now stay put, with only its words scrolling. Their bottom edge fades while there is more to read.
- Items 3 to 5, if you haven't done them yet: the mic's edge with a finger, Merc alone on a phone, and Lessons 1 and 2.

**Release checks on `5155a5663`:**
- CHANGELOG.md and package.json both say 0.9.24. The entry has 6 bullets, averaging 153 characters.
- No v0.9.24 tag exists yet, locally or on GitHub.
- Guided tours (Release Tours run 16): 144 steps on desktop and 127 on a phone, every one with a visible spotlight and none breaking a rule. The 4 steps that need a cloud board were skipped, as always.

**Tag commands.** Run them once items 1 to 5 look right:

```
git fetch origin --tags --prune
git checkout main
git pull --ff-only origin main
git status --porcelain                 # must print nothing
git rev-parse HEAD                     # must print 5155a5663ea6e0b3ecfc03eaa3f34a33d1b5c07e
git tag -l v0.9.24                     # must print nothing
git ls-remote --tags origin v0.9.24    # must print nothing
git tag -a v0.9.24 -m "Release v0.9.24: Show me more, and a tour offer that floats"
git push origin v0.9.24
```

The push starts the production deploy and a second tours walk. I'll watch both and report once.

If the `rev-parse` line prints anything else, main has moved, so stop and tell me. Another session's draft PR, #1244 (Ear Lab with Merc), targets main. If anything merges before you tag, I'll walk the tours again on the new main and send you its SHA.

**Two decisions:**
1. **The R2 fix.** This is the one I asked about at 11:20. Its two parts are ready and tested:
   - The native build tries each example stem three times, and gives up on a try once 30 s pass with nothing arriving.
   - The Jam layout test serves the demo song itself. With every request to R2 blocked, its 14 tests pass. Without the change, all 14 fail.

   A v tag starts no native build, so the bucket cannot hold up 0.9.24. I'd open it as its own PR after you tag, so it ships in 0.9.25. Yes, after the tag; yes, before it; or no?
2. **Play the note at 320 px** (taste). After the note plays, the line on how to hear it pushes the button below the bubble's fold. It is one swipe or one Tab away. I'd keep it for 0.9.24. In 0.9.25, should the line go after the button, or the button into the bubble's foot?
