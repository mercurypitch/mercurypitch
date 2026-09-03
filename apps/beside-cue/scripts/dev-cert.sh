#!/usr/bin/env bash
# A dev certificate that actually covers the phone's URL.
# ============================================================
#
#   bash scripts/dev-cert.sh          # writes .dev-cert/{key,cert}.pem
#
# `vite --mode https` used to get its certificate from
# @vitejs/plugin-basic-ssl, whose SAN list is localhost, ::1 and
# 127.0.0.1 and nothing else. A phone does not reach a laptop on any of
# those, so on the one URL a device test uses -- https://<lan-ip>:5173 --
# the certificate does not match the host it is served from.
#
# Safari lets you tap through that for the DOCUMENT and then declines to
# trust the same connection for what the document asks for next, so the
# page loads and its images, videos and .glb files do not. That failure
# is silent and it does not look like a certificate problem: broken
# image glyphs, black video, and -- because Vite's dev server answers any
# path it cannot find with index.html -- "JSON parse error: Unrecognized
# token '<'" from a loader that was handed a web page.
#
# The plugin cannot be talked into fixing it: its `domains` option writes
# every entry as a dNSName, and a browser will not match a dNSName
# against a host that is an IP address. It has to be an iPAddress SAN,
# which means writing the certificate here.
#
# Still self-signed, so Safari still asks once. Accepting a certificate
# that matches the host is the case the browser is built for; accepting
# one that does not is the case it hedges on.
set -euo pipefail
cd "$(dirname "$0")/.."

command -v openssl >/dev/null || { echo "openssl required" >&2; exit 1; }

OUT=.dev-cert
mkdir -p "$OUT"

# Every address this machine can be reached on today. Regenerate after
# changing network -- a certificate is only as good as the address the
# phone types in.
mapfile -t IPS < <(
  ip -4 -o addr show scope global 2>/dev/null | awk '{print $4}' | cut -d/ -f1
)

alt="DNS:localhost,DNS:*.local,IP:127.0.0.1,IP:::1"
n=0
for ip in "${IPS[@]}"; do
  alt="$alt,IP:$ip"
  n=$((n + 1))
done

openssl req -x509 -newkey rsa:2048 -sha256 -days 365 -nodes \
  -keyout "$OUT/key.pem" -out "$OUT/cert.pem" \
  -subj "/CN=beside-cue-dev" \
  -addext "subjectAltName=$alt" \
  -addext "basicConstraints=critical,CA:FALSE" \
  -addext "keyUsage=critical,digitalSignature,keyEncipherment" \
  -addext "extendedKeyUsage=serverAuth" 2>/dev/null

echo "wrote $OUT/cert.pem, valid 365 days"
echo "covers localhost plus $n LAN address(es):"
for ip in "${IPS[@]}"; do echo "  https://$ip:5173"; done
