#!/usr/bin/env bash
set -euo pipefail

# Starts the Cosmos DB emulator (if not already running), the .NET API, and the
# Vite dev server. All three processes run concurrently; Ctrl-C stops them all.

COSMOS_CONTAINER="cosmos-emulator"
COSMOS_IMAGE="mcr.microsoft.com/cosmosdb/linux/azure-cosmos-emulator:latest"

# ── Cosmos DB emulator ─────────────────────────────────────────────────────────

if docker ps --format '{{.Names}}' | grep -q "^${COSMOS_CONTAINER}$"; then
  echo "✓ Cosmos emulator already running"
else
  if docker ps -a --format '{{.Names}}' | grep -q "^${COSMOS_CONTAINER}$"; then
    echo "→ Starting existing Cosmos container..."
    docker start "$COSMOS_CONTAINER"
  else
    echo "→ Creating and starting Cosmos emulator..."
    docker run -d --name "$COSMOS_CONTAINER" \
      -p 8081:8081 -p 10250-10255:10250-10255 \
      -e AZURE_COSMOS_EMULATOR_ENABLE_DATA_PERSISTENCE=true \
      "$COSMOS_IMAGE"
  fi

  echo "   Waiting for Cosmos emulator to be ready..."
  until curl -sk https://localhost:8081/_explorer/emulator.pem > /dev/null 2>&1; do
    sleep 2
  done
  echo "✓ Cosmos emulator ready"
fi

# ── Cleanup on exit ────────────────────────────────────────────────────────────

cleanup() {
  echo ""
  echo "→ Shutting down API and frontend..."
  kill "$API_PID" "$FRONTEND_PID" 2>/dev/null || true
  wait "$API_PID" "$FRONTEND_PID" 2>/dev/null || true
  echo "✓ Done"
}
trap cleanup EXIT INT TERM

# ── API ────────────────────────────────────────────────────────────────────────

echo "→ Starting API..."
(cd src/api && dotnet run) &
API_PID=$!

# ── Frontend ───────────────────────────────────────────────────────────────────

echo "→ Starting frontend..."
npm run dev &
FRONTEND_PID=$!

echo ""
echo "  API:      http://localhost:5062"
echo "  Frontend: http://localhost:5173"
echo ""
echo "Press Ctrl-C to stop all services."
echo ""

wait "$API_PID" "$FRONTEND_PID"
