#!/usr/bin/env bash
#
# Validate the golden e-invoices against the official KoSIT validator.
#
# This is the only thing that proves an invoice will be accepted. The vitest
# suite checks structure and arithmetic, which catches the mistakes that would
# waste a run here, but it cannot tell you whether KoSIT's current XRechnung
# rules accept the document.
#
# There is no official KoSIT container image, so this downloads the released
# JAR and the XRechnung configuration and runs them in a stock JRE image. Both
# are pinned: the rules change, and an invoice that passed last quarter can
# legitimately fail today. Treat a version bump as a deliberate change and
# re-run the suite when you make one.
#
#   npm run einvoice:validate
#
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/.e-invoice-out"
KOSIT="$ROOT/.kosit"

VALIDATOR_VERSION="1.6.3"
# Configuration release tag and the file inside it.
CONFIG_TAG="v2026-08-31"
CONFIG_FILE="xrechnung-3.0.2-validator-configuration-2026-08-31.zip"

if ! command -v docker >/dev/null 2>&1; then
  export PATH="$PATH:/Applications/Docker.app/Contents/Resources/bin"
fi
if ! command -v docker >/dev/null 2>&1; then
  echo "docker is required: the KoSIT validator is a Java tool and is" >&2
  echo "deliberately not added to this project's toolchain." >&2
  exit 1
fi

mkdir -p "$KOSIT"
if [ ! -f "$KOSIT/validator.jar" ]; then
  echo "==> Fetching KoSIT validator $VALIDATOR_VERSION"
  curl -sSL -o "$KOSIT/validator.jar" \
    "https://github.com/itplr-kosit/validator/releases/download/v$VALIDATOR_VERSION/validator-$VALIDATOR_VERSION-standalone.jar"
fi
if [ ! -d "$KOSIT/config" ]; then
  echo "==> Fetching XRechnung configuration $CONFIG_TAG"
  curl -sSL -o "$KOSIT/config.zip" \
    "https://github.com/itplr-kosit/validator-configuration-xrechnung/releases/download/$CONFIG_TAG/$CONFIG_FILE"
  unzip -qo "$KOSIT/config.zip" -d "$KOSIT/config"
fi

echo "==> Writing the golden invoices"
rm -rf "$OUT"
mkdir -p "$OUT"
npx tsx "$ROOT/scripts/write-golden-invoices.ts" "$OUT"

echo "==> Validating"
docker run --rm \
  -v "$KOSIT:/kosit" \
  -v "$OUT:/data" \
  -w /kosit \
  eclipse-temurin:21-jre \
  java -jar validator.jar \
    -s /kosit/config/scenarios.xml \
    -r /kosit/config \
    -h -o /data/report \
    /data/standard.xml \
    /data/kleinunternehmer.xml \
    /data/b2g-leitweg.xml \
    /data/storno.xml
