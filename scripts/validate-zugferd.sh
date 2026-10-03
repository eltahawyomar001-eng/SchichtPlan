#!/usr/bin/env bash
#
# Check the ZUGFeRD container against veraPDF, the reference PDF/A validator.
#
# Expected result TODAY is FAIL on three clauses, two of them font embedding
# (6.2.4.3-2, 6.2.4.3-4): the PDF layer uses jsPDF's built-in Helvetica, and
# PDF/A requires every font embedded. See the header of
# src/lib/e-invoice/zugferd.ts for why that is not simply switched on.
#
# This script exists so the gap stays measured rather than remembered, and so
# a future fix can be verified rather than assumed.
#
#   npm run zugferd:validate
#
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/.zugferd-out"

if ! command -v docker >/dev/null 2>&1; then
  export PATH="$PATH:/Applications/Docker.app/Contents/Resources/bin"
fi
if ! command -v docker >/dev/null 2>&1; then
  echo "docker is required: veraPDF is a Java tool." >&2
  exit 1
fi

echo "==> Building the sample"
rm -rf "$OUT"
npx tsx "$ROOT/scripts/build-zugferd-sample.ts" "$OUT"

echo "==> Validating PDF/A-3B"
docker run --rm -v "$OUT:/data" verapdf/cli \
  --format text --flavour 3b --verbose /data/zugferd.pdf || true
