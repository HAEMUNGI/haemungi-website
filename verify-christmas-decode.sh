#!/usr/bin/env bash
set -euo pipefail
shopt -s nullglob
artworks=(dist/assets/christmas-*.webp)
if [ "${#artworks[@]}" -ne 8 ]; then
  echo "::error::Expected exactly 8 Christmas artwork files; found ${#artworks[@]}"
  exit 1
fi
command -v ffmpeg >/dev/null || { echo "::error::ffmpeg is required for image decode validation"; exit 1; }
command -v ffprobe >/dev/null || { echo "::error::ffprobe is required for image dimensions validation"; exit 1; }
for artwork in "${artworks[@]}"; do
  printf 'Decoding: %s\n' "$artwork"
  metadata="$(ffprobe -v error -select_streams v:0 -show_entries stream=codec_name,width,height -of csv=p=0 "$artwork")"
  IFS=, read -r codec width height <<<"$metadata"
  if [[ "$codec" != webp || ! "$width" =~ ^[0-9]+$ || ! "$height" =~ ^[0-9]+$ || "$width" -lt 800 || "$height" -lt 1200 ]]; then
    echo "::error::Invalid dimensions or codec: $artwork ($metadata)"
    exit 1
  fi
  # Actually decode pixels; a RIFF header check alone is insufficient.
  ffmpeg -hide_banner -loglevel error -xerror -i "$artwork" -frames:v 1 -f null - || {
    echo "::error::The image could not be decoded: $artwork"
    exit 1
  }
  printf 'Decoded OK: %s (%s x %s)\n' "$artwork" "$width" "$height"
done
echo 'Christmas artwork full decoder check PASS'
