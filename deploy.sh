#!/usr/bin/env bash
# Deploy Raqib (Compliance Intelligence Platform) as a Docker container.
# Run from the project root. Requires Docker and Docker Compose.

set -e
cd "$(dirname "$0")"

if [ ! -f .env ]; then
  echo "Creating .env from .env.example (edit .env to add API keys if needed)."
  cp .env.example .env
fi

echo "Building image..."
docker compose build

echo "Starting container..."
docker compose up -d

echo ""
echo "Deployment complete."
echo "  App:    http://localhost:3001"
echo "  Health: http://localhost:3001/api/health"
echo ""
echo "To access from another machine, use this host's IP and port 3001 (e.g. http://<static-ip>:3001)."
echo "Logs: docker compose logs -f"
echo "Stop:  docker compose down"
