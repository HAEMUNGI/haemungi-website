#!/usr/bin/env bash
set -euo pipefail
fail=0
for name in map square; do
  source="dist/assets/christmas-${name}.webp"
  for mode in direct fresh; do
    url="https://haemungi.pages.dev/assets/christmas-${name}.webp"
    if [[ "$mode" == fresh ]]; then url+="?christmas-asset-qa=20261104-2"; fi
    output="$(mktemp)"
    headers="$(mktemp)"
    status="$(curl -sSL --max-time 30 --retry 2 --retry-delay 1 -w '%{http_code}' -D "$headers" -o "$output" "$url")" || status=network_error
    mime="$(grep -i '^content-type:' "$headers" | tail -1 | tr -d '\r' || true)"
    printf '%s mode=%s HTTP=%s bytes=%s mime=%s\n' "$name" "$mode" "$status" "$(wc -c < "$output")" "$mime"
    if [[ "$status" == 200 ]] && cmp -s "$source" "$output"; then
      echo "MATCH: deployed artwork is byte-identical to GitHub source ($name $mode)"
    else
      echo "::error::Public site artwork differs or is unavailable ($name $mode)"
      echo "Source SHA256: $(sha256sum "$source" | cut -d ' ' -f 1)"
      echo "Response SHA256: $(sha256sum "$output" | cut -d ' ' -f 1)"
      fail=1
    fi
    rm -f "$output" "$headers"
  done
done
exit "$fail"
