# Brief: generate Merc's 56 final lines for Lesson 5 (ElevenLabs), and download them

The owner said yes to generating Lesson 5's final voices on 26 November. Tavi's 15 lines are
already generated and downloaded. Your job is Merc's 56 lines, and nothing else.

V = /tmp/claude-0/-home-user-mercurypitch/12ae313e-03fe-590a-b304-88d38ce9e159/scratchpad/l5film/voice-takes

## What you have
- `V/batch.json`: all 71 lines (`id`, `who`, `host`, `voice_id`, `chars`, `text`). Merc's are
  the 56 with `"host": "Merc"`.
- `V/ledger.jsonl`: one JSON object per generation call already made (Tavi's 15). Append yours.
- `V/takes/`: the downloaded takes (`<id>.mp3`). Tavi's 15 are there.

## The calls
Load the ElevenLabs tools with ToolSearch:
`select:mcp__ElevenLabs__creative_generate_speech,mcp__ElevenLabs__creative_get_flow_run_status`.
If they do not load, stop at once and say so; do nothing else.

For each of Merc's 56 lines, in `batch.json` order, exactly one call to
`creative_generate_speech` with:
- `prompt`: the line's `text`, copied exactly from `batch.json` (every character, quotes and
  punctuation included; nothing added, such as the line's id);
- `model_id`: `eleven_v3`;
- `voice_id`: `B4fBPRmasEsTgd6YlSok` ("Merc V1 Gentle Whimsical D2");
- `flow_id`: `RXWZQbsChqRZMp2y9E54` (the flow "Find Your Pitch, Lesson 5 final voices: Merc");
- `generations_count`: 1. The owner's production takes one take a line, and the approved spend
  assumes it.
- no `estimate_only`.

Each call costs credits: about one credit a character, 4,757 in all for Merc's 56.
- **Never call twice for the same line**, not even after an error or a timeout. A second call
  starts and charges a second generation.
- If a call returns an error or no `session_id`, write it in the ledger with `"error"`, do not
  retry it, and go on to the next line. The director decides about retakes.
- Several calls may go in one message (up to about 14). After each message's results, append one
  ledger line per call before you make any more:
  `{"id":"<line id>","flow":"RXWZQbsChqRZMp2y9E54","node":"<node_id>","session":"<session_id>","credits":<n>}`

## Download
- Poll `creative_get_flow_run_status` with the flow id and at most 20 `session_ids` a call,
  waiting the `poll_after_seconds` it gives, until each batch is `all_completed` (or
  `has_failures`).
- Each generation's `content_url` holds its session id in its path. Download each to
  `V/takes/<line id>.mp3` with `curl -sS --fail --retry 3`. The links expire about two and a half
  hours after they are made, so download each batch as soon as it completes.
- Check every file: `ffprobe -v error -show_entries format=duration -of csv=p=0 <file>` gives a
  duration over 0.5 s.

## Rules
- Write only inside V (the ledger, the takes and a `merc-report.md`).
- Touch nothing else: no other ElevenLabs tool, no voice design, no other generation.
- No commits or pushes. Never production.

## Hand back
- How many of the 56 were generated and downloaded, and the credits spent (the sum of the
  ledger's credits for Merc's lines).
- Every line with an error, a failed download or a duration under 0.5 s, by id.
- Each line's duration in seconds (also written to `V/merc-report.md`).
