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
from main import run  # run(return_changes: bool=False) -> Optional[dict]
from app.storage.competitors import CompetitorStore

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

# --------------------------- API: Dashboard --------------------------------

@app.route("/api/dashboard", methods=["GET"])
def get_dashboard():
    competitors = competitor_store.get_all()

    active_competitors = [
        c for c in competitors
        if c["status"] == "active"
    ]

    now_utc = _utcnow()

    recent_changes_24h = sum(
        1
        for c in MOCK_DATA["recent_changes"]
        if _parse_iso(c.get("timestamp")) >
        now_utc - timedelta(hours=24)
    )

    return jsonify({
        "totalCompetitors": len(competitors),
        "activeCompetitors": len(active_competitors),
        "recentChanges24h": recent_changes_24h,
        "systemStatus": MOCK_DATA["monitoring_status"],
        "recentActivity": MOCK_DATA["recent_changes"][-10:],
    })

# --------------------------- API: Competitors ------------------------------

@app.route("/api/competitors", methods=["GET"])
def api_get_competitors():
    return jsonify({
        "competitors": competitor_store.get_all()
    })

@app.route("/api/competitors", methods=["POST"])
def api_add_competitor():
    data = request.get_json(force=True, silent=True) or {}
    name = (data.get("name") or "").strip()
    url = (data.get("changelog") or data.get("url") or "").strip()

    if not name or not url:
        return jsonify({"error": "name and changelog URL required"}), 400

    if _is_nsfw_url(url):
        return jsonify({"error": "URL blocked by NSFW policy"}), 400

    

    new_comp = competitor_store.add(
        name,
        url,
    )
    
    return jsonify({"success": True, "competitor": new_comp})

@app.route("/api/competitors/<int:competitor_id>", methods=["PUT"])
def api_update_competitor(competitor_id: int):
    data = request.get_json(force=True, silent=True) or {}
    comp = competitor_store.get_by_id(competitor_id)
    if not comp:
        return jsonify({"error": "Competitor not found"}), 404

    new_name = data.get("name", comp["name"]).strip()
    new_url = data.get("changelog", comp["changelog"]).strip()

    if _is_nsfw_url(new_url):
        return jsonify({"error": "URL blocked by NSFW policy"}), 400

    updated = competitor_store.update(
        competitor_id,
        new_name,
        new_url,
        data.get("description", comp.get("description", "")),
        data.get("status", comp.get("status", "active")),
    )

    

    return jsonify({"success": True, "competitor": updated})

@app.route("/api/competitors/<int:competitor_id>", methods=["DELETE"])
def api_delete_competitor(competitor_id: int):
    comp = competitor_store.get_by_id(competitor_id)
    if not comp:
        return jsonify({"error": "Competitor not found"}), 404

    name = comp["name"]

    # remove from in-memory list
    removed = competitor_store.delete(competitor_id)
    

    # purge history + snapshot
    removed_changes = _purge_competitor_history(
    competitor_id,
    name,
)

    

    return jsonify({"success": True, "removed_changes": removed_changes})

# --------------------------- API: Changes ----------------------------------

@app.route("/api/changes", methods=["GET"])
def api_get_changes():
    competitor_filter = request.args.get("competitor")
    days = request.args.get("days", 7)

    try:
        days = int(days)
    except Exception:
        days = 7

    out = MOCK_DATA["recent_changes"]
    if competitor_filter:
        out = [c for c in out if c["competitor"] == competitor_filter]

    cutoff = _utcnow() - timedelta(days=days)
    out = [c for c in out if _parse_iso(c.get("timestamp")) > cutoff]

    return jsonify({"changes": out})

# --------------------------- API: Run Monitor ------------------------------

@app.route("/api/run-monitor", methods=["POST"])
def api_run_monitor():
    """Manual trigger: run scrape/diff/summarize; push Discord; cache results."""
    status = MOCK_DATA["monitoring_status"]
    if status["isRunning"]:
        return jsonify({"error": "Monitor already running"}), 409

    status["isRunning"] = True
    status["totalRuns"] += 1

    try:
        changes = run(return_changes=True) or {}
    except Exception as e:
        status["isRunning"] = False
        status["failedRuns"] += 1
        return jsonify({"error": f"Monitor failed: {e}"}), 500

    summary = (
        "Changes detected."
        if changes
        else "No new changes detected."
    )

    # Cache change events for dashboard
    for competitor_name, change_list in (changes or {}).items():
        for line in change_list:
            MOCK_DATA["recent_changes"].append(
                _make_change_event(competitor_name, line, line, "manual")
            )

    status["isRunning"] = False
    status["lastRun"] = _utcnow_iso()
    status["nextRun"] = (_utcnow() + timedelta(hours=1)).isoformat().replace("+00:00", "Z")

    # prune
    MOCK_DATA["recent_changes"] = MOCK_DATA["recent_changes"][-100:]

    return jsonify({
        "success": True,
        "summary": summary,
        "changes": changes,
        "message": f"Found changes for {len(changes)} competitors" if changes else "No changes detected",
    })

# --------------------------- API: Status -----------------------------------

@app.route("/api/status", methods=["GET"])
def api_status():
    return jsonify({"status": MOCK_DATA["monitoring_status"]})

# --------------------------- API: Analytics --------------------------------

@app.route("/api/analytics", methods=["GET"])
def api_analytics():
    # last 7 days simple counts
    today = _utcnow().date()
    weekly_activity: List[Dict[str, Any]] = []
    for i in range(6, -1, -1):  # oldest -> newest
        d = today - timedelta(days=i)
        count = sum(1 for c in MOCK_DATA["recent_changes"]
                    if _parse_iso(c.get("timestamp")).date() == d)
        weekly_activity.append({"date": d.isoformat(), "changes": count})

    # competitor counts
    comp_counts: Dict[str, int] = {}
    for c in MOCK_DATA["recent_changes"]:
        comp_counts[c["competitor"]] = comp_counts.get(c["competitor"], 0) + 1
    competitor_activity = [{"competitor": k, "changes": v} for k, v in comp_counts.items()]

    # naive type buckets by keyword in summary
    def _count_kwd(k: str) -> int:
        return sum(1 for c in MOCK_DATA["recent_changes"] if k in c["summary"].lower())

    change_types = [
        {"type": "feature", "count": _count_kwd("feature")},
        {"type": "update",  "count": _count_kwd("update")},
        {"type": "fix",     "count": _count_kwd("fix")},
    ]
    total_type = sum(ct["count"] for ct in change_types) or 1
    for ct in change_types:
        ct["percentage"] = round(100 * ct["count"] / total_type, 1)

    return jsonify({
        "weeklyActivity": weekly_activity,
        "competitorActivity": competitor_activity,
        "changeTypes": change_types,
    })

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


# --------------------------- Health ----------------------------------------

@app.route("/health")
def health():
    return jsonify({"status": "ok"}), 200

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
        changes = run(return_changes=True) or {}

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
