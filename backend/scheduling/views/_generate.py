"""AI schedule generation view (blocking + SSE streaming)."""

import json

from django.conf import settings
from django.http import StreamingHttpResponse
from rest_framework import status as drf_status
from rest_framework.permissions import IsAuthenticated
from rest_framework.renderers import BaseRenderer, JSONRenderer
from rest_framework.response import Response
from rest_framework.views import APIView

from ..ai import generate_schedule, stream_generate_schedule
from ..models import LLMCallLog, Schedule
from ..serializers import ScheduledVisitSerializer
from ._helpers import _create_visits_from_ai


class ServerSentEventRenderer(BaseRenderer):
    media_type = "text/event-stream"
    format = "event-stream"

    def render(self, data, accepted_media_type=None, renderer_context=None):
        return data


class ScheduleGenerateView(APIView):
    permission_classes = [IsAuthenticated]
    renderer_classes = [JSONRenderer, ServerSentEventRenderer]

    def post(self, request, pk):
        if not settings.BEDROCK_MODEL:
            return Response(
                {"error": "BEDROCK_MODEL is not configured on the server."},
                status=drf_status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        schedule = Schedule.objects.prefetch_related(
            "included_pos", "included_promoters"
        ).get(pk=pk)
        optimization_goal = request.data.get(
            "optimization_goal", "sales * 10 + interviews"
        )
        user_prompt = request.data.get("user_prompt", "")

        if "text/event-stream" in request.META.get("HTTP_ACCEPT", ""):
            return self._stream(schedule, optimization_goal, user_prompt)

        # Blocking path — used by the Django test suite (mocked at the view level)
        try:
            result = generate_schedule(schedule, optimization_goal, user_prompt)
        except Exception as e:
            return Response(
                {"error": f"AI generation failed: {e}"},
                status=drf_status.HTTP_502_BAD_GATEWAY,
            )

        LLMCallLog.objects.create(
            schedule=schedule,
            model_name=settings.BEDROCK_MODEL,
            optimization_goal=optimization_goal,
            user_prompt=user_prompt,
            prompt=result.get("messages", []),
            raw_response=result.get("raw_response", ""),
            total_tokens=result.get("total_tokens"),
            status=LLMCallLog.Status.SUCCESS,
        )

        pos_map = {p.id: p for p in schedule.included_pos.all()}
        promoter_map = {p.id: p for p in schedule.included_promoters.all()}
        created, errors = _create_visits_from_ai(
            schedule, result["visits"], pos_map, promoter_map
        )

        schedule.score = result.get("score")
        schedule.save(update_fields=["score"])

        serializer = ScheduledVisitSerializer(created, many=True)
        return Response(
            {
                "summary": result["summary"],
                "score": result.get("score"),
                "visits": serializer.data,
                "usage": result["usage"],
                "errors": errors,
            },
            status=drf_status.HTTP_200_OK,
        )

    def _stream(self, schedule, optimization_goal, user_prompt):
        pos_map = {p.id: p for p in schedule.included_pos.all()}
        promoter_map = {p.id: p for p in schedule.included_promoters.all()}

        def _event_generator():
            for event in stream_generate_schedule(
                schedule, optimization_goal, user_prompt
            ):
                if event["type"] == "thinking":
                    yield f"data: {json.dumps(event)}\n\n"
                    continue

                if event["type"] == "error":
                    LLMCallLog.objects.create(
                        schedule=schedule,
                        model_name=settings.BEDROCK_MODEL,
                        optimization_goal=optimization_goal,
                        user_prompt=user_prompt,
                        prompt=event.get("messages", []),
                        raw_response=event.get("raw_response", ""),
                        total_tokens=event.get("total_tokens"),
                        status=LLMCallLog.Status.ERROR,
                        error_message=event.get("message", ""),
                    )
                    err_payload = {"type": "error", "message": event["message"]}
                    yield f"data: {json.dumps(err_payload)}\n\n"
                    continue

                # "done" — persist log + visits + score, then emit the SSE payload
                LLMCallLog.objects.create(
                    schedule=schedule,
                    model_name=settings.BEDROCK_MODEL,
                    optimization_goal=optimization_goal,
                    user_prompt=user_prompt,
                    prompt=event.get("messages", []),
                    raw_response=event.get("raw_response", ""),
                    total_tokens=event.get("total_tokens"),
                    status=LLMCallLog.Status.SUCCESS,
                )
                created, errors = _create_visits_from_ai(
                    schedule, event.get("visits", []), pos_map, promoter_map
                )
                schedule.score = event.get("score")
                schedule.save(update_fields=["score"])

                serializer = ScheduledVisitSerializer(created, many=True)
                payload = {
                    "type": "done",
                    "summary": event.get("summary", ""),
                    "score": event.get("score"),
                    "visits": list(serializer.data),
                    "usage": event.get("usage", {}),
                    "errors": errors,
                }
                yield f"data: {json.dumps(payload, default=str)}\n\n"

        response = StreamingHttpResponse(
            _event_generator(), content_type="text/event-stream"
        )
        response["Cache-Control"] = "no-cache"
        response["X-Accel-Buffering"] = "no"
        return response
