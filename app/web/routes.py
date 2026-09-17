from datetime import datetime, timedelta, timezone

from flask import Blueprint, jsonify, request

from app.storage.competitors import CompetitorStore

from app import config

from app.monitor.service import MonitorService



api = Blueprint("api", __name__)

competitor_store = None

app_state = None


def init_routes(store, state):
    global competitor_store
    global app_state

    competitor_store = store
    app_state = state

def utcnow():
    return datetime.now(timezone.utc)


def utcnow_iso():
    return utcnow().isoformat().replace("+00:00", "Z")


def parse_iso(timestamp):
    if not timestamp:
        return utcnow()

    text = timestamp.strip()

    if text.endswith("Z"):
        text = text[:-1] + "+00:00"

    try:
        value = datetime.fromisoformat(text)

        if value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)

        return value.astimezone(timezone.utc)

    except Exception:
        return utcnow()





@api.route("/health")
def health():
    return jsonify({"status": "ok"})


@api.route("/api/competitors", methods=["GET"])
def api_get_competitors():
    return jsonify({
        "competitors": competitor_store.get_all()
    })


@api.route("/api/competitors", methods=["POST"])
def api_add_competitor():
    data = request.get_json(force=True, silent=True) or {}

    name = (data.get("name") or "").strip()
    url = (data.get("changelog") or data.get("url") or "").strip()
    source_type = data.get("source_type", "generic")

    if not name or not url:
        return jsonify({
            "error": "name and changelog URL required"
        }), 400

    new_competitor = competitor_store.add(
    name,
    url,
    data.get("description", ""),
    source_type,
)

    return jsonify({
        "success": True,
        "competitor": new_competitor,
    })


@api.route("/api/competitors/<int:competitor_id>", methods=["PUT"])
def api_update_competitor(competitor_id):
    data = request.get_json(force=True, silent=True) or {}

    competitor = competitor_store.get_by_id(competitor_id)

    if not competitor:
        return jsonify({
            "error": "Competitor not found"
        }), 404

    new_name = data.get(
        "name",
        competitor["name"],
    ).strip()

    new_url = data.get(
        "changelog",
        competitor["changelog"],
    ).strip()

    updated = competitor_store.update(
    competitor_id,
    new_name,
    new_url,
    data.get("description", competitor.get("description", "")),
    data.get("source_type", competitor.get("source_type", "generic")),
    data.get("status", competitor.get("status", "active")),
)

    return jsonify({
        "success": True,
        "competitor": updated,
    })


@api.route("/api/competitors/<int:competitor_id>", methods=["DELETE"])
def api_delete_competitor(competitor_id):
    competitor = competitor_store.get_by_id(competitor_id)

    if not competitor:
        return jsonify({
            "error": "Competitor not found"
        }), 404

    removed = competitor_store.delete(competitor_id)

    return jsonify({
        "success": True,
        "competitor": removed,
    })


@api.route("/api/dashboard", methods=["GET"])
def api_dashboard():
    competitors = competitor_store.get_all()

    active_competitors = [
        competitor
        for competitor in competitors
        if competitor["status"] == "active"
    ]

    now = utcnow()

    recent_changes_24h = sum(
        1
        for change in app_state["recent_changes"]
        if parse_iso(change.get("timestamp"))
        > now - timedelta(hours=24)
    )

    return jsonify({
        "totalCompetitors": len(competitors),
        "activeCompetitors": len(active_competitors),
        "recentChanges24h": recent_changes_24h,
        "systemStatus": app_state["monitoring_status"],
        "recentActivity": app_state["recent_changes"][-10:],
    })


@api.route("/api/changes", methods=["GET"])
def api_get_changes():
    competitor_filter = request.args.get("competitor")
    days = request.args.get("days", 7)

    try:
        days = int(days)
    except (TypeError, ValueError):
        days = 7

    changes = app_state["recent_changes"]

    if competitor_filter:
        changes = [
            change
            for change in changes
            if change["competitor"] == competitor_filter
        ]

    cutoff = utcnow() - timedelta(days=days)

    changes = [
        change
        for change in changes
        if parse_iso(change.get("timestamp")) > cutoff
    ]

    return jsonify({
        "changes": changes
    })


@api.route("/api/analytics", methods=["GET"])
def api_analytics():
    today = utcnow().date()

    weekly_activity = []

    for i in range(6, -1, -1):
        date = today - timedelta(days=i)

        count = sum(
            1
            for change in app_state["recent_changes"]
            if parse_iso(change.get("timestamp")).date() == date
        )

        weekly_activity.append({
            "date": date.isoformat(),
            "changes": count,
        })

    competitor_counts = {}

    for change in app_state["recent_changes"]:
        name = change["competitor"]
        competitor_counts[name] = (
            competitor_counts.get(name, 0) + 1
        )

    competitor_activity = [
        {
            "competitor": name,
            "changes": count,
        }
        for name, count in competitor_counts.items()
    ]

    def count_keyword(keyword):
        return sum(
            1
            for change in app_state["recent_changes"]
            if keyword in change["summary"].lower()
        )

    change_types = [
        {
            "type": "feature",
            "count": count_keyword("feature"),
        },
        {
            "type": "update",
            "count": count_keyword("update"),
        },
        {
            "type": "fix",
            "count": count_keyword("fix"),
        },
    ]

    total = sum(
        item["count"]
        for item in change_types
    ) or 1

    for item in change_types:
        item["percentage"] = round(
            100 * item["count"] / total,
            1,
        )

    return jsonify({
        "weeklyActivity": weekly_activity,
        "competitorActivity": competitor_activity,
        "changeTypes": change_types,
    })

@api.route("/api/run-monitor", methods=["POST"])
def api_run_monitor():
    print("[DEBUG] /api/run-monitor HIT")
    status = app_state["monitoring_status"]

    if status["isRunning"]:
        return jsonify({
            "error": "Monitor already running"
        }), 409

    status["isRunning"] = True
    status["totalRuns"] += 1

    try:
        print("[DEBUG] Creating MonitorService")
    
        monitor = MonitorService()

        print("[DEBUG] Calling MonitorService.run()")

        changes = monitor.run() or {}

        print("[DEBUG] MonitorService.run() finished")
        print("[DEBUG] Changes:", changes)

        if changes:
            summary = "Changes detected."
        else:
            summary = "No new changes detected."

        for competitor_name, change_list in changes.items():
            for line in change_list:
                app_state["recent_changes"].append({
                    "id": len(app_state["recent_changes"]) + 1,
                    "competitor": competitor_name,
                    "timestamp": utcnow_iso(),
                    "summary": (
                        line[:100] + "..."
                        if len(line) > 100
                        else line
                    ),
                    "changes": [line],
                    "type": "manual",
                })

        app_state["recent_changes"] = (
            app_state["recent_changes"][-100:]
        )

        status["successfulRuns"] += 1

        return jsonify({
            "success": True,
            "summary": summary,
            "changes": changes,
            "message": (
                f"Found changes for {len(changes)} competitors"
                if changes
                else "No changes detected"
            ),
        })

    except Exception as error:
        status["failedRuns"] += 1

        return jsonify({
            "error": f"Monitor failed: {error}"
        }), 500

    finally:
        status["isRunning"] = False
        status["lastRun"] = utcnow_iso()
        status["nextRun"] = (
            utcnow() + timedelta(hours=1)
        ).isoformat().replace("+00:00", "Z")

@api.route("/api/status", methods=["GET"])
def api_status():
    return jsonify({
        "status": app_state["monitoring_status"]
    })