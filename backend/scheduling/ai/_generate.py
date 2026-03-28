"""
Schedule generation.

`stream_generate_schedule` is the core implementation: it calls the LLM,
streams thinking deltas, then yields a single done event with parsed visits.

`generate_schedule` is a thin blocking wrapper used by the Django test suite
(which mocks it at the view level and never calls it directly).
"""

import json

from django.conf import settings

from ._client import make_client
from ._prompts import THINK_END, THINK_START, build_messages

# Number of trailing chars to hold back while scanning for the closing tag,
# so it is never split across two consecutive chunks.
_HOLD = len(THINK_END) - 1


def _extract_json(text: str) -> dict:
    """
    Pull the JSON object out of the raw accumulated LLM response.

    Handles two common model quirks:
      - Wrapping the JSON in a ```json … ``` code fence.
      - Leaving stray whitespace before/after the object.
    """
    json_text = text.split(THINK_END, 1)[1].strip() if THINK_END in text else text
    if json_text.startswith("```"):
        json_text = json_text.split("\n", 1)[1].rsplit("```", 1)[0]
    return json.loads(json_text.strip())


def stream_generate_schedule(schedule, optimization_goal: str, user_prompt: str):
    """
    Stream schedule generation as a sequence of event dicts.

    Yields
    ------
    {"type": "thinking", "delta": str}
        One or more chunks of the model's reasoning text, suitable for
        live display.  Emitted while the model is inside <thinking> tags.

    {"type": "done", "summary": str, "score": int | None,
     "visits": list, "usage": dict}
        Emitted once when the full response has been received and the JSON
        payload successfully parsed.

    {"type": "error", "message": str}
        Emitted instead of "done" if the LLM call or JSON parsing fails.
        The generator stops after this event.
    """
    messages = build_messages(schedule, optimization_goal, user_prompt)
    client = make_client()

    # Seed accumulated with the assistant primer so the thinking-tag parser
    # is already in the correct state before the first streamed chunk arrives.
    accumulated = THINK_START
    thinking_done = False
    hold_buf = ""
    total_tokens = 0

    try:
        stream = client.chat.completions.create(
            model=settings.OPENAI_MODEL,
            messages=messages,
            temperature=0.2,
            max_tokens=getattr(settings, "OPENAI_MAX_TOKENS", 65536),
            stream=True,
            stream_options={"include_usage": True},
        )
        for chunk in stream:
            if hasattr(chunk, "usage") and chunk.usage:
                total_tokens = chunk.usage.total_tokens or 0

            if not chunk.choices:
                continue

            delta = chunk.choices[0].delta.content or ""
            if not delta:
                continue

            accumulated += delta

            if thinking_done:
                continue

            # We are inside <thinking>. Buffer the tail to avoid yielding a
            # partial closing tag, then flush whatever is definitely safe.
            combined = hold_buf + delta
            if THINK_END in combined:
                thinking_done = True
                before_end = combined.split(THINK_END, 1)[0]
                if before_end:
                    yield {"type": "thinking", "delta": before_end}
                hold_buf = ""
            else:
                safe_len = max(0, len(combined) - _HOLD)
                safe, hold_buf = combined[:safe_len], combined[safe_len:]
                if safe:
                    yield {"type": "thinking", "delta": safe}

    except Exception as exc:
        yield {
            "type": "error",
            "message": str(exc),
            "messages": messages,
            "raw_response": accumulated,
            "total_tokens": total_tokens,
        }
        return

    try:
        result = _extract_json(accumulated)
    except Exception as exc:
        yield {
            "type": "error",
            "message": f"Failed to parse AI response: {exc}",
            "messages": messages,
            "raw_response": accumulated,
            "total_tokens": total_tokens,
        }
        return

    yield {
        "type": "done",
        "summary": result.get("summary", ""),
        "score": result.get("score"),
        "visits": result.get("visits", []),
        "usage": {
            "prompt_tokens": 0,
            "completion_tokens": 0,
            "total_tokens": total_tokens,
        },
        "messages": messages,
        "raw_response": accumulated,
        "total_tokens": total_tokens,
    }


def generate_schedule(schedule, optimization_goal: str, user_prompt: str) -> dict:
    """
    Blocking wrapper around `stream_generate_schedule`.

    Drives the generator to completion and returns the done-event dict
    directly.  Raises `RuntimeError` if the generator signals an error.

    This function exists for the Django test suite, which mocks it at the
    view level.  Production traffic always uses the streaming path.
    """
    for event in stream_generate_schedule(schedule, optimization_goal, user_prompt):
        if event["type"] == "done":
            return event
        if event["type"] == "error":
            raise RuntimeError(event["message"])
    raise RuntimeError("Stream ended without a done event.")
