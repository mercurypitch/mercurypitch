#!/usr/bin/env bash
# Run one command with an optional profile selector as its first argument.
#
# macOS still ships Bash 3, where expanding an empty array under `set -u`
# raises "unbound variable". Positional parameters omit the empty selector
# without relying on shell-version-specific array behaviour.

set -euo pipefail

if [[ $# -lt 2 ]]; then
  echo 'Usage: run-with-optional-profile-argument.sh <optional-argument> <command> [arguments...]' >&2
  exit 2
fi

optional_argument=$1
shift
command=$1
shift

if [[ -n "$optional_argument" ]]; then
  exec "$command" "$optional_argument" "$@"
fi

exec "$command" "$@"
