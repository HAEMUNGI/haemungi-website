#!/usr/bin/env bash
set -euo pipefail
shopt -s nullglob
artworks=(dist/assets/christmas-*.webp)
if [[ "${#artworks[@]}" -ne 8 ]]; then
  echo "::error::Expected eight Christmas originals"; exit 1
fi
command -v ffmpeg >/dev/null || { echo "::error::ffmpeg must be installed by verify-christmas-decode.sh first"; exit 1; }
command -v ffprobe >/dev/null || { echo "::error::ffprobe unavailable"; exit 1; }
for original in "${artworks[@]}"; do
  output="${original%.webp}.jpg"
  # Warm up the scene itself, not just the surrounding website.
  # Preserve composition and character outlines. WebP masters remain untouched.
  ffmpeg -hide_banner -loglevel error -xerror -y -i "$original" \
    -vf "eq=brightness=0.065:gamma=1.12:saturation=1.12,colorbalance=rs=0.09:gs=0.035:bs=-0.06:rm=0.055:gm=0.025:bm=-0.045" \
    -frames:v 1 -q:v 3 -update 1 "$output"
  [[ -s "$output" ]] || { echo "::error::Missing rendered warm JPEG: $output"; exit 1; }
  meta="$(ffprobe -v error -select_streams v:0 -show_entries stream=codec_name,width,height -of csv=p=0 "$output")"
  IFS=, read -r codec width height <<<"$meta"
  [[ "$codec" == mjpeg && "$width" -ge 800 && "$height" -ge 1200 ]] || { echo "::error::Bad warm JPEG $output $meta";exit 1;}
  ffmpeg -hide_banner -loglevel error -xerror -i "$output" -frames:v 1 -f null -
  printf 'Warm scene JPEG PASS: %s (%s x %s)\n' "$output" "$width" "$height"
done
echo 'Warm Christmas JPEG assets: all eight passed'
