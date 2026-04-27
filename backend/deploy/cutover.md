# SP5a cutover — `/srv/pulse-backend` → `/opt/pulse`

Run as root via SSH against the droplet (`root@178.128.81.14`). All steps idempotent except step 6, which is the actual cutover.

## Pre-flight

- [ ] Confirm Docker installed: `docker --version` (need v24+ for compose v2 syntax)
  - If absent: `apt-get update && apt-get install -y docker.io docker-compose-plugin`
- [ ] Confirm outbound to ghcr.io: `curl -sI https://ghcr.io/v2/`
- [ ] Note current `/etc/pulse-backend.env` contents:
  ```
  cat /etc/pulse-backend.env
  ```
  Save the values somewhere local — these get copied to `/opt/pulse/.env` in step 3.

## 1. Create user + directories

```
useradd -u 1500 -r -s /usr/sbin/nologin pulse-backend 2>/dev/null || true
mkdir -p /opt/pulse/data/backups
chown -R pulse-backend:pulse-backend /opt/pulse/data
chmod 0700 /opt/pulse/data
chmod 0700 /opt/pulse/data/backups
```

## 2. Configure GHCR pull credentials

Generate a fine-grained PAT on GitHub:
- Scope: `read:packages`
- Expiration: 1 year
- Save the token; you'll never see it again

On the droplet:
```
docker login ghcr.io -u kaeltran16 --password-stdin <<< 'ghp_xxxxxxxxxxxx'
```

This writes credentials to `/root/.docker/config.json` (root pulls images on behalf of compose).

## 3. Move env file

```
cp /etc/pulse-backend.env /opt/pulse/.env
chmod 0600 /opt/pulse/.env
echo 'IMAGE_TAG=latest' >> /opt/pulse/.env
```

(`IMAGE_TAG=latest` is a placeholder; real deploys overwrite this with the git SHA via the GH Action.)

## 4. Drop compose.yml + systemd units onto droplet

From your local checkout:

```
scp backend/deploy/compose.yml root@178.128.81.14:/opt/pulse/compose.yml
scp backend/deploy/systemd/pulse-stack.service root@178.128.81.14:/etc/systemd/system/
scp backend/deploy/systemd/pulse-backup.service root@178.128.81.14:/etc/systemd/system/
scp backend/deploy/systemd/pulse-backup.timer root@178.128.81.14:/etc/systemd/system/
ssh root@178.128.81.14 'systemctl daemon-reload'
```

## 5. Manually pull a known-good image (tagged `:latest`)

The first GH Action deploy hasn't run yet, so `:latest` doesn't exist on GHCR. Choose ONE of:

- **Option A (recommended): Run the GH Action manually first via `workflow_dispatch`** (after Task 18 lands), then come back to step 6.
- **Option B: Build + push manually from your local checkout:**
  ```
  docker build -f backend/Dockerfile -t ghcr.io/kaeltran16/pulse-backend:latest .
  docker push ghcr.io/kaeltran16/pulse-backend:latest
  ```

## 6. Cut over (the actual switch)

⚠️ This stops SP2's running backend briefly. ~30 seconds of downtime.

```
systemctl stop pulse-backend.service
systemctl disable pulse-backend.service
rm /etc/systemd/system/pulse-backend.service
systemctl daemon-reload
systemctl enable --now pulse-stack.service
systemctl enable --now pulse-backup.timer
```

## 7. Verify

```
curl -fsS http://localhost:3000/health        # expect 200 with body
docker compose -f /opt/pulse/compose.yml ps   # expect backend "running"
ls -la /opt/pulse/data/pulse.db               # expect 1500:1500 ownership
sqlite3 /opt/pulse/data/pulse.db '.tables'    # expect 4 tables incl __drizzle_migrations
systemctl status pulse-backup.timer           # expect "active (waiting)"
```

## 8. Trigger first backup manually (smoke test)

```
systemctl start pulse-backup.service
ls /opt/pulse/data/backups/                   # expect pulse-YYYY-MM-DD.db
```

## 9. Clean up old artifacts (do this LAST — only after verified happy)

```
rm -rf /srv/pulse-backend
rm /etc/pulse-backend.env
```

## Rollback (if anything in 1–7 fails)

The old artifacts aren't removed until step 9. Recovery:

```
systemctl stop pulse-stack.service
systemctl disable pulse-stack.service
# pulse-backend.service unit file is gone after step 6 — restore from git:
scp deploy/pulse-backend.service root@178.128.81.14:/etc/systemd/system/
systemctl daemon-reload
systemctl enable --now pulse-backend.service
```

(Then debug the failure and try again later.)
