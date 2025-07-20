import os
from groq import Groq

# Use environment variable
GROQ_API_KEY = os.getenv("GROQ_API_KEY")

def summarize_all(changes: dict) -> str:
    """
    Summarize all competitor changes using Groq LLM.
    """
    if not changes:
        return "No new changes detected this run."

    # Prepare text
    summary_input = []
    for name, items in changes.items():
        summary_input.append(f"{name} Updates:")
        for i, change in enumerate(items, 1):
            summary_input.append(f"{i}. {change}")
    text = "\n".join(summary_input)

    # If no Groq key, fallback to simple summarizer
    if not GROQ_API_KEY:
        return "[Groq Missing] Fallback:\n" + text[:1000]

    try:
        client = Groq(api_key=GROQ_API_KEY)
        completion = client.chat.completions.create(
            messages=[
                {"role": "system", "content": "Summarize competitor updates in bullet points, focusing on product, pricing, or new features."},
                {"role": "user", "content": text}
            ],
            model="mixtral-8x7b-32768",
            temperature=0.2,
            max_tokens=300
        )
        return completion.choices[0].message.content.strip()
    except Exception as e:
        return f"[Groq Error: {e}]\n\n" + text[:1000]
