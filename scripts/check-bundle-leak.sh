#!/usr/bin/env bash
# scripts/check-bundle-leak.sh
# Multi-signal grep for server-only fingerprints in the example app's client bundle.
# Fails the build if any fingerprint is found — the SDK leaked server code into the client.
set -euo pipefail

CLIENT_DIR="example/dist/client"
if [ ! -d "$CLIENT_DIR" ]; then
  echo "ERROR: $CLIENT_DIR not found. Run 'cd example && pnpm build' first." >&2
  exit 1
fi

# Concatenate all client JS for grepping (handles minified single-line files)
ALL_JS=$(find "$CLIENT_DIR" -name "*.js" -type f -print0 | xargs -0 cat)

FINGERPRINTS=(
  # Package names
  "@workos-inc/node"
  "iron-session"
  "iron-webcrypto"
  # Code fingerprints (more robust against minification)
  "FeatureFlagsRuntimeClient"
  "The listener must be a function"
  "ERR_JWT_CLAIM_VALIDATION_FAILED"
)

FAIL=0
for fp in "${FINGERPRINTS[@]}"; do
  if echo "$ALL_JS" | grep -q -F "$fp"; then
    echo "LEAK: '$fp' found in $CLIENT_DIR" >&2
    FAIL=1
  fi
done

if [ $FAIL -eq 1 ]; then
  echo "" >&2
  echo "Server-only code detected in client bundle. See CLAUDE.md 'Lazy handler bodies' section." >&2
  exit 1
fi

echo "OK: no server-side fingerprints in $CLIENT_DIR"
