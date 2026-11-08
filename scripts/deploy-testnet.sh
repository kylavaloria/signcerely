#!/usr/bin/env bash
# Build the contract and deploy it to Stellar testnet.
# Needs the Stellar CLI: https://developers.stellar.org/docs/tools/cli
# Usage: ./scripts/deploy-testnet.sh [identity-name]   (default: iys-deployer)
set -euo pipefail

IDENTITY="${1:-iys-deployer}"
NETWORK="testnet"
WASM="target/wasm32v1-none/release/its_your_sign.wasm"

if ! stellar keys address "$IDENTITY" >/dev/null 2>&1; then
  echo "Creating and funding identity '$IDENTITY' on $NETWORK..."
  stellar keys generate "$IDENTITY" --network "$NETWORK" --fund
fi

echo "Building..."
stellar contract build

echo "Deploying..."
CONTRACT_ID=$(stellar contract deploy \
  --wasm "$WASM" \
  --source-account "$IDENTITY" \
  --network "$NETWORK" \
  --alias its-your-sign)

echo
echo "Contract ID: $CONTRACT_ID"
echo "Explorer:    https://stellar.expert/explorer/testnet/contract/$CONTRACT_ID"
echo
echo "Put it in the app's .env.local as NEXT_PUBLIC_CONTRACT_ID=$CONTRACT_ID"
