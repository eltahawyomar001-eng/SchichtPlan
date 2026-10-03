#!/usr/bin/env bash
#
# Validate the golden e-invoices against the official KoSIT validator.
#
# This is the only thing that actually proves an invoice will be accepted. The
# vitest suite checks structure and arithmetic, which catches the mistakes that
# would waste a run here, but it cannot tell you whether KoSIT's current
# XRechnung rules accept the document -- only KoSIT can.
#
# The validator is Java, so it runs in a container rather than being added to
# the toolchain. Pinned by digest-able tag on purpose: the rules change, and an
# invoice that passed last quarter can legitimately fail today. Treat a bump as
# a deliberate change, and re-run the suite when you make one.
#
#   ./scripts/validate-einvoices.sh
#
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/.e-invoice-out"
IMAGE="${KOSIT_IMAGE:-ghcr.io/itplr-kosit/validator:1.5.0}"

if ! command -v docker >/dev/null 2>&1; then
  echo "docker is required: the KoSIT validator is a Java tool and is not" >&2
  echo "installed into this project's toolchain." >&2
  exit 1
fi

echo "==> Writing the golden invoices"
rm -rf "$OUT"
mkdir -p "$OUT"
npx tsx "$ROOT/scripts/write-golden-invoices.ts" "$OUT"
ls -1 "$OUT"/*.xml | while read -r f; do echo "    $(basename "$f")"; done

echo
echo "==> Validating with $IMAGE"
# --repository points the validator at its own rule configuration; the image
# ships the current XRechnung scenarios.
docker run --rm \
  -v "$OUT:/data" \
  "$IMAGE" \
  -r /scenarios \
  -s /scenarios/scenarios.xml \
  -h \
  --output-directory /data/report \
  /data/*.xml || true

echo
echo "==> Results"
failed=0
for report in "$OUT"/report/*.html "$OUT"/report/*.xml; do
  [ -e "$report" ] || continue
  name="$(basename "$report")"
  if grep -qiE "<accepted>false|rejected" "$report" 2>/dev/null; then
    echo "    REJECTED  $name"
    failed=1
  fi
done

if [ "$failed" -ne 0 ]; then
  echo
  echo "At least one invoice was rejected. The reports are in $OUT/report." >&2
  exit 1
fi

echo "    all invoices accepted"
