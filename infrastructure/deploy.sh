#!/bin/bash

set -euo pipefail

ENVIRONMENT=${1:-production}
REGION=${2:-}

echo "infrastructure/deploy.sh is deprecated. Use npm run deploy:${ENVIRONMENT} instead."

if [[ -n "$REGION" ]]; then
  exec npm run deploy -- "$ENVIRONMENT" "$REGION"
fi

exec npm run deploy -- "$ENVIRONMENT"
