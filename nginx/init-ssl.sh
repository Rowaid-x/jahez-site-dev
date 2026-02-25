#!/bin/bash
# SSL Certificate Setup Script for Jahez
# Run this ONCE on the server to obtain initial SSL certificates.
#
# IMPORTANT: Before running this script:
# 1. Make sure DNS for dev.jahez-qa.site and jahez-qa.site points to your server IP
# 2. Temporarily comment out the HTTPS server blocks in nginx.conf
#    (nginx won't start if the cert files don't exist yet)
#
# Usage: bash nginx/init-ssl.sh

set -e

echo "=== Jahez SSL Certificate Setup ==="
echo ""

# Step 1: Create a temporary nginx config that only serves HTTP + ACME challenge
echo "[1/4] Creating temporary nginx config for certificate challenge..."

cat > /tmp/nginx-temp.conf << 'EOF'
server {
    listen 80;
    server_name dev.jahez-qa.site;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 200 'SSL setup in progress...';
        add_header Content-Type text/plain;
    }
}

server {
    listen 80;
    server_name jahez-qa.site www.jahez-qa.site;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 200 'SSL setup in progress...';
        add_header Content-Type text/plain;
    }
}
EOF

# Backup current nginx config
cp nginx/nginx.conf nginx/nginx.conf.bak

# Use temp config
cp /tmp/nginx-temp.conf nginx/nginx.conf

echo "[2/4] Starting nginx with temporary config..."
docker compose up -d nginx

# Wait for nginx to start
sleep 5

# Step 2: Obtain certificates
echo "[3/4] Requesting SSL certificates from Let's Encrypt..."

# Certificate for dev.jahez-qa.site
docker compose run --rm certbot certonly \
    --webroot \
    --webroot-path=/var/www/certbot \
    --email admin@jahez-qa.site \
    --agree-tos \
    --no-eff-email \
    -d dev.jahez-qa.site

# Certificate for jahez-qa.site
docker compose run --rm certbot certonly \
    --webroot \
    --webroot-path=/var/www/certbot \
    --email admin@jahez-qa.site \
    --agree-tos \
    --no-eff-email \
    -d jahez-qa.site \
    -d www.jahez-qa.site

# Step 3: Restore the full nginx config with SSL
echo "[4/4] Restoring full nginx config with SSL..."
cp nginx/nginx.conf.bak nginx/nginx.conf
rm nginx/nginx.conf.bak

# Restart nginx with SSL
docker compose restart nginx

echo ""
echo "=== SSL Setup Complete ==="
echo "Your sites should now be accessible via HTTPS:"
echo "  https://dev.jahez-qa.site"
echo "  https://jahez-qa.site"
echo ""
echo "Certificates will auto-renew via the certbot container."
