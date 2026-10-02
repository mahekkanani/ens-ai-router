#!/usr/bin/env bash
# scripts/start-all-agents.sh
#
# Start all three specialist agents in the background.
# Useful for development and testing.
#
# Usage:
#   bash scripts/start-all-agents.sh
#
# Stop all agents:
#   pkill -f "agents/.*/index.ts"

set -e

echo "Starting all specialist agents..."
echo

# Start each agent in the background with tsx
npm run dev agents/invoice/index.ts &
INVOICE_PID=$!
echo "✓ Invoice agent started (PID $INVOICE_PID) on http://localhost:4001"

npm run dev agents/contract/index.ts &
CONTRACT_PID=$!
echo "✓ Contract agent started (PID $CONTRACT_PID) on http://localhost:4002"

npm run dev agents/brand/index.ts &
BRAND_PID=$!
echo "✓ Brand agent started (PID $BRAND_PID) on http://localhost:4003"

echo
echo "All agents running. Press Ctrl+C to stop all."
echo
echo "Test with:"
echo "  curl -X POST http://localhost:4001/ask -H 'Content-Type: application/json' -d '{\"request\": \"Why is my invoice overdue?\"}'"
echo "  curl -X POST http://localhost:4002/ask -H 'Content-Type: application/json' -d '{\"request\": \"What is a termination clause?\"}'"
echo "  curl -X POST http://localhost:4003/ask -H 'Content-Type: application/json' -d '{\"request\": \"Write a tagline for an AI router\"}'"
echo

# Wait for Ctrl+C
trap "echo ''; echo 'Stopping all agents...'; kill $INVOICE_PID $CONTRACT_PID $BRAND_PID 2>/dev/null; exit 0" SIGINT SIGTERM

# Keep script running
wait
