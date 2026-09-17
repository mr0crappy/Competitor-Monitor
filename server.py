"""
Enhanced Flask Server with Discord Integration + UTC-safe timestamps.

Serves the static dashboard frontend and exposes JSON APIs that wrap the
Competitor Monitor backend (scrape → diff → summarize → notify Discord).

Intentionally lightweight: in-memory store for dashboard, no DB.
Snapshots on disk handled by core monitor modules (diff_detector).

Endpoints
---------
GET  /                        → static/index.html
GET  /<asset>                 → static files (css/js/img)
GET  /api/dashboard           → high-level stats
GET  /api/competitors         → list
POST /api/competitors         → add
PUT  /api/competitors/<id>    → update
DELETE /api/competitors/<id>  → delete (purge history + snapshot)
GET  /api/changes             → change events (optional ?competitor=&days=)
POST /api/run-monitor         → run now, push Discord if configured
GET  /api/status              → current scheduler / last run metadata
GET  /api/analytics           → simple chart data
GET  /api/settings            → env + config flags (redacted)
POST /api/settings            → (stub)
GET  /health                  → {"status": "ok"}

Background Scheduler
--------------------
A daemon thread runs `run_monitoring_job()` hourly using `schedule`
so the hosted app (Railway) keeps checking even without GitHub Actions.
(If you prefer Actions-only, disable the thread at bottom.)

"""

from __future__ import annotations

import os
import threading
import time
from typing import Any, Dict, List, Optional

from flask import Flask, jsonify, request, send_from_directory, abort
from flask_cors import CORS

from datetime import datetime, timedelta, timezone

import schedule

# Backend imports
from app import config
from app.monitor.service import MonitorService
from app.storage.competitors import CompetitorStore
from app.web.routes import api, init_routes

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(BASE_DIR, "static")
TEMPLATE_DIR = os.path.join(BASE_DIR, "templates")  # fallback if you move index
DATA_DIR = os.path.join(BASE_DIR, "data")  # snapshots live here by convention

STATIC_INDEX = os.path.join(STATIC_DIR, "index.html")
if not os.path.exists(STATIC_INDEX):
    # fallback to templates/index.html if you kept that structure
    STATIC_INDEX = os.path.join(TEMPLATE_DIR, "index.html")

# ---------------------------------------------------------------------------
# Time helpers (UTC aware)
# ---------------------------------------------------------------------------

def _utcnow() -> datetime:
    """Aware UTC datetime."""
    return datetime.now(timezone.utc)

def _utcnow_iso() -> str:
    """UTC timestamp string with trailing Z."""
    return _utcnow().isoformat().replace("+00:00", "Z")

def _parse_iso(ts: Optional[str]) -> datetime:
    """Parse ISO8601 or 'Z' timestamps to aware UTC datetime."""
    if not ts:
        return _utcnow()
    txt = ts.strip()
    if txt.endswith("Z"):
        txt = txt[:-1] + "+00:00"
    try:
        dt = datetime.fromisoformat(txt)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)
    except Exception:
        return _utcnow()

# ---------------------------------------------------------------------------
# NSFW / Allowlist helpers
# ---------------------------------------------------------------------------

def _domain_from_url(url: str) -> str:
    try:
        # lightweight parse (avoid importing urllib.parse repeatedly)
        no_proto = url.split("://", 1)[-1]
        host = no_proto.split("/", 1)[0]
        return host.lower()
    except Exception:
        return url.lower()

def _is_nsfw_url(url: str) -> bool:
    """Basic NSFW blocklist. Extend/replace as needed."""
    # From config.NSFW_DOMAINS if provided; else fallback minimal list.
    nsfw_list = getattr(config, "NSFW_DOMAINS", None)
    if not nsfw_list:
        nsfw_list = [
            "porn", "xxx", "adult", "redtube", "xvideos", "onlyfans",
            "chaturbate", "brazzers", "xnxx", "pornhub",
        ]
    host = _domain_from_url(url)
    return any(token in host for token in nsfw_list)

def _allowed_competitor(c: Dict[str, Any]) -> bool:
    """Return False if competitor URL is banned (NSFW)."""
    url = c.get("changelog") or c.get("url") or ""
    if not url:
        return False
    return not _is_nsfw_url(url)

# ---------------------------------------------------------------------------
# In-memory state (dashboard cache)
# ---------------------------------------------------------------------------

MOCK_DATA: Dict[str, Any] = {
    
    "recent_changes": [],  # list of change events
    "monitoring_status": {
        "isRunning": False,
        "lastRun": None,
        "nextRun": None,
        "totalRuns": 0,
        "successfulRuns": 0,
        "failedRuns": 0,
    },
}




# ---------------------------------------------------------------------------
# Change event creation / purge
# ---------------------------------------------------------------------------

def _make_change_event(competitor: str, summary: str, change_line: str,
                       event_type: str = "update") -> Dict[str, Any]:
    return {
        "id": len(MOCK_DATA["recent_changes"]) + 1,
        "competitor": competitor,
        "timestamp": _utcnow_iso(),
        "summary": (summary[:100] + "...") if len(summary) > 100 else summary,
        "changes": [change_line],
        "type": event_type,
    }

def _purge_competitor_history(
    competitor_id: int,
    name: str,
) -> int:
    """Remove change events + snapshot file for a competitor. Return count removed."""
    before = len(MOCK_DATA["recent_changes"])
    MOCK_DATA["recent_changes"] = [c for c in MOCK_DATA["recent_changes"] if c["competitor"] != name]
    removed = before - len(MOCK_DATA["recent_changes"])

    # remove snapshot file
    snap_path = os.path.join(
        DATA_DIR,
        f"{competitor_id}.json",
    )

    if os.path.exists(snap_path):
        try:
            os.remove(snap_path)
            print(f"[INFO] Deleted snapshot {snap_path}")
        except OSError as error:
            print(
                f"[WARN] Could not delete snapshot "
                f"{snap_path}: {error}"
            )

    return removed

# ---------------------------------------------------------------------------
# Flask app
# ---------------------------------------------------------------------------

app = Flask(__name__, static_folder=STATIC_DIR, template_folder=TEMPLATE_DIR)

competitor_store = CompetitorStore()

init_routes(
    competitor_store,
    MOCK_DATA,
)

app.register_blueprint(api)


CORS(app)

# --------------------------- Static Frontend -------------------------------

@app.route("/")
def serve_frontend():
    if os.path.exists(STATIC_INDEX):
        return send_from_directory(os.path.dirname(STATIC_INDEX),
                                   os.path.basename(STATIC_INDEX))
    # fallback: 404 if no index
    abort(404)

@app.route("/<path:path>")
def serve_static(path: str):
    # try static/
    p = os.path.join(STATIC_DIR, path)
    if os.path.exists(p):
        return send_from_directory(STATIC_DIR, path)
    # fallback templates
    p = os.path.join(TEMPLATE_DIR, path)
    if os.path.exists(p):
        return send_from_directory(TEMPLATE_DIR, path)
    abort(404)









# --------------------------- API: Settings ---------------------------------

@app.route("/api/settings", methods=["GET"])
def api_get_settings():
    return jsonify({
        "discordWebhook": bool(os.getenv("DISCORD_WEBHOOK")),
        "groqApiKey": bool(os.getenv("GROQ_API_KEY")),
        "alwaysNotify": getattr(config, "ALWAYS_NOTIFY", False),
        "maxLinesPerCompetitor": getattr(config, "MAX_LINES_PER_COMPETITOR", 50),
        "monitoringInterval": "hourly",
    })

@app.route("/api/settings", methods=["POST"])
def api_post_settings():
    # stub: accept but do nothing
    return jsonify({"success": True, "message": "Settings updated (not persisted)."})




# ---------------------------------------------------------------------------
# Background Monitoring (Hourly)
# ---------------------------------------------------------------------------

def run_monitoring_job():
    """Run the monitor on the scheduled interval."""

    status = MOCK_DATA["monitoring_status"]

    if status["isRunning"]:
        print("[SCHED] Skipping scheduled run; already running.")
        return

    print("[SCHED] Scheduled monitoring run...")

    status["isRunning"] = True
    status["totalRuns"] += 1

    try:
        monitor = MonitorService()
        changes = monitor.run() or {}

        if changes:
            status["successfulRuns"] += 1
            print(
                f"[SCHED] Found changes for "
                f"{len(changes)} competitors."
            )
        else:
            print("[SCHED] No changes detected.")

        for competitor_name, change_list in changes.items():
            for line in change_list:
                MOCK_DATA["recent_changes"].append(
                    _make_change_event(
                        competitor_name,
                        line,
                        line,
                        "scheduled",
                    )
                )

        MOCK_DATA["recent_changes"] = (
            MOCK_DATA["recent_changes"][-100:]
        )

    except Exception as error:
        status["failedRuns"] += 1
        print(f"[SCHED][ERROR] run() failed: {error}")

    finally:
        status["isRunning"] = False
        status["lastRun"] = _utcnow_iso()
        status["nextRun"] = (
            _utcnow() + timedelta(hours=1)
        ).isoformat().replace("+00:00", "Z")


def background_monitor():
    """Scheduler loop in daemon thread."""
    schedule.every(1).hours.do(run_monitoring_job)
    while True:
        schedule.run_pending()
        time.sleep(60)

# ---------------------------------------------------------------------------
# Main Entrypoint
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    # Start scheduler thread (comment out if using GitHub Actions only)
    monitor_thread = threading.Thread(target=background_monitor, daemon=True)
    monitor_thread.start()
    print("[INFO] Background monitoring thread started.")

    port = int(os.getenv("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=False)
