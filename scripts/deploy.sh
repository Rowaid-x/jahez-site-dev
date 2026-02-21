#!/bin/bash
set -euo pipefail

# =============================================================================
# Jahez Deploy Script
# Run on the VPS to deploy or update the application
# Usage: bash deploy.sh
# =============================================================================

APP_DIR="/opt/jahez"
COMPOSE_FILE="docker-compose.prod.yml"

cd "$APP_DIR"

echo "Pulling latest code..."
git pull origin main

echo "Building and starting containers..."
docker compose -f "$COMPOSE_FILE" up -d --build --remove-orphans

echo "Cleaning up old images..."
docker image prune -f

echo ""
echo "Deployment complete! Checking container status..."
docker compose -f "$COMPOSE_FILE" ps
