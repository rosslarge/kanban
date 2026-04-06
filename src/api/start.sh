#!/usr/bin/env bash
set -euo pipefail

CONTAINER_NAME="cosmos-emulator"
EMULATOR_URL="https://localhost:8081"
HEALTH_ENDPOINT="${EMULATOR_URL}/_explorer/index.html"
MAX_WAIT_SECONDS=120

# ── Docker check ────────────────────────────────────────────────────────────
if ! docker info > /dev/null 2>&1; then
  echo "Error: Docker is not running. Start Docker Desktop and try again."
  exit 1
fi

# ── Cosmos emulator ──────────────────────────────────────────────────────────
STATUS=$(docker inspect -f '{{.State.Status}}' "$CONTAINER_NAME" 2>/dev/null || echo "missing")

if [ "$STATUS" = "running" ]; then
  echo "Cosmos emulator is already running."
elif [ "$STATUS" = "exited" ] || [ "$STATUS" = "created" ]; then
  echo "Starting existing Cosmos emulator container..."
  docker start "$CONTAINER_NAME"
else
  echo "Creating and starting Cosmos emulator container..."
  # Use the VNext emulator image which supports linux/arm64 (Apple Silicon)
  ARCH=$(uname -m)
  if [ "$ARCH" = "arm64" ] || [ "$ARCH" = "aarch64" ]; then
    # Run the x86_64 image under Rosetta via Docker Desktop on Apple Silicon
    IMAGE="mcr.microsoft.com/cosmosdb/linux/azure-cosmos-emulator:latest"
    PLATFORM_FLAG="--platform linux/amd64"
  else
    IMAGE="mcr.microsoft.com/cosmosdb/linux/azure-cosmos-emulator:latest"
    PLATFORM_FLAG=""
  fi
  docker run -d --name "$CONTAINER_NAME" \
    $PLATFORM_FLAG \
    -p 8081:8081 \
    -p 10250-10255:10250-10255 \
    -e AZURE_COSMOS_EMULATOR_ENABLE_DATA_PERSISTENCE=true \
    "$IMAGE"
fi

# ── Wait for emulator to be ready ────────────────────────────────────────────
echo "Waiting for Cosmos emulator to be ready (up to ${MAX_WAIT_SECONDS}s)..."
ELAPSED=0
until curl -sk --max-time 2 "$HEALTH_ENDPOINT" > /dev/null 2>&1; do
  if [ "$ELAPSED" -ge "$MAX_WAIT_SECONDS" ]; then
    echo "Error: Cosmos emulator did not become ready within ${MAX_WAIT_SECONDS}s."
    exit 1
  fi
  sleep 2
  ELAPSED=$((ELAPSED + 2))
  echo "  still waiting... (${ELAPSED}s)"
done
echo "Cosmos emulator is ready."

# ── Start the API ────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
echo ""
echo "Starting Kanban API..."
echo "Press Ctrl+C to stop."
echo ""
cd "$SCRIPT_DIR"
dotnet run
