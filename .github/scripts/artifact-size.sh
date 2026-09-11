#!/usr/bin/env bash
#
# Size gate for a native build's download artifacts (task I7).
#
#   artifact-size.sh <label> <warn-mb> <fail-mb> <glob> [glob...]
#
# Measures every file the globs match, prints one table into the job summary,
# emits ::warning:: above the warn threshold and exits non-zero above the fail
# threshold — so the step that called it, and with it the job, goes red.
#
# WHAT IS BEING MEASURED, and what is not. This is the DOWNLOAD artifact: the
# .ipa the App Store is handed, the .aab/.apk Play is handed. It is NOT the
# installed size, and the two are not the same number in either direction —
# the stores re-sign, re-compress and slice what they were given per device,
# and the app then unpacks on disk. Apple's own cellular-download limit and
# Play's delivery limits are quoted against the download, which is why the
# gate is set there; read the number as a trend line with a hard ceiling, not
# as what a phone's Settings screen will say.
#
# MB here is 1024 x 1024 bytes, and bytes are printed beside it so a
# comparison between two runs never depends on which MB anyone meant.
#
# Kept as a script rather than a composite action on purpose: the reusable
# Capacitor workflow calls it from two jobs, one of them on macOS, and a plain
# file in the checked-out repository has no resolution rules of its own to get
# wrong.
#
# Written for bash 3.2 — the /bin/bash a macOS runner still ships.

set -euo pipefail

if [ "$#" -lt 4 ]; then
  echo "usage: artifact-size.sh <label> <warn-mb> <fail-mb> <glob> [glob...]" >&2
  exit 2
fi

label="$1"
warn_mb="$2"
fail_mb="$3"
shift 3

warn_bytes=$((warn_mb * 1024 * 1024))
fail_bytes=$((fail_mb * 1024 * 1024))

files=()
for pattern in "$@"; do
  # Unquoted on purpose: this line is where the glob expands. An unmatched
  # pattern expands to itself, which the -f test then drops.
  # shellcheck disable=SC2086
  for path in $pattern; do
    if [ -f "$path" ]; then files+=("$path"); fi
  done
done

if [ "${#files[@]}" -eq 0 ]; then
  # The caller runs this immediately after the step that produces the
  # artifact, so nothing matching means the build changed shape — a renamed
  # output, or a step that quietly produced nothing. Measuring zero files and
  # reporting "ok" is how a gate becomes decoration.
  echo "::error title=${label} download size::No artifact matched: $*"
  exit 1
fi

summary="${GITHUB_STEP_SUMMARY:-/dev/null}"

# Every line goes to both places. The job summary is the readable one, but a
# run that has to be read from the log -- a rerun, a `gh run view --log`, a
# comparison between two builds -- should not have to open a second page to
# find out how big the thing was.
say() {
  printf '%s\n' "$1"
  printf '%s\n' "$1" >>"$summary"
}

say "### Download size — ${label}"
say ""
say "| Artifact | Bytes | MB | Gate |"
say "| --- | ---: | ---: | --- |"

status=0
for path in "${files[@]}"; do
  # wc, not stat: BSD wants -f%z and GNU wants -c%s, and this runs on both.
  bytes="$(wc -c <"$path" | tr -d ' ')"
  mb="$(awk -v b="$bytes" 'BEGIN { printf "%.1f", b / 1048576 }')"
  name="$(basename "$path")"

  if [ "$bytes" -gt "$fail_bytes" ]; then
    gate='**FAIL**'
    status=1
    echo "::error title=${label} download size::${name} is ${mb} MB (${bytes} bytes), over the ${fail_mb} MB limit."
  elif [ "$bytes" -gt "$warn_bytes" ]; then
    gate='warn'
    echo "::warning title=${label} download size::${name} is ${mb} MB (${bytes} bytes), over the ${warn_mb} MB warning threshold."
  else
    gate='ok'
  fi

  say "| \`${name}\` | ${bytes} | ${mb} | ${gate} |"
done

say ""
say "Warn above ${warn_mb} MB, fail above ${fail_mb} MB (1 MB = 1024 x 1024 bytes)."
say "Measured on the download artifact the store is handed, not the installed size."

exit "$status"
