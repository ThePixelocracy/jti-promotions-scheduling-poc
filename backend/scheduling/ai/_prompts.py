"""Prompt templates and domain-object-to-text formatters."""

from collections import defaultdict

from metrics.models import POSMetrics

_DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

# Thinking-tag delimiters shared with the stream parser.
THINK_START = "<thinking>"
THINK_END = "</thinking>"

# ── System prompt ──────────────────────────────────────────────────────────────

_BASE_SYSTEM_PROMPT = """\
You are an expert promoter scheduling AI for JTI Greece.

TASK: Create an optimal monthly visit schedule for JTI promoters visiting \
Points of Sale (POS — retail kiosks).

OPTIMIZATION GOAL: {optimization_goal}
Use this formula to prioritise WHEN to visit (prefer peak windows where \
this value is highest) and WHICH promoter to assign (prefer those with \
strong past performance at a location).
Also compute a SCHEDULE SCORE: sum the optimization formula value \
(avg_sales * 10 + avg_interviews, or whatever the goal formula is) \
for every scheduled visit, using the historical avg values for the \
chosen POS time window. Include this as the "score" field (integer).

OUTPUT FORMAT — respond with ONLY a JSON object in this exact structure:
{{
  "summary": "2-3 sentences explaining your key scheduling decisions",
  "score": <integer — total optimization score across all visits>,
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
10. Each promoter works exactly 5 days per week with 2 shifts per working day \
(morning and afternoon slots). Do not exceed this unless the user says otherwise.
11. Each promoter should typically work 1 Saturday and 1 Sunday across the whole \
schedule period (not per week). All other days must be Monday–Friday. \
Override this only if the user explicitly requests different weekend availability.
12. Keep each visit "reason" field to 10 words or fewer.

RESPONSE STRUCTURE — two sections in this exact order:

1. Open with your reasoning inside <thinking> tags (4–8 sentences). Walk \
through which promoters you are placing where, why you chose specific time \
windows, how you balanced weekend coverage, and any trade-offs made. Be \
specific — name promoters and POS where helpful.

<thinking>
...your reasoning here...
</thinking>

2. Immediately after the closing </thinking> tag output ONLY a valid JSON \
object — no other text before or after it.
"""


def build_system_prompt(optimization_goal: str) -> str:
    return _BASE_SYSTEM_PROMPT.format(optimization_goal=optimization_goal)


# ── Domain formatters ──────────────────────────────────────────────────────────


def _aggregate_metrics(pos) -> list[str]:
    """Return human-readable peak-window lines for a POS."""
    qs = POSMetrics.objects.filter(pos=pos)
    if not qs.exists():
        return []

    windows: dict = defaultdict(lambda: {"sales": [], "interviews": [], "days": set()})
    for m in qs:
        key = (f"{m.window_start:%H:%M}", f"{m.window_end:%H:%M}")
        windows[key]["sales"].append(m.sales)
        windows[key]["interviews"].append(m.interviews)
        windows[key]["days"].add(m.window_date.weekday())

    lines = []
    for (start, end), data in sorted(windows.items()):
        avg_sales = round(sum(data["sales"]) / len(data["sales"]), 1)
        avg_interviews = round(sum(data["interviews"]) / len(data["interviews"]), 1)
        days_str = ", ".join(_DAY_NAMES[d] for d in sorted(data["days"]))
        lines.append(
            f"    {start}-{end} ({days_str}): avg {avg_sales} sales, "
            f"{avg_interviews} interviews"
        )
    return lines


def _pos_block_line(pos) -> str:
    lines = [
        f"- id={pos.id} | {pos.cdb_code} | {pos.name} | "
        f"{pos.city} | Priority: {pos.priority or 'unknown'}"
    ]
    metrics = _aggregate_metrics(pos)
    lines += metrics if metrics else ["    (no historical metrics)"]
    return "\n".join(lines)


def _promoter_block_line(promoter) -> str:
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


# ── Message builder ────────────────────────────────────────────────────────────


def build_messages(schedule, optimization_goal: str, user_prompt: str) -> list[dict]:
    """
    Build the full messages list for the LLM call.

    Includes an assistant-turn primer ("<thinking>") so the model is forced
    to continue from that tag regardless of its default output style.
    """
    pos_list = list(schedule.included_pos.select_related().all())
    promoter_list = list(schedule.included_promoters.all())

    pos_block = "\n".join(_pos_block_line(p) for p in pos_list)
    promoter_block = "\n".join(_promoter_block_line(p) for p in promoter_list)

    user_content = (
        f"SCHEDULE: {schedule.name}\n"
        f"PERIOD: {schedule.period_start} to {schedule.period_end}\n\n"
        f"POINTS OF SALE ({len(pos_list)}):\n{pos_block}\n\n"
        f"PROMOTERS ({len(promoter_list)}):\n{promoter_block}\n\n"
        f"USER CONSTRAINTS:\n{user_prompt or 'None'}\n\n"
        "Generate the complete visit schedule now."
    )

    return [
        {"role": "system", "content": build_system_prompt(optimization_goal)},
        {"role": "user", "content": user_content},
        # Primer: forces the model to continue from <thinking>
        {"role": "assistant", "content": THINK_START},
    ]
