#!/usr/bin/env bash
# Creates the 'running-coach' database inside the existing Cosmos DB free-tier account (MongoDB API).
# Does NOT create a new Cosmos DB account (free tier is already claimed).
#
# Prerequisites:
#   - Azure CLI installed and logged in (az login)
#   - Existing Cosmos DB free-tier account (MongoDB API) in the subscription
#
# Usage:
#   COSMOS_ACCOUNT_NAME=your-cosmos-account RESOURCE_GROUP=your-rg ./scripts/setup-cosmos-db.sh

set -euo pipefail

if [ -z "${COSMOS_ACCOUNT_NAME:-}" ]; then
  echo "ERROR: COSMOS_ACCOUNT_NAME environment variable is not set."
  echo "Usage: COSMOS_ACCOUNT_NAME=your-cosmos-account RESOURCE_GROUP=your-rg $0"
  exit 1
fi

RESOURCE_GROUP="${RESOURCE_GROUP:-rg-ai-running-coach}"
DATABASE_NAME="running-coach"

echo "Creating MongoDB database '${DATABASE_NAME}' in Cosmos DB account '${COSMOS_ACCOUNT_NAME}'..."

az cosmosdb mongodb database create \
  --account-name "${COSMOS_ACCOUNT_NAME}" \
  --resource-group "${RESOURCE_GROUP}" \
  --name "${DATABASE_NAME}"

echo "Database '${DATABASE_NAME}' created."
echo ""
echo "Next: Create collections (runs, chat, plans, user-data) as needed in Phase 2+."
