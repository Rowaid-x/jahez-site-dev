# Jahez Deployment Guide

## Server Details

- **IP:** `72.62.74.227`
- **OS:** Linux (Ubuntu/Debian)
- **Stack:** Docker, Docker Compose, Nginx, PostgreSQL, Django, React (Vite)

---

## 1. Initial VPS Setup

SSH into your server:

```bash
ssh root@72.62.74.227
```

Download and run the setup script:

```bash
curl -fsSL https://raw.githubusercontent.com/Rowaid-x/jahez-site-dev/main/scripts/setup-vps.sh | bash
```

Or manually copy and run:

```bash
# Update system
apt-get update && apt-get upgrade -y

# Install Docker
curl -fsSL https://get.docker.com | sh
systemctl enable docker && systemctl start docker

# Install Docker Compose plugin
apt-get install -y docker-compose-plugin

# Configure firewall
ufw allow 22/tcp && ufw allow 80/tcp && ufw allow 443/tcp
ufw --force enable

# Install fail2ban
apt-get install -y fail2ban
systemctl enable fail2ban && systemctl start fail2ban
```

---

## 2. Clone & Configure

```bash
# Create app directory
mkdir -p /opt/jahez
cd /opt/jahez

# Clone the repository
git clone https://github.com/Rowaid-x/jahez-site-dev.git .

# Create environment file
cp .env.example .env
nano .env
```

### Generate a Django Secret Key

```bash
python3 -c "import secrets; print(secrets.token_urlsafe(50))"
```

### Required `.env` values

```env
DJANGO_SECRET_KEY=<generated-secret-key>
DJANGO_DEBUG=False
DJANGO_ALLOWED_HOSTS=dev.jahez-qa.site,localhost,127.0.0.1
CORS_ALLOWED_ORIGINS=http://dev.jahez-qa.site,https://dev.jahez-qa.site
DB_NAME=jahez_db
DB_USER=jahez_user
DB_PASSWORD=<strong-database-password>
DB_HOST=db
DB_PORT=5432
```

---

## 3. Deploy

```bash
cd /opt/jahez
docker compose -f docker-compose.prod.yml up -d --build
```

### Verify deployment

```bash
# Check all containers are running
docker compose -f docker-compose.prod.yml ps

# Check logs
docker compose -f docker-compose.prod.yml logs -f

# Check specific service
docker compose -f docker-compose.prod.yml logs web
docker compose -f docker-compose.prod.yml logs nginx
```

If your DNS is configured:

- `http(s)://dev.jahez-qa.site` serves the app.
- `http(s)://jahez-qa.site` serves a simple landing page.

---

## 4. CI/CD (GitHub Actions)

The project includes a GitHub Actions workflow at `.github/workflows/deploy.yml` that auto-deploys on push to `main`.

### Setup GitHub Secrets

Go to your repo **Settings > Secrets and variables > Actions** and add:

| Secret         | Value              |
|----------------|--------------------|
| `VPS_HOST`     | `72.62.74.227`     |
| `VPS_USER`     | `root`             |
| `VPS_PASSWORD` | Your VPS password  |

> **Recommended:** Use SSH keys instead of password. See section below.

### Setup SSH Key Authentication (Recommended)

On your local machine:

```bash
ssh-keygen -t ed25519 -C "deploy@jahez" -f ~/.ssh/jahez_deploy
```

Copy the public key to the VPS:

```bash
ssh-copy-id -i ~/.ssh/jahez_deploy.pub root@72.62.74.227
```

Then update the GitHub Actions workflow to use `key` instead of `password`:

```yaml
with:
  host: ${{ secrets.VPS_HOST }}
  username: ${{ secrets.VPS_USER }}
  key: ${{ secrets.VPS_SSH_KEY }}
```

And add the **private key** content as `VPS_SSH_KEY` in GitHub Secrets.

---

## 5. Common Operations

### Restart all services

```bash
cd /opt/jahez
docker compose -f docker-compose.prod.yml restart
```

### Rebuild and restart a single service

```bash
docker compose -f docker-compose.prod.yml up -d --build web
```

### View real-time logs

```bash
docker compose -f docker-compose.prod.yml logs -f --tail=100
```

### Access Django shell

```bash
docker compose -f docker-compose.prod.yml exec web python manage.py shell
```

### Create Django superuser

```bash
docker compose -f docker-compose.prod.yml exec web python manage.py createsuperuser
```

### Database backup

```bash
docker compose -f docker-compose.prod.yml exec db pg_dump -U jahez_user jahez_db > backup_$(date +%Y%m%d).sql
```

### Database restore

```bash
cat backup.sql | docker compose -f docker-compose.prod.yml exec -T db psql -U jahez_user jahez_db
```

### Full reset (WARNING: destroys data)

```bash
cd /opt/jahez
docker compose -f docker-compose.prod.yml down -v
docker compose -f docker-compose.prod.yml up -d --build
```

---

## 6. Security Checklist

- [ ] Change default root password: `passwd`
- [ ] Set a strong `DB_PASSWORD` in `.env`
- [ ] Generate a unique `DJANGO_SECRET_KEY`
- [ ] Ensure `DJANGO_DEBUG=False`
- [ ] Set up SSH key authentication and disable password login
- [ ] Configure UFW firewall (done by setup script)
- [ ] Enable fail2ban (done by setup script)
- [ ] Set up SSL/TLS with Let's Encrypt (if using a domain)

---

## 7. Domains (Subdomain App + Root Landing)

Point these DNS records to `72.62.74.227`:

- `A` record: `dev.jahez-qa.site` -> `72.62.74.227`
- `A` record: `jahez-qa.site` -> `72.62.74.227`
- `A` record: `www.jahez-qa.site` -> `72.62.74.227`

The Nginx config is set up so:

- `dev.jahez-qa.site` serves the full app (React + `/api`, `/admin`, `/static`).
- `jahez-qa.site` serves a static landing page from `nginx/landing/index.html`.

### Enable HTTPS (recommended)

```bash
apt-get install -y certbot python3-certbot-nginx
certbot --nginx -d dev.jahez-qa.site -d jahez-qa.site -d www.jahez-qa.site
```

Then rebuild/restart:

```bash
docker compose -f docker-compose.prod.yml up -d --build
```
