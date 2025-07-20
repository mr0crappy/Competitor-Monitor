from flask import Flask, jsonify
from main import run  # Import your existing run function

app = Flask(__name__)

@app.route("/api/updates", methods=["GET"])
def get_updates():
    # Modify run() to return all_changes instead of sending Slack messages
    try:
        from diff_detector import compute_diff
        from scraper import fetch_changelog
        from summarizer import summarize_all
        import config
        
        all_changes = {}
        for comp in config.COMPETITORS:
            raw = fetch_changelog(comp["changelog"])
            if raw is None:
                continue
            old = []  # load_snapshot placeholder
            new = raw.splitlines()
            diff = compute_diff(old, new)
            if diff:
                all_changes[comp["name"]] = diff

        summary = summarize_all(all_changes)
        return jsonify([
            {"name": name, "summary": "\n".join(changes)}
            for name, changes in all_changes.items()
        ])
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
