#!/usr/bin/env bash
set -euo pipefail

# Extract the approved Leo movement poses while excluding disconnected
# background scraps and toy graphics. The large cat silhouette is retained.
# Usage: bash prepare-leo-sprites.sh /absolute/path/to/unzipped/working-pack
source_dir="${1:?Pass the unzipped Leo working asset directory}"
output_dir="$(dirname "$0")/dist/leo-room/sprites"

for action in walk_right walk_left run sit sleep play_reference; do
  mkdir -p "$output_dir/$action"
  # Some supplied source crops overlap the next cat, caption or prop.
  # Keep only intact cat-only silhouettes; motion still uses genuine poses.
  case "$action" in
    sleep) indices=(4) ;;
    play_reference) indices=(1 3 4) ;;
    sit) indices=(1 2 3) ;;
    *) indices=(1 2 3 4 5 6) ;;
  esac
  sequence=0
  for index in "${indices[@]}"; do
    source_file="$source_dir/$action/frame_$(printf '%02d' "$index").png"
    sequence=$((sequence+1))
    filename="frame_$(printf '%02d' "$sequence").png"
    mask_file="$(mktemp --suffix=.png)"
    convert "$source_file" -alpha extract -threshold '83%' \
      -define connected-components:mean-color=true \
      -define connected-components:keep=1 \
      -connected-components 8 -blur 0x0.7 "$mask_file"
    convert "$source_file" "$mask_file" -compose CopyOpacity -composite \
      "$output_dir/$action/$filename"
    rm -f "$mask_file"
  done
done
