---
# HyperFrames skills read `workflow` and hand the project to the skill named
# here, so they do not run their own intent interview.
workflow: motion-designer
flow: automation
# HyperFrames meaning: no user checkpoint on the plan. The storyboard still
# exists and still goes to a critic.
storyboard: no
# The user's standing answer to the HyperFrames "render now?" gate. Use `ask`
# to confirm each render instead.
renders: pre-authorized
# true: the user is away. Decide, log the decision in DECISIONS.md, keep going.
unattended: true
message: '' # the one thing the video must communicate
audience: ''
destination: '' # x-feed, reels, tiktok, youtube, landing-page, app-store, in-app
aspect: 1920x1080 # the primary canvas
sizes: 1920x1080, 1080x1920 # every size to deliver
length: 30s
fps: 60
language: en-GB
project_dir: output/motion/<slug>
---

# Brief

## Intent

- What the video is for (product, feature, campaign):
- Who is watching, and what they care about:
- What they should do at the end (exact words, and the exact URL if any):

## Brand

- Name:
- Logo files:
- Colours (hex):
- Fonts (local files and their licences):

## Facts

- Facts file: the only source for any number, name or claim on screen.

## Assets

One line each: `path - what it is - where it belongs`.

## Style references

Links or a folder of videos whose motion you like. Study only: never copy their
footage, logos, layouts or music.

## Audio

- Music (source and licence, or `none`):
- Sound effects (source and licence):
- Voiceover (yes or no):

## Must never appear

Claims, words or imagery that must not be shown.

## Notes
