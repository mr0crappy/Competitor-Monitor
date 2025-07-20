# Enhanced Flask Server with Slack Integration

from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
from main import run
from reporter import send_slack
from summarizer import summarize_all
import config
import os
import threading
import time
import schedule
from datetime import datetime, timedelta
from datetime import timezone

app = Flask(__name__)
CORS(app)  # Enable CORS for frontend connection

# Mock data storage (in production, use a proper database)
MOCK_DATA = {
    "competitors": [],
    "recent_changes": [],
    "monitoring_status": {
        "isRunning": False,
        "lastRun": None,
        "nextRun": None,
        "totalRuns": 0,
        "successfulRuns": 0,
        "failedRuns": 0
    }
}

# Initialize with existing competitors from config
for i, comp in enumerate(config.COMPETITORS):
    MOCK_DATA["competitors"].append({
        "id": i + 1,
        "name": comp["name"],
        "changelog": comp["changelog"],
        "description": comp.get("description", ""),
        "status": "active",
        "lastUpdate": datetime.now().isoformat(),
        "changesDetected": 0
    })

# Serve static files (frontend)
@app.route('/')
def serve_frontend():
    return send_from_directory('static', 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory('static', path)

# API Routes
@app.route("/api/dashboard", methods=["GET"])
def get_dashboard():
    """Get dashboard overview data"""
    active_competitors = [c for c in MOCK_DATA["competitors"] if c["status"] == "active"]

    now = datetime.now(timezone.utc)  # make aware
    recent_changes_24h = len([
        c for c in MOCK_DATA["recent_changes"]
        if datetime.fromisoformat(
            c["timestamp"].replace('Z', '+00:00')
        ) > now - timedelta(hours=24)
    ])

    return jsonify({
        "totalCompetitors": len(MOCK_DATA["competitors"]),
        "activeCompetitors": len(active_competitors),
        "recentChanges24h": recent_changes_24h,
        "systemStatus": MOCK_DATA["monitoring_status"],
        "recentActivity": MOCK_DATA["recent_changes"][-10:]
    })

@app.route("/api/competitors", methods=["GET"])
def get_competitors():
    return jsonify({"competitors": MOCK_DATA["competitors"]})

@app.route("/api/competitors", methods=["POST"])
def add_competitor():
    data = request.json
    new_competitor = {
        "id": len(MOCK_DATA["competitors"]) + 1,
        "name": data.get("name"),
        "changelog": data.get("changelog"),
        "description": data.get("description", ""),
        "status": "active",
        "lastUpdate": datetime.now().isoformat(),
        "changesDetected": 0
    }
    MOCK_DATA["competitors"].append(new_competitor)
    config.COMPETITORS.append({
        "name": new_competitor["name"],
        "changelog": new_competitor["changelog"]
    })
    return jsonify({"success": True, "competitor": new_competitor})

@app.route("/api/competitors/<int:competitor_id>", methods=["PUT"])
def update_competitor(competitor_id):
    data = request.json
    for comp in MOCK_DATA["competitors"]:
        if comp["id"] == competitor_id:
            comp.update({
                "name": data.get("name", comp["name"]),
                "changelog": data.get("changelog", comp["changelog"]),
                "description": data.get("description", comp["description"]),
                "status": data.get("status", comp["status"])
            })
            return jsonify({"success": True, "competitor": comp})
    return jsonify({"error": "Competitor not found"}), 404

@app.route("/api/competitors/<int:competitor_id>", methods=["DELETE"])
def delete_competitor(competitor_id):
    MOCK_DATA["competitors"] = [c for c in MOCK_DATA["competitors"] if c["id"] != competitor_id]
    return jsonify({"success": True})

@app.route("/api/changes", methods=["GET"])
def get_changes():
    """Get recent changes with optional filtering"""
    competitor_filter = request.args.get("competitor")
    days = int(request.args.get("days", 7))

    now = datetime.now(timezone.utc)  # make aware
    cutoff_date = now - timedelta(days=days)

    changes = MOCK_DATA["recent_changes"]

    # Filter by competitor if specified
    if competitor_filter:
        changes = [c for c in changes if c["competitor"] == competitor_filter]

    # Filter by date
    changes = [
        c for c in changes
        if datetime.fromisoformat(c["timestamp"].replace('Z', '+00:00')) > cutoff_date
    ]

    return jsonify({"changes": changes})


@app.route("/api/run-monitor", methods=["POST"])
def run_monitor():
    """Manually trigger monitoring run and send Slack notification."""
    try:
        MOCK_DATA["monitoring_status"]["isRunning"] = True
        MOCK_DATA["monitoring_status"]["totalRuns"] += 1

        # Run the monitoring
        changes = run(return_changes=True)

        if changes:
            summary = summarize_all(changes)
            print(f"[DEBUG] Slack summary:\n{summary}")
            if config.SLACK_WEBHOOK:
                try:
                    send_slack(summary, config.SLACK_WEBHOOK)
                    print("[DEBUG] Slack notification sent.")
                except Exception as e:
                    print(f"[ERROR] Slack notification failed: {e}")

        # Store changes
        for competitor_name, change_list in changes.items():
            for change in change_list:
                MOCK_DATA["recent_changes"].append({
                    "id": len(MOCK_DATA["recent_changes"]) + 1,
                    "competitor": competitor_name,
                    "timestamp": datetime.now().isoformat() + "Z",
                    "summary": change[:100] + "..." if len(change) > 100 else change,
                    "changes": [change],
                    "type": "update"
                })

        MOCK_DATA["monitoring_status"]["isRunning"] = False
        MOCK_DATA["monitoring_status"]["lastRun"] = datetime.now().isoformat() + "Z"
        MOCK_DATA["monitoring_status"]["nextRun"] = (datetime.now() + timedelta(hours=1)).isoformat() + "Z"

        if changes:
            MOCK_DATA["monitoring_status"]["successfulRuns"] += 1
        MOCK_DATA["recent_changes"] = MOCK_DATA["recent_changes"][-100:]

        return jsonify({
            "success": True,
            "changes": changes,
            "message": f"Found changes for {len(changes)} competitors" if changes else "No changes detected"
        })

    except Exception as e:
        MOCK_DATA["monitoring_status"]["isRunning"] = False
        MOCK_DATA["monitoring_status"]["failedRuns"] += 1
        return jsonify({"error": str(e)}), 500

@app.route("/api/status", methods=["GET"])
def get_status():
    return jsonify({"status": MOCK_DATA["monitoring_status"]})

@app.route("/api/analytics", methods=["GET"])
def get_analytics():
    weekly_activity = []
    for i in range(7):
        date = datetime.now() - timedelta(days=6 - i)
        changes_count = len([c for c in MOCK_DATA["recent_changes"]
                             if c["timestamp"].startswith(date.strftime("%Y-%m-%d"))])
        weekly_activity.append({
            "date": date.strftime("%Y-%m-%d"),
            "changes": changes_count
        })

    competitor_activity = {}
    for change in MOCK_DATA["recent_changes"]:
        comp = change["competitor"]
        competitor_activity[comp] = competitor_activity.get(comp, 0) + 1

    competitor_activity_list = [
        {"competitor": comp, "changes": count}
        for comp, count in competitor_activity.items()
    ]

    change_types = [
        {"type": "feature", "count": len([c for c in MOCK_DATA["recent_changes"] if "feature" in c["summary"].lower()]), "percentage": 45},
        {"type": "update", "count": len([c for c in MOCK_DATA["recent_changes"] if "update" in c["summary"].lower()]), "percentage": 35},
        {"type": "bug-fix", "count": len([c for c in MOCK_DATA["recent_changes"] if "fix" in c["summary"].lower()]), "percentage": 20}
    ]

    return jsonify({
        "weeklyActivity": weekly_activity,
        "competitorActivity": competitor_activity_list,
        "changeTypes": change_types
    })

@app.route("/api/settings", methods=["GET"])
def get_settings():
    return jsonify({
        "slackWebhook": bool(os.getenv("SLACK_WEBHOOK")),
        "groqApiKey": bool(os.getenv("GROQ_API_KEY")),
        "alwaysNotify": getattr(config, "ALWAYS_NOTIFY", False),
        "maxLinesPerCompetitor": getattr(config, "MAX_LINES_PER_COMPETITOR", 50),
        "monitoringInterval": "hourly"
    })

@app.route("/api/settings", methods=["POST"])
def update_settings():
    return jsonify({"success": True, "message": "Settings updated successfully"})

@app.route('/health')
def health():
    return jsonify({"status": "ok"}), 200

# Background monitoring scheduler
def background_monitor():
    schedule.every(1).hours.do(run_monitoring_job)
    while True:
        schedule.run_pending()
        time.sleep(60)

def run_monitoring_job():
    try:
        print("[INFO] Running scheduled monitoring...")
        MOCK_DATA["monitoring_status"]["isRunning"] = True
        MOCK_DATA["monitoring_status"]["totalRuns"] += 1

        changes = run(return_changes=True)
        if changes:
            print(f"[INFO] Found changes: {list(changes.keys())}")
            summary = summarize_all(changes)
            if config.SLACK_WEBHOOK:
                try:
                    send_slack(summary, config.SLACK_WEBHOOK)
                    print("[DEBUG] Scheduled Slack notification sent.")
                except Exception as e:
                    print(f"[ERROR] Slack notification failed: {e}")

            MOCK_DATA["monitoring_status"]["successfulRuns"] += 1
            for competitor_name, change_list in changes.items():
                for change in change_list:
                    MOCK_DATA["recent_changes"].append({
                        "id": len(MOCK_DATA["recent_changes"]) + 1,
                        "competitor": competitor_name,
                        "timestamp": datetime.now().isoformat() + "Z",
                        "summary": change[:100] + "..." if len(change) > 100 else change,
                        "changes": [change],
                        "type": "scheduled"
                    })
        else:
            print("[INFO] No changes detected")

        MOCK_DATA["monitoring_status"]["isRunning"] = False
        MOCK_DATA["monitoring_status"]["lastRun"] = datetime.now().isoformat() + "Z"
        MOCK_DATA["monitoring_status"]["nextRun"] = (datetime.now() + timedelta(hours=1)).isoformat() + "Z"
        MOCK_DATA["recent_changes"] = MOCK_DATA["recent_changes"][-100:]

    except Exception as e:
        print(f"[ERROR] Monitoring failed: {e}")
        MOCK_DATA["monitoring_status"]["isRunning"] = False
        MOCK_DATA["monitoring_status"]["failedRuns"] += 1

if __name__ == "__main__":
    monitor_thread = threading.Thread(target=background_monitor, daemon=True)
    monitor_thread.start()
    print("[INFO] Background monitoring started")
    port = int(os.getenv("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=False)
