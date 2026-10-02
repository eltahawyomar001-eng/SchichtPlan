#!/usr/bin/env bash
#
# Encode the landing-page explainer video into the formats the player serves.
#
# Kept as a script rather than run by hand so a re-export of the master can be
# reprocessed identically. Output is deterministic: delete public/videos/landing
# and re-run.
#
# Source files are expected in ~/Downloads (where the exports land).
set -euo pipefail

SRC="${1:-$HOME/Downloads/Shiftfy-Landingpage-Video.mp4}"
VTT="${2:-$HOME/Downloads/Shiftfy-Landingpage-Video.de.vtt}"
OUT="$(cd "$(dirname "$0")/.." && pwd)/public/videos/landing"

mkdir -p "$OUT"
[ -f "$SRC" ] || { echo "missing source: $SRC" >&2; exit 1; }

echo "==> 1080p MP4 (stream copy; the master is already H.264 + faststart)"
ffmpeg -y -loglevel error -i "$SRC" -c copy -movflags +faststart \
  "$OUT/shiftfy-erklaervideo-1080.mp4"

echo "==> 720p MP4 for narrow viewports"
ffmpeg -y -loglevel error -i "$SRC" -vf scale=1280:-2 \
  -c:v libx264 -crf 23 -preset slow -c:a aac -b:a 128k -movflags +faststart \
  "$OUT/shiftfy-erklaervideo-720.mp4"

echo "==> 1080p VP9/Opus WebM (kept only if it beats the MP4)"
ffmpeg -y -loglevel error -i "$SRC" \
  -c:v libvpx-vp9 -crf 34 -b:v 0 -row-mt 1 -c:a libopus -b:a 96k \
  "$OUT/shiftfy-erklaervideo-1080.webm"

mp4_size=$(stat -f%z "$OUT/shiftfy-erklaervideo-1080.mp4")
webm_size=$(stat -f%z "$OUT/shiftfy-erklaervideo-1080.webm")
if [ "$webm_size" -ge "$mp4_size" ]; then
  echo "    WebM ($((webm_size/1024/1024))MB) >= MP4 ($((mp4_size/1024/1024))MB) — discarding"
  rm -f "$OUT/shiftfy-erklaervideo-1080.webm"
else
  echo "    WebM kept: $((webm_size/1024/1024))MB vs MP4 $((mp4_size/1024/1024))MB"
fi

# A frame from late in the video, chosen because the supplied poster has a play
# button burned into it and the player draws its own.
echo "==> clean poster from 80.6s"
ffmpeg -y -loglevel error -ss 80.6 -i "$SRC" -frames:v 1 "$OUT/_poster-full.png"

for w in 1920 960; do
  ffmpeg -y -loglevel error -i "$OUT/_poster-full.png" -vf "scale=$w:-2" \
    -q:v 3 "$OUT/poster-clean-$w.jpg"
  ffmpeg -y -loglevel error -i "$OUT/_poster-full.png" -vf "scale=$w:-2" \
    -c:v libwebp -quality 72 "$OUT/poster-clean-$w.webp"
  # AVIF via libaom; skipped rather than failing if the build lacks it.
  ffmpeg -y -loglevel error -i "$OUT/_poster-full.png" -vf "scale=$w:-2" \
    -c:v libaom-av1 -crf 32 -still-picture 1 "$OUT/poster-clean-$w.avif" \
    2>/dev/null || echo "    AVIF $w skipped (no libaom-av1)"
done
rm -f "$OUT/_poster-full.png"

echo "==> subtitles"
cp "$VTT" "$OUT/shiftfy-erklaervideo.de.vtt"

echo
echo "Done:"
ls -lhS "$OUT" | awk 'NR>1 {printf "  %-44s %s\n", $9, $5}'
