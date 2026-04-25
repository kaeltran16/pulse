# Pulse backend — droplet bootstrap (one-time)

Run as root on a fresh DigitalOcean Ubuntu LTS droplet.

## 1. System user + Node

```bash
adduser --system --group --home /srv/pulse-backend pulse
mkdir -p /srv/pulse-backend
chown pulse:pulse /srv/pulse-backend

# Node LTS via NodeSource:
curl -fsSL https://deb.nodesource.com/setup_lts.x | bash -
apt-get install -y nodejs
node --version
```

## 2. Env file

```bash
install -m 600 -o pulse -g pulse /dev/null /etc/pulse-backend.env
$EDITOR /etc/pulse-backend.env
```

Contents:

```
OPENROUTER_API_KEY=sk-or-...
JWT_SECRET=<openssl rand -hex 32>
PORT=3000
MODEL_ID=anthropic/claude-haiku-4.5
RATE_LIMIT_PER_MIN=60
LOG_LEVEL=info
NODE_ENV=production
```

(Replace `<openssl rand -hex 32>` with the actual hex string before saving.)

## 3. systemd unit

```bash
cp /srv/pulse-backend/deploy/pulse-backend.service /etc/systemd/system/pulse-backend.service
systemctl daemon-reload
systemctl enable pulse-backend
```

(The unit is started by `scripts/deploy.sh` after the first deploy.)

## 4. Firewall

```bash
ufw allow OpenSSH
ufw allow 3000/tcp
ufw enable
```

## 5. Mint and store the JWT

```bash
cd /srv/pulse-backend
sudo -u pulse bash -c 'set -a; . /etc/pulse-backend.env; set +a; npx tsx scripts/issue-token.ts -- --sub kael --scope chat,parse,review'
```

Copy the printed token. It will be pasted into the iOS app (Keychain) and into the local dev `.env` of the Expo app.

## 6. Verify

After running `scripts/deploy.sh` from the dev machine:

```bash
curl -s http://<droplet-host>:3000/health
# → {"ok":true,"version":"0.1.0"}

scripts/smoke.sh
# (run from dev machine — see scripts/smoke.sh)
```

## Rotation

1. Edit `/etc/pulse-backend.env`, replace `JWT_SECRET`.
2. `systemctl restart pulse-backend`.
3. Mint a new token (Step 5).
4. Update phone + dev `.env`.
