#!/bin/bash
# pull.sh <clip> <prefix> <times...>
clip=$1; pre=$2; shift 2
for t in "$@"; do ffmpeg -v error -y -ss $t -i "$clip" -frames:v 1 "$(dirname $0)/${pre}-${t}.png"; done
