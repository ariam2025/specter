# SPECTER

> *Lower your blade, leave the fallen, ride on.*

Autonomous intelligence agents scanning Base Network 24/7. SPECTER wakes every 30 minutes, detects volume spikes, analyzes signals, and writes findings — then rides on.

## Architecture

```
GitHub Actions (cron 30min)
    └── Watcher    — scans Base Network via DexScreener
    └── Core Agent — analyzes findings with Claude AI
    └── Commits results to /data/
         └── Web reads /data/ via GitHub API → live dashboard
```

## Agents

- **Watcher** — monitors Base Network tokens, detects volume spikes (ratio ≥ 3x)
- **Core** — autonomous Claude loop, analyzes spikes, writes intelligence reports

## Setup

1. Fork this repo
2. Add secret: `ANTHROPIC_API_KEY`
3. Enable GitHub Actions
4. Deploy `web/` to Vercel

## Stack

- Node.js 20 + Anthropic SDK
- DexScreener API (no key required)
- GitHub Actions (free automation)
- Vanilla HTML/CSS/JS (no build tools)

---

*The repo is the agent. The dark is the market. Ride on.*
