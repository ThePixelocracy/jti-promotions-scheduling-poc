"""Tests for the AI schedule generation endpoint."""

from datetime import date
from unittest.mock import patch

from django.test import override_settings
from rest_framework.test import APITestCase

from scheduling.models import ScheduledVisit

from ._helpers import (
    _make_pos,
    _make_promoter,
    _make_schedule,
    _make_user,
    _make_visit,
)

_MOCK_AI_RESULT = {
    "summary": "Scheduled 2 visits based on peak windows.",
    "score": 840,
    "visits": [
        {
            "pos_id": None,  # filled in setUp
            "promoter_id": None,
            "date": "2026-04-03",
            "start_time": "09:00",
            "end_time": "11:00",
            "reason": "Peak morning window.",
        },
        {
            "pos_id": None,
            "promoter_id": None,
            "date": "2026-04-10",
            "start_time": "15:00",
            "end_time": "17:00",
            "reason": "Afternoon peak.",
        },
    ],
    "usage": {"prompt_tokens": 500, "completion_tokens": 200, "total_tokens": 700},
}


@override_settings(BEDROCK_MODEL="anthropic.claude-test")
class ScheduleGenerateTest(APITestCase):
    def setUp(self):
        self.user = _make_user()
        self.client.force_authenticate(user=self.user)
        self.pos = _make_pos()
        self.promoter = _make_promoter()
        self.schedule = _make_schedule(
            self.user, "April 2026", date(2026, 4, 1), date(2026, 4, 30)
        )
        self.schedule.included_pos.add(self.pos)
        self.schedule.included_promoters.add(self.promoter)
        self.mock_result = {
            **_MOCK_AI_RESULT,
            "visits": [
                {**v, "pos_id": self.pos.pk, "promoter_id": self.promoter.pk}
                for v in _MOCK_AI_RESULT["visits"]
            ],
        }

    def _post(self, payload=None):
        return self.client.post(
            f"/api/schedules/{self.schedule.pk}/generate/",
            payload or {},
            format="json",
        )

    def test_unauthenticated_returns_401(self):
        self.client.logout()
        self.assertEqual(self._post().status_code, 401)

    @patch("scheduling.views._generate.generate_schedule")
    def test_returns_200_with_visits(self, mock_gen):
        mock_gen.return_value = self.mock_result
        response = self._post({"optimization_goal": "sales * 10 + interviews"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data["visits"]), 2)
        self.assertIn("summary", response.data)
        self.assertIn("usage", response.data)

    @patch("scheduling.views._generate.generate_schedule")
    def test_score_returned_in_response(self, mock_gen):
        mock_gen.return_value = self.mock_result
        self.assertEqual(self._post().data["score"], 840)

    @patch("scheduling.views._generate.generate_schedule")
    def test_score_saved_to_schedule(self, mock_gen):
        mock_gen.return_value = self.mock_result
        self._post()
        self.schedule.refresh_from_db()
        self.assertEqual(self.schedule.score, 840)

    @patch("scheduling.views._generate.generate_schedule")
    def test_clears_existing_visits_before_creating(self, mock_gen):
        mock_gen.return_value = self.mock_result
        _make_visit(self.schedule, self.pos)
        self._post()
        self.assertEqual(
            ScheduledVisit.objects.filter(schedule=self.schedule).count(), 2
        )

    @patch("scheduling.views._generate.generate_schedule")
    def test_visits_saved_to_db(self, mock_gen):
        mock_gen.return_value = self.mock_result
        self._post()
        visits = ScheduledVisit.objects.filter(schedule=self.schedule).order_by("date")
        self.assertEqual(visits.count(), 2)
        self.assertEqual(visits[0].date, date(2026, 4, 3))
        self.assertEqual(str(visits[0].start_time)[:5], "09:00")
        self.assertEqual(visits[0].promoter, self.promoter)
        self.assertEqual(visits[0].comments, "Peak morning window.")

    @patch("scheduling.views._generate.generate_schedule")
    def test_week_label_computed_correctly(self, mock_gen):
        mock_gen.return_value = self.mock_result
        self._post()
        visits = ScheduledVisit.objects.filter(schedule=self.schedule).order_by("date")
        self.assertEqual(visits[0].week_label, "W1")
        self.assertEqual(visits[1].week_label, "W2")

    @patch("scheduling.views._generate.generate_schedule")
    def test_unknown_pos_id_skipped_and_reported(self, mock_gen):
        mock_gen.return_value = {
            **self.mock_result,
            "visits": [
                {
                    "pos_id": 99999,
                    "promoter_id": self.promoter.pk,
                    "date": "2026-04-03",
                    "start_time": "09:00",
                    "end_time": "11:00",
                    "reason": "test",
                }
            ],
        }
        response = self._post()
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data["visits"]), 0)
        self.assertEqual(len(response.data["errors"]), 1)

    @patch("scheduling.views._generate.generate_schedule")
    def test_ai_error_returns_502(self, mock_gen):
        mock_gen.side_effect = Exception("OpenAI timeout")
        response = self._post()
        self.assertEqual(response.status_code, 502)
        self.assertIn("error", response.data)

    @override_settings(BEDROCK_MODEL="")
    def test_missing_model_returns_503(self):
        self.assertEqual(self._post().status_code, 503)
