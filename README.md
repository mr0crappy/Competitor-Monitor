# Competitor Monitor

Monitor competitor changelogs / update feeds, detect what’s new, summarize with an LLM (Groq), and notify a Slack channel on a schedule (GitHub Actions or local cron). Lightweight, extensible, and free‑friendly.

---

## Table of Contents

* [Overview](#overview)
* [How It Works](#how-it-works)
* [Quick Start (TL;DR)](#quick-start-tldr)
* [Project Structure](#project-structure)
* [Installation](#installation)
* [Configuration](#configuration)

  * [Environment Variables](#environment-variables)
  * [Editing `config.py`](#editing-configpy)
* [Run Locally](#run-locally)
* [Test Integrations](#test-integrations)

  * [Test Slack](#test-slack)
  * [Test Groq Summarization](#test-groq-summarization)
* [Scheduled Automation (GitHub Actions)](#scheduled-automation-github-actions)
* [Slack Message Format](#slack-message-format)
* [Data Persistence & Snapshots](#data-persistence--snapshots)
* [Extending: Adding Competitors](#extending-adding-competitors)
* [Troubleshooting](#troubleshooting)
* [Roadmap](#roadmap)
* [License](#license)

---

## Overview

**Competitor Monitor** automatically checks competitor changelog pages (HTML / RSS / etc.), stores snapshots, computes diffs, summarizes changes with a Groq LLM (fallback summary if no key or quota), and posts results to Slack. Designed for reliability in CI (GitHub Actions) and low/no‑cost operation.

---

## How It Works

1. **Fetch** each competitor’s changelog URL.
2. **Parse** to raw text lines (basic HTML → text; can plug in richer parsers per competitor).
3. **Snapshot** current lines; compare to last run to detect new items.
4. **Summarize** changes across all competitors using Groq (or fallback bullet summary).
5. **Notify** Slack via Incoming Webhook.
6. **Schedule** via GitHub Actions (weekly cron) or local cron.

---

## Quick Start (TL;DR)

```bash
# clone & enter
git clone https://github.com/YOUR_USERNAME/Competitor-Monitor.git
cd Competitor-Monitor

# create venv (optional but recommended)
python -m venv .venv
# Windows
.\.venv\Scripts\activate
# macOS / Linux
source .venv/bin/activate

# install deps
pip install -r requirements.txt

# set env vars (replace values)
set SLACK_WEBHOOK="https://hooks.slack.com/services/..."        # PowerShell
set GROQ_API_KEY="gsk_xxx"
# or export on bash

# run once
python main.py
```

If it succeeds you’ll see a message in Slack.

---

## Project Structure

```
Competitor-Monitor/
├── config.py              # Competitor list, behavior flags, env access
├── scraper.py             # Fetch & basic HTML→text parsing (with SSL fallback)
├── diff_detector.py       # Load/save snapshots, compute diffs
├── summarizer.py          # Groq LLM summarizer + fallback bullet summary
├── reporter.py            # Send Slack message
├── main.py                # Orchestrates a full run
├── server.py              # (optional) Flask API endpoint /api/updates
├── requirements.txt       # Python deps
├── data/                  # Snapshots saved per competitor (JSON)
└── README.md              # You are here
```

> **Note**: The `data/` directory should be writable. In GitHub Actions, snapshots are ephemeral unless you persist them (artifact upload or branch commit). See [Data Persistence & Snapshots](#data-persistence--snapshots).

---

## Installation

Follow these steps on any machine with internet access.

### 1. Clone

```bash
git clone https://github.com/mr0crappy/Competitor-Monitor.git
cd Competitor-Monitor
```

### 2. Virtual Environment (recommended)

```bash
python -m venv .venv
# Windows
.\.venv\Scripts\activate
# macOS / Linux
source .venv/bin/activate
```

### 3. Install Dependencies

```bash
pip install -r requirements.txt
```

If you get SSL or network errors installing packages, ensure Python and pip are updated:

```bash
python -m pip install --upgrade pip setuptools wheel
```

---

## Configuration

You configure the monitor via **environment variables** and **`config.py`**.

### Environment Variables

Set these before running (locally or in CI):

| Variable                      | Required         | Description                                                        |
| ----------------------------- | ---------------- | ------------------------------------------------------------------ |
| `SLACK_WEBHOOK`               | Yes              | Incoming Webhook URL for your Slack channel.                       |
| `GROQ_API_KEY`                | No (recommended) | Enables Groq LLM summaries; without it you get a fallback summary. |
| `SUMMARIZER_MAX_ITEMS`        | No               | Override per‑competitor cap of updates passed to LLM.              |
| `SUMMARIZER_MAX_PROMPT_CHARS` | No               | Max characters in LLM prompt (safety).                             |

**Windows (PowerShell) example:**

```powershell
$env:SLACK_WEBHOOK="https://hooks.slack.com/services/..."
$env:GROQ_API_KEY="gsk_your_key"
```

**macOS / Linux example:**

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
ALWAYS_NOTIFY = True              # send Slack message even if no changes (useful while testing)
MAX_LINES_PER_COMPETITOR = 50     # trim noise before diffing
```

Add more competitors by appending dicts to `COMPETITORS`.

---

## Run Locally

Run a full cycle and send a Slack message:

```bash
python main.py
```

Expected console output:

```
[DEBUG] Starting Competitor Monitor (Slack + Groq).
[DEBUG] Checking competitor: GitHub
[INFO] 3 new line(s) for GitHub.
[DEBUG] all_changes = {'GitHub': [...]}
[DEBUG] Summary text:
  Weekly Competitor Monitor Summary ...
[INFO] Message sent to Slack.
```

Check your Slack channel for the summary.

---

## Test Integrations

Sometimes you want to confirm Slack & Groq work *before* scraping.

### Test Slack

Create `test_slack.py`:

```python
import os, requests
url = os.getenv("SLACK_WEBHOOK")
print("Slack configured?", bool(url))
if url:
    r = requests.post(url, json={"text": "Test message from Competitor Monitor."})
    print("HTTP", r.status_code, r.text)
```

Run:

```bash
python test_slack.py
```

### Test Groq Summarization

Create `test_groq.py`:

```python
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

Run the monitor every Monday at 09:00 UTC (change as needed).

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

Repo → *Settings* → *Secrets and variables* → *Actions* → *New repository secret*:

* `SLACK_WEBHOOK`
* `GROQ_API_KEY`

Trigger a manual test: Repo → *Actions* → *Weekly Competitor Report* → *Run workflow*.

> **India Time (IST)?** 09:00 UTC ≈ 14:30 IST. To run at 09:00 IST use: `30 3 * * 1` (03:30 UTC).

---

## Slack Message Format

Current implementation sends plain text. Example:

```
Weekly Competitor Monitor Summary
--------------------------------
GitHub: 3 change(s)
  - Copilot now free for educators
  - Improved accessibility labels
  - Security advisory UI refresh
```

You can upgrade formatting (blocks, emojis) in `reporter.py` later.

---

## Data Persistence & Snapshots

We store previously fetched content per competitor so we only alert on *new* lines.

* Files are written under `data/NAME.json`.
* First run seeds the snapshot; subsequent runs diff.
* In GitHub Actions, the filesystem is ephemeral. Three strategies:

  1. **No persistence** – every run treated as first run (alerts noisy).
  2. **Upload artifact** – save `data/` as workflow artifact; download next run.
  3. **Commit back to a branch** – workflow commits updated snapshots to `monitor-data` branch.

If you want me to provide an artifact‑persistence workflow, let me know.

---

## Extending: Adding Competitors

Add entries in `config.py`:

```python
COMPETITORS = [
    {"name": "GitHub", "changelog": "https://github.blog/changelog/"},
    {"name": "FooApp", "changelog": "https://fooapp.com/updates"},
]
```

### Parsing Modes (future)

We can support richer parsing by adding optional keys:

```python
{
  "name": "FooApp",
  "changelog": "https://fooapp.com/changelog.xml",
  "parser": "rss",            # handle via feedparser
  "allow_insecure": False,      # override SSL fallback behavior
}
```

Let me know if you need an RSS parser or site‑specific HTML parser; I’ll generate it.

---

## Troubleshooting

### No Slack Message

* Confirm `SLACK_WEBHOOK` env var.
* Check GitHub Actions logs for `[INFO] Message sent to Slack.`
* If `all_changes = {}` and `ALWAYS_NOTIFY = False`, nothing is sent.

### `[Groq Missing]` in Slack

* `GROQ_API_KEY` not set or not visible in env.
* Add key locally or in GitHub Secrets.

### Groq Error: model decommissioned

* Update model in `summarizer.py` (e.g., `llama-3.1-8b-instant`).

### SSL Handshake Failure

Seen as:

```
SSLError: SSLV3_ALERT_HANDSHAKE_FAILURE
```

We retry with `verify=False`. If still failing:

* Site truly broken; consider alternate feed (RSS, API, blog JSON).
* Temporarily remove that competitor.

### Not Enough Changes Detected

Remember: only *new* lines relative to last snapshot are counted. Delete that competitor’s snapshot JSON to force a full diff.

---

## Roadmap

* Rich per‑site parsers (title, date, tags).
* Slack Block Kit formatting (emoji categories: 🆕, 💰, ⚠️).
* Monthly rollup mode.
* Notion export (on hold by user request).
* Web dashboard (React) optional deploy.

---

## License

MIT License. See `LICENSE` file (add one if missing).

---

## Maintainer Notes

* Safe to fork & customize.
* Keep secrets in CI; never commit keys.
* When adding a new LLM provider, wrap in try/except and fallback to bullet counts.

---

**Need help wiring artifact persistence, richer parsing, or Slack formatting? Let me know and I’ll generate the code.**
