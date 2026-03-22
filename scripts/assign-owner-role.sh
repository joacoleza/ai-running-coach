#!/usr/bin/env bash
# Assigns the 'owner' role to the GitHub user specified by OWNER_GITHUB_USERNAME.
# Run once after the SWA resource is created and the user has signed in at least once.
#
# Prerequisites:
#   - Azure CLI installed and logged in (az login)
#   - OWNER_GITHUB_USERNAME environment variable set
#
# Usage:
#   OWNER_GITHUB_USERNAME=yourusername ./scripts/assign-owner-role.sh
#
# Source: https://learn.microsoft.com/en-us/cli/azure/staticwebapp/users

set -euo pipefail

if [ -z "${OWNER_GITHUB_USERNAME:-}" ]; then
  echo "ERROR: OWNER_GITHUB_USERNAME environment variable is not set."
  echo "Usage: OWNER_GITHUB_USERNAME=yourusername $0"
  exit 1
fi

RESOURCE_GROUP="rg-ai-running-coach"
SWA_NAME="swa-ai-running-coach"

echo "Assigning 'owner' role to GitHub user: ${OWNER_GITHUB_USERNAME}"
echo "Resource group: ${RESOURCE_GROUP}"
echo "Static Web App: ${SWA_NAME}"

az staticwebapp users update \
  --name "${SWA_NAME}" \
  --resource-group "${RESOURCE_GROUP}" \
  --authentication-provider GitHub \
  --user-details "${OWNER_GITHUB_USERNAME}" \
  --roles "owner"

echo "Done. Role 'owner' assigned to ${OWNER_GITHUB_USERNAME}."
echo ""
echo "Verify by signing into the app with this GitHub account."
echo "Other GitHub accounts will receive a 403 (access denied)."
