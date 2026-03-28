"""
Schedule generation via AWS Bedrock converse_stream.

`stream_generate_schedule` is the core implementation: it calls the Bedrock
converse API with extended thinking enabled, streams thinking deltas, then
yields a single done event with parsed visits.

`generate_schedule` is a thin blocking wrapper used by the Django test suite
(which mocks it at the view level and never calls it directly).
"""

import json

from django.conf import settings

from ._client import make_client
from ._prompts import build_messages


def _extract_json(text: str) -> dict:
    """
    Pull the JSON object out of the raw text content returned by the model.

    Handles the common model quirk of wrapping JSON in a ```json … ``` fence.
    """
    text = text.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[1].rsplit("```", 1)[0]
    return json.loads(text.strip())


def stream_generate_schedule(schedule, optimization_goal: str, user_prompt: str):
    """
    Stream schedule generation as a sequence of event dicts.

    Yields
    ------
    {"type": "thinking", "delta": str}
        One or more chunks of the model's extended thinking text, suitable
        for live display.

    {"type": "done", "summary": str, "score": int | None,
     "visits": list, "usage": dict, "messages": dict, "raw_response": str,
     "total_tokens": int}
        Emitted once when the full response has been received and the JSON
        payload successfully parsed.

    {"type": "error", "message": str, "messages": dict, "raw_response": str,
     "total_tokens": int}
        Emitted instead of "done" if the Bedrock call or JSON parsing fails.
        The generator stops after this event.
    """
    prompt = build_messages(schedule, optimization_goal, user_prompt)
    client = make_client()

    thinking_buf = ""
    json_buf = ""
    total_tokens = 0

    thinking_budget = getattr(settings, "BEDROCK_THINKING_BUDGET", 8000)

    kwargs = {
        "modelId": settings.BEDROCK_MODEL,
        "system": [{"text": prompt["system"]}],
        "messages": [
            {
                "role": "user",
                "content": [{"text": prompt["user"]}],
            }
        ],
        "inferenceConfig": {"maxTokens": 8192},
    }
    if thinking_budget > 0:
        kwargs["additionalModelRequestFields"] = {
            "thinking": {"type": "enabled", "budget_tokens": thinking_budget}
        }

    try:
        response = client.converse_stream(**kwargs)

        for event in response["stream"]:
            if "metadata" in event:
                usage = event["metadata"].get("usage", {})
                total_tokens = usage.get("totalTokens", 0)
                continue

            if "contentBlockDelta" not in event:
                continue

            delta = event["contentBlockDelta"]["delta"]

            if "thinkingDelta" in delta:
                # Anthropic extended thinking
                chunk = delta["thinkingDelta"].get("thinkingInput", "")
                thinking_buf += chunk
                if chunk:
                    yield {"type": "thinking", "delta": chunk}

            elif "textDelta" in delta:
                # Anthropic text (non-thinking path)
                json_buf += delta["textDelta"].get("text", "")

            elif "text" in delta:
                # Non-Anthropic models (e.g. Qwen, Nova)
                chunk = delta["text"]
                json_buf += chunk
                if chunk:
                    yield {"type": "thinking", "delta": chunk}

    except Exception as exc:
        yield {
            "type": "error",
            "message": str(exc),
            "messages": prompt,
            "raw_response": thinking_buf + json_buf,
            "total_tokens": total_tokens,
        }
        return

    try:
        result = _extract_json(json_buf)
    except Exception as exc:
        yield {
            "type": "error",
            "message": f"Failed to parse AI response: {exc}",
            "messages": prompt,
            "raw_response": json_buf,
            "total_tokens": total_tokens,
        }
        return

    raw_response = f"<thinking>{thinking_buf}</thinking>\n{json_buf}"

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
        "messages": prompt,
        "raw_response": raw_response,
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
