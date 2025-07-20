import os
import requests

GROQ_API_KEY = os.getenv("GROQ_API_KEY")

def summarize_all(changes):
    if not GROQ_API_KEY:
        return dummy_summary(changes)
    try:
        prompt = "Summarize these changes:\n" + str(changes)
        response = requests.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={"Authorization": f"Bearer {GROQ_API_KEY}"},
            json={
                "model": "llama3-8b-8192",
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0.5
            }
        )
        response.raise_for_status()
        return response.json()["choices"][0]["message"]["content"]
    except Exception as e:
        print(f"[WARN] Groq API failed ({e}), using dummy summary.")
        return dummy_summary(changes)

def dummy_summary(changes):
    return "\n".join(f"{comp}: {len(diff)} changes detected." for comp, diff in changes.items())
