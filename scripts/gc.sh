#!/usr/bin/env bash
set -e
echo "▶ lint"; npm run lint
echo "▶ typecheck"; npm run typecheck
echo "▶ knip strict"; npx knip --strict
echo "▶ test"; npm test
echo "▶ build"; npm run build
echo "✅ All gates passed"
