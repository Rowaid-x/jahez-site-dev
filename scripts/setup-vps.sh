#!/bin/bash
set -euo pipefail

# =============================================================================
# Jahez VPS Setup Script
# Run as root on a fresh Ubuntu/Debian VPS
# Usage: bash setup-vps.sh
# =============================================================================

echo "========================================="
echo "  Jahez VPS Setup Script"
echo "========================================="

# --- 1. System Update ---
echo "[1/7] Updating system packages..."
apt-get update && apt-get upgrade -y

# --- 2. Install essential packages ---
echo "[2/7] Installing essential packages..."
apt-get install -y \
    apt-transport-https \
    ca-certificates \
    curl \
    gnupg \
    lsb-release \
    ufw \
    fail2ban \
    git \
    htop \
    unzip

# --- 3. Install Docker ---
echo "[3/7] Installing Docker..."
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com | sh
    systemctl enable docker
    systemctl start docker
    echo "Docker installed successfully."
else
    echo "Docker already installed."
fi

# --- 4. Install Docker Compose plugin ---
echo "[4/7] Installing Docker Compose..."
if ! docker compose version &> /dev/null; then
    apt-get install -y docker-compose-plugin
    echo "Docker Compose installed successfully."
else
    echo "Docker Compose already installed."
fi

# --- 5. Configure Firewall (UFW) ---
echo "[5/7] Configuring firewall..."
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS
ufw --force enable
echo "Firewall configured."

# --- 6. Configure fail2ban ---
echo "[6/7] Configuring fail2ban..."
systemctl enable fail2ban
systemctl start fail2ban
echo "fail2ban configured."

# --- 7. Create app directory and deploy user ---
echo "[7/7] Setting up application directory..."
APP_DIR="/opt/jahez"
mkdir -p "$APP_DIR"

# Create a deploy user (optional but recommended)
if ! id "deploy" &>/dev/null; then
    useradd -m -s /bin/bash -G docker deploy
    echo "Created 'deploy' user. Set a password with: passwd deploy"
else
    echo "'deploy' user already exists."
    usermod -aG docker deploy
fi

chown -R deploy:deploy "$APP_DIR"

echo ""
echo "========================================="
echo "  Setup Complete!"
echo "========================================="
echo ""
echo "Next steps:"
echo "  1. Clone your repo:  cd /opt/jahez && git clone https://github.com/Rowaid-x/jahez-site-dev.git ."
echo "  2. Create .env file: cp .env.example .env && nano .env"
echo "  3. Deploy:           docker compose -f docker-compose.prod.yml up -d --build"
echo ""
echo "IMPORTANT: Change your root password!"
echo "  Run: passwd"
echo ""
