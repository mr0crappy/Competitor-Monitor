import os
from groq import Groq

# Defaults (override via env if you want)
DEFAULT_MODEL = os.getenv("GROQ_MODEL", "llama-3.1-8b-instant")
MAX_ITEMS_PER_COMP = int(os.getenv("SUMMARIZER_MAX_ITEMS", "50"))       # cap list size sent to LLM
MAX_CHARS_PROMPT   = int(os.getenv("SUMMARIZER_MAX_PROMPT_CHARS", "20000"))  # total char safety cap


def _fallback_summary(changes: dict, max_show: int = 5) -> str:
    """Cheap summarizer used when Groq unavailable or errors."""
    if not changes:
        return "No new changes detected this run."
    lines = ["(Fallback summary)"]
    for name, items in changes.items():
        lines.append(f"{name}: {len(items)} change(s)")
        for i, it in enumerate(items[:max_show], 1):
            compact = " ".join(it.split())
            lines.append(f"  {i}. {compact[:200]}")
        if len(items) > max_show:
            lines.append(f"  ... {len(items) - max_show} more")
    return "\n".join(lines)


def _prepare_prompt_text(changes: dict) -> str:
    """Flatten dict → prompt text, truncate aggressively to avoid token bloat."""
    parts = []
    for name, items in changes.items():
        parts.append(f"{name} Updates:")
        # trim per-competitor
        trimmed = items[:MAX_ITEMS_PER_COMP]
        for i, change in enumerate(trimmed, 1):
            # collapse whitespace; trim super long lines
            compact = " ".join(change.split())
            parts.append(f"{i}. {compact[:500]}")
        parts.append("")  # blank line
    text = "\n".join(parts)
    # global cap
    if len(text) > MAX_CHARS_PROMPT:
        text = text[:MAX_CHARS_PROMPT] + "\n...[truncated]..."
    return text


def summarize_all(changes: dict,
                  model: str = DEFAULT_MODEL,
                  temperature: float = 0.2,
                  max_tokens: int = 300) -> str:
    """
    Summarize competitor changes using Groq LLM if available; fallback otherwise.
    """
    if not changes:
        return "No new changes detected this run."

    api_key = os.getenv("GROQ_API_KEY")  # read at call time
    if not api_key:
        return "[Groq Missing] " + _fallback_summary(changes)

    prompt_text = _prepare_prompt_text(changes)

    try:
        client = Groq(api_key=api_key)
        completion = client.chat.completions.create(
            model=model,
            temperature=temperature,
            max_tokens=max_tokens,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are a product intelligence assistant. Summarize competitor updates "
                        "as concise bullet points grouped by competitor. Highlight new features, "
                        "pricing changes, plan tier changes, deprecations, major UX improvements, "
                        "and messaging shifts. If noise (minor fixes/docs) dominates, condense."
                    ),
                },
                {"role": "user", "content": prompt_text},
            ],
        )
        return completion.choices[0].message.content.strip()

    except Exception as e:
        # Don’t dump API key or raw exception text to Slack; keep it short.
        print(f"[WARN] Groq summarization failed: {e}")
        return "[Groq Error] " + _fallback_summary(changes)
