#!/usr/bin/env bash
# Creates the 'running-coach' database inside the existing Cosmos DB free-tier account.
# Does NOT create a new Cosmos DB account (free tier is already claimed).
#
# Prerequisites:
#   - Azure CLI installed and logged in (az login)
#   - Existing Cosmos DB free-tier account in the subscription
#
# Usage:
#   COSMOS_ACCOUNT_NAME=your-cosmos-account ./scripts/setup-cosmos-db.sh

set -euo pipefail

if [ -z "${COSMOS_ACCOUNT_NAME:-}" ]; then
  echo "ERROR: COSMOS_ACCOUNT_NAME environment variable is not set."
  echo "Set it to your existing Cosmos DB account name."
  echo "Usage: COSMOS_ACCOUNT_NAME=your-cosmos-account $0"
  exit 1
fi

RESOURCE_GROUP="rg-ai-running-coach"
DATABASE_NAME="running-coach"

echo "Creating database '${DATABASE_NAME}' in Cosmos DB account '${COSMOS_ACCOUNT_NAME}'..."

az cosmosdb sql database create \
  --account-name "${COSMOS_ACCOUNT_NAME}" \
  --resource-group "${RESOURCE_GROUP}" \
  --name "${DATABASE_NAME}" \
  --throughput 1000

echo "Database '${DATABASE_NAME}' created with 1000 RU/s shared throughput."
echo ""
echo "Next: Create containers (runs, chat, plans, user-data) as needed in Phase 2+."
