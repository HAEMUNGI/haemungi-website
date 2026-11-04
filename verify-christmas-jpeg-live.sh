#!/usr/bin/env bash
set -euo pipefail
for name in map square market parade sled fishing stage garden; do
  source="dist/assets/christmas-${name}.jpg"
  url="https://haemungi.pages.dev/assets/christmas-${name}.jpg"
  output="$(mktemp)"
  match=false
  for attempt in 1 2 3 4 5; do
    status="$(curl -sSL --connect-timeout 12 --max-time 30 -w '%{http_code}' -o "$output" "$url?warmrelease=20261104-v2")" || status=network_error
    if [[ "$status" == 200 ]] && cmp -s "$source" "$output"; then
      match=true
      break
    fi
    sleep 3
  done
  if [[ "$match" != true ]]; then
    echo "::error::Published warm JPEG mismatch ($name HTTP=$status)"
    rm -f "$output"
    exit 1
  fi
  printf 'Warm JPEG live PASS: %s (%s bytes)\n' "$name" "$(wc -c < "$output")"
  rm -f "$output"
done
echo 'All 8 warm JPEG images verified on Cloudflare Pages'
