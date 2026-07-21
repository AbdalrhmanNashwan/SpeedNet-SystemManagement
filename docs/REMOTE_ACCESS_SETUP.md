# Remote Access Setup — run AFTER the console is deployed

Paste the prompt below into the Claude Code instance running **on the server PC**,
but only **after** the SPEEDNeT Console is deployed and running.

## One manual step you must do first (Claude can't do this — it needs interactive login)

Install Tailscale and sign in on **all three machines** (server + both laptops),
using the **same Tailscale account / tailnet**:

1. Download: https://tailscale.com/download (Windows).
2. Run the installer, sign in (Google/GitHub/email).
3. On the server, disable key expiry in the Tailscale admin console
   (Machines → server → "Disable key expiry") so it stays reachable unattended.

Then paste everything between the lines below into server-side Claude Code.

---

```
You are configuring REMOTE ADMIN ACCESS on this Windows server PC. The SPEEDNeT
Console is already deployed and running on this machine, and this box has a
PUBLIC IP (it is an ISP server). Tailscale is ALREADY installed and logged in on
this server and on my laptops — do not install or configure Tailscale yourself.

Goal: let me administer this server from my laptop over the PRIVATE Tailscale
network only — both a terminal (SSH) and the full graphical desktop (RDP) —
without exposing SSH or RDP to the public internet. Work step by step, show me
each command, run them as Administrator, and STOP and ask before anything you're
unsure about.

## Step 1 — Confirm Tailscale
- Run `tailscale ip -4` and `tailscale status`. Report the server's 100.x.y.z
  address — I'll use it from my laptop. If Tailscale is not up, STOP and tell me.

## Step 2 — Enable OpenSSH server (terminal access)
- Install and start the built-in OpenSSH Server:
    Add-WindowsCapability -Online -Name OpenSSH.Server~~~~0.0.1.0
    Set-Service -Name sshd -StartupType Automatic
    Start-Service sshd
- Confirm the sshd service is running.

## Step 3 — Enable Remote Desktop (graphical desktop)
- Turn on RDP:
    Set-ItemProperty -Path 'HKLM:\System\CurrentControlSet\Control\Terminal Server' -Name fDenyTSConnections -Value 0
- Confirm it's enabled.

## Step 4 — LOCK BOTH TO TAILSCALE ONLY (critical — public IP box)
This is the most important step. SSH (22) and RDP (3389) must be reachable ONLY
from the Tailscale network, never from the public internet.
- Do NOT port-forward 22 or 3389 on the router / public IP (I handle the router;
  just remind me).
- Create Windows Firewall rules that ALLOW inbound TCP 22 and 3389 ONLY from the
  Tailscale CGNAT range 100.64.0.0/10, and ensure no rule allows them from Any:
    New-NetFirewallRule -DisplayName "SSH from Tailscale" -Direction Inbound -Action Allow -Protocol TCP -LocalPort 22 -RemoteAddress 100.64.0.0/10
    New-NetFirewallRule -DisplayName "RDP from Tailscale" -Direction Inbound -Action Allow -Protocol TCP -LocalPort 3389 -RemoteAddress 100.64.0.0/10
- Check for and disable/remove any pre-existing broad inbound rules that allow
  22 or 3389 from Any. Show me what you find before changing built-in rules.
- Confirm that ONLY 80 and 443 (the console) are intended to be public, and that
  8000 and 5432 are NOT publicly reachable.

## Step 5 — Verify and hand me a cheat sheet
- Confirm sshd running, RDP enabled, and both firewall rules present and scoped
  to 100.64.0.0/10.
- Print a short cheat sheet with the exact commands I run FROM MY LAPTOP:
    SSH:  ssh <MyWindowsUser>@<server-tailscale-ip>
    VS Code: Remote-SSH → <MyWindowsUser>@<server-tailscale-ip>
    RDP:  mstsc → <server-tailscale-ip>
  Fill in my actual Windows username and the server's Tailscale IP.
- Remind me to set a STRONG password on my Windows account (defense in depth),
  and optionally to add an SSH public key so I don't type a password each time.

Start at Step 1.
```

---

## After it runs — connect from your laptop

- **Terminal:** `ssh YourWindowsUser@100.x.y.z`
- **VS Code (work as if local):** install "Remote - SSH" extension → Connect to Host → `YourWindowsUser@100.x.y.z`
- **Full desktop:** `mstsc` → `100.x.y.z`

You can even run Claude Code on the server through the SSH/VS Code terminal.
