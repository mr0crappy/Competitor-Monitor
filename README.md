# Competitor Monitor

Monitor competitor changelogs / update feeds, detect what’s new, summarize with an LLM (Groq), and notify a Slack channel on a schedule (GitHub Actions, cron, or the included Flask web dashboard). Lightweight, extensible, and free‑friendly.

> **Note:** Notion export is currently disabled in code (by user choice). Slack is the primary notification channel.

---

## Overview

**Competitor Monitor** automatically:

* **Fetches** competitor changelog / release / update pages (HTML, RSS, JSON APIs — basic HTML scraping included; extensible parsers coming).
* **Snapshots & diffs** the latest fetch vs the prior run to detect *new* lines.
* **Summarizes** the new material using **Groq LLM** (fallback bullet summary if no key or quota).
* **Posts** a neatly formatted message to **Slack**.
* **Serves** an optional **Flask web dashboard** to view competitors, run manual checks, and inspect change history.
* **Schedules** automatically via **GitHub Actions** (cron) or local cron / systemd timers.

If you only set a Slack webhook, you already get basic bullet notifications. Add a Groq key for nicer LLM summaries.

---

## How It Works

1. **Fetch** raw content from each competitor URL (configurable per competitor).
2. **Normalize** (strip HTML → lines; RSS & JSON support planned; see roadmap).
3. **Snapshot** lines to `data/<competitor>.json`.
4. **Diff** current vs previous snapshot → list of *new* lines.
5. **Aggregate & summarize** across competitors (Groq → natural language; fallback bullet counts).
6. **Notify Slack** (plain text message today; Block Kit coming).
7. Optional: **Persist snapshots in CI** (artifact or commit) so diffs survive runs.
8. Optional: **Expose REST API** & dashboard via `server.py`.

---

## Quick Start (TL;DR)

```bash
# clone & enter
git clone https://github.com/YOUR_USERNAME/Competitor-Monitor.git
cd Competitor-Monitor

# (optional) create virtual env
python -m venv .venv
source .venv/bin/activate  # macOS / Linux
# .\.venv\Scripts\activate  # Windows PowerShell

# install deps
pip install -r requirements.txt

# set env vars (replace values)
export SLACK_WEBHOOK="https://hooks.slack.com/services/..."
export GROQ_API_KEY="gsk_xxx"   # optional but recommended

# run once
python main.py
```

If successful, you’ll see console diagnostics and (if changes detected or ALWAYS\_NOTIFY=True) a Slack message.

---

## Project Structure

```
Competitor-Monitor/
├── config.py              # Competitor list & settings (env passthrough)
├── scraper.py             # Fetch & HTML→text (with SSL fallback)
├── diff_detector.py       # Load/save per‑competitor snapshots; compute diffs
├── summarizer.py          # Groq LLM summarizer + safe fallback
├── reporter.py            # Slack notification helper
├── main.py                # Orchestrates a full run (CLI / cron / Actions)
├── server.py              # Optional Flask API + dashboard & manual trigger
├── templates/             # index.html (served by Flask)
├── static/
│   ├── css/style.css      # Dashboard styles
│   └── js/app.js          # Dashboard logic (talks to /api/*)
├── data/                  # Snapshot storage (*.json) (gitignored)
├── requirements.txt       # Python deps
└── README.md              # You are here
```

> **CI note:** `data/` is ephemeral in GitHub Actions unless persisted; see [Data Persistence & Snapshots](#data-persistence--snapshots).

---

## Installation

### 1. Clone

```bash
git clone https://github.com/YOUR_USERNAME/Competitor-Monitor.git
cd Competitor-Monitor
```

### 2. Virtual Environment (recommended)

```bash
python -m venv .venv
source .venv/bin/activate  # macOS/Linux
# .\.venv\Scripts\activate  # Windows
```

### 3. Install Deps

```bash
pip install -r requirements.txt
```

If pip errors:

```bash
python -m pip install --upgrade pip setuptools wheel
pip install -r requirements.txt
```

---

## Configuration

You configure via **environment variables** and **`config.py`**.

### Environment Variables

| Variable                      | Required         | Description                                                    |
| ----------------------------- | ---------------- | -------------------------------------------------------------- |
| `SLACK_WEBHOOK`               | **Yes**          | Incoming Webhook URL to post updates.                          |
| `GROQ_API_KEY`                | No (recommended) | Enables Groq LLM summaries; fallback bullet summary otherwise. |
| `SUMMARIZER_MAX_ITEMS`        | No               | Per‑competitor cap of lines passed to LLM.                     |
| `SUMMARIZER_MAX_PROMPT_CHARS` | No               | Global prompt length safety cap.                               |

**PowerShell:**

```powershell
$env:SLACK_WEBHOOK="https://hooks.slack.com/services/..."
$env:GROQ_API_KEY="gsk_your_key"
```

**macOS / Linux:**

```bash
export SLACK_WEBHOOK="https://hooks.slack.com/services/..."
export GROQ_API_KEY="gsk_your_key"
```

---

### Editing `config.py`

Minimal example:

```python
import os

COMPETITORS = [
    {
        "name": "GitHub",
        "changelog": "https://github.blog/changelog/",
        # future: parser="github", allow_insecure=False
    },
]

SLACK_WEBHOOK = os.getenv("SLACK_WEBHOOK")
GROQ_API_KEY  = os.getenv("GROQ_API_KEY")

# Behavior flags
ALWAYS_NOTIFY = True              # send Slack message even if no changes (great for testing)
MAX_LINES_PER_COMPETITOR = 50     # trim noise before diffing
```

Add more competitors by appending dicts (see below).

---

## Run Locally

Run a full monitor cycle and send a Slack message:

```bash
python main.py
```

Expected console output (typical):

```
[DEBUG] Starting Competitor Monitor (Slack + Groq).
[DEBUG] Checking competitor: GitHub
[INFO] 3 new line(s) for GitHub.
[DEBUG] all_changes = {'GitHub': [...]}
[DEBUG] Summary text:
  Weekly Competitor Monitor Summary ...
[INFO] Message sent to Slack.
```

Check your Slack channel.

---

## Run Flask Dashboard

Launch the optional web UI + REST API:

```bash
python server.py
```

Open: [http://127.0.0.1:5000](http://127.0.0.1:5000)

From the dashboard you can:

* See competitor list & status
* Trigger **Run Monitor** (POST /api/run-monitor)
* View recent change history (GET /api/changes)
* See stats (/api/dashboard)

### Flask Environment Ports

On Railway (or other PaaS), the platform typically sets `PORT`. The server uses `os.getenv("PORT", 5000)` so it works locally and in hosted environments.

---

## Test Integrations

### Test Slack

```python
# test_slack.py
import os, requests
url = os.getenv("SLACK_WEBHOOK")
print("Slack configured?", bool(url))
if url:
    r = requests.post(url, json={"text": "Test message from Competitor Monitor."})
    print("HTTP", r.status_code, r.text)
```

```bash
python test_slack.py
```

### Test Groq Summarization

```python
# test_groq.py
import os
from groq import Groq

api_key = os.getenv("GROQ_API_KEY")
print("Groq key?", bool(api_key))
if not api_key:
    raise SystemExit("Set GROQ_API_KEY first")

client = Groq(api_key=api_key)
resp = client.chat.completions.create(
    model="llama-3.1-8b-instant",
    messages=[
        {"role": "system", "content": "Summarize updates"},
        {"role": "user", "content": "GitHub launched Copilot for educators."}
    ],
    max_tokens=60,
)
print(resp.choices[0].message.content)
```

---

## Scheduled Automation (GitHub Actions)

Run the monitor **every Monday at 09:00 UTC** (change as needed). *09:00 UTC ≈ 14:30 IST (Asia/Kolkata).* To run at 09:00 IST use cron `30 3 * * 1`.

Create `.github/workflows/weekly.yml`:

```yaml
name: Weekly Competitor Report

on:
  schedule:
    - cron: '0 9 * * 1'   # Mondays 09:00 UTC
  workflow_dispatch:       # allow manual runs

jobs:
  run-monitor:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.11'

      - name: Install dependencies
        run: pip install -r requirements.txt

      - name: Run monitor
        env:
          SLACK_WEBHOOK: ${{ secrets.SLACK_WEBHOOK }}
          GROQ_API_KEY:  ${{ secrets.GROQ_API_KEY }}
        run: python main.py
```

### Add Secrets in GitHub

Repo → **Settings** → **Secrets and variables** → **Actions** → *New repository secret*:

* `SLACK_WEBHOOK`
* `GROQ_API_KEY`

Trigger a manual run: Repo → **Actions** → *Weekly Competitor Report* → *Run workflow*.

---

## Slack Message Format

Current implementation: plain text block.

Example:

```
Weekly Competitor Monitor Summary
--------------------------------
GitHub: 3 change(s)
  - Copilot now free for educators
  - Improved accessibility labels
  - Security advisory UI refresh
```

You can enhance formatting in `reporter.py` using Slack Block Kit (emoji for change types: 🆕 feature, 💰 pricing, ⚠️ security, 📣 announcement, 🐛 fix).

---

## Data Persistence & Snapshots

We store previously fetched content per competitor to detect *new* lines only.

* Snapshots live under `data/<competitor>.json`.
* First run seeds snapshot (no alert unless ALWAYS\_NOTIFY=True).
* Subsequent runs diff → alerts only for new lines.

### CI Persistence Strategies

| Strategy        | Effort | Noise | Notes                                                        |
| --------------- | ------ | ----- | ------------------------------------------------------------ |
| **None**        | Zero   | High  | Every run behaves like first; all lines considered new.      |
| **Artifact**    | Low    | Low   | Upload `data/` artifact at end; download at start.           |
| **Commit Back** | Med    | Low   | Workflow commits updated `data/` to branch (`monitor-data`). |

Let me know if you want ready‑to‑paste workflow steps for artifact persistence.

---

## Extending: Adding Competitors

Add entries in `config.py`:

```python
COMPETITORS = [
    {"name": "GitHub",  "changelog": "https://github.blog/changelog/"},
    {"name": "FooApp",  "changelog": "https://fooapp.com/updates"},
]
```

### Example Competitor Catalog (copy/paste)

```python
COMPETITORS = [
    {
        "name": "GitHub",
        "changelog": "https://github.blog/changelog/",
        "description": "Official GitHub product updates and feature releases."
    },
    {
        "name": "GitLab",
        "changelog": "https://about.gitlab.com/releases/",
        "description": "GitLab release notes."
    },
    {
        "name": "Notion",
        "changelog": "https://www.notion.so/releases",
        "description": "Notion product updates."
    },
    {
        "name": "Slack",
        "changelog": "https://slack.com/release-notes/windows",
        "description": "Slack desktop release notes (Windows feed; pick platform)."
    },
    {
        "name": "Vercel",
        "changelog": "https://vercel.com/changelog",
        "description": "Vercel platform updates."
    },
    {
        "name": "OpenAI",
        "changelog": "https://openai.com/research",
        "description": "Research & product announcements from OpenAI."
    },
]
```

> You can also add competitors at runtime via the dashboard (`/api/competitors`, POST).

---

## Live Dashboard

The optional dashboard (served by `server.py`) lets you interact with the monitor without touching the CLI.

### Start

```bash
python server.py
```

### Open

[http://localhost:5000](http://localhost:5000)

### Manual Monitor Run

Click **Run Monitor** in the header, or call:

```bash
curl -X POST http://localhost:5000/api/run-monitor
```

### API Endpoints

| Method | Path                              | Description                                          |
| ------ | --------------------------------- | ---------------------------------------------------- |
| GET    | `/api/dashboard`                  | Summary stats (competitors, recent changes, status). |
| GET    | `/api/competitors`                | List competitors currently loaded.                   |
| POST   | `/api/competitors`                | Add competitor `{name, changelog, description?}`.    |
| PUT    | `/api/competitors/<id>`           | Update competitor.                                   |
| DELETE | `/api/competitors/<id>`           | Remove competitor.                                   |
| GET    | `/api/changes?competitor=&days=7` | Recent changes (filterable).                         |
| POST   | `/api/run-monitor`                | Trigger a monitoring run (returns detected changes). |
| GET    | `/api/status`                     | Task status counters.                                |
| GET    | `/api/analytics`                  | Lightweight chart data for dashboard.                |
| GET    | `/health`                         | Healthcheck (returns `{status:"ok"}`).               |

---

## Troubleshooting

### No Slack Message

* Confirm `SLACK_WEBHOOK` exported in environment / CI secrets.
* Check run output: If `all_changes={}` and `ALWAYS_NOTIFY=False`, nothing is sent.
* During testing set `ALWAYS_NOTIFY=True` in `config.py`.

### `[Groq Missing]` in Slack

* `GROQ_API_KEY` not set or not visible.
* Free usage? Fallback summary still posts; set key when ready.

### Groq Error: *model decommissioned*

* Update `summarizer.py` to a supported model (default: `llama-3.1-8b-instant`).

### SSL Handshake Failure

Console example:

```
SSLError: SSLV3_ALERT_HANDSHAKE_FAILURE
[Warning] SSL handshake failed for https://acme.com/changelog, retrying with verify=False...
```

We retry with `verify=False`. If fallback also fails:

* Site may block bots, require SNI, or need a different URL (RSS?).
* Temporarily remove the competitor from `config.py`.

### Timezone Error (TypeError: can't compare offset-naive and offset-aware datetimes)

Use `datetime.now(timezone.utc)` when comparing with ISO timestamps that include `Z` or offsets. Fixed in recent `server.py`.

### Nothing Updating in Dashboard

* Confirm you're hitting the **Flask API** (network console: 200 responses?).
* Check server logs for exceptions.
* Ensure `app.js` points to correct backend base (defaults to window\.origin).

---

## Roadmap

* 🔄 RSS + JSON feed parsers (auto-detect).
* 🧠 LLM classification of change type (feature, pricing, bug fix, messaging).
* 💬 Slack Block Kit formatting + emoji categories.
* 📅 Monthly & quarterly rollups.
* 📘 Notion export (paused; user optional).
* 📊 Persistent DB (SQLite) instead of JSON snapshots.

---

## License

MIT License. See `LICENSE` (add if missing).

```
MIT License

Copyright (c) YEAR YOUR_NAME

Permission is hereby granted, free of charge, to any person obtaining a copy
... (standard MIT text) ...
```

---

## Maintainer Notes

* Keep secrets in env/CI; never commit keys.
* Fail soft: wrap external calls in try/except; degrade gracefully.
* When adding new LLM providers, return fallback summary on error.
* For production usage, persist `data/` between runs.

---

