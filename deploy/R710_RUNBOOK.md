# SPEEDNeT Console — Production runbook (Dell PowerEdge R710)

A copy-paste guide to run the whole app on the R710, on your network, with the
Monitor working and reachable on your domain. Assumes a fresh **Ubuntu Server
24.04 LTS** install.

> The app auto-runs database migrations and seeds the admin user on first start,
> so the steps below are mostly "install Docker, set `.env`, bring it up."

---

## 0. Server prep (before OS install)

1. **iDRAC** (remote management — do this first, it saves trips to the rack):
   at boot press **F2 → iDRAC Settings**, give iDRAC a static IP + password.
   Then from any browser: `https://<idrac-ip>` → you get remote console + power.
2. **RAID (recommended):** at boot press **Ctrl+R** (PERC) → create a **RAID 1**
   mirror across two disks so the OS survives one disk failure.
3. **Power profile:** BIOS → set performance/OS-control; make sure the box powers
   back on after a power loss (BIOS → *AC Power Recovery → On*).

## 1. Install Ubuntu Server 24.04 LTS

- Download the ISO, write to USB (Rufus/BalenaEtcher) **or** mount it via iDRAC
  *Virtual Media* (no USB needed).
- Install with defaults. Create your admin user. Enable **OpenSSH server** when
  asked so you can manage it remotely.

## 2. Network — give it a fixed IP

The server's address must never change (users + DNS point at it) and it must be
on the network that reaches the `10.x` devices. Set a static lease on your
router/DHCP for its MAC, **or** configure netplan:

```bash
sudo nano /etc/netplan/01-netcfg.yaml
```
```yaml
network:
  version: 2
  ethernets:
    eno1:                       # your NIC name (check: ip a)
      addresses: [10.x.x.x/24]  # a free static IP on the device network
      routes:
        - to: default
          via: 10.x.x.1         # your gateway
      nameservers:
        addresses: [1.1.1.1, 8.8.8.8]
```
```bash
sudo netplan apply
ip a                            # confirm the address
ping -c1 10.161.125.2           # confirm it reaches a device
```

## 3. Install Docker

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
newgrp docker                   # or log out/in
docker version                  # verify
```

## 4. Get the code

```bash
cd /opt
sudo git clone https://github.com/AbdalrhmanNashwan/SpeedNet-SystemManagement.git speednet
sudo chown -R $USER:$USER speednet
cd speednet
```

## 5. Configure secrets

```bash
cp deploy/env.prod.example .env
# generate a real secret key:
echo "SECRET_KEY=$(openssl rand -hex 32)"
nano .env                       # fill EVERY CHANGE_ME:
                                #  - POSTGRES_PASSWORD (and the same in DATABASE_URL)
                                #  - SECRET_KEY (paste the value above)
                                #  - ADMIN_PASSWORD
                                #  - CORS_ORIGINS -> your https URL
```

## 6. Point your domain (before bringing Caddy up)

Edit the domain in the Caddy config, then set DNS:

```bash
nano deploy/Caddyfile           # replace net.speednet.iq with your real domain
```
- DNS: add an **A record** for that domain → your server's **public** IP.
- Open **80** and **443** to the server (router port-forward, or it's already
  public if the server has a public IP).

*(Prefer not to expose it directly? Skip 443/DNS and use a Cloudflare Tunnel or
VPN instead — ask and I'll add those steps.)*

## 7. Launch the stack

```bash
docker compose -f docker-compose.yml -f deploy/docker-compose.prod.yml up -d --build
docker compose -f docker-compose.yml -f deploy/docker-compose.prod.yml logs -f backend
```
Watch for `Application startup complete`. Caddy fetches HTTPS certs automatically
on the first request to your domain.

## 8. Load your data

Two ways — pick one:

**A. Restore from a backup (easiest, via the app):**
open `https://<your-domain>/console` → log in as admin → **Backups** →
**Restore from backup** → upload one of your `backup_*.zip` files.

**B. Import the raw sheet export (advanced):** copy your `data/app_data.json`
to the server, then:
```bash
mkdir -p data && cp /path/to/app_data.json data/
docker compose -f docker-compose.yml -f deploy/docker-compose.prod.yml \
  run --rm -v "$PWD/data:/data" backend python scripts/import_sheet.py
```

## 9. Verify

- `https://<your-domain>/` → public site · `/console` → log in
- **Monitor** page fills with live up/down (pinged directly by the server — no
  agent). If some show down, confirm the server routes to **every** subnet
  (`ping` a device in each `10.x` range).

## 10. Firewall (optional but recommended)

```bash
sudo ufw allow 22/tcp          # SSH
sudo ufw allow 80,443/tcp      # web
sudo ufw enable
```

## 11. Backups

Automatic CSV backups are already on (`BACKUP_ENABLED=true`) and land in
`./backups`. For the nightly `pg_dump` too, add cron (optional):
```bash
( crontab -l 2>/dev/null; echo "0 3 * * * /opt/speednet/deploy/backup.sh >> /var/log/speednet-backup.log 2>&1" ) | crontab -
```
**Copy `./backups` off the server periodically** (another machine / cloud drive).

## 12. Updating later

```bash
cd /opt/speednet && git pull
docker compose -f docker-compose.yml -f deploy/docker-compose.prod.yml up -d --build
```
Migrations run automatically on restart.

---

## Once this is live, retire the temporary bits

- **Stop the monitor agent** on your PC (no longer needed — the server pings
  directly): delete
  `…\Startup\SpeedNetMonitorAgent.vbs` and run `Stop-Process -Name pythonw`.
- The **Hugging Face Space** and **Neon DB** were just for testing — you can
  delete them, and rotate/revoke any tokens shared during setup.

## Security checklist before going public
- [ ] All `CHANGE_ME` values replaced; admin password is strong
- [ ] HTTPS working (padlock on your domain)
- [ ] Consider a **Cloudflare Access** gate or **VPN** — this app holds live
      device credentials; internal-admin tools shouldn't be wide open
- [ ] Backups are running **and** copied off the server
