from flask import Flask, jsonify
from main import run  # import your run function

app = Flask(__name__)

@app.route("/api/summary", methods=["GET"])
def get_summary():
    # Run competitor monitor logic
    try:
        all_changes = run(return_data=True)  # Modify run() to return summary
        return jsonify({"updates": all_changes})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
