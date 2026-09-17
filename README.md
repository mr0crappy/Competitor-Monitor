# Competitor Monitor

A lightweight competitor-monitoring application that tracks changelogs, release feeds, and update pages, detects new content, summarizes changes with an LLM, and sends notifications to Discord.

The application includes a Flask web dashboard for managing competitors and manually triggering monitoring runs.

## Features

* Add, update, and remove competitors through the dashboard
* Monitor arbitrary competitor URLs
* Generic HTML normalization
* Automatic RSS/Atom feed detection
* Snapshot-based change detection
* URL-aware snapshot baselines
* LLM-powered summaries using Groq
* Discord webhook notifications
* REST API for competitor management and monitoring
* Persistent JSON storage
* Automated tests with pytest
* Environment-based configuration for secrets

## Architecture

```text
Competitor Monitor
│
├── app/
│   ├── config.py
│   │
│   ├── monitor/
│   │   ├── scraper.py
│   │   ├── normalizer.py
│   │   ├── diff.py
│   │   └── service.py
│   │
│   ├── notifications/
│   │   ├── discord.py
│   │   ├── summarizer.py
│   │   └── service.py
│   │
│   ├── storage/
│   │   ├── competitors.py
│   │   └── snapshots.py
│   │
│   └── web/
│       └── routes.py
│
├── static/
├── tests/
├── data/
├── server.py
├── requirements.txt
└── README.md
```

### Monitoring flow

```text
Competitor URL
      │
      ▼
   Scraper
      │
      ▼
  Normalizer
      │
      ▼
   Snapshot
      │
      ▼
    Diff
      │
      ▼
 New changes
      │
      ├──────────────► Groq summarizer
      │                       │
      │                       ▼
      └──────────────────► Discord
```

## Tech Stack

* **Python**
* **Flask**
* **Requests**
* **BeautifulSoup**
* **lxml**
* **Groq API**
* **Discord Webhooks**
* **JavaScript**
* **HTML/CSS**
* **pytest**
* **JSON** for lightweight persistence

## Setup

### 1. Clone the repository

```bash
git clone https://github.com/mr0crappy/Competitor-Monitor.git
cd Competitor-Monitor
```

### 2. Create a virtual environment

Windows PowerShell:

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
```

macOS/Linux:

```bash
python -m venv .venv
source .venv/bin/activate
```

### 3. Install dependencies

```bash
pip install -r requirements.txt
```

### 4. Configure environment variables

Create a `.env` file in the project root:

```env
DISCORD_WEBHOOK=
GROQ_API_KEY=
GROQ_MODEL=openai/gpt-oss-120b
```

`DISCORD_WEBHOOK` is used for notifications.

`GROQ_API_KEY` enables LLM-generated summaries. The application can fall back to a basic summary when an API key is unavailable.

`GROQ_MODEL` controls the Groq model used for summarization.

**Never commit `.env` or API keys to Git.**

## Running the Dashboard

Start the Flask server:

```bash
python server.py
```

Open:

```text
http://127.0.0.1:5000
```

The dashboard allows you to:

* View competitors
* Add competitors
* Edit competitors
* Delete competitors
* Trigger a monitoring run
* View detected changes
* View dashboard statistics
* View analytics

## Adding a Competitor

Competitors are intentionally **not hardcoded** into the application.

Add them through the dashboard.

For example:

```text
Name:
VS Code

URL:
https://github.com/microsoft/vscode/releases.atom

Source Type:
generic
```

The application automatically detects RSS/Atom feeds and processes normal HTML pages generically.

## How Monitoring Works

### First run

When a competitor is checked for the first time:

```text
Fetch
  ↓
Normalize
  ↓
Create snapshot
  ↓
No notification
```

The existing content becomes the baseline.

### Subsequent runs

```text
Fetch
  ↓
Normalize
  ↓
Load previous snapshot
  ↓
Compute diff
  ↓
New content?
  ├── No → stop
  └── Yes → summarize → Discord
```

### URL changes

If a competitor's monitored URL changes, the application creates a new baseline rather than comparing content from two unrelated URLs.

## REST API

| Method | Endpoint                | Description             |
| ------ | ----------------------- | ----------------------- |
| GET    | `/api/dashboard`        | Dashboard statistics    |
| GET    | `/api/competitors`      | List competitors        |
| POST   | `/api/competitors`      | Add competitor          |
| PUT    | `/api/competitors/<id>` | Update competitor       |
| DELETE | `/api/competitors/<id>` | Delete competitor       |
| GET    | `/api/changes`          | Retrieve recent changes |
| POST   | `/api/run-monitor`      | Trigger monitoring      |
| GET    | `/api/status`           | Monitoring status       |
| GET    | `/api/analytics`        | Analytics data          |
| GET    | `/health`               | Health check            |

## Running Tests

Run the complete test suite:

```bash
python -m pytest
```

The test suite covers:

* Diff detection
* Competitor storage
* Snapshot storage
* Monitoring behavior
* URL-change baselines
* Discord notification handling

## Design Goals

This project intentionally focuses on a simple architecture rather than production-scale infrastructure.

The main design goals are:

* Separate responsibilities between monitoring, storage, notifications, and web routes
* Keep competitor configuration dynamic
* Avoid site-specific scraping logic where possible
* Keep external integrations isolated
* Make failures from external services non-fatal
* Keep local setup simple
* Maintain automated tests for core behavior

## Limitations

This is a lightweight monitoring application rather than a production-grade distributed monitoring system.

Some websites may require JavaScript rendering, authentication, or specialized parsing that generic HTTP scraping cannot provide.

JSON files are used for persistence instead of a database, which keeps the project simple but is not intended for large-scale deployments.

## License

MIT
