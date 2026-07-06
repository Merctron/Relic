# Relic

Relic is personal automation infrastructure for nix systems. It provisions an EC2 host via AWS CDK and deploys private configuration, assets, cron jobs, and persistent processes to it.

## Features

1. Creates a `t3.micro` Amazon Linux 2023 EC2 instance with Node 20 pre-installed.
2. Deploys private `config/` and `assets/` to the host (gitignored — never committed).
3. Installs cron jobs and runs a startup script on every deploy.

## Prerequisites

- AWS CLI configured (`aws configure` or a named profile)
- Node.js + npm
- `rsync` (installed on macOS by default)

## Quick Start

```bash
# 1. Install CDK dependencies
cd cdk && npm install && cd ..

# 2. Full deploy: provision infra, fetch SSH key, sync files, run setup
./scripts/deploy

# Using a non-default AWS profile:
./scripts/deploy my-profile

# 3. Open a shell on the instance
./scripts/ssh
```

On a fresh run `scripts/deploy` handles everything end-to-end:
- Deploys (or updates) the CDK stack
- Fetches `relic.pem` from SSM if it is not present locally
- Waits for SSH to become available
- Syncs `config/` and `assets/` to the host
- Runs `scripts/setup` on the host to install cron jobs and start persistent processes

## Directory Layout

```
Relic/
├── cdk/                    # AWS CDK stack (TypeScript)
├── scripts/
│   ├── deploy              # End-to-end deploy (run this)
│   ├── get-key             # Fetch relic.pem from SSM
│   ├── setup               # Runs ON the host post-sync: cron + startup
│   └── ssh                 # Open a shell on the instance
├── config/                 # Gitignored — private config files
│   ├── crontab             # Installed verbatim via `crontab` on the host
│   └── start.sh            # Startup script for persistent processes
├── assets/                 # Gitignored — binaries, data, secrets, etc.
└── relic.pem               # Gitignored — EC2 SSH private key
```

## Placing Assets

Files in `config/` and `assets/` are synced to the host at every deploy and are **never committed** to git. Any files you add to these directories are automatically excluded by `.gitignore`.

### `config/`

Synced to `/home/ec2-user/.relic/config/` on the host.

| File | Purpose |
|------|---------|
| `config/crontab` | Installed as the `ec2-user` crontab verbatim. Each line is a standard cron entry, e.g. `0 9 * * * /home/ec2-user/.relic/assets/my-job.sh` |
| `config/start.sh` | Shell script executed on every deploy after the sync. Use it to start or restart persistent processes (e.g. via `pm2`, `nohup`, or `systemd --user`). |
| `config/*.env` | Environment files your scripts can `source`. |

### `assets/`

Synced to `/home/ec2-user/.relic/assets/` on the host.

Put anything here that your automations need at runtime but that must not be public:

- Executable scripts and binaries
- API keys and credential files
- Databases or seed data
- Any other private files

## Re-deploying

Re-running `./scripts/deploy` is safe and idempotent:
- The CDK stack will not recreate the EC2 instance unless an immutable property changed.
- Config and assets are synced with `--delete`, so removals are reflected on the host.
- `scripts/setup` re-installs the crontab and re-runs `start.sh` on every deploy.

## Fetching the SSH Key Manually

If you need `relic.pem` without a full deploy:

```bash
./scripts/get-key
# or
./scripts/get-key my-profile
```
