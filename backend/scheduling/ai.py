"""
AI schedule generation using OpenAI.

Builds a structured prompt from schedule data + POS metrics, calls the
configured model, and returns parsed visit proposals.
"""

import json
from collections import defaultdict

from django.conf import settings
from openai import OpenAI

from metrics.models import POSMetrics

_DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

_SYSTEM_PROMPT = """\
You are an expert promoter scheduling AI for JTI Greece.

TASK: Create an optimal monthly visit schedule for JTI promoters visiting \
Points of Sale (POS — retail kiosks).

OPTIMIZATION GOAL: {optimization_goal}
Use this formula to prioritise WHEN to visit (prefer peak windows where \
this value is highest) and WHICH promoter to assign (prefer those with \
strong past performance at a location).

OUTPUT FORMAT — respond with ONLY a JSON object in this exact structure:
{{
  "summary": "2-3 sentences explaining your key scheduling decisions",
  "visits": [
    {{
      "pos_id": <integer>,
      "promoter_id": <integer>,
      "date": "YYYY-MM-DD",
      "start_time": "HH:MM",
      "end_time": "HH:MM",
      "reason": "one sentence: why this promoter, POS and time slot"
    }}
  ]
}}

RULES:
1. All dates must fall within the schedule period (inclusive).
2. A promoter cannot have two visits that overlap in time on the same day.
3. Prefer historically peak time windows (higher avg_sales / avg_interviews).
4. Match promoters to POS in their region (promoter base_city ≈ POS city).
5. Permanent and Exclusive promoters take priority; Radical for extra coverage.
6. Each visit must be 1–4 hours. Align with the peak window start/end.
7. Use only pos_id and promoter_id values from the lists below.
8. Target visit frequency by priority:
   Strategic = 3–4 visits/month, Prime = 2–3, BaseLine = 1–2, Developing = 1.
9. Spread visits across the whole month — do not cluster in one week.
"""


def _aggregate_metrics(pos):
    """Return aggregated peak-window data for a POS."""
    qs = POSMetrics.objects.filter(pos=pos)
    if not qs.exists():
        return []

    windows: dict = defaultdict(lambda: {"sales": [], "interviews": [], "days": set()})
    for m in qs:
        key = (f"{m.window_start:%H:%M}", f"{m.window_end:%H:%M}")
        windows[key]["sales"].append(m.sales)
        windows[key]["interviews"].append(m.interviews)
        windows[key]["days"].add(m.window_date.weekday())

    result = []
    for (start, end), data in sorted(windows.items()):
        avg_sales = round(sum(data["sales"]) / len(data["sales"]), 1)
        avg_interviews = round(sum(data["interviews"]) / len(data["interviews"]), 1)
        days_str = ", ".join(_DAY_NAMES[d] for d in sorted(data["days"]))
        result.append(
            f"    {start}-{end} ({days_str}): avg {avg_sales} sales, "
            f"{avg_interviews} interviews"
        )
    return result


def _pos_line(pos):
    lines = [
        f"- id={pos.id} | {pos.cdb_code} | {pos.name} | "
        f"{pos.city} | Priority: {pos.priority or 'unknown'}"
    ]
    metrics = _aggregate_metrics(pos)
    lines += metrics if metrics else ["    (no historical metrics)"]
    return "\n".join(lines)


def _promoter_line(promoter):
    parts = [
        f"- id={promoter.id}",
        f"{promoter.first_name} {promoter.last_name}",
        promoter.programme_type,
    ]
    if promoter.team:
        parts.append(promoter.team)
    if promoter.base_city:
        parts.append(f"Base: {promoter.base_city}")
    return " | ".join(parts)


def generate_schedule(schedule, optimization_goal: str, user_prompt: str) -> dict:
    """
    Call OpenAI to generate visit proposals for *schedule*.

    Returns a dict:
        summary  – str, AI explanation
        visits   – list of dicts with pos_id, promoter_id, date,
                   start_time, end_time, reason
        usage    – dict with token counts
    """
    pos_list = list(schedule.included_pos.select_related().all())
    promoter_list = list(schedule.included_promoters.all())

    pos_block = "\n".join(_pos_line(p) for p in pos_list)
    promoter_block = "\n".join(_promoter_line(p) for p in promoter_list)

    system = _SYSTEM_PROMPT.format(optimization_goal=optimization_goal)

    user_message = (
        f"SCHEDULE: {schedule.name}\n"
        f"PERIOD: {schedule.period_start} to {schedule.period_end}\n\n"
        f"POINTS OF SALE ({len(pos_list)}):\n{pos_block}\n\n"
        f"PROMOTERS ({len(promoter_list)}):\n{promoter_block}\n\n"
        f"USER CONSTRAINTS:\n{user_prompt or 'None'}\n\n"
        "Generate the complete visit schedule now."
    )

    client_kwargs = {"api_key": settings.OPENAI_API_KEY}
    base_url = getattr(settings, "OPENAI_BASE_URL", None)
    if base_url:
        client_kwargs["base_url"] = base_url

    client = OpenAI(**client_kwargs)
    response = client.chat.completions.create(
        model=settings.OPENAI_MODEL,
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user_message},
        ],
        temperature=0.2,
    )

    raw = response.choices[0].message.content
    result = json.loads(raw)

    return {
        "summary": result.get("summary", ""),
        "visits": result.get("visits", []),
        "usage": {
            "prompt_tokens": response.usage.prompt_tokens,
            "completion_tokens": response.usage.completion_tokens,
            "total_tokens": response.usage.total_tokens,
        },
    }
