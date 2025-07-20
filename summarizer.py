import os
from openai import OpenAI
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
def summarize_all(changes: dict) -> str:
    prompt = "Here are the updates from competitors:\n"
    for name, items in changes.items():
        prompt += f"\n{name}:\n" + "\n".join(items) + "\n"
    prompt += "\nWrite a concise weekly summary."
    resp = client.chat.completions.create(
        model="gpt-4o-mini", messages=[{"role":"user","content":prompt}]
    )
    return resp.choices[0].message.content
